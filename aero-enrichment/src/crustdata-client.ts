import {
  CrustDataCompany,
  CrustDataCompanyResponse,
  CrustDataSearchParams,
  CrustDataSearchResponse,
  CrustDataClientOptions,
  CompanyDBSearchParams,
  CompanyDBSearchResponse
} from './types';

const DEFAULT_BASE_URL = 'https://api.crustdata.com';
const DEFAULT_TIMEOUT = 120000; // 120 seconds (complex queries need more time)

export class CrustDataClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: CrustDataClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.CRUSTDATA_API_KEY;
    if (!apiKey) {
      throw new Error('Missing CrustData API key. Set CRUSTDATA_API_KEY environment variable.');
    }
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(item => url.searchParams.append(key, String(item)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `CrustData API request failed: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`CrustData API request timed out after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Get company information by domain
   */
  async getCompany(domain: string): Promise<CrustDataCompanyResponse> {
    if (!domain) {
      throw new Error('Domain is required');
    }

    // Remove protocol and www if present
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]; // Remove path if present

    return this.makeRequest<CrustDataCompanyResponse>('/screener/company', {
      company_domain: cleanDomain,
    });
  }

  /**
   * Search for companies with various filters
   */
  async searchCompanies(params: CrustDataSearchParams): Promise<CrustDataSearchResponse> {
    return this.makeRequest<CrustDataSearchResponse>('/screener/companies', params);
  }

  /**
   * Get company by name (alternative to domain search)
   */
  async getCompanyByName(name: string): Promise<CrustDataCompanyResponse> {
    if (!name) {
      throw new Error('Company name is required');
    }

    return this.makeRequest<CrustDataCompanyResponse>('/screener/company', {
      company_name: name,
    });
  }

  /**
   * Enrich company data with additional information
   * This is a convenience method that tries domain first, then name
   */
  async enrichCompany(identifier: string, isDomain: boolean = true): Promise<CrustDataCompanyResponse> {
    try {
      if (isDomain) {
        return await this.getCompany(identifier);
      } else {
        return await this.getCompanyByName(identifier);
      }
    } catch (error) {
      // If domain search fails, try name search as fallback
      if (isDomain) {
        console.warn(`Domain search failed for ${identifier}, trying name search as fallback`);
        try {
          return await this.getCompanyByName(identifier);
        } catch (fallbackError) {
          throw new Error(
            `Both domain and name search failed for ${identifier}. Domain error: ${error}. Name error: ${fallbackError}`
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get companies by industry
   */
  async getCompaniesByIndustry(industry: string, limit: number = 50): Promise<CrustDataSearchResponse> {
    return this.searchCompanies({
      industry,
      limit,
    });
  }

  /**
   * Get companies by technology stack
   */
  async getCompaniesByTechnology(technologies: string[], limit: number = 50): Promise<CrustDataSearchResponse> {
    return this.searchCompanies({
      technologies,
      limit,
    });
  }

  /**
   * Get companies by funding range
   */
  async getCompaniesByFunding(
    minFunding?: number,
    maxFunding?: number,
    limit: number = 50
  ): Promise<CrustDataSearchResponse> {
    return this.searchCompanies({
      funding_min: minFunding,
      funding_max: maxFunding,
      limit,
    });
  }

  /**
   * Get companies by employee count range
   */
  async getCompaniesByEmployeeCount(
    minEmployees?: number,
    maxEmployees?: number,
    limit: number = 50
  ): Promise<CrustDataSearchResponse> {
    return this.searchCompanies({
      employee_count_min: minEmployees,
      employee_count_max: maxEmployees,
      limit,
    });
  }

  /**
   * Get companies by location
   */
  async getCompaniesByLocation(
    country?: string,
    state?: string,
    city?: string,
    limit: number = 50
  ): Promise<CrustDataSearchResponse> {
    return this.searchCompanies({
      headquarters_country: country,
      headquarters_state: state,
      headquarters_city: city,
      limit,
    });
  }

  /**
   * Search CompanyDB using v2 API with advanced filters
   * Uses POST /screener/companydb/search endpoint
   */
  async searchCompanyDB(params: CompanyDBSearchParams): Promise<CompanyDBSearchResponse> {
    const url = `${this.baseUrl}/screener/companydb/search`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `CompanyDB search failed: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = await response.json();
      return data as CompanyDBSearchResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`CompanyDB search timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }
}
