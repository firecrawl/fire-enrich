#!/usr/bin/env tsx

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

async function demonstrateEnhancedEnrichment() {
  console.log('🔥 Enhanced Company Enrichment Demonstration\n');

  // Check for API keys
  const crustDataApiKey = process.env.CRUSTDATA_API_KEY;
  const exaApiKey = process.env.EXA_API_KEY;

  if (!crustDataApiKey) {
    console.error('❌ CRUSTDATA_API_KEY not found in environment variables');
    console.log('Please set CRUSTDATA_API_KEY in your .env.local file');
    process.exit(1);
  }

  console.log('✅ API keys found');
  console.log(`🔑 CrustData: ${crustDataApiKey.substring(0, 8)}...`);
  console.log(`🔑 Exa: ${exaApiKey ? exaApiKey.substring(0, 8) + '...' : 'Not set'}\n`);

  const enhancedService = new EnhancedEnrichmentService({
    crustDataApiKey,
    exaApiKey,
  });

  // Example 1: Enhanced single company enrichment
  console.log('📊 Example 1: Enhanced Single Company Enrichment');
  console.log('=' .repeat(60));
  
  try {
    const result = await enhancedService.enrichCompany('stripe.com', true, {
      includeSEC: true,
      includeExa: true,
      includeFinancialDocs: true,
      includeNews: true,
      includeTechStack: true,
    });
    
    if (result.success && result.company) {
      console.log('✅ Successfully enriched company data');
      console.log(`🏢 Company: ${result.company.name}`);
      console.log(`🌐 Domain: ${result.company.domain}`);
      console.log(`🏭 Industry: ${result.company.industry || 'Unknown'}`);
      console.log(`👥 Employees: ${result.company.employee_count || 'Unknown'}`);
      console.log(`💰 Revenue: ${result.company.revenue ? `$${result.company.revenue.toLocaleString()}` : 'Unknown'}`);
      console.log(`📍 Location: ${result.company.headquarters?.city || 'Unknown'}, ${result.company.headquarters?.country || 'Unknown'}`);
      
      if (result.secData) {
        console.log(`\n📈 SEC Data:`);
        console.log(`   Public: ${result.secData.isPublic ? 'Yes' : 'No'}`);
        if (result.secData.ticker) {
          console.log(`   Ticker: ${result.secData.ticker}`);
          console.log(`   CIK: ${result.secData.cik}`);
          console.log(`   Confidence: ${result.secData.confidence}`);
        }
        if (result.secData.filings) {
          console.log(`   Recent Filings: ${result.secData.filings.length}`);
          console.log(`   Latest Filing: ${result.secData.filings[0]?.form} (${result.secData.filings[0]?.reportDate || result.secData.filings[0]?.filingDate})`);
        }
      }
      
      if (result.exaData) {
        console.log(`\n🔍 Exa Data:`);
        console.log(`   Financial Documents: ${result.exaData.financialDocuments?.length || 0}`);
        console.log(`   News Articles: ${result.exaData.news?.length || 0}`);
        console.log(`   Tech Stack Sources: ${result.exaData.technologyStack?.length || 0}`);
      }
      
      console.log(`\n📋 Enhanced Enrichment Fields:`);
      Object.entries(result.enrichmentFields).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          console.log(`   ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
        }
      });
    } else {
      console.log('❌ Failed to enrich company:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n');

  // Example 2: Bulk enrichment
  console.log('📊 Example 2: Bulk Company Enrichment');
  console.log('=' .repeat(60));
  
  try {
    const companies = ['google.com', 'microsoft.com', 'apple.com'];
    const results = await enhancedService.enrichCompanies(companies, true, {
      includeSEC: true,
      includeExa: false, // Skip Exa for faster bulk processing
    });
    
    console.log(`✅ Processed ${results.length} companies`);
    
    results.forEach((result, index) => {
      if (result.success && result.company) {
        console.log(`\n${index + 1}. ${result.company.name}`);
        console.log(`   Domain: ${result.company.domain}`);
        console.log(`   Industry: ${result.company.industry || 'Unknown'}`);
        console.log(`   Employees: ${result.company.employee_count || 'Unknown'}`);
        if (result.secData?.isPublic) {
          console.log(`   Public: Yes (${result.secData.ticker})`);
        } else {
          console.log(`   Public: No`);
        }
      } else {
        console.log(`\n${index + 1}. Failed: ${result.error}`);
      }
    });
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n');

  // Example 3: Industry-based search
  console.log('📊 Example 3: Industry-Based Search');
  console.log('=' .repeat(60));
  
  try {
    const results = await enhancedService.getCompaniesByIndustry('Technology', 5, {
      includeSEC: true,
      includeExa: false,
    });
    
    console.log(`✅ Found ${results.length} technology companies`);
    
    results.forEach((result, index) => {
      if (result.success && result.company) {
        console.log(`\n${index + 1}. ${result.company.name}`);
        console.log(`   Domain: ${result.company.domain}`);
        console.log(`   Employees: ${result.company.employee_count || 'Unknown'}`);
        console.log(`   Revenue: ${result.company.revenue ? `$${result.company.revenue.toLocaleString()}` : 'Unknown'}`);
        if (result.secData?.isPublic) {
          console.log(`   Public: Yes (${result.secData.ticker})`);
        } else {
          console.log(`   Public: No`);
        }
      } else {
        console.log(`\n${index + 1}. Failed: ${result.error}`);
      }
    });
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n');

  // Example 4: Technology-based search
  console.log('📊 Example 4: Technology-Based Search');
  console.log('=' .repeat(60));
  
  try {
    const results = await enhancedService.getCompaniesByTechnology(['artificial intelligence', 'machine learning'], 5, {
      includeSEC: true,
      includeExa: false,
    });
    
    console.log(`✅ Found ${results.length} AI/ML companies`);
    
    results.forEach((result, index) => {
      if (result.success && result.company) {
        console.log(`\n${index + 1}. ${result.company.name}`);
        console.log(`   Domain: ${result.company.domain}`);
        console.log(`   Technologies: ${result.company.technologies?.join(', ') || 'Unknown'}`);
        console.log(`   Employees: ${result.company.employee_count || 'Unknown'}`);
        if (result.secData?.isPublic) {
          console.log(`   Public: Yes (${result.secData.ticker})`);
        } else {
          console.log(`   Public: No`);
        }
      } else {
        console.log(`\n${index + 1}. Failed: ${result.error}`);
      }
    });
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n🎉 Enhanced Enrichment Demonstration Complete!');
  console.log('\n💡 Integration Tips:');
  console.log('   • Use enrichCompany() for single company enrichment with full data');
  console.log('   • Use enrichCompanies() for bulk processing with concurrency control');
  console.log('   • Use getCompaniesBy*() methods for discovery and lead generation');
  console.log('   • Combine CrustData, Exa, and SEC data for comprehensive insights');
  console.log('   • Handle errors gracefully with the success/error flags');
  console.log('   • Configure options to control which data sources to include');
}

async function demonstrateTickerDiscovery() {
  console.log('\n=== Ticker Discovery Service Demo ===');
  
  const service = new TickerDiscoveryService(process.env.EXA_API_KEY);
  
  const companies = [
    { name: 'Apple Inc', website: 'apple.com' },
    { name: 'Microsoft Corporation', website: 'microsoft.com' },
    { name: 'Tesla Inc', website: 'tesla.com' },
    { name: 'Boeing Company', website: 'boeing.com' },
    { name: 'Lockheed Martin', website: 'lockheedmartin.com' },
  ];

  console.log(`\n🔍 Discovering tickers for ${companies.length} companies...\n`);

  for (const company of companies) {
    try {
      console.log(`\n📊 Processing: ${company.name}`);
      const result = await service.discoverTicker(company.name, company.website, {
        includeInternational: true,
        maxRetries: 3,
        timeout: 30000,
      });

      if (result) {
        console.log(`✅ Ticker Found: ${result.ticker}`);
        console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`🔧 Method: ${result.method}`);
        if (result.exchange) {
          console.log(`🏛️  Exchange: ${result.exchange}`);
        }
        if (result.source) {
          console.log(`🔗 Source: ${result.source}`);
        }
      } else {
        console.log(`❌ No ticker found`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function demonstrateFirecrawlScraping() {
  console.log('\n=== Firecrawl Scraper Demo ===');
  
  const scraper = new FirecrawlScraper({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  const companies = [
    { name: 'Apple Inc', website: 'apple.com' },
    { name: 'Microsoft Corporation', website: 'microsoft.com' },
  ];

  console.log(`\n🕷️  Scraping ${companies.length} company websites...\n`);

  for (const company of companies) {
    try {
      console.log(`\n📊 Processing: ${company.name}`);
      const result = await scraper.extractCompanyInformation(company.name, company.website);

      console.log(`✅ Scraping completed`);
      console.log(`📄 Pages scraped: ${result.scrapedPages?.length || 0}`);
      
      if (result.basicInfo.employeeCount) {
        console.log(`👥 Employees: ${result.basicInfo.employeeCount.toLocaleString()}`);
      }
      if (result.basicInfo.foundedYear) {
        console.log(`📅 Founded: ${result.basicInfo.foundedYear}`);
      }
      if (result.basicInfo.headquarters) {
        console.log(`📍 Headquarters: ${result.basicInfo.headquarters}`);
      }
      if (result.basicInfo.industry) {
        console.log(`🏭 Industry: ${result.basicInfo.industry}`);
      }
      if (result.financialInfo.revenue) {
        console.log(`💰 Revenue: $${(result.financialInfo.revenue / 1000000000).toFixed(1)}B`);
      }
      if (result.financialInfo.marketCap) {
        console.log(`📊 Market Cap: $${(result.financialInfo.marketCap / 1000000000).toFixed(1)}B`);
      }
      if (result.technologyInfo.technologies) {
        console.log(`🔧 Technologies: ${result.technologyInfo.technologies.join(', ')}`);
      }
      if (result.newsInfo.hasFundingNews) {
        console.log(`📰 Has funding news: Yes`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function runAllExamples() {
  console.log('🚀 CrustData + Exa + SEC + AI Integration Examples');
  console.log('=' .repeat(60));

  // Run all examples
  await demonstrateBasicIntegration();
  await demonstrateEnhancedEnrichment();
  await demonstrateTickerDiscovery();
  await demonstrateFirecrawlScraping();

  console.log('\n🎉 All examples completed!');
}

// Run the examples
runAllExamples().catch(console.error);
