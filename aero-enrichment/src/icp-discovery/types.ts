/**
 * ICP Signal Discovery - Type Definitions
 * 
 * All TypeScript interfaces for the ICP Signal Discovery API.
 */

// ============================================
// API Request/Response Types
// ============================================

export interface ICPDiscoveryRequest {
  targets: TargetAccount[];
  config?: ICPDiscoveryConfig;
  webhook_url?: string;
}

export interface TargetAccount {
  name: string;
  website: string;
}

export interface ICPDiscoveryConfig {
  customer_limit?: number;
  competitor_limit?: number;
  same_vertical_non_icp_limit?: number;
  different_vertical_non_icp_limit?: number;
  skip_icp_extraction?: boolean;
  skip_competitors?: boolean;
}

export interface ICPDiscoveryResponse {
  metadata: ResponseMetadata;
  results: TargetResult[];
  signal_analysis: SignalAnalysis;
  enrichment_recommendations: EnrichmentRecommendation[];
}

export interface ResponseMetadata {
  request_id: string;
  targets_analyzed: number;
  generated_at: string;
  processing_time_seconds: number;
  total_customers_analyzed: number;
  competitors_found: number;
  same_vertical_non_icp_count: number;
  different_vertical_non_icp_count: number;
  cost_breakdown?: CostBreakdown;
  costs_by_phase?: Record<string, { exa: number; openai: number; total: number }>;
}

export interface CostBreakdown {
  exa: {
    websets_created: number;
    webset_items_retrieved: number;
    searches: number;
    content_fetches: number;
    total_cost: number;
  };
  openai: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    total_cost: number;
  };
  total_cost: number;
}

export interface TargetResult {
  target: {
    name: string;
    domain: string;
  };
  extracted_icp: ExtractedICP;
  icp_definition: ICPDefinition;
  good_fit_examples: GoodFitExample[];
  competitors: Competitor[];
}

export interface GoodFitExample {
  name: string;
  domain: string;
  industry: string;
  signals_matched: string[];
  fit_score: number;
}

export interface SignalAnalysis {
  positive_signals: DifferentialSignal[];
  negative_signals: DifferentialSignal[];
  concept_clusters: ConceptCluster[];
}

export interface EnrichmentRecommendation {
  query: string;
  purpose: string;
  expected_signal: string;
}

// ============================================
// Phase 0: Extracted ICP Types
// ============================================

export interface ExtractedICP {
  target_customer: {
    industries: string[];
    company_size: string;
    business_model: string;
    geographic_focus?: string;
  };
  buyer_personas: BuyerPersona[];
  primary_use_cases: UseCase[];
  differentiator: {
    status_quo: string;
    solution: string;
  };
  key_capabilities: string[];
}

export interface BuyerPersona {
  seniority: string;
  function: string;
  title: string;
}

export interface UseCase {
  name: string;
  description: string;
}

// ============================================
// Phase 1: Customer Extraction Types
// ============================================

export interface ExtractedCustomer {
  name: string;
  industry?: string;
  context?: string;
  source_url: string;
}

// ============================================
// Phase 2: Researched Customer Types
// ============================================

export interface ResearchedCustomer {
  company_id: string;
  company_name: string;
  website: string;
  domain: string;
  is_customer: boolean;
  research_status: 'success' | 'partial' | 'failed';
  
  // Page presence
  page_presence: PagePresence;
  
  // Content for TF-IDF
  combined_content: string;
  
  // Embedding for semantic search
  embedding: number[];
  
  // LLM extraction
  llm_extraction: OpenEndedExtraction;
}

export interface PagePresence {
  homepage: boolean;
  about: boolean;
  pricing: boolean;
  trust: boolean;
  support: boolean;
  careers: boolean;
  customers: boolean;
  product: boolean;
  integrations: boolean;
}

export interface OpenEndedExtraction {
  // Pricing signals
  pricing_model: string;
  pricing_tiers: string[];
  pricing_transparency: string;
  free_tier: string;
  trial_details: string;
  
  // Form & CTA signals
  primary_cta: string;
  signup_friction: string;
  form_fields_observed: string[];
  
  // Business model
  business_model: string;
  target_buyer: string;
  target_company_size: string;
  b2b_or_b2c: string;
  
  // Integrations
  crm_integrations: string[];
  productivity_integrations: string[];
  developer_integrations: string[];
  data_integrations: string[];
  other_integrations: string[];
  
