# TAM Expansion V2 Results Summary

**Generated:** 2025-11-25
**Output File:** `data/tam-expansion-v2-results.csv`
**Data Source:** CrustData CompanyDB API

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total TAM companies found** | 35,238 |
| **Existing accounts** | 10,000 |
| **Duplicates removed** | 2,819 |
| **Net new ICP companies** | **32,419** |

---

## Filter Logic

### Geography
- United States (primary)
- United Kingdom
- Canada
- Brazil

### Employee Size
- 50+ employees (based on `employee_metrics.latest_count > 49` - actual LinkedIn headcount)

### Company Type Exclusions
- Self-Employed
- Sole Proprietorship
- Nonprofit

### Industry Segments (13 total)

| # | Segment | Logic | Target Companies |
|---|---------|-------|------------------|
| 1 | **Fintech Core** | Financial Services + fintech/neobank keywords | Chime, Current, Varo |
| 2 | **Payments** | Financial Services + payment processing keywords | Adyen, Checkout.com |
| 3 | **Lending** | Financial Services + lending platform keywords | SoFi, Upstart, LendingClub |
| 4 | **Insurtech** | Insurance + insurtech/digital insurance keywords | Lemonade, Hippo, Root |
| 5 | **Insurance Carriers** | Insurance Carriers industry (no keywords) | Traditional insurers |
| 6 | **Crypto/Digital Assets** | Financial Services + crypto keywords | Kraken, Gemini, Circle |
| 7 | **Banking** | Banking industry (no keywords) | Regional banks, credit unions |
| 8 | **Wealth/Asset Management** | Investment Management + wealth keywords | Betterment, Wealthfront |
| 9 | **Internet Marketplaces** | Internet Marketplace Platforms industry | StockX, Poshmark |
| 10 | **Tech Marketplaces** | Software Development + marketplace keywords | Etsy, Fiverr |
| 11 | **Gig Economy/Delivery** | Transportation + rideshare/delivery keywords | Lyft, DoorDash, Instacart |
| 12 | **Vacation Rentals** | vacation rental/short-term rental keywords | Airbnb, VRBO, Vacasa |
| 13 | **Pure-play Fintechs** *(NEW)* | Software/Tech + fintech/payments/crypto keywords | Captures tech-classified fintechs |

### Why Segment 13 Was Added

Major fintechs like Coinbase, Stripe, PayPal are classified as **"Software Development"** or **"Technology"** on LinkedIn, NOT "Financial Services". The original filter missed them. Segment 13 captures:

```
Industries: Software Development, Technology, IT Services
Keywords: fintech, payments, payment platform, digital wallet, money transfer,
          cryptocurrency, crypto exchange, digital banking, neobank,
          buy now pay later, BNPL, lending platform, financial technology,
          banking software, payment processing
```

---

## Deduplication

### Method
- Field used: `company_website_domain` (from TAM) vs `website` (from existing)
- Normalization: lowercase, remove protocol/www/paths/trailing slashes

### Duplicates Found (2,819)

Sample companies correctly identified as already in existing accounts:
- Microsoft, Bank of America, Wells Fargo, Citi, Oracle
- Uber, Upwork, Morgan Stanley, FedEx
- Coinbase, Stripe, PayPal, Plaid, Klarna, Affirm
- Square, Robinhood, Revolut, Brex, Ramp

---

## Results Breakdown

### Geographic Distribution

| Country | Count | Percentage |
|---------|-------|------------|
| **United States** | 18,919 | 58.4% |
| Unknown/Remote | 7,260 | 22.4% |
| United Kingdom | 3,384 | 10.4% |
| Canada | 1,828 | 5.6% |
| Brazil | 895 | 2.8% |

### Employee Size Distribution

| Size Range | Count | Percentage |
|------------|-------|------------|
| 51-200 | ~21,500 | 66% |
| 201-500 | ~5,900 | 18% |
| 501-1000 | ~2,300 | 7% |
| 1001-5000 | ~1,800 | 6% |
| 5001-10000 | ~300 | 1% |
| 10001+ | ~500 | 2% |

### Industry Distribution

| Industry | Count | % of Total |
|----------|-------|------------|
| **Financial Services** | 11,842 | 36.5% |
| **Software/Tech** | 8,636 | 26.6% |
| **Banking** | 4,229 | 13.0% |
| **Insurance** | 1,651 | 5.1% |

---

## Data Fields Available (52 columns)

### Company Identification
- `company_id` - CrustData unique ID
- `company_name` - Company name
- `company_website_domain` - Primary domain (normalized)
- `company_website` - Full website URL
- `linkedin_id` - LinkedIn company ID
- `linkedin_profile_url` - LinkedIn page URL
- `crunchbase_uuid` - Crunchbase ID

