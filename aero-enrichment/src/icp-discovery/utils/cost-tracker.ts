/**
 * Cost Tracker for ICP Discovery
 * 
 * Tracks API costs for Exa and OpenAI across all phases of the pipeline.
 */

// Pricing (as of 2024-12, update as needed)
const PRICING = {
  // Exa API pricing (approximate, check current pricing)
  exa: {
    websetCreate: 0.01,        // Per webset creation
    websetItem: 0.001,         // Per item retrieved
    search: 0.002,             // Per search query
    getContents: 0.003,        // Per URL content fetch
  },
  
  // OpenAI API pricing (per 1M tokens)
  openai: {
    'gpt-4o-mini': {
      input: 0.15,             // $0.15 per 1M input tokens
      output: 0.60,            // $0.60 per 1M output tokens
    },
    'gpt-4o': {
      input: 2.50,
      output: 10.00,
    },
    'text-embedding-3-small': {
      input: 0.02,             // $0.02 per 1M tokens
    },
  },
};

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

export interface OperationCost {
  phase: string;
  operation: string;
  service: 'exa' | 'openai';
  cost: number;
  details?: Record<string, any>;
}

export class CostTracker {
  private costs: OperationCost[] = [];
  private exaOperations = {
    websetsCreated: 0,
    websetItemsRetrieved: 0,
    searches: 0,
    contentFetches: 0,
  };
  private openaiOperations: Map<string, { inputTokens: number; outputTokens: number }> = new Map();

  /**
   * Track Exa Webset creation
   */
  trackExaWebsetCreate(phase: string, operation: string, itemCount: number = 0): void {
    const cost = PRICING.exa.websetCreate + (itemCount * PRICING.exa.websetItem);
    this.exaOperations.websetsCreated++;
    this.exaOperations.websetItemsRetrieved += itemCount;
    this.costs.push({
      phase,
      operation,
      service: 'exa',
      cost,
      details: { type: 'webset_create', itemCount },
    });
  }

  /**
   * Track Exa Webset items retrieval
   */
  trackExaWebsetItems(phase: string, operation: string, itemCount: number): void {
    const cost = itemCount * PRICING.exa.websetItem;
    this.exaOperations.websetItemsRetrieved += itemCount;
    this.costs.push({
      phase,
      operation,
      service: 'exa',
      cost,
      details: { type: 'webset_items', itemCount },
    });
  }

  /**
   * Track Exa search
   */
  trackExaSearch(phase: string, operation: string, resultCount: number = 0): void {
    const cost = PRICING.exa.search;
    this.exaOperations.searches++;
    this.costs.push({
      phase,
      operation,
      service: 'exa',
      cost,
      details: { type: 'search', resultCount },
    });
  }

  /**
   * Track Exa getContents
   */
  trackExaGetContents(phase: string, operation: string, urlCount: number): void {
    const cost = urlCount * PRICING.exa.getContents;
    this.exaOperations.contentFetches += urlCount;
    this.costs.push({
      phase,
      operation,
      service: 'exa',
      cost,
      details: { type: 'get_contents', urlCount },
    });
  }

  /**
   * Track OpenAI API call
   */
  trackOpenAI(
    phase: string,
    operation: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const modelPricing = PRICING.openai[model as keyof typeof PRICING.openai];
    if (!modelPricing) {
      console.warn(`Unknown OpenAI model pricing: ${model}, using gpt-4o-mini pricing`);
      const fallback = PRICING.openai['gpt-4o-mini'];
      const cost = (inputTokens / 1_000_000) * fallback.input + (outputTokens / 1_000_000) * fallback.output;
      this.costs.push({
        phase,
        operation,
        service: 'openai',
        cost,
        details: { model, inputTokens, outputTokens },
      });
      return;
    }

    const cost = (inputTokens / 1_000_000) * modelPricing.input + (outputTokens / 1_000_000) * modelPricing.output;
    
    // Track cumulative tokens per model
    const existing = this.openaiOperations.get(model) || { inputTokens: 0, outputTokens: 0 };
    this.openaiOperations.set(model, {
      inputTokens: existing.inputTokens + inputTokens,
      outputTokens: existing.outputTokens + outputTokens,
    });

    this.costs.push({
      phase,
      operation,
      service: 'openai',
      cost,
      details: { model, inputTokens, outputTokens },
    });
  }

