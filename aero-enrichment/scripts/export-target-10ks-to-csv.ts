#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';

type ScrapingResult = {
  account_id: string;
  account_name: string;
  ticker: string;
  original_ticker_symbol: string;
  exchange: string;
  cik?: string;
  status: 'success' | 'no_filing' | 'error' | 'foreign';
  filingDate?: string;
  markdownPath?: string;
  markdownSize?: number;
  error?: string;
};

async function main() {
  console.log('📊 Exporting Target Accounts 10-K data to CSV\n');

  // Read scraping results
  const resultsPath = path.join(process.cwd(), 'data', 'target-accounts-scraping-results.json');
  const results: ScrapingResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Build CSV with 10-K content
  const csvRows: string[] = [];

  // Header
  csvRows.push([
    'account_id',
    'account_name',
    'ticker',
    'original_ticker_symbol',
    'exchange',
    'cik',
    'filing_status',
    'filing_date',
    'markdown_size_bytes',
    'tenk_content_json'
  ].map(h => `"${h}"`).join(','));

  let successCount = 0;

  for (const result of results) {
    let tenkContent = '';
    if (result.status === 'success' && result.markdownPath) {
      // Read the 10-K markdown content
      if (fs.existsSync(result.markdownPath)) {
        const content = fs.readFileSync(result.markdownPath, 'utf-8');
        // JSON encode the content for safe CSV storage
        tenkContent = JSON.stringify(content);
        successCount++;
      }
    }

    const row = [
      result.account_id,
      result.account_name,
      result.ticker,
      result.original_ticker_symbol,
      result.exchange,
      result.cik || '',
      result.status,
      result.filingDate || '',
      result.markdownSize?.toString() || '',
      tenkContent
    ].map(v => {
      // Escape quotes and wrap in quotes
      const escaped = String(v).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');

    csvRows.push(row);
  }

  // Write CSV
  const outputPath = path.join(process.cwd(), 'data', 'target-accounts-10ks.csv');
  fs.writeFileSync(outputPath, csvRows.join('\n'));

  console.log(`✅ Exported ${results.length} records to ${outputPath}`);
  console.log(`   - ${successCount} with 10-K content`);
  console.log(`   - ${results.length - successCount} without content (no filing, foreign, or error)`);

  // Show file size
  const stats = fs.statSync(outputPath);
  console.log(`   - File size: ${(stats.size / (1024 * 1024)).toFixed(1)} MB`);
}

main().catch(console.error);
