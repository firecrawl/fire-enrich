import { CrustDataClient } from './crustdata-client';
import { CrustDataCompany, CrustDataEnrichmentResult } from './types';

export class CrustDataEnrichmentService {
  private client: CrustDataClient;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.CRUSTDATA_API_KEY;
    if (!key) {
      throw new Error('CrustData API key is required');
    }
    this.client = new CrustDataClient({ apiKey: key });
  }

  /**
   * Enrich company data using domain or name
   */
  async enrichCompany(
    identifier: string,
    isDomain: boolean = true
  ): Promise<CrustDataEnrichmentResult> {
    const timestamp = new Date().toISOString();
    
    try {
      const result = await this.client.enrichCompany(identifier, isDomain);
      
      return {
        company: result.data,
        success: true,
        source: 'crustdata',
        timestamp,
      };
    } catch (error) {
      return {
        company: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'crustdata',
        timestamp,
      };
    }
  }

  /**
   * Extract key enrichment fields from CrustData response
   */
  extractEnrichmentFields(company: CrustDataCompany): Record<string, any> {
    const fields: Record<string, any> = {};

    // Basic company information
    if (company.name) fields.company_name = company.name;
    if (company.domain) fields.domain = company.domain;
    if (company.description) fields.description = company.description;
    if (company.industry) fields.industry = company.industry;
    if (company.sector) fields.sector = company.sector;
    if (company.employee_count) fields.employee_count = company.employee_count;
    if (company.revenue) fields.revenue = company.revenue;
    if (company.founded_year) fields.founded_year = company.founded_year;

    // Location information
    if (company.headquarters) {
      if (company.headquarters.city) fields.headquarters_city = company.headquarters.city;
      if (company.headquarters.state) fields.headquarters_state = company.headquarters.state;
      if (company.headquarters.country) fields.headquarters_country = company.headquarters.country;
      if (company.headquarters.address) fields.headquarters_address = company.headquarters.address;
    }

    // Social media
    if (company.social_media) {
      if (company.social_media.linkedin) fields.linkedin_url = company.social_media.linkedin;
      if (company.social_media.twitter) fields.twitter_url = company.social_media.twitter;
      if (company.social_media.facebook) fields.facebook_url = company.social_media.facebook;
      if (company.social_media.instagram) fields.instagram_url = company.social_media.instagram;
    }

    // Technologies
    if (company.technologies && company.technologies.length > 0) {
      fields.technologies = company.technologies;
    }

    // Funding information
    if (company.funding) {
      if (company.funding.total_funding) fields.total_funding = company.funding.total_funding;
      if (company.funding.last_funding_date) fields.last_funding_date = company.funding.last_funding_date;
      if (company.funding.last_funding_round) fields.last_funding_round = company.funding.last_funding_round;
      if (company.funding.investors && company.funding.investors.length > 0) {
        fields.investors = company.funding.investors;
      }
    }

    // Website metrics
    if (company.metrics) {
      if (company.metrics.alexa_rank) fields.alexa_rank = company.metrics.alexa_rank;
      if (company.metrics.monthly_visitors) fields.monthly_visitors = company.metrics.monthly_visitors;
      if (company.metrics.bounce_rate) fields.bounce_rate = company.metrics.bounce_rate;
      if (company.metrics.page_views_per_visit) fields.page_views_per_visit = company.metrics.page_views_per_visit;
      if (company.metrics.time_on_site) fields.time_on_site = company.metrics.time_on_site;
    }

    // Contact information
    if (company.contact_info) {
      if (company.contact_info.email) fields.contact_email = company.contact_info.email;
      if (company.contact_info.phone) fields.contact_phone = company.contact_info.phone;
      if (company.contact_info.address) fields.contact_address = company.contact_info.address;
    }

    // Metadata
    fields.crustdata_last_updated = company.last_updated;
    fields.enrichment_source = 'crustdata';

    return fields;
  }

  /**
   * Get companies by industry for bulk enrichment
   */
  async getCompaniesByIndustry(
    industry: string,
    limit: number = 50
  ): Promise<CrustDataEnrichmentResult[]> {
    const timestamp = new Date().toISOString();
    
    try {
      const result = await this.client.getCompaniesByIndustry(industry, limit);
      
      return result.data.map(company => ({
        company,
        success: true,
        source: 'crustdata',
        timestamp,
      }));
    } catch (error) {
      return [{
        company: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'crustdata',
        timestamp,
      }];
    }
  }

  /**
   * Get companies by technology stack
   */
  async getCompaniesByTechnology(
    technologies: string[],
    limit: number = 50
  ): Promise<CrustDataEnrichmentResult[]> {
    const timestamp = new Date().toISOString();
    
    try {
      const result = await this.client.getCompaniesByTechnology(technologies, limit);
      
      return result.data.map(company => ({
        company,
        success: true,
        source: 'crustdata',
        timestamp,
      }));
    } catch (error) {
      return [{
        company: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'crustdata',
        timestamp,
      }];
    }
  }

  /**
   * Get companies by funding range
   */
  async getCompaniesByFunding(
    minFunding?: number,
    maxFunding?: number,
    limit: number = 50
  ): Promise<CrustDataEnrichmentResult[]> {
    const timestamp = new Date().toISOString();
    
    try {
      const result = await this.client.getCompaniesByFunding(minFunding, maxFunding, limit);
      
      return result.data.map(company => ({
        company,
        success: true,
        source: 'crustdata',
        timestamp,
      }));
    } catch (error) {
      return [{
        company: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'crustdata',
        timestamp,
      }];
    }
  }

  /**
   * Get companies by employee count range
   */
  async getCompaniesByEmployeeCount(
    minEmployees?: number,
    maxEmployees?: number,
    limit: number = 50
  ): Promise<CrustDataEnrichmentResult[]> {
    const timestamp = new Date().toISOString();
    
    try {
      const result = await this.client.getCompaniesByEmployeeCount(minEmployees, maxEmployees, limit);
      
      return result.data.map(company => ({
        company,
        success: true,
        source: 'crustdata',
        timestamp,
      }));
    } catch (error) {
      return [{
        company: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'crustdata',
        timestamp,
      }];
    }
  }

  /**
   * Get companies by location
   */
  async getCompaniesByLocation(
    country?: string,
    state?: string,
    city?: string,
    limit: number = 50
  ): Promise<CrustDataEnrichmentResult[]> {
    const timestamp = new Date().toISOString();
    
    try {
      const result = await this.client.getCompaniesByLocation(country, state, city, limit);
      
      return result.data.map(company => ({
        company,
        success: true,
        source: 'crustdata',
        timestamp,
      }));
    } catch (error) {
      return [{
        company: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'crustdata',
        timestamp,
      }];
    }
  }
}
