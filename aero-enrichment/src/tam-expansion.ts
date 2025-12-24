#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import { TAMExpansionService } from './tam-expansion-service';
import { readExistingAccounts, writeCompaniesToCSV, deduplicateCompanies } from './csv-utils';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface RunOptions {
  sampleSize?: number;
  existingAccountsPath: string;
  outputPath: string;
}

async function runTAMExpansion(options: RunOptions): Promise<void> {
  const {
    sampleSize = 100,
    existingAccountsPath,
    outputPath
  } = options;

  console.log('=== TAM Expansion Tool ===\n');

  // Step 1: Initialize service
  console.log('Step 1: Initializing TAM expansion service...');
  const service = new TAMExpansionService({
    apiKey: process.env.CRUSTDATA_API_KEY
  });

  // Step 1.5: Estimate total results
  console.log('\nStep 1.5: Estimating total results with high-recall filter...');
  const estimate = await service.searchWithHighRecall({ limit: 1 });
  const totalAvailable = estimate.total_count ?? 0;
  console.log(`Estimated total companies matching criteria: ${totalAvailable.toLocaleString()}`);
  console.log(`Sample size requested: ${sampleSize.toLocaleString()}`);

  if (totalAvailable === 0) {
    console.log('\nWarning: No companies found matching the high-recall filter criteria.');
    console.log('This could indicate:');
    console.log('  - API credentials issue');
    console.log('  - Filter criteria too restrictive');
    console.log('  - API endpoint issue');
    console.log('\nExiting without processing...');
    return;
  }

  const willCollect = Math.min(sampleSize, totalAvailable);
  console.log(`Will collect: ${willCollect.toLocaleString()} companies`);

  // Step 2: Search for companies with high-recall filters
  console.log(`\nStep 2: Searching for companies (collecting ${willCollect} of ${totalAvailable.toLocaleString()} available)...`);
  const companies = await service.collectAllCompanies({
    maxResults: sampleSize
  });

  console.log(`\nFound ${companies.length} companies matching high-recall criteria`);

  // Step 3: Read existing accounts
  console.log(`\nStep 3: Reading existing accounts from ${existingAccountsPath}...`);
  const existingAccounts = await readExistingAccounts(existingAccountsPath);
  console.log(`Loaded ${existingAccounts.length} existing accounts`);

  // Step 4: Deduplicate
  console.log('\nStep 4: Deduplicating against existing accounts...');
  const netNewCompanies = deduplicateCompanies(companies, existingAccounts);

  // Step 5: Write results
  console.log(`\nStep 5: Writing ${netNewCompanies.length} net new companies to ${outputPath}...`);
  await writeCompaniesToCSV(netNewCompanies, outputPath);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total companies found: ${companies.length}`);
  console.log(`Existing accounts: ${existingAccounts.length}`);
  console.log(`Duplicates removed: ${companies.length - netNewCompanies.length}`);
  console.log(`Net new companies: ${netNewCompanies.length}`);
  console.log(`\nOutput saved to: ${outputPath}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  const sampleSize = args.includes('--sample-size')
    ? parseInt(args[args.indexOf('--sample-size') + 1])
    : 100;

  const existingAccountsPath = args.includes('--existing')
    ? args[args.indexOf('--existing') + 1]
    : path.join(__dirname, '../data/Propensity Scoring Accounts.csv');

  const outputPath = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : path.join(__dirname, '../data/tam-expansion-results.csv');

  return {
    sampleSize,
    existingAccountsPath,
    outputPath
  };
}

// Main execution
if (require.main === module) {
  const options = parseArgs();

  console.log('Configuration:');
  console.log(`  Sample size: ${options.sampleSize}`);
  console.log(`  Existing accounts: ${options.existingAccountsPath}`);
  console.log(`  Output file: ${options.outputPath}`);
  console.log();

  runTAMExpansion(options)
    .then(() => {
      console.log('\nTAM expansion complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nTAM expansion failed:');
      console.error(error);
      process.exit(1);
    });
}

export { runTAMExpansion };
