import FirecrawlApp from '@mendable/firecrawl-js';

export type ScrapeOptions = {
  formats?: ('markdown' | 'html' | 'text')[];
  timeout?: number;
  skipTlsVerification?: boolean;
  includeRawHtml?: boolean;
  includeImages?: boolean;
  includeLinks?: boolean;
  includeMetadata?: boolean;
  maxRetries?: number;
  retryDelay?: number;
};

export type ScrapeResult = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  html?: string;
  text?: string;
  links?: string[];
  images?: string[];
  metadata?: Record<string, any>;
  success: boolean;
  error?: string;
  scrapedAt: string;
};

export type SearchOptions = {
  limit?: number;
  scrapeContent?: boolean;
  location?: string;
  tbs?: string;
  formats?: ('markdown' | 'html' | 'text')[];
  timeout?: number;
};

export type SearchResult = {
  url: string;
  title: string;
  description: string;
  markdown?: string;
  html?: string;
  text?: string;
  links?: string[];
  images?: string[];
  metadata?: Record<string, any>;
  score?: number;
  publishedDate?: string;
};

export type FirecrawlScraperOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
};

export class FirecrawlScraper {
  private app: FirecrawlApp;
  private maxRetries: number;
  private retryDelay: number;

  constructor(options: FirecrawlScraperOptions = {}) {
    const apiKey = options.apiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Firecrawl API key. Set FIRECRAWL_API_KEY environment variable.');
    }
    
