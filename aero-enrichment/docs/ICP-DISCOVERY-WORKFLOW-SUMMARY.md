# ICP Signal Discovery Workflow - Complete Guide

## Overview

The ICP Signal Discovery API is an end-to-end pipeline that reverse-engineers any company's Ideal Customer Profile (ICP) by analyzing their customers, competitors, and generating control groups. This document provides a visual guide to the complete workflow, including all inputs, outputs, LLM prompts, and user interaction points.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                       │
│  { name: "Legora", website: "legora.com" }                              │
│  { name: "Harvey", website: "harvey.ai" }                               │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ICP DISCOVERY SERVICE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │   Phase 0    │→│   Phase 1    │→│   Phase 2    │→│   Phase 3    ││
│  │ ICP Extract  │  │  Customers   │  │  Research    │  │  Summarize   ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Phase 4    │→│   Phase 5    │→│   Phase 6    │                 │
│  │  Non-ICP Gen │  │  TF-IDF      │  │  Clustering  │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                           │
│  • Extracted ICP Definition                                              │
│  • Good Fit Examples                                                     │
│  • Differentiating Signals (2-3 word phrases)                            │
│  • Concept Clusters                                                      │
│  • Cost Breakdown                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase-by-Phase Breakdown

### Phase 0: ICP Extraction from Target Website

**Purpose**: Extract the target company's self-defined ICP from their website before customer analysis.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: targetDomain, targetName                                         │
│   Example: "legora.com", "Legora"                                       │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Create Exa Webset                                               │
│                                                                          │
│ Query: site:legora.com (homepage OR about OR product OR pricing...)     │
│ Criteria:                                                               │
│   • Extract ICP information from Legora website                         │
│   • Include target customer industries, company size, business model    │
│   • Extract buyer personas with job titles                             │
│   • Extract primary use cases with descriptions                         │
│   • Extract differentiator: status quo vs solution                      │
│   • Extract key capabilities and features                               │
│                                                                          │
│ 🔧 API: Exa Websets API (structured extraction)                        │
│ 💰 Cost: $0.01 + ($0.001 × items)                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Items Retrieved?│
                    └─────────────────┘
                    │         │
              YES   │         │   NO
                    ▼         ▼
        ┌──────────────────┐  ┌──────────────────────────────────┐
        │ Extract from     │  │ FALLBACK: Exa getContents        │
        │ Webset Properties│  │ + LLM Extraction                 │
        └──────────────────┘  └──────────────────────────────────┘
                    │                      │
                    │                      ▼
                    │          ┌──────────────────────────────┐
                    │          │ LLM PROMPT (gpt-4o-mini)     │
                    │          │                              │
                    │          │ System: Extract ICP info...   │
                    │          │ User: [Website content]      │
                    │          │                              │
                    │          │ 💰 Cost: ~$0.001-0.002       │
                    │          └──────────────────────────────┘
                    │                      │
                    └──────────┬───────────┘
                               ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: ExtractedICP                                    │
        │   • target_customer: { industries, company_size, ... }  │
        │   • buyer_personas: [{ seniority, function, title }]   │
        │   • primary_use_cases: [{ name, description }]         │
        │   • differentiator: { status_quo, solution }           │
        │   • key_capabilities: string[]                         │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: 
- **Primary**: Exa Websets API handles structured extraction (no explicit prompt)
- **Fallback**: `icp-extractor.ts` → `extractWithLLM()` method

**User Feedback Points**: None (automatic extraction)

---

### Phase 1: Customer Extraction

