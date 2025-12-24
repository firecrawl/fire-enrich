#!/usr/bin/env npx tsx
/**
 * TAM Segment Analysis v2 - Refined keywords for higher precision
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.CRUSTDATA_API_KEY;

interface QueryResult {
  name: string;
  totalCount: number;
  sampleCompanies: { name: string; domain: string }[];
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
      return { name, totalCount: -1, sampleCompanies: [] };
    }

    const data = await response.json() as any;
    return {
      name,
      totalCount: data.total_count || 0,
      sampleCompanies: data.companies?.slice(0, 3).map((c: any) => ({
        name: c.company_name,
        domain: c.company_website_domain || ''
      })) || []
    };
  } catch (error: any) {
    return { name, totalCount: -1, sampleCompanies: [] };
  }
}

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
  console.log('=== TAM Segment Analysis v2 (US Only - Refined Keywords) ===\n');

  const results: QueryResult[] = [];
  const usLocation = { filter_type: 'hq_location', type: '(.)', value: 'United States' };

  // Size buckets
  const size1000Plus = { filter_type: 'employee_count_range', type: 'in', value: ['1001-5000', '5001-10000', '10001+'] };
  const size201Plus = { filter_type: 'employee_count_range', type: 'in', value: ['201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size51Plus = { filter_type: 'employee_count_range', type: 'in', value: ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size11Plus = { filter_type: 'employee_count_range', type: 'in', value: ['11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };

  // ===== TIER A+ STRICT QUERIES =====
  console.log('--- TIER A+ STRICT (High Precision) ---\n');

  // 1. Large Banks & Financial Institutions (1000+)
  results.push(await runQuery(
    'Banks & FIs (1000+)',
    { op: 'and', conditions: [
      usLocation,
      size1000Plus,
      keywordFilter(['commercial bank', 'retail banking', 'investment bank', 'credit union', 'financial institution'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 2. Insurance Carriers (201+)
  results.push(await runQuery(
    'Insurance Carriers (201+)',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      keywordFilter(['insurance carrier', 'insurance company', 'insurance provider', 'property and casualty', 'life insurance'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 3. Payments Companies (201+) - specific
  results.push(await runQuery(
    'Payments (201+)',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      keywordFilter(['payment processing', 'payment platform', 'merchant acquiring', 'card network', 'payment gateway'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 4. Wealth/Asset Management (51+)
  results.push(await runQuery(
    'Wealth/Asset Mgmt (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordFilter(['wealth management', 'asset management', 'investment management', 'portfolio management', 'hedge fund'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // ===== FINTECH SPECIFIC =====
  console.log('\n--- FINTECH SPECIFIC (11+) ---\n');

  // 5. Pure Fintech/Neobanks
  results.push(await runQuery(
    'Fintech/Neobanks (11+)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['fintech', 'neobank', 'challenger bank', 'digital bank', 'banking as a service', 'baas'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 6. Lending Platforms (specific)
  results.push(await runQuery(
    'Lending Platforms (11+)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['lending platform', 'loan origination', 'consumer lending', 'alternative lending', 'online lender'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 7. BNPL Specific
  results.push(await runQuery(
    'BNPL (11+)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['buy now pay later', 'bnpl', 'point of sale lending', 'installment payment'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 8. Card Issuing / Embedded Finance
  results.push(await runQuery(
    'Card Issuing/Embedded (11+)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['card issuing', 'embedded finance', 'card program', 'issuer processor', 'banking infrastructure'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 9. Crypto/Digital Assets
  results.push(await runQuery(
    'Crypto/Digital Assets (11+)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['cryptocurrency exchange', 'digital asset', 'crypto custody', 'blockchain platform', 'defi protocol'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // 10. Insurtech
  results.push(await runQuery(
    'Insurtech (11+)',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['insurtech', 'insurance technology', 'digital insurance', 'insurance platform'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // ===== HIGH COVERAGE QUERIES =====
  console.log('\n--- HIGH COVERAGE (Broader) ---\n');

  // 11. All Financial Services (51+)
  results.push(await runQuery(
    'Financial Services Broad (51+)',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordFilter(['financial services', 'financial technology', 'banking', 'insurance', 'lending', 'payments'])
    ]}
  ));
  console.log(`${results[results.length-1].name.padEnd(35)} ${results[results.length-1].totalCount.toLocaleString().padStart(8)}`);

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(55));
  console.log('DETAILED RESULTS WITH SAMPLES');
  console.log('='.repeat(55));

  let tierAStrict = 0;
  let fintechSpecific = 0;

  results.forEach((r, i) => {
    console.log(`\n${r.name}: ${r.totalCount.toLocaleString()}`);
    if (r.sampleCompanies.length > 0) {
      r.sampleCompanies.forEach(c => {
        console.log(`  - ${c.name} (${c.domain})`);
      });
    }

    // Tally
    if (i < 4) tierAStrict += r.totalCount;
    else if (i < 10) fintechSpecific += r.totalCount;
  });

  console.log('\n' + '='.repeat(55));
  console.log('TOTALS (with overlap between segments)');
  console.log('='.repeat(55));
  console.log(`Tier A+ Strict (1-4):              ${tierAStrict.toLocaleString().padStart(8)}`);
  console.log(`Fintech Specific (5-10):           ${fintechSpecific.toLocaleString().padStart(8)}`);
  console.log(`High Coverage Broad (11):          ${results[10]?.totalCount.toLocaleString().padStart(8) || 'N/A'}`);
}

runAllQueries();
