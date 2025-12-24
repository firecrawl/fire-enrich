import { readExistingAccounts, writeCompaniesToCSV, deduplicateCompanies } from './csv-utils';
import { CompanyDBCompany } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CSV Utils', () => {
  const testDataDir = path.join(__dirname, '../test-data');
  const testCsvPath = path.join(testDataDir, 'test-accounts.csv');
  const outputCsvPath = path.join(testDataDir, 'output-accounts.csv');

  beforeEach(async () => {
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('readExistingAccounts', () => {
    it('should read and parse CSV file', async () => {
      const csvContent = `account_id,account_name,website
001,Test Company,test.com
002,Another Co,another.com`;

      await fs.writeFile(testCsvPath, csvContent);

      const accounts = await readExistingAccounts(testCsvPath);

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toHaveProperty('website', 'test.com');
      expect(accounts[1]).toHaveProperty('account_name', 'Another Co');
    });

    it('should handle files with JSON columns', async () => {
      const csvContent = `account_id,website,data
001,test.com,"{""key"":""value""}"`;

      await fs.writeFile(testCsvPath, csvContent);

      const accounts = await readExistingAccounts(testCsvPath);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].website).toBe('test.com');
    });

    it('should handle escaped quotes within quoted fields', async () => {
      const csvContent = `name,description
"Test Co","Description with ""quoted"" text"`;

      await fs.writeFile(testCsvPath, csvContent);
      const accounts = await readExistingAccounts(testCsvPath);

      expect(accounts[0].description).toBe('Description with "quoted" text');
    });
  });

  describe('writeCompaniesToCSV', () => {
    it('should write companies to CSV file', async () => {
      const companies: CompanyDBCompany[] = [
        {
          company_name: 'New Company',
          company_website_domain: 'newco.com',
          linkedin_id: '12345',
          hq_country: 'United States',
          employee_count_range: '201-500'
        }
      ];

      await writeCompaniesToCSV(companies, outputCsvPath);

      const content = await fs.readFile(outputCsvPath, 'utf-8');
      expect(content).toContain('company_name');
      expect(content).toContain('New Company');
      expect(content).toContain('newco.com');
    });
  });

  describe('deduplicateCompanies', () => {
    it('should filter out companies already in existing accounts', () => {
      const existing = [
        { website: 'existing.com', account_name: 'Existing Co' },
        { website: 'another.com', account_name: 'Another Co' }
      ];

      const newCompanies: CompanyDBCompany[] = [
        { company_name: 'New Co', company_website_domain: 'newco.com' },
        { company_name: 'Existing Co', company_website_domain: 'existing.com' },
        { company_name: 'Fresh Co', company_website_domain: 'fresh.com' }
      ];

      const deduplicated = deduplicateCompanies(newCompanies, existing);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.find(c => c.company_website_domain === 'existing.com')).toBeUndefined();
    });

    it('should normalize domains for comparison', () => {
      const existing = [
        { website: 'http://www.test.com/', account_name: 'Test' }
      ];

      const newCompanies: CompanyDBCompany[] = [
        { company_name: 'Test', company_website_domain: 'test.com' }
      ];

      const deduplicated = deduplicateCompanies(newCompanies, existing);

      expect(deduplicated).toHaveLength(0);
    });
  });
});
