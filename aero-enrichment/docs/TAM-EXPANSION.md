# TAM Expansion Tool

## Overview

The TAM (Total Addressable Market) Expansion Tool discovers net-new fintech and financial services companies using the CrustData CompanyDB API with high-recall filters, then deduplicates them against your existing account list.

The tool implements a sophisticated search strategy that balances recall (finding all relevant companies) with precision (avoiding too many irrelevant results) to help you expand your addressable market from 15,000 existing accounts to potentially 50,000+ companies.

## Features

- **High-Recall Search**: Targets 10 key countries with companies 51+ employees matching fintech/financial services keywords
- **Smart Deduplication**: Compares against existing accounts by domain and normalized company name
- **Pagination Support**: Handles large result sets with automatic cursor-based pagination
- **Rate Limiting**: Built-in delays and retry logic to respect API limits
- **CSV Export**: Exports results in CSV format with all company fields
- **Batch Processing**: Configurable batch sizes for efficient API usage (default: 1000 per request)
- **Retry Logic**: Exponential backoff for failed requests (up to 3 retries)
- **Progress Tracking**: Real-time console output showing collection progress

## Quick Start

### Prerequisites

1. Set your CrustData API key in `.env.local`:
   ```bash
   CRUSTDATA_API_KEY=your_key_here
   ```

2. Ensure you have existing accounts CSV at:
   ```
   data/Propensity Scoring Accounts.csv
   ```

### 1. Sample Run (100 companies)

Test the tool with a small sample to validate results:

```bash
npm run tam-expansion:sample
```

This will:
- Search for 100 companies matching high-recall criteria
- Compare against existing accounts in `data/Propensity Scoring Accounts.csv`
- Output net-new companies to `data/tam-expansion-results.csv`

**Expected output:**
```
=== TAM Expansion Tool ===

Step 1: Initializing TAM expansion service...

Step 1.5: Estimating total results with high-recall filter...
Estimated total companies matching criteria: 45,832
Sample size requested: 100
Will collect: 100 companies

Step 2: Searching for companies (collecting 100 of 45,832 available)...
Starting TAM expansion search (max: 100 companies)...
Collected 100 companies (total available: 45832)

Found 100 companies matching high-recall criteria

Step 3: Reading existing accounts from [path]...
Loaded 15000 existing accounts

Step 4: Deduplicating against existing accounts...
Removed 23 duplicates, 77 net new companies remaining

Step 5: Writing 77 net new companies to [path]...
Wrote 77 companies to [path]

=== Summary ===
Total companies found: 100
Existing accounts: 15000
Duplicates removed: 23
Net new companies: 77

Output saved to: [path]
```

### 2. Full Run (10,000 companies)

Run a comprehensive search to build your complete TAM list:

```bash
npm run tam-expansion:full
```

**Note:** This may take 10-20 minutes depending on API rate limits and network conditions.

### 3. Custom Configuration

Customize all parameters for specific use cases:

```bash
npm run tam-expansion -- \
  --sample-size 500 \
  --existing ./path/to/existing-accounts.csv \
  --output ./path/to/output.csv
```

**Available options:**
- `--sample-size <number>`: Maximum number of companies to collect (default: 100)
- `--existing <path>`: Path to existing accounts CSV file
- `--output <path>`: Path to output CSV file

## High-Recall Filter Specification

The tool uses a three-part filter strategy to maximize recall while maintaining relevance:

### Geography (OR condition)

Companies headquartered in any of these 10 countries:

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

**Filter implementation:**
```typescript
{
  op: 'or',
  conditions: countries.map(country => ({
    filter_type: 'hq_location',
    type: '(.)',  // Fuzzy text match
    value: country
  }))
}
```

### Company Size (AND condition)

Companies with 51+ employees (excludes 0-50 range):

- 51-200 employees
- 201-500 employees
- 501-1,000 employees
- 1,001-5,000 employees
- 5,001-10,000 employees
- 10,001+ employees

**Filter implementation:**
```typescript
{
  filter_type: 'employee_count_range',
  type: 'in',
  value: ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+']
}
```

### Keywords (AND condition)

