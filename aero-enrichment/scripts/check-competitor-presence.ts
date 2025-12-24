import * as fs from 'fs';
import * as readline from 'readline';

async function checkCompetitorPresence() {
  // Read competitor domains
  const competitorDomains = fs.readFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/fintech-competitor-domains.txt',
    'utf-8'
  ).split('\n').filter(Boolean);

  console.log(`Total fintech competitor domains: ${competitorDomains.length}`);

  // Build a set of domains from extraction
  const extractionDomains = new Set<string>();
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
        extractionDomains.add(domain);
      }
    } catch {}
  }

  console.log(`Total domains in extraction: ${extractionDomains.size}`);

  // Check each competitor
  const inExtraction: string[] = [];
  const missing: string[] = [];

  for (const domain of competitorDomains) {
    if (extractionDomains.has(domain.toLowerCase())) {
      inExtraction.push(domain);
    } else {
      missing.push(domain);
    }
  }

  console.log(`\n=== METRICS ===`);
  console.log(`Competitor domains IN extraction (as primary entries): ${inExtraction.length} (${(inExtraction.length / competitorDomains.length * 100).toFixed(1)}%)`);
  console.log(`Competitor domains MISSING from extraction: ${missing.length} (${(missing.length / competitorDomains.length * 100).toFixed(1)}%)`);

  console.log(`\n=== Sample Competitors FOUND in Extraction ===`);
  for (const domain of inExtraction.slice(0, 20)) {
    console.log(`  ✅ ${domain}`);
  }

  console.log(`\n=== Sample Competitors MISSING from Extraction ===`);
  for (const domain of missing.slice(0, 50)) {
    console.log(`  ❌ ${domain}`);
  }

  // Save missing domains to file
  fs.writeFileSync(
    '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/missing-fintech-competitor-domains.txt',
    missing.join('\n')
  );
  console.log(`\nWrote ${missing.length} missing domains to data/missing-fintech-competitor-domains.txt`);
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

checkCompetitorPresence();
