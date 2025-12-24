#!/usr/bin/env npx tsx
/**
 * TAM Extraction v4 - Extract ALL fields from CrustData API
 * Includes all 52 fields returned by the API with correct mappings
 */
import * as fs from 'fs';
import * as path from 'path';
import { TAMExpansionService } from '../src/tam-expansion-service';

const OUTPUT_FILE = path.join(__dirname, '../data/tam-expansion-v4-results.csv');

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

  console.log('Starting TAM Extraction v4 (ALL FIELDS)...');
  console.log('Output file:', OUTPUT_FILE);

  // Get first batch to get total count
  const firstResult = await service.searchWithHighRecall({ limit: 10 });
  console.log(`Total companies matching filter: ${firstResult.total_count ?? 'unknown'}`);

  // Collect all companies
  console.log('\nCollecting all companies...');
  const allCompanies = await service.collectAllCompanies({ maxResults: 50000 });
  console.log(`Collected ${allCompanies.length} companies`);

  // All 52 fields from CrustData API (correctly mapped)
  const headers = [
    // Core identifiers
    'company_id',
    'company_name',
    'company_type',
    'year_founded',

    // Website & domains
    'company_website',
    'company_website_domain',
    'domains',

    // Location
    'hq_country',
    'hq_location',
    'hq_location_address_components',
    'hq_street_address_and_city',
    'largest_headcount_country',
    'office_addresses',

    // LinkedIn data
    'linkedin_id',
    'linkedin_profile_url',
    'linkedin_profile_name',
    'linkedin_company_description',
    'linkedin_industries',
    'linkedin_categories',

    // Employee metrics
    'employee_count_range',
    'employee_metrics',
    'region_distribution',
    'role_distribution',
    'role_distribution_percent',
    'role_growth_6m',
    'role_growth_yoy',
    'skill_distribution',
    'skill_distribution_percent',

    // Financials
    'estimated_revenue_lower_bound_usd',
    'estimated_revenue_higher_bound_usd',
    'crunchbase_total_investment_usd',
    'crunchbase_valuation_usd',
    'crunchbase_valuation_lower_bound_usd',
    'last_funding_round_type',
    'last_funding_round_investment_usd',

    // Investors
    'crunchbase_investors',
    'tracxn_investors',

    // Crunchbase data
    'crunchbase_uuid',
    'crunchbase_profile_url',
    'crunchbase_categories',

    // Social media
    'twitter_handle',
    'twitter_profile_url',
    'follower_metrics',

    // Other
    'logo_permalink',
    'markets',
    'acquisition_status',
    'competitor_ids',
    'stock_symbols',
    'fiscal_year_end',

    // Metadata
    'indexed_at',
    'updated_at',
    'growth_calculation_date'
  ];

  // Write CSV
  const csvLines: string[] = [headers.join(',')];

  for (const company of allCompanies) {
    const row = [
      // Core identifiers
      escapeCSV(company.company_id),
      escapeCSV(company.company_name),
      escapeCSV(company.company_type),
      escapeCSV(company.year_founded),

      // Website & domains
      escapeCSV(company.company_website),
      escapeCSV(company.company_website_domain),
      `"${jsonEscape(company.domains)}"`,

      // Location
      escapeCSV(company.hq_country),
      escapeCSV(company.hq_location),
      `"${jsonEscape(company.hq_location_address_components)}"`,
      escapeCSV(company.hq_street_address_and_city),
      escapeCSV(company.largest_headcount_country),
      `"${jsonEscape(company.office_addresses)}"`,

      // LinkedIn data
      escapeCSV(company.linkedin_id),
      escapeCSV(company.linkedin_profile_url),
      escapeCSV(company.linkedin_profile_name),
      escapeCSV(company.linkedin_company_description),
      `"${jsonEscape(company.linkedin_industries)}"`,
      `"${jsonEscape(company.linkedin_categories)}"`,

      // Employee metrics
      escapeCSV(company.employee_count_range),
      `"${jsonEscape(company.employee_metrics)}"`,
      `"${jsonEscape(company.region_distribution)}"`,
      `"${jsonEscape(company.role_distribution)}"`,
      `"${jsonEscape(company.role_distribution_percent)}"`,
      `"${jsonEscape(company.role_growth_6m)}"`,
      `"${jsonEscape(company.role_growth_yoy)}"`,
      `"${jsonEscape(company.skill_distribution)}"`,
      `"${jsonEscape(company.skill_distribution_percent)}"`,

      // Financials
      escapeCSV(company.estimated_revenue_lower_bound_usd),
      escapeCSV(company.estimated_revenue_higher_bound_usd),
      escapeCSV(company.crunchbase_total_investment_usd),
      escapeCSV(company.crunchbase_valuation_usd),
      escapeCSV(company.crunchbase_valuation_lower_bound_usd),
      escapeCSV(company.last_funding_round_type),
      escapeCSV(company.last_funding_round_investment_usd),

      // Investors
      `"${jsonEscape(company.crunchbase_investors)}"`,
      `"${jsonEscape(company.tracxn_investors)}"`,

      // Crunchbase data
      escapeCSV(company.crunchbase_uuid),
      escapeCSV(company.crunchbase_profile_url),
      `"${jsonEscape(company.crunchbase_categories)}"`,

      // Social media
      escapeCSV(company.twitter_handle),
      escapeCSV(company.twitter_profile_url),
      `"${jsonEscape(company.follower_metrics)}"`,

      // Other
      escapeCSV(company.logo_permalink),
      `"${jsonEscape(company.markets)}"`,
      escapeCSV(company.acquisition_status),
      `"${jsonEscape(company.competitor_ids)}"`,
      `"${jsonEscape(company.stock_symbols)}"`,
      escapeCSV(company.fiscal_year_end),

      // Metadata
      escapeCSV(company.indexed_at),
      escapeCSV(company.updated_at),
      escapeCSV(company.growth_calculation_date)
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

  // Sample data quality check
  console.log('\n=== Data Quality Check (first 5 companies) ===');
  for (const company of allCompanies.slice(0, 5)) {
    console.log(`  ${company.company_name}:`);
    console.log(`    - Valuation: ${company.crunchbase_valuation_usd ?? 'N/A'}`);
    console.log(`    - Last Round: $${company.last_funding_round_investment_usd?.toLocaleString() ?? 'N/A'}`);
    console.log(`    - Followers: ${company.follower_metrics?.linkedin_follower_count ?? 'N/A'}`);
    console.log(`    - Skills: ${(company.skill_distribution || []).slice(0, 3).map((s: any) => s.skill_name).join(', ') || 'N/A'}`);
  }
}

main().catch(console.error);
