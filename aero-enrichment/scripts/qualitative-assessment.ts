import { CrustDataClient } from '../src/crustdata-client';
import { TAMExpansionService } from '../src/tam-expansion-service';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new CrustDataClient();
const service = new TAMExpansionService();

async function main() {
  console.log('=== Qualitative Assessment: 100 Company Sample ===\n');

  // Get 100 companies from filter
  const filter = service.buildHighRecallFilter();
  const result = await client.searchCompanyDB({
    filters: filter,
    limit: 100,
    sorts: [{ column: 'employee_metrics.latest_count', order: 'desc' }]
  });

  // Categorize companies
  const categories = {
    'Banks/Financial Services': [] as any[],
    'Insurance': [] as any[],
    'Payments/Fintech': [] as any[],
    'Marketplaces/Gig Economy': [] as any[],
    'Investment/Wealth': [] as any[],
    'Hospitality/Travel': [] as any[],
    'Tech/Software': [] as any[],
    'Other/Unclear': [] as any[]
  };

  // Industry to category mapping
  const industryMapping: Record<string, string> = {
    'Banking': 'Banks/Financial Services',
    'Investment Banking': 'Banks/Financial Services',
    'Financial Services': 'Banks/Financial Services',
    'Insurance': 'Insurance',
    'Insurance Carriers': 'Insurance',
    'Insurance Agencies and Brokerages': 'Insurance',
    'Internet Marketplace Platforms': 'Marketplaces/Gig Economy',
    'Ground Passenger Transportation': 'Marketplaces/Gig Economy',
    'Freight and Package Transportation': 'Marketplaces/Gig Economy',
    'Investment Management': 'Investment/Wealth',
    'Hospitality': 'Hospitality/Travel',
    'Software Development': 'Tech/Software',
    'Technology, Information and Internet': 'Tech/Software'
  };

  for (const c of result.companies) {
    const industries = c.linkedin_industries || [];
    let category = 'Other/Unclear';

    // Find best matching category
    for (const ind of industries) {
      for (const [key, cat] of Object.entries(industryMapping)) {
        if (ind.toLowerCase().includes(key.toLowerCase())) {
          category = cat;
          break;
        }
      }
      if (category !== 'Other/Unclear') break;
    }

    categories[category].push({
      name: c.company_name,
      domain: c.company_website_domain,
      industries: industries.slice(0, 2).join(', '),
      size: c.employee_count_range,
      country: c.hq_country || c.hq_location?.split(',').pop()?.trim()
    });
  }

  // Print results by category
  for (const [category, companies] of Object.entries(categories)) {
    if (companies.length === 0) continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${category} (${companies.length} companies)`);
    console.log('='.repeat(60));

    for (const c of companies.slice(0, 15)) { // Show top 15 per category
      console.log(`  ${c.name}`);
      console.log(`    ${c.domain} | ${c.size} | ${c.country || 'N/A'}`);
      console.log(`    ${c.industries}`);
    }
    if (companies.length > 15) {
      console.log(`  ... and ${companies.length - 15} more`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const [category, companies] of Object.entries(categories)) {
    if (companies.length > 0) {
      console.log(`${category}: ${companies.length}`);
    }
  }
  console.log(`\nTotal: ${result.companies.length}`);
}

main().catch(console.error);
