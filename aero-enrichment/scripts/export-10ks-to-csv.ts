#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';

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
  console.log('📊 Exporting 10-K data to CSV\n');

  // Read scraping results
  const resultsPath = path.join(process.cwd(), 'data', 'scraping-results.json');
  const results: ScrapingResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Read validated tickers for additional account info
  const validatedPath = path.join(process.cwd(), 'data', 'validated-tickers.json');
  const validated = JSON.parse(fs.readFileSync(validatedPath, 'utf-8'));
  const validatedMap = new Map(validated.map((v: any) => [v.account_id, v]));

  // Build CSV with 10-K content
  const csvRows: string[] = [];

  // Header
  csvRows.push([
    'account_id',
    'account_name',
    'ticker',
    'cik',
    'industry',
    'website',
    'filing_status',
    'filing_date',
    'markdown_size_bytes',
    'tenk_content_json'
  ].map(h => `"${h}"`).join(','));

  const filingsDir = path.join(process.cwd(), 'data', 'sec-filings');
  let successCount = 0;

  for (const result of results) {
    const account = validatedMap.get(result.account_id) || {};

    let tenkContent = '';
    if (result.status === 'success' && result.markdownPath) {
      // Read the 10-K markdown content
      const mdPath = result.markdownPath;
      if (fs.existsSync(mdPath)) {
        const content = fs.readFileSync(mdPath, 'utf-8');
        // JSON encode the content for safe CSV storage
        tenkContent = JSON.stringify(content);
        successCount++;
      }
    }

    const row = [
      result.account_id,
      result.account_name,
      result.ticker,
      result.cik || '',
      account.industry || '',
      account.website || '',
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
  const outputPath = path.join(process.cwd(), 'data', 'prove-10ks.csv');
  fs.writeFileSync(outputPath, csvRows.join('\n'));

  console.log(`✅ Exported ${results.length} records to ${outputPath}`);
  console.log(`   - ${successCount} with 10-K content`);
  console.log(`   - ${results.length - successCount} without content (no filing or error)`);

  // Show file size
  const stats = fs.statSync(outputPath);
  console.log(`   - File size: ${(stats.size / (1024 * 1024)).toFixed(1)} MB`);
}

main().catch(console.error);
