/**
 * ICP Discovery Service
 * 
 * Main orchestration service for the ICP Signal Discovery API.
 * Coordinates all phases of the pipeline.
 */

import { ICPExtractor } from './services/icp-extractor';
import { CustomerExtractor } from './services/customer-extractor';
import { CustomerResearcher } from './services/customer-researcher';
import { ICPSummarizer } from './services/icp-summarizer';
import { NonICPGenerator } from './services/non-icp-generator';
import { TfidfService } from './analysis/tfidf-service';
import { CostTracker } from './utils/cost-tracker';
import { DEFAULT_CONFIG, mergeConfig } from './config';
import type {
  ICPDiscoveryRequest,
  ICPDiscoveryResponse,
  TargetAccount,
  TargetResult,
  PipelineConfig,
  ResearchedCustomer,
  DifferentialSignal,
  ConceptCluster,
  GoodFitExample,
  EnrichmentRecommendation,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export interface ICPDiscoveryServiceOptions {
  exaApiKey: string;
  openaiApiKey: string;
  config?: Partial<PipelineConfig>;
}

export class ICPDiscoveryService {
  private exaApiKey: string;
  private openaiApiKey: string;
  private config: PipelineConfig;

  constructor(options: ICPDiscoveryServiceOptions) {
    this.exaApiKey = options.exaApiKey;
    this.openaiApiKey = options.openaiApiKey;
    this.config = mergeConfig(options.config || {});
  }

  /**
   * Main discovery method - processes all targets and returns unified results
   */
  async discover(request: ICPDiscoveryRequest): Promise<ICPDiscoveryResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();
    const costTracker = new CostTracker();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           ICP SIGNAL DISCOVERY API                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📋 Request ID: ${requestId}`);
    console.log(`📊 Targets: ${request.targets.length}`);

    // Initialize services with cost tracker
    const icpExtractor = new ICPExtractor(this.exaApiKey, this.openaiApiKey, costTracker);
    const customerExtractor = new CustomerExtractor(this.exaApiKey, this.openaiApiKey, costTracker);
    const customerResearcher = new CustomerResearcher(this.exaApiKey, this.openaiApiKey, costTracker);
    const summarizer = new ICPSummarizer(this.openaiApiKey, costTracker);
    const nonIcpGenerator = new NonICPGenerator(this.exaApiKey, this.openaiApiKey, costTracker);
    const tfidfService = new TfidfService({
      ngramRange: this.config.ngramRange,
      minDocFrequency: this.config.minDocFrequency,
    });

    // Merge config with request config
    const effectiveConfig = {
      ...this.config,
      ...(request.config || {}),
    };

    const results: TargetResult[] = [];
    const allPositiveCustomers: ResearchedCustomer[] = [];
    const allNegativeCompanies: ResearchedCustomer[] = [];
    let totalCompetitors = 0;

    // Process each target
    for (const target of request.targets) {
      const result = await this.processTarget(
        target,
        icpExtractor,
        customerExtractor,
        customerResearcher,
        summarizer,
        effectiveConfig
      );

      results.push(result);
      
      // Collect customers for unified signal analysis
      const validCustomers = (result as any)._researchedCustomers || [];
      allPositiveCustomers.push(...validCustomers);
      totalCompetitors += result.competitors.length;
    }

    // Generate non-ICP companies for all targets combined
    if (allPositiveCustomers.length > 0) {
      const combinedICP = results[0]?.icp_definition; // Use first target's ICP
      
      if (combinedICP) {
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('🚫 GENERATING CONTROL GROUPS');
        console.log('════════════════════════════════════════════════════════════');

        const differentVertical = await nonIcpGenerator.generateDifferentVertical(
          combinedICP,
          effectiveConfig.maxDifferentVerticalNonICP || this.config.maxDifferentVerticalNonICP
        );

        const sameVertical = await nonIcpGenerator.generateSameVertical(
          combinedICP,
          effectiveConfig.maxSameVerticalNonICP || this.config.maxSameVerticalNonICP
        );

        allNegativeCompanies.push(...differentVertical, ...sameVertical);
      }
    }

    // Run unified signal discovery
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🔬 UNIFIED SIGNAL DISCOVERY');
    console.log('════════════════════════════════════════════════════════════');

    const signalAnalysis = this.runSignalDiscovery(
      allPositiveCustomers,
      allNegativeCompanies,
      tfidfService
    );

    // Generate enrichment recommendations
    const enrichmentRecommendations = this.generateEnrichmentRecommendations(
      signalAnalysis.positive_signals,
      signalAnalysis.concept_clusters
    );

    // Build response
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    const costBreakdown = costTracker.getBreakdown();

    // Print cost summary
    costTracker.printSummary();

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅ DISCOVERY COMPLETE');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`   Processing time: ${processingTime}s`);
    console.log(`   Total customers analyzed: ${allPositiveCustomers.length}`);
    console.log(`   Total negative samples: ${allNegativeCompanies.length}`);
    console.log(`   Positive signals: ${signalAnalysis.positive_signals.length}`);
    console.log(`   Concept clusters: ${signalAnalysis.concept_clusters.length}`);
    console.log(`   Total cost: $${costBreakdown.total_cost.toFixed(4)}`);

    return {
      metadata: {
        request_id: requestId,
        targets_analyzed: request.targets.length,
        generated_at: new Date().toISOString(),
        processing_time_seconds: processingTime,
        total_customers_analyzed: allPositiveCustomers.length,
        competitors_found: totalCompetitors,
        same_vertical_non_icp_count: allNegativeCompanies.filter((c: any) => c.same_vertical_anti_icp_reason).length,
        different_vertical_non_icp_count: allNegativeCompanies.filter((c: any) => c.anti_icp_reason).length,
        cost_breakdown: costBreakdown,
        costs_by_phase: costTracker.getCostsByPhase(),
      },
      results: results.map(r => {
        // Remove internal fields
        const { _researchedCustomers, ...cleanResult } = r as any;
        return cleanResult;
      }),
      signal_analysis: signalAnalysis,
      enrichment_recommendations: enrichmentRecommendations,
    };
  }

  /**
   * Process a single target account
   */
  private async processTarget(
    target: TargetAccount,
    icpExtractor: ICPExtractor,
    customerExtractor: CustomerExtractor,
    customerResearcher: CustomerResearcher,
    summarizer: ICPSummarizer,
    config: any
  ): Promise<TargetResult & { _researchedCustomers?: ResearchedCustomer[] }> {
    const domain = target.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const name = target.name || domain.split('.')[0];

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 PROCESSING TARGET: ${name} (${domain})`);
    console.log('═'.repeat(60));

    // Phase 0: Extract ICP from website
    const extractedICP = config.skip_icp_extraction
      ? { target_customer: { industries: [], company_size: '', business_model: '' }, buyer_personas: [], primary_use_cases: [], differentiator: { status_quo: '', solution: '' }, key_capabilities: [] }
      : await icpExtractor.extractICP(domain, name);

    // Phase 1: Extract customers
    const customers = await customerExtractor.extractCustomers(
      domain,
      config.maxCustomersPerTarget || config.customer_limit || 30
    );

    if (customers.length === 0) {
      console.log('  ⚠️ No customers found');
      return {
        target: { name, domain },
        extracted_icp: extractedICP,
        icp_definition: this.emptyICPDefinition(),
        good_fit_examples: [],
        competitors: [],
      };
    }

    // Phase 2: Research customers
    const researched = await customerResearcher.researchCustomers(customers, 3);
    const validCustomers = researched.filter(c => c.research_status === 'success');

    // Phase 3: Summarize ICP
    const icpDefinition = await summarizer.summarize(validCustomers);

    // Build good fit examples
    const goodFitExamples: GoodFitExample[] = validCustomers.slice(0, 10).map(c => ({
      name: c.company_name,
      domain: c.domain,
      industry: c.llm_extraction.business_model || 'Unknown',
      signals_matched: this.extractSignalsMatched(c),
      fit_score: 0.9, // Placeholder
    }));

    return {
      target: { name, domain },
      extracted_icp: extractedICP,
      icp_definition: icpDefinition,
      good_fit_examples: goodFitExamples,
      competitors: [], // Would be populated by competitor discovery
      _researchedCustomers: validCustomers,
    };
  }

  /**
   * Run TF-IDF signal discovery on all collected companies
   */
  private runSignalDiscovery(
    positiveCompanies: ResearchedCustomer[],
    negativeCompanies: ResearchedCustomer[],
    tfidfService: TfidfService
  ): { positive_signals: DifferentialSignal[]; negative_signals: DifferentialSignal[]; concept_clusters: ConceptCluster[] } {
    const positiveDocs = positiveCompanies
      .map(c => c.combined_content)
      .filter(d => d.length > 100);

    const negativeDocs = negativeCompanies
      .map(c => c.combined_content)
      .filter(d => d.length > 100);

    if (positiveDocs.length === 0 || negativeDocs.length === 0) {
      console.log('  ⚠️ Insufficient documents for signal discovery');
      return { positive_signals: [], negative_signals: [], concept_clusters: [] };
    }

    console.log(`\n  Fitting TF-IDF on ${positiveDocs.length + negativeDocs.length} documents...`);
    console.log(`    (${positiveDocs.length} positive, ${negativeDocs.length} negative)`);

    // Fit TF-IDF
    const allDocs = [...positiveDocs, ...negativeDocs];
    tfidfService.fit(allDocs);

    // Transform
    const positiveVectors = positiveDocs.map(d => tfidfService.transform(d));
    const negativeVectors = negativeDocs.map(d => tfidfService.transform(d));

    // Compute differential
    const allDifferential = tfidfService.computeDifferential(positiveVectors, negativeVectors);

    // Extract signals
    const positiveSignals = allDifferential
      .filter(s => s.lift > 1.2 && s.positive_pct > 10)
      .slice(0, this.config.topSignalsToReport);

    const negativeSignals = allDifferential
      .filter(s => s.lift < 0.8 && s.negative_pct > 10)
      .sort((a, b) => a.lift - b.lift)
      .slice(0, 10);

    // Cluster phrases
    const conceptClusters = tfidfService.clusterPhrases(allDifferential.slice(0, 50));

    console.log(`  ✅ Found ${positiveSignals.length} positive signals, ${conceptClusters.length} concept clusters`);

    return { positive_signals: positiveSignals, negative_signals: negativeSignals, concept_clusters: conceptClusters };
  }

  /**
   * Generate enrichment recommendations from signals
   */
  private generateEnrichmentRecommendations(
    signals: DifferentialSignal[],
    clusters: ConceptCluster[]
  ): EnrichmentRecommendation[] {
    const recommendations: EnrichmentRecommendation[] = [];

    // Top signals become enrichment queries
    for (const signal of signals.slice(0, 5)) {
      recommendations.push({
        query: `Does the company mention "${signal.term}" on their website?`,
        purpose: 'Identify ICP fit signal',
        expected_signal: `${signal.positive_pct.toFixed(0)}% of ICP companies have this signal`,
      });
    }

    // Top clusters become concept queries
    for (const cluster of clusters.slice(0, 3)) {
      recommendations.push({
        query: `Does the company have ${cluster.concept}-related content?`,
        purpose: `Detect ${cluster.concept} pattern`,
        expected_signal: `Related phrases: ${cluster.phrases.slice(0, 3).join(', ')}`,
      });
    }

    return recommendations;
  }

  /**
   * Extract matched signals from a customer
   */
  private extractSignalsMatched(customer: ResearchedCustomer): string[] {
    const signals: string[] = [];
    const e = customer.llm_extraction;

    if (e.business_model) signals.push(`Business: ${e.business_model}`);
    if (e.b2b_or_b2c) signals.push(e.b2b_or_b2c);
    if (e.pricing_model) signals.push(`Pricing: ${e.pricing_model}`);
    if (e.funding_stage) signals.push(`Funding: ${e.funding_stage}`);
    if (e.security_certifications.length > 0) signals.push(`Security: ${e.security_certifications[0]}`);

    return signals.slice(0, 5);
  }

  private emptyICPDefinition() {
    return {
      target_industries: [],
      company_size: '',
      business_model: '',
      common_technologies: [],
      common_departments: [],
      common_pain_points: [],
      typical_funding_stage: '',
      typical_employee_range: '',
      unique_characteristics: [],
      anti_icp_criteria: [],
      anti_icp_search_queries: [],
      same_vertical_anti_icp_criteria: [],
      same_vertical_search_queries: [],
    };
  }
}
