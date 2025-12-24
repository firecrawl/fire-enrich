import * as fs from 'fs';
import * as readline from 'readline';

async function filterUSCompetitorsNotInTAM() {
  // Load qualified competitors
  const qualified = JSON.parse(fs.readFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/qualified-competitors-200plus.json',
    'utf-8'
  ));

  console.log(`Total qualified competitors (>=200 employees): ${qualified.length}`);

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

  // Filter: US only, not in TAM
  const inTAM: any[] = [];
  const notUS: any[] = [];
  const netNew: any[] = [];

  for (const comp of qualified) {
    const domain = comp.domain?.toLowerCase().trim();
    const country = (comp.country || '').toUpperCase();

    if (tamDomains.has(domain)) {
      inTAM.push(comp);
    } else if (country !== 'USA' && country !== 'US' && country !== 'UNITED STATES') {
      notUS.push(comp);
    } else {
      netNew.push(comp);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`FILTERING RESULTS`);
  console.log('='.repeat(70));
  console.log(`Already in TAM extraction: ${inTAM.length}`);
  console.log(`Non-US (excluded): ${notUS.length}`);
  console.log(`NET NEW US COMPETITORS: ${netNew.length}`);

  console.log(`\n=== Already in TAM Extraction (excluded) ===`);
  for (const c of inTAM) {
    console.log(`  ${c.name} (${c.domain}) - ${c.employees} employees - ${c.country}`);
  }

  console.log(`\n=== Non-US Companies (excluded) ===`);
  for (const c of notUS) {
    console.log(`  ${c.name} (${c.domain}) - ${c.employees} employees - ${c.country}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`NET NEW US COMPETITORS (not in TAM extraction)`);
  console.log('='.repeat(70));
  for (const c of netNew.sort((a, b) => b.employees - a.employees)) {
    console.log(`${c.name.padEnd(35)} ${String(c.employees).padStart(8)} employees`);
    console.log(`  Domain: ${c.domain}`);
    console.log(`  Industries: ${JSON.stringify(c.industries)}`);
    console.log(`  Referenced by: ${c.mentionedBy.join(', ')}`);
    console.log('');
  }

  // Save net new list
  if (netNew.length > 0) {
    fs.writeFileSync(
      '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/net-new-us-competitors.json',
      JSON.stringify(netNew, null, 2)
    );

    const csvLines = ['company_name,domain,employees,industries,mentioned_by'];
    for (const c of netNew) {
      csvLines.push(`"${c.name}","${c.domain}",${c.employees},"${(c.industries || []).join('; ')}","${c.mentionedBy.join('; ')}"`);
    }
    fs.writeFileSync(
      '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/net-new-us-competitors.csv',
      csvLines.join('\n')
    );

    console.log(`\nSaved ${netNew.length} net new US competitors to data/net-new-us-competitors.csv`);
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

filterUSCompetitorsNotInTAM();
