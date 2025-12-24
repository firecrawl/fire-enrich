import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function filterCompetitorsBySize() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  // Load competitor data
  const data = JSON.parse(fs.readFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/seed-company-competitors-raw.json',
    'utf-8'
  ));

  // Get unique competitor domains, prioritize those mentioned by multiple companies
  const competitors = data.competitors as { domain: string, mentionedBy: string[] }[];
  console.log(`Total competitor domains: ${competitors.length}`);

  // Sample top competitors (mentioned by most companies first)
  const toCheck = competitors.slice(0, 100);
  console.log(`Checking top ${toCheck.length} competitors for employee count...\n`);

  const qualified: any[] = [];
  const tooSmall: any[] = [];
  const notFound: string[] = [];

  for (let i = 0; i < toCheck.length; i++) {
    const comp = toCheck[i];
    await sleep(2000);

    try {
      const result = await client.searchCompanyDB({
        filters: {
          op: 'and',
          conditions: [
            { filter_type: 'company_website_domain', type: '=', value: comp.domain }
          ]
        },
        limit: 1
      });

      if (result.companies && result.companies.length > 0) {
        const c = result.companies[0];
        const employees = c.employee_metrics?.latest_count || 0;

        if (employees >= 200) {
          qualified.push({
            name: c.company_name,
            domain: c.company_website_domain,
            employees,
            country: c.hq_country,
            industries: c.linkedin_industries,
            mentionedBy: comp.mentionedBy
          });
          console.log(`✅ ${c.company_name} (${comp.domain}) - ${employees} employees`);
        } else {
          tooSmall.push({ domain: comp.domain, name: c.company_name, employees });
        }
      } else {
        notFound.push(comp.domain);
      }
    } catch (e: any) {
      if (e.message?.includes('429')) {
        console.log('Rate limited, waiting...');
        await sleep(5000);
        i--; // Retry
      }
    }

    if ((i + 1) % 20 === 0) {
      console.log(`\n--- Progress: ${i + 1}/${toCheck.length} | Qualified: ${qualified.length} ---\n`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`FILTERED COMPETITORS (>= 200 employees)`);
  console.log('='.repeat(70));
  console.log(`Checked: ${toCheck.length}`);
  console.log(`Qualified (>=200 employees): ${qualified.length}`);
  console.log(`Too small (<200 employees): ${tooSmall.length}`);
  console.log(`Not found: ${notFound.length}`);

  console.log(`\n=== Qualified Competitors ===`);
  for (const c of qualified.sort((a, b) => b.employees - a.employees)) {
    console.log(`${c.name.padEnd(35)} ${String(c.employees).padStart(8)} employees  ${c.country}`);
    console.log(`  Mentioned by: ${c.mentionedBy.join(', ')}`);
  }

  // Save qualified list
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/qualified-competitors-200plus.json',
    JSON.stringify(qualified, null, 2)
  );

  // Also save as CSV
  const csvLines = ['company_name,domain,employees,country,industries,mentioned_by'];
  for (const c of qualified) {
    csvLines.push(`"${c.name}","${c.domain}",${c.employees},"${c.country}","${(c.industries || []).join('; ')}","${c.mentionedBy.join('; ')}"`);
  }
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/qualified-competitors-200plus.csv',
    csvLines.join('\n')
  );

  console.log(`\nSaved ${qualified.length} qualified competitors to data/qualified-competitors-200plus.csv`);
}

filterCompetitorsBySize();
