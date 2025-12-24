# TAM Expansion Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TAM expansion tool that discovers net-new fintech/financial services companies using CrustData API with high-recall filters, then deduplicates against existing 15k account list.

**Architecture:** TypeScript service using existing CrustDataClient with POST endpoint for CompanyDB search v2. Implements high-recall filter recipe (geography + employee size + keyword matching), paginated data collection, CSV export, and deduplication logic comparing against existing account domains/names.

**Tech Stack:** TypeScript, Node.js 18+, CrustData CompanyDB API v2, CSV processing (native fs)

---

## Task 1: Update CrustData Client for CompanyDB Search v2

**Files:**
- Modify: `src/crustdata-client.ts:27-81`
- Modify: `src/types.ts:1-50`

**Step 1: Write failing test for CompanyDB search**

Create: `src/crustdata-client.test.ts`

```typescript
import { CrustDataClient } from './crustdata-client';

describe('CrustDataClient - CompanyDB Search v2', () => {
  let client: CrustDataClient;

  beforeEach(() => {
    client = new CrustDataClient({
      apiKey: process.env.CRUSTDATA_API_KEY || 'test-key'
    });
  });

  it('should execute companydb search with complex filters', async () => {
    const filters = {
      op: 'and',
      conditions: [
        {
          filter_type: 'hq_location',
          type: '(.)',
          value: 'United States'
        },
        {
          filter_type: 'employee_count_range',
          type: 'in',
          value: ['51-200', '201-500']
        }
      ]
    };

    const result = await client.searchCompanyDB({
      filters,
      limit: 10
    });

    expect(result).toHaveProperty('companies');
    expect(result).toHaveProperty('total_count');
    expect(Array.isArray(result.companies)).toBe(true);
  });

  it('should support pagination with cursor', async () => {
    const filters = {
      filter_type: 'hq_country',
      type: '=',
      value: 'United States'
    };

    const firstPage = await client.searchCompanyDB({
      filters,
      limit: 100
    });

    expect(firstPage).toHaveProperty('next_cursor');

    if (firstPage.next_cursor) {
      const secondPage = await client.searchCompanyDB({
        filters,
        limit: 100,
        cursor: firstPage.next_cursor
      });

      expect(secondPage.companies).toBeDefined();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- crustdata-client.test.ts`
Expected: FAIL - "searchCompanyDB is not a function"

**Step 3: Add TypeScript types for CompanyDB search**

Edit `src/types.ts` - Add after existing CrustData types:

```typescript
// CompanyDB Search v2 Types
export interface CompanyDBFilterCondition {
  filter_type: string;
  type: '=' | '!=' | 'in' | 'not_in' | '>' | '<' | '=>' | '=<' | '(.)' | '[.]';
  value: string | number | boolean | string[] | number[];
}

export interface CompanyDBFilterGroup {
  op: 'and' | 'or';
  conditions: (CompanyDBFilterCondition | CompanyDBFilterGroup)[];
}

export type CompanyDBFilter = CompanyDBFilterCondition | CompanyDBFilterGroup;

export interface CompanyDBSortCriteria {
  column: string;
  order: 'asc' | 'desc';
}

export interface CompanyDBSearchParams {
  filters: CompanyDBFilter;
  cursor?: string;
  limit?: number;
  sorts?: CompanyDBSortCriteria[];
}

export interface CompanyDBCompany {
  company_id?: string;
  company_name?: string;
  linkedin_profile_url?: string;
  linkedin_id?: string;
  company_website_domain?: string;
  company_website?: string;
  hq_location?: string;
  hq_country?: string;
  hq_state?: string;
  year_founded?: string;
  employee_count_range?: string;
  employee_metrics?: {
    latest_count?: number;
    growth_6m?: number;
    growth_12m?: number;
    growth_6m_percent?: number;
    growth_12m_percent?: number;
  };
  linkedin_company_description?: string;
  linkedin_industries?: string[];
  crunchbase_categories?: string[];
  markets?: string[];
  company_type?: string;
  last_funding_round_type?: string;
  last_funding_date?: string;
  crunchbase_total_investment_usd?: number;
  estimated_revenue_lower_bound_usd?: number;
  estimated_revenue_higher_bound_usd?: number;
  [key: string]: any;
}

export interface CompanyDBSearchResponse {
  companies: CompanyDBCompany[];
  next_cursor?: string;
  total_count?: number;
}
```

