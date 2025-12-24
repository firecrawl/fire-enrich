import { CrustDataEnrichmentService, CrustDataEnrichmentResult } from './enrichment-service';
import { ExaClient, ExaSearchResult } from './exa-client';
import { SECEdgarClient, PublicCompanyMatch, EdgarFiling } from './sec-edgar-client';
import { TickerDiscoveryService, TickerResult } from './ticker-discovery-service';
import { SECSignalsExtractor, SECSignals } from './sec-signals-extractor';
import { FirecrawlScraper, ScrapeResult } from './firecrawl-scraper';

export type EnhancedEnrichmentResult = {
  company: any; // CrustData company data
  ticker?: string;
  tickerConfidence?: number;
  tickerMethod?: string;
  isPublic?: boolean;
  secData?: {
    isPublic: boolean;
    confidence: number;
    ticker?: string;
    cik?: string;
    filings?: Array<{
      form: string;
      accessionNumber: string;
      reportDate?: string;
      filingDate?: string;
      content?: string;
    }>;
  };
  secSignals?: SECSignals;
  exaData?: {
    financialDocuments: ExaSearchResult[];
    news: ExaSearchResult[];
    technologyStack: ExaSearchResult[];
  };
  firecrawlData?: {
    basicInfo: Record<string, any>;
    financialInfo: Record<string, any>;
    technologyInfo: Record<string, any>;
    newsInfo: Record<string, any>;
    scrapedPages: ScrapeResult[];
  };
  enrichmentFields: Record<string, any>;
  success: boolean;
  error?: string;
  source: 'enhanced';
  timestamp: string;
  processingTime: number;
};

export type EnrichmentOptions = {
  includeCrustData?: boolean;
  includeExa?: boolean;
  includeSEC?: boolean;
  includeTickerDiscovery?: boolean;
  includeSECSignals?: boolean;
  includeFirecrawl?: boolean;
  includeFinancialDocs?: boolean;
  includeNews?: boolean;
  includeTechStack?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  signalExtractionOptions?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
};

export class EnhancedEnrichmentService {
  private crustDataService: CrustDataEnrichmentService;
  private exaClient: ExaClient;
  private secClient: SECEdgarClient;
  private tickerDiscovery: TickerDiscoveryService;
  private secSignalsExtractor: SECSignalsExtractor;
  private firecrawlScraper: FirecrawlScraper;

  constructor(options: {
    crustDataApiKey?: string;
    exaApiKey?: string;
    secUserAgent?: string;
    openaiApiKey?: string;
    firecrawlApiKey?: string;
  } = {}) {
    this.crustDataService = new CrustDataEnrichmentService(options.crustDataApiKey);
    this.exaClient = new ExaClient({ apiKey: options.exaApiKey });
    this.secClient = new SECEdgarClient({ 
      userAgent: options.secUserAgent,
      exaApiKey: options.exaApiKey 
    });
    this.tickerDiscovery = new TickerDiscoveryService(options.exaApiKey);
    this.secSignalsExtractor = new SECSignalsExtractor(options.openaiApiKey || '');
    this.firecrawlScraper = new FirecrawlScraper({ apiKey: options.firecrawlApiKey });
  }

  /**
   * Enhanced company enrichment combining all data sources
   */
  async enrichCompany(
    identifier: string,
    isDomain: boolean = true,
    options: EnrichmentOptions = {}
  ): Promise<EnhancedEnrichmentResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    const {
      includeCrustData = true,
      includeExa = true,
      includeSEC = true,
      includeTickerDiscovery = true,
      includeSECSignals = true,
      includeFirecrawl = true,
      includeFinancialDocs = true,
      includeNews = true,
      includeTechStack = true,
      maxConcurrency = 3,
      timeout = 30000,
    } = options;

    const result: EnhancedEnrichmentResult = {
      company: null,
      enrichmentFields: {},
      success: false,
      source: 'enhanced',
      timestamp,
      processingTime: 0,
    };

    const tasks: Array<() => Promise<void>> = [];

