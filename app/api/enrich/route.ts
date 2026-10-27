import { NextRequest, NextResponse } from 'next/server';
import { AgentEnrichmentStrategy } from '@/lib/strategies/agent-enrichment-strategy';
import type { EnrichmentRequest, RowEnrichmentResult } from '@/lib/types';
import { loadSkipList, shouldSkipEmail, getSkipReason } from '@/lib/utils/skip-list';
import { ENRICHMENT_CONFIG } from '@/lib/config/enrichment';

// Use Node.js runtime for better compatibility
export const runtime = 'nodejs';

// Store active sessions in memory (in production, use Redis or similar)
const activeSessions = new Map<string, AbortController>();

export async function POST(request: NextRequest) {
  try {
    // Add request body size check
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    const body: EnrichmentRequest = await request.json();
    const { rows, fields, emailColumn, nameColumn } = body;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows provided' },
        { status: 400 }
      );
    }

    if (!fields || fields.length === 0 || fields.length > 10) {
      return NextResponse.json(
        { error: 'Please provide 1-10 fields to enrich' },
        { status: 400 }
      );
    }

    if (!emailColumn) {
      return NextResponse.json(
        { error: 'Email column is required' },
        { status: 400 }
      );
    }

    // Use a more compatible UUID generation
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const abortController = new AbortController();

    // Check environment variables and headers for API keys
    const openaiApiKey = process.env.OPENAI_API_KEY || request.headers.get('X-OpenAI-API-Key');
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || request.headers.get('X-Firecrawl-API-Key');
    
    if (!openaiApiKey || !firecrawlApiKey) {
      console.error('Missing API keys:', { 
        hasOpenAI: !!openaiApiKey, 
        hasFirecrawl: !!firecrawlApiKey 
      });
      return NextResponse.json(
        { error: 'Server configuration error: Missing API keys' },
        { status: 500 }
      );
    }

    // Always use the advanced agent architecture
    const strategyName = 'AgentEnrichmentStrategy';
    
    console.log(`[STRATEGY] Using ${strategyName} - Advanced multi-agent architecture with specialized agents`);
    const enrichmentStrategy = new AgentEnrichmentStrategy(
      openaiApiKey,
      firecrawlApiKey
    );

    // Load skip list
    const skipList = await loadSkipList();

    // Create a streaming response
    const encoder = new TextEncoder();
    let streamClosed = false;
    let notifyCancelled: () => void;
    const cancelled = new Promise<void>(resolve => { notifyCancelled = resolve; });
    abortController.signal.addEventListener('abort', () => notifyCancelled(), { once: true });
    const onDisconnect = () => abortController.abort();
    request.signal.addEventListener('abort', onDisconnect, { once: true });
    if (request.signal.aborted) abortController.abort();
    activeSessions.set(sessionId, abortController);
    const cleanup = () => {
      activeSessions.delete(sessionId);
      request.signal.removeEventListener('abort', onDisconnect);
    };
    const stream = new ReadableStream({
      async start(controller) {
        // In-flight providers may finish after cancellation. Their callbacks must
        // never write into a closed stream or change the terminal event.
        const enqueue = (chunk: Uint8Array, terminal = false) => {
          if (!streamClosed && (terminal || !abortController.signal.aborted)) controller.enqueue(chunk);
        };
        try {
          // Send session ID
          enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`
            )
          );

          // Process rows with rolling concurrency (as each finishes, start the next)
          const concurrency = ENRICHMENT_CONFIG.CONCURRENT_ROWS;
          console.log(`[ENRICHMENT] Processing ${rows.length} rows with rolling concurrency: ${concurrency}`);

          // Send pending status for all rows
          for (let i = 0; i < rows.length; i++) {
            enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'pending',
                  rowIndex: i,
                  totalRows: rows.length,
                })}\n\n`
              )
            );
          }

          // Process rows with rolling concurrency
          const processRow = async (i: number) => {
            // Check if cancelled
            if (abortController.signal.aborted) {
              return;
            }

            const row = rows[i];
            const email = row[emailColumn];

            // Add name to row context if nameColumn is provided
            if (nameColumn && row[nameColumn]) {
              row._name = row[nameColumn];
            }

            // Check if email should be skipped
            if (email && shouldSkipEmail(email, skipList)) {
              const skipReason = getSkipReason(email, skipList);

              // Send skip result
              const skipResult: RowEnrichmentResult = {
                rowIndex: i,
                originalData: row,
                enrichments: {},
                status: 'skipped',
                error: skipReason,
              };

              enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result: skipResult,
                  })}\n\n`
                )
              );

              return;
            }

            // Send processing status
            enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'processing',
                  rowIndex: i,
                  totalRows: rows.length,
                })}\n\n`
              )
            );

            try {
              // Enrich the row
              console.log(`[ENRICHMENT] Processing row ${i + 1}/${rows.length} - Email: ${email} - Strategy: ${strategyName}`);
              const startTime = Date.now();

              // Agent strategies return RowEnrichmentResult
              const result = await enrichmentStrategy.enrichRow(
                row,
                fields,
                emailColumn,
                undefined, // onProgress
                (message: string, type: 'info' | 'success' | 'warning' | 'agent', sourceUrl?: string) => {
                  // Stream agent progress messages
                  enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'agent_progress',
                        rowIndex: i,
                        message,
                        messageType: type,
                        sourceUrl, // Include sourceUrl for favicons
                      })}\n\n`
                    )
                  );
                }
              );
              result.rowIndex = i; // Set the correct row index

              const duration = Date.now() - startTime;
              console.log(`[ENRICHMENT] Completed row ${i + 1} in ${duration}ms - Fields enriched: ${Object.keys(result.enrichments).length}`);

              // Log which fields were successfully enriched
              const enrichedFields = Object.entries(result.enrichments)
                .filter(([, enrichment]) => enrichment.value)
                .map(([fieldName, enrichment]) => `${fieldName}: ${enrichment.value ? '✓' : '✗'}`)
                .join(', ');
              if (enrichedFields) {
                console.log(`[ENRICHMENT] Fields: ${enrichedFields}`);
              }

              // Send result
              enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result,
                  })}\n\n`
                )
              );
            } catch (error) {
              // Send error for this row
              const errorResult: RowEnrichmentResult = {
                rowIndex: i,
                originalData: row,
                enrichments: {},
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              };

              enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result: errorResult,
                  })}\n\n`
                )
              );
            }
          };

          // Create a queue and process with rolling concurrency
          let currentIndex = 0;
          const activePromises: Promise<void>[] = [];

          while (currentIndex < rows.length || activePromises.length > 0) {
            // Check if cancelled
            if (abortController.signal.aborted) {
              break;
            }

            // Start new rows up to concurrency limit
            while (currentIndex < rows.length && activePromises.length < concurrency) {
              const rowIndex = currentIndex++;
              const promise = processRow(rowIndex).then(() => {
                // Remove this promise from active list when done
                const index = activePromises.indexOf(promise);
                if (index > -1) {
                  activePromises.splice(index, 1);
                }
              });
              activePromises.push(promise);
            }

            // Wait for at least one to finish before continuing
            if (activePromises.length > 0) {
              await Promise.race([...activePromises, cancelled]);
            }
          }

          enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: abortController.signal.aborted ? 'cancelled' : 'complete' })}\n\n`
            ),
            true
          );
        } catch (error) {
          enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              })}\n\n`
            )
          );
        } finally {
          cleanup();
          if (!streamClosed) {
            streamClosed = true;
            controller.close();
          }
        }
      },
      cancel() {
        streamClosed = true;
        abortController.abort();
        cleanup();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to start enrichment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start enrichment',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Cancel endpoint
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const controller = activeSessions.get(sessionId);
  if (controller) {
    controller.abort();
    activeSessions.delete(sessionId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: 'Session not found' },
    { status: 404 }
  );
}