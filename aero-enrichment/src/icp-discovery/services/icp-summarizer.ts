/**
 * ICP Summarizer Service
 * 
 * Analyzes patterns across researched customers to generate
 * a structured ICP definition and anti-ICP criteria.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { CostTracker } from '../utils/cost-tracker';
import type { ResearchedCustomer, ICPDefinition } from '../types';

const ICPDefinitionSchema = z.object({
  target_industries: z.array(z.string()),
  company_size: z.string(),
  business_model: z.string(),
  common_technologies: z.array(z.string()),
  common_departments: z.array(z.string()),
  common_pain_points: z.array(z.string()),
  typical_funding_stage: z.string(),
  typical_employee_range: z.string(),
  unique_characteristics: z.array(z.string()),
  anti_icp_criteria: z.array(z.string()),
  anti_icp_search_queries: z.array(z.string()),
  same_vertical_anti_icp_criteria: z.array(z.string()),
  same_vertical_search_queries: z.array(z.string()),
});

export class ICPSummarizer {
  private openai: OpenAI;
  private costTracker?: CostTracker;

  constructor(openaiApiKey: string, costTracker?: CostTracker) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.costTracker = costTracker;
  }

  async summarize(customers: ResearchedCustomer[]): Promise<ICPDefinition> {
    const validCustomers = customers.filter(c => c.research_status === 'success');
    
    if (validCustomers.length === 0) {
      console.log('  ⚠️ No valid customers to analyze');
      return this.emptyICP();
    }

    console.log(`\n🧠 Analyzing ICP patterns from ${validCustomers.length} customers...`);

    const customerSummaries = validCustomers.map(c => ({
      name: c.company_name,
      domain: c.domain,
      business_model: c.llm_extraction.business_model,
      b2b_or_b2c: c.llm_extraction.b2b_or_b2c,
      target_buyer: c.llm_extraction.target_buyer,
      pricing_model: c.llm_extraction.pricing_model,
      integrations: [
        ...c.llm_extraction.crm_integrations,
        ...c.llm_extraction.productivity_integrations,
      ].slice(0, 5),
      security_certs: c.llm_extraction.security_certifications,
      funding_stage: c.llm_extraction.funding_stage,
      employee_count: c.llm_extraction.employee_count_signal,
      hiring_departments: c.llm_extraction.hiring_departments,
    }));

    const systemPrompt = `Analyze customer data and identify ICP patterns. Generate TWO types of anti-ICP:
1. Different-Vertical: Companies in completely different industries
2. Same-Vertical: Companies in SAME industry but different characteristics

For search queries, generate ones that find ACTUAL COMPANY WEBSITES (not blog posts).
Use phrases like "company homepage", "about us", "official website".`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze these ${validCustomers.length} customers:\n${JSON.stringify(customerSummaries, null, 2)}` },
        ],
        response_format: zodResponseFormat(ICPDefinitionSchema, 'icp'),
        max_tokens: 2000,
        temperature: 0.3,
      });

      // Track costs
      if (this.costTracker && response.usage) {
        this.costTracker.trackOpenAI(
          'Phase 3: ICP Summarization',
          'summarize',
          'gpt-4o-mini',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
      }

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}') as ICPDefinition;
      
      console.log(`  ✅ ICP Summary:`);
      console.log(`     Industries: ${parsed.target_industries.join(', ')}`);
      console.log(`     Business Model: ${parsed.business_model}`);

      return parsed;
    } catch (error) {
      console.error(`  ⚠️ ICP summarization error: ${(error as Error).message}`);
      return this.emptyICP();
    }
  }

  formatSummary(icp: ICPDefinition): string {
    return `
═══════════════════════════════════════════════════════════════
📊 ICP DEFINITION
═══════════════════════════════════════════════════════════════

🎯 TARGET PROFILE
   Industries: ${icp.target_industries.join(', ') || 'N/A'}
   Business Model: ${icp.business_model || 'N/A'}
   Company Size: ${icp.company_size || 'N/A'}
   Employee Range: ${icp.typical_employee_range || 'N/A'}
   Funding Stage: ${icp.typical_funding_stage || 'N/A'}

🔧 TECHNOLOGY PATTERNS
   ${icp.common_technologies.join(', ') || 'N/A'}

👥 BUYER DEPARTMENTS
   ${icp.common_departments.join(', ') || 'N/A'}

💡 PAIN POINTS
   ${icp.common_pain_points.map(p => `• ${p}`).join('\n   ') || 'N/A'}
`.trim();
  }

  private emptyICP(): ICPDefinition {
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
      anti_icp_criteria: ['B2C companies', 'Educational institutions'],
      anti_icp_search_queries: ['B2C ecommerce company homepage', 'university official website'],
      same_vertical_anti_icp_criteria: [],
      same_vertical_search_queries: [],
    };
  }
}