### Firmographics
- `year_founded` - Founding year
- `employee_count_range` - Size bucket (51-200, 201-500, etc.)
- `company_type` - Public/Private/Nonprofit/etc.
- `linkedin_industries` - Industry classifications (array)
- `linkedin_company_description` - Company description

### Location
- `hq_country` - HQ country code (USA, GBR, CAN, BRA)
- `hq_location` - Full HQ location string
- `hq_street_address_and_city` - Street address
- `largest_headcount_country` - Where most employees are
- `office_addresses` - All office locations
- `region_distribution` - Employee geographic spread

### Financials
- `estimated_revenue_lower_bound_usd` - Revenue estimate (low)
- `estimated_revenue_higher_bound_usd` - Revenue estimate (high)
- `crunchbase_total_investment_usd` - Total funding raised
- `crunchbase_valuation_usd` - Latest valuation
- `last_funding_round_type` - Series A/B/C/etc.
- `last_funding_round_investment_usd` - Last round size
- `last_funding_date` - Last funding date

### Public Company Data
- `stock_symbols` - Ticker symbols
- `markets` - Stock exchanges
- `ipo_date` - IPO date

### Employee Metrics
- `employee_metrics` - JSON object containing:
  - `latest_count` - Current headcount
  - `growth_1m` / `growth_1m_percent` - 1-month growth
  - `growth_3m` / `growth_3m_percent` - 3-month growth
  - `growth_6m` / `growth_6m_percent` - 6-month growth
  - `growth_12m` / `growth_12m_percent` - 12-month growth

### Skills & Roles
- `skill_distribution` - Employee skills breakdown
- `role_distribution` - Department breakdown (Engineering, Sales, etc.)
- `role_growth_6m` - Department growth (6mo)
- `role_growth_yoy` - Department growth (YoY)

### Competitive Intelligence
- `competitor_ids` - CrustData competitor IDs
- `competitor_websites` - Competitor domains
- `crunchbase_investors` - List of investors

---

## File Details

| Property | Value |
|----------|-------|
| **File Path** | `data/tam-expansion-v2-results.csv` |
| **Rows** | 32,420 (32,419 companies + header) |
| **Columns** | 52 |
| **File Size** | ~170 MB |
| **Encoding** | UTF-8 |

---

## Comparison: V1 vs V2

| Metric | V1 | V2 | Change |
|--------|----|----|--------|
| Total TAM | 30,792 | 35,238 | +4,446 |
| Duplicates found | 0 (bug) | 2,819 | Fixed |
| Net new | 27,943 | 32,419 | +4,476 |
| Software/Tech companies | ~7,500 | 8,636 | +1,100 |

### Key Fixes in V2
1. **Added Pure-play Fintech segment** - Captures tech-classified fintechs
2. **Fixed deduplication** - Uses `company_website_domain` with proper normalization
3. **Verified major fintechs** - Coinbase, Stripe, PayPal correctly deduplicated

---

## Next Steps

### 1. Prioritization
Sort by signals for outreach prioritization:
- `crunchbase_total_investment_usd` - Funding amount
- `employee_metrics.growth_12m_percent` - Headcount growth
- `estimated_revenue_lower_bound_usd` - Revenue

### 2. Enrichment (Optional)
For deeper insights, enrich with additional CrustData fields:
- `founders.profiles` - Founder LinkedIn profiles
- `decision_makers` - Key contacts
- `job_openings` - Current hiring
- `web_traffic` - SimilarWeb data
- `news_articles` - Recent press

### 3. CRM Import
Map fields for Salesforce import:
```
company_name → Account Name
company_website_domain → Website
linkedin_industries → Industry
employee_count_range → Company Size
hq_country → Billing Country
estimated_revenue_lower_bound_usd → Annual Revenue
```

---

## API Filter Notes

### Employee Count Filtering

**Tested and implemented:** The `employee_metrics.latest_count` field IS filterable.

| Operator | Supported | Example |
|----------|-----------|---------|
| `>=` | ❌ No | - |
| `>` | ✅ Yes | `> 49` (effectively >= 50) |
| `=` | ✅ Yes | `= 100` |
| `<` | ✅ Yes | `< 1000` |

**Current implementation:**
```typescript
{ filter_type: 'employee_metrics.latest_count', type: '>', value: 49 }
```

This is more accurate than `employee_count_range` buckets which can include companies with <50 employees in the "51-200" bucket.

---

## Related Documentation

- [TAM Filter Logic and ICP](./TAM-FILTER-LOGIC-AND-ICP.md) - Detailed filter specifications
- [TAM Expansion Results Summary](./TAM-EXPANSION-RESULTS-SUMMARY.md) - V1 results (deprecated)