**Step 4: Implement searchCompanyDB method**

Edit `src/crustdata-client.ts` - Add new method after line 147:

```typescript
  /**
   * Search CompanyDB using v2 API with advanced filters
   * Uses POST /screener/companydb/search endpoint
   */
  async searchCompanyDB(params: CompanyDBSearchParams): Promise<CompanyDBSearchResponse> {
    const url = `${this.baseUrl}/screener/companydb/search`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `CompanyDB search failed: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = await response.json();
      return data as CompanyDBSearchResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`CompanyDB search timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }
```

**Step 5: Update imports in crustdata-client.ts**

Edit `src/crustdata-client.ts` line 1-7:

```typescript
import {
  CrustDataCompany,
  CrustDataCompanyResponse,
  CrustDataSearchParams,
  CrustDataSearchResponse,
  CrustDataClientOptions,
  CompanyDBSearchParams,
  CompanyDBSearchResponse
} from './types';
```

**Step 6: Run test to verify it passes**

Run: `npm test -- crustdata-client.test.ts`
Expected: PASS (if CRUSTDATA_API_KEY is set) or descriptive error about missing API key

**Step 7: Commit**

```bash
git add src/crustdata-client.ts src/types.ts src/crustdata-client.test.ts
git commit -m "feat: add CompanyDB search v2 support with complex filters and pagination"
```

---

## Task 2: Create TAM Expansion Service

**Files:**
- Create: `src/tam-expansion-service.ts`
- Create: `src/tam-expansion-service.test.ts`

**Step 1: Write failing test for high-recall filter construction**

Create: `src/tam-expansion-service.test.ts`

```typescript
import { TAMExpansionService } from './tam-expansion-service';
import { CompanyDBFilter } from './types';

describe('TAMExpansionService', () => {
  let service: TAMExpansionService;

  beforeEach(() => {
    service = new TAMExpansionService({
      apiKey: process.env.CRUSTDATA_API_KEY || 'test-key'
    });
  });

  describe('buildHighRecallFilter', () => {
    it('should build filter with all required conditions', () => {
      const filter = service.buildHighRecallFilter();

      expect(filter).toHaveProperty('op', 'and');
      expect(filter.conditions).toHaveLength(3);

      // Should have location filter
      const locationFilter = filter.conditions.find(
        c => 'filter_type' in c && c.filter_type === 'hq_location'
      );
      expect(locationFilter).toBeDefined();

      // Should have employee size filter
      const employeeFilter = filter.conditions.find(
        c => 'filter_type' in c && c.filter_type === 'employee_count_range'
      );
      expect(employeeFilter).toBeDefined();

      // Should have keyword filter
      const keywordFilter = filter.conditions.find(
        c => 'filter_type' in c && c.filter_type === 'linkedin_company_description'
      );
      expect(keywordFilter).toBeDefined();
    });
  });

  describe('searchWithHighRecall', () => {
    it('should return companies matching high-recall criteria', async () => {
      const result = await service.searchWithHighRecall({ limit: 10 });

      expect(result).toHaveProperty('companies');
      expect(result).toHaveProperty('total_count');
      expect(result.companies.length).toBeLessThanOrEqual(10);
    });
  });

  describe('collectAllCompanies', () => {
    it('should paginate through all results', async () => {
      const companies = await service.collectAllCompanies({ maxResults: 100 });

      expect(Array.isArray(companies)).toBe(true);
      expect(companies.length).toBeLessThanOrEqual(100);

      // Each company should have required fields
      companies.forEach(company => {
        expect(company).toHaveProperty('company_name');
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tam-expansion-service.test.ts`
Expected: FAIL - "Cannot find module './tam-expansion-service'"

**Step 3: Implement TAM expansion service**

Create: `src/tam-expansion-service.ts`

