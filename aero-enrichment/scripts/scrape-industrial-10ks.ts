#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { SECEdgarClient } from '../src/sec-edgar-client';
import dotenv from 'dotenv';

dotenv.config();

type IndustrialAccount = {
  account_id: string;
  account_name: string;
  industry: string;
  ticker_symbol: string;
  is_target_account: string;
  parsed_ticker?: string;
  exchange?: string;
};

type ScrapingResult = {
  account_id: string;
  account_name: string;
  ticker: string;
  original_ticker_symbol: string;
  exchange: string;
  industry: string;
  is_target_account: boolean;
  cik?: string;
  status: 'success' | 'no_filing' | 'error' | 'foreign' | 'invalid_ticker';
  filingDate?: string;
  filingType?: string;
  markdownPath?: string;
  markdownSize?: number;
  error?: string;
};

function parseTicker(tickerSymbol: string): { ticker: string; exchange: string } {
  // Handle various formats:
  // "NYSE: AIRI" -> { ticker: "AIRI", exchange: "NYSE" }
  // "NASDAQ:BKR" -> { ticker: "BKR", exchange: "NASDAQ" }
  // "EPA: AIR" -> { ticker: "AIR", exchange: "EPA" } (foreign)

  const match = tickerSymbol.match(/^([A-Z0-9]+):\s*(.+)$/i);
  if (match) {
    return { exchange: match[1].toUpperCase(), ticker: match[2].trim() };
  }
  return { exchange: 'unknown', ticker: tickerSymbol.trim() };
}

function isUSExchange(exchange: string): boolean {
  const usExchanges = ['NYSE', 'NASDAQ', 'AMEX', 'OTC', 'NYSEMKT', 'NYSEARCA'];
  return usExchanges.includes(exchange.toUpperCase());
}

function isValidTicker(ticker: string): boolean {
  // A valid ticker should be 1-6 characters, alphanumeric with possible dots
  // Invalid: "Industrial Machinery & Equipment", "Manufacturing", etc.
  if (!ticker) return false;
  if (ticker.length > 10) return false;
  if (ticker.includes(' ')) return false;
  if (ticker.includes('&')) return false;
  return /^[A-Z0-9./-]+$/i.test(ticker);
}

function parseCSV(content: string): string[][] {
  content = content.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let pos = 0;

  while (pos < content.length) {
    const char = content[pos];
    const nextChar = content[pos + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        pos += 2;
      } else {
        inQuotes = !inQuotes;
        pos++;
      }
    } else if (char === ',' && !inQuotes) {
      currentRecord.push(currentField);
      currentField = '';
      pos++;
    } else if ((char === '\r' && nextChar === '\n') && !inQuotes) {
      currentRecord.push(currentField);
      if (currentRecord.length > 0) records.push(currentRecord);
      currentRecord = [];
      currentField = '';
      pos += 2;
    } else if (char === '\n' && !inQuotes) {
      currentRecord.push(currentField);
      if (currentRecord.length > 0) records.push(currentRecord);
      currentRecord = [];
      currentField = '';
      pos++;
    } else {
      currentField += char;
      pos++;
    }
  }
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.length > 0) records.push(currentRecord);
  }
  return records;
}

