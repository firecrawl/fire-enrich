#!/usr/bin/env npx tsx
/**
 * TAM Extraction v3 - Extract all companies matching updated filters
 * Uses complete 56-field schema matching V2 format
 */
import * as fs from 'fs';
import * as path from 'path';
import { TAMExpansionService } from '../src/tam-expansion-service';

const OUTPUT_FILE = path.join(__dirname, '../data/tam-expansion-v3-results.csv');

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function jsonEscape(value: any): string {
  if (value === null || value === undefined) return '';
  return JSON.stringify(value).replace(/"/g, '""');
}

async function main() {
  const apiKey = process.env.CRUSTDATA_API_KEY || '2b09d78c3e1cc5be326344112fc5309f3e5caf2d';
  const service = new TAMExpansionService({ apiKey, batchSize: 1000 });

  console.log('Starting TAM Extraction v3 (Complete 56-field schema)...');
  console.log('Output file:', OUTPUT_FILE);

  // Get first batch to get total count
  const firstResult = await service.searchWithHighRecall({ limit: 10 });
  console.log(`Total companies matching filter: ${firstResult.total_count ?? 'unknown'}`);

  // Collect all companies
  console.log('\nCollecting all companies...');
  const allCompanies = await service.collectAllCompanies({ maxResults: 50000 });
  console.log(`Collected ${allCompanies.length} companies`);

  // Complete 56-field schema matching V2 format
  const headers = [
    'company_id',
    'company_name',
    'year_founded',
    'hq_country',
    'hq_street_address_and_city',
    'largest_headcount_country',
    'crunchbase_uuid',
    'crunchbase_valuation_usd',
    'linkedin_profile_name',
    'linkedin_profile_url',
    'linkedin_id',
    'linkedin_categories',
    'linkedin_company_description',
    'linkedin_industries',
    'last_funding_round_type',
    'last_funding_round_investment_usd',
    'hq_location',
    'hq_location_address_components',
    'office_addresses',
    'estimated_revenue_lower_bound_usd',
    'estimated_revenue_higher_bound_usd',
    'employee_count_range',
    'company_type',
    'company_website',
    'company_website_domain',
    'domains',
    'logo_permalink',
    'crunchbase_total_investment_usd',
    'crunchbase_profile_url',
    'acquisition_status',
    'crunchbase_valuation_lower_bound_usd',
    'crunchbase_investors',
    'crunchbase_categories',
    'twitter_profile_url',
    'twitter_handle',
    'competitor_ids',
    'stock_symbols',
    'markets',
    'tracxn_investors',
    'fiscal_year_end',
    'growth_calculation_date',
    'employee_metrics',
    'follower_metrics',
    'skill_distribution',
    'skill_distribution_percent',
    'role_distribution',
    'role_distribution_percent',
    'role_growth_6m',
    'role_growth_yoy',
    'region_distribution',
    'updated_at',
    'indexed_at',
    'crunchbase_valuation_date',
    'ipo_date',
    'last_funding_date',
    'competitor_websites'
  ];

  // Write CSV
  const csvLines: string[] = [headers.join(',')];

  for (const company of allCompanies) {
    const row = [
      escapeCSV(company.company_id),
      escapeCSV(company.company_name),
      escapeCSV(company.year_founded),
      escapeCSV(company.hq_country),
      escapeCSV(company.hq_street_address_and_city),
      escapeCSV(company.largest_headcount_country),
      escapeCSV(company.crunchbase_uuid),
      escapeCSV(company.crunchbase_valuation_usd),
      escapeCSV(company.linkedin_profile_name),
      escapeCSV(company.linkedin_profile_url),
      escapeCSV(company.linkedin_id),
      `"${jsonEscape(company.linkedin_categories)}"`,
      escapeCSV(company.linkedin_company_description),
      `"${jsonEscape(company.linkedin_industries)}"`,
      escapeCSV(company.last_funding_round_type),
      escapeCSV(company.last_funding_round_investment_usd),
      escapeCSV(company.hq_location),
      `"${jsonEscape(company.hq_location_address_components)}"`,
      `"${jsonEscape(company.office_addresses)}"`,
      escapeCSV(company.estimated_revenue_lower_bound_usd),
      escapeCSV(company.estimated_revenue_higher_bound_usd),
      escapeCSV(company.employee_count_range),
      escapeCSV(company.company_type),
      escapeCSV(company.company_website),
      escapeCSV(company.company_website_domain),
      `"${jsonEscape(company.domains)}"`,
      escapeCSV(company.logo_permalink),
      escapeCSV(company.crunchbase_total_investment_usd),
      escapeCSV(company.crunchbase_profile_url),
      escapeCSV(company.acquisition_status),
      escapeCSV(company.crunchbase_valuation_lower_bound_usd),
      `"${jsonEscape(company.crunchbase_investors)}"`,
      `"${jsonEscape(company.crunchbase_categories)}"`,
      escapeCSV(company.twitter_profile_url),
      escapeCSV(company.twitter_handle),
      `"${jsonEscape(company.competitor_ids)}"`,
      `"${jsonEscape(company.stock_symbols)}"`,
      `"${jsonEscape(company.markets)}"`,
      `"${jsonEscape(company.tracxn_investors)}"`,
      escapeCSV(company.fiscal_year_end),
      escapeCSV(company.growth_calculation_date),
      `"${jsonEscape(company.employee_metrics)}"`,
      `"${jsonEscape(company.follower_metrics)}"`,
      `"${jsonEscape(company.skill_distribution)}"`,
      `"${jsonEscape(company.skill_distribution_percent)}"`,
      `"${jsonEscape(company.role_distribution)}"`,
      `"${jsonEscape(company.role_distribution_percent)}"`,
      `"${jsonEscape(company.role_growth_6m)}"`,
      `"${jsonEscape(company.role_growth_yoy)}"`,
      `"${jsonEscape(company.region_distribution)}"`,
      escapeCSV(company.updated_at),
      escapeCSV(company.indexed_at),
      escapeCSV(company.crunchbase_valuation_date),
      escapeCSV(company.ipo_date),
      escapeCSV(company.last_funding_date),
      `"${jsonEscape(company.competitor_websites)}"`
    ];
    csvLines.push(row.join(','));
  }

  fs.writeFileSync(OUTPUT_FILE, csvLines.join('\n'));
  console.log(`\nSaved ${allCompanies.length} companies to ${OUTPUT_FILE}`);

  // Print summary stats
  const countryCounts: Record<string, number> = {};
  const industryCounts: Record<string, number> = {};

  for (const company of allCompanies) {
    const country = company.hq_country || 'Unknown';
    countryCounts[country] = (countryCounts[country] || 0) + 1;

    for (const industry of (company.linkedin_industries || [])) {
      industryCounts[industry] = (industryCounts[industry] || 0) + 1;
    }
  }

  console.log('\n=== Top Countries ===');
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [country, count] of topCountries) {
    console.log(`  ${country}: ${count}`);
  }

  console.log('\n=== Top Industries ===');
  const topIndustries = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [industry, count] of topIndustries) {
    console.log(`  ${industry}: ${count}`);
  }
}

main().catch(console.error);