```typescript
import { CrustDataClient } from './crustdata-client';
import {
  CompanyDBFilter,
  CompanyDBFilterGroup,
  CompanyDBSearchParams,
  CompanyDBCompany,
  CrustDataClientOptions
} from './types';

export interface TAMExpansionOptions extends CrustDataClientOptions {
  batchSize?: number;
  maxRetries?: number;
}

export interface SearchOptions {
  limit?: number;
  maxResults?: number;
}

export class TAMExpansionService {
  private client: CrustDataClient;
  private batchSize: number;
  private maxRetries: number;

  constructor(options: TAMExpansionOptions = {}) {
    this.client = new CrustDataClient(options);
    this.batchSize = options.batchSize ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /**
   * Build high-recall filter according to spec:
   * - Countries: US, UK, Canada, Brazil, India, Australia, Germany, France, China, Sweden
   * - Employee size: 51+ (exclude 0-50)
   * - Keywords: fintech, financial services, digital bank, etc.
   */
  buildHighRecallFilter(): CompanyDBFilterGroup {
    const countries = [
      'United States',
      'United Kingdom',
      'Canada',
      'Brazil',
      'India',
      'Australia',
      'Germany',
      'France',
      'China',
      'Sweden'
    ];

    const employeeSizes = [
      '51-200',
      '201-500',
      '501-1000',
      '1001-5000',
      '5001-10000',
      '10001+'
    ];

    // Keywords using fuzzy text search on LinkedIn description
    const keywords = [
      'fintech',
      'financial services',
      'digital bank',
      'online bank',
      'mobile bank',
      'credit union',
      'lending platform',
      'lender',
      'lending',
      'loan origination',
      'consumer lending',
      'auto lending',
      'mortgage',
      'credit card',
      'payments',
      'payment processing',
      'card issuing',
      'insurance',
      'insurtech',
      'online marketplace',
      'marketplace',
      'crypto exchange',
      'cryptocurrency',
      'blockchain',
      'digital asset'
    ].join(' OR ');

    return {
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: countries.map(country => ({
            filter_type: 'hq_location',
            type: '(.)',
            value: country
          }))
        },
        {
          filter_type: 'employee_count_range',
          type: 'in',
          value: employeeSizes
        },
        {
          filter_type: 'linkedin_company_description',
          type: '(.)',
          value: keywords
        }
      ]
    };
  }

  /**
   * Execute high-recall search with pagination support
   */
  async searchWithHighRecall(options: SearchOptions = {}): Promise<{
    companies: CompanyDBCompany[];
    next_cursor?: string;
    total_count?: number;
  }> {
    const filter = this.buildHighRecallFilter();
    const limit = options.limit ?? this.batchSize;

    return await this.client.searchCompanyDB({
      filters: filter,
      limit,
      sorts: [
        {
          column: 'employee_metrics.latest_count',
          order: 'desc'
        }
      ]
    });
  }

  /**
   * Collect all companies matching high-recall criteria
   * Handles pagination automatically
   */
  async collectAllCompanies(options: SearchOptions = {}): Promise<CompanyDBCompany[]> {
    const maxResults = options.maxResults ?? Infinity;
    const allCompanies: CompanyDBCompany[] = [];
    let cursor: string | undefined;
    let retryCount = 0;

    console.log(`Starting TAM expansion search (max: ${maxResults} companies)...`);

    while (allCompanies.length < maxResults) {
      try {
        const remaining = maxResults - allCompanies.length;
        const limit = Math.min(this.batchSize, remaining);

        const result = await this.client.searchCompanyDB({
          filters: this.buildHighRecallFilter(),
          limit,
          cursor,
          sorts: [
            {
              column: 'employee_metrics.latest_count',
              order: 'desc'
            }
          ]
        });

        if (result.companies.length === 0) {
          console.log('No more companies found');
          break;
        }

        allCompanies.push(...result.companies);
        console.log(`Collected ${allCompanies.length} companies (total available: ${result.total_count ?? 'unknown'})`);

        cursor = result.next_cursor;
        if (!cursor) {
          console.log('Reached end of results');
          break;
        }

        retryCount = 0; // Reset retry count on success

        // Rate limiting: brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        retryCount++;
        console.error(`Error fetching companies (attempt ${retryCount}/${this.maxRetries}):`, error);

        if (retryCount >= this.maxRetries) {
          console.error('Max retries reached, stopping collection');
          throw error;
        }

        // Exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    console.log(`Collection complete: ${allCompanies.length} companies`);
    return allCompanies;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tam-expansion-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tam-expansion-service.ts src/tam-expansion-service.test.ts
git commit -m "feat: add TAM expansion service with high-recall filters"
```

---

## Task 3: Create CSV Processing Utilities

**Files:**
- Create: `src/csv-utils.ts`
- Create: `src/csv-utils.test.ts`

