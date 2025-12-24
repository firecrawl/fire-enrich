import { CrustDataClient } from '../src/crustdata-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();

// Companies to debug
const companies = [
  'boeing.com',
  'emerson.com',
  'marriott.com',
  'royalmail.com',
  'virgin.com',
  'sky.com',
  'globallogic.com'
];

// Our segment keywords and industries
const segments = {
  'Fintech': {
    industries: ['Financial Services', 'Banking', 'Investment Banking'],
    keywords: ['fintech', 'neobank', 'digital bank', 'challenger bank', 'banking as a service']
  },
  'Payments': {
    industries: ['Financial Services', 'Banking'],
    keywords: ['payment processing', 'payment platform', 'payment gateway', 'merchant services', 'card processing', 'card issuing']
  },
  'Lending': {
    industries: ['Financial Services', 'Banking'],
    keywords: ['lending platform', 'lender', 'loan origination', 'consumer lending', 'mortgage lender', 'auto lender', 'auto financing', 'mortgage company']
  },
  'Insurtech': {
    industries: ['Insurance', 'Insurance Carriers'],
    keywords: ['insurtech', 'insurance technology', 'digital insurance', 'insurance platform']
  },
  'Insurance Carriers (industry-only)': {
    industries: ['Insurance Carriers', 'Insurance Agencies and Brokerages'],
    keywords: null
  },
  'Crypto': {
    industries: ['Financial Services', 'Banking', 'Investment Management'],
    keywords: ['cryptocurrency', 'crypto', 'digital asset', 'bitcoin', 'blockchain']
  },
  'Banking (industry-only)': {
    industries: ['Banking', 'Investment Banking'],
    keywords: null
  },
  'Wealth Management': {
    industries: ['Investment Management', 'Financial Services'],
    keywords: ['wealth management', 'private wealth', 'high net worth', 'family office', 'asset management']
  },
  'Internet Marketplaces (industry-only)': {
    industries: ['Internet Marketplace Platforms'],
    keywords: null
  },
  'Tech Marketplaces': {
    industries: ['Software Development', 'Technology, Information and Internet'],
    keywords: ['marketplace', 'two-sided marketplace', 'connects buyers', 'connects sellers']
  },
  'Gig Economy': {
    industries: ['Ground Passenger Transportation', 'Freight and Package Transportation', 'Software Development'],
    keywords: ['rideshare', 'ride-sharing', 'delivery platform', 'delivery app', 'on-demand', 'gig economy']
  },
  'Vacation Rentals': {
    industries: null,
    keywords: ['vacation rental', 'short-term rental', 'home sharing', 'hosts and guests']
  }
};

async function debugCompany(domain: string) {
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
      console.log(`${domain}: Not found\n`);
      return;
    }

    const c = result.companies[0];
    const description = (c.linkedin_company_description || '').toLowerCase();
    const industries = c.linkedin_industries || [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${c.company_name} (${domain})`);
    console.log(`Industries: ${industries.join(', ')}`);
    console.log(`${'='.repeat(60)}`);

    // Check which segments match
    for (const [segmentName, segment] of Object.entries(segments)) {
      const industryMatch = segment.industries
        ? segment.industries.some(ind =>
            industries.some(i => i.toLowerCase().includes(ind.toLowerCase()))
          )
        : true; // No industry filter means auto-pass

      const keywordMatch = segment.keywords
        ? segment.keywords.some(kw => description.includes(kw.toLowerCase()))
        : true; // No keyword filter means auto-pass

      // For industry+keyword segments, both must match
      // For industry-only segments, only industry must match
      // For keyword-only segments, only keyword must match
      let matches = false;
      if (segment.industries && segment.keywords) {
        matches = industryMatch && keywordMatch;
      } else if (segment.industries) {
        matches = industryMatch;
      } else if (segment.keywords) {
        matches = keywordMatch;
      }

      if (matches) {
        const reason = [];
        if (industryMatch && segment.industries) {
          const matchedInd = segment.industries.filter(ind =>
            industries.some(i => i.toLowerCase().includes(ind.toLowerCase()))
          );
          reason.push(`Industry: ${matchedInd.join(', ')}`);
        }
        if (keywordMatch && segment.keywords) {
          const matchedKw = segment.keywords.filter(kw => description.includes(kw.toLowerCase()));
          reason.push(`Keywords: ${matchedKw.join(', ')}`);
        }
        console.log(`  ✓ ${segmentName}: ${reason.join(' | ')}`);
      }
    }
  } catch (e: any) {
    console.log(`${domain}: Error - ${e.message}`);
  }
}

async function main() {
  console.log('=== Debugging False Positive Matches ===');

  for (const domain of companies) {
    await debugCompany(domain);
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
