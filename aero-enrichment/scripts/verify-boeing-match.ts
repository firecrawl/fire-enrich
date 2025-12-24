import { CrustDataClient } from '../src/crustdata-client';
import { TAMExpansionService } from '../src/tam-expansion-service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

async function main() {
  // Get Boeing's details
  console.log('=== Getting Boeing details ===\n');
  const boeingResult = await client.searchCompanyDB({
    filters: {
      filter_type: 'company_website_domain',
      type: '=',
      value: 'boeing.com'
    },
    limit: 1
  });

  if (boeingResult.companies.length > 0) {
    const boeing = boeingResult.companies[0];
    console.log(`Company: ${boeing.company_name}`);
    console.log(`Industries: ${boeing.linkedin_industries?.join(', ')}`);
    console.log(`Description (first 500 chars):`);
    console.log(boeing.linkedin_company_description?.substring(0, 500));
    console.log('');
  }

  // Now check if Boeing appears in our filter results
  console.log('\n=== Checking if Boeing appears in filter results ===\n');

  const service = new TAMExpansionService();
  const filter = service.buildHighRecallFilter();

  // Search with Boeing's domain as additional filter
  const result = await client.searchCompanyDB({
    filters: {
      op: 'and',
      conditions: [
        filter,
        {
          filter_type: 'company_website_domain',
          type: '=',
          value: 'boeing.com'
        }
      ]
    },
    limit: 1
  });

  if (result.companies.length > 0) {
    console.log('❌ Boeing DOES match our filter (false positive!)');
    console.log('This means something in our filter is too broad.');
  } else {
    console.log('✅ Boeing does NOT match our filter');
    console.log('The issue might be with how results are being sorted/returned.');
  }

  // Let's also check the top 10 results to see what's actually matching
  console.log('\n=== Top 10 companies from filter ===\n');
  const topResults = await client.searchCompanyDB({
    filters: filter,
    limit: 10,
    sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }]
  });

  for (const c of topResults.companies) {
    console.log(`${c.company_name} (${c.company_website_domain})`);
    console.log(`  Industries: ${c.linkedin_industries?.join(', ')}`);
    console.log('');
  }
}

main().catch(console.error);
