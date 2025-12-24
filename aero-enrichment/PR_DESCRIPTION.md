# ICP Signal Discovery API - Complete Workflow Implementation

## Overview

This PR adds a comprehensive, end-to-end ICP Signal Discovery API to the `aero-enrichment` folder. The API reverse-engineers any company's Ideal Customer Profile by analyzing their customers, competitors, and generating control groups for comparison.

## What's Included

### 🎯 Core Functionality

- **Phase 0**: Extract ICP from target website using Exa Websets API
- **Phase 1**: Extract customer names from case studies, testimonials, logos
- **Phase 2**: Deep research each customer (website discovery, page scraping, feature extraction)
- **Phase 2.5-2.7**: Discover competitors and extract their customers
- **Phase 3**: Summarize ICP patterns across all customers
- **Phase 3.5-4**: Generate same-vertical and different-vertical non-ICP control groups
- **Phase 5**: TF-IDF signal discovery (2-3 word n-grams)
- **Phase 6**: Concept clustering (group related signals)

### 📁 New Files

```
aero-enrichment/
├── src/icp-discovery/
│   ├── index.ts                          # Main exports
│   ├── types.ts                          # All TypeScript interfaces
│   ├── config.ts                         # Default configuration
│   ├── icp-discovery-service.ts          # Main orchestration service
│   ├── services/
│   │   ├── icp-extractor.ts             # Phase 0
│   │   ├── customer-extractor.ts        # Phase 1
│   │   ├── customer-researcher.ts        # Phase 2
│   │   ├── icp-summarizer.ts             # Phase 3
│   │   └── non-icp-generator.ts          # Phase 4
│   ├── analysis/
│   │   └── tfidf-service.ts              # Phase 5-6
│   └── utils/
│       └── cost-tracker.ts                # Cost tracking utility
├── scripts/
│   └── run-icp-discovery.ts              # CLI runner
└── docs/
    ├── ICP-SIGNAL-DISCOVERY-SPECIFICATION.md  # Exhaustive API spec
    └── ICP-DISCOVERY-WORKFLOW-SUMMARY.md       # Visual workflow guide
```

### 🔧 Key Features

1. **Exa Websets API Integration**: Uses structured extraction for ICP and customer discovery
2. **Comprehensive Cost Tracking**: Tracks Exa and OpenAI API costs by phase and operation
3. **TF-IDF Signal Discovery**: Pure TypeScript implementation (no Python dependency)
4. **Concept Clustering**: Groups related signals into business concepts
5. **CLI & Programmatic API**: Both command-line and library usage

### 📊 API Response Structure

```typescript
{
  metadata: {
    request_id: string;
    targets_analyzed: number;
    total_customers_analyzed: number;
    processing_time_seconds: number;
    cost_breakdown: {
      exa: { total_cost: number; ... };
      openai: { total_cost: number; ... };
      total_cost: number;
    };
  };
  results: Array<{
    target: { name: string; domain: string };
    extracted_icp: ExtractedICP;
    icp_definition: ICPDefinition;
    good_fit_examples: GoodFitExample[];
    competitors: Competitor[];
  }>;
  signal_analysis: {
    positive_signals: DifferentialSignal[];
    negative_signals: DifferentialSignal[];
    concept_clusters: ConceptCluster[];
  };
  enrichment_recommendations: EnrichmentRecommendation[];
}
```

### 💰 Cost Tracking

- Tracks all Exa API calls (Websets, searches, content fetches)
- Tracks all OpenAI API calls (token usage with model-specific pricing)
- Provides breakdown by phase and service
- Included in API response metadata

### 📖 Documentation

1. **ICP-SIGNAL-DISCOVERY-SPECIFICATION.md**: 739-line exhaustive specification
   - Complete API schemas
   - All phase specifications
   - Configuration options
   - Error handling
   - Usage examples

2. **ICP-DISCOVERY-WORKFLOW-SUMMARY.md**: Visual workflow guide
   - Phase-by-phase diagrams
   - Input/output specifications
   - LLM prompt locations
   - User feedback points
   - Cost breakdown examples

### 🚀 Usage

#### CLI
```bash
npm run icp-discovery -- --target legora.com
npm run icp-discovery -- --targets "legora.com,harvey.ai" --output results.json
npm run icp-discovery -- --csv accounts.csv --name-col "Company" --website-col "Website"
```

#### Programmatic
```typescript
import { ICPDiscoveryService } from './src/icp-discovery';

const service = new ICPDiscoveryService({
  exaApiKey: process.env.EXA_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
});

const results = await service.discover({
  targets: [
    { name: 'Legora', website: 'legora.com' },
  ],
});

console.log(results.signal_analysis.positive_signals);
console.log(results.metadata.cost_breakdown.total_cost);
```

## Testing

- All services are TypeScript-typed
- Cost tracking integrated throughout
- Fallback mechanisms for API failures
- Error handling with graceful degradation

## Dependencies Added

- `uuid`: For request IDs
- `zod`: For schema validation (already in use)

## Breaking Changes

None - this is a new feature addition.

## Next Steps

1. Test with real accounts
2. Add caching for customer research results
3. Add user feedback loops (review/approval steps)
4. Add async processing for long-running jobs

## Related Issues

N/A - New feature implementation
