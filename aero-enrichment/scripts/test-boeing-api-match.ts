import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

async function testFilter(name: string, filter: any) {
  try {
    const result = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          { filter_type: 'company_website_domain', type: '=', value: 'boeing.com' },
          filter
        ]
      },
      limit: 1
    });

    if (result.companies.length > 0) {
      console.log(`✓ ${name}: MATCHES`);
    } else {
      console.log(`✗ ${name}: no match`);
    }
  } catch (e: any) {
    console.log(`✗ ${name}: error - ${e.message}`);
  }
}

async function main() {
  console.log('=== Testing which segment Boeing matches via API ===\n');

  // Test each segment individually
  await testFilter('Fintech (industry+keyword)', {
    op: 'and',
    conditions: [
      {
        op: 'or',
        conditions: [
          { filter_type: 'linkedin_industries', type: '(.)', value: 'Financial Services' },
          { filter_type: 'linkedin_industries', type: '(.)', value: 'Banking' }
        ]
      },
      {
        op: 'or',
        conditions: [
          { filter_type: 'linkedin_company_description', type: '(.)', value: 'fintech' }
        ]
      }
    ]
  });

  await testFilter('Insurance Carriers (industry-only)', {
    op: 'or',
    conditions: [
      { filter_type: 'linkedin_industries', type: '(.)', value: 'Insurance Carriers' },
      { filter_type: 'linkedin_industries', type: '(.)', value: 'Insurance Agencies and Brokerages' }
    ]
  });

  await testFilter('Banking (industry-only)', {
    op: 'or',
    conditions: [
      { filter_type: 'linkedin_industries', type: '(.)', value: 'Banking' },
      { filter_type: 'linkedin_industries', type: '(.)', value: 'Investment Banking' }
    ]
  });

  await testFilter('Internet Marketplaces (industry-only)', {
    filter_type: 'linkedin_industries',
    type: '(.)',
    value: 'Internet Marketplace Platforms'
  });

  await testFilter('Gig Economy (industry+keyword)', {
    op: 'and',
    conditions: [
      {
        op: 'or',
        conditions: [
          { filter_type: 'linkedin_industries', type: '(.)', value: 'Ground Passenger Transportation' },
          { filter_type: 'linkedin_industries', type: '(.)', value: 'Freight and Package Transportation' },
          { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' }
        ]
      },
      {
        op: 'or',
        conditions: [
          { filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand' }
        ]
      }
    ]
  });

  await testFilter('Vacation Rentals (keyword-only)', {
    op: 'or',
    conditions: [
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'vacation rental' },
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'short-term rental' },
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'home sharing' },
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'hosts and guests' }
    ]
  });

  // Test individual problematic keywords
  console.log('\n=== Testing individual keywords ===\n');

  const keywords = ['on-demand', 'lender', 'asset management', 'marketplace', 'digital'];
  for (const kw of keywords) {
    await testFilter(`Keyword: "${kw}"`, {
      filter_type: 'linkedin_company_description',
      type: '(.)',
      value: kw
    });
  }
}

main().catch(console.error);
