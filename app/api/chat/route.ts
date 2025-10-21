import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlService } from '@/lib/services/firecrawl';
import { OpenAIService } from '@/lib/services/openai';

export const runtime = 'nodejs';

// Store active queries
const activeQueries = new Map<string, AbortController>();

export async function POST(request: NextRequest) {
  try {
    const { question, context, conversationHistory, sessionId } = await request.json();

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Get API keys and base URL
    const openaiApiKey = process.env.OPENAI_API_KEY || request.headers.get('X-OpenAI-API-Key');
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || request.headers.get('X-Firecrawl-API-Key');
    const openaiBaseUrl = process.env.OPENAI_BASE_URL || request.headers.get('X-OpenAI-Base-URL') || undefined;

    if (!openaiApiKey || !firecrawlApiKey) {
      return NextResponse.json(
        { error: 'Missing API keys' },
        { status: 500 }
      );
    }

    // Create abort controller for this query
    const abortController = new AbortController();
    const queryId = sessionId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    activeQueries.set(queryId, abortController);

    const firecrawl = new FirecrawlService(firecrawlApiKey);
    const openai = new OpenAIService(openaiApiKey, openaiBaseUrl);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: Check table data first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: 'Checking enriched table data...',
                step: 'table_check'
              })}\n\n`
            )
          );

          // Try to answer from table data first
          const tableData = context?.tableData || '';
          if (tableData && tableData.trim().length > 0) {
            console.log('[Chat API] Checking table data, length:', tableData.length);
            const tableAnswer = await openai.answerFromTableData(question, tableData, conversationHistory);

            if (tableAnswer && tableAnswer.found) {
              console.log('[Chat API] Answer found in table data');
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'status',
                    message: '✓ Found answer in enriched data',
                    step: 'table_found'
                  })}\n\n`
                )
              );

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'response',
                    message: tableAnswer.answer,
                    source: { type: 'table', title: 'Enriched Data Table' }
                  })}\n\n`
                )
              );

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'complete' })}\n\n`
                )
              );
              return;
            } else {
              console.log('[Chat API] Answer not found in table, searching web');
            }
          } else {
            console.log('[Chat API] No table data available, searching web');
          }

          // Step 2: If not found in table, search the web
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: 'Searching the web for more information...',
                step: 'web_search'
              })}\n\n`
            )
          );

          const searchQuery = await openai.generateSearchQuery(question, {
            ...context,
            conversationHistory
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: `Searching for: "${searchQuery}"`,
                step: 'search'
              })}\n\n`
            )
          );

          // Step 2: Search for relevant sources
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: 'Executing web search...',
                step: 'searching'
              })}\n\n`
            )
          );

          const searchResults = await firecrawl.search(searchQuery, { limit: 5 });

          if (searchResults.length === 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'response',
                  message: "I couldn't find any relevant information. Could you rephrase your question?"
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: `Found ${searchResults.length} sources`,
                step: 'select',
                sources: searchResults.map(r => ({ url: r.url, title: r.title }))
              })}\n\n`
            )
          );

          // Step 3: Evaluating sources
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: 'Evaluating source relevance...',
                step: 'evaluating'
              })}\n\n`
            )
          );

          const bestSource = await openai.selectBestSource(searchResults, question);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: `Selected: ${bestSource.title || new URL(bestSource.url).hostname}`,
                step: 'selected',
                source: { url: bestSource.url, title: bestSource.title }
              })}\n\n`
            )
          );

          // Step 4: Reading content
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: `Reading content from ${new URL(bestSource.url).hostname}...`,
                step: 'scrape',
                source: { url: bestSource.url, title: bestSource.title }
              })}\n\n`
            )
          );

          const scrapedData = await firecrawl.scrapeUrl(bestSource.url);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: 'Extracting relevant information...',
                step: 'extracting'
              })}\n\n`
            )
          );

          // Step 5: Analyzing and formulating response
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                message: 'Synthesizing answer...',
                step: 'analyze'
              })}\n\n`
            )
          );

          // Step 5: Generate conversational response
          const response = await openai.generateConversationalResponse(
            question,
            scrapedData.data?.markdown || '',
            {
              ...context,
              conversationHistory
            },
            bestSource.url
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'response',
                message: response,
                source: { url: bestSource.url, title: bestSource.title }
              })}\n\n`
            )
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'complete' })}\n\n`
            )
          );

        } catch (error) {
          console.error('[Chat API] Error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'An error occurred'
              })}\n\n`
            )
          );
        } finally {
          activeQueries.delete(queryId);
          controller.close();
        }
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
    console.error('[Chat API] Failed to process request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// Stop endpoint
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get('queryId');

  if (!queryId) {
    return NextResponse.json(
      { error: 'Query ID required' },
      { status: 400 }
    );
  }

  const controller = activeQueries.get(queryId);
  if (controller) {
    controller.abort();
    activeQueries.delete(queryId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: 'Query not found' },
    { status: 404 }
  );
}
