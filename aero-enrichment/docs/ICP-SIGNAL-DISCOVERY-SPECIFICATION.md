# ICP Signal Discovery API Specification

## Overview

The ICP Signal Discovery API is a self-serve lead magnet tool that reverse-engineers a company's Ideal Customer Profile (ICP) by analyzing their customers, competitors' customers, and generating control groups for comparison. It identifies unique signals, concepts, and enrichment fields that differentiate ideal customers from bad fits.

## Product Vision

### Input
A list of target account names and websites (e.g., `[{ name: "Legora", website: "legora.com" }]`)

### Output
A unified asset containing:
1. **Extracted ICP Definition** - Structured understanding of target customer
2. **Good Fit Examples** - Real companies that match the ICP with evidence
3. **Hard-to-See Signals** - Unique differentiating signals (n-grams, concepts, features)
4. **Bad Fit Indicators** - Signals that indicate poor fit
5. **Enrichment Queries** - Suggested queries for sales intelligence

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ICP SIGNAL DISCOVERY API                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Phase 0   │───▶│   Phase 1   │───▶│   Phase 2   │───▶│   Phase 3   │  │
│  │ ICP Extract │    │  Customers  │    │  Research   │    │ Summarize   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Exa Websets API (Structured Extraction)          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Phase 4   │───▶│   Phase 5   │───▶│   Phase 6   │───▶│   Output    │  │
│  │ Non-ICP Gen │    │  TF-IDF     │    │ Clustering  │    │   Report    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Target Website(s)
        │
        ▼
┌───────────────────┐
│ Phase 0: Extract  │ ──▶ Extracted ICP (industries, personas, use cases)
│ ICP from Website  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Phase 1: Extract  │ ──▶ Customer List [{name, source_url}]
│ Customers         │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Phase 2: Research │ ──▶ ResearchedCustomer[] (features, content)
│ Each Customer     │
└───────────────────┘
        │
        ├────────────────────────────────────────┐
        ▼                                        ▼
┌───────────────────┐                  ┌───────────────────┐
│ Phase 2.5-2.7:    │ ──▶ Additional   │ Phase 3: Summarize│ ──▶ ICPDefinition
│ Competitor        │     Customers    │ ICP Pattern       │
│ Discovery         │                  └───────────────────┘
└───────────────────┘                            │
                                                 ▼
                                      ┌───────────────────┐
                                      │ Phase 3.5-4:      │ ──▶ Non-ICP Companies
                                      │ Generate Non-ICP  │
                                      │ (Same + Different │
                                      │  Vertical)        │
                                      └───────────────────┘
                                                 │
                                                 ▼
                                      ┌───────────────────┐
                                      │ Phase 5: Signal   │ ──▶ Differential Signals
                                      │ Discovery (TF-IDF)│
                                      └───────────────────┘
                                                 │
                                                 ▼
                                      ┌───────────────────┐
                                      │ Phase 6: Cluster  │ ──▶ Concept Clusters
                                      │ & Output Report   │
                                      └───────────────────┘
```

---

## API Specification

### Endpoint: `POST /api/icp-discovery`

#### Request Body

```typescript
interface ICPDiscoveryRequest {
  // Required: List of target accounts to analyze
  targets: Array<{
    name: string;      // Company name (e.g., "Legora")
    website: string;   // Website URL or domain (e.g., "legora.com")
  }>;
  
  // Optional configuration
  config?: {
    customer_limit?: number;              // Max customers to extract per target (default: 30)
    competitor_limit?: number;            // Max competitors per target (default: 5)
    same_vertical_non_icp_limit?: number; // Same-vertical control group size (default: 20)
    different_vertical_non_icp_limit?: number; // Different-vertical control group size (default: 30)
    skip_icp_extraction?: boolean;        // Skip website ICP extraction (default: false)
    skip_competitors?: boolean;           // Skip competitor discovery (default: false)
  };
  