Companies whose LinkedIn description matches fintech/financial services keywords using fuzzy text search:

**Primary categories:**
- **Fintech:** fintech, financial services
- **Banking:** digital bank, online bank, mobile bank, credit union
- **Lending:** lending platform, lender, lending, loan origination, consumer lending, auto lending, mortgage
- **Credit:** credit card
- **Payments:** payments, payment processing, card issuing
- **Insurance:** insurance, insurtech
- **Marketplaces:** online marketplace, marketplace
- **Crypto:** crypto exchange, cryptocurrency, blockchain, digital asset

**Filter implementation:**
```typescript
{
  filter_type: 'linkedin_company_description',
  type: '(.)',  // Fuzzy text match with OR
  value: 'fintech OR financial services OR digital bank OR ...'
}
```

**Complete filter structure:**
```typescript
{
  op: 'and',
  conditions: [
    { /* geography OR filter */ },
    { /* employee size IN filter */ },
    { /* keywords fuzzy match */ }
  ]
}
```

## Output Fields

The output CSV includes all available fields from CrustData CompanyDB API. Common fields include:

### Core Company Information
- `company_id` - CrustData company identifier
- `company_name` - Company name
- `company_website_domain` - Primary domain (e.g., "stripe.com")
- `company_website` - Full website URL
- `linkedin_id` - LinkedIn company ID
- `linkedin_profile_url` - LinkedIn profile URL
- `linkedin_company_description` - Company description from LinkedIn

### Location Data
- `hq_location` - Full headquarters location
- `hq_country` - Country
- `hq_state` - State/province
- `year_founded` - Year the company was founded

### Employee Information
- `employee_count_range` - Employee size range (e.g., "201-500")
- `employee_metrics` - JSON object containing:
  - `latest_count` - Current employee count
  - `growth_6m` - 6-month employee growth (absolute)
  - `growth_12m` - 12-month employee growth (absolute)
  - `growth_6m_percent` - 6-month growth percentage
  - `growth_12m_percent` - 12-month growth percentage

### Industry & Classification
- `linkedin_industries` - Array of LinkedIn industry tags
- `crunchbase_categories` - Array of Crunchbase category tags
- `markets` - Array of market segments
- `company_type` - Company type (Public, Private, etc.)

### Funding Information
- `last_funding_round_type` - Type of last funding round (Series A, B, C, etc.)
- `last_funding_date` - Date of last funding round
- `crunchbase_total_investment_usd` - Total funding raised (USD)

### Revenue Estimates
- `estimated_revenue_lower_bound_usd` - Revenue estimate lower bound (USD)
- `estimated_revenue_higher_bound_usd` - Revenue estimate upper bound (USD)

**Note:** Not all fields are populated for every company. Field availability depends on data availability in CrustData's sources (LinkedIn, Crunchbase, etc.).

## Deduplication Logic

Companies are considered duplicates and excluded if they match existing accounts by either domain or company name.

### Matching Rules

**1. Domain Match**

A company is considered a duplicate if its `company_website_domain` (or `company_website`) matches an existing account's `website` field after normalization.

**2. Name Match**

A company is considered a duplicate if its `company_name` matches an existing account's `account_name` field after normalization.

**Either match triggers deduplication** (OR condition).

### Normalization Process

#### Domain Normalization

Domains are normalized using the following steps:

1. Convert to lowercase
2. Remove protocol (`http://`, `https://`)
3. Remove `www.` prefix
4. Remove trailing slash
5. Extract only the domain (remove path)
6. Trim whitespace

**Examples:**
- `https://www.stripe.com/` → `stripe.com`
- `HTTP://Coinbase.COM/about` → `coinbase.com`
- `www.Square.com` → `square.com`

**Implementation:**
```typescript
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .trim();
}
```

#### Name Normalization

Company names are normalized using the following steps:

1. Convert to lowercase
2. Remove all non-alphanumeric characters
3. Trim whitespace

**Examples:**
- `Stripe, Inc.` → `stripeinc`
- `Square (Block, Inc.)` → `squareblockinc`
- `Coinbase Global, Inc.` → `coinbaseglobalinc`

