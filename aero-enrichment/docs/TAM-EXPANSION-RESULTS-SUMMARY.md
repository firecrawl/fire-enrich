# TAM Expansion Results Summary

**Generated:** 2025-11-25
**Output File:** `data/tam-expansion-full-results.csv` (152 MB)

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total companies found** | 30,792 |
| **Existing accounts** | 22,523 |
| **Duplicates removed** | 2,849 (9.3%) |
| **Net new ICP companies** | 27,943 |

---

## Geographic Distribution

| Country | Count | Percentage |
|---------|-------|------------|
| **United States** | 16,353 | 58.5% |
| Unknown/Remote | 6,063 | 21.7% |
| United Kingdom | 2,971 | 10.6% |
| Canada | 1,626 | 5.8% |
| Brazil | 809 | 2.9% |
| Other | 121 | 0.4% |

**Key Insight:** 58.5% US-centric with strong representation in UK (10.6%) and Canada (5.8%).

---

## Employee Size Distribution

| Size Range | Count | Percentage | Notes |
|------------|-------|------------|-------|
| **51-200** | 18,573 | 66.5% | Growth-stage companies |
| **201-500** | 5,143 | 18.4% | Mid-market |
| **501-1000** | 2,005 | 7.2% | Scaling companies |
| **1001-5000** | 1,547 | 5.5% | Enterprise |
| **5001-10000** | 265 | 0.9% | Large enterprise |
| **10001+** | 410 | 1.5% | Global enterprise |

**Key Insight:** 66.5% are growth-stage (51-200 employees) - high potential for new customer acquisition.

---

## Company Type Distribution

| Type | Count | Percentage |
|------|-------|------------|
| **Privately Held** | 18,767 | 67.2% |
| **Public Company** | 3,414 | 12.2% |
| Nonprofit | 1,979 | 7.1% |
| Partnership | 1,141 | 4.1% |
| Government Agency | 459 | 1.6% |
| Other | 2,183 | 7.8% |

**Key Insight:** 67.2% privately held (growth companies) + 12.2% public companies (enterprise).

---

## Industry Distribution (Top 15)

| Industry | Count | % of Net New |
|----------|-------|--------------|
| **Financial Services** | 11,659 | 41.7% |
| Technology, Information and Media | 8,126 | 29.1% |
| Technology, Information and Internet | 8,017 | 28.7% |
| Software Development | 7,469 | 26.7% |
| Credit Intermediation | 3,845 | 13.8% |
| **Banking** | 3,738 | 13.4% |
| Hospitals and Health Care | 1,954 | 7.0% |
| **Insurance** | 1,631 | 5.8% |
| Capital Markets | 1,233 | 4.4% |
| Medical Practices | 828 | 3.0% |
| Investment Management | 589 | 2.1% |
| Investment Banking | 378 | 1.4% |
| Consumer Services | 369 | 1.3% |
| Entertainment Providers | 365 | 1.3% |
| Computer Games | 323 | 1.2% |

**Key Insight:** 41.7% Financial Services + 13.4% Banking + 5.8% Insurance = ~61% core ICP verticals.

---

## Data Points Available

Each company record contains 52 data fields:

### Identification
- `company_id` - CrustData unique ID
- `company_name` - Company name
- `linkedin_id` - LinkedIn company ID
- `crunchbase_uuid` - Crunchbase UUID

### Online Presence
- `company_website` - Primary website
- `company_website_domain` - Normalized domain
- `linkedin_profile_url` - LinkedIn page
- `twitter_profile_url` - Twitter/X profile
- `twitter_handle` - Twitter handle
- `logo_permalink` - Company logo URL

### Firmographics
- `year_founded` - Founding year
- `employee_count_range` - Size bucket
- `company_type` - Public/Private/etc.
- `linkedin_industries` - Industry classifications
- `linkedin_categories` - Business categories
- `linkedin_company_description` - Company description

