// Main exports for the CrustData + Exa + SEC integration package

// Core clients
export { CrustDataClient } from './crustdata-client';
export { ExaClient } from './exa-client';
export { SECEdgarClient } from './sec-edgar-client';

// Enrichment services
export { CrustDataEnrichmentService } from './enrichment-service';
export { EnhancedEnrichmentService } from './enhanced-enrichment-service';

// Additional services
export { TickerDiscoveryService } from './ticker-discovery-service';
export { SECSignalsExtractor } from './sec-signals-extractor';
export { FirecrawlScraper } from './firecrawl-scraper';

// Types
export type {
  CrustDataCompany,
  CrustDataCompanyResponse,
  CrustDataSearchParams,
  CrustDataSearchResponse,
  CrustDataClientOptions,
  CrustDataEnrichmentResult,
} from './types';

export type {
  ExaSearchOptions,
  ExaSearchResult,
  ExaSearchResponse,
  ExaClientOptions,
} from './exa-client';

export type {
  TickerEntry,
  PublicCompanyMatch,
  TenKItem,
  EdgarFiling,
  FilingDownloadResult,
  SECClientOptions,
} from './sec-edgar-client';

export type {
  EnhancedEnrichmentResult,
  EnrichmentOptions,
} from './enhanced-enrichment-service';

export type {
  TickerResult,
  TickerDiscoveryOptions,
} from './ticker-discovery-service';

export type {
  SECSignals,
  FinancialMetrics,
  ProjectProgram,
  TechnologySignal,
  BusinessChallenge,
  StrategicPriority,
  OrganizationalChange,
  TimingUrgency,
  SignalExtractionOptions,
} from './sec-signals-extractor';

export type {
  ScrapeOptions,
  ScrapeResult,
  SearchOptions,
  SearchResult,
  FirecrawlScraperOptions,
} from './firecrawl-scraper';

// Re-export for convenience
export { CrustDataClient as CrustData } from './crustdata-client';
export { ExaClient as Exa } from './exa-client';
export { SECEdgarClient as SEC } from './sec-edgar-client';
export { CrustDataEnrichmentService as Enrichment } from './enrichment-service';
export { EnhancedEnrichmentService as Enhanced } from './enhanced-enrichment-service';
export { TickerDiscoveryService as TickerDiscovery } from './ticker-discovery-service';
export { SECSignalsExtractor as SECSignals } from './sec-signals-extractor';
export { FirecrawlScraper as Firecrawl } from './firecrawl-scraper';
