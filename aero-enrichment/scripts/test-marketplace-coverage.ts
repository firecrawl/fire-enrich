import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

// Test specific marketplace companies
const marketplaceDomains = ["uber.com", "airbnb.com", "lyft.com", "doordash.com", "instacart.com", "etsy.com"];

async function searchByDomain(domain: string) {
  try {
    const result = await client.searchCompanyDB({
      filters: {
        filter_type: "company_website_domain",
        type: "=",
        value: domain
      },
      limit: 1
    });
    if (result.companies.length > 0) {
      const c = result.companies[0];
      console.log(`✅ ${domain}: ${c.company_name}`);
      console.log(`   Industries: ${c.linkedin_industries?.join(", ") || 'N/A'}`);
      console.log(`   Size: ${c.employee_count_range}`);
      console.log(`   HQ: ${c.hq_location}`);
      console.log('');
    } else {
      console.log(`❌ ${domain}: Not found\n`);
    }
  } catch (e: any) {
    console.log(`❌ ${domain}: Error - ${e.message}\n`);
  }
}

async function main() {
  console.log('=== Testing Marketplace Company Coverage ===\n');

  for (const domain of marketplaceDomains) {
    await searchByDomain(domain);
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }
}

main().catch(console.error);
