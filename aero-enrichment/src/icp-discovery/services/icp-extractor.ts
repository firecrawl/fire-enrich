/**
 * ICP Extractor Service
 * 
 * Extracts the target company's self-defined ICP from their website
 * using Exa Websets API and LLM analysis.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ExaClient } from '../../exa-client';
import { CostTracker } from '../utils/cost-tracker';
import type { ExtractedICP, DiscoveredPage } from '../types';

const ExtractedICPSchema = z.object({
  target_customer: z.object({
    industries: z.array(z.string()),
    company_size: z.string(),
    business_model: z.string(),
    geographic_focus: z.string().nullable(),
  }),
  buyer_personas: z.array(z.object({
    seniority: z.string(),
    function: z.string(),
    title: z.string(),
  })).max(4),
  primary_use_cases: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).max(4),
  differentiator: z.object({
    status_quo: z.string(),
    solution: z.string(),
  }),
  key_capabilities: z.array(z.string()),
});

export class ICPExtractor {
  private exa: ExaClient;
  private openai: OpenAI;
  private costTracker?: CostTracker;

  constructor(exaApiKey: string, openaiApiKey: string, costTracker?: CostTracker) {
    this.exa = new ExaClient({ apiKey: exaApiKey });
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.costTracker = costTracker;
  }

  async extractICP(targetDomain: string, targetName: string): Promise<ExtractedICP> {
    console.log(`\n🔍 Extracting ICP from ${targetName} (${targetDomain})...`);

    try {
      // Use Websets API for structured extraction
      const websetQuery = `site:${targetDomain} (homepage OR about OR product OR pricing OR customers OR features)`;
      
      console.log('  Creating Webset for structured ICP extraction...');
      const webset = await this.exa.createWebset({
        query: websetQuery,
        count: 8,
        entityType: 'company',
        criteria: [
          { description: `Extract ICP information from ${targetName} website` },
          { description: 'Include target customer industries, company size, business model' },
          { description: 'Extract buyer personas with job titles' },
          { description: 'Extract primary use cases with descriptions' },
          { description: 'Extract differentiator: status quo vs solution' },
          { description: 'Extract key capabilities and features' },
        ],
      });

      console.log(`  Webset created: ${webset.websetId}, waiting for completion...`);
      const items = await this.exa.waitForWebset(webset.websetId, {
        maxWaitSeconds: 120,
        pollIntervalSeconds: 3,
      });

      // Track costs
      if (this.costTracker) {
        this.costTracker.trackExaWebsetCreate('Phase 0: ICP Extraction', 'createWebset', items.length);
      }

      if (items.length === 0) {
        console.log('  ⚠️ No items found, falling back to LLM extraction');
        return await this.fallbackLLMExtraction(targetDomain, targetName);
      }

      console.log(`  ✅ Found ${items.length} items via Websets API`);
      return this.extractFromWebsetItems(items);
    } catch (error) {
      console.error(`  ⚠️ Websets API error: ${(error as Error).message}`);
      console.log('  Falling back to LLM extraction...');
      return await this.fallbackLLMExtraction(targetDomain, targetName);
    }
  }

  private extractFromWebsetItems(items: Array<{ properties: Record<string, any> }>): ExtractedICP {
    const allProperties: Record<string, any> = {};
    for (const item of items) {
      if (item.properties) Object.assign(allProperties, item.properties);
    }

    return {
      target_customer: {
        industries: allProperties.industries || [],
        company_size: allProperties.company_size || '',
        business_model: allProperties.business_model || '',
        geographic_focus: allProperties.geographic_focus,
      },
      buyer_personas: allProperties.buyer_personas || [],
      primary_use_cases: allProperties.use_cases || [],
      differentiator: {
        status_quo: allProperties.status_quo || '',
        solution: allProperties.solution || '',
      },
      key_capabilities: allProperties.capabilities || [],
    };
  }

  private async fallbackLLMExtraction(targetDomain: string, targetName: string): Promise<ExtractedICP> {
    const homepageUrl = `https://${targetDomain}`;
    const result = await this.exa.getContents([homepageUrl], {
      text: true,
      subpages: 6,
      subpageTarget: ['about', 'product', 'pricing', 'customers', 'features', 'solutions'],
    });

    // Track costs
    if (this.costTracker) {
      this.costTracker.trackExaGetContents('Phase 0: ICP Extraction', 'fallback_getContents', result.results.length);
    }

    if (result.results.length === 0) return this.emptyICP();

    const pages: DiscoveredPage[] = result.results
      .filter(r => r.text && r.text.length >= 100)
      .map(r => ({
        url: r.url,
        title: r.title || `${targetName} Page`,
        content: r.text!,
        intent: this.determineIntent(r.url, targetDomain),
        domain: targetDomain,
        contentLength: r.text!.length,
      }));

    return await this.extractWithLLM(pages, targetName);
  }

  private determineIntent(url: string, domain: string): DiscoveredPage['intent'] {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('about')) return 'about';
    if (urlLower.includes('product') || urlLower.includes('features')) return 'product';
    if (urlLower.includes('pricing')) return 'pricing';
    if (urlLower.includes('customer') || urlLower.includes('case-study')) return 'customers';
    return 'homepage';
  }

  private async extractWithLLM(pages: DiscoveredPage[], companyName: string): Promise<ExtractedICP> {
    const combinedContent = pages
      .map(p => `[${p.intent.toUpperCase()}]\n${p.content}`)
      .join('\n\n---\n\n')
      .slice(0, 20000);

    try {
      const systemPrompt = `Extract ICP information from ${companyName} website. Include target industries, buyer personas, use cases, and differentiator.`;
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: combinedContent },
        ],
        response_format: zodResponseFormat(ExtractedICPSchema, 'icp'),
        max_tokens: 2000,
        temperature: 0.2,
      });

      // Track costs
      if (this.costTracker && response.usage) {
        this.costTracker.trackOpenAI(
          'Phase 0: ICP Extraction',
          'extractWithLLM',
          'gpt-4o-mini',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
      }

      return JSON.parse(response.choices[0]?.message?.content || '{}') as ExtractedICP;
    } catch {
      return this.emptyICP();
    }
  }

  private emptyICP(): ExtractedICP {
    return {
      target_customer: { industries: [], company_size: '', business_model: '' },
      buyer_personas: [],
      primary_use_cases: [],
      differentiator: { status_quo: '', solution: '' },
      key_capabilities: [],
    };
  }
}
