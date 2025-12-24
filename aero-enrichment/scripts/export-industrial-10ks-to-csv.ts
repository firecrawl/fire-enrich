#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';

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

async function main() {
  console.log('📊 Exporting Industrial 10-K data to CSV\n');

  // Read scraping results
  const resultsPath = path.join(process.cwd(), 'data', 'industrial-scraping-results.json');
  const results: ScrapingResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Build CSV with 10-K content
  const csvRows: string[] = [];

  // Header - includes all requested fields
  csvRows.push([
    'salesforce_account_id',
    'account_name',
    'ticker',
    'original_ticker_symbol',
    'exchange',
    'cik',
    'industry',
    'is_target_account',
    'filing_status',
    'filing_type',
    'filing_date',
    'document_size_bytes',
    'error_message',
    'tenk_content'
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
      result.industry,
      result.is_target_account ? 'true' : 'false',
      result.status,
      result.filingType || '',
      result.filingDate || '',
      result.markdownSize?.toString() || '',
      result.error || '',
      tenkContent
    ].map(v => {
      // Escape quotes and wrap in quotes
      const escaped = String(v).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');

    csvRows.push(row);
  }

  // Write CSV
  const outputPath = path.join(process.cwd(), 'data', 'ntop-industrial-10ks.csv');
  fs.writeFileSync(outputPath, csvRows.join('\n'));

  console.log(`✅ Exported ${results.length} records to ${outputPath}`);
  console.log(`   - ${successCount} with 10-K content`);
  console.log(`   - ${results.length - successCount} without content`);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }
  console.log('\n📊 Status breakdown:');
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   - ${status}: ${count}`);
  }

  // Show file size
  const stats = fs.statSync(outputPath);
  console.log(`\n   - File size: ${(stats.size / (1024 * 1024)).toFixed(1)} MB`);
}

main().catch(console.error);