**Purpose**: Discover all publicly listed customers of the target company.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: targetDomain, limit (default: 30)                               │
│   Example: "legora.com", 30                                            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Create Exa Webset for Customer Discovery                       │
│                                                                          │
│ Query: site:legora.com (customers OR "case studies" OR testimonials)    │
│ Criteria:                                                               │
│   • Extract all customer company names mentioned on legora.com          │
│   • Look for customer logos, case study titles, testimonials            │
│   • Return company names only, not person names                        │
│                                                                          │
│ 🔧 API: Exa Websets API                                                 │
│ 💰 Cost: $0.01 + ($0.001 × items)                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Items Retrieved?│
                    └─────────────────┘
                    │         │
              YES   │         │   NO
                    ▼         ▼
        ┌──────────────────┐  ┌──────────────────────────────────┐
        │ Extract from     │  │ FALLBACK: Exa searchAndContents  │
        │ Webset Properties│  │ + LLM Extraction                 │
        │ (customers,      │  │                                  │
        │  company_names)  │  │ Query templates:                 │
        └──────────────────┘  │   • site:legora.com customers    │
                    │         │   • site:legora.com case studies │
                    │         │   • site:legora.com testimonials │
                    │         │                                  │
                    │         │ 💰 Cost: $0.002 per search       │
                    │         └──────────────────────────────────┘
                    │                      │
                    │                      ▼
                    │          ┌──────────────────────────────┐
                    │          │ LLM PROMPT (gpt-4o-mini)     │
                    │          │                              │
                    │          │ System: Extract all customer │
                    │          │          COMPANY names...    │
                    │          │ User: [Page content]         │
                    │          │                              │
                    │          │ 💰 Cost: ~$0.001 per page    │
                    │          └──────────────────────────────┘
                    │                      │
                    └──────────┬───────────┘
                               ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: ExtractedCustomer[]                             │
        │   [                                                      │
        │     { name: "Northrop Grumman", source_url: "..." },   │
        │     { name: "Boeing", source_url: "..." },             │
        │     ...                                                 │
        │   ]                                                     │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: 
- **Primary**: Exa Websets API (structured extraction)
- **Fallback**: `customer-extractor.ts` → `extractFromPage()` method

**User Feedback Points**: None (automatic extraction)

---

### Phase 2: Customer Research

