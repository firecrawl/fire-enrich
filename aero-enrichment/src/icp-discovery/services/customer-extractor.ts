/**
 * Customer Extractor Service
 * 
 * Discovers and extracts customer names from a target company's website
 * using Exa Websets API for structured extraction.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ExaClient } from '../../exa-client';
import { CostTracker } from '../utils/cost-tracker';
import type { ExtractedCustomer } from '../types';

const ExtractedCustomersSchema = z.object({
  customers: z.array(z.object({
    name: z.string(),
    industry: z.string().nullable(),
    context: z.string().nullable(),
  })),
});

const CUSTOMER_PAGE_QUERIES = [
  'site:{domain} customers',
  'site:{domain} case studies',
  'site:{domain} success stories',
  'site:{domain} testimonials',
];

export class CustomerExtractor {
  private exa: ExaClient;
  private openai: OpenAI;
  private costTracker?: CostTracker;

  constructor(exaApiKey: string, openaiApiKey: string, costTracker?: CostTracker) {
    this.exa = new ExaClient({ apiKey: exaApiKey });
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.costTracker = costTracker;
  }

  async extractCustomers(targetDomain: string, limit: number = 50): Promise<ExtractedCustomer[]> {
    const domain = this.cleanDomain(targetDomain);
    console.log(`\n🔍 Searching for customers on ${domain}...`);

    const allCustomers: ExtractedCustomer[] = [];
    const seenNames = new Set<string>();

    try {
      const customerQuery = `site:${domain} (customers OR "case studies" OR testimonials)`;
      
      console.log('  Creating Webset for customer extraction...');
      const webset = await this.exa.createWebset({
        query: customerQuery,
        count: Math.min(limit * 2, 20),
        entityType: 'company',
        criteria: [
          { description: `Extract all customer company names mentioned on ${domain}` },
          { description: 'Look for customer logos, case study titles, testimonials' },
          { description: 'Return company names only, not person names' },
        ],
      });

      const items = await this.exa.waitForWebset(webset.websetId, {
        maxWaitSeconds: 120,
        pollIntervalSeconds: 3,
      });

      // Track costs
      if (this.costTracker) {
        this.costTracker.trackExaWebsetCreate('Phase 1: Customer Extraction', 'createWebset', items.length);
      }

      for (const item of items) {
        if (allCustomers.length >= limit) break;

        const props = item.properties || {};
        const customers = props.customers || props.company_names || [];

        for (const customerName of (Array.isArray(customers) ? customers : [])) {
          const name = typeof customerName === 'string' ? customerName : customerName?.name;
          if (name && this.isValidCustomerName(name) && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            allCustomers.push({ name, source_url: item.url });
          }
        }

        if (item.text && allCustomers.length < limit) {
          const extracted = await this.extractFromPage(item.text, item.url);
          for (const c of extracted) {
            if (this.isValidCustomerName(c.name) && !seenNames.has(c.name.toLowerCase())) {
              seenNames.add(c.name.toLowerCase());
              allCustomers.push(c);
            }
          }
        }
      }

      console.log(`  ✅ Found ${allCustomers.length} customers via Websets API`);
    } catch (error) {
      console.error(`  ⚠️ Websets API error: ${(error as Error).message}`);
      console.log('  Falling back to search-based extraction...');
      
      for (const queryTemplate of CUSTOMER_PAGE_QUERIES) {
        if (allCustomers.length >= limit) break;
        const query = queryTemplate.replace('{domain}', domain);
        
        try {
          const results = await this.exa.searchAndContents(query, {
            numResults: 5,
            text: true,
            includeDomains: [domain],
          });

          // Track costs
          if (this.costTracker) {
            this.costTracker.trackExaSearch('Phase 1: Customer Extraction', 'fallback_search', results.results.length);
          }

          for (const result of results.results) {
            if (allCustomers.length >= limit) break;
            const customers = await this.extractFromPage(result.text || '', result.url);
            for (const c of customers) {
              if (this.isValidCustomerName(c.name) && !seenNames.has(c.name.toLowerCase())) {
                seenNames.add(c.name.toLowerCase());
                allCustomers.push(c);
              }
            }
          }
        } catch {}
      }
    }

    return allCustomers.slice(0, limit);
  }

  private async extractFromPage(content: string, sourceUrl: string): Promise<ExtractedCustomer[]> {
    if (!content || content.length < 100) return [];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Extract all customer COMPANY names from this content. Return only company names, not person names.' },
          { role: 'user', content: content.slice(0, 15000) },
        ],
        response_format: zodResponseFormat(ExtractedCustomersSchema, 'customers'),
        max_tokens: 2000,
        temperature: 0.2,
      });

      // Track costs
      if (this.costTracker && response.usage) {
        this.costTracker.trackOpenAI(
          'Phase 1: Customer Extraction',
          'extractFromPage',
          'gpt-4o-mini',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
      }

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{"customers": []}');
      return parsed.customers.map((c: any) => ({
        name: c.name,
        industry: c.industry,
        context: c.context,
        source_url: sourceUrl,
      }));
    } catch {
      return [];
    }
  }

  private isValidCustomerName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 100) return false;
    const skipTerms = ['enterprise', 'startup', 'company', 'business', 'client', 'customer'];
    if (skipTerms.includes(name.toLowerCase())) return false;
    return /[a-zA-Z]/.test(name);
  }

  private cleanDomain(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}