  /**
   * Estimate tokens from text (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Track OpenAI call with text estimation
   */
  trackOpenAIText(
    phase: string,
    operation: string,
    model: string,
    inputText: string,
    outputText: string
  ): void {
    const inputTokens = this.estimateTokens(inputText);
    const outputTokens = this.estimateTokens(outputText);
    this.trackOpenAI(phase, operation, model, inputTokens, outputTokens);
  }

  /**
   * Get cost breakdown by service
   */
  getBreakdown(): CostBreakdown {
    const exaCost = this.costs
      .filter(c => c.service === 'exa')
      .reduce((sum, c) => sum + c.cost, 0);

    // Calculate OpenAI costs per model
    let totalOpenAICost = 0;
    let primaryModel = 'gpt-4o-mini';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const [model, tokens] of this.openaiOperations.entries()) {
      const modelPricing = PRICING.openai[model as keyof typeof PRICING.openai] || PRICING.openai['gpt-4o-mini'];
      const modelCost = (tokens.inputTokens / 1_000_000) * modelPricing.input + 
                       (tokens.outputTokens / 1_000_000) * modelPricing.output;
      totalOpenAICost += modelCost;
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;
      
      // Use the model with most tokens as primary
      if (tokens.inputTokens + tokens.outputTokens > totalInputTokens + totalOutputTokens) {
        primaryModel = model;
      }
    }

    return {
      exa: {
        websets_created: this.exaOperations.websetsCreated,
        webset_items_retrieved: this.exaOperations.websetItemsRetrieved,
        searches: this.exaOperations.searches,
        content_fetches: this.exaOperations.contentFetches,
        total_cost: exaCost,
      },
      openai: {
        model: primaryModel,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_cost: totalOpenAICost,
      },
      total_cost: exaCost + totalOpenAICost,
    };
  }

  /**
   * Get costs by phase
   */
  getCostsByPhase(): Record<string, { exa: number; openai: number; total: number }> {
    const byPhase: Record<string, { exa: number; openai: number; total: number }> = {};

    for (const cost of this.costs) {
      if (!byPhase[cost.phase]) {
        byPhase[cost.phase] = { exa: 0, openai: 0, total: 0 };
      }
      byPhase[cost.phase][cost.service] += cost.cost;
      byPhase[cost.phase].total += cost.cost;
    }

    return byPhase;
  }

  /**
   * Get all operation costs
   */
  getAllCosts(): OperationCost[] {
    return [...this.costs];
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.costs = [];
    this.exaOperations = {
      websetsCreated: 0,
      websetItemsRetrieved: 0,
      searches: 0,
      contentFetches: 0,
    };
    this.openaiOperations.clear();
  }

  /**
   * Print cost summary
   */
  printSummary(): void {
    const breakdown = this.getBreakdown();
    const byPhase = this.getCostsByPhase();

    console.log('\n' + '═'.repeat(60));
    console.log('💰 COST SUMMARY');
    console.log('═'.repeat(60));
    
    console.log('\n📊 By Service:');
    console.log(`   Exa API:`);
    console.log(`     Websets created: ${breakdown.exa.websets_created}`);
    console.log(`     Items retrieved: ${breakdown.exa.webset_items_retrieved}`);
    console.log(`     Searches: ${breakdown.exa.searches}`);
    console.log(`     Content fetches: ${breakdown.exa.content_fetches}`);
    console.log(`     Total: $${breakdown.exa.total_cost.toFixed(4)}`);
    
    console.log(`\n   OpenAI API (${breakdown.openai.model}):`);
    console.log(`     Input tokens: ${breakdown.openai.input_tokens.toLocaleString()}`);
    console.log(`     Output tokens: ${breakdown.openai.output_tokens.toLocaleString()}`);
    console.log(`     Total: $${breakdown.openai.total_cost.toFixed(4)}`);
    
    console.log(`\n   💵 TOTAL COST: $${breakdown.total_cost.toFixed(4)}`);
    
    if (Object.keys(byPhase).length > 0) {
      console.log('\n📈 By Phase:');
      for (const [phase, costs] of Object.entries(byPhase)) {
        console.log(`   ${phase}:`);
        console.log(`     Exa: $${costs.exa.toFixed(4)}`);
        console.log(`     OpenAI: $${costs.openai.toFixed(4)}`);
        console.log(`     Total: $${costs.total.toFixed(4)}`);
      }
    }
    
    console.log('═'.repeat(60) + '\n');
  }
}