    this.app = new FirecrawlApp({ apiKey });
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  async scrapeUrl(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const {
      formats = ['markdown', 'html'],
      timeout = 60000,
      skipTlsVerification = false,
      includeRawHtml = false,
      includeImages = false,
      includeLinks = false,
      includeMetadata = false,
    } = options;

    const result: ScrapeResult = {
      url,
      success: false,
      scrapedAt: new Date().toISOString(),
    };

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const scrapeOptions: any = {
          formats,
          timeout,
        };

        if (skipTlsVerification) {
          scrapeOptions.skipTlsVerification = true;
        }

        const response = await this.app.scrapeUrl(url, scrapeOptions);

        if (response.data) {
          result.success = true;
          result.title = response.data.metadata?.title;
          result.description = response.data.metadata?.description;
          result.markdown = response.data.markdown;
          result.html = includeRawHtml ? response.data.html : undefined;
          result.text = response.data.text;
          
          if (includeLinks && response.data.links) {
            result.links = response.data.links;
          }
          
          if (includeImages && response.data.images) {
            result.images = response.data.images;
          }
          
          if (includeMetadata && response.data.metadata) {
            result.metadata = response.data.metadata;
          }
        } else {
          result.error = 'No data returned from Firecrawl';
        }

        break; // Success, exit retry loop
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt === this.maxRetries - 1) {
          result.error = `Failed after ${this.maxRetries} attempts: ${errorMessage}`;
        } else {
          console.warn(`Scrape attempt ${attempt + 1} failed for ${url}: ${errorMessage}`);
          await this.delay(this.retryDelay * (attempt + 1)); // Exponential backoff
        }
      }
    }

    return result;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      scrapeContent = true,
      location = '',
      tbs = '',
      formats = ['markdown'],
      timeout = 30000,
    } = options;

    try {
      const searchOptions: any = {
        limit,
        location,
        tbs,
      };

      if (scrapeContent) {
        searchOptions.scrapeOptions = {
          formats,
          timeout,
        };
      }

      const response = await this.app.search(query, searchOptions);

      return (response.data || []).map((item: any) => ({
        url: item.url || '',
        title: item.title || '',
        description: item.description || '',
        markdown: item.markdown,
        html: item.html,
        text: item.text,
        links: item.links,
        images: item.images,
        metadata: item.metadata,
        score: item.score,
        publishedDate: item.publishedDate,
      }));
    } catch (error) {
      console.error('Firecrawl search failed:', error);
      return [];
    }
  }

  async scrapeMultipleUrls(urls: string[], options: ScrapeOptions = {}): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    const concurrency = 3; // Limit concurrent requests

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      
      const batchPromises = batch.map(url => this.scrapeUrl(url, options));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Add delay between batches to be respectful
      if (i + concurrency < urls.length) {
        await this.delay(1000);
      }
    }

    return results;
  }

  async searchAndScrape(query: string, options: SearchOptions & ScrapeOptions = {}): Promise<ScrapeResult[]> {
    // First, search for URLs
    const searchResults = await this.search(query, options);
    
    // Then scrape the found URLs
    const urls = searchResults.map(result => result.url);
    const scrapeResults = await this.scrapeMultipleUrls(urls, options);
    
    // Merge search metadata with scrape results
    return scrapeResults.map(scrapeResult => {
      const searchResult = searchResults.find(sr => sr.url === scrapeResult.url);
      if (searchResult) {
        return {
          ...scrapeResult,
          title: scrapeResult.title || searchResult.title,
          description: scrapeResult.description || searchResult.description,
          score: searchResult.score,
          publishedDate: searchResult.publishedDate,
        };
      }
      return scrapeResult;
    });
  }

  async scrapeCompanyWebsite(companyName: string, website?: string, options: ScrapeOptions = {}): Promise<ScrapeResult[]> {
    const urls: string[] = [];
    
    if (website) {
      // Ensure URL has protocol
      const fullUrl = website.startsWith('http') ? website : `https://${website}`;
      urls.push(fullUrl);
      
      // Add common company pages
      const baseUrl = fullUrl.replace(/\/$/, '');
      urls.push(`${baseUrl}/about`);
      urls.push(`${baseUrl}/company`);
      urls.push(`${baseUrl}/investor-relations`);
      urls.push(`${baseUrl}/news`);
      urls.push(`${baseUrl}/press`);
      urls.push(`${baseUrl}/careers`);
      urls.push(`${baseUrl}/products`);
      urls.push(`${baseUrl}/services`);
    }

    // Search for company pages
    const searchQueries = [
      `"${companyName}" company website`,
      `"${companyName}" about us`,
      `"${companyName}" investor relations`,
      `"${companyName}" news press release`,
    ];

    for (const query of searchQueries) {
      try {
        const searchResults = await this.search(query, { limit: 3, scrapeContent: false });
        const newUrls = searchResults
          .map(result => result.url)
          .filter(url => !urls.includes(url));
        urls.push(...newUrls);
      } catch (error) {
        console.warn(`Search failed for query "${query}":`, error);
      }
    }

    // Scrape all found URLs
    return this.scrapeMultipleUrls(urls, options);
  }

  async extractCompanyInformation(companyName: string, website?: string): Promise<{
    basicInfo: Record<string, any>;
    financialInfo: Record<string, any>;
    technologyInfo: Record<string, any>;
    newsInfo: Record<string, any>;
  }> {
    const scrapedPages = await this.scrapeCompanyWebsite(companyName, website, {
      formats: ['markdown', 'text'],
      includeMetadata: true,
    });

    const basicInfo: Record<string, any> = {};
    const financialInfo: Record<string, any> = {};
    const technologyInfo: Record<string, any> = {};
    const newsInfo: Record<string, any> = {};

    for (const page of scrapedPages) {
      if (!page.success || !page.text) continue;

      const content = page.text.toLowerCase();
      const url = page.url.toLowerCase();

      // Extract basic company information
      if (url.includes('about') || url.includes('company')) {
        this.extractBasicInfo(content, basicInfo);
      }

      // Extract financial information
      if (url.includes('investor') || url.includes('financial')) {
        this.extractFinancialInfo(content, financialInfo);
      }

      // Extract technology information
      if (url.includes('product') || url.includes('service') || url.includes('technology')) {
        this.extractTechnologyInfo(content, technologyInfo);
      }

      // Extract news information
      if (url.includes('news') || url.includes('press') || url.includes('blog')) {
        this.extractNewsInfo(content, newsInfo);
      }
    }

    return {
      basicInfo,
      financialInfo,
      technologyInfo,
      newsInfo,
    };
  }

  private extractBasicInfo(content: string, info: Record<string, any>): void {
    // Extract employee count
    const employeeMatch = content.match(/(\d+(?:,\d+)*)\s*(?:employees?|staff|people)/i);
    if (employeeMatch) {
      info.employeeCount = parseInt(employeeMatch[1].replace(/,/g, ''));
    }

    // Extract founded year
    const foundedMatch = content.match(/founded[:\s]*(\d{4})/i);
    if (foundedMatch) {
      info.foundedYear = parseInt(foundedMatch[1]);
    }

    // Extract headquarters
    const hqMatch = content.match(/headquarters?[:\s]*([^.\n]+)/i);
    if (hqMatch) {
      info.headquarters = hqMatch[1].trim();
    }

    // Extract industry
    const industryMatch = content.match(/industry[:\s]*([^.\n]+)/i);
    if (industryMatch) {
      info.industry = industryMatch[1].trim();
    }
  }

  private extractFinancialInfo(content: string, info: Record<string, any>): void {
    // Extract revenue
    const revenueMatch = content.match(/revenue[:\s]*\$?(\d+(?:\.\d+)?)\s*(?:billion|million|b|m)/i);
    if (revenueMatch) {
      const value = parseFloat(revenueMatch[1]);
      const unit = content.match(/revenue[:\s]*\$?(\d+(?:\.\d+)?)\s*(billion|million|b|m)/i)?.[2];
      info.revenue = unit?.includes('billion') || unit === 'b' ? value * 1000000000 : value * 1000000;
    }

    // Extract market cap
    const marketCapMatch = content.match(/market\s*cap[:\s]*\$?(\d+(?:\.\d+)?)\s*(?:billion|million|b|m)/i);
    if (marketCapMatch) {
      const value = parseFloat(marketCapMatch[1]);
      const unit = content.match(/market\s*cap[:\s]*\$?(\d+(?:\.\d+)?)\s*(billion|million|b|m)/i)?.[2];
      info.marketCap = unit?.includes('billion') || unit === 'b' ? value * 1000000000 : value * 1000000;
    }
  }

  private extractTechnologyInfo(content: string, info: Record<string, any>): void {
    // Extract technology keywords
    const techKeywords = [
      'artificial intelligence', 'machine learning', 'ai', 'ml',
      'cloud computing', 'aws', 'azure', 'gcp',
      'blockchain', 'cryptocurrency', 'crypto',
      'iot', 'internet of things',
      'cybersecurity', 'security',
      'automation', 'robotics',
      'data analytics', 'big data',
      'mobile', 'web', 'software',
      'api', 'platform', 'saas'
    ];

    const foundTech: string[] = [];
    for (const keyword of techKeywords) {
      if (content.includes(keyword)) {
        foundTech.push(keyword);
      }
    }

    if (foundTech.length > 0) {
      info.technologies = foundTech;
    }
  }

  private extractNewsInfo(content: string, info: Record<string, any>): void {
    // Extract recent news mentions
    const newsMentions = content.match(/(\d{4}-\d{2}-\d{2})[^.]*\./g);
    if (newsMentions) {
      info.recentNews = newsMentions.slice(0, 5); // Last 5 news items
    }

    // Extract funding mentions
    const fundingMatch = content.match(/funding|investment|raised|venture|series\s+[a-z]/gi);
    if (fundingMatch) {
      info.hasFundingNews = true;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
