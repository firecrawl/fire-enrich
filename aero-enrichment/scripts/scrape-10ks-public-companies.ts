#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { SECEdgarClient } from '../src/sec-edgar-client';
import dotenv from 'dotenv';

dotenv.config();

type ValidatedAccount = {
  account_id: string;
  account_name: string;
  website: string;
  industry: string;
  isPublic: boolean;
  ticker?: string;
  tickerConfidence?: number;
  tickerMethod?: string;
  cik?: string;
};

type ScrapingResult = {
  account_id: string;
  account_name: string;
  ticker: string;
  cik?: string;
  status: 'success' | 'no_filing' | 'error';
  filingDate?: string;
  markdownPath?: string;
  markdownSize?: number;
  error?: string;
};

async function main() {
  console.log('🚀 10-K Scraping for Public Companies\n');

  // Read validated tickers
  const validatedPath = path.join(process.cwd(), 'data', 'validated-tickers.json');
  if (!fs.existsSync(validatedPath)) {
    console.error(`❌ Validated tickers not found: ${validatedPath}`);
    process.exit(1);
  }

  const validated: ValidatedAccount[] = JSON.parse(fs.readFileSync(validatedPath, 'utf-8'));

  // Filter public companies with tickers
  const publicCompanies = validated.filter(a => a.isPublic && a.ticker);
  console.log(`📊 Found ${publicCompanies.length} public companies with tickers\n`);

  // Create output directory
  const outputDir = path.join(process.cwd(), 'data', 'sec-filings');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check for existing files to support resume
  const existingFiles = new Set(fs.readdirSync(outputDir).filter(f => f.endsWith('.md')));
  console.log(`📁 Found ${existingFiles.size} existing filings in ${outputDir}\n`);

  // Initialize SEC client
  const secClient = new SECEdgarClient();

  const results: ScrapingResult[] = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let noFilingCount = 0;

  // Track rate limiting
  const startTime = Date.now();
  let requestCount = 0;

  for (let i = 0; i < publicCompanies.length; i++) {
    const company = publicCompanies[i];
    const ticker = company.ticker!;

    // Check if we already have this company's 10-K
    const existingFile = Array.from(existingFiles).find(f => f.startsWith(`${ticker}-10K-`));
    if (existingFile) {
      console.log(`[${i + 1}/${publicCompanies.length}] ${company.account_name} (${ticker}) - ⏭️ Already exists: ${existingFile}`);
      skipCount++;
      results.push({
        account_id: company.account_id,
        account_name: company.account_name,
        ticker,
        cik: company.cik,
        status: 'success',
        markdownPath: path.join(outputDir, existingFile),
      });
      continue;
    }

    console.log(`[${i + 1}/${publicCompanies.length}] ${company.account_name} (${ticker})`);

    try {
      // Rate limiting: SEC allows 10 requests/second, we'll be conservative with 5/sec
      requestCount++;
      const elapsed = (Date.now() - startTime) / 1000;
      const currentRate = requestCount / elapsed;
      if (currentRate > 4 && elapsed > 1) {
        const delay = Math.max(200, (requestCount / 4 - elapsed) * 1000);
        await new Promise(r => setTimeout(r, delay));
      }

      const filings = await secClient.getFilingsWithContent(ticker, {
        formTypes: ['10-K'],
        monthsBack: 24, // Last 2 years to get at least one
        maxFilings: 1,  // Just the most recent
      });

      if (filings.length === 0) {
        console.log(`  ⚠️ No 10-K filing found`);
        noFilingCount++;
        results.push({
          account_id: company.account_id,
          account_name: company.account_name,
          ticker,
          cik: company.cik,
          status: 'no_filing',
        });
        continue;
      }

      const filing = filings[0];
      const filename = `${ticker}-10K-${filing.filingDate}.md`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, filing.markdownContent);

      console.log(`  ✅ Saved: ${filename} (${(filing.markdownContent.length / 1024).toFixed(0)} KB)`);
      successCount++;

      results.push({
        account_id: company.account_id,
        account_name: company.account_name,
        ticker,
        cik: company.cik,
        status: 'success',
        filingDate: filing.filingDate,
        markdownPath: filepath,
        markdownSize: filing.markdownContent.length,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Error: ${errorMsg}`);
      errorCount++;
      results.push({
        account_id: company.account_id,
        account_name: company.account_name,
        ticker,
        cik: company.cik,
        status: 'error',
        error: errorMsg,
      });
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 250));
  }

  // Save results
  const resultsPath = path.join(process.cwd(), 'data', 'scraping-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SCRAPING SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total companies: ${publicCompanies.length}`);
  console.log(`✅ Success (new): ${successCount}`);
  console.log(`⏭️ Skipped (existing): ${skipCount}`);
  console.log(`⚠️ No filing found: ${noFilingCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  console.log(`📁 Filings saved to: ${outputDir}`);

  // List any errors
  const errors = results.filter(r => r.status === 'error');
  if (errors.length > 0) {
    console.log(`\n❌ Companies with errors:`);
    errors.forEach(e => {
      console.log(`  - ${e.account_name} (${e.ticker}): ${e.error}`);
    });
  }

  console.log(`\n✅ Done!`);
}

main().catch(console.error);