**Implementation:**
```typescript
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

### Deduplication Performance

The deduplication algorithm uses Set-based lookups for O(1) average-case performance:

1. Build Set of normalized existing account domains
2. Build Set of normalized existing account names
3. Filter new companies in O(n) time using Set lookups

**Example output:**
```
Removed 23 duplicates, 77 net new companies remaining
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TAM Expansion Tool                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │      tam-expansion.ts (CLI Entry)      │
         │  • Argument parsing                    │
         │  • Workflow orchestration              │
         │  • Progress reporting                  │
         └────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  TAMExpansionService        │  │  CSV Utils                  │
│  • buildHighRecallFilter()  │  │  • readExistingAccounts()   │
│  • searchWithHighRecall()   │  │  • writeCompaniesToCSV()    │
│  • collectAllCompanies()    │  │  • deduplicateCompanies()   │
└─────────────────────────────┘  └─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  CrustDataClient            │
│  • searchCompanyDB()        │
│  • POST /screener/          │
│    companydb/search         │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  CrustData CompanyDB API    │
│  • Complex filter support   │
│  • Cursor-based pagination  │
│  • Rate limiting: 60/min    │
└─────────────────────────────┘
```

### Class: TAMExpansionService

**Purpose:** Orchestrates high-recall company searches with pagination and retry logic.

**Key Methods:**

1. **`buildHighRecallFilter(): CompanyDBFilterGroup`**
   - Constructs the three-part filter (geography + size + keywords)
   - Returns structured filter object for API consumption
   - No side effects, pure function

2. **`searchWithHighRecall(options?: SearchOptions): Promise<SearchResult>`**
   - Executes single search request with high-recall filter
   - Returns companies + pagination cursor + total count
   - Useful for testing or single-page results

3. **`collectAllCompanies(options?: SearchOptions): Promise<CompanyDBCompany[]>`**
   - Collects companies across multiple pages up to `maxResults`
   - Handles pagination automatically using cursors
   - Implements rate limiting (1 second between requests)
   - Implements retry logic with exponential backoff
   - Returns flat array of all collected companies

**Configuration:**
```typescript
new TAMExpansionService({
  apiKey: string,           // CrustData API key
  batchSize?: number,       // Companies per request (default: 1000)
  maxRetries?: number,      // Max retry attempts (default: 3)
  timeout?: number          // Request timeout ms (default: 30000)
})
```

### Module: csv-utils

**Purpose:** CSV file processing and deduplication logic.

**Key Functions:**

1. **`readExistingAccounts(csvPath: string): Promise<ExistingAccount[]>`**
   - Parses CSV file with proper quote handling
   - Handles BOM (Byte Order Mark) in UTF-8 files
   - Returns array of account objects

2. **`writeCompaniesToCSV(companies: CompanyDBCompany[], outputPath: string): Promise<void>`**
   - Dynamically determines all unique field names across companies
   - Properly escapes CSV values (quotes, commas, newlines)
   - Serializes nested objects/arrays as JSON strings
   - Creates output directory if needed

3. **`deduplicateCompanies(newCompanies: CompanyDBCompany[], existingAccounts: ExistingAccount[]): CompanyDBCompany[]`**
   - Normalizes domains and names for comparison
   - Uses Set-based lookups for performance
   - Returns filtered array of net-new companies

### Module: crustdata-client

**Key Method:**

**`searchCompanyDB(params: CompanyDBSearchParams): Promise<CompanyDBSearchResponse>`**
- POST request to `/screener/companydb/search`
- Supports complex nested filters (AND/OR/IN/fuzzy match)
- Handles cursor-based pagination
- Implements timeout with AbortController
- Returns companies + next_cursor + total_count

## Expected Results

Based on the high-recall filter specification, you should expect:

### Recall Characteristics

**High Recall (Goal: >90% of target companies)**

The filter is designed to capture most companies in these categories:
- Tier A financial/fintech companies (Stripe, Coinbase, Robinhood, etc.)
- Digital lenders and lending platforms (SoFi, Affirm, LendingClub, etc.)
- Payment processors (Square, Adyen, PayPal, etc.)
- Insurtech companies (Lemonade, Root, Hippo, etc.)
- Online marketplaces with financial components
- Crypto exchanges and blockchain companies
- Neobanks and digital banking platforms

**Moderate Precision (Expected: 60-70%)**

The filter will also include:
- Tier B/C financial services companies (less directly relevant)
- Large traditional financial institutions (Chase, Bank of America, etc.)
- Financial software companies (not necessarily fintech)
- Companies with tangential financial services offerings

### Estimated Numbers

Based on the specification:

- **Starting point:** 15,000 existing accounts
- **High-recall filter results:** ~45,000-50,000 companies
- **After deduplication:** ~30,000-35,000 net-new companies
- **Total addressable market:** ~45,000-50,000 companies

**Growth trajectory:**
```
15,000 existing → 50,000 total TAM ≈ 3.3x expansion
```

### Sample Results Quality

When running a 100-company sample, you should see:

**Geographic distribution:**
- ~60% United States
- ~15% United Kingdom
- ~10% India
- ~5% Germany
- ~10% Other (Canada, Brazil, Australia, France, China, Sweden)

**Company size distribution:**
- ~40% 51-200 employees
- ~30% 201-500 employees
- ~15% 501-1,000 employees
- ~10% 1,001-5,000 employees
- ~5% 5,001+ employees

**Duplication rate:**
- Expect ~20-30% duplication against existing 15k accounts
- Higher duplication rate = more overlap with current TAM
- Lower duplication rate = more net-new opportunities

### Result Validation

To validate result quality, spot-check the output CSV:

```bash
# View first 20 results
head -20 data/tam-expansion-results.csv

