#!/usr/bin/env npx tsx
/**
 * TAM Segment Analysis v3 - Aligned with actual Tier A ICP data
 *
 * Based on your Tier A employee distributions:
 * - Fintech: median 25, most common 0-50 → include ALL sizes
 * - Financial Services: median 26, most common 0-50 → include ALL sizes
 * - Insurance/Insurtech: median 103, most common 0-50 → include ALL sizes
 * - Gambling: median 56, most common 0-50 → include ALL sizes
 * - Banking: median 342, most common 201-1000 → 51+
 * - Financial: median 375, most common 51-200 → 51+
 * - Payments: median 1,300, most common 1000+ → 201+
 * - Digital Marketplace: median 1,100, most common 1000+ → 201+
 * - Retail: median 3,018, most common 1000+ → 1000+
 * - Healthcare: median 6,000, most common 1000+ → 1000+
 * - Tier 1 Bank: median 30,482, most common 1000+ → 1000+
 * - Tier 2 Bank: median 4,008, most common 1000+ → 1000+
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.CRUSTDATA_API_KEY;

interface QueryResult {
  name: string;
  totalCount: number;
  samples: { name: string; domain: string; size: string }[];
}

async function runQuery(name: string, filters: any): Promise<QueryResult> {
  await new Promise(r => setTimeout(r, 1500));

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
      const text = await response.text();
      console.error(`  Error for ${name}: ${response.status} - ${text.substring(0, 100)}`);
      return { name, totalCount: -1, samples: [] };
    }

    const data = await response.json() as any;
    return {
      name,
      totalCount: data.total_count || 0,
      samples: data.companies?.slice(0, 3).map((c: any) => ({
        name: c.company_name,
        domain: c.company_website_domain || '',
        size: c.employee_count_range || ''
      })) || []
    };
  } catch (error: any) {
    return { name, totalCount: -1, samples: [] };
  }
}

function keywordOR(keywords: string[]) {
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
  console.log('=== TAM Segment Analysis v3 (US Only - Aligned with Tier A ICP) ===\n');

  const results: QueryResult[] = [];
  const usLocation = { filter_type: 'hq_location', type: '(.)', value: 'United States' };

  // Employee size buckets
  const sizeAll = { filter_type: 'employee_count_range', type: 'in', value: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size11Plus = { filter_type: 'employee_count_range', type: 'in', value: ['11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size51Plus = { filter_type: 'employee_count_range', type: 'in', value: ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size201Plus = { filter_type: 'employee_count_range', type: 'in', value: ['201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size1000Plus = { filter_type: 'employee_count_range', type: 'in', value: ['1001-5000', '5001-10000', '10001+'] };

  // =============================================================================
  // SMALL COMPANY SEGMENTS (median < 100, most common 0-50) - NO SIZE FILTER
  // =============================================================================
  console.log('--- SMALL COMPANY SEGMENTS (Fintech/Insurtech/Gambling - All Sizes) ---\n');

  // 1. FINTECH (median 25, 491 Tier A accounts)
  // Keywords: how fintech companies describe themselves
  results.push(await runQuery(
    'Fintech (all sizes)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus, // Include 11+ to filter out solo consultants
      keywordOR([
        'fintech',
        'financial technology',
        'neobank',
        'challenger bank',
        'digital bank',
        'banking as a service',
        'baas',
        'open banking',
        'embedded finance'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 2. FINANCIAL SERVICES (median 26, 321 Tier A accounts)
  results.push(await runQuery(
    'Financial Services (all sizes)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordOR([
        'financial services company',
        'financial advisory',
        'financial planning',
        'registered investment advisor',
        'ria',
        'broker dealer',
        'securities'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 3. INSURTECH (median 103, part of 812 Insurance Tier A)
  results.push(await runQuery(
    'Insurtech (all sizes)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordOR([
        'insurtech',
        'insurance technology',
        'digital insurance',
        'insurance platform',
        'insurance startup',
        'mga',
        'managing general agent'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 4. GAMBLING / GAMING (median 56, 73 Tier A)
  results.push(await runQuery(
    'Gambling/Gaming (all sizes)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordOR([
        'sports betting',
        'online gambling',
        'igaming',
        'casino',
        'gaming platform',
        'fantasy sports',
        'sportsbook'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 5. CRYPTO / DIGITAL ASSETS
  results.push(await runQuery(
    'Crypto/Digital Assets (all sizes)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordOR([
        'cryptocurrency',
        'crypto exchange',
        'digital asset',
        'blockchain',
        'defi',
        'web3',
        'crypto custody',
        'bitcoin',
        'ethereum'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // =============================================================================
  // MID-SIZE SEGMENTS (median 200-500, most common 51-200 or 201-1000) - 51+ filter
  // =============================================================================
  console.log('\n--- MID-SIZE SEGMENTS (Banking/Financial - 51+ employees) ---\n');

  // 6. BANKING (median 342, 454 Tier A, most common 201-1000)
  results.push(await runQuery(
    'Banking (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordOR([
        'bank',
        'banking',
        'credit union',
        'community bank',
        'commercial bank',
        'retail bank',
        'savings bank'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 7. FINANCIAL (broad) (median 375, 2044 Tier A, most common 51-200)
  results.push(await runQuery(
    'Financial (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordOR([
        'financial institution',
        'wealth management',
        'asset management',
        'investment management',
        'private equity',
        'venture capital',
        'hedge fund'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 8. LENDING (specific platforms, not generic "loan")
  results.push(await runQuery(
    'Lending Platforms (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordOR([
        'lending platform',
        'online lender',
        'consumer lending',
        'alternative lending',
        'loan origination',
        'mortgage lender',
        'auto lender',
        'bnpl',
        'buy now pay later'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // =============================================================================
  // LARGE SEGMENTS (median 1000+, most common 1000+) - 201+ or 1000+ filter
  // =============================================================================
  console.log('\n--- LARGE SEGMENTS (Payments/Marketplace - 201+ employees) ---\n');

  // 9. PAYMENTS (median 1,300, 51 Tier A, most common 1000+)
  results.push(await runQuery(
    'Payments (201+)',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      keywordOR([
        'payment processing',
        'payment platform',
        'payment gateway',
        'merchant services',
        'card processing',
        'payment network',
        'issuer processor',
        'acquiring'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 10. DIGITAL MARKETPLACE (median 1,100, 203 Tier A)
  results.push(await runQuery(
    'Digital Marketplace (201+)',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      keywordOR([
        'marketplace',
        'e-commerce platform',
        'online marketplace',
        'two-sided marketplace',
        'platform business'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // =============================================================================
  // ENTERPRISE SEGMENTS (median 3000+) - 1000+ filter
  // =============================================================================
  console.log('\n--- ENTERPRISE SEGMENTS (1000+ employees) ---\n');

  // 11. TIER 1/2 BANKS (median 30K / 4K)
  results.push(await runQuery(
    'Tier 1/2 Banks (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordOR([
        'global bank',
        'multinational bank',
        'major bank',
        'regional bank',
        'national bank'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 12. INSURANCE CARRIERS (large) (median 7K for Insurance overall)
  results.push(await runQuery(
    'Insurance Carriers (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordOR([
        'insurance carrier',
        'insurance company',
        'life insurance',
        'property casualty',
        'health insurance',
        'insurance provider'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 13. RETAIL (median 3,018)
  results.push(await runQuery(
    'Retail (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordOR([
        'retail',
        'retailer',
        'e-commerce',
        'online retail',
        'omnichannel'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 14. HEALTHCARE (median 6,000)
  results.push(await runQuery(
    'Healthcare (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordOR([
        'healthcare',
        'health system',
        'hospital',
        'medical center',
        'health insurance'
      ])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(40)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY WITH SAMPLE COMPANIES');
  console.log('='.repeat(60));

  let smallSegments = 0;
  let midSegments = 0;
  let largeSegments = 0;
  let enterpriseSegments = 0;

  results.forEach((r, i) => {
    console.log(`\n${r.name}: ${r.totalCount.toLocaleString()}`);
    r.samples.forEach(s => {
      console.log(`  - ${s.name} (${s.domain}) [${s.size}]`);
    });

    // Tally by segment type
    if (i < 5) smallSegments += r.totalCount;
    else if (i < 8) midSegments += r.totalCount;
    else if (i < 10) largeSegments += r.totalCount;
    else enterpriseSegments += r.totalCount;
  });

  console.log('\n' + '='.repeat(60));
  console.log('SEGMENT TOTALS (with overlap)');
  console.log('='.repeat(60));
  console.log(`Small (Fintech/Insurtech/Crypto):    ${smallSegments.toLocaleString().padStart(8)}`);
  console.log(`Mid (Banking/Financial/Lending):     ${midSegments.toLocaleString().padStart(8)}`);
  console.log(`Large (Payments/Marketplace):        ${largeSegments.toLocaleString().padStart(8)}`);
  console.log(`Enterprise (Banks/Insurance/Retail): ${enterpriseSegments.toLocaleString().padStart(8)}`);
}

runAllQueries();
