import { CrustDataClient } from '../src/crustdata-client';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupCompetitors() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  const domains = [
    'uber.com', 'wellsfargo.com', 'doordash.com', 'lyft.com',
    'airbnb.com', 'ebay.com', 'coinbase.com', 'stripe.com',
    'paypal.com', 'robinhood.com', 'sofi.com'
  ];

  console.log('Looking up high-VIT companies to extract their competitor lists...\n');

  const allCompetitors = new Set<string>();

  for (const domain of domains) {
    await sleep(2500); // Rate limit
    try {
      const result = await client.searchCompanyDB({
        filters: {
          op: 'and',
          conditions: [
            { filter_type: 'company_website_domain', type: '=', value: domain }
          ]
        },
        limit: 1
      });

      if (result.companies && result.companies.length > 0) {
        const c = result.companies[0];
        console.log('='.repeat(70));
        console.log(`Company: ${c.company_name} (${c.company_website_domain})`);
        console.log(`Employees: ${c.employee_metrics?.latest_count}`);
        console.log(`Industries: ${JSON.stringify(c.linkedin_industries)}`);

        const competitorUrls: string[] = (c as any).competitor_websites || [];
        console.log(`Competitors (${competitorUrls.length}):`);

        for (const url of competitorUrls.slice(0, 20)) {
          console.log(`  - ${url}`);
          const cleanDomain = extractDomain(url);
          if (cleanDomain && !isJunkDomain(cleanDomain)) {
            allCompetitors.add(cleanDomain);
          }
        }
        console.log('');
      } else {
        console.log(`❌ Not found: ${domain}`);
      }
    } catch (e: any) {
      console.log(`Error for ${domain}:`, e.message);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Total unique competitor domains: ${allCompetitors.size}`);
  console.log('='.repeat(70));

  // Write to file
  const fs = require('fs');
  const sortedDomains = Array.from(allCompetitors).sort();
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/high-vit-api-competitors.txt',
    sortedDomains.join('\n')
  );
  console.log(`Wrote ${sortedDomains.length} domains to data/high-vit-api-competitors.txt`);
}

function extractDomain(url: string): string | null {
  try {
    let domain = url.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
    domain = domain.split('/')[0].split('?')[0];
    if (domain && domain.includes('.')) return domain;
    return null;
  } catch {
    return null;
  }
}

function isJunkDomain(domain: string): boolean {
  const junk = ['linkedin.com', 'facebook.com', 'twitter.com', 'bit.ly', 'linktr.ee', 'instagram.com', 'youtube.com'];
  return junk.includes(domain);
}

lookupCompetitors();
