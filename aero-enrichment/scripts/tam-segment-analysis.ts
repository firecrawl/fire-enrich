#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.CRUSTDATA_API_KEY;

interface QueryResult {
  name: string;
  totalCount: number;
  sampleCompanies: string[];
}

async function runQuery(name: string, filters: any): Promise<QueryResult> {
  await new Promise(r => setTimeout(r, 1500)); // Rate limit

  try {
    const response = await fetch('https://api.crustdata.com/screener/companydb/search', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters,
        limit: 5,
        sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }]
      })
    });

    if (!response.ok) {
      return { name, totalCount: -1, sampleCompanies: [`Error: ${response.status}`] };
    }

    const data = await response.json() as any;
    return {
      name,
      totalCount: data.total_count || 0,
      sampleCompanies: data.companies?.slice(0, 3).map((c: any) => c.company_name) || []
    };
  } catch (error: any) {
    return { name, totalCount: -1, sampleCompanies: [`Error: ${error.message}`] };
  }
}

// Helper to build keyword OR filter
function keywordFilter(keywords: string[]) {
  return {
    op: 'or',
    conditions: keywords.map(kw => ({
      filter_type: 'linkedin_company_description',
      type: '(.)',
      value: kw
    }))
  };
}

async function runAllQueries() {
  console.log('=== TAM Expansion Precision Queries (US Only) ===\n');
  console.log('Running queries... (this takes ~2 min due to rate limits)\n');

  const results: QueryResult[] = [];

  // Base US filter
  const usLocation = { filter_type: 'hq_location', type: '(.)', value: 'United States' };

  // Employee size groups
  const size1000Plus = { filter_type: 'employee_count_range', type: 'in', value: ['1001-5000', '5001-10000', '10001+'] };
  const size201Plus = { filter_type: 'employee_count_range', type: 'in', value: ['201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size51Plus = { filter_type: 'employee_count_range', type: 'in', value: ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const sizeAll = { filter_type: 'employee_count_range', type: 'in', value: ['11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };

  // ===== SEGMENT 1: Enterprise-Heavy Industries (1000+ employees) =====
  console.log('--- Segment 1: Enterprise-Heavy (1000+ employees) ---');

  // Digital Marketplace / Retail / E-commerce
  results.push(await runQuery(
    '1a. Digital Marketplace/Retail (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordFilter(['marketplace', 'e-commerce', 'ecommerce', 'retail', 'online shopping'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Healthcare
  results.push(await runQuery(
    '1b. Healthcare (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordFilter(['healthcare', 'health insurance', 'medical', 'hospital', 'health services'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Tier 1/2 Banks (large)
  results.push(await runQuery(
    '1c. Large Banks (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordFilter(['bank', 'banking', 'commercial bank', 'retail bank'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Payments (enterprise)
  results.push(await runQuery(
    '1d. Payments Enterprise (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordFilter(['payment processing', 'payments platform', 'card processing', 'merchant services'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // ===== SEGMENT 2: Traditional Financial/Insurance (51+ employees) =====
  console.log('\n--- Segment 2: Traditional Financial/Insurance (51+) ---');

  // Financial Services (broad)
  results.push(await runQuery(
    '2a. Financial Services (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordFilter(['financial services', 'wealth management', 'asset management', 'investment management'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Insurance
  results.push(await runQuery(
    '2b. Insurance (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordFilter(['insurance', 'insurtech', 'insurance carrier', 'insurance broker'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Banking (mid-size 201+)
  results.push(await runQuery(
    '2c. Banking Mid-Size (201+)',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      keywordFilter(['bank', 'banking', 'credit union', 'community bank'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // ===== SEGMENT 3: Fintech/Lending/Crypto (include smaller, use specific keywords) =====
  console.log('\n--- Segment 3: Fintech/Lending/Crypto (11+ with specific keywords) ---');

  // Pure Fintech
  results.push(await runQuery(
    '3a. Fintech (11+)',
    { op: 'and', conditions: [
      usLocation,
      sizeAll,
      keywordFilter(['fintech', 'financial technology', 'neobank', 'challenger bank', 'digital bank'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Lending
  results.push(await runQuery(
    '3b. Lending/BNPL (11+)',
    { op: 'and', conditions: [
      usLocation,
      sizeAll,
      keywordFilter(['lending', 'loan', 'BNPL', 'buy now pay later', 'consumer lending', 'mortgage', 'auto lending'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Crypto/Blockchain
  results.push(await runQuery(
    '3c. Crypto/Blockchain (11+)',
    { op: 'and', conditions: [
      usLocation,
      sizeAll,
      keywordFilter(['crypto', 'cryptocurrency', 'blockchain', 'digital asset', 'crypto exchange', 'defi'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // Payments (smaller)
  results.push(await runQuery(
    '3d. Payments/Card Issuing (11+)',
    { op: 'and', conditions: [
      usLocation,
      sizeAll,
      keywordFilter(['card issuing', 'payment platform', 'payment gateway', 'embedded finance', 'payments api'])
    ]}
  ));
  console.log(`  ${results[results.length-1].name}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY - US TAM by Segment');
  console.log('='.repeat(60));

  let total = 0;
  results.forEach(r => {
    if (r.totalCount > 0) total += r.totalCount;
    console.log(`${r.name.padEnd(40)} ${r.totalCount.toLocaleString().padStart(10)}`);
    if (r.sampleCompanies.length > 0 && r.totalCount > 0) {
      console.log(`    Sample: ${r.sampleCompanies.join(', ')}`);
    }
  });

  console.log('-'.repeat(60));
  console.log(`${'TOTAL (with overlap)'.padEnd(40)} ${total.toLocaleString().padStart(10)}`);
  console.log('\nNote: Segments may overlap. De-duplication needed for final TAM.');
}

runAllQueries();