  // Careers signals
  hiring_departments: string[];
  job_titles_observed: string[];
  hiring_signals: string[];
  engineering_team_size_signals: string[];
  
  // Trust & compliance
  security_certifications: string[];
  customer_logos: string[];
  customer_count_signal: string;
  
  // Maturity signals
  funding_stage: string;
  employee_count_signal: string;
  founded_year: string;
  
  // Positioning
  unique_value_prop: string;
  competitive_positioning: string[];
  
  // Legacy compatibility
  key_capabilities?: string[];
  key_features?: string[];
}

// ============================================
// Phase 2.5: Competitor Types
// ============================================

export interface Competitor {
  name: string;
  domain: string;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// Phase 3: ICP Definition Types
// ============================================

export interface ICPDefinition {
  target_industries: string[];
  company_size: string;
  business_model: string;
  common_technologies: string[];
  common_departments: string[];
  common_pain_points: string[];
  typical_funding_stage: string;
  typical_employee_range: string;
  unique_characteristics: string[];
  
  // For non-ICP generation
  anti_icp_criteria: string[];
  anti_icp_search_queries: string[];
  same_vertical_anti_icp_criteria: string[];
  same_vertical_search_queries: string[];
}

// ============================================
// Phase 4: Non-ICP Types
// ============================================

export interface NonICPCompany extends ResearchedCustomer {
  anti_icp_reason: string;
}

export interface SameVerticalNonICPCompany extends ResearchedCustomer {
  same_vertical_anti_icp_reason: string;
}

// ============================================
// Phase 5: Signal Discovery Types
// ============================================

export interface DifferentialSignal {
  term: string;
  positive_pct: number;
  negative_pct: number;
  lift: number;
}

export interface TfidfVector {
  [term: string]: number;
}

// ============================================
// Phase 6: Concept Clustering Types
// ============================================

export interface ConceptCluster {
  concept: string;
  representative: string;
  phrases: string[];
  avg_positive_pct: number;
  avg_negative_pct: number;
  avg_lift: number;
}

// ============================================
// Page Discovery Types
// ============================================

export type PageIntent = 
  | 'homepage'
  | 'about'
  | 'pricing'
  | 'trust'
  | 'support'
  | 'careers'
  | 'customers'
  | 'product'
  | 'integrations';

export interface DiscoveredPage {
  url: string;
  title: string;
  content: string;
  intent: PageIntent;
  domain: string;
  contentLength: number;
}

// ============================================
// Exa API Types
// ============================================

export interface WebsetConfig {
  query: string;
  count?: number;
  entityType?: 'company' | 'person' | 'research_paper' | 'other';
  criteria?: Array<{ description: string }>;
  enrichments?: Array<{ query: string }>;
  metadata?: Record<string, any>;
}

export interface WebsetItem {
  id: string;
  url: string;
  title: string;
  text?: string;
  properties: Record<string, any>;
  verified: boolean;
  reasoning?: string;
}

// ============================================
// Configuration Types
// ============================================

export interface PipelineConfig {
  // Limits
  maxPagesPerSite: number;
  maxCustomersPerTarget: number;
  maxCompetitorsPerTarget: number;
  maxSameVerticalNonICP: number;
  maxDifferentVerticalNonICP: number;
  
  // TF-IDF
  ngramRange: [number, number];
  minDocFrequency: number;
  topSignalsToReport: number;
  
  // Models
  embeddingModel: string;
  extractionModel: string;
  
  // Rate limiting
  requestDelayMs: number;
  maxConcurrentRequests: number;
  
  // Timeouts
  websetTimeoutSeconds: number;
  websetPollIntervalSeconds: number;
  
  // Output
  outputDir: string;
  useCache: boolean;
  cacheDir: string;
}

// ============================================
// Report Types
// ============================================

export interface ICPReport {
  metadata: {
    target: string;
    generated_at: string;
    extracted_icp: ExtractedICP | null;
    target_customers_extracted: number;
    target_customers_researched: number;
    competitors_found: number;
    competitor_customers_researched: number;
    total_customers_analyzed: number;
    same_vertical_non_icp_generated: number;
    different_vertical_non_icp_generated: number;
    total_negative_samples: number;
    processing_time_seconds: number;
  };
  icp_definition: ICPDefinition;
  positive_signals: DifferentialSignal[];
  negative_signals: DifferentialSignal[];
  concept_clusters: ConceptCluster[];
  customer_sources: Array<{ name: string; source: string }>;
  competitors: Array<{ name: string; domain: string; confidence: string }>;
}
