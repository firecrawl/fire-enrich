import * as fs from 'fs';
import * as readline from 'readline';

interface CompanyRow {
  company_name: string;
  employee_count: number;
  competitor_websites: string[];
  linkedin_industries: string[];
}

async function extractCompetitorDomains() {
  const filePath = '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/tam-expansion-b2c-gig-20251209.csv';

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineNum = 0;
  const companies: CompanyRow[] = [];
  const allCompetitorDomains = new Map<string, number>(); // domain -> count

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

      // Parse employee_metrics JSON object
      let employeeCount = 0;
      try {
        const metrics = JSON.parse(row['employee_metrics'] || '{}');
        employeeCount = metrics.latest_count || 0;
      } catch { }

      const competitorWebsites = parseArray(row['competitor_websites']);
      const industries = parseArray(row['linkedin_industries']);

      // Filter for high-employee fintech/financial companies
      if (employeeCount > 500 && hasFinancialIndustry(industries)) {
        companies.push({
          company_name: row['company_name'],
          employee_count: employeeCount,
          competitor_websites: competitorWebsites,
          linkedin_industries: industries
        });

        // Count competitor mentions
        for (const url of competitorWebsites) {
          const domain = extractDomain(url);
          if (domain) {
            allCompetitorDomains.set(domain, (allCompetitorDomains.get(domain) || 0) + 1);
          }
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  // Sort companies by employee count
  companies.sort((a, b) => b.employee_count - a.employee_count);

  console.log(`\n=== Top 30 High-VIT Financial Companies ===\n`);
  for (const c of companies.slice(0, 30)) {
    console.log(`${c.company_name} (${c.employee_count} employees)`);
    console.log(`  Industries: ${c.linkedin_industries.slice(0, 3).join(', ')}`);
    console.log(`  Competitors: ${c.competitor_websites.slice(0, 5).join(', ')}`);
    console.log('');
  }

  // Sort competitor domains by frequency
  const sortedDomains = Array.from(allCompetitorDomains.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  console.log(`\n=== Top 100 Most Referenced Competitor Domains ===\n`);
  for (const [domain, count] of sortedDomains) {
    console.log(`${count.toString().padStart(3)} x ${domain}`);
  }

  // Write all competitor domains to file
  const outputPath = '/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/competitor-domains.txt';
  const allDomains = Array.from(allCompetitorDomains.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([d, c]) => `${c},${d}`)
    .join('\n');
  fs.writeFileSync(outputPath, allDomains);
  console.log(`\nWrote ${allCompetitorDomains.size} unique competitor domains to ${outputPath}`);
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
    // Handle JSON array
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
    return [str];
  } catch {
    // Handle comma-separated list
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

function hasFinancialIndustry(industries: string[]): boolean {
  const financialKeywords = [
    'financial', 'banking', 'fintech', 'insurance', 'payment',
    'lending', 'investment', 'crypto', 'marketplace', 'internet marketplace'
  ];
  return industries.some(ind =>
    financialKeywords.some(kw => ind.toLowerCase().includes(kw))
  );
}

function hasFintechKeywords(description: string): boolean {
  const keywords = [
    'fintech', 'neobank', 'digital bank', 'challenger bank',
    'consumer finance', 'personal finance', 'mobile banking',
    'payment', 'wallet', 'money transfer', 'remittance'
  ];
  const desc = description.toLowerCase();
  return keywords.some(kw => desc.includes(kw));
}

extractCompetitorDomains();
