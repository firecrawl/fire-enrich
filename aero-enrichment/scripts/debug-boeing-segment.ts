import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

async function main() {
  const result = await client.searchCompanyDB({
    filters: {
      filter_type: 'company_website_domain',
      type: '=',
      value: 'boeing.com'
    },
    limit: 1
  });

  const boeing = result.companies[0];
  const description = boeing.linkedin_company_description || '';
  const industries = boeing.linkedin_industries || [];

  console.log('=== Boeing Analysis ===\n');
  console.log(`Industries: ${industries.join(', ')}\n`);
  console.log('Full Description:');
  console.log(description);
  console.log('\n=== Keyword Matches ===\n');

  // All our keywords from all segments
  const allKeywords = [
    // Fintech
    'fintech', 'neobank', 'digital bank', 'challenger bank', 'banking as a service',
    // Payments
    'payment processing', 'payment platform', 'payment gateway', 'merchant services', 'card processing', 'card issuing',
    // Lending
    'lending platform', 'lender', 'loan origination', 'consumer lending', 'mortgage lender', 'auto lender', 'auto financing', 'mortgage company',
    // Insurtech
    'insurtech', 'insurance technology', 'digital insurance', 'insurance platform',
    // Crypto
    'cryptocurrency', 'crypto', 'digital asset', 'bitcoin', 'blockchain',
    // Wealth
    'wealth management', 'private wealth', 'high net worth', 'family office', 'asset management',
    // Tech Marketplaces
    'marketplace', 'two-sided marketplace', 'connects buyers', 'connects sellers',
    // Gig Economy
    'rideshare', 'ride-sharing', 'delivery platform', 'delivery app', 'on-demand', 'gig economy',
    // Vacation Rentals
    'vacation rental', 'short-term rental', 'home sharing', 'hosts and guests'
  ];

  const descLower = description.toLowerCase();
  for (const kw of allKeywords) {
    if (descLower.includes(kw.toLowerCase())) {
      console.log(`✓ MATCHED: "${kw}"`);
      // Show context
      const idx = descLower.indexOf(kw.toLowerCase());
      const start = Math.max(0, idx - 30);
      const end = Math.min(descLower.length, idx + kw.length + 30);
      console.log(`  Context: "...${description.substring(start, end)}..."`);
    }
  }

  // Also check industry matches
  console.log('\n=== Industry Matches ===\n');
  const industryFilters = [
    'Financial Services', 'Banking', 'Investment Banking', 'Insurance', 'Insurance Carriers',
    'Insurance Agencies and Brokerages', 'Investment Management',
    'Internet Marketplace Platforms', 'Software Development', 'Technology, Information and Internet',
    'Ground Passenger Transportation', 'Freight and Package Transportation'
  ];

  for (const ind of industryFilters) {
    if (industries.some(i => i.toLowerCase().includes(ind.toLowerCase()))) {
      console.log(`✓ MATCHED: "${ind}"`);
    }
  }
}

main().catch(console.error);
