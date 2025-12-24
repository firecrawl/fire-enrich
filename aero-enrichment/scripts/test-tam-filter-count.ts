import { TAMExpansionService } from '../src/tam-expansion-service';

async function main() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';

  const service = new TAMExpansionService({ apiKey });

  console.log('Testing TAM filter count with expanded geography...\n');

  try {
    // Just fetch first page to get total count
    const result = await service.searchWithHighRecall({ limit: 10 });

    console.log(`Total companies matching filter: ${result.total_count ?? 'unknown'}`);
    console.log(`\nSample companies (first 10):`);

    for (const company of result.companies) {
      console.log(`  - ${company.company_name} (${company.hq_country}) - ${company.employee_metrics?.latest_count ?? 'N/A'} employees`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
