import FirecrawlApp from '@mendable/firecrawl-js';
import type { FirecrawlClientConfig } from '../config/firecrawl';
import type { SearchResult } from '../types';

export class FirecrawlService {
  private app: FirecrawlApp;

  constructor(config: FirecrawlClientConfig) {
    this.app = new FirecrawlApp({
      apiKey: config.apiKey ?? undefined,
      apiUrl: config.apiUrl,
    });
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

        const searchOptions: Record<string, unknown> = { limit };
        
        if (scrapeContent) {
          searchOptions.scrapeOptions = {
            formats: ['markdown', 'links', 'html'],
          };
        }

        const result = await this.app.search(query, searchOptions);

        return result.data.map((item) => ({
          url: item.url || '',
          title: item.title || '',
          description: item.description || '',
          markdown: item.markdown,
          html: item.html,
          links: item.links,
          metadata: item.metadata,
        }));
      } catch (error) {
        const errorWithStatus = error as { statusCode?: number; message?: string };
        const isRetryableError = 
          errorWithStatus?.statusCode === 502 || 
          errorWithStatus?.statusCode === 503 || 
          errorWithStatus?.statusCode === 504 ||
          errorWithStatus?.statusCode === 429;
        
        if (isRetryableError && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Firecrawl search failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          console.warn('Error:', errorWithStatus?.statusCode || errorWithStatus?.message);
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

  async scrapeUrl(url: string): Promise<{ data?: { markdown?: string; html?: string }; error?: string }> {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // First try with normal TLS verification
        const result = await this.app.scrapeUrl(fullUrl, {
          formats: ['markdown', 'html'],
          timeout: 30000, // 30 second timeout
        });
        
        return result;
      } catch (error) {
        // Check if it's an SSL error
        const errorWithMessage = error as { message?: string; statusCode?: number };
        const isSSLError = errorWithMessage?.message?.includes('SSL error') || 
                          errorWithMessage?.message?.includes('certificate') ||
                          errorWithMessage?.statusCode === 500 && errorWithMessage?.message?.includes('SSL');
        
        // If SSL error, retry with skipTlsVerification
        if (isSSLError && attempt === 0) {
          try {
            console.warn(`SSL error for ${fullUrl}, retrying with skipTlsVerification...`);
            const result = await this.app.scrapeUrl(fullUrl, {
              formats: ['markdown', 'html'],
              skipTlsVerification: true,
              timeout: 30000,
            });
            return result;
          } catch (retryError) {
            // Continue to normal retry logic
            error = retryError;
          }
        }
        
        const isRetryableError = 
          errorWithMessage?.statusCode === 502 || 
          errorWithMessage?.statusCode === 503 || 
          errorWithMessage?.statusCode === 504 ||
          errorWithMessage?.statusCode === 429 ||
          errorWithMessage?.message?.includes('network error') ||
          errorWithMessage?.message?.includes('server is unreachable');
        
        if (isRetryableError && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Firecrawl scrape failed for ${fullUrl} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          console.warn('Error:', errorWithMessage?.statusCode || errorWithMessage?.message);
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