**Step 1: Write failing test for CSV operations**

Create: `src/csv-utils.test.ts`

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- csv-utils.test.ts`
Expected: FAIL - "Cannot find module './csv-utils'"

**Step 3: Implement CSV utilities**

Create: `src/csv-utils.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { CompanyDBCompany } from './types';

export interface ExistingAccount {
  account_id?: string;
  account_name?: string;
  website?: string;
  [key: string]: any;
}

/**
 * Simple CSV parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
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

/**
 * Read existing accounts from CSV file
 */
export async function readExistingAccounts(csvPath: string): Promise<ExistingAccount[]> {
  const content = await fs.readFile(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return [];
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse rows
  const accounts: ExistingAccount[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const account: ExistingAccount = {};

    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/^\uFEFF/, '').replace(/^"(.*)"$/, '$1'); // Remove BOM and quotes
      let value = values[index] || '';

      // Remove surrounding quotes if present
      value = value.replace(/^"(.*)"$/, '$1');

      account[cleanHeader] = value;
    });

    accounts.push(account);
  }

  return accounts;
}

/**
 * Write companies to CSV file
 */
export async function writeCompaniesToCSV(
  companies: CompanyDBCompany[],
  outputPath: string
): Promise<void> {
  if (companies.length === 0) {
    console.log('No companies to write');
    return;
  }

  // Determine all unique keys
  const allKeys = new Set<string>();
  companies.forEach(company => {
    Object.keys(company).forEach(key => allKeys.add(key));
  });

  const headers = Array.from(allKeys);

  // Escape CSV value
  function escapeCSV(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    let str = String(value);

    // If value contains comma, newline, or quotes, wrap in quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
  }

  // Build CSV content
  const lines: string[] = [];
  lines.push(headers.join(','));

  companies.forEach(company => {
    const row = headers.map(header => {
      const value = company[header];

      // Handle nested objects/arrays
      if (typeof value === 'object' && value !== null) {
        return escapeCSV(JSON.stringify(value));
      }

      return escapeCSV(value);
    });

    lines.push(row.join(','));
  });

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Write file
  await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
  console.log(`Wrote ${companies.length} companies to ${outputPath}`);
}

/**
 * Normalize domain for comparison
 */
function normalizeDomain(domain: string | undefined): string {
  if (!domain) return '';

  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .trim();
}

/**
 * Normalize company name for comparison
 */
function normalizeName(name: string | undefined): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Deduplicate companies against existing accounts
 */
export function deduplicateCompanies(
  newCompanies: CompanyDBCompany[],
  existingAccounts: ExistingAccount[]
): CompanyDBCompany[] {
  // Build lookup sets for fast comparison
  const existingDomains = new Set(
    existingAccounts
      .map(acc => normalizeDomain(acc.website))
      .filter(d => d)
  );

  const existingNames = new Set(
    existingAccounts
      .map(acc => normalizeName(acc.account_name))
      .filter(n => n)
  );

  // Filter out duplicates
  const deduplicated = newCompanies.filter(company => {
    const domain = normalizeDomain(company.company_website_domain || company.company_website);
    const name = normalizeName(company.company_name);

    // Exclude if domain or name matches
    const isDomainDuplicate = domain && existingDomains.has(domain);
    const isNameDuplicate = name && existingNames.has(name);

    return !isDomainDuplicate && !isNameDuplicate;
  });

  const removedCount = newCompanies.length - deduplicated.length;
  console.log(`Removed ${removedCount} duplicates, ${deduplicated.length} net new companies remaining`);

  return deduplicated;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- csv-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/csv-utils.ts src/csv-utils.test.ts
git commit -m "feat: add CSV utilities for reading, writing, and deduplication"
```

---

## Task 4: Create Main TAM Expansion Script

**Files:**
- Create: `src/tam-expansion.ts`

**Step 1: Write the script (no test needed for CLI script)**

Create: `src/tam-expansion.ts`

```typescript
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

  // Step 2: Search for companies with high-recall filters
  console.log(`\nStep 2: Searching for companies (sample size: ${sampleSize})...`);
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
      console.log('\n✓ TAM expansion complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ TAM expansion failed:');
      console.error(error);
      process.exit(1);
    });
}

