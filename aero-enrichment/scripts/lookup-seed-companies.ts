import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupSeedCompanies() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  // High-VIT seed companies
  const seedDomains = [
    'uber.com', 'wellsfargo.com', 'airbnb.com', 'paypal.com', 'hyatt.com',
    'doordash.com', 'lyft.com', 'coinbase.com', 'stripe.com', 'ebay.com',
    'chime.com', 'robinhood.com', 'sofi.com', 'affirm.com', 'klarna.com',
    'instacart.com', 'grubhub.com', 'venmo.com', 'cash.app', 'wise.com'
  ];

  console.log(`Looking up ${seedDomains.length} high-VIT seed companies...\n`);

  const allCompetitors: Map<string, { domain: string, mentionedBy: string[] }> = new Map();
  const seedCompanies: any[] = [];

  for (const domain of seedDomains) {
    await sleep(2500);

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
        const employees = c.employee_metrics?.latest_count || 0;
        const competitorUrls: string[] = (c as any).competitor_websites || [];

        seedCompanies.push({
          name: c.company_name,
          domain: c.company_website_domain,
          employees,
          industries: c.linkedin_industries,
          competitorCount: competitorUrls.length
        });

        console.log(`✅ ${c.company_name} (${domain}) - ${employees} employees, ${competitorUrls.length} competitors`);

        // Collect competitors
        for (const url of competitorUrls) {
          const compDomain = extractDomain(url);
          if (compDomain && !isJunkDomain(compDomain)) {
            if (!allCompetitors.has(compDomain)) {
              allCompetitors.set(compDomain, { domain: compDomain, mentionedBy: [] });
            }
            allCompetitors.get(compDomain)!.mentionedBy.push(c.company_name);
          }
        }
      } else {
        console.log(`❌ Not found: ${domain}`);
      }
    } catch (e: any) {
      console.log(`Error for ${domain}:`, e.message?.substring(0, 60));
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`SEED COMPANIES SUMMARY`);
  console.log('='.repeat(70));

  for (const s of seedCompanies.sort((a, b) => b.employees - a.employees)) {
    console.log(`${s.name.padEnd(25)} ${String(s.employees).padStart(8)} employees  ${s.competitorCount} competitors`);
  }

  console.log(`\nTotal unique competitor domains: ${allCompetitors.size}`);

  // Save all competitors with their sources
  const competitorList = Array.from(allCompetitors.values())
    .sort((a, b) => b.mentionedBy.length - a.mentionedBy.length);

  console.log(`\n=== Top 30 Most Referenced Competitors ===`);
  for (const c of competitorList.slice(0, 30)) {
    console.log(`  ${c.domain} (mentioned by ${c.mentionedBy.length}: ${c.mentionedBy.slice(0, 3).join(', ')})`);
  }

  // Save to file
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/seed-company-competitors-raw.json',
    JSON.stringify({ seedCompanies, competitors: competitorList }, null, 2)
  );

  console.log(`\nSaved to data/seed-company-competitors-raw.json`);
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
  const junk = ['linkedin.com', 'facebook.com', 'twitter.com', 'bit.ly', 'linktr.ee',
                'instagram.com', 'youtube.com', 'google.com', 'apple.com'];
  return junk.includes(domain);
}

lookupSeedCompanies();
