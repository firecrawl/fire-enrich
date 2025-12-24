import { TAMExpansionService } from '../src/tam-expansion-service';

async function main() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const service = new TAMExpansionService({ apiKey });

  console.log('Testing if hedge fund companies are excluded...\n');

  try {
    const result = await service.searchWithHighRecall({ limit: 100 });

    // Check if any results contain hedge fund related terms
    const hedgeFundMatches = result.companies.filter(c => {
      const desc = (c.linkedin_company_description || '').toLowerCase();
      return desc.includes('hedge fund') ||
             desc.includes('assets under management') ||
             desc.includes('fund manager') ||
             desc.includes('private equity fund');
    });

    console.log(`Total results: ${result.companies.length}`);
    console.log(`Hedge fund matches found: ${hedgeFundMatches.length}`);

    if (hedgeFundMatches.length > 0) {
      console.log('\nBad fits still present:');
      for (const company of hedgeFundMatches.slice(0, 5)) {
        const industries = company.linkedin_industries || [];
        console.log(`  - ${company.company_name} (${industries.join(', ')})`);
      }
    } else {
      console.log('\nNo hedge fund bad fits found in sample!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
