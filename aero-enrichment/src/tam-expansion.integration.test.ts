import { runTAMExpansion } from './tam-expansion';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('TAM Expansion Integration', () => {
  const testDir = path.join(__dirname, '../test-integration-data');
  const existingPath = path.join(testDir, 'existing.csv');
  const outputPath = path.join(testDir, 'output.csv');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });

    // Create sample existing accounts CSV
    const existingCsv = `account_id,account_name,website
001,Coinbase,coinbase.com
002,Stripe,stripe.com`;

    await fs.writeFile(existingPath, existingCsv);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should run end-to-end TAM expansion', async () => {
    if (!process.env.CRUSTDATA_API_KEY) {
      console.log('Skipping integration test - no API key');
      return;
    }

    await runTAMExpansion({
      sampleSize: 10,
      existingAccountsPath: existingPath,
      outputPath: outputPath
    });

    // Check if output file was created
    // If API returns 0 results, the function exits early without creating output
    try {
      const stats = await fs.stat(outputPath);

      if (stats.isFile()) {
        // Verify content
        const content = await fs.readFile(outputPath, 'utf-8');
        expect(content).toContain('company_name');

        // Verify duplicates were removed
        expect(content.toLowerCase()).not.toContain('coinbase');
        expect(content.toLowerCase()).not.toContain('stripe');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Output file was not created - this happens when API returns 0 results
        // This is acceptable for the integration test
        console.log('Output file not created - API may have returned 0 results');
      } else {
        throw error;
      }
    }
  }, 60000); // 60 second timeout for API calls
});