  // Optional webhook for async results
  webhook_url?: string;
}
```

#### Response Body

```typescript
interface ICPDiscoveryResponse {
  // Request metadata
  metadata: {
    request_id: string;
    targets_analyzed: number;
    generated_at: string;
    processing_time_seconds: number;
    
    // Counts
    total_customers_analyzed: number;
    competitors_found: number;
    same_vertical_non_icp_count: number;
    different_vertical_non_icp_count: number;
  };
  
  // Per-target results
  results: Array<{
    target: {
      name: string;
      domain: string;
    };
    
    // Phase 0: Extracted ICP from website
    extracted_icp: ExtractedICP;
    
    // Phase 3: Summarized ICP from customer analysis
    icp_definition: ICPDefinition;
    
    // Good fit examples (researched customers)
    good_fit_examples: Array<{
      name: string;
      domain: string;
      industry: string;
      signals_matched: string[];
      fit_score: number;
    }>;
    
    // Discovered competitors
    competitors: Array<{
      name: string;
      domain: string;
      confidence: 'high' | 'medium' | 'low';
    }>;
  }>;
  
  // Unified signal analysis (across all targets)
  signal_analysis: {
    // Top differentiating phrases (2-3 word n-grams)
    positive_signals: Array<{
      term: string;           // The phrase (e.g., "parametric design")
      positive_pct: number;   // % of ICP companies with this phrase
      negative_pct: number;   // % of non-ICP companies with this phrase
      lift: number;           // Relative lift (pos_pct / neg_pct)
    }>;
    
    // Phrases more common in non-ICP
    negative_signals: Array<{
      term: string;
      positive_pct: number;
      negative_pct: number;
      lift: number;
    }>;
    
    // Concept clusters (grouped related phrases)
    concept_clusters: Array<{
      concept: string;        // Cluster name
      representative: string; // Best representative phrase
      phrases: string[];      // All phrases in cluster
      avg_positive_pct: number;
      avg_negative_pct: number;
      avg_lift: number;
    }>;
  };
  
  // Actionable enrichment queries
  enrichment_recommendations: Array<{
    query: string;
    purpose: string;
    expected_signal: string;
  }>;
}
```

---

## Phase Specifications

### Phase 0: ICP Extraction from Website

**Purpose**: Extract the target company's self-defined ICP from their website before customer analysis.

**Input**: Target domain (e.g., `legora.com`)

**Process**:
1. Use Exa Websets API with structured criteria
2. Target pages: homepage, about, product, pricing, customers, features
3. Extract via LLM if Websets returns empty

**Output Schema**:
```typescript
interface ExtractedICP {
  target_customer: {
    industries: string[];           // ["Aerospace", "Automotive", "Defense"]
    company_size: string;           // "Enterprise" | "Mid-market" | "SMB"
    business_model: string;         // "B2B SaaS" | "B2B Services" | etc.
    geographic_focus?: string;      // "North America" | "Global" | etc.
  };
  buyer_personas: Array<{
    seniority: string;              // "Vice President" | "Director" | "Manager"
    function: string;               // "Engineering" | "Product" | "Sales"
    title: string;                  // Full job title
  }>;
  primary_use_cases: Array<{
    name: string;                   // "Design Space Exploration"
    description: string;            // How customers use the product
  }>;
  differentiator: {
    status_quo: string;             // Current problem customers face
    solution: string;               // How the product solves it
  };
  key_capabilities: string[];       // ["Parametric modeling", "CFD simulation"]
}
```

---

### Phase 1: Customer Extraction

**Purpose**: Discover all publicly listed customers of the target company.

**Input**: Target domain

**Process**:
1. Use Exa Websets API to find customer-related pages
2. Structured criteria for customer names, case studies, logos
3. LLM fallback for text extraction
4. Deduplicate and validate names

**Output**:
```typescript
interface ExtractedCustomer {
  name: string;           // "Northrop Grumman"
  industry?: string;      // "Aerospace & Defense"
  context?: string;       // "Uses for aircraft design optimization"
  source_url: string;     // "https://legora.com/customers"
}
```

---

### Phase 2: Customer Research

**Purpose**: Deep research on each extracted customer to gather features.

**Input**: List of extracted customers

**Process**:
1. Find official website via Exa search
2. Discover key pages (homepage, about, pricing, careers, etc.)
3. Extract open-ended features via LLM
4. Generate embedding for semantic search

**Output**:
```typescript
interface ResearchedCustomer {
  // Identity
  company_name: string;
  domain: string;
  
