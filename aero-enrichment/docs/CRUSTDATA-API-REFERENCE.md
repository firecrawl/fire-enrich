# CrustData API Reference

## API Overview

**Base URL:** `https://api.crustdata.com`

**Authentication:** `Authorization: Token <API_KEY>`

---

## Endpoints

### 1. Company Lookup (GET)

```
GET /screener/company?company_domain=<domain>
GET /screener/company?company_name=<name>
```

### 2. CompanyDB Search (POST) - Main TAM Endpoint

```
POST /screener/companydb/search
Content-Type: application/json
Authorization: Token <API_KEY>
```

---

## Filter Types

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Exact match | `{"filter_type": "hq_country", "type": "=", "value": "USA"}` |
| `!=` | Not equal | `{"filter_type": "company_type", "type": "!=", "value": "Nonprofit"}` |
| `in` | In list | `{"filter_type": "hq_country", "type": "in", "value": ["USA", "UK"]}` |
| `not_in` | Not in list | `{"filter_type": "company_type", "type": "not_in", "value": ["Nonprofit"]}` |
| `>` | Greater than | `{"filter_type": "employee_metrics.latest_count", "type": ">", "value": 49}` |
| `<` | Less than | `{"filter_type": "year_founded", "type": "<", "value": 2020}` |
| `(.)` | Contains (case-insensitive) | `{"filter_type": "linkedin_company_description", "type": "(.)", "value": "fintech"}` |
| `[.]` | Contains (case-sensitive) | `{"filter_type": "company_name", "type": "[.]", "value": "Bank"}` |

---

## Available Filter Fields

### Core Fields
- `company_id`
- `company_name`
- `company_type` (Private, Public, Self-Employed, Nonprofit, etc.)
- `year_founded`
- `company_website`
- `company_website_domain`

### Location Fields
- `hq_country`
- `hq_location`
- `largest_headcount_country`

### LinkedIn Fields
- `linkedin_id`
- `linkedin_profile_url`
- `linkedin_profile_name`
- `linkedin_company_description`
- `linkedin_industries` (array)
- `linkedin_categories` (array)

### Employee Metrics
- `employee_metrics.latest_count`
- `employee_metrics.growth_1m`
- `employee_metrics.growth_3m`
- `employee_metrics.growth_6m`
- `employee_metrics.growth_yoy`
- `employee_count_range`

### Financial Fields
- `estimated_revenue_lower_bound_usd`
- `estimated_revenue_higher_bound_usd`
- `crunchbase_total_investment_usd`
- `crunchbase_valuation_usd`
- `last_funding_round_type`
- `last_funding_round_investment_usd`

---

## Sample API Calls

### Simple Query - Companies in USA with 50+ employees

```bash
curl -X POST "https://api.crustdata.com/screener/companydb/search" \
  -H "Authorization: Token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "op": "and",
      "conditions": [
        {"filter_type": "hq_country", "type": "=", "value": "United States"},
        {"filter_type": "employee_metrics.latest_count", "type": ">", "value": 49}
      ]
    },
    "limit": 100,
    "sorts": [{"column": "employee_metrics.latest_count", "order": "desc"}]
  }'
```

### Industry + Keyword Filter (Fintechs)

```bash
curl -X POST "https://api.crustdata.com/screener/companydb/search" \
  -H "Authorization: Token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "op": "and",
      "conditions": [
        {"filter_type": "linkedin_industries", "type": "(.)", "value": "Financial Services"},
        {"filter_type": "linkedin_company_description", "type": "(.)", "value": "fintech"},
        {"filter_type": "employee_metrics.latest_count", "type": ">", "value": 49}
      ]
    },
    "limit": 100
  }'
```

### Exclude Industries (No PE/VC/Hedge Funds)

```bash
curl -X POST "https://api.crustdata.com/screener/companydb/search" \
  -H "Authorization: Token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "op": "and",
      "conditions": [
        {"filter_type": "linkedin_industries", "type": "(.)", "value": "Financial Services"},
        {"filter_type": "linkedin_industries", "type": "not_in", "value": ["Venture Capital and Private Equity Principals"]},
        {"filter_type": "linkedin_industries", "type": "not_in", "value": ["Investment Management"]},
        {"filter_type": "linkedin_industries", "type": "not_in", "value": ["Capital Markets"]}
      ]
    },
    "limit": 100
  }'
```

### Pagination with Cursor

```bash
# First request
curl -X POST "https://api.crustdata.com/screener/companydb/search" \
  -H "Authorization: Token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {...},
    "limit": 1000
  }'

# Response includes: {"next_cursor": "abc123", "total_count": 33677, "companies": [...]}

# Next page
curl -X POST "https://api.crustdata.com/screener/companydb/search" \
  -H "Authorization: Token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {...},
    "limit": 1000,
    "cursor": "abc123"
  }'
```

---

## TAM v3 Filter (Full)

This is the complete filter used for TAM v3 extraction (33,677 companies):

