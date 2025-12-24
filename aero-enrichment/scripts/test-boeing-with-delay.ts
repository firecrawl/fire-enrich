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
      return true;
    } else {
      console.log(`✗ ${name}: no match`);
      return false;
    }
  } catch (e: any) {
    console.log(`✗ ${name}: error - ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Testing individual keywords that might match Boeing ===\n');

  // Wait for rate limit to clear
  await new Promise(r => setTimeout(r, 3000));

  // Test likely keywords from Boeing's description
  const keywords = [
    'global',
    'solutions',
    'value',
    'customers',
    'industry',
    'exporter',
    'opportunity',
    'community',
    'integrity',
    'aerospace'
  ];

  for (const kw of keywords) {
    await testFilter(`Keyword: "${kw}"`, {
      filter_type: 'linkedin_company_description',
      type: '(.)',
      value: kw
    });
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== Testing Vacation Rentals segment ===\n');
  await testFilter('Vacation Rentals (keyword-only)', {
    op: 'or',
    conditions: [
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'vacation rental' },
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'short-term rental' },
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'home sharing' },
      { filter_type: 'linkedin_company_description', type: '(.)', value: 'hosts and guests' }
    ]
  });
}

main().catch(console.error);
