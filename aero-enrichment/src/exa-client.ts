import Exa from 'exa-js';

export type ExaSearchOptions = {
  type?: 'keyword' | 'neural' | 'auto';
  numResults?: number;
  livecrawl?: 'always' | 'fallback' | 'never';
  text?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  excludeSourceType?: string[];
  category?: string;
  subpages?: number;
  subpageTarget?: string[];
  summary?: {
    query: string;
  };
};

export type ExaSearchResult = {
  url: string;
  title: string;
  text?: string;
  publishedDate?: string;
  score?: number;
};

export type ExaSearchResponse = {
  results: ExaSearchResult[];
  autopromptString?: string;
};

export type ExaClientOptions = {
  apiKey?: string;
};

export class ExaClient {
  private client: Exa;

  constructor(options: ExaClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Exa API key. Set EXA_API_KEY environment variable.');
    }
    this.client = new Exa(apiKey);
  }

  /**
   * Search for content using Exa
   */
  async search(
    query: string,
    options: ExaSearchOptions = {}
  ): Promise<ExaSearchResponse> {
    try {
      const result = await this.client.search(query, {
        type: options.type || 'keyword',
        numResults: options.numResults || 10,
        livecrawl: options.livecrawl || 'fallback',
        text: options.text || true,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        startPublishedDate: options.startPublishedDate,
        endPublishedDate: options.endPublishedDate,
        excludeSourceType: options.excludeSourceType,
      });

      return {
        results: result.results || [],
        autopromptString: result.autopromptString,
      };
    } catch (error) {
      throw new Error(`Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search and get content in one call
   */
  async searchAndContents(
    query: string,
    options: ExaSearchOptions = {}
  ): Promise<ExaSearchResponse> {
    try {
      const result = await this.client.searchAndContents(query, {
        type: options.type || 'keyword',
        numResults: options.numResults || 10,
        livecrawl: options.livecrawl || 'fallback',
        text: options.text || true,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        startPublishedDate: options.startPublishedDate,
        endPublishedDate: options.endPublishedDate,
        excludeSourceType: options.excludeSourceType,
        category: options.category,
        subpages: options.subpages,
        subpageTarget: options.subpageTarget,
        summary: options.summary,
      });

      return {
        results: result.results || [],
        autopromptString: result.autopromptString,
      };
    } catch (error) {
      throw new Error(`Exa searchAndContents failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get contents directly from URLs (websites API)
   * Use this for structured extractions when you have specific URLs
   */
  async getContents(
    urls: string[],
    options: {
      text?: boolean;
      summary?: {
        query: string;
      };
      subpages?: number;
      subpageTarget?: string[];
    } = {}
  ): Promise<ExaSearchResponse> {
    try {
      const result = await this.client.getContents(urls, {
        text: options.text !== false,
        summary: options.summary,
        subpages: options.subpages,
        subpageTarget: options.subpageTarget,
      });

      return {
        results: result.results || [],
      };
    } catch (error) {
      throw new Error(`Exa getContents failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a Webset for structured extraction
   * Use this for structured outputs from queries
   */
  async createWebset(config: {
    query: string;
    count?: number;
    entityType?: 'company' | 'person' | 'research_paper' | 'other';
    criteria?: string | Array<{ description: string }>;
    enrichments?: Array<{ query: string }>;
    metadata?: Record<string, any>;
  }): Promise<{ websetId: string; status: string }> {
    try {
      // @ts-ignore - Websets API may not be in type definitions yet
      const result = await this.client.websets.create({
        search: {
          query: config.query,
          count: config.count || 10,
          entity: {
            type: config.entityType || 'company',
          },
          criteria: typeof config.criteria === 'string' 
            ? [{ description: config.criteria }]
            : config.criteria || [],
        },
        metadata: config.metadata,
      });

      return {
        websetId: result.id,
        status: result.status,
      };
    } catch (error) {
      throw new Error(`Exa createWebset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get Webset items (poll for results)
   */
  async getWebsetItems(websetId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    items: Array<{
      id: string;
      url: string;
      title: string;
      text?: string;
      properties: Record<string, any>;
      verified: boolean;
      reasoning?: string;
    }>;
    hasMore: boolean;
  }> {
    try {
      // @ts-ignore - Websets API may not be in type definitions yet
      const result = await this.client.websets.items.list({
        websetId,
        limit: options.limit || 100,
        offset: options.offset || 0,
      });

      return {
        items: (result.data || result.items || []).map((item: any) => ({
          id: item.id,
          url: item.url,
          title: item.title,
          text: item.text,
          properties: item.properties || {},
          verified: item.verified || false,
          reasoning: item.reasoning,
        })),
        hasMore: result.has_more || (result.data?.length === (options.limit || 100)),
      };
    } catch (error) {
      throw new Error(`Exa getWebsetItems failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get Webset status
   */
  async getWebsetStatus(websetId: string): Promise<{
    status: 'running' | 'completed' | 'idle' | 'failed';
    searchStatus?: string;
  }> {
    try {
      // @ts-ignore - Websets API may not be in type definitions yet
      const result = await this.client.websets.get(websetId);

      return {
        status: result.status,
        searchStatus: result.search?.status,
      };
    } catch (error) {
      throw new Error(`Exa getWebsetStatus failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for Webset to complete and return items
   */
  async waitForWebset(
    websetId: string,
    options: {
      maxWaitSeconds?: number;
      pollIntervalSeconds?: number;
    } = {}
  ): Promise<Array<{
    id: string;
    url: string;
    title: string;
    text?: string;
    properties: Record<string, any>;
    verified: boolean;
    reasoning?: string;
  }>> {
    const maxWait = options.maxWaitSeconds || 300; // 5 minutes default
    const pollInterval = options.pollIntervalSeconds || 5;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait * 1000) {
      const status = await this.getWebsetStatus(websetId);
      
      if (status.status === 'completed' || status.status === 'idle') {
        // Fetch all items
        const allItems: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const result = await this.getWebsetItems(websetId, { limit: 100, offset });
          allItems.push(...result.items);
          hasMore = result.hasMore;
          offset += 100;
        }

        return allItems;
      }

      if (status.status === 'failed') {
        throw new Error('Webset search failed');
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    }

    throw new Error(`Webset did not complete within ${maxWait} seconds`);
  }

  /**
   * Search for financial documents (10-K, 10-Q, etc.)
   */
  async searchFinancialDocuments(
    companyName: string,
    ticker: string,
    options: {
      numResults?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<ExaSearchResponse> {
    const queries = [
      `"${companyName}" 10-K filetype:htm site:sec.gov/Archives/edgar`,
      `"${ticker}" form 10-K filetype:htm site:sec.gov/Archives/edgar`,
      `"${companyName}" annual report 10-K filing site:sec.gov/Archives/edgar`,
      `"${ticker}" 10-K management discussion analysis site:sec.gov/Archives/edgar`,
      `"${companyName}" business description 10-K site:sec.gov/Archives/edgar`
    ];

    const allResults: ExaSearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const result = await this.searchAndContents(query, {
          type: 'keyword',
          livecrawl: 'always',
          text: true,
          numResults: options.numResults || 8,
          includeDomains: ['sec.gov'],
          startPublishedDate: options.startDate || '2023-01-01T00:00:00.000Z',
          endPublishedDate: options.endDate || new Date().toISOString(),
          excludeSourceType: ['application/xbrl+xml'],
        });

        // Filter and deduplicate results
        for (const searchResult of result.results) {
          if (!seenUrls.has(searchResult.url)) {
            // Validate that results are for the correct company
            const content = (searchResult.text || '').toLowerCase();
            const title = (searchResult.title || '').toLowerCase();
            const companyLower = companyName.toLowerCase();
            const tickerLower = ticker.toLowerCase();
            
            if (content.includes(companyLower) || 
                content.includes(tickerLower) || 
                title.includes(companyLower) ||
                title.includes(tickerLower)) {
              allResults.push(searchResult);
              seenUrls.add(searchResult.url);
            }
          }
        }

        // Add delay between queries to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(`Query failed: ${query} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    return {
      results: allResults,
    };
  }

  /**
   * Search for company news and recent information
   */
  async searchCompanyNews(
    companyName: string,
    options: {
      numResults?: number;
      daysBack?: number;
    } = {}
  ): Promise<ExaSearchResponse> {
    const daysBack = options.daysBack || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return this.searchAndContents(`${companyName} news`, {
      type: 'keyword',
      livecrawl: 'always',
      text: true,
      numResults: options.numResults || 10,
      startPublishedDate: startDate.toISOString(),
      endPublishedDate: new Date().toISOString(),
      excludeDomains: ['sec.gov'], // Exclude SEC filings for news search
    });
  }

  /**
   * Search for company technology stack information
   */
  async searchTechnologyStack(
    companyName: string,
    options: {
      numResults?: number;
    } = {}
  ): Promise<ExaSearchResponse> {
    const queries = [
      `${companyName} technology stack`,
      `${companyName} software tools`,
      `${companyName} tech stack`,
      `${companyName} programming languages`,
      `${companyName} development tools`,
    ];

    const allResults: ExaSearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const result = await this.searchAndContents(query, {
          type: 'keyword',
          livecrawl: 'fallback',
          text: true,
          numResults: options.numResults || 5,
        });

        for (const searchResult of result.results) {
          if (!seenUrls.has(searchResult.url)) {
            allResults.push(searchResult);
            seenUrls.add(searchResult.url);
          }
        }

        // Add delay between queries
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`Technology search failed: ${query} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    return {
      results: allResults,
    };
  }
}
