import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';
import * as readline from 'readline';

async function searchCryptoConsumerFinance() {
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

  // Search queries for crypto and consumer finance
  const searches = [
    {
      name: 'Crypto & Blockchain',
      industries: ['Blockchain Services', 'Financial Services'],
      keywords: ['crypto', 'blockchain', 'bitcoin', 'defi', 'web3']
    },
    {
      name: 'Consumer Lending',
      industries: ['Financial Services', 'Credit Intermediation'],
      keywords: ['lending', 'loan', 'credit', 'consumer finance']
    },
    {
      name: 'Digital Banking & Neobanks',
      industries: ['Banking', 'Financial Services'],
      keywords: ['digital bank', 'neobank', 'mobile banking', 'fintech']
    },
    {
      name: 'Payment Processing',
      industries: ['Financial Services'],
      keywords: ['payment', 'payments', 'checkout', 'merchant']
    },
    {
      name: 'Buy Now Pay Later',
      industries: ['Financial Services'],
      keywords: ['bnpl', 'buy now pay later', 'installment', 'point of sale financing']
    },
    {
      name: 'Wealth & Investment',
      industries: ['Financial Services', 'Investment Management'],
      keywords: ['investment', 'wealth', 'trading', 'robo-advisor']
    }
  ];

  const allResults: any[] = [];
  const seenDomains = new Set<string>();

  for (const search of searches) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Searching: ${search.name}`);
    console.log('='.repeat(60));

    try {
      // Search for US companies with 50+ employees in Financial Services industries
      // with employee growth
      const result = await client.searchCompanyDB({
        filters: {
          op: 'and',
          conditions: [
            { filter_type: 'hq_country', type: 'in', value: ['USA', 'US', 'United States'] },
            { filter_type: 'employee_count', type: '>=', value: 50 },
            { filter_type: 'linkedin_industry', type: 'in', value: ['Financial Services', 'Banking'] }
          ]
        },
        sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }],
        limit: 500
      });

      if (result.companies && result.companies.length > 0) {
        console.log(`Found ${result.companies.length} companies\n`);

        for (const c of result.companies) {
          const domain = c.company_website_domain?.toLowerCase();

          // Skip if already in TAM or already seen
          if (tamDomains.has(domain) || seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          const employees = c.employee_metrics?.latest_count || 0;
          const growth6mo = c.employee_metrics?.growth_6mo_percent || 0;
          const growth12mo = c.employee_metrics?.growth_12mo_percent || 0;

          // Filter for actual growth
          if (growth6mo > 0 || growth12mo > 0) {
            allResults.push({
              name: c.company_name,
              domain: c.company_website_domain,
              employees,
              growth6mo: growth6mo.toFixed(1),
              growth12mo: growth12mo.toFixed(1),
              industries: c.linkedin_industries,
              country: c.hq_country,
              source: search.name
            });

            console.log(`✅ ${c.company_name} (${domain}) - ${employees} emp, +${growth6mo.toFixed(1)}% 6mo`);
          }
        }
      }
    } catch (e: any) {
      console.log(`Error in search: ${e.message?.substring(0, 80)}`);
    }

    // Small delay between searches
    await new Promise(r => setTimeout(r, 2000));
  }

  // Also do a direct search for crypto-specific keywords in company descriptions
  console.log(`\n${'='.repeat(60)}`);
  console.log('Searching: Crypto/Blockchain keyword match');
  console.log('='.repeat(60));

  try {
    const cryptoResult = await client.searchCompanyDB({
      filters: {
        op: 'and',
        conditions: [
          { filter_type: 'hq_country', type: 'in', value: ['USA', 'US', 'United States'] },
          { filter_type: 'employee_count', type: '>=', value: 50 },
          { filter_type: 'linkedin_industry', type: 'in', value: ['Financial Services', 'Technology, Information and Internet', 'Blockchain Services'] }
        ]
      },
      sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }],
      limit: 500
    });

    if (cryptoResult.companies) {
      const cryptoKeywords = ['crypto', 'bitcoin', 'blockchain', 'defi', 'web3', 'nft', 'token', 'exchange', 'wallet'];

      for (const c of cryptoResult.companies) {
        const domain = c.company_website_domain?.toLowerCase();
        if (tamDomains.has(domain) || seenDomains.has(domain)) continue;

        // Check if name or description contains crypto keywords
        const companyText = `${c.company_name} ${c.short_description || ''}`.toLowerCase();
        const isCrypto = cryptoKeywords.some(kw => companyText.includes(kw));

        if (isCrypto) {
          seenDomains.add(domain);
          const employees = c.employee_metrics?.latest_count || 0;
          const growth6mo = c.employee_metrics?.growth_6mo_percent || 0;

          allResults.push({
            name: c.company_name,
            domain: c.company_website_domain,
            employees,
            growth6mo: growth6mo.toFixed(1),
            growth12mo: (c.employee_metrics?.growth_12mo_percent || 0).toFixed(1),
            industries: c.linkedin_industries,
            country: c.hq_country,
            source: 'Crypto Keyword'
          });

          console.log(`✅ ${c.company_name} (${domain}) - ${employees} emp`);
        }
      }
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 80)}`);
  }

  // Sort by employee count
  allResults.sort((a, b) => b.employees - a.employees);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`FINAL RESULTS - US Crypto & Consumer Finance (50+ emp, growing)`);
  console.log('='.repeat(70));
  console.log(`Total net-new companies: ${allResults.length}`);

  console.log(`\n=== TOP RESULTS ===`);
  for (const c of allResults.slice(0, 50)) {
    console.log(`${c.name.padEnd(40)} ${String(c.employees).padStart(6)} emp  +${c.growth6mo}% 6mo`);
    console.log(`  Domain: ${c.domain}`);
    console.log(`  Industries: ${(c.industries || []).slice(0, 2).join(', ')}`);
    console.log('');
  }

  // Save results
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/crypto-consumer-finance-netnew.json',
    JSON.stringify(allResults, null, 2)
  );

  const csvLines = ['company_name,domain,employees,growth_6mo_pct,growth_12mo_pct,industries,source'];
  for (const c of allResults) {
    csvLines.push(`"${c.name}","${c.domain}",${c.employees},${c.growth6mo},${c.growth12mo},"${(c.industries || []).join('; ')}","${c.source}"`);
  }
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/crypto-consumer-finance-netnew.csv',
    csvLines.join('\n')
  );

  console.log(`\nSaved ${allResults.length} companies to data/crypto-consumer-finance-netnew.csv`);
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

searchCryptoConsumerFinance();