# Check company name distribution
cut -d',' -f2 data/tam-expansion-results.csv | head -50

# Check country distribution
cut -d',' -f8 data/tam-expansion-results.csv | sort | uniq -c
```

**Red flags to watch for:**
- No results or very few results → Check API key and filter criteria
- 100% duplication rate → Check existing accounts file path
- Irrelevant companies (non-financial) → Filter may need refinement
- All companies from one country → Geography filter may have issues

## API Rate Limits

### CrustData API Limits

**Official limits:**
- 60 requests per minute
- 10,000 requests per day (typical tier)
- 30-second timeout per request

### Built-in Protections

The tool implements several protections to stay within limits:

**1. Request Delays**
- 1-second delay between paginated requests
- Prevents burst API usage
- ~60 requests per minute (at the limit)

**2. Exponential Backoff**
- On error: retry with increasing delays
- Retry 1: 2-second delay
- Retry 2: 4-second delay
- Retry 3: 8-second delay
- Max delay: 10 seconds

**3. Request Timeout**
- Default: 30 seconds per request
- Configurable via `timeout` option
- Prevents hanging requests

**4. Batch Size**
- Default: 1000 companies per request
- Configurable via `batchSize` option
- Larger batches = fewer API calls

### Optimization Tips

**For large runs (10,000+ companies):**

1. **Use larger batch sizes** (reduces API calls):
   ```typescript
   new TAMExpansionService({
     apiKey: process.env.CRUSTDATA_API_KEY,
     batchSize: 1000  // Max allowed by API
   })
   ```

2. **Run during off-peak hours** (faster responses):
   - Nights and weekends typically have better API performance

3. **Monitor progress** (track rate limit headroom):
   - Watch console output for error messages
   - Look for "429 Too Many Requests" errors

**For testing/development:**

1. **Use small sample sizes** (conserve API quota):
   ```bash
   npm run tam-expansion -- --sample-size 10
   ```

2. **Cache results** (avoid re-fetching same data):
   - Save output CSV and reuse for deduplication testing

## Troubleshooting

### "Missing CrustData API key"

**Symptom:**
```
Error: Missing CrustData API key
```

**Solution:**

1. Create `.env.local` file in project root:
   ```bash
   touch .env.local
   ```

2. Add your API key:
   ```bash
   CRUSTDATA_API_KEY=your_key_here
   ```

3. Restart the script

**Verify API key is loaded:**
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.CRUSTDATA_API_KEY)"
```

### "Request timed out"

**Symptom:**
```
CompanyDB search timed out after 30000ms
```

**Causes:**
- Slow API response
- Network issues
- Complex filter query