```json
{
  "filters": {
    "op": "and",
    "conditions": [
      {
        "op": "or",
        "conditions": [
          {"filter_type": "hq_location", "type": "(.)", "value": "United States"},
          {"filter_type": "hq_location", "type": "(.)", "value": "United Kingdom"},
          {"filter_type": "hq_location", "type": "(.)", "value": "Canada"},
          {"filter_type": "hq_location", "type": "(.)", "value": "Brazil"},
          {"filter_type": "hq_location", "type": "(.)", "value": "Germany"},
          {"filter_type": "hq_location", "type": "(.)", "value": "Singapore"},
          {"filter_type": "hq_location", "type": "(.)", "value": "India"},
          {"filter_type": "hq_location", "type": "(.)", "value": "Australia"}
        ]
      },
      {
        "filter_type": "employee_metrics.latest_count",
        "type": ">",
        "value": 49
      },
      {
        "filter_type": "company_type",
        "type": "not_in",
        "value": ["Self-Employed", "Sole Proprietorship", "Nonprofit", "Educational Institution", "Government Agency"]
      },
      {
        "filter_type": "linkedin_industries",
        "type": "not_in",
        "value": ["Venture Capital and Private Equity Principals"]
      },
      {
        "filter_type": "linkedin_industries",
        "type": "not_in",
        "value": ["Capital Markets"]
      },
      {
        "filter_type": "linkedin_industries",
        "type": "not_in",
        "value": ["Investment Management"]
      },
      {
        "filter_type": "linkedin_industries",
        "type": "not_in",
        "value": ["IT Services and IT Consulting"]
      },
      {
        "op": "or",
        "conditions": [
          {
            "op": "and",
            "conditions": [
              {
                "op": "or",
                "conditions": [
                  {"filter_type": "linkedin_industries", "type": "(.)", "value": "Financial Services"},
                  {"filter_type": "linkedin_industries", "type": "(.)", "value": "Banking"}
                ]
              },
              {
                "op": "or",
                "conditions": [
                  {"filter_type": "linkedin_company_description", "type": "(.)", "value": "fintech"},
                  {"filter_type": "linkedin_company_description", "type": "(.)", "value": "neobank"},
                  {"filter_type": "linkedin_company_description", "type": "(.)", "value": "digital bank"},
                  {"filter_type": "linkedin_company_description", "type": "(.)", "value": "payment"}
                ]
              }
            ]
          },
          {"filter_type": "linkedin_industries", "type": "(.)", "value": "Internet Marketplace Platforms"}
        ]
      }
    ]
  },
  "limit": 1000,
  "sorts": [{"column": "employee_metrics.latest_count", "order": "desc"}]
}
```

---

## Response Fields (52 fields)

```json
{
  "companies": [
    {
      "company_id": "123456",
      "company_name": "Stripe",
      "company_type": "Private",
      "year_founded": 2010,
      "company_website": "https://stripe.com",
      "company_website_domain": "stripe.com",
      "domains": ["stripe.com", "stripe.dev"],
      "hq_country": "USA",
      "hq_location": "San Francisco, California, United States",
      "hq_location_address_components": {...},
      "hq_street_address_and_city": "354 Oyster Point Blvd, San Francisco",
      "largest_headcount_country": "USA",
      "office_addresses": [...],
      "linkedin_id": "1389908",
      "linkedin_profile_url": "https://www.linkedin.com/company/stripe",
      "linkedin_profile_name": "Stripe",
      "linkedin_company_description": "Stripe is a financial infrastructure platform...",
      "linkedin_industries": ["Financial Services", "Software Development"],
      "linkedin_categories": ["FinTech", "Payments"],
      "employee_count_range": "5001-10000",
      "employee_metrics": {
        "latest_count": 8500,
        "growth_1m": 150,
        "growth_3m": 400,
        "growth_6m": 700,
        "growth_yoy": 1200
      },
      "region_distribution": {...},
      "role_distribution": {...},
      "role_distribution_percent": {...},
      "role_growth_6m": {...},
      "role_growth_yoy": {...},
      "skill_distribution": {...},
      "skill_distribution_percent": {...},
      "estimated_revenue_lower_bound_usd": 1000000000,
      "estimated_revenue_higher_bound_usd": 5000000000,
      "crunchbase_total_investment_usd": 2300000000,
      "crunchbase_valuation_usd": 50000000000,
      "crunchbase_valuation_lower_bound_usd": 50000000000,
      "last_funding_round_type": "Series I",
      "last_funding_round_investment_usd": 600000000,
      "crunchbase_investors": ["Sequoia Capital", "Andreessen Horowitz"],
      "tracxn_investors": [...],
      "crunchbase_uuid": "abc123",
      "crunchbase_profile_url": "https://crunchbase.com/organization/stripe",
      "crunchbase_categories": ["Financial Technology", "Payments"],
      "twitter_handle": "stripe",
      "twitter_profile_url": "https://twitter.com/stripe",
      "follower_metrics": {"linkedin_follower_count": 500000},
      "logo_permalink": "https://...",
      "markets": [...],
      "acquisition_status": null,
      "competitor_ids": [...],
      "stock_symbols": [],
      "fiscal_year_end": "December",
      "indexed_at": "2024-11-26T00:00:00Z",
      "updated_at": "2024-11-26T00:00:00Z",
      "growth_calculation_date": "2024-11-26"
    }
  ],
  "next_cursor": "eyJjdXJzb3IiOiAiMTAwMCJ9",
  "total_count": 33677
}
```

---

## Rate Limits & Best Practices

1. **Batch Size:** Max 1000 per request
2. **Timeout:** Set to 120s for complex queries
3. **Rate Limit:** Add 1s delay between paginated requests
4. **Retries:** Use exponential backoff (2^n seconds)

---

## TypeScript Client Usage

```typescript
import { CrustDataClient } from './crustdata-client';
import { TAMExpansionService } from './tam-expansion-service';

// Direct API call
const client = new CrustDataClient({ apiKey: 'YOUR_KEY' });
const result = await client.searchCompanyDB({
  filters: { op: 'and', conditions: [...] },
  limit: 100
});

// TAM extraction with pagination
const tam = new TAMExpansionService({ apiKey: 'YOUR_KEY', batchSize: 1000 });
const companies = await tam.collectAllCompanies({ maxResults: 50000 });
```