### Location
- `hq_country` - HQ country code
- `hq_location` - Full HQ location string
- `hq_street_address_and_city` - Street address
- `hq_location_address_components` - Address breakdown
- `office_addresses` - All office locations
- `largest_headcount_country` - Where most employees are
- `region_distribution` - Employee geographic spread

### Financials
- `estimated_revenue_lower_bound_usd` - Revenue estimate (low)
- `estimated_revenue_higher_bound_usd` - Revenue estimate (high)
- `crunchbase_total_investment_usd` - Total funding raised
- `crunchbase_valuation_usd` - Latest valuation
- `crunchbase_valuation_lower_bound_usd` - Valuation floor
- `last_funding_round_type` - Series A/B/C/etc.
- `last_funding_round_investment_usd` - Last round size
- `last_funding_date` - Last funding date

### Market Data
- `stock_symbols` - Ticker symbols
- `markets` - Stock exchanges
- `ipo_date` - IPO date (if public)
- `acquisition_status` - Acquisition status

### Investors
- `crunchbase_investors` - List of investors
- `tracxn_investors` - Additional investor data
- `crunchbase_categories` - Crunchbase categories

### Employee Metrics
- `employee_metrics` - JSON with headcount + growth:
  - `latest_count` - Current headcount
  - `growth_1m` - 1-month growth
  - `growth_3m` - 3-month growth
  - `growth_6m` - 6-month growth
  - `growth_12m` - 12-month growth
  - `growth_*_percent` - Growth percentages

### Follower Metrics
- `follower_metrics` - LinkedIn follower growth data

### Skills & Roles
- `skill_distribution` - Employee skills breakdown
- `skill_distribution_percent` - Skills percentages
- `role_distribution` - Department breakdown
- `role_distribution_percent` - Department percentages
- `role_growth_6m` - Department growth (6mo)
- `role_growth_yoy` - Department growth (YoY)

### Competitive Intelligence
- `competitor_ids` - CrustData competitor IDs
- `competitor_websites` - Competitor domains

### Metadata
- `fiscal_year_end` - FY end month
- `growth_calculation_date` - Data freshness date
- `updated_at` - Last update timestamp
- `indexed_at` - Indexing timestamp

---

## File Location

```
/Users/jaitoor/dev/fire-enrich/aero-enrichment/data/tam-expansion-full-results.csv
```

**Size:** 152 MB
**Rows:** 27,944 (27,943 companies + header)
**Columns:** 52

---

## Recommended Next Steps

### 1. Prioritize by Signals
Sort net new accounts by:
- `crunchbase_total_investment_usd` (funding)
- `employee_metrics.growth_12m_percent` (growth)
- Industry relevance (Financial Services, Banking, Insurance)

### 2. Tier Assignment
| Tier | Criteria | Est. Count |
|------|----------|------------|
| A | 1000+ employees + $100M+ funding | ~2,000 |
| B | 201-999 employees OR $10M+ funding | ~7,000 |
| C | 51-200 employees, growth-stage | ~18,000 |

### 3. Enrichment Opportunities
- Match against hiring signals (job listings API)
- Add SEC filing signals for public companies
- Technology stack detection via PredictLeads

### 4. CRM Import
Fields to map for Salesforce:
- `company_name` → Account Name
- `company_website_domain` → Website
- `linkedin_industries` → Industry
- `employee_count_range` → Company Size
- `hq_country` → Billing Country
- `estimated_revenue_lower_bound_usd` → Annual Revenue

---

## Filter Logic Reference

See `docs/TAM-FILTER-LOGIC-AND-ICP.md` for complete filter specifications.

**Summary:**
- 12 industry segments (Fintech, Payments, Lending, Insurance, Crypto, Banking, Wealth Mgmt, Marketplaces, Gig Economy)
- Geography: US, UK, Canada, Brazil
- Employee size: 51+
- Industry + keyword precision filtering (~95% relevance)
