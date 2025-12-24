#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { SECEdgarClient } from '../src/sec-edgar-client';
import dotenv from 'dotenv';

dotenv.config();

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
      if (currentRecord.length > 1) records.push(currentRecord);
      currentRecord = [];
      currentField = '';
      pos += 2;
    } else if (char === '\n' && !inQuotes) {
      currentRecord.push(currentField);
      if (currentRecord.length > 1) records.push(currentRecord);
      currentRecord = [];
      currentField = '';
      pos++;
    } else if ((char === '\n' || char === '\r') && inQuotes) {
      currentField += ' ';
      pos++;
    } else {
      currentField += char;
      pos++;
    }
  }
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.length > 1) records.push(currentRecord);
  }
  return records;
}

type Account = {
  account_id: string;
  account_name: string;
  website: string;
  industry: string;
};

type ValidatedAccount = Account & {
  isPublic: boolean;
  ticker: string | null;
  tickerConfidence: number | null;
  tickerMethod: string | null;
  cik: string | null;
};

async function main() {
  console.log('🚀 Validating top 20 accounts...\n');

  const csvPath = path.join(process.cwd(), 'data', 'Propensity Scoring Accounts.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parseCSV(content);
  const headers = records[0].map(h => h.trim());

  const accounts: Account[] = [];
  for (let i = 1; i < records.length && accounts.length < 20; i++) {
    const values = records[i];
    const accountId = (values[0] || '').trim();
    const name = (values[1] || '').trim();
    const website = (values[2] || '').trim();
    const industry = (values[3] || '').trim();

    const isValidSalesforceId = /^001[a-zA-Z0-9]{12,15}$/.test(accountId);
    const looksLikeJsonKeyValue = /^[a-z_]+:[A-Z]/.test(name) || /^[a-z_]+:https?:/.test(name);
    const isValidName = name.length > 0 &&
      !name.startsWith('(+') &&
      !name.startsWith('{') &&
      !looksLikeJsonKeyValue &&
      !name.startsWith('linkedin') &&
      !name.startsWith('crunchbase') &&
      !name.startsWith('http');

    if (isValidSalesforceId && isValidName) {
      accounts.push({ account_id: accountId, account_name: name, website, industry });
    }
  }

  console.log('Top 20 accounts:');
  accounts.forEach((a, i) => console.log(`  ${i+1}. ${a.account_name}`));

  // Validate tickers
  const secClient = new SECEdgarClient();
  const validated: ValidatedAccount[] = [];

  console.log('\n🔍 Validating tickers...\n');

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    console.log(`[${i + 1}/${accounts.length}] ${account.account_name}`);

    const secMatch = await secClient.identifyPublicCompany(account.account_name, account.website);

    const result: ValidatedAccount = {
      ...account,
      isPublic: false,
      ticker: null,
      tickerConfidence: null,
      tickerMethod: null,
      cik: null
    };

    if (secMatch.isPublic && secMatch.ticker && secMatch.confidence >= 0.8) {
      result.ticker = secMatch.ticker;
      result.tickerConfidence = secMatch.confidence;
      result.tickerMethod = 'sec_directory';
      result.cik = secMatch.cik || null;
      result.isPublic = true;
      console.log(`  ✅ ${secMatch.ticker} (confidence: ${(secMatch.confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`  ⚪ Not public or not found`);
    }

    validated.push(result);
    await new Promise(r => setTimeout(r, 100));
  }

  // Summary
  const publicCompanies = validated.filter(v => v.isPublic);
  console.log(`\n📊 Summary: ${publicCompanies.length} public companies found out of 20\n`);

  // Save validated results
  const outputPath = path.join(process.cwd(), 'data', 'validated-tickers-top20.json');
  fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2));
  console.log(`💾 Saved to ${outputPath}\n`);

  // Now scrape 10-Ks for public companies
  console.log('📄 Scraping 10-Ks for public companies...\n');

  const outputDir = path.join(process.cwd(), 'data', 'sec-filings');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const company of publicCompanies) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 ${company.account_name} (${company.ticker})`);
    console.log(`${'='.repeat(60)}`);

    try {
      const filings = await secClient.getFilingsWithContent(company.ticker!, {
        formTypes: ['10-K'],
        monthsBack: 24,
        maxFilings: 1,
      });

      if (filings.length === 0) {
        console.log('  ⚠️ No 10-K found');
        continue;
      }

      const filing = filings[0];
      console.log(`  Form: ${filing.form}`);
      console.log(`  Date: ${filing.filingDate}`);
      console.log(`  Content: ${filing.markdownContent.length.toLocaleString()} chars`);

      // Save to file
      const filename = `${company.ticker}-10K-${filing.filingDate}.md`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, filing.markdownContent);
      console.log(`  💾 Saved: ${filename}`);

      // Show preview
      console.log(`\n  Preview (first 500 chars):`);
      console.log('  ---');
      const preview = filing.markdownContent.substring(0, 500).split('\n').map(l => '  ' + l).join('\n');
      console.log(preview);
      console.log('  ---');

    } catch (err) {
      console.log(`  ❌ Error: ${(err as Error).message}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
