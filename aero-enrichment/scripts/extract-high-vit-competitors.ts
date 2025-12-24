import * as fs from 'fs';
import * as readline from 'readline';

const TARGET_COMPANIES = [
  'uber', 'wells fargo', 'coinbase', 'ebay', 'lyft',
  'doordash', 'airbnb', 'chime', 'paypal', 'stripe',
  'square', 'block', 'robinhood', 'sofi', 'affirm',
  'klarna', 'revolut', 'cash app', 'venmo', 'wise'
];

async function extractCompetitors() {
  const filePath = '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/tam-expansion-b2c-gig-20251209.csv';

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineNum = 0;
  const allCompetitors = new Set<string>();
  const foundCompanies: {name: string, domain: string, competitors: string[]}[] = [];

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

      const companyName = row['company_name'] || '';
      const companyDomain = row['company_website_domain'] || '';
      const competitorWebsites = parseArray(row['competitor_websites']);

      // Check if this is one of our target companies
      const isTarget = TARGET_COMPANIES.some(target =>
        companyName.toLowerCase().includes(target) ||
        companyDomain.toLowerCase().includes(target.replace(' ', ''))
      );

      if (isTarget && competitorWebsites.length > 0) {
        foundCompanies.push({
          name: companyName,
          domain: companyDomain,
          competitors: competitorWebsites
        });

        for (const url of competitorWebsites) {
          const domain = extractDomain(url);
          if (domain && !isJunkDomain(domain)) {
            allCompetitors.add(domain);
          }
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  console.log(`\n=== Found ${foundCompanies.length} Target Companies ===\n`);
  for (const c of foundCompanies) {
    console.log(`${c.name} (${c.domain})`);
    console.log(`  Competitors: ${c.competitors.slice(0, 8).join(', ')}`);
    console.log('');
  }

  console.log(`\n=== All ${allCompetitors.size} Unique Competitor Domains ===\n`);
  const sortedDomains = Array.from(allCompetitors).sort();
  for (const domain of sortedDomains) {
    console.log(domain);
  }

  // Write to file
  const outputPath = '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/high-vit-competitor-domains.txt';
  fs.writeFileSync(outputPath, sortedDomains.join('\n'));
  console.log(`\nWrote ${allCompetitors.size} domains to ${outputPath}`);
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

function parseArray(str: string): string[] {
  if (!str || str === '[]') return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
    return [str];
  } catch {
    return str.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
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
  const junk = ['linkedin.com', 'facebook.com', 'twitter.com', 'bit.ly', 'linktr.ee', 'instagram.com'];
  return junk.includes(domain);
}

extractCompetitors();
