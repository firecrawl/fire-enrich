#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { SECEdgarClient, FilingWithContent } from './sec-edgar-client';
import { TickerDiscoveryService } from './ticker-discovery-service';
import dotenv from 'dotenv';

dotenv.config();

type CSVAccount = {
  account_id: string;
  account_name: string;
  website: string;
  industry: string;
  expected_value_tier: string;
  num_employees: string;
  conversion_score: string;
};

type ValidatedAccount = CSVAccount & {
  ticker?: string;
  tickerConfidence?: number;
  tickerMethod?: string;
  cik?: string;
  isPublic: boolean;
};

function parseCSV(content: string): CSVAccount[] {
  // Remove BOM only - keep original line endings to distinguish record breaks from embedded newlines
  content = content.replace(/^\uFEFF/, '');

  const accounts: CSVAccount[] = [];

  // Parse respecting quoted fields with embedded newlines
  // Use a more robust parser that properly tracks quote state
  let pos = 0;
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;

  while (pos < content.length) {
    const char = content[pos];
    const nextChar = content[pos + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote ""
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
      // Record separator: \r\n outside quotes
      currentRecord.push(currentField);
      if (currentRecord.length > 1) {
        records.push(currentRecord);
      }
      currentRecord = [];
      currentField = '';
      pos += 2; // Skip both \r and \n
    } else if (char === '\n' && !inQuotes) {
      // Also handle just \n as record separator (for last line)
      currentRecord.push(currentField);
      if (currentRecord.length > 1) {
        records.push(currentRecord);
      }
      currentRecord = [];
      currentField = '';
      pos++;
    } else if ((char === '\n' || char === '\r') && inQuotes) {
      // Embedded newline inside quoted field - replace with space for cleaner output
      currentField += ' ';
      pos++;
    } else {
      currentField += char;
      pos++;
    }
  }

  // Don't forget last record
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.length > 1) {
      records.push(currentRecord);
    }
  }

  if (records.length === 0) {
    console.error('No records parsed from CSV');
    return [];
  }

  // First record is headers
  const headers = records[0].map(h => h.trim());
  console.log(`📋 CSV Headers: ${headers.slice(0, 5).join(', ')}...`);

  // Find the expected column indices
  const accountIdIdx = headers.indexOf('account_id');
  const accountNameIdx = headers.indexOf('account_name');
  const websiteIdx = headers.indexOf('website');

  console.log(`📊 Column positions - account_id: ${accountIdIdx}, account_name: ${accountNameIdx}, website: ${websiteIdx}`);

  // Convert to objects with strict validation
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    const account: any = {};
    headers.forEach((header, idx) => {
      account[header] = (values[idx] || '').trim();
    });

    // Strict validation - only include valid Salesforce accounts
    const accountId = account.account_id || '';
    const name = account.account_name || '';
    const website = account.website || '';

    // Valid Salesforce IDs start with 001 (Account object prefix) and are 15 or 18 characters
    const isValidSalesforceId = /^001[a-zA-Z0-9]{12,15}$/.test(accountId);

    // Account name should not be empty and should not contain field artifacts
    // Be careful with colon check - "Re:start" is a valid company name
    // Only reject if it looks like a JSON key-value pair (lowercase_key:Value pattern)
    const looksLikeJsonKeyValue = /^[a-z_]+:[A-Z]/.test(name) || /^[a-z_]+:https?:/.test(name);
    const isValidName = name.length > 0 &&
      !name.startsWith('(+') &&
      !name.startsWith('{') &&
      !looksLikeJsonKeyValue &&
      !name.startsWith('linkedin') &&
      !name.startsWith('crunchbase') &&
      !name.startsWith('http');

    if (isValidSalesforceId && isValidName) {
      accounts.push(account as CSVAccount);
    }
  }

  console.log(`✅ Parsed ${accounts.length} valid accounts from ${records.length - 1} total records`);
  return accounts;
}