    // Step 1: Get basic company data from CrustData
    if (includeCrustData) {
      tasks.push(async () => {
        try {
          const crustDataResult = await this.crustDataService.enrichCompany(identifier, isDomain);
          if (crustDataResult.success && crustDataResult.company) {
            result.company = crustDataResult.company;
            result.enrichmentFields = this.crustDataService.extractEnrichmentFields(crustDataResult.company);
          } else {
            result.error = crustDataResult.error || 'Failed to get company data from CrustData';
          }
        } catch (error) {
          result.error = `CrustData: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      });
    }

    // Step 2: Ticker Discovery
    if (includeTickerDiscovery && result.company) {
      tasks.push(async () => {
        try {
          const tickerResult = await this.tickerDiscovery.discoverTicker(
            result.company.name,
            result.company.domain
          );
          if (tickerResult) {
            result.ticker = tickerResult.ticker;
            result.tickerConfidence = tickerResult.confidence;
            result.tickerMethod = tickerResult.method;
            result.isPublic = true;
          }
        } catch (error) {
          console.warn('Ticker discovery failed:', error);
        }
      });
    }

    // Step 3: SEC data (only if we have a ticker or company name)
    if (includeSEC && (result.ticker || result.company?.name)) {
      tasks.push(async () => {
        try {
          const secMatch = await this.secClient.identifyPublicCompany(
            result.company?.name || identifier,
            result.company?.domain
          );
          
          if (secMatch.isPublic && secMatch.cik) {
            const filings = await this.secClient.listAllFilings(secMatch.cik, 10);
            result.secData = {
              isPublic: true,
              confidence: secMatch.confidence,
              ticker: secMatch.ticker,
              cik: secMatch.cik,
              filings: filings.map(f => ({
                form: f.form,
                accessionNumber: f.accessionNumber,
                reportDate: f.reportDate,
                filingDate: f.filingDate,
                content: f.content,
              })),
            };
          } else {
            result.secData = {
              isPublic: false,
              confidence: secMatch.confidence,
            };
          }
        } catch (error) {
          console.warn('SEC data retrieval failed:', error);
          result.secData = {
            isPublic: false,
            confidence: 0,
          };
        }
      });
    }

    // Step 4: SEC Signals extraction (only if we have SEC filings)
    if (includeSECSignals && result.secData?.filings && result.ticker) {
      tasks.push(async () => {
        try {
          const documents = result.secData.filings
            .filter(f => f.content)
            .map(f => ({
              content: f.content || '',
              metadata: {
                url: `https://www.sec.gov/Archives/edgar/data/${result.secData?.cik}/${f.accessionNumber.replace(/-/g, '')}/${f.accessionNumber}.txt`,
                title: `${f.form} - ${f.reportDate || f.filingDate}`,
                date: f.reportDate || f.filingDate,
              },
            }));

