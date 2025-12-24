import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupMissingCompetitors() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  // Read missing domains
  const missingDomains = fs.readFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/missing-fintech-competitor-domains.txt',
    'utf-8'
  ).split('\n').filter(Boolean).slice(0, 30); // Sample first 30

  console.log(`Looking up ${missingDomains.length} missing fintech competitor domains...\n`);

  const foundCompanies: any[] = [];
  const notFound: string[] = [];
  const tooSmall: string[] = [];
  const wrongGeo: string[] = [];
  const excludedType: string[] = [];
  const qualified: any[] = [];

  const targetGeos = ['united states', 'usa', 'uk', 'united kingdom', 'canada', 'germany', 'brazil', 'singapore', 'india', 'australia'];

  for (let i = 0; i < missingDomains.length; i++) {
    const domain = missingDomains[i];
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
        foundCompanies.push(c);

        const employees = c.employee_metrics?.latest_count || 0;
        const hqCountry = (c.hq_country || c.hq_location || '').toLowerCase();
        const companyType = (c.company_type || '').toLowerCase();

        // Check qualifications
        const isTargetGeo = targetGeos.some(g => hqCountry.includes(g));
        const isBigEnough = employees >= 50;
        const isGoodType = !['nonprofit', 'educational', 'government'].some(t => companyType.includes(t));

        if (isBigEnough && isTargetGeo && isGoodType) {
          qualified.push({
            name: c.company_name,
            domain: c.company_website_domain,
            employees,
            country: c.hq_country,
            industries: c.linkedin_industries
          });
          console.log(`✅ QUALIFIED: ${c.company_name} (${domain}) - ${employees} employees in ${c.hq_country}`);
        } else if (!isBigEnough) {
          tooSmall.push(`${c.company_name} (${domain}) - ${employees} employees`);
        } else if (!isTargetGeo) {
          wrongGeo.push(`${c.company_name} (${domain}) - ${c.hq_country}`);
        } else {
          excludedType.push(`${c.company_name} (${domain}) - ${companyType}`);
        }
      } else {
        notFound.push(domain);
      }
    } catch (e: any) {
      console.log(`Error for ${domain}:`, e.message?.substring(0, 50));
    }

    // Progress
    if ((i + 1) % 10 === 0) {
      console.log(`\n--- Progress: ${i + 1}/${missingDomains.length} ---\n`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`SUMMARY - Missing Fintech Competitor Analysis`);
  console.log('='.repeat(70));
  console.log(`Total analyzed: ${missingDomains.length}`);
  console.log(`Not found in CrustData: ${notFound.length}`);
  console.log(`Found but too small (<50 employees): ${tooSmall.length}`);
  console.log(`Found but wrong geography: ${wrongGeo.length}`);
  console.log(`Found but excluded type: ${excludedType.length}`);
  console.log(`QUALIFIED (should be in extraction): ${qualified.length}`);

  console.log(`\n=== Qualified Companies (should add to TAM) ===`);
  for (const c of qualified) {
    console.log(`  ${c.name} (${c.domain}) - ${c.employees} employees - ${c.country}`);
    console.log(`    Industries: ${JSON.stringify(c.industries)}`);
  }

  // Save qualified companies
  if (qualified.length > 0) {
    fs.writeFileSync(
      '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/qualified-missing-competitors.json',
      JSON.stringify(qualified, null, 2)
    );
  }
}

lookupMissingCompetitors();