**Solutions:**

1. **Increase timeout** (for slow networks):
   ```typescript
   new TAMExpansionService({
     apiKey: process.env.CRUSTDATA_API_KEY,
     timeout: 60000  // 60 seconds
   })
   ```

2. **Check network connection**:
   ```bash
   curl -I https://api.crustdata.com
   ```

3. **Reduce batch size** (smaller requests = faster):
   ```typescript
   new TAMExpansionService({
     batchSize: 500  // Smaller batches
   })
   ```

### "Rate limit exceeded"

**Symptom:**
```
Error 429: Too Many Requests
```

**Causes:**
- Too many requests in short time
- Concurrent runs of the tool
- Other API usage in same account

**Solutions:**

1. **Wait and retry** (automatic):
   - The tool automatically retries with exponential backoff
   - Wait 1-2 minutes before manually retrying

2. **Increase delays** (manual modification):
   ```typescript
   // In tam-expansion-service.ts, line 183:
   await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds instead of 1
   ```

3. **Reduce batch size**:
   ```typescript
   new TAMExpansionService({
     batchSize: 500  // Fewer companies per request
   })
   ```

### "No companies found matching criteria"

**Symptom:**
```
Estimated total companies matching criteria: 0
Warning: No companies found matching the high-recall filter criteria.
```

**Causes:**
- Invalid API key
- API endpoint issues
- Filter criteria too restrictive
- Network connectivity issues

**Solutions:**

1. **Verify API key is valid**:
   - Check with CrustData support
   - Try a simple API call outside the tool

2. **Test with simpler filter**:
   ```typescript
   // Temporarily modify buildHighRecallFilter() to use single country
   const countries = ['United States'];  // Just US for testing
   ```

3. **Check API status**:
   - Visit CrustData status page
   - Contact CrustData support

4. **Enable debug logging**:
   ```bash
   NODE_ENV=development npm run tam-expansion:sample
   ```

### "File not found" errors

**Symptom:**
```
Error: ENOENT: no such file or directory, open 'data/Propensity Scoring Accounts.csv'
```

**Causes:**
- Existing accounts file missing
- Incorrect file path
- Wrong working directory

**Solutions:**

1. **Verify file exists**:
   ```bash
   ls -la "data/Propensity Scoring Accounts.csv"
   ```

2. **Use absolute path**:
   ```bash
   npm run tam-expansion -- --existing /full/path/to/accounts.csv
   ```

3. **Check file permissions**:
   ```bash
   chmod +r "data/Propensity Scoring Accounts.csv"
   ```

### CSV parsing errors

**Symptom:**
```
Error: Invalid CSV format
```
or
```
Loaded 0 existing accounts
```

**Causes:**
- Malformed CSV (unmatched quotes, invalid escaping)
- Wrong encoding (not UTF-8)
- Empty file

**Solutions:**

1. **Validate CSV format**:
   ```bash
   head -5 "data/Propensity Scoring Accounts.csv"
   ```

2. **Check encoding**:
   ```bash
   file "data/Propensity Scoring Accounts.csv"
   # Should show: UTF-8 Unicode text
   ```

3. **Convert to UTF-8** (if needed):
   ```bash
   iconv -f ISO-8859-1 -t UTF-8 input.csv > output.csv
   ```

4. **Remove BOM** (if present):
   ```bash
   sed -i '1s/^\xEF\xBB\xBF//' "data/Propensity Scoring Accounts.csv"
   ```

### High memory usage

**Symptom:**
- Process crashes with "out of memory" error
- System becomes slow during large runs

**Causes:**
- Collecting too many companies at once
- Large CSV files in memory

**Solutions:**

1. **Process in smaller batches**:
   ```bash
   # Run in chunks of 2,000 instead of 10,000
   npm run tam-expansion -- --sample-size 2000 --output results-1.csv
   npm run tam-expansion -- --sample-size 2000 --output results-2.csv
   # Merge results afterward
   ```

2. **Increase Node.js memory limit**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run tam-expansion:full
   ```

## Next Steps

### 1. Validate Results (Sample Run)

Before running a full expansion, validate the quality of results:

```bash
# Run small sample
npm run tam-expansion:sample