export { runTAMExpansion };
```

**Step 2: Make script executable**

Run: `chmod +x src/tam-expansion.ts`

**Step 3: Add npm script for easy execution**

Edit `package.json` - add to scripts section:

```json
"tam-expansion": "tsx src/tam-expansion.ts",
"tam-expansion:sample": "tsx src/tam-expansion.ts --sample-size 100",
"tam-expansion:full": "tsx src/tam-expansion.ts --sample-size 10000"
```

**Step 4: Test the script with sample data**

Run: `npm run tam-expansion:sample`
Expected: Script executes, creates output CSV with net new companies

**Step 5: Commit**

```bash
git add src/tam-expansion.ts package.json
git commit -m "feat: add TAM expansion CLI script with configurable options"
```

---

## Task 5: Create README Documentation

**Files:**
- Create: `docs/TAM-EXPANSION.md`

**Step 1: Write documentation**

Create: `docs/TAM-EXPANSION.md`

```markdown
# TAM Expansion Tool

## Overview

The TAM (Total Addressable Market) Expansion Tool discovers net-new fintech and financial services companies using the CrustData CompanyDB API with high-recall filters, then deduplicates them against your existing account list.

## Features

- **High-Recall Search**: Targets 10 key countries with companies 51+ employees matching fintech/financial services keywords
- **Smart Deduplication**: Compares against existing accounts by domain and normalized company name
- **Pagination Support**: Handles large result sets with automatic cursor-based pagination
- **Rate Limiting**: Built-in delays and retry logic to respect API limits
- **CSV Export**: Exports results in CSV format with all company fields

## Quick Start

### 1. Sample Run (100 companies)

```bash
npm run tam-expansion:sample
```

This will:
- Search for 100 companies matching high-recall criteria
- Compare against existing accounts in `data/Propensity Scoring Accounts.csv`
- Output net-new companies to `data/tam-expansion-results.csv`

### 2. Full Run (10,000 companies)

```bash
npm run tam-expansion:full
```

### 3. Custom Configuration

```bash
npm run tam-expansion -- \
  --sample-size 500 \
  --existing ./path/to/existing-accounts.csv \
  --output ./path/to/output.csv
```

## High-Recall Filter Specification

### Geography
- United States
- United Kingdom
- Canada
- Brazil
- India
- Australia
- Germany
- France
- China
- Sweden

### Company Size
- 51-200 employees
- 201-500 employees
- 501-1,000 employees
- 1,001-5,000 employees
- 5,001-10,000 employees
- 10,001+ employees

### Keywords (LinkedIn Description)
fintech, financial services, digital bank, online bank, mobile bank, credit union, lending platform, lender, lending, loan origination, consumer lending, auto lending, mortgage, credit card, payments, payment processing, card issuing, insurance, insurtech, online marketplace, marketplace, crypto exchange, cryptocurrency, blockchain, digital asset

## Output Fields

The output CSV includes all available fields from CrustData:

- `company_name` - Company name
- `company_website_domain` - Primary domain
- `linkedin_id` - LinkedIn company ID
- `linkedin_profile_url` - LinkedIn profile URL
- `hq_location` - Headquarters location
- `hq_country` - Country
- `employee_count_range` - Employee size range
- `employee_metrics` - Employee count and growth data
- `linkedin_company_description` - Company description
- `linkedin_industries` - Industry tags
- `company_type` - Public/Private/etc
- `year_founded` - Year founded
- And many more...

## Deduplication Logic

Companies are considered duplicates if:

1. **Domain match**: `company_website_domain` matches existing account's `website` (normalized)
2. **Name match**: `company_name` matches existing account's `account_name` (normalized)

Normalization:
- Removes protocol (`http://`, `https://`)
- Removes `www.`
- Converts to lowercase
- Removes special characters (for name matching)

## Architecture

```
TAMExpansionService
├── buildHighRecallFilter()     - Constructs CompanyDB search filter
├── searchWithHighRecall()      - Single search with pagination
└── collectAllCompanies()       - Collects all pages up to maxResults

CSV Utils
├── readExistingAccounts()      - Parses existing accounts CSV
├── writeCompaniesToCSV()       - Writes results to CSV
└── deduplicateCompanies()      - Filters duplicates

CrustDataClient
└── searchCompanyDB()           - POST /screener/companydb/search
```

## Expected Results

Based on the spec, the high-recall filter should:

- **Recall**: High (captures most Tier A financial/lender/marketplace/crypto companies)
- **Precision**: Moderate (will include some Tier B/C financials and big incumbents)

