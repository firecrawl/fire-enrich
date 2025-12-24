import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';
import * as readline from 'readline';

async function searchGamblingBetting() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  // Load existing TAM domains to exclude
  const tamDomains = new Set<string>();
  const extractionPath = '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/tam-expansion-b2c-gig-20251209.csv';

  const fileStream = fs.createReadStream(extractionPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = parseCSVLine(line);
      continue;
    }
    try {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => row[h] = values[i] || '');
      const domain = row['company_website_domain']?.toLowerCase().trim();
      if (domain) tamDomains.add(domain);
    } catch {}
  }

  console.log(`Loaded ${tamDomains.size} existing TAM domains to exclude\n`);

  const allResults: any[] = [];
  const seenDomains = new Set<string>();

  // Search 1: Gambling / Betting industry keywords
  console.log('='.repeat(60));
  console.log('Searching: Sports Betting & Gambling Apps');
  console.log('='.repeat(60));

  try {
    const result = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          {
            op: 'or',
            conditions: [
              { filter_type: 'linkedin_industries', type: '(.)', value: 'Gambling Facilities and Casinos' },
              { filter_type: 'linkedin_industries', type: '(.)', value: 'Entertainment Providers' },
              { filter_type: 'linkedin_industries', type: '(.)', value: 'Spectator Sports' }
            ]
          },
          {
            op: 'or',
            conditions: [
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'sports betting' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'sportsbook' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'online gambling' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'casino' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'betting' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'wagering' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'fantasy sports' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'prediction market' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'poker' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'gaming' }
            ]
          }
        ]
      },
      sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }],
      limit: 500
    });

    if (result.companies && result.companies.length > 0) {
      console.log(`Found ${result.companies.length} companies from industry search\n`);
      processResults(result.companies, tamDomains, seenDomains, allResults, 'Industry Search');
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }

  await new Promise(r => setTimeout(r, 2000));

  // Search 2: Direct keyword search for betting/gambling
  console.log('\n' + '='.repeat(60));
  console.log('Searching: Betting & Prediction Markets (keyword)');
  console.log('='.repeat(60));

  try {
    const result = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          {
            op: 'or',
            conditions: [
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'sports betting' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'sportsbook' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'prediction market' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'fantasy sports' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'daily fantasy' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'betting app' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'online betting' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'igaming' },
              { filter_type: 'linkedin_company_description', type: '(.)', value: 'real money gaming' }
            ]
          }
        ]
      },
      sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }],
      limit: 500
    });

    if (result.companies && result.companies.length > 0) {
      console.log(`Found ${result.companies.length} companies from keyword search\n`);
      processResults(result.companies, tamDomains, seenDomains, allResults, 'Keyword Search');
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }

  await new Promise(r => setTimeout(r, 2000));

  // Search 3: Gambling Facilities industry direct
  console.log('\n' + '='.repeat(60));
  console.log('Searching: Gambling Facilities Industry');
  console.log('='.repeat(60));

  try {
    const result = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          { filter_type: 'linkedin_industries', type: '(.)', value: 'Gambling' }
        ]
      },
      sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }],
      limit: 500
    });

    if (result.companies && result.companies.length > 0) {
      console.log(`Found ${result.companies.length} companies\n`);
      processResults(result.companies, tamDomains, seenDomains, allResults, 'Gambling Industry');
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }

  // Sort by employee count
  allResults.sort((a, b) => b.employees - a.employees);

  // Filter for US only and 50+ employees
  const usResults = allResults.filter(c => {
    const country = (c.country || '').toUpperCase();
    return (country === 'USA' || country === 'US' || country === 'UNITED STATES') && c.employees >= 50;
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`FINAL RESULTS - US Gambling/Betting/Prediction Market (50+ emp)`);
  console.log('='.repeat(70));
  console.log(`Total found: ${allResults.length}`);
  console.log(`US companies with 50+ employees: ${usResults.length}`);

  console.log(`\n=== US GAMBLING/BETTING COMPANIES ===`);
  for (const c of usResults) {
    console.log(`${c.name.padEnd(45)} ${String(c.employees).padStart(6)} emp`);
    console.log(`  Domain: ${c.domain}`);
    console.log(`  Industries: ${(c.industries || []).slice(0, 2).join(', ')}`);
    console.log('');
  }

  // Save results
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/gambling-betting-netnew.json',
    JSON.stringify(usResults, null, 2)
  );

  const csvLines = ['company_name,domain,employees,industries,country,source'];
  for (const c of usResults) {
    csvLines.push(`"${c.name}","${c.domain}",${c.employees},"${(c.industries || []).join('; ')}","${c.country}","${c.source}"`);
  }
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/gambling-betting-netnew.csv',
    csvLines.join('\n')
  );

  console.log(`\nSaved ${usResults.length} US gambling/betting companies to data/gambling-betting-netnew.csv`);
}

function processResults(
  companies: any[],
  tamDomains: Set<string>,
  seenDomains: Set<string>,
  allResults: any[],
  source: string
) {
  for (const c of companies) {
    const domain = c.company_website_domain?.toLowerCase();

    // Skip if already in TAM or already seen
    if (!domain || tamDomains.has(domain) || seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    const employees = c.employee_metrics?.latest_count || 0;

    allResults.push({
      name: c.company_name,
      domain: c.company_website_domain,
      employees,
      industries: c.linkedin_industries,
      country: c.hq_country,
      source
    });

    console.log(`✅ ${c.company_name} (${domain}) - ${employees} emp - ${c.hq_country}`);
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

searchGamblingBetting();