          if (documents.length > 0) {
            const signals = await this.secSignalsExtractor.extractSignals(
              result.company?.name || identifier,
              result.ticker,
              documents,
              options.signalExtractionOptions
            );
            result.secSignals = signals;
          }
        } catch (error) {
          console.warn('SEC signals extraction failed:', error);
        }
      });
    }

    // Step 5: Exa data
    if (includeExa && result.company) {
      tasks.push(async () => {
        try {
          const exaPromises: Promise<any>[] = [];

          // Financial documents
          if (includeFinancialDocs && result.ticker) {
            exaPromises.push(
              this.exaClient.searchFinancialDocuments(result.company.name, result.ticker)
                .then(result => ({ financialDocuments: result.results }))
                .catch(() => ({ financialDocuments: [] }))
            );
          } else {
            exaPromises.push(Promise.resolve({ financialDocuments: [] }));
          }

          // News
          if (includeNews) {
            exaPromises.push(
              this.exaClient.searchCompanyNews(result.company.name)
                .then(result => ({ news: result.results }))
                .catch(() => ({ news: [] }))
            );
          } else {
            exaPromises.push(Promise.resolve({ news: [] }));
          }

          // Technology stack
          if (includeTechStack) {
            exaPromises.push(
              this.exaClient.searchTechnologyStack(result.company.name)
                .then(result => ({ technologyStack: result.results }))
                .catch(() => ({ technologyStack: [] }))
            );
          } else {
            exaPromises.push(Promise.resolve({ technologyStack: [] }));
          }

          const exaResults = await Promise.all(exaPromises);
          result.exaData = {
            financialDocuments: exaResults[0].financialDocuments || [],
            news: exaResults[1].news || [],
            technologyStack: exaResults[2].technologyStack || [],
          };
        } catch (error) {
          console.warn('Exa data retrieval failed:', error);
          result.exaData = {
            financialDocuments: [],
            news: [],
            technologyStack: [],
          };
        }
      });
    }

    // Step 6: Firecrawl scraping
    if (includeFirecrawl && result.company) {
      tasks.push(async () => {
        try {
          const firecrawlData = await this.firecrawlScraper.extractCompanyInformation(
            result.company.name,
            result.company.domain
          );
          result.firecrawlData = firecrawlData;
        } catch (error) {
          console.warn('Firecrawl scraping failed:', error);
        }
      });
    }

    // Execute tasks with concurrency control
    const semaphore = new Semaphore(maxConcurrency);
    await Promise.all(tasks.map(task => semaphore.acquire().then(async (release) => {
      try {
        await Promise.race([
          task(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), timeout))
        ]);
      } finally {
        release();
      }
    })));

    // Enhance enrichment fields with additional data
    if (result.secData?.isPublic) {
      result.enrichmentFields.is_public_company = true;
      result.enrichmentFields.ticker_symbol = result.secData.ticker;
      result.enrichmentFields.cik = result.secData.cik;
      result.enrichmentFields.sec_confidence = result.secData.confidence;
      if (result.secData.filings) {
        result.enrichmentFields.recent_filings = result.secData.filings.length;
        result.enrichmentFields.latest_filing_date = result.secData.filings[0]?.reportDate || result.secData.filings[0]?.filingDate;
      }
    } else {
      result.enrichmentFields.is_public_company = false;
    }

    if (result.ticker) {
      result.enrichmentFields.ticker_symbol = result.ticker;
      result.enrichmentFields.ticker_confidence = result.tickerConfidence;
      result.enrichmentFields.ticker_method = result.tickerMethod;
    }

    if (result.secSignals) {
      result.enrichmentFields.sec_signals_extracted = true;
      result.enrichmentFields.total_signals = result.secSignals.summary.totalSignals;
      result.enrichmentFields.financial_health_score = result.secSignals.summary.financialHealthScore;
      result.enrichmentFields.technology_readiness_score = result.secSignals.summary.technologyReadinessScore;
      result.enrichmentFields.urgency_score = result.secSignals.summary.urgencyScore;
      result.enrichmentFields.opportunity_score = result.secSignals.summary.opportunityScore;
    }

    if (result.exaData) {
      if (result.exaData.financialDocuments.length > 0) {
        result.enrichmentFields.financial_documents_found = result.exaData.financialDocuments.length;
      }
      if (result.exaData.news.length > 0) {
        result.enrichmentFields.recent_news_found = result.exaData.news.length;
      }
      if (result.exaData.technologyStack.length > 0) {
        result.enrichmentFields.tech_stack_sources = result.exaData.technologyStack.length;
      }
    }

    if (result.firecrawlData) {
      if (result.firecrawlData.basicInfo.employeeCount) {
        result.enrichmentFields.employee_count = result.firecrawlData.basicInfo.employeeCount;
      }
      if (result.firecrawlData.basicInfo.foundedYear) {
        result.enrichmentFields.founded_year = result.firecrawlData.basicInfo.foundedYear;
      }
      if (result.firecrawlData.basicInfo.headquarters) {
        result.enrichmentFields.headquarters = result.firecrawlData.basicInfo.headquarters;
      }
      if (result.firecrawlData.basicInfo.industry) {
        result.enrichmentFields.industry = result.firecrawlData.basicInfo.industry;
      }
      if (result.firecrawlData.financialInfo.revenue) {
        result.enrichmentFields.revenue = result.firecrawlData.financialInfo.revenue;
      }
      if (result.firecrawlData.financialInfo.marketCap) {
        result.enrichmentFields.market_cap = result.firecrawlData.financialInfo.marketCap;
      }
      if (result.firecrawlData.technologyInfo.technologies) {
        result.enrichmentFields.technologies = result.firecrawlData.technologyInfo.technologies;
      }
    }

    result.enrichmentFields.enhanced_enrichment = true;
    result.enrichmentFields.data_sources = [];
    if (includeCrustData) result.enrichmentFields.data_sources.push('crustdata');
    if (result.secData) result.enrichmentFields.data_sources.push('sec');
    if (result.exaData) result.enrichmentFields.data_sources.push('exa');
    if (result.firecrawlData) result.enrichmentFields.data_sources.push('firecrawl');
    if (result.secSignals) result.enrichmentFields.data_sources.push('sec_signals');

    result.success = !result.error;
    result.processingTime = Date.now() - startTime;

    return result;
  }

  /**
   * Bulk enrichment for multiple companies
   */
  async enrichCompanies(
    identifiers: string[],
    isDomain: boolean = true,
    options: EnrichmentOptions = {}
  ): Promise<EnhancedEnrichmentResult[]> {
    const concurrency = options.maxConcurrency || 3;
    const results: EnhancedEnrichmentResult[] = [];

    for (let i = 0; i < identifiers.length; i += concurrency) {
      const batch = identifiers.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (identifier) => {
        return this.enrichCompany(identifier, isDomain, options);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to be respectful
      if (i + concurrency < identifiers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Discover tickers for multiple companies
   */
  async discoverTickers(
    companies: Array<{ name: string; website?: string }>,
    options: { includeInternational?: boolean; maxConcurrency?: number } = {}
  ): Promise<Array<{ companyName: string; ticker?: string; confidence?: number; method?: string }>> {
    const { includeInternational = true, maxConcurrency = 3 } = options;
    const results: Array<{ companyName: string; ticker?: string; confidence?: number; method?: string }> = [];

    const semaphore = new Semaphore(maxConcurrency);
    
    await Promise.all(companies.map(company => 
      semaphore.acquire().then(async (release) => {
        try {
          const tickerResult = await this.tickerDiscovery.discoverTicker(
            company.name, 
            company.website, 
            { includeInternational }
          );
          
          results.push({
            companyName: company.name,
            ticker: tickerResult?.ticker,
            confidence: tickerResult?.confidence,
            method: tickerResult?.method,
          });
        } catch (error) {
          console.error(`Ticker discovery failed for ${company.name}:`, error);
          results.push({ companyName: company.name });
        } finally {
          release();
        }
      })
    ));

    return results;
  }

  /**
   * Extract SEC signals for a company
   */
  async extractSECSignals(
    companyName: string,
    ticker: string,
    documents: Array<{ content: string; metadata: { url: string; title: string; date?: string } }>,
    options?: any
  ): Promise<SECSignals> {
    return this.secSignalsExtractor.extractSignals(companyName, ticker, documents, options);
  }

  /**
   * Scrape company website
   */
  async scrapeCompanyWebsite(
    companyName: string,
    website?: string,
    options?: any
  ): Promise<ScrapeResult[]> {
    return this.firecrawlScraper.scrapeCompanyWebsite(companyName, website, options);
  }

  /**
   * Get companies by industry with enhanced data
   */
  async getCompaniesByIndustry(
    industry: string,
    limit: number = 50,
    options: EnrichmentOptions = {}
  ): Promise<EnhancedEnrichmentResult[]> {
    const crustDataResults = await this.crustDataService.getCompaniesByIndustry(industry, limit);
    
    const enhancedResults: EnhancedEnrichmentResult[] = [];
    
    for (const result of crustDataResults) {
      if (result.success && result.company) {
        const enhanced = await this.enrichCompany(
          result.company.domain || result.company.name,
          !!result.company.domain,
          options
        );
        enhancedResults.push(enhanced);
      }
    }

    return enhancedResults;
  }

  /**
   * Get companies by technology with enhanced data
   */
  async getCompaniesByTechnology(
    technologies: string[],
    limit: number = 50,
    options: EnrichmentOptions = {}
  ): Promise<EnhancedEnrichmentResult[]> {
    const crustDataResults = await this.crustDataService.getCompaniesByTechnology(technologies, limit);
    
    const enhancedResults: EnhancedEnrichmentResult[] = [];
    
    for (const result of crustDataResults) {
      if (result.success && result.company) {
        const enhanced = await this.enrichCompany(
          result.company.domain || result.company.name,
          !!result.company.domain,
          options
        );
        enhancedResults.push(enhanced);
      }
    }

    return enhancedResults;
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    const next = this.waiting.shift();
    if (next) {
      next();
    }
  }
}