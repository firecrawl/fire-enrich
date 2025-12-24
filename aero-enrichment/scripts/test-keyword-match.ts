import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

const marketplaceKeywords = [
  'marketplace', 'online marketplace', 'two-sided marketplace',
  'platform connecting', 'connects buyers and sellers',
  'ride-sharing', 'rideshare', 'food delivery', 'on-demand delivery',
  'gig economy', 'sharing economy'
];

async function checkCompanyKeywords(domain: string) {
  try {
    const result = await client.searchCompanyDB({
      filters: {
        filter_type: 'company_website_domain',
        type: '=',
        value: domain
      },
      limit: 1
    });

    if (result.companies.length === 0) {
      console.log(`${domain}: Not found`);
      return;
    }

    const c = result.companies[0];
    const description = (c.linkedin_company_description || '').toLowerCase();

    console.log(`\n=== ${c.company_name} (${domain}) ===`);
    console.log(`Industries: ${c.linkedin_industries?.join(', ')}`);

    console.log('\nKeyword matches:');
    for (const kw of marketplaceKeywords) {
      if (description.includes(kw.toLowerCase())) {
        console.log(`  ✓ "${kw}"`);
      }
    }

    // Check for partial matches
    console.log('\nPartial matches (checking individual words):');
    const checkWords = ['delivery', 'platform', 'host', 'guest', 'rental', 'booking', 'lodging'];
    for (const word of checkWords) {
      if (description.includes(word)) {
        console.log(`  ✓ "${word}"`);
      }
    }

    console.log('\nFull description:');
    console.log(c.linkedin_company_description);
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}

async function main() {
  // Check the main DoorDash
  await checkCompanyKeywords('careersatdoordash.com');
  await new Promise(r => setTimeout(r, 500));

  await checkCompanyKeywords('airbnb.com');
}

main().catch(console.error);