async function main() {
  console.log('🚀 10-K Scraping for Target Industrial Companies\n');

  // Read the CSV
  const csvPath = '/Users/jaitoor/Downloads/Target Industrial Tickers.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parseCSV(content);

  // Parse accounts
  const headers = records[0].map(h => h.trim());
  const accounts: IndustrialAccount[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    const account: IndustrialAccount = {
      account_id: (values[0] || '').trim(),
      account_name: (values[1] || '').trim(),
      industry: (values[2] || '').trim(),
      ticker_symbol: (values[3] || '').trim(),
      is_target_account: (values[4] || '').trim(),
    };

    if (account.ticker_symbol) {
      const { ticker, exchange } = parseTicker(account.ticker_symbol);
      account.parsed_ticker = ticker;
      account.exchange = exchange;
    }

    accounts.push(account);
  }

  console.log(`📊 Found ${accounts.length} accounts\n`);

  // Categorize accounts
  const usAccounts = accounts.filter(a => a.exchange && isUSExchange(a.exchange) && isValidTicker(a.parsed_ticker || ''));
  const foreignAccounts = accounts.filter(a => a.exchange && !isUSExchange(a.exchange) && isValidTicker(a.parsed_ticker || ''));
  const invalidAccounts = accounts.filter(a => !isValidTicker(a.parsed_ticker || ''));

  console.log(`🇺🇸 US-listed companies: ${usAccounts.length}`);
  console.log(`🌍 Foreign-listed companies: ${foreignAccounts.length}`);
  console.log(`⚠️ Invalid ticker data: ${invalidAccounts.length}\n`);

  // Create output directory
  const outputDir = path.join(process.cwd(), 'data', 'sec-filings-industrial');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check for existing files (for resume support)
  const existingFiles = new Set(fs.readdirSync(outputDir).filter(f => f.endsWith('.md')));

  // Initialize SEC client
  const secClient = new SECEdgarClient();

  const results: ScrapingResult[] = [];

  // Process US companies
  console.log('📥 Scraping 10-Ks for US-listed companies...\n');

  for (let i = 0; i < usAccounts.length; i++) {
    const account = usAccounts[i];
    const ticker = account.parsed_ticker!;

    console.log(`[${i + 1}/${usAccounts.length}] ${account.account_name} (${ticker})`);

    // Check if already exists
    const existingFile = Array.from(existingFiles).find(f => f.startsWith(`${ticker}-10K-`));
    if (existingFile) {
      const existingPath = path.join(outputDir, existingFile);
      const stats = fs.statSync(existingPath);
      const filingDate = existingFile.match(/10K-(\d{4}-\d{2}-\d{2})/)?.[1] || '';
      console.log(`  ⏭️ Already exists: ${existingFile}`);
      results.push({
        account_id: account.account_id,
        account_name: account.account_name,
        ticker,
        original_ticker_symbol: account.ticker_symbol,
        exchange: account.exchange!,
        industry: account.industry,
        is_target_account: account.is_target_account === 'true',
        status: 'success',
        filingDate,
        filingType: '10-K',
        markdownPath: existingPath,
        markdownSize: stats.size,
      });
      continue;
    }

    try {
      const filings = await secClient.getFilingsWithContent(ticker, {
        formTypes: ['10-K'],
        monthsBack: 24,
        maxFilings: 1,
      });

      if (filings.length === 0) {
        console.log(`  ⚠️ No 10-K filing found`);
        results.push({
          account_id: account.account_id,
          account_name: account.account_name,
          ticker,
          original_ticker_symbol: account.ticker_symbol,
          exchange: account.exchange!,
          industry: account.industry,
          is_target_account: account.is_target_account === 'true',
          status: 'no_filing',
        });
        continue;
      }

      const filing = filings[0];
      const filename = `${ticker}-10K-${filing.filingDate}.md`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, filing.markdownContent);

      console.log(`  ✅ Saved: ${filename} (${(filing.markdownContent.length / 1024).toFixed(0)} KB)`);

      results.push({
        account_id: account.account_id,
        account_name: account.account_name,
        ticker,
        original_ticker_symbol: account.ticker_symbol,
        exchange: account.exchange!,
        industry: account.industry,
        is_target_account: account.is_target_account === 'true',
        cik: filing.metadata.cik,
        status: 'success',
        filingDate: filing.filingDate,
        filingType: '10-K',
        markdownPath: filepath,
        markdownSize: filing.markdownContent.length,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Error: ${errorMsg}`);
      results.push({
        account_id: account.account_id,
        account_name: account.account_name,
        ticker,
        original_ticker_symbol: account.ticker_symbol,
        exchange: account.exchange!,
        industry: account.industry,
        is_target_account: account.is_target_account === 'true',
        status: 'error',
        error: errorMsg,
      });
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // Add foreign companies to results
  for (const account of foreignAccounts) {
    results.push({
      account_id: account.account_id,
      account_name: account.account_name,
      ticker: account.parsed_ticker || '',
      original_ticker_symbol: account.ticker_symbol,
      exchange: account.exchange!,
      industry: account.industry,
      is_target_account: account.is_target_account === 'true',
      status: 'foreign',
    });
  }

  // Add invalid ticker entries
  for (const account of invalidAccounts) {
    results.push({
      account_id: account.account_id,
      account_name: account.account_name,
      ticker: account.parsed_ticker || '',
      original_ticker_symbol: account.ticker_symbol,
      exchange: account.exchange || 'unknown',
      industry: account.industry,
      is_target_account: account.is_target_account === 'true',
      status: 'invalid_ticker',
      error: 'Ticker field contains non-ticker data',
    });
  }

  // Save results
  const resultsPath = path.join(process.cwd(), 'data', 'industrial-scraping-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  // Summary
  const successCount = results.filter(r => r.status === 'success').length;
  const noFilingCount = results.filter(r => r.status === 'no_filing').length;
  const foreignCount = results.filter(r => r.status === 'foreign').length;
  const invalidCount = results.filter(r => r.status === 'invalid_ticker').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SCRAPING SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total accounts: ${accounts.length}`);
  console.log(`✅ Success (10-K downloaded): ${successCount}`);
  console.log(`⚠️ No 10-K filing: ${noFilingCount}`);
  console.log(`🌍 Foreign (no 10-K): ${foreignCount}`);
  console.log(`📝 Invalid ticker data: ${invalidCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  console.log(`📁 Filings saved to: ${outputDir}`);

  console.log(`\n✅ Done!`);
}

main().catch(console.error);
