import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

async function searchByName(name: string) {
  try {
    const result = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          {
            filter_type: 'linkedin_profile_name',
            type: '(.)',
            value: name
          },
          {
            filter_type: 'hq_location',
            type: '(.)',
            value: 'United States'
          }
        ]
      },
      limit: 5,
      sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }]
    });

    console.log(`\n=== Search: "${name}" ===`);
    for (const c of result.companies) {
      console.log(`\n${c.company_name} (${c.company_website_domain})`);
      console.log(`  Industries: ${c.linkedin_industries?.join(', ')}`);
      console.log(`  Size: ${c.employee_count_range}`);
      console.log(`  HQ: ${c.hq_location}`);
      console.log(`  Description (first 300 chars):`);
      console.log(`  "${(c.linkedin_company_description || '').substring(0, 300)}..."`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}

async function main() {
  await searchByName('DoorDash');
  await new Promise(r => setTimeout(r, 1000));
  await searchByName('Airbnb');
}

main().catch(console.error);
