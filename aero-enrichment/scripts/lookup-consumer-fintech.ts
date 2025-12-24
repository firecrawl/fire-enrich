import { CrustDataClient } from '../src/crustdata-client';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupCompanies() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  const domains = [
    'varo.com', 'moneylion.com', 'albert.com',
    'cleo.ai', 'empower.me', 'digit.co', 'possible.finance',
    'oportun.com', 'lendingpoint.com', 'floatme.com', 'hellobrigit.com'
  ];

  console.log('Looking up consumer fintech companies to analyze their LinkedIn profiles...\n');

  for (const domain of domains) {
    await sleep(2000); // Rate limit
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
        console.log('Company:', c.company_name);
        console.log('Domain:', c.company_website_domain);
        console.log('HQ:', c.hq_country);
        console.log('Industries:', JSON.stringify(c.linkedin_industries));
        console.log('Employees:', c.employee_metrics?.latest_count);
        console.log('Description:', c.linkedin_company_description?.substring(0, 500));
        console.log('');
      } else {
        console.log(`❌ Not found: ${domain}`);
      }
    } catch (e: any) {
      console.log('Error for', domain, ':', e.message);
    }
  }
}

lookupCompanies();