**Purpose**: Deep research on each extracted customer to gather features and signals.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: ExtractedCustomer[]                                             │
│   [{ name: "Northrop Grumman", source_url: "..." }, ...]               │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ For each customer:  │
                    └─────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1: Find Customer Website                          │
        │                                                         │
        │ Query: "Northrop Grumman company official website"     │
        │                                                         │
        │ 🔧 API: Exa searchAndContents                          │
        │ 💰 Cost: $0.002 per search                             │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 2: Fetch Customer Pages                           │
        │                                                         │
        │ URLs: [https://northropgrumman.com, ...]               │
        │ Subpages: about, pricing, careers, product,            │
        │          integrations                                   │
        │                                                         │
        │ 🔧 API: Exa getContents                                 │
        │ 💰 Cost: $0.003 per URL                                │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 3: LLM Feature Extraction                         │
        │                                                         │
        │ ┌─────────────────────────────────────────────────────┐ │
        │ │ LLM PROMPT (gpt-4o-mini)                           │ │
        │ │                                                    │ │
        │ │ System: Analyze this Northrop Grumman website     │ │
        │ │         content and extract business signals:     │ │
        │ │         • pricing model                           │ │
        │ │         • business model (B2B/B2C)               │ │
        │ │         • integrations                             │ │
        │ │         • hiring signals                          │ │
        │ │         • security certifications                 │ │
        │ │         • funding stage                            │ │
        │ │         • employee count signals                  │ │
        │ │         • unique value proposition                 │ │
        │ │         Return JSON.                               │ │
        │ │                                                    │ │
        │ │ User: [Combined website content, max 15K chars]   │ │
        │ │                                                    │ │
        │ │ 💰 Cost: ~$0.002-0.003 per customer               │ │
        │ └─────────────────────────────────────────────────────┘ │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: ResearchedCustomer                              │
        │   {                                                      │
        │     company_name: "Northrop Grumman",                   │
        │     domain: "northropgrumman.com",                      │
        │     research_status: "success",                         │
        │     page_presence: { homepage: true, about: true, ... },│
        │     combined_content: "...",                            │
        │     llm_extraction: {                                  │
        │       pricing_model: "Enterprise contracts",           │
        │       business_model: "B2B Defense",                    │
        │       b2b_or_b2c: "B2B",                               │
        │       crm_integrations: [...],                         │
        │       security_certifications: ["ISO 27001", ...],     │
        │       funding_stage: "Public",                         │
        │       ...                                               │
        │     }                                                   │
        │   }                                                     │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: 
- `customer-researcher.ts` → `extractFeatures()` method

**User Feedback Points**: None (automatic research)

**Processing**: Batched (default: 3 customers in parallel)

---

### Phase 2.5-2.7: Competitor Discovery & Customer Expansion

**Purpose**: Find competitors and extract their customers to expand the positive sample set.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: targetDomain, targetName, industry                              │
│   Example: "legora.com", "Legora", "Aerospace"                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1: Discover Competitors                            │
        │                                                         │
        │ Query: "Legora" competitors alternatives OR            │
        │        "Legora" vs OR companies like "Legora"          │
        │        Aerospace                                        │
        │                                                         │
        │ 🔧 API: Exa Websets API                                 │
        │ 💰 Cost: $0.01 + ($0.001 × items)                      │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 2: Extract Competitor Customers                    │
        │                                                         │
        │ For each competitor:                                    │
        │   • Run Phase 1 (Customer Extraction)                   │
        │   • Run Phase 2 (Customer Research)                    │
        │   • Deduplicate with target customers                   │
        │                                                         │
        │ 💰 Cost: Same as Phases 1-2 per competitor              │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: Expanded ResearchedCustomer[]                   │
        │   • Target customers (from Phase 1-2)                   │
        │   • Competitor customers (deduplicated)                 │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: 
- Uses same prompts as Phases 1-2

**User Feedback Points**: None (automatic)

---

### Phase 3: ICP Summarization

**Purpose**: Analyze patterns across all researched customers to define the ICP.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: ResearchedCustomer[] (all customers from target + competitors)   │
│   [                                                                      │
│     { company_name: "Northrop Grumman", llm_extraction: {...} },       │
│     { company_name: "Boeing", llm_extraction: {...} },                 │
│     ...                                                                 │
│   ]                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1: Prepare Customer Summaries                      │
        │                                                         │
        │ Extract key fields from each customer:                  │
        │   • business_model, b2b_or_b2c                         │
        │   • target_buyer, target_company_size                   │
        │   • pricing_model, integrations                        │
        │   • security_certs, funding_stage                      │
        │   • employee_count, hiring_departments                 │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 2: LLM Pattern Analysis                            │
        │                                                         │
        │ ┌─────────────────────────────────────────────────────┐ │
        │ │ LLM PROMPT (gpt-4o-mini)                           │ │
        │ │                                                    │ │
        │ │ System: Analyze customer data and identify ICP     │ │
        │ │         patterns. Generate TWO types of anti-ICP:  │ │
        │ │                                                    │ │
        │ │         1. Different-Vertical: Companies in        │ │
        │ │            completely different industries         │ │
        │ │                                                    │ │
        │ │         2. Same-Vertical: Companies in SAME       │ │
        │ │            industry but different characteristics   │ │
        │ │                                                    │ │
        │ │         For search queries, generate ones that     │ │
        │ │         find ACTUAL COMPANY WEBSITES (not blog    │ │
        │ │         posts). Use phrases like "company         │ │
        │ │         homepage", "about us", "official website".│ │
        │ │                                                    │ │
        │ │ User: Analyze these {N} customers:                │ │
        │ │       [JSON array of customer summaries]          │ │
        │ │                                                    │ │
        │ │ Response Format: Zod schema (ICPDefinition)       │ │
        │ │                                                    │ │
        │ │ 💰 Cost: ~$0.003-0.005                            │ │
        │ └─────────────────────────────────────────────────────┘ │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: ICPDefinition                                   │
        │   {                                                      │
        │     target_industries: ["Aerospace", "Defense"],        │
        │     company_size: "Enterprise (1000+ employees)",        │
        │     business_model: "B2B hardware manufacturing",       │
        │     common_technologies: ["CAD/CAM", "PLM systems"],   │
        │     common_departments: ["Engineering", "R&D"],        │
        │     common_pain_points: ["Design iteration time"],      │
        │     typical_funding_stage: "Public",                    │
        │     typical_employee_range: "1000-10000",              │
        │     unique_characteristics: ["Heavy regulatory"],       │
        │     anti_icp_criteria: ["Consumer apps", "E-commerce"], │
        │     anti_icp_search_queries: [                          │
        │       "B2C ecommerce company homepage",                 │
        │       "consumer retail brand official website"          │
        │     ],                                                  │
        │     same_vertical_anti_icp_criteria: [                 │
        │       "Small engineering consultancies"                 │
        │     ],                                                  │
        │     same_vertical_search_queries: [                     │
        │       "small aerospace consultancy about us"           │
        │     ]                                                   │
        │   }                                                     │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: 
- `icp-summarizer.ts` → `summarize()` method

**User Feedback Points**: None (automatic pattern analysis)

---

### Phase 3.5-4: Non-ICP Generation

**Purpose**: Generate control groups for differential analysis.

#### Phase 3.5: Same-Vertical Non-ICP

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: ICPDefinition, limit (default: 20)                             │
│   Uses: same_vertical_search_queries                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ For each query in same_vertical_search_queries:         │
        │   • "small aerospace consultancy about us"               │
        │   • "boutique engineering firm homepage"                │
        │                                                         │
        │ 🔧 API: Exa searchAndContents                           │
        │ 💰 Cost: $0.002 per search                              │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ For each result:                                        │
        │   • Run Phase 2 (Customer Research)                     │
        │   • Mark as same_vertical_anti_icp_reason               │
        │                                                         │
        │ 💰 Cost: Same as Phase 2 per company                    │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: SameVerticalNonICPCompany[]                     │
        │   Companies in SAME industry but different              │
        │   characteristics (e.g., small consultancies vs          │
        │   large manufacturers)                                  │
        └─────────────────────────────────────────────────────────┘
```

#### Phase 4: Different-Vertical Non-ICP

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: ICPDefinition, limit (default: 30)                              │
│   Uses: anti_icp_search_queries                                       │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ For each query in anti_icp_search_queries:               │
        │   • "B2C ecommerce company homepage"                     │
        │   • "consumer retail brand official website"             │
        │                                                         │
        │ 🔧 API: Exa searchAndContents                           │
        │ 💰 Cost: $0.002 per search                              │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ For each result:                                        │
        │   • Run Phase 2 (Customer Research)                     │
        │   • Mark as anti_icp_reason                             │
        │                                                         │
        │ 💰 Cost: Same as Phase 2 per company                    │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: NonICPCompany[]                                  │
        │   Companies in COMPLETELY different industries           │
        │   (e.g., e-commerce vs aerospace)                       │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: 
- Uses same prompts as Phase 2 (Customer Research)

**User Feedback Points**: None (automatic generation)

---

### Phase 5: Signal Discovery (TF-IDF)

**Purpose**: Identify differentiating signals between ICP and non-ICP companies.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT:                                                                  │
│   • Positive: ResearchedCustomer[] (ICP companies)                     │
│   • Negative: ResearchedCustomer[] (Non-ICP companies)                 │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1: Prepare Documents                               │
        │                                                         │
        │ Extract combined_content from each customer:            │
        │   • Positive docs: [content1, content2, ...]           │
        │   • Negative docs: [content1, content2, ...]           │
        │                                                         │
        │ Filter: Only documents with > 100 characters            │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 2: Fit TF-IDF Model                                │
        │                                                         │
        │ Configuration:                                          │
        │   • N-gram range: [2, 3] (2-3 word phrases)            │
        │   • Min document frequency: 2                          │
        │   • Max features: 500                                  │
        │                                                         │
        │ Process:                                                │
        │   1. Tokenize all documents                             │
        │   2. Generate 2-3 word n-grams                          │
        │   3. Filter stop words                                  │
        │   4. Compute IDF scores                                 │
        │   5. Score phrases (boost business keywords)            │
        │   6. Select top 500 features                            │
        │                                                         │
        │ 🔧 Algorithm: Pure TypeScript TF-IDF                    │
        │ 💰 Cost: $0 (no API calls)                             │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 3: Transform Documents                             │
        │                                                         │
        │ For each document:                                      │
        │   • Compute TF (term frequency)                          │
        │   • Multiply by IDF                                     │
        │   • Create vector: { term: tfidf_score, ... }           │
        │                                                         │
        │ Result:                                                 │
        │   • positiveVectors: TfidfVector[]                      │
        │   • negativeVectors: TfidfVector[]                      │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 4: Compute Differential Signals                    │
        │                                                         │
        │ For each term in vocabulary:                            │
        │   • Count docs with term in positive group              │
        │   • Count docs with term in negative group             │
        │   • Calculate percentages                               │
        │   • Compute lift = pos_pct / neg_pct                    │
        │                                                         │
        │ Filter:                                                 │
        │   • Positive signals: lift > 1.2 && pos_pct > 10%     │
        │   • Negative signals: lift < 0.8 && neg_pct > 10%       │
        │                                                         │
        │ Sort: By differential (pos_pct - neg_pct)              │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: DifferentialSignal[]                            │
        │   [                                                      │
        │     {                                                    │
        │       term: "parametric modeling",                       │
        │       positive_pct: 72.5,                               │
        │       negative_pct: 4.2,                                │
        │       lift: 17.3                                        │
        │     },                                                   │
        │     {                                                    │
        │       term: "topology optimization",                    │
        │       positive_pct: 65.0,                               │
        │       negative_pct: 3.1,                                │
        │       lift: 21.0                                        │
        │     },                                                   │
        │     ...                                                 │
        │   ]                                                     │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: None (pure algorithmic analysis)

**User Feedback Points**: None (automatic signal discovery)

---

### Phase 6: Concept Clustering

**Purpose**: Group related signals into business concepts.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: DifferentialSignal[] (top 100 by differential)                  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1: Group by Shared Words                           │
        │                                                         │
        │ For each signal:                                        │
        │   • Extract words from term                             │
        │   • Find first significant word (>4 chars, not stop)    │
        │   • Use as cluster key                                  │
        │                                                         │
        │ Example:                                                │
        │   "parametric modeling" → cluster: "parametric"        │
        │   "parametric design" → cluster: "parametric"         │
        │   "topology optimization" → cluster: "topology"       │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 2: Aggregate Cluster Metrics                       │
        │                                                         │
        │ For each cluster:                                       │
        │   • avg_positive_pct = mean of all signals              │
        │   • avg_negative_pct = mean of all signals              │
        │   • avg_lift = mean of all signals                      │
        │   • representative = signal with highest lift           │
        │   • phrases = all terms in cluster                      │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 3: Sort and Select Top Clusters                    │
        │                                                         │
        │ Sort by: avg_lift (descending)                          │
        │ Limit: Top 20 clusters                                  │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ OUTPUT: ConceptCluster[]                                │
        │   [                                                      │
        │     {                                                    │
        │       concept: "computational",                         │
        │       representative: "computational design",           │
        │       phrases: [                                        │
        │         "computational design",                         │
        │         "computational engineering",                    │
        │         "topology optimization"                        │
        │       ],                                                │
        │       avg_positive_pct: 65.2,                          │
        │       avg_negative_pct: 3.8,                           │
        │       avg_lift: 15.6                                    │
        │     },                                                  │
        │     ...                                                 │
        │   ]                                                     │
        └─────────────────────────────────────────────────────────┘
```

**LLM Prompt Location**: None (pure algorithmic clustering)

**User Feedback Points**: None (automatic clustering)

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                       │
│  POST /api/icp-discovery                                                 │
│  {                                                                       │
│    targets: [                                                            │
│      { name: "Legora", website: "legora.com" },                         │
│      { name: "Harvey", website: "harvey.ai" }                           │
│    ],                                                                    │
│    config: {                                                             │
│      customer_limit: 30,                                                 │
│      competitor_limit: 5,                                                 │
│      same_vertical_non_icp_limit: 20,                                    │
│      different_vertical_non_icp_limit: 30                                │
│    }                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ICP DISCOVERY SERVICE                                 │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 0: ICP Extraction                                          │  │
│  │   • Exa Websets API (structured extraction)                     │  │
│  │   • Fallback: Exa getContents + LLM (gpt-4o-mini)              │  │
│  │   💰 Cost: ~$0.01-0.02 per target                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 1: Customer Extraction                                    │  │
│  │   • Exa Websets API (customer names)                            │  │
│  │   • Fallback: Exa search + LLM (gpt-4o-mini)                   │  │
│  │   💰 Cost: ~$0.01-0.02 per target                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 2: Customer Research                                       │  │
│  │   • Exa search (find website)                                    │  │
│  │   • Exa getContents (fetch pages)                               │  │
│  │   • LLM extraction (gpt-4o-mini) per customer                    │  │
│  │   💰 Cost: ~$0.005-0.01 per customer                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 2.5-2.7: Competitor Discovery                             │  │
│  │   • Exa Websets API (competitors)                                │  │
│  │   • Repeat Phases 1-2 for competitor customers                   │  │
│  │   💰 Cost: ~$0.01 + (Phases 1-2 × competitors)                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 3: ICP Summarization                                       │  │
│  │   • LLM pattern analysis (gpt-4o-mini)                         │  │
│  │   • Generate anti-ICP criteria and search queries               │  │
│  │   💰 Cost: ~$0.003-0.005                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 3.5: Same-Vertical Non-ICP Generation                    │  │
│  │   • Exa search (using same_vertical_search_queries)             │  │
│  │   • Phase 2 research per company                                │  │
│  │   💰 Cost: ~$0.002 + (Phase 2 × companies)                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 4: Different-Vertical Non-ICP Generation                 │  │
│  │   • Exa search (using anti_icp_search_queries)                   │  │
│  │   • Phase 2 research per company                                │  │
│  │   💰 Cost: ~$0.002 + (Phase 2 × companies)                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 5: TF-IDF Signal Discovery                                 │  │
│  │   • Pure TypeScript algorithm (no API calls)                    │  │
│  │   • Compute differential signals                                 │  │
│  │   💰 Cost: $0                                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PHASE 6: Concept Clustering                                      │  │
│  │   • Pure TypeScript algorithm (no API calls)                    │  │
│  │   • Group related signals                                       │  │
│  │   💰 Cost: $0                                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                           │
│  {                                                                       │
│    metadata: {                                                           │
│      request_id: "uuid",                                                 │
│      targets_analyzed: 2,                                                │
│      total_customers_analyzed: 45,                                       │
│      processing_time_seconds: 180,                                        │
│      cost_breakdown: {                                                   │
│        exa: { total_cost: 0.1250 },                                     │
│        openai: { total_cost: 0.0285 },                                  │
│        total_cost: 0.1535                                                │
│      }                                                                   │
│    },                                                                    │
│    results: [                                                            │
│      {                                                                    │
│        target: { name: "Legora", domain: "legora.com" },                │
│        extracted_icp: {...},                                            │
│        icp_definition: {...},                                           │
│        good_fit_examples: [...],                                         │
│        competitors: [...]                                               │
│      }                                                                   │
│    ],                                                                    │
│    signal_analysis: {                                                    │
│      positive_signals: [...],                                            │
│      negative_signals: [...],                                              │
│      concept_clusters: [...]                                             │
│    },                                                                    │
│    enrichment_recommendations: [...]                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## LLM Prompt Summary

### Prompt Locations

1. **Phase 0 (Fallback)**: `icp-extractor.ts` → `extractWithLLM()`
   - **Model**: `gpt-4o-mini`
   - **Purpose**: Extract ICP from website content
   - **Input**: Combined website pages (max 20K chars)
   - **Output**: Structured ExtractedICP JSON

2. **Phase 1 (Fallback)**: `customer-extractor.ts` → `extractFromPage()`
   - **Model**: `gpt-4o-mini`
   - **Purpose**: Extract customer company names from page content
   - **Input**: Page content (max 15K chars)
   - **Output**: Array of customer names

3. **Phase 2**: `customer-researcher.ts` → `extractFeatures()`
   - **Model**: `gpt-4o-mini`
   - **Purpose**: Extract business signals from customer website
   - **Input**: Combined website content (max 15K chars)
   - **Output**: OpenEndedExtraction JSON (pricing, business model, integrations, etc.)

4. **Phase 3**: `icp-summarizer.ts` → `summarize()`
   - **Model**: `gpt-4o-mini`
   - **Purpose**: Analyze customer patterns and generate ICP definition
   - **Input**: JSON array of customer summaries
   - **Output**: ICPDefinition with anti-ICP criteria and search queries

### No LLM Prompts

- **Phase 5 (TF-IDF)**: Pure algorithmic analysis
- **Phase 6 (Clustering)**: Pure algorithmic clustering

---

## User Feedback Points

**Current Implementation**: No user feedback points (fully automated)

**Potential Future Feedback Points**:
1. **After Phase 0**: Review extracted ICP, allow corrections
2. **After Phase 1**: Review customer list, add/remove customers
3. **After Phase 3**: Review ICP definition, refine criteria
4. **After Phase 5**: Review signals, filter/prioritize manually

---

## Cost Breakdown Example

For a typical run with 1 target, 30 customers, 20 non-ICP:

```
Phase 0: ICP Extraction
  Exa Websets: $0.01 + ($0.001 × 8 items) = $0.018
  OpenAI (fallback): ~$0.002
  Subtotal: ~$0.02

Phase 1: Customer Extraction
  Exa Websets: $0.01 + ($0.001 × 20 items) = $0.03
  OpenAI (fallback): ~$0.01
  Subtotal: ~$0.04

Phase 2: Customer Research (30 customers)
  Exa search: 30 × $0.002 = $0.06
  Exa getContents: 30 × 7 pages × $0.003 = $0.63
  OpenAI extraction: 30 × $0.003 = $0.09
  Subtotal: ~$0.78

Phase 3: ICP Summarization
  OpenAI: ~$0.005
  Subtotal: ~$0.005

Phase 4: Non-ICP Generation (50 companies)
  Exa search: 10 queries × $0.002 = $0.02
  Phase 2 research: 50 × $0.78/30 = $1.30
  Subtotal: ~$1.32

Phase 5-6: Signal Discovery & Clustering
  $0 (no API calls)

─────────────────────────────────────────
TOTAL: ~$2.16 per target
```

---

## API Endpoints

### Main Endpoint

**POST** `/api/icp-discovery`

**Request**:
```json
{
  "targets": [
    { "name": "Legora", "website": "legora.com" }
  ],
  "config": {
    "customer_limit": 30,
    "competitor_limit": 5,
    "same_vertical_non_icp_limit": 20,
    "different_vertical_non_icp_limit": 30
  }
}
```

**Response**: See `ICPDiscoveryResponse` type in `types.ts`

---

## Error Handling & Fallbacks

1. **Exa Websets fails** → Fall back to `searchAndContents` + LLM
2. **LLM extraction fails** → Return empty/default values
3. **Customer research fails** → Mark as `research_status: 'failed'`, exclude from analysis
4. **Too few samples** → Log warning, proceed with available data

---

## Performance Characteristics

- **Processing Time**: ~2-5 minutes per target (depending on customer count)
- **API Rate Limits**: Built-in delays (200ms between requests)
- **Parallelization**: Customer research batched (3 at a time)
- **Caching**: None currently (can be added for customer research results)

---

## Future Enhancements

1. **User Feedback Loops**: Add review/approval steps
2. **Caching**: Cache customer research results
3. **Async Processing**: Queue long-running jobs
4. **Historical Comparison**: Track signal changes over time
5. **ML Classification**: Train classifier on signals for scoring
