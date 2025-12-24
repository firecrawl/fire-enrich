import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';

async function lookupGamingCompetitors() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  // Key gaming companies to lookup competitors for
  const gamingCompanies = [
    'draftkings.com',
    'fanduel.com',
    'pennentertainment.com',
    'underdogfantasy.com',
    'prizepicks.com',
    'betmgm.com',
    'caesars.com',
    'ballys.com',
    'pointsbet.com',
    'barstoolsportsbook.com'
  ];

  const allCompetitors = new Map<string, { name: string, domain: string, mentionedBy: string[] }>();

  for (const domain of gamingCompanies) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Looking up competitors for: ${domain}`);
    console.log('='.repeat(60));

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
        const company = result.companies[0];
        console.log(`Found: ${company.company_name}`);

        const competitors = company.competitors || [];
        console.log(`Competitors: ${competitors.length}`);

        for (const comp of competitors) {
          const compDomain = comp.company_website_domain?.toLowerCase();
          if (!compDomain) continue;

          if (allCompetitors.has(compDomain)) {
            allCompetitors.get(compDomain)!.mentionedBy.push(domain);
          } else {
            allCompetitors.set(compDomain, {
              name: comp.company_name || compDomain,
              domain: compDomain,
              mentionedBy: [domain]
            });
          }
          console.log(`  - ${comp.company_name} (${compDomain})`);
        }
      } else {
        console.log(`Not found: ${domain}`);
      }
    } catch (e: any) {
      console.log(`Error: ${e.message?.substring(0, 60)}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Convert to array and sort by mention count
  const competitorList = Array.from(allCompetitors.values())
    .sort((a, b) => b.mentionedBy.length - a.mentionedBy.length);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`ALL GAMING COMPETITORS (${competitorList.length} unique)`);
  console.log('='.repeat(70));

  for (const c of competitorList) {
    console.log(`${c.name.padEnd(40)} (${c.domain})`);
    console.log(`  Mentioned by: ${c.mentionedBy.join(', ')}`);
  }

  // Save to file
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/gaming-competitor-domains.json',
    JSON.stringify({
      sourceCompanies: gamingCompanies,
      competitors: competitorList
    }, null, 2)
  );

  console.log(`\nSaved ${competitorList.length} gaming competitors to data/gaming-competitor-domains.json`);
}

lookupGamingCompetitors();