From 15,000 existing accounts to potentially 50,000+ total addressable market.

## API Rate Limits

- CrustData API: 60 requests per minute
- Built-in 1-second delay between requests
- Exponential backoff on errors

## Troubleshooting

### "Missing CrustData API key"

Set your API key in `.env.local`:
```
CRUSTDATA_API_KEY=your_key_here
```

### "Request timed out"

Increase timeout in service initialization:
```typescript
new TAMExpansionService({
  apiKey: process.env.CRUSTDATA_API_KEY,
  timeout: 60000 // 60 seconds
})
```

### "Rate limit exceeded"

The service includes automatic retry with exponential backoff. If you continue to hit limits, reduce `batchSize` or increase delays.

## Next Steps

1. Run sample (100 companies) to validate results
2. Review output quality and adjust filters if needed
3. Run full expansion (10,000+) to build complete TAM list
4. Import results into your CRM/sales system
```

**Step 2: Commit documentation**

```bash
git add docs/TAM-EXPANSION.md
git commit -m "docs: add comprehensive TAM expansion tool documentation"
```

---

## Task 6: Update Main README

**Files:**
- Modify: `README.md`

**Step 1: Add TAM expansion section to README**

Edit `README.md` - Add section after existing content:

```markdown
## TAM Expansion Tool

Discover net-new companies in your total addressable market using high-recall filters.

### Quick Start

```bash
# Sample run (100 companies)
npm run tam-expansion:sample

# Full run (10,000 companies)
npm run tam-expansion:full
```

See [TAM Expansion Documentation](./docs/TAM-EXPANSION.md) for detailed usage and configuration.

### Features

- High-recall search across 10 countries, 51+ employees, fintech/financial keywords
- Automatic deduplication against existing accounts
- CSV export with complete company data
- Pagination and rate limiting built-in
```

**Step 2: Commit README update**

```bash
git add README.md
git commit -m "docs: add TAM expansion tool to main README"
```

---

## Task 7: Create Integration Test

**Files:**
- Create: `src/tam-expansion.integration.test.ts`

**Step 1: Write integration test**

Create: `src/tam-expansion.integration.test.ts`

```typescript
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

    // Verify output file was created
    const stats = await fs.stat(outputPath);
    expect(stats.isFile()).toBe(true);

    // Verify content
    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain('company_name');

    // Verify duplicates were removed
    expect(content.toLowerCase()).not.toContain('coinbase');
    expect(content.toLowerCase()).not.toContain('stripe');
  }, 60000); // 60 second timeout for API calls
});
```

**Step 2: Run integration test**

Run: `npm test -- tam-expansion.integration.test.ts`
Expected: PASS (if API key is set)

**Step 3: Commit integration test**

```bash
git add src/tam-expansion.integration.test.ts
git commit -m "test: add end-to-end integration test for TAM expansion"
```

---

## Final Verification Steps

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Run sample TAM expansion**

```bash
npm run tam-expansion:sample
```

Expected:
- Script completes successfully
- Output file created at `data/tam-expansion-results.csv`
- Console shows deduplication stats

**Step 3: Verify output quality**

```bash
head -20 data/tam-expansion-results.csv
wc -l data/tam-expansion-results.csv
```

Expected:
- CSV has proper headers
- Contains company data
- Shows net new companies (not in existing list)

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: TAM expansion tool complete - tested and documented"
git push
```

---

## Summary

This plan implements a complete TAM expansion tool that:

1. **Searches** CrustData CompanyDB with high-recall filters (10 countries, 51+ employees, fintech keywords)
2. **Collects** all matching companies with automatic pagination (configurable sample size)
3. **Deduplicates** against 15k existing accounts by domain and name
4. **Exports** net-new companies to CSV with all available fields

**Key Components:**
- `CrustDataClient.searchCompanyDB()` - API integration with v2 endpoint
- `TAMExpansionService` - High-recall filter construction and pagination
- `csv-utils` - CSV reading, writing, and deduplication
- `tam-expansion.ts` - CLI script with options
- Comprehensive tests and documentation

**Usage:**
```bash
npm run tam-expansion:sample   # 100 companies
npm run tam-expansion:full     # 10,000 companies
```

**Expected Output:** CSV file with net-new companies, deduplicated against existing accounts.
