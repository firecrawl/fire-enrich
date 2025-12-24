#!/usr/bin/env npx tsx
/**
 * TAM Candidate Queries - Using linkedin_industries + description keywords
 *
 * Strategy: Combine industry classification with description keywords for high precision
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.CRUSTDATA_API_KEY;

interface QueryResult {
  id: string;
  name: string;
  description: string;
  filters: any;
  totalCount: number;
  samples: { name: string; domain: string; size: string; industries: string[] }[];
}

const results: QueryResult[] = [];

async function runQuery(
  id: string,
  name: string,
  description: string,
  filters: any
): Promise<QueryResult> {
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
        limit: 10,
        sorts: [{ column: 'crunchbase_total_investment_usd', order: 'desc' }] // Sort by funding
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`  Error: ${response.status}`);
      return { id, name, description, filters, totalCount: -1, samples: [] };
    }

    const data = await response.json() as any;
    return {
      id,
      name,
      description,
      filters,
      totalCount: data.total_count || 0,
      samples: data.companies?.slice(0, 5).map((c: any) => ({
        name: c.company_name,
        domain: c.company_website_domain || '',
        size: c.employee_count_range || '',
        industries: c.linkedin_industries || []
      })) || []
    };
  } catch (error: any) {
    return { id, name, description, filters, totalCount: -1, samples: [] };
  }
}

// Helper functions
function industryFilter(industries: string[]) {
  return {
    op: 'or',
    conditions: industries.map(ind => ({
      filter_type: 'linkedin_industries',
      type: '(.)',
      value: ind
    }))
  };
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
  console.log('=== TAM Candidate Queries (US Only) ===\n');
  console.log('Running queries with linkedin_industries + description keywords...\n');

  const usLocation = { filter_type: 'hq_location', type: '(.)', value: 'United States' };

  // Size buckets
  const size11Plus = { filter_type: 'employee_count_range', type: 'in', value: ['11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size51Plus = { filter_type: 'employee_count_range', type: 'in', value: ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };
  const size201Plus = { filter_type: 'employee_count_range', type: 'in', value: ['201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] };

  // =============================================================================
  // FINTECH SEGMENT
  // =============================================================================
  console.log('--- FINTECH ---');

  results.push(await runQuery(
    'FT-1',
    'Fintech: Industry + Keywords (11+)',
    'Financial Services industry AND fintech/neobank keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      industryFilter(['Financial Services', 'Banking', 'Investment Banking']),
      keywordFilter(['fintech', 'neobank', 'digital bank', 'challenger bank', 'banking as a service'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'FT-2',
    'Fintech: Strict Keywords Only (11+)',
    'Very specific fintech keywords without industry filter',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['fintech company', 'fintech startup', 'fintech platform', 'neobank', 'challenger bank'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'FT-3',
    'Fintech: Tech + Financial Industry (11+)',
    'Technology industry AND financial keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      industryFilter(['Technology, Information and Internet', 'Software Development', 'IT Services and IT Consulting']),
      keywordFilter(['financial', 'banking', 'payments', 'lending'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // PAYMENTS SEGMENT
  // =============================================================================
  console.log('\n--- PAYMENTS ---');

  results.push(await runQuery(
    'PAY-1',
    'Payments: Industry + Keywords (51+)',
    'Financial Services industry AND payment keywords',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      industryFilter(['Financial Services', 'Banking']),
      keywordFilter(['payment processing', 'payment platform', 'payment gateway', 'merchant services', 'card processing'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'PAY-2',
    'Payments: Strict Keywords Only (51+)',
    'Very specific payment company keywords',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      keywordFilter(['payment processor', 'payment company', 'payments platform', 'merchant acquirer', 'card network'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // LENDING SEGMENT
  // =============================================================================
  console.log('\n--- LENDING ---');

  results.push(await runQuery(
    'LEND-1',
    'Lending: Industry + Keywords (11+)',
    'Financial Services AND lending platform keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      industryFilter(['Financial Services', 'Banking', 'Consumer Services']),
      keywordFilter(['lending platform', 'online lender', 'consumer lending', 'alternative lending', 'loan origination'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'LEND-2',
    'BNPL: Strict Keywords (11+)',
    'Very specific BNPL keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['buy now pay later', 'bnpl', 'point of sale financing', 'installment payments', 'pay in 4'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'LEND-3',
    'Mortgage/Auto Lending (51+)',
    'Financial Services AND mortgage/auto keywords',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      industryFilter(['Financial Services', 'Banking']),
      keywordFilter(['mortgage lender', 'mortgage company', 'auto lender', 'auto financing', 'vehicle financing'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // INSURTECH SEGMENT
  // =============================================================================
  console.log('\n--- INSURTECH ---');

  results.push(await runQuery(
    'INS-1',
    'Insurtech: Industry + Keywords (11+)',
    'Insurance industry AND tech keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      industryFilter(['Insurance', 'Insurance Carriers']),
      keywordFilter(['insurtech', 'insurance technology', 'digital insurance', 'insurance platform', 'insurance startup'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'INS-2',
    'Insurtech: Strict Keywords Only (11+)',
    'Very specific insurtech keywords without industry filter',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['insurtech', 'insurance technology company', 'digital insurance platform', 'insurance startup'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'INS-3',
    'Insurance Carriers (201+)',
    'Insurance industry AND carrier keywords',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      industryFilter(['Insurance', 'Insurance Carriers', 'Insurance Agencies and Brokerages']),
      keywordFilter(['insurance carrier', 'insurance company', 'insurance provider', 'underwriting'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // CRYPTO/BLOCKCHAIN SEGMENT
  // =============================================================================
  console.log('\n--- CRYPTO/BLOCKCHAIN ---');

  results.push(await runQuery(
    'CRYPTO-1',
    'Crypto: Industry + Keywords (11+)',
    'Financial Services AND crypto keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      industryFilter(['Financial Services', 'Banking', 'Investment Management']),
      keywordFilter(['cryptocurrency', 'crypto', 'digital asset', 'bitcoin', 'blockchain'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'CRYPTO-2',
    'Crypto: Strict Keywords Only (11+)',
    'Very specific crypto company keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['crypto exchange', 'cryptocurrency exchange', 'crypto custody', 'digital asset platform', 'defi protocol'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // BANKING SEGMENT
  // =============================================================================
  console.log('\n--- BANKING ---');

  results.push(await runQuery(
    'BANK-1',
    'Banks: Industry Filter (201+)',
    'Banking industry classification',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      industryFilter(['Banking', 'Investment Banking'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'BANK-2',
    'Credit Unions (51+)',
    'Banking industry AND credit union keywords',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      industryFilter(['Banking']),
      keywordFilter(['credit union', 'member-owned', 'cooperative bank'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'BANK-3',
    'Community/Regional Banks (201+)',
    'Banking AND community/regional keywords',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      industryFilter(['Banking']),
      keywordFilter(['community bank', 'regional bank', 'local bank', 'commercial bank'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // WEALTH/ASSET MANAGEMENT
  // =============================================================================
  console.log('\n--- WEALTH/ASSET MANAGEMENT ---');

  results.push(await runQuery(
    'WM-1',
    'Wealth Management (51+)',
    'Investment Management industry AND wealth keywords',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      industryFilter(['Investment Management', 'Financial Services']),
      keywordFilter(['wealth management', 'private wealth', 'high net worth', 'family office'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'WM-2',
    'Asset Management (51+)',
    'Investment Management AND asset management keywords',
    { op: 'and', conditions: [
      usLocation,
      size51Plus,
      industryFilter(['Investment Management', 'Venture Capital and Private Equity Principals']),
      keywordFilter(['asset management', 'investment management', 'portfolio management', 'fund management'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // DIGITAL MARKETPLACE / E-COMMERCE
  // =============================================================================
  console.log('\n--- MARKETPLACE/E-COMMERCE ---');

  results.push(await runQuery(
    'MKT-1',
    'Marketplace: Industry + Keywords (201+)',
    'Technology industry AND marketplace keywords',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      industryFilter(['Technology, Information and Internet', 'Software Development']),
      keywordFilter(['marketplace', 'two-sided platform', 'e-commerce platform', 'online marketplace'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'MKT-2',
    'E-commerce/Retail Tech (201+)',
    'Retail industry AND e-commerce keywords',
    { op: 'and', conditions: [
      usLocation,
      size201Plus,
      industryFilter(['Retail', 'Consumer Services', 'Technology, Information and Internet']),
      keywordFilter(['e-commerce', 'online retail', 'digital commerce', 'omnichannel'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // GAMBLING / GAMING
  // =============================================================================
  console.log('\n--- GAMBLING/GAMING ---');

  results.push(await runQuery(
    'GAMB-1',
    'Sports Betting/iGaming (11+)',
    'Entertainment/Gaming industry AND betting keywords',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      industryFilter(['Entertainment Providers', 'Gambling Facilities and Casinos']),
      keywordFilter(['sports betting', 'online gambling', 'igaming', 'sportsbook', 'casino'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  results.push(await runQuery(
    'GAMB-2',
    'Gambling: Strict Keywords (11+)',
    'Specific gambling company keywords only',
    { op: 'and', conditions: [
      usLocation,
      size11Plus,
      keywordFilter(['sports betting company', 'online sportsbook', 'igaming platform', 'online casino', 'fantasy sports platform'])
    ]}
  ));
  console.log(`  ${results[results.length-1].id}: ${results[results.length-1].totalCount.toLocaleString()}`);

  // =============================================================================
  // WRITE RESULTS TO JSON
  // =============================================================================
  console.log('\n\nWriting results to JSON...');
  await fs.writeFile(
    'data/tam-candidate-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('Saved to data/tam-candidate-results.json');

  // =============================================================================
  // GENERATE MARKDOWN SUMMARY
  // =============================================================================
  let markdown = `# TAM Candidate Query Results - US Only

Generated: ${new Date().toISOString()}

## Summary

| ID | Segment | Total Count | Top Sample Companies |
|----|---------|-------------|---------------------|
`;

  results.forEach(r => {
    const samples = r.samples.slice(0, 3).map(s => s.name).join(', ') || 'N/A';
    markdown += `| ${r.id} | ${r.name} | ${r.totalCount.toLocaleString()} | ${samples} |\n`;
  });

  markdown += `

## Detailed Results

`;

  results.forEach(r => {
    markdown += `### ${r.id}: ${r.name}

**Description:** ${r.description}

**Total Count:** ${r.totalCount.toLocaleString()}

**Sample Companies:**
`;
    if (r.samples.length > 0) {
      r.samples.forEach(s => {
        markdown += `- **${s.name}** (${s.domain}) - ${s.size}
  - Industries: ${s.industries.join(', ') || 'N/A'}
`;
      });
    } else {
      markdown += `- No samples available\n`;
    }
    markdown += '\n';
  });

  // Recommendations section
  markdown += `## Recommendations

### High Precision Queries (Recommended for Tier A targeting)

Based on the results, the following queries show the best precision (relevant sample companies):

| Segment | Recommended Query | Est. Count | Notes |
|---------|------------------|------------|-------|
`;

  // Add recommendations based on results
  const recommendations = [
    { segment: 'Fintech', queryId: 'FT-1', notes: 'Industry + keywords provides good balance' },
    { segment: 'Payments', queryId: 'PAY-1', notes: 'Financial Services + payment keywords' },
    { segment: 'Lending', queryId: 'LEND-1', notes: 'Industry filter essential to avoid false positives' },
    { segment: 'Insurtech', queryId: 'INS-1', notes: 'Insurance industry + tech keywords' },
    { segment: 'Crypto', queryId: 'CRYPTO-2', notes: 'Strict keywords best for precision' },
    { segment: 'Banking', queryId: 'BANK-1', notes: 'Industry filter sufficient' },
    { segment: 'Wealth Mgmt', queryId: 'WM-1', notes: 'Investment Management industry + keywords' },
    { segment: 'Marketplace', queryId: 'MKT-1', notes: 'Tech industry + marketplace keywords' },
    { segment: 'Gambling', queryId: 'GAMB-1', notes: 'Entertainment industry + betting keywords' },
  ];

  recommendations.forEach(rec => {
    const result = results.find(r => r.id === rec.queryId);
    if (result) {
      markdown += `| ${rec.segment} | ${rec.queryId} | ${result.totalCount.toLocaleString()} | ${rec.notes} |\n`;
    }
  });

  markdown += `

### Combined TAM Estimate

Using the recommended queries with de-duplication, estimated US TAM:

`;

  let estimatedTotal = 0;
  recommendations.forEach(rec => {
    const result = results.find(r => r.id === rec.queryId);
    if (result && result.totalCount > 0) {
      estimatedTotal += result.totalCount;
    }
  });

  markdown += `- **Raw sum (with overlap):** ~${estimatedTotal.toLocaleString()} companies
- **Estimated unique (after de-dup):** ~${Math.round(estimatedTotal * 0.6).toLocaleString()} companies (assuming ~40% overlap)

### Next Steps

1. **Validate sample quality** - Review the sample companies in each segment
2. **Adjust employee thresholds** - Based on your Tier A median employee counts
3. **Run full extraction** - Use recommended queries to build TAM list
4. **De-duplicate** - Against existing 22.5K accounts
`;

  await fs.writeFile('data/TAM-CANDIDATE-QUERIES-SUMMARY.md', markdown);
  console.log('Saved summary to data/TAM-CANDIDATE-QUERIES-SUMMARY.md');
}

runAllQueries();
