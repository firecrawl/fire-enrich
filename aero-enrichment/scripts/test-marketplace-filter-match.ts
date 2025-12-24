import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

// Test if marketplace companies match our filter
const testDomains = ["uber.com", "airbnb.com", "lyft.com", "doordash.com", "instacart.com", "etsy.com"];

async function checkFilterMatch(domain: string) {
  try {
    // First get the company info
    const result = await client.searchCompanyDB({
      filters: {
        filter_type: "company_website_domain",
        type: "=",
        value: domain
      },
      limit: 1
    });

    if (result.companies.length === 0) {
      console.log(`❌ ${domain}: Not found`);
      return;
    }

    const c = result.companies[0];
    const description = c.linkedin_company_description || '';
    const industries = c.linkedin_industries || [];

    // Check if it would match our filters
    const marketplaceKeywords = [
      'marketplace', 'online marketplace', 'two-sided marketplace',
      'platform connecting', 'connects buyers and sellers',
      'ride-sharing', 'rideshare', 'food delivery', 'on-demand delivery',
      'gig economy', 'sharing economy'
    ];

    const marketplaceIndustries = [
      'Internet Marketplace Platforms',
      'Ground Passenger Transportation',
      'Freight and Package Transportation'
    ];

    const matchedKeywords = marketplaceKeywords.filter(kw =>
      description.toLowerCase().includes(kw.toLowerCase())
    );

    const matchedIndustries = marketplaceIndustries.filter(ind =>
      industries.some(i => i.toLowerCase().includes(ind.toLowerCase()))
    );

    const wouldMatch = matchedKeywords.length > 0 || matchedIndustries.length > 0;

    console.log(`${wouldMatch ? '✅' : '❌'} ${c.company_name} (${domain})`);
    console.log(`   Industries: ${industries.join(', ')}`);
    console.log(`   Size: ${c.employee_count_range}`);
    console.log(`   HQ: ${c.hq_location}`);
    if (matchedIndustries.length > 0) {
      console.log(`   ✓ Industry match: ${matchedIndustries.join(', ')}`);
    }
    if (matchedKeywords.length > 0) {
      console.log(`   ✓ Keyword match: ${matchedKeywords.join(', ')}`);
    }
    if (!wouldMatch) {
      console.log(`   ✗ No match - first 200 chars of description:`);
      console.log(`     "${description.substring(0, 200)}..."`);
    }
    console.log('');
  } catch (e: any) {
    console.log(`❌ ${domain}: Error - ${e.message}\n`);
  }
}

async function main() {
  console.log('=== Testing if Marketplace Companies Match Our Filter ===\n');

  for (const domain of testDomains) {
    await checkFilterMatch(domain);
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
