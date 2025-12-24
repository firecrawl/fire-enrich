/**
 * Customer Researcher Service
 * 
 * Takes extracted customer names and researches each one:
 * 1. Finds their website via Exa
 * 2. Scrapes their pages
 * 3. Extracts features using LLM
 */

import OpenAI from 'openai';
import { ExaClient } from '../../exa-client';
import { CostTracker } from '../utils/cost-tracker';
import type { ExtractedCustomer, ResearchedCustomer, PagePresence, OpenEndedExtraction } from '../types';

export class CustomerResearcher {
  private exa: ExaClient;
  private openai: OpenAI;
  private costTracker?: CostTracker;

  constructor(exaApiKey: string, openaiApiKey: string, costTracker?: CostTracker) {
    this.exa = new ExaClient({ apiKey: exaApiKey });
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.costTracker = costTracker;
  }

  async researchCustomers(customers: ExtractedCustomer[], batchSize: number = 3): Promise<ResearchedCustomer[]> {
    const results: ResearchedCustomer[] = [];
    const total = customers.length;

    console.log(`\n📚 Researching ${total} customers...`);

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map((customer, j) => this.researchOne(customer, i + j + 1, total))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }

      if (i + batchSize < customers.length) {
        await this.sleep(500);
      }
    }

    const successful = results.filter(r => r.research_status === 'success').length;
    console.log(`  ✅ Successfully researched ${successful}/${total} customers`);

    return results;
  }

  private async researchOne(customer: ExtractedCustomer, index: number, total: number): Promise<ResearchedCustomer | null> {
    const label = `[${index}/${total}]`;
    
    try {
      const website = await this.findWebsite(customer.name);
      
      if (!website) {
        console.log(`  ${label} ${customer.name} - no website found`);
        return this.createEmptyResult(customer, 'partial');
      }

      console.log(`  ${label} ${customer.name} - found ${website}`);

      // Fetch pages using Exa
      const result = await this.exa.getContents([`https://${website}`], {
        text: true,
        subpages: 6,
        subpageTarget: ['about', 'pricing', 'careers', 'product', 'integrations'],
      });

      // Track costs
      if (this.costTracker) {
        this.costTracker.trackExaGetContents('Phase 2: Customer Research', 'getContents', result.results.length);
      }

      if (result.results.length === 0) {
        return this.createEmptyResult(customer, 'partial', website);
      }

      const combinedContent = result.results.map(r => r.text || '').join('\n\n');
      
      // Extract features via LLM
      const llmExtraction = await this.extractFeatures(combinedContent, customer.name);

      return {
        company_id: customer.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        company_name: customer.name,
        website,
        domain: website,
        is_customer: true,
        research_status: 'success',
        page_presence: this.detectPagePresence(result.results.map(r => r.url)),
        combined_content: combinedContent.slice(0, 50000),
        embedding: [],
        llm_extraction: llmExtraction,
      };
    } catch (error) {
      console.error(`  ${label} ${customer.name} - error: ${(error as Error).message.slice(0, 50)}`);
      return this.createEmptyResult(customer, 'failed');
    }
  }

  private async findWebsite(companyName: string): Promise<string | null> {
    try {
      const results = await this.exa.searchAndContents(`${companyName} company official website`, {
        numResults: 3,
        text: false,
      });

      // Track costs
      if (this.costTracker) {
        this.costTracker.trackExaSearch('Phase 2: Customer Research', 'findWebsite', results.results.length);
      }

      const skipDomains = ['linkedin.com', 'twitter.com', 'facebook.com', 'wikipedia.org', 'crunchbase.com'];

      for (const result of results.results) {
        const domain = this.extractDomain(result.url);
        if (!skipDomains.some(s => domain.includes(s))) {
          return domain;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
  }

  private detectPagePresence(urls: string[]): PagePresence {
    const urlsLower = urls.map(u => u.toLowerCase());
    return {
      homepage: true,
      about: urlsLower.some(u => u.includes('about')),
      pricing: urlsLower.some(u => u.includes('pricing')),
      trust: urlsLower.some(u => u.includes('security') || u.includes('trust')),
      support: urlsLower.some(u => u.includes('support') || u.includes('help')),
      careers: urlsLower.some(u => u.includes('career') || u.includes('jobs')),
      customers: urlsLower.some(u => u.includes('customer') || u.includes('case')),
      product: urlsLower.some(u => u.includes('product') || u.includes('features')),
      integrations: urlsLower.some(u => u.includes('integration')),
    };
  }

  private async extractFeatures(content: string, companyName: string): Promise<OpenEndedExtraction> {
    try {
      const systemPrompt = `Analyze this ${companyName} website content and extract business signals: pricing model, business model (B2B/B2C), integrations, hiring signals, security certifications, funding stage, employee count signals, and unique value proposition. Return JSON.`;
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content.slice(0, 15000) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2,
      });

      // Track costs
      if (this.costTracker && response.usage) {
        this.costTracker.trackOpenAI(
          'Phase 2: Customer Research',
          'extractFeatures',
          'gpt-4o-mini',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
      }

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      return this.normalizeExtraction(parsed);
    } catch {
      return this.emptyExtraction();
    }
  }

  private normalizeExtraction(parsed: any): OpenEndedExtraction {
    return {
      pricing_model: parsed.pricing_model || '',
      pricing_tiers: parsed.pricing_tiers || [],
      pricing_transparency: parsed.pricing_transparency || '',
      free_tier: parsed.free_tier || '',
      trial_details: parsed.trial_details || '',
      primary_cta: parsed.primary_cta || '',
      signup_friction: parsed.signup_friction || '',
      form_fields_observed: parsed.form_fields_observed || [],
      business_model: parsed.business_model || '',
      target_buyer: parsed.target_buyer || '',
      target_company_size: parsed.target_company_size || '',
      b2b_or_b2c: parsed.b2b_or_b2c || '',
      crm_integrations: parsed.crm_integrations || [],
      productivity_integrations: parsed.productivity_integrations || [],
      developer_integrations: parsed.developer_integrations || [],
      data_integrations: parsed.data_integrations || [],
      other_integrations: parsed.other_integrations || [],
      hiring_departments: parsed.hiring_departments || [],
      job_titles_observed: parsed.job_titles_observed || [],
      hiring_signals: parsed.hiring_signals || [],
      engineering_team_size_signals: parsed.engineering_team_size_signals || [],
      security_certifications: parsed.security_certifications || [],
      customer_logos: parsed.customer_logos || [],
      customer_count_signal: parsed.customer_count_signal || '',
      funding_stage: parsed.funding_stage || '',
      employee_count_signal: parsed.employee_count_signal || '',
      founded_year: parsed.founded_year || '',
      unique_value_prop: parsed.unique_value_prop || '',
      competitive_positioning: parsed.competitive_positioning || [],
    };
  }

  private emptyExtraction(): OpenEndedExtraction {
    return {
      pricing_model: '', pricing_tiers: [], pricing_transparency: '', free_tier: '', trial_details: '',
      primary_cta: '', signup_friction: '', form_fields_observed: [],
      business_model: '', target_buyer: '', target_company_size: '', b2b_or_b2c: '',
      crm_integrations: [], productivity_integrations: [], developer_integrations: [],
      data_integrations: [], other_integrations: [],
      hiring_departments: [], job_titles_observed: [], hiring_signals: [], engineering_team_size_signals: [],
      security_certifications: [], customer_logos: [], customer_count_signal: '',
      funding_stage: '', employee_count_signal: '', founded_year: '',
      unique_value_prop: '', competitive_positioning: [],
    };
  }

  private createEmptyResult(customer: ExtractedCustomer, status: 'partial' | 'failed', website?: string): ResearchedCustomer {
    return {
      company_id: customer.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      company_name: customer.name,
      website: website || '',
      domain: website || '',
      is_customer: true,
      embedding: [],
      page_presence: {
        homepage: false, about: false, pricing: false, trust: false,
        support: false, careers: false, customers: false, product: false, integrations: false,
      },
      combined_content: '',
      llm_extraction: this.emptyExtraction(),
      research_status: status,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