  // Research status
  research_status: 'success' | 'partial' | 'failed';
  
  // Features (from open-ended extractor)
  llm_extraction: {
    pricing_model: string;
    business_model: string;
    target_buyer: string;
    b2b_or_b2c: string;
    crm_integrations: string[];
    hiring_departments: string[];
    security_certifications: string[];
    funding_stage: string;
    unique_value_prop: string;
    // ... many more fields
  };
  
  // Raw content for TF-IDF
  combined_content: string;
  
  // Semantic embedding
  embedding: number[];
  
  // Page presence
  page_presence: {
    homepage: boolean;
    about: boolean;
    pricing: boolean;
    careers: boolean;
    // etc.
  };
}
```

---

### Phase 2.5-2.7: Competitor Discovery & Customer Expansion

**Purpose**: Find competitors and extract their customers to expand the positive sample set.

**Process**:
1. Use Exa Websets to find competitors in same industry
2. Extract customers from each competitor
3. Research competitor customers
4. Merge with target customers (deduplicated)

**Output**: Expanded list of ResearchedCustomer[]

---

### Phase 3: ICP Summarization

**Purpose**: Analyze patterns across all researched customers to define the ICP.

**Input**: All researched customers (from target + competitors)

**Process**:
1. Aggregate industry patterns
2. Identify common technologies, departments, pain points
3. Determine typical size and funding stage
4. Generate anti-ICP criteria for control group generation

**Output**:
```typescript
interface ICPDefinition {
  target_industries: string[];           // ["Aerospace", "Automotive"]
  company_size: string;                  // "Enterprise (1000+ employees)"
  business_model: string;                // "B2B hardware manufacturing"
  common_technologies: string[];         // ["CAD/CAM", "PLM systems"]
  common_departments: string[];          // ["Engineering", "R&D"]
  common_pain_points: string[];          // ["Design iteration time"]
  typical_funding_stage: string;         // "Public" | "Series D+"
  typical_employee_range: string;        // "1000-10000"
  unique_characteristics: string[];      // ["Heavy regulatory compliance"]
  
  // For non-ICP generation
  anti_icp_criteria: string[];           // ["Consumer apps", "E-commerce"]
  anti_icp_search_queries: string[];     // Exa queries for different verticals
  same_vertical_anti_icp_criteria: string[];  // ["Small consulting firms"]
  same_vertical_search_queries: string[];     // Exa queries for same vertical non-fits
}
```

---

### Phase 3.5-4: Non-ICP Generation

**Purpose**: Generate control groups for differential analysis.

**Two Types**:
1. **Same-Vertical Non-ICP**: Companies in same industry but different characteristics
   - Example: Small engineering consultancies vs. large manufacturers
   
2. **Different-Vertical Non-ICP**: Companies in completely different industries
   - Example: E-commerce retailers vs. aerospace manufacturers

**Process**:
1. Use LLM-generated search queries from ICPDefinition
2. Search via Exa for real companies matching anti-ICP criteria
3. Research each to extract features
4. Validate they don't overlap with ICP customers

---

### Phase 5: Signal Discovery (TF-IDF)

**Purpose**: Identify differentiating signals between ICP and non-ICP companies.

**Process**:
1. Fit TF-IDF on all documents (positive + negative)
2. Compute differential signals (lift analysis)
3. Filter for 2-3 word n-grams (unique phrases, not single keywords)
4. Sort by lift (positive_pct / negative_pct)

**Output**:
```typescript
interface DifferentialSignal {
  term: string;           // "parametric design"
  positive_pct: number;   // 65.0 (65% of ICP companies mention this)
  negative_pct: number;   // 5.0 (5% of non-ICP mention this)
  lift: number;           // 13.0x
}
```

**Configuration**:
- N-gram range: [2, 3] (2-3 word phrases)
- Min document frequency: 2 (at least 2 companies must mention)
- Lift threshold for positive signals: > 1.2x
- Lift threshold for negative signals: < 0.8x

---

### Phase 6: Concept Clustering

**Purpose**: Group related signals into business concepts.

**Process**:
1. Embed all top signals
2. Cluster using semantic similarity
3. Generate concept name for each cluster
4. Select representative phrase

**Output**:
```typescript
interface ConceptCluster {
  concept: string;              // "Computational Design"
  representative: string;       // "parametric modeling"
  phrases: string[];            // ["parametric design", "topology optimization", "generative design"]
  avg_positive_pct: number;     // Average across phrases
  avg_negative_pct: number;
  avg_lift: number;
}
```

---

## Service Interfaces

### ExaClient (Websets API)

```typescript
class ExaClient {
  // Standard search
  search(query: string, options: ExaSearchOptions): Promise<ExaSearchResponse>;
  searchAndContents(query: string, options: ExaSearchOptions): Promise<ExaSearchResponse>;
  
