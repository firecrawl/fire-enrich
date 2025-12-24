import * as fs from 'fs';
import * as path from 'path';

const csvPath = path.join(__dirname, '../data/tam-expansion-results.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

// Parse header
const header = lines[0].split(',');
const nameIdx = header.indexOf('company_name');
const countryIdx = header.indexOf('hq_country');
const industryIdx = header.indexOf('linkedin_industries');
const sizeIdx = header.indexOf('employee_count_range');
const domainIdx = header.indexOf('company_website_domain');

console.log('=== Net New Companies from TAM Expansion ===\n');

for (let i = 1; i < Math.min(lines.length, 20); i++) {
  if (!lines[i].trim()) continue;

  // Simple CSV parse (won't handle all edge cases but good enough for display)
  try {
    const row = lines[i];
    // Find company name (first field after company_id)
    const firstComma = row.indexOf(',');
    const secondComma = row.indexOf(',', firstComma + 1);
    const companyName = row.substring(firstComma + 1, secondComma);

    // Find domain (look for .com, .co.uk, etc.)
    const domainMatch = row.match(/([a-zA-Z0-9-]+\.(com|co\.uk|ca|org|io|net|ai))/);
    const domain = domainMatch ? domainMatch[1] : 'N/A';

    // Find country
    const countryMatch = row.match(/,(USA|GBR|CAN|BRA),/);
    const country = countryMatch ? countryMatch[1] : 'N/A';

    // Find employee size
    const sizeMatch = row.match(/(10001\+|5001-10000|1001-5000|501-1000|201-500|51-200)/);
    const size = sizeMatch ? sizeMatch[1] : 'N/A';

    // Find industries (in brackets)
    const industryMatch = row.match(/\["([^"]+)"/);
    const industry = industryMatch ? industryMatch[1] : 'N/A';

    console.log(`${i}. ${companyName}`);
    console.log(`   Domain: ${domain} | Country: ${country} | Size: ${size}`);
    console.log(`   Industry: ${industry}`);
    console.log('');
  } catch (e) {
    console.log(`Error parsing row ${i}`);
  }
}
