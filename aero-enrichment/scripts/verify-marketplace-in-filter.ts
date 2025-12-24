import { CrustDataClient } from '../src/crustdata-client';
import { TAMExpansionService } from '../src/tam-expansion-service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();
const service = new TAMExpansionService();

// Key marketplace companies to verify
const marketplaceCompanies = [
  { name: 'Uber', domain: 'uber.com' },
  { name: 'Airbnb', domain: 'airbnb.com' },
  { name: 'Lyft', domain: 'lyft.com' },
  { name: 'DoorDash', domain: 'doordash.com' },
  { name: 'Instacart', domain: 'instacart.com' },
  { name: 'Etsy', domain: 'etsy.com' },
  { name: 'Fiverr', domain: 'fiverr.com' },
  { name: 'Upwork', domain: 'upwork.com' },
  { name: 'Stripe', domain: 'stripe.com' },
  { name: 'Square', domain: 'squareup.com' },
  { name: 'Robinhood', domain: 'robinhood.com' },
  { name: 'Coinbase', domain: 'coinbase.com' }
];

async function checkCompanyInFilter(name: string, domain: string) {
  try {
    const filter = service.buildHighRecallFilter();

    const result = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          filter,
          { filter_type: 'company_website_domain', type: '=', value: domain }
        ]
      },
      limit: 1
    });

    if (result.companies.length > 0) {
      const c = result.companies[0];
      console.log(`✅ ${name} (${domain})`);
      console.log(`   Industries: ${c.linkedin_industries?.slice(0, 2).join(', ')}`);
      console.log(`   Size: ${c.employee_count_range}`);
      return true;
    } else {
      // Check if company exists but doesn't match filter
      const existsResult = await client.searchCompanyDB({
        filters: { filter_type: 'company_website_domain', type: '=', value: domain },
        limit: 1
      });

      if (existsResult.companies.length > 0) {
        const c = existsResult.companies[0];
        console.log(`❌ ${name} (${domain}) - NOT in filter`);
        console.log(`   Industries: ${c.linkedin_industries?.join(', ')}`);
        console.log(`   Size: ${c.employee_count_range}`);
        console.log(`   HQ: ${c.hq_location}`);
      } else {
        console.log(`⚠️  ${name} (${domain}) - Company not found in database`);
      }
      return false;
    }
  } catch (e: any) {
    console.log(`⚠️  ${name} (${domain}): Error - ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Verifying Marketplace Companies in TAM Filter ===\n');

  let captured = 0;
  let missed = 0;

  for (const company of marketplaceCompanies) {
    const inFilter = await checkCompanyInFilter(company.name, company.domain);
    if (inFilter) captured++;
    else missed++;
    console.log('');
    await new Promise(r => setTimeout(r, 1500)); // Rate limiting
  }

  console.log('=== Summary ===');
  console.log(`Captured: ${captured}/${marketplaceCompanies.length}`);
  console.log(`Missed: ${missed}/${marketplaceCompanies.length}`);
}

main().catch(console.error);