  // Direct URL content
  getContents(urls: string[], options: GetContentsOptions): Promise<ExaSearchResponse>;
  
  // Websets API (structured extraction)
  createWebset(config: WebsetConfig): Promise<{ websetId: string; status: string }>;
  getWebsetStatus(websetId: string): Promise<{ status: string }>;
  getWebsetItems(websetId: string, options?: PaginationOptions): Promise<WebsetItems>;
  waitForWebset(websetId: string, options?: WaitOptions): Promise<WebsetItem[]>;
}

interface WebsetConfig {
  query: string;
  count?: number;
  entityType?: 'company' | 'person' | 'research_paper' | 'other';
  criteria?: Array<{ description: string }>;
  enrichments?: Array<{ query: string }>;
  metadata?: Record<string, any>;
}
```

### TfidfService

```typescript
class TfidfService {
  constructor(options: { ngramRange: [number, number]; minDocFrequency: number });
  
  fit(documents: string[]): void;
  transform(document: string): Record<string, number>;
  computeDifferential(positiveVectors: Record<string, number>[], negativeVectors: Record<string, number>[]): DifferentialSignal[];
  clusterPhrases(signals: DifferentialSignal[]): ConceptCluster[];
}
```

---

## Configuration

### Environment Variables

```bash
# Required
EXA_API_KEY=exa_...
OPENAI_API_KEY=sk-...

# Optional
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
MAX_CONCURRENT_REQUESTS=5
REQUEST_DELAY_MS=200
```

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
  // Limits
  maxPagesPerSite: 10,
  maxCustomersPerTarget: 30,
  maxCompetitorsPerTarget: 5,
  maxSameVerticalNonICP: 20,
  maxDifferentVerticalNonICP: 30,
  
  // TF-IDF
  ngramRange: [2, 3],
  minDocFrequency: 2,
  topSignalsToReport: 30,
  
  // Models
  embeddingModel: 'text-embedding-3-small',
  extractionModel: 'gpt-4o-mini',
  
  // Rate limiting
  requestDelayMs: 200,
  maxConcurrentRequests: 5,
  
  // Timeouts
  websetTimeoutSeconds: 120,
  websetPollIntervalSeconds: 3,
};
```

---

## Error Handling

### Fallback Chain

1. **Websets API fails** → Fall back to `searchAndContents` + LLM extraction
2. **LLM extraction fails** → Return empty/default values
3. **Customer research fails** → Mark as `research_status: 'failed'`, exclude from analysis
4. **Too few samples** → Log warning, proceed with available data

### Error Response

```typescript
interface ICPDiscoveryError {
  error: {
    code: string;           // "INSUFFICIENT_DATA" | "API_ERROR" | etc.
    message: string;
    details?: {
      phase: string;        // Which phase failed
      target?: string;      // Which target if applicable
    };
  };
}
```

---

## Output Examples

### Good Fit Example

