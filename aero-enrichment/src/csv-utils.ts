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
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';  // Add single quote to result
        i++;  // Skip next quote
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
 * Handles: http://, https://, www., trailing slashes, paths, query params
 */
function normalizeDomain(domain: string | undefined): string {
  if (!domain) return '';

  let normalized = domain
    .toLowerCase()
    .trim()
    // Remove protocol
    .replace(/^https?:\/\//, '')
    // Remove www.
    .replace(/^www\./, '')
    // Remove trailing slash
    .replace(/\/$/, '')
    // Remove path, query params, and fragments
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .trim();

  // Handle edge cases like empty result
  return normalized || '';
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
 * Uses company_website_domain field with proper normalization on both sides
 */
export function deduplicateCompanies(
  newCompanies: CompanyDBCompany[],
  existingAccounts: ExistingAccount[]
): CompanyDBCompany[] {
  // Build lookup set from existing accounts using normalized website field
  const existingDomains = new Set<string>();
  for (const acc of existingAccounts) {
    const domain = normalizeDomain(acc.website);
    if (domain) {
      existingDomains.add(domain);
    }
  }

  console.log(`Built lookup set with ${existingDomains.size} unique existing domains`);

  // Debug: Show sample existing domains
  const sampleExisting = Array.from(existingDomains).slice(0, 5);
  console.log(`Sample existing domains: ${sampleExisting.join(', ')}`);

  // Filter out duplicates using company_website_domain field
  const deduplicated: CompanyDBCompany[] = [];
  const duplicates: string[] = [];

  for (const company of newCompanies) {
    // Use company_website_domain as primary field for matching
    const domain = normalizeDomain(company.company_website_domain);

    if (domain && existingDomains.has(domain)) {
      duplicates.push(`${company.company_name} (${domain})`);
    } else {
      deduplicated.push(company);
    }
  }

  console.log(`Removed ${duplicates.length} duplicates, ${deduplicated.length} net new companies remaining`);

  // Show sample duplicates found
  if (duplicates.length > 0) {
    console.log(`Sample duplicates: ${duplicates.slice(0, 10).join(', ')}`);
  }

  return deduplicated;
}
