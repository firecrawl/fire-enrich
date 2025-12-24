import { CrustDataClient } from '../src/crustdata-client';
import * as fs from 'fs';
import * as readline from 'readline';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function filterAllUSCompetitorsBatch() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const client = new CrustDataClient({ apiKey });

  // Load all competitor domains from seed companies
  const data = JSON.parse(fs.readFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/seed-company-competitors-raw.json',
    'utf-8'
  ));

  const competitors = data.competitors as { domain: string, mentionedBy: string[] }[];
  console.log(`Total competitor domains: ${competitors.length}`);

  // Build set of domains from TAM extraction
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
      if (domain) {
        tamDomains.add(domain);
      }
    } catch {}
  }

  console.log(`Total domains in TAM extraction: ${tamDomains.size}`);

  // Pre-filter: skip domains already in TAM and obvious international TLDs
  const internationalTLDs = ['.uk', '.de', '.fr', '.es', '.it', '.nl', '.be', '.ch', '.at', '.pl', '.ru', '.cn', '.jp', '.kr', '.in', '.br', '.mx', '.ar', '.cl', '.co.uk', '.com.au', '.ca', '.eu', '.asia', '.sg', '.hk', '.tw', '.th', '.my', '.id', '.ph', '.vn', '.nz', '.za', '.ae', '.sa', '.il', '.tr', '.se', '.no', '.dk', '.fi'];

  const toCheck: typeof competitors = [];
  let skippedInTAM = 0;
  let skippedIntlTLD = 0;

  // Build domain -> mentionedBy mapping for later
  const domainToMentionedBy = new Map<string, string[]>();

  for (const comp of competitors) {
    const domain = comp.domain.toLowerCase();
    domainToMentionedBy.set(domain, comp.mentionedBy);

    if (tamDomains.has(domain)) {
      skippedInTAM++;
      continue;
    }

    const hasIntlTLD = internationalTLDs.some(tld => domain.endsWith(tld));
    if (hasIntlTLD) {
      skippedIntlTLD++;
      continue;
    }

    toCheck.push(comp);
  }

  console.log(`\nPre-filtering:`);
  console.log(`  Skipped (already in TAM): ${skippedInTAM}`);
  console.log(`  Skipped (international TLD): ${skippedIntlTLD}`);
  console.log(`  Remaining to check via API: ${toCheck.length}`);

  // Batch size - API seems to handle up to ~50 domains per request well
  const BATCH_SIZE = 25;
  const batches: typeof competitors[] = [];

  for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
    batches.push(toCheck.slice(i, i + BATCH_SIZE));
  }

  console.log(`\nProcessing ${toCheck.length} domains in ${batches.length} batches of ${BATCH_SIZE}...`);
  console.log(`Estimated time: ~${Math.ceil(batches.length * 3 / 60)} minutes\n`);

  const qualified: any[] = [];
  const tooSmall: any[] = [];
  const notUS: any[] = [];
  const notFound: string[] = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const domains = batch.map(c => c.domain);

    await sleep(2000); // Rate limit between batches

    try {
      // Use 'in' filter to check multiple domains at once
      const result = await client.searchCompanyDB({
        filters: {
          op: 'and',
          conditions: [
            { filter_type: 'company_website_domain', type: 'in', value: domains }
          ]
        },
        limit: BATCH_SIZE
      });

      const foundDomains = new Set<string>();

      if (result.companies && result.companies.length > 0) {
        for (const c of result.companies) {
          const domain = c.company_website_domain?.toLowerCase();
          foundDomains.add(domain);

          const employees = c.employee_metrics?.latest_count || 0;
          const country = (c.hq_country || '').toUpperCase();
          const isUS = country === 'USA' || country === 'US' || country === 'UNITED STATES';
          const mentionedBy = domainToMentionedBy.get(domain) || [];

          if (employees >= 200 && isUS) {
            qualified.push({
              name: c.company_name,
              domain: c.company_website_domain,
              employees,
              country: c.hq_country,
              industries: c.linkedin_industries,
              mentionedBy
            });
            console.log(`✅ ${c.company_name} (${domain}) - ${employees} employees - USA`);
          } else if (employees < 200) {
            tooSmall.push({ domain, name: c.company_name, employees });
          } else {
            notUS.push({ domain, name: c.company_name, country: c.hq_country, employees });
          }
        }
      }

      // Track domains not found
      for (const d of domains) {
        if (!foundDomains.has(d.toLowerCase())) {
          notFound.push(d);
        }
      }

    } catch (e: any) {
      if (e.message?.includes('429')) {
        console.log('Rate limited, waiting 10s...');
        await sleep(10000);
        batchIdx--; // Retry batch
      } else {
        console.log(`Error in batch ${batchIdx + 1}: ${e.message?.substring(0, 60)}`);
      }
    }

    if ((batchIdx + 1) % 10 === 0 || batchIdx === batches.length - 1) {
      const checked = Math.min((batchIdx + 1) * BATCH_SIZE, toCheck.length);
      console.log(`\n--- Progress: ${checked}/${toCheck.length} | Qualified US: ${qualified.length} ---\n`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`FINAL RESULTS - US Companies with 200+ Employees`);
  console.log('='.repeat(70));
  console.log(`Checked via API: ${toCheck.length}`);
  console.log(`Qualified (US, 200+ employees): ${qualified.length}`);
  console.log(`Too small (<200 employees): ${tooSmall.length}`);
  console.log(`Non-US (excluded): ${notUS.length}`);
  console.log(`Not found in CrustData: ${notFound.length}`);

  console.log(`\n=== QUALIFIED US COMPETITORS ===`);
  for (const c of qualified.sort((a, b) => b.employees - a.employees)) {
    console.log(`${c.name.padEnd(40)} ${String(c.employees).padStart(8)} employees`);
    console.log(`  Domain: ${c.domain}`);
    console.log(`  Industries: ${(c.industries || []).slice(0, 3).join(', ')}`);
    console.log(`  Referenced by: ${c.mentionedBy.join(', ')}`);
    console.log('');
  }

  // Save results
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/all-us-competitors-200plus.json',
    JSON.stringify(qualified, null, 2)
  );

  const csvLines = ['company_name,domain,employees,industries,mentioned_by'];
  for (const c of qualified) {
    csvLines.push(`"${c.name}","${c.domain}",${c.employees},"${(c.industries || []).join('; ')}","${c.mentionedBy.join('; ')}"`);
  }
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/all-us-competitors-200plus.csv',
    csvLines.join('\n')
  );

  console.log(`\nSaved ${qualified.length} qualified US competitors to data/all-us-competitors-200plus.csv`);
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

filterAllUSCompetitorsBatch();