```json
{
  "name": "Northrop Grumman",
  "domain": "northropgrumman.com",
  "industry": "Aerospace & Defense",
  "signals_matched": [
    "parametric design",
    "topology optimization",
    "aircraft structures",
    "defense contractor"
  ],
  "fit_score": 0.92
}
```

### Signal Example

```json
{
  "term": "parametric modeling",
  "positive_pct": 72.5,
  "negative_pct": 4.2,
  "lift": 17.3
}
```

### Concept Cluster Example

```json
{
  "concept": "Computational Design",
  "representative": "parametric modeling",
  "phrases": [
    "parametric modeling",
    "parametric design",
    "generative design",
    "topology optimization"
  ],
  "avg_positive_pct": 65.2,
  "avg_negative_pct": 3.8,
  "avg_lift": 15.6
}
```

---

## File Structure

```
aero-enrichment/
├── src/
│   ├── icp-discovery/
│   │   ├── index.ts                    # Main export
│   │   ├── types.ts                    # All TypeScript interfaces
│   │   ├── config.ts                   # Configuration defaults
│   │   ├── icp-discovery-service.ts    # Main orchestration service
│   │   ├── services/
│   │   │   ├── icp-extractor.ts        # Phase 0
│   │   │   ├── customer-extractor.ts   # Phase 1
│   │   │   ├── customer-researcher.ts  # Phase 2
│   │   │   ├── competitor-discoverer.ts # Phase 2.5
│   │   │   ├── icp-summarizer.ts       # Phase 3
│   │   │   ├── non-icp-generator.ts    # Phase 4
│   │   │   ├── same-vertical-generator.ts # Phase 3.5
│   │   │   └── open-ended-extractor.ts # LLM extraction
│   │   ├── analysis/
│   │   │   ├── tfidf-service.ts        # TF-IDF analysis
│   │   │   ├── embedding-service.ts    # Semantic embeddings
│   │   │   └── clustering.ts           # Concept clustering
│   │   └── utils/
│   │       ├── page-discoverer.ts      # Web crawling
│   │       └── validation.ts           # Input validation
│   ├── exa-client.ts                   # Exa API wrapper
│   └── index.ts                        # Library export
├── scripts/
│   └── run-icp-discovery.ts            # CLI runner
├── api/
│   └── icp-discovery.ts                # API endpoint (if deploying)
├── docs/
│   └── ICP-SIGNAL-DISCOVERY-SPECIFICATION.md
├── package.json
├── tsconfig.json
└── README.md
```

---

## Usage Examples

### CLI Usage

```bash
# Single target
npx tsx scripts/run-icp-discovery.ts --target legora.com

# Multiple targets
npx tsx scripts/run-icp-discovery.ts \
  --targets "legora.com,harvey.ai,mycase.com" \
  --customer-limit 50 \
  --output output/icp-analysis.json

# From CSV
npx tsx scripts/run-icp-discovery.ts \
  --csv input/accounts.csv \
  --name-column "Company" \
  --website-column "Website"
```

### Programmatic Usage

```typescript
import { ICPDiscoveryService } from '@aero-enrichment/icp-discovery';

const service = new ICPDiscoveryService({
  exaApiKey: process.env.EXA_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
});

const results = await service.discover([
  { name: 'Legora', website: 'legora.com' },
  { name: 'Harvey', website: 'harvey.ai' },
]);

console.log(results.signal_analysis.positive_signals);
```

---

## Metrics & Monitoring

### Key Metrics

- **Processing time** per target
- **Customer extraction success rate**
- **Research success rate** (customers researched / customers extracted)
- **Signal quality** (avg lift of top signals)
- **Sample balance** (positive vs negative samples)

### Logging

Each phase logs:
- Start/end timestamps
- Items processed
- Errors encountered
- API calls made

---

## Future Enhancements

1. **Async Processing**: Queue long-running jobs, return webhook
2. **Caching**: Cache customer research results for reuse
3. **Historical Comparison**: Track signal changes over time
4. **Integration Enrichment**: Pull data from Crustdata, Apollo, etc.
5. **ML Classification**: Train classifier on signals for scoring
6. **UI Dashboard**: Visual exploration of signals and clusters
