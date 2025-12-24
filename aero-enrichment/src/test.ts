#!/usr/bin/env tsx

import { CrustDataClient } from './crustdata-client';
import { CrustDataEnrichmentService } from './enrichment-service';
import { ExaClient } from './exa-client';
import { SECEdgarClient } from './sec-edgar-client';
import { EnhancedEnrichmentService } from './enhanced-enrichment-service';
import { TickerDiscoveryService } from './ticker-discovery-service';
import { SECSignalsExtractor } from './sec-signals-extractor';
import { FirecrawlScraper } from './firecrawl-scraper';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testCrustDataIntegration() {
  console.log('🔥 Testing CrustData + Exa + SEC Integration...\n');

  // Check for API keys
  const crustDataApiKey = process.env.CRUSTDATA_API_KEY;
  const exaApiKey = process.env.EXA_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!crustDataApiKey) {
    console.error('❌ CRUSTDATA_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('✅ API keys found');
  console.log(`🔑 CrustData: ${crustDataApiKey.substring(0, 8)}...`);
  console.log(`🔑 Exa: ${exaApiKey ? exaApiKey.substring(0, 8) + '...' : 'Not set'}`);
  console.log(`🔑 Anthropic: ${anthropicApiKey ? anthropicApiKey.substring(0, 8) + '...' : 'Not set'}\n`);

  // Test cases
  const testCases = [
    {
      name: 'CrustData Client - Domain lookup',
      test: async () => {
        const client = new CrustDataClient({ apiKey: crustDataApiKey });
        return await client.getCompany('stripe.com');
      },
    },
    {
      name: 'CrustData Client - Name lookup',
      test: async () => {
        const client = new CrustDataClient({ apiKey: crustDataApiKey });
        return await client.getCompanyByName('Stripe');
      },
    },
    {
      name: 'CrustData Enrichment Service',
      test: async () => {
        const service = new CrustDataEnrichmentService(crustDataApiKey);
        return await service.enrichCompany('google.com', true);
      },
    },
    {
      name: 'Exa Client - Financial Documents',
      test: async () => {
        if (!exaApiKey) throw new Error('EXA_API_KEY not set');
        const client = new ExaClient({ apiKey: exaApiKey });
        return await client.searchFinancialDocuments('Apple Inc', 'AAPL', { numResults: 3 });
      },
    },
    {
      name: 'Exa Client - Company News',
      test: async () => {
        if (!exaApiKey) throw new Error('EXA_API_KEY not set');
        const client = new ExaClient({ apiKey: exaApiKey });
        return await client.searchCompanyNews('Tesla', { numResults: 3 });
      },
    },
    {
      name: 'SEC Edgar Client - Company Identification',
      test: async () => {
        const client = new SECEdgarClient();
        return await client.identifyPublicCompany('Apple Inc', 'apple.com');
      },
    },
    {
      name: 'Ticker Discovery Service',
      test: async () => {
        if (!exaApiKey) throw new Error('EXA_API_KEY not set');
        const service = new TickerDiscoveryService(exaApiKey);
        return await service.discoverTicker('Apple Inc', 'apple.com');
      },
    },
    {
      name: 'Firecrawl Scraper',
      test: async () => {
        const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
        if (!firecrawlApiKey) throw new Error('FIRECRAWL_API_KEY not set');
        const scraper = new FirecrawlScraper({ apiKey: firecrawlApiKey });
        return await scraper.scrapeUrl('https://apple.com', {
          formats: ['markdown', 'text'],
          includeMetadata: true,
        });
      },
    },
    {
      name: 'Enhanced Enrichment Service - Full Pipeline',
      test: async () => {
        const service = new EnhancedEnrichmentService({
          crustDataApiKey,
          exaApiKey,
          openaiApiKey: process.env.OPENAI_API_KEY,
          firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
        });
        return await service.enrichCompany('microsoft.com', true, {
          includeSEC: true,
          includeExa: true,
          includeTickerDiscovery: true,
          includeSECSignals: true,
          includeFirecrawl: true,
          includeFinancialDocs: true,
          includeNews: true,
          includeTechStack: true,
        });
      },
    },
  ];

  let successCount = 0;
  let totalCount = testCases.length;

  for (const testCase of testCases) {
    try {
      console.log(`🧪 Testing: ${testCase.name}`);
      const startTime = Date.now();
      
      const result = await testCase.test();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Success (${duration}ms)`);
      
      // Log some key information from the result
      if (result) {
        if (result.data) {
          if (Array.isArray(result.data)) {
            console.log(`   📊 Found ${result.data.length} items`);
            if (result.data.length > 0) {
              const first = result.data[0];
              console.log(`   🏢 First item: ${first.name || first.title || 'Unknown'}`);
            }
          } else {
            const company = result.data;
            console.log(`   🏢 Company: ${company.name || 'Unknown'}`);
            console.log(`   🌐 Domain: ${company.domain || 'No domain'}`);
            console.log(`   🏭 Industry: ${company.industry || 'Unknown'}`);
          }
        } else if (result.company) {
          console.log(`   🏢 Company: ${result.company.name || 'Unknown'}`);
          console.log(`   🌐 Domain: ${result.company.domain || 'No domain'}`);
          console.log(`   🏭 Industry: ${result.company.industry || 'Unknown'}`);
          if (result.secData) {
            console.log(`   📈 Public: ${result.secData.isPublic ? 'Yes' : 'No'}`);
            if (result.secData.ticker) {
              console.log(`   📊 Ticker: ${result.secData.ticker}`);
            }
          }
          if (result.exaData) {
            console.log(`   📰 News: ${result.exaData.news?.length || 0} articles`);
            console.log(`   📄 Financial docs: ${result.exaData.financialDocuments?.length || 0} documents`);
            console.log(`   💻 Tech sources: ${result.exaData.technologyStack?.length || 0} sources`);
          }
        } else if (result.isPublic !== undefined) {
          console.log(`   📈 Public: ${result.isPublic ? 'Yes' : 'No'}`);
          if (result.ticker) {
            console.log(`   📊 Ticker: ${result.ticker}`);
          }
          console.log(`   🎯 Confidence: ${result.confidence || 0}`);
        } else if (result.results) {
          console.log(`   📊 Results: ${result.results.length} items`);
        }
      }
      
      successCount++;
    } catch (error) {
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`\n📊 Test Results: ${successCount}/${totalCount} tests passed`);
  
  if (successCount === totalCount) {
    console.log('🎉 All tests passed! Integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the error messages above.');
  }
}

// Run the test
testCrustDataIntegration().catch(console.error);
