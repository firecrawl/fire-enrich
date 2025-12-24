import { ExaClient } from './exa-client';

export type TickerResult = {
  ticker: string;
  confidence: number;
  method: string;
  exchange?: string;
  companyName?: string;
  source?: string;
};

export type TickerDiscoveryOptions = {
  includeInternational?: boolean;
  maxRetries?: number;
  timeout?: number;
};

export class TickerDiscoveryService {
  private exaClient: ExaClient;

  constructor(exaApiKey?: string) {
    this.exaClient = new ExaClient({ apiKey: exaApiKey });
  }

  async discoverTicker(
    companyName: string, 
    website?: string, 
    options: TickerDiscoveryOptions = {}
  ): Promise<TickerResult | null> {
    const {
      includeInternational = true,
      maxRetries = 3,
      timeout = 30000
    } = options;

    const strategies = [
      // High confidence strategies first
      () => this.searchGoogleFinance(companyName),
      () => this.searchYahooFinance(companyName),
      () => this.searchAlphaVantage(companyName),
      () => this.searchFinancialModelingPrep(companyName),
      
      // Enhanced Exa search
      () => this.searchExaMultiQuery(companyName, website),
      
      // International exchanges if enabled
      ...(includeInternational ? [
        () => this.searchInternationalExchanges(companyName),
        () => this.searchEuropeanExchanges(companyName),
        () => this.searchAsianExchanges(companyName)
      ] : []),
      
      // Fallback strategies
      () => this.searchWebScraping(companyName, website),
      () => this.searchManualMappings(companyName)
    ];

    for (const strategy of strategies) {
      try {
        const result = await this.executeWithTimeout(strategy, timeout);
        if (result && result.confidence > 0.7) {
          return result;
        }
      } catch (error) {
        console.warn(`Ticker discovery strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    return null;
  }

  private async searchGoogleFinance(companyName: string): Promise<TickerResult | null> {
    try {
      const query = `site:google.com/finance/quote "${companyName}"`;
      const result = await this.exaClient.search(query, {
        type: 'keyword',
        numResults: 5,
        livecrawl: 'always',
      });

      for (const item of result.results) {
        const ticker = this.extractTickerFromGoogleFinanceUrl(item.url);
        if (ticker) {
          return {
            ticker,
            confidence: 0.95,
            method: 'google_finance',
            exchange: this.extractExchangeFromUrl(item.url),
            companyName,
            source: item.url,
          };
        }
      }
    } catch (error) {
      console.warn('Google Finance search failed:', error);
    }
    return null;
  }

  private async searchYahooFinance(companyName: string): Promise<TickerResult | null> {
    try {
      const query = `site:finance.yahoo.com/quote "${companyName}"`;
      const result = await this.exaClient.search(query, {
        type: 'keyword',
        numResults: 5,
        livecrawl: 'always',
      });

      for (const item of result.results) {
        const ticker = this.extractTickerFromYahooFinanceUrl(item.url);
        if (ticker) {
          return {
            ticker,
            confidence: 0.9,
            method: 'yahoo_finance',
            exchange: this.extractExchangeFromUrl(item.url),
            companyName,
            source: item.url,
          };
        }
      }
    } catch (error) {
      console.warn('Yahoo Finance search failed:', error);
    }
    return null;
  }

  private async searchAlphaVantage(companyName: string): Promise<TickerResult | null> {
    try {
      const query = `"${companyName}" ticker symbol stock market`;
      const result = await this.exaClient.search(query, {
        type: 'keyword',
        numResults: 3,
        livecrawl: 'fallback',
      });

      for (const item of result.results) {
        const ticker = this.extractTickerFromContent(item.text || '');
        if (ticker) {
          return {
            ticker,
            confidence: 0.8,
            method: 'alpha_vantage',
            companyName,
            source: item.url,
          };
        }
      }
    } catch (error) {
      console.warn('Alpha Vantage search failed:', error);
    }
    return null;
  }

  private async searchFinancialModelingPrep(companyName: string): Promise<TickerResult | null> {
    try {
      const query = `"${companyName}" financial modeling prep ticker`;
      const result = await this.exaClient.search(query, {
        type: 'keyword',
        numResults: 3,
        livecrawl: 'fallback',
      });

      for (const item of result.results) {
        const ticker = this.extractTickerFromContent(item.text || '');
        if (ticker) {
          return {
            ticker,
            confidence: 0.85,
            method: 'financial_modeling_prep',
            companyName,
            source: item.url,
          };
        }
      }
    } catch (error) {
      console.warn('Financial Modeling Prep search failed:', error);
    }
    return null;
  }

  private async searchExaMultiQuery(companyName: string, website?: string): Promise<TickerResult | null> {
    const queries = [
      `"${companyName}" ticker symbol stock exchange`,
      `"${companyName}" NYSE NASDAQ stock symbol`,
      `"${companyName}" investor relations ticker`,
      website ? `"${companyName}" site:${website} ticker symbol` : '',
      `"${companyName}" public company stock ticker`,
    ].filter(Boolean);

    for (const query of queries) {
      try {
        const result = await this.exaClient.search(query, {
          type: 'keyword',
          numResults: 3,
          livecrawl: 'fallback',
        });

        for (const item of result.results) {
          const ticker = this.extractTickerFromContent(item.text || '');
          if (ticker) {
            return {
              ticker,
              confidence: 0.75,
              method: 'exa_search',
              companyName,
              source: item.url,
            };
          }
        }
      } catch (error) {
        console.warn(`Exa search failed for query "${query}":`, error);
        continue;
      }
    }
    return null;
  }

  private async searchInternationalExchanges(companyName: string): Promise<TickerResult | null> {
    const exchanges = [
      'TSX', 'TSXV', 'LSE', 'ASX', 'TSE', 'HKEX', 'BSE', 'NSE'
    ];

    for (const exchange of exchanges) {
      try {
        const query = `"${companyName}" ${exchange} stock exchange ticker`;
        const result = await this.exaClient.search(query, {
          type: 'keyword',
          numResults: 2,
          livecrawl: 'fallback',
        });

        for (const item of result.results) {
          const ticker = this.extractTickerFromContent(item.text || '');
          if (ticker) {
            return {
              ticker,
              confidence: 0.7,
              method: 'international_exchange',
              exchange,
              companyName,
              source: item.url,
            };
          }
        }
      } catch (error) {
        console.warn(`International exchange search failed for ${exchange}:`, error);
        continue;
      }
    }
    return null;
  }

  private async searchEuropeanExchanges(companyName: string): Promise<TickerResult | null> {
    const exchanges = ['LSE', 'Euronext', 'XETRA', 'SIX', 'BME'];
    
    for (const exchange of exchanges) {
      try {
        const query = `"${companyName}" ${exchange} stock ticker symbol`;
        const result = await this.exaClient.search(query, {
          type: 'keyword',
          numResults: 2,
          livecrawl: 'fallback',
        });

        for (const item of result.results) {
          const ticker = this.extractTickerFromContent(item.text || '');
          if (ticker) {
            return {
              ticker,
              confidence: 0.7,
              method: 'european_exchange',
              exchange,
              companyName,
              source: item.url,
            };
          }
        }
      } catch (error) {
        console.warn(`European exchange search failed for ${exchange}:`, error);
        continue;
      }
    }
    return null;
  }

  private async searchAsianExchanges(companyName: string): Promise<TickerResult | null> {
    const exchanges = ['TSE', 'HKEX', 'BSE', 'NSE', 'KOSPI', 'SGX'];
    
    for (const exchange of exchanges) {
      try {
        const query = `"${companyName}" ${exchange} stock ticker symbol`;
        const result = await this.exaClient.search(query, {
          type: 'keyword',
          numResults: 2,
          livecrawl: 'fallback',
        });

        for (const item of result.results) {
          const ticker = this.extractTickerFromContent(item.text || '');
          if (ticker) {
            return {
              ticker,
              confidence: 0.7,
              method: 'asian_exchange',
              exchange,
              companyName,
              source: item.url,
            };
          }
        }
      } catch (error) {
        console.warn(`Asian exchange search failed for ${exchange}:`, error);
        continue;
      }
    }
    return null;
  }

  private async searchWebScraping(companyName: string, website?: string): Promise<TickerResult | null> {
    if (!website) return null;

    try {
      const query = `"${companyName}" investor relations ticker symbol site:${website}`;
      const result = await this.exaClient.search(query, {
        type: 'keyword',
        numResults: 3,
        livecrawl: 'always',
      });

      for (const item of result.results) {
        const ticker = this.extractTickerFromContent(item.text || '');
        if (ticker) {
          return {
            ticker,
            confidence: 0.8,
            method: 'web_scraping',
            companyName,
            source: item.url,
          };
        }
      }
    } catch (error) {
      console.warn('Web scraping search failed:', error);
    }
    return null;
  }

  private async searchManualMappings(companyName: string): Promise<TickerResult | null> {
    // Manual mappings for known companies
    const manualMappings: Record<string, { ticker: string; confidence: number; exchange?: string }> = {
      'Boeing': { ticker: 'BA', confidence: 0.99, exchange: 'NYSE' },
      'Lockheed Martin': { ticker: 'LMT', confidence: 0.99, exchange: 'NYSE' },
      'Northrop Grumman': { ticker: 'NOC', confidence: 0.99, exchange: 'NYSE' },
      'Raytheon': { ticker: 'RTX', confidence: 0.99, exchange: 'NYSE' },
      'General Dynamics': { ticker: 'GD', confidence: 0.99, exchange: 'NYSE' },
      'Textron': { ticker: 'TXT', confidence: 0.99, exchange: 'NYSE' },
      'Ametek': { ticker: 'AME', confidence: 0.99, exchange: 'NYSE' },
      'Barnes Group': { ticker: 'B', confidence: 0.99, exchange: 'NYSE' },
      'Parker Hannifin': { ticker: 'PH', confidence: 0.99, exchange: 'NYSE' },
      'General Electric': { ticker: 'GE', confidence: 0.99, exchange: 'NYSE' },
      'Honeywell': { ticker: 'HON', confidence: 0.99, exchange: 'NYSE' },
      'Moog': { ticker: 'MOG.A', confidence: 0.99, exchange: 'NYSE' },
      'Hexcel': { ticker: 'HXL', confidence: 0.99, exchange: 'NYSE' },
      'Triumph Group': { ticker: 'TGI', confidence: 0.99, exchange: 'NYSE' },
      'AeroVironment': { ticker: 'AVAV', confidence: 0.99, exchange: 'NASDAQ' },
      'Anduril Industries': { ticker: 'ANDU', confidence: 0.95, exchange: 'NYSE' },
      'Rolls Royce': { ticker: 'RR', confidence: 0.99, exchange: 'LSE' },
      'Leonardo DRS': { ticker: 'DRS', confidence: 0.99, exchange: 'NYSE' },
      'Rheinmetall': { ticker: 'RHM', confidence: 0.99, exchange: 'XETRA' },
      'Fincantieri': { ticker: 'FCT', confidence: 0.99, exchange: 'MIL' },
      'Siemens Energy': { ticker: 'ENR', confidence: 0.99, exchange: 'XETRA' },
      'Albany International': { ticker: 'AIN', confidence: 0.99, exchange: 'NYSE' },
    };

    const normalizedName = companyName.toLowerCase().trim();
    for (const [key, value] of Object.entries(manualMappings)) {
      if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
        return {
          ticker: value.ticker,
          confidence: value.confidence,
          method: 'manual_mapping',
          exchange: value.exchange,
          companyName,
        };
      }
    }

    return null;
  }

  private async executeWithTimeout<T>(
    strategy: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      strategy(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Strategy timeout')), timeout)
      )
    ]);
  }

  private extractTickerFromGoogleFinanceUrl(url: string): string | null {
    const match = url.match(/\/finance\/quote\/([A-Z0-9.\-]+):/i);
    return match ? match[1].toUpperCase() : null;
  }

  private extractTickerFromYahooFinanceUrl(url: string): string | null {
    const match = url.match(/\/quote\/([A-Z0-9.\-]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  private extractTickerFromContent(content: string): string | null {
    // Look for common ticker patterns
    const patterns = [
      /ticker[:\s]+([A-Z]{1,5})/i,
      /symbol[:\s]+([A-Z]{1,5})/i,
      /stock[:\s]+([A-Z]{1,5})/i,
      /NYSE[:\s]+([A-Z]{1,5})/i,
      /NASDAQ[:\s]+([A-Z]{1,5})/i,
      /\(([A-Z]{1,5})\)/g, // Parenthetical tickers like (AAPL)
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].length <= 5) {
        return match[1].toUpperCase();
      }
    }

    return null;
  }

  private extractExchangeFromUrl(url: string): string | undefined {
    if (url.includes('google.com/finance')) return 'Google Finance';
    if (url.includes('yahoo.com/finance')) return 'Yahoo Finance';
    if (url.includes('nyse.com')) return 'NYSE';
    if (url.includes('nasdaq.com')) return 'NASDAQ';
    if (url.includes('londonstockexchange.com')) return 'LSE';
    if (url.includes('xetra.com')) return 'XETRA';
    return undefined;
  }
}