# Review output
head -50 data/tam-expansion-results.csv

# Check key metrics
wc -l data/tam-expansion-results.csv
```

**Quality checks:**
- Are companies in the right industries? (fintech, financial services)
- Are geographic distributions as expected? (~60% US)
- Is the duplication rate reasonable? (~20-30%)

### 2. Adjust Filters (Optional)

If sample results are not satisfactory, consider adjusting filters:

**To increase precision** (fewer irrelevant companies):
- Narrow keyword list to more specific terms
- Increase minimum employee count
- Add additional required criteria

**To increase recall** (find more companies):
- Add more countries
- Expand keyword list
- Include smaller company sizes (11-50 employees)

**Edit filter in:**
```
src/tam-expansion-service.ts
  → buildHighRecallFilter() method
```

### 3. Run Full Expansion

Once validated, run the full expansion:

```bash
npm run tam-expansion:full
```

**Monitor progress:**
- Watch console output for errors
- Note total companies found vs. net-new
- Track deduplication statistics

**Expected runtime:**
- 10,000 companies: ~10-15 minutes
- 50,000 companies: ~45-60 minutes

### 4. Import to CRM

Import the results into your CRM or sales system:

**Common import formats:**
- CSV (already provided)
- Salesforce import
- HubSpot import
- Custom API integration

**Key fields for CRM mapping:**
- `company_name` → Account Name
- `company_website_domain` → Website
- `hq_country` → Country
- `employee_count_range` → Company Size
- `linkedin_profile_url` → LinkedIn
- `linkedin_company_description` → Description

### 5. Enrich Data (Optional)

Consider enriching TAM list with additional data:

**Using Aero Enrichment (this platform):**
```bash
# Enrich companies with aerospace/defense data
npm run enrich -- --input data/tam-expansion-results.csv
```

**Using other services:**
- Clearbit for company logos and additional data
- ZoomInfo for contact information
- PitchBook for funding details

### 6. Segment and Prioritize

Segment your TAM for prioritization:

**By employee size:**
- Enterprise (1,000+ employees)
- Mid-market (200-1,000 employees)
- SMB (50-200 employees)

**By geography:**
- Primary markets (US, UK)
- Secondary markets (Canada, Germany, Australia)
- Expansion markets (India, Brazil, China)

**By growth:**
- High growth (>20% employee growth in 12m)
- Moderate growth (5-20%)
- Stable/declining (<5%)

**Example segmentation query:**
```python
import pandas as pd

df = pd.read_csv('data/tam-expansion-results.csv')

# High-priority: US, 200+ employees, high growth
priority = df[
    (df['hq_country'] == 'United States') &
    (df['employee_count_range'].isin(['201-500', '501-1000', '1001-5000'])) &
    (df['employee_metrics.growth_12m_percent'] > 20)
]

priority.to_csv('data/tam-priority.csv', index=False)
```

### 7. Set Up Monitoring

Track your TAM over time:

**Monthly refresh:**
```bash
# Run on 1st of each month
crontab -e
# Add: 0 9 1 * * cd /path/to/project && npm run tam-expansion:full
```

**Track changes:**
- New companies entering TAM
- Company growth/decline
- Funding events
- Geographic expansion

**KPIs to monitor:**
- Total TAM size
- Net-new companies per month
- Coverage ratio (existing accounts / TAM)
- Conversion rate (TAM → customers)

### 8. Build Outreach Campaigns

Use TAM list for targeted outreach:

**Sequence ideas:**
1. Initial email to relevant stakeholders
2. LinkedIn connection request
3. Follow-up email with case studies
4. Phone call or demo offer

**Personalization data:**
- Company size (from `employee_count_range`)
- Growth trajectory (from `employee_metrics`)
- Industry focus (from `linkedin_industries`)
- Recent funding (from `last_funding_round_type`)

**Example outreach:**
```
Subject: Helping {company_name} scale financial operations

Hi {first_name},

I noticed {company_name} has grown to {employee_count} employees and
recently raised a {funding_round}. As you scale, you might be interested
in how companies like {competitor} are optimizing their {use_case}...
```
