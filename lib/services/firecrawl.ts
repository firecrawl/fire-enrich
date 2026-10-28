import Firecrawl, { type Document, type DocumentMetadata } from '@mendable/firecrawl-js';
import type { SearchResult } from '../types';

export class FirecrawlService {
  private app: Firecrawl;

  constructor(apiKey: string) {
    this.app = new Firecrawl({ apiKey, origin: 'fire-enrich' });
  }

  async search(
    query: string,
    options: {
      limit?: number;
      scrapeContent?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { limit = 5, scrapeContent = true } = options;

        const searchOptions: Record<string, unknown> = { limit, highlights: false };
        
        if (scrapeContent) {
          searchOptions.scrapeOptions = {
            formats: ['markdown', 'links', 'html'],
          };
        }

        const result = await this.app.search(query, searchOptions);

        return (result.web || []).map((item: Document & { url?: string; title?: string; description?: string }) => ({
          url: item.url || item.metadata?.url || item.metadata?.sourceURL || '',
          title: item.title || item.metadata?.title || '',
          description: item.description || item.metadata?.description || '',
          markdown: item.markdown,
          html: item.html,
          links: item.links,
          metadata: item.metadata as SearchResult['metadata'],
        }));
      } catch (error) {
        const errorWithStatus = error as { status?: number; message?: string };
        const isRetryableError = 
          errorWithStatus?.status === 502 || 
          errorWithStatus?.status === 503 || 
          errorWithStatus?.status === 504 ||
          errorWithStatus?.status === 429;
        
        if (isRetryableError && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Firecrawl search failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          console.warn('Error:', errorWithStatus?.status || errorWithStatus?.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error('Firecrawl search error:', error);
        console.error('Query:', query);
        
        // Return empty results instead of throwing
        // This allows enrichment to continue with other data sources
        return [];
      }
    }
    
    return [];
  }

  async searchWithMultipleQueries(
    queries: string[],
    options: {
      limit?: number;
      scrapeContent?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const results = await this.search(query, options);
        
        for (const result of results) {
          if (!seen.has(result.url)) {
            seen.add(result.url);
            allResults.push(result);
          }
        }
      } catch (error) {
        // Log but continue with other queries
        console.error(`Failed to search for query "${query}":`, error);
      }
    }

    return allResults;
  }

  async scrapeUrl(url: string): Promise<{ data?: DocumentMetadata & { markdown?: string; html?: string }; error?: string }> {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    let skipTlsVerification = false;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use the selected TLS mode; the first request verifies normally.
        const result = await this.app.scrape(fullUrl, {
          formats: ['markdown', 'html'],
          ...(skipTlsVerification ? { skipTlsVerification: true } : {}),
          timeout: 30000, // 30 second timeout
        });
        
        return { data: { ...result.metadata, markdown: result.markdown, html: result.html } };
      } catch (error) {
        // Check if it's an SSL error
        let errorWithMessage = error as { message?: string; status?: number };
        const isSSLError = errorWithMessage?.message?.includes('SSL error') || 
                          errorWithMessage?.message?.includes('certificate') ||
                          errorWithMessage?.status === 500 && errorWithMessage?.message?.includes('SSL');
        
        // If SSL error, retry with skipTlsVerification
        if (isSSLError && attempt === 0) {
          // Keep the selected fallback for retries within this scrape only.
          skipTlsVerification = true;
          try {
            console.warn(`SSL error for ${fullUrl}, retrying with skipTlsVerification...`);
            const result = await this.app.scrape(fullUrl, {
              formats: ['markdown', 'html'],
              skipTlsVerification: true,
              timeout: 30000,
            });
            return { data: { ...result.metadata, markdown: result.markdown, html: result.html } };
          } catch (retryError) {
            // Continue to normal retry logic
            error = retryError;
            errorWithMessage = retryError as { message?: string; status?: number };
          }
        }
        
        const isRetryableError = 
          errorWithMessage?.status === 502 || 
          errorWithMessage?.status === 503 || 
          errorWithMessage?.status === 504 ||
          errorWithMessage?.status === 429 ||
          errorWithMessage?.message?.includes('network error') ||
          errorWithMessage?.message?.includes('server is unreachable');
        
        if (isRetryableError && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Firecrawl scrape failed for ${fullUrl} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          console.warn('Error:', errorWithMessage?.status || errorWithMessage?.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Re-throw the error to be caught by the calling code
        throw error;
      }
    }
    
    throw new Error(`Failed to scrape ${fullUrl} after ${maxRetries} attempts`);
  }
}