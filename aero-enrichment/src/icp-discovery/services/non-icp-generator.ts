/**
 * Non-ICP Generator Service
 * 
 * Generates control groups of companies that do NOT fit the ICP.
 * Two types: Same-Vertical and Different-Vertical.
 */

import { ExaClient } from '../../exa-client';
import { CostTracker } from '../utils/cost-tracker';
import { CustomerResearcher } from './customer-researcher';
import type { ICPDefinition, ResearchedCustomer, NonICPCompany, SameVerticalNonICPCompany } from '../types';

export class NonICPGenerator {
  private exa: ExaClient;
  private researcher: CustomerResearcher;
  private costTracker?: CostTracker;

  constructor(exaApiKey: string, openaiApiKey: string, costTracker?: CostTracker) {
    this.exa = new ExaClient({ apiKey: exaApiKey });
    this.costTracker = costTracker;
    this.researcher = new CustomerResearcher(exaApiKey, openaiApiKey, costTracker);
  }

  /**
   * Generate different-vertical non-ICP companies
   */
  async generateDifferentVertical(icp: ICPDefinition, limit: number = 20): Promise<NonICPCompany[]> {
    console.log('\n🚫 Generating different-vertical non-ICP companies...');
    
    const queries = icp.anti_icp_search_queries.length > 0
      ? icp.anti_icp_search_queries
      : this.generateDefaultQueries(icp, 'different');

    const companies: NonICPCompany[] = [];
    const seenDomains = new Set<string>();

    for (const query of queries) {
      if (companies.length >= limit) break;

      try {
        const results = await this.exa.searchAndContents(query, {
          numResults: 5,
          text: false,
        });

        // Track costs
        if (this.costTracker) {
          this.costTracker.trackExaSearch('Phase 4: Non-ICP Generation', 'generateDifferentVertical', results.results.length);
        }

        for (const result of results.results) {
          if (companies.length >= limit) break;

          const domain = this.extractDomain(result.url);
          if (seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          // Research the company
          const researched = await this.researcher.researchCustomers(
            [{ name: result.title || domain, source_url: result.url }],
            1
          );

          if (researched.length > 0 && researched[0].research_status === 'success') {
            companies.push({
              ...researched[0],
              is_customer: false,
              anti_icp_reason: `Matched different-vertical query: ${query}`,
            });
          }
        }

        await this.sleep(300);
      } catch (error) {
        console.error(`  ⚠️ Error with query: ${(error as Error).message.slice(0, 50)}`);
      }
    }

    console.log(`  ✅ Generated ${companies.length} different-vertical non-ICP companies`);
    return companies;
  }

  /**
   * Generate same-vertical non-ICP companies
   */
  async generateSameVertical(icp: ICPDefinition, limit: number = 15): Promise<SameVerticalNonICPCompany[]> {
    console.log('\n🚫 Generating same-vertical non-ICP companies...');
    
    const queries = icp.same_vertical_search_queries.length > 0
      ? icp.same_vertical_search_queries
      : this.generateDefaultQueries(icp, 'same');

    const companies: SameVerticalNonICPCompany[] = [];
    const seenDomains = new Set<string>();

    for (const query of queries) {
      if (companies.length >= limit) break;

      try {
        const results = await this.exa.searchAndContents(query, {
          numResults: 5,
          text: false,
        });

        // Track costs
        if (this.costTracker) {
          this.costTracker.trackExaSearch('Phase 4: Non-ICP Generation', 'generateSameVertical', results.results.length);
        }

        for (const result of results.results) {
          if (companies.length >= limit) break;

          const domain = this.extractDomain(result.url);
          if (seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          const researched = await this.researcher.researchCustomers(
            [{ name: result.title || domain, source_url: result.url }],
            1
          );

          if (researched.length > 0 && researched[0].research_status === 'success') {
            companies.push({
              ...researched[0],
              is_customer: false,
              same_vertical_anti_icp_reason: `Matched same-vertical query: ${query}`,
            });
          }
        }

        await this.sleep(300);
      } catch (error) {
        console.error(`  ⚠️ Error with query: ${(error as Error).message.slice(0, 50)}`);
      }
    }

    console.log(`  ✅ Generated ${companies.length} same-vertical non-ICP companies`);
    return companies;
  }

  private generateDefaultQueries(icp: ICPDefinition, type: 'same' | 'different'): string[] {
    if (type === 'different') {
      return [
        'B2C ecommerce company about us homepage',
        'consumer retail brand official website',
        'restaurant chain company homepage',
        'real estate agency about us',
        'local services business homepage',
      ];
    } else {
      // Same vertical but different characteristics
      const industries = icp.target_industries.join(' ');
      return [
        `small ${industries} consultancy about us`,
        `${industries} freelancer portfolio`,
        `boutique ${industries} firm homepage`,
        `solo practitioner ${industries}`,
      ];
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