async function validateTickers(accounts: CSVAccount[]): Promise<ValidatedAccount[]> {
  const exaApiKey = process.env.EXA_API_KEY;
  let tickerService: TickerDiscoveryService | null = null;

  if (exaApiKey) {
    try {
      tickerService = new TickerDiscoveryService(exaApiKey);
    } catch {
      console.log('⚠️ Exa API key invalid, using SEC directory only');
    }
  } else {
    console.log('⚠️ No EXA_API_KEY set, using SEC directory only');
  }

  const secClient = new SECEdgarClient();

  const validated: ValidatedAccount[] = [];

  console.log(`\n🔍 Validating tickers for ${accounts.length} accounts...\n`);

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const result: ValidatedAccount = {
      ...account,
      isPublic: false,
    };

    console.log(`[${i + 1}/${accounts.length}] ${account.account_name}`);

    try {
      // First try SEC direct lookup (faster, more reliable)
      const secMatch = await secClient.identifyPublicCompany(
        account.account_name,
        account.website
      );

      if (secMatch.isPublic && secMatch.ticker && secMatch.confidence >= 0.85) {
        result.ticker = secMatch.ticker;
        result.tickerConfidence = secMatch.confidence;
        result.tickerMethod = 'sec_directory';
        result.cik = secMatch.cik;
        result.isPublic = true;
        console.log(`  ✅ SEC: ${secMatch.ticker} (${(secMatch.confidence * 100).toFixed(0)}%)`);
      } else if (tickerService) {
        // Try ticker discovery service with Exa
        const tickerResult = await tickerService.discoverTicker(
          account.account_name,
          account.website,
          { includeInternational: true, maxRetries: 2 }
        );

        if (tickerResult && tickerResult.confidence >= 0.7) {
          result.ticker = tickerResult.ticker;
          result.tickerConfidence = tickerResult.confidence;
          result.tickerMethod = tickerResult.method;
          result.isPublic = true;
          console.log(`  ✅ Exa: ${tickerResult.ticker} (${(tickerResult.confidence * 100).toFixed(0)}%)`);

          // Try to get CIK from SEC
          const secVerify = await secClient.identifyPublicCompany(account.account_name);
          if (secVerify.cik) {
            result.cik = secVerify.cik;
          }
        } else {
          console.log(`  ⚪ Not public or no ticker found`);
        }
      } else {
        console.log(`  ⚪ Not found in SEC directory (no Exa key for fallback)`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    validated.push(result);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return validated;
}

async function scrape10Ks(accounts: ValidatedAccount[], count: number): Promise<void> {
  const secClient = new SECEdgarClient();

  // Filter to public companies with tickers
  const publicAccounts = accounts.filter(a => a.isPublic && a.ticker);

  console.log(`\n📊 Found ${publicAccounts.length} public companies with tickers`);
  console.log(`\n📥 Scraping 10-K filings for ${count} companies...\n`);

  const toScrape = publicAccounts.slice(0, count);

  for (const account of toScrape) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 ${account.account_name} (${account.ticker})`);
    console.log(`${'='.repeat(60)}`);

    try {
      const filings = await secClient.getFilingsWithContent(account.ticker!, {
        formTypes: ['10-K'],
        monthsBack: 24, // Last 2 years to ensure we get at least one
        maxFilings: 1,  // Just the most recent
      });

      if (filings.length === 0) {
        console.log(`  ⚠️ No 10-K filings found`);
        continue;
      }

      const filing = filings[0];
      console.log(`\n📋 Filing Details:`);
      console.log(`   Form: ${filing.form}`);
      console.log(`   Date: ${filing.filingDate}`);
      console.log(`   URL: ${filing.url}`);
      console.log(`   Size: ${filing.metadata.fileSize?.toLocaleString()} bytes`);
      console.log(`   Markdown: ${filing.markdownContent.length.toLocaleString()} chars`);

      // Save to file
      const outputDir = path.join(process.cwd(), 'data', 'sec-filings');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filename = `${account.ticker}-10K-${filing.filingDate}.md`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, filing.markdownContent);
      console.log(`   💾 Saved: ${filename}`);

      // Show content preview
      console.log(`\n📝 Content Preview (first 1000 chars):`);
      console.log('---');
      const preview = filing.markdownContent.substring(0, 1000);
      console.log(preview);
      console.log('...\n---');

    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

async function main() {
  console.log('🚀 Ticker Validation & 10-K Scraping\n');

  // Read CSV
  const csvPath = path.join(process.cwd(), 'data', 'Propensity Scoring Accounts.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const allAccounts = parseCSV(csvContent);

  console.log(`📊 Total accounts in CSV: ${allAccounts.length}`);

  // Take top 6000
  const topAccounts = allAccounts.slice(0, 6000);
  console.log(`📋 Processing top ${topAccounts.length} accounts`);

  // Validate tickers
  const validated = await validateTickers(topAccounts);

  // Summary
  const publicCount = validated.filter(a => a.isPublic).length;
  const withTicker = validated.filter(a => a.ticker).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 VALIDATION SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total accounts: ${validated.length}`);
  console.log(`Public companies: ${publicCount}`);
  console.log(`With ticker: ${withTicker}`);

  // List public companies
  console.log(`\n📈 Public Companies Found:`);
  validated.filter(a => a.isPublic).forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.account_name} → ${a.ticker} (${a.tickerMethod}, ${((a.tickerConfidence || 0) * 100).toFixed(0)}%)`);
  });

  // Save validation results
  const outputPath = path.join(process.cwd(), 'data', 'validated-tickers.json');
  fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2));
  console.log(`\n💾 Saved validation results to: ${outputPath}`);

  // Skip 10-K scraping for large batches - do separately
  // await scrape10Ks(validated, 5);

  console.log(`\n✅ Done!`);
}

main().catch(console.error);
