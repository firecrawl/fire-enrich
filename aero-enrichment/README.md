# Aero Enrichment

A comprehensive company enrichment platform featuring the **ICP Signal Discovery API** - a self-serve lead magnet tool that reverse-engineers any company's Ideal Customer Profile.

## Features

### ICP Signal Discovery API

The ICP Signal Discovery API analyzes a target company's customers to identify:

- **Extracted ICP Definition** - Industries, buyer personas, use cases, differentiators
- **Good Fit Examples** - Real companies that match the ICP with evidence
- **Hard-to-See Signals** - Unique 2-3 word phrases that differentiate ICP vs non-ICP
- **Concept Clusters** - Grouped related signals into business concepts
- **Enrichment Recommendations** - Suggested queries for sales intelligence

### How It Works

1. **Phase 0: ICP Extraction** - Extract target company's self-defined ICP from their website
2. **Phase 1: Customer Extraction** - Find customers from case studies, logos, testimonials
3. **Phase 2: Customer Research** - Deep research each customer for features
4. **Phase 3: ICP Summarization** - Analyze patterns to define the ICP
5. **Phase 4: Control Group Generation** - Create same-vertical and different-vertical non-ICP
6. **Phase 5: Signal Discovery** - TF-IDF analysis to find differentiating phrases
7. **Phase 6: Concept Clustering** - Group related signals into concepts

## Installation

```bash
cd aero-enrichment
npm install
```

## Configuration

Set the following environment variables:

```bash
export EXA_API_KEY="exa_..."
export OPENAI_API_KEY="sk-..."
```

## Usage

### CLI Usage

```bash
# Single target
npm run icp-discovery -- --target legora.com

# Multiple targets
npm run icp-discovery -- --targets "legora.com,harvey.ai"

# From CSV
npm run icp-discovery -- --csv accounts.csv --name-col "Company" --website-col "Website"

# With options
npm run icp-discovery -- --target legora.com --customer-limit 50 --output results.json

# Help
npm run icp-discovery:help
```

### Programmatic Usage

```typescript
import { ICPDiscoveryService } from './src/icp-discovery';

const service = new ICPDiscoveryService({
  exaApiKey: process.env.EXA_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
});

const results = await service.discover({
  targets: [
    { name: 'Legora', website: 'legora.com' },
    { name: 'Harvey', website: 'harvey.ai' },
  ],
  config: {
    customer_limit: 30,
    competitor_limit: 5,
  },
});

console.log(results.signal_analysis.positive_signals);
```

## API Response Structure

```typescript
interface ICPDiscoveryResponse {
  metadata: {
    request_id: string;
    targets_analyzed: number;
    total_customers_analyzed: number;
    processing_time_seconds: number;
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

## Example Output

### Positive Signal

```json
{
  "term": "parametric modeling",
  "positive_pct": 72.5,
  "negative_pct": 4.2,
  "lift": 17.3
}
```

### Concept Cluster

```json
{
  "concept": "computational",
  "representative": "computational design",
  "phrases": ["computational design", "computational engineering", "topology optimization"],
  "avg_positive_pct": 65.2,
  "avg_negative_pct": 3.8,
  "avg_lift": 15.6
}
```

## Documentation

See [ICP Signal Discovery Specification](./docs/ICP-SIGNAL-DISCOVERY-SPECIFICATION.md) for detailed documentation.

## License

MIT
