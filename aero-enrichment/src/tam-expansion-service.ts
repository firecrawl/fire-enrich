import { CrustDataClient } from './crustdata-client';
import {
  CompanyDBFilter,
  CompanyDBFilterGroup,
  CompanyDBSearchParams,
  CompanyDBCompany,
  CrustDataClientOptions
} from './types';

export interface TAMExpansionOptions extends CrustDataClientOptions {
  batchSize?: number;
  maxRetries?: number;
}

export interface SearchOptions {
  limit?: number;
  maxResults?: number;
}

export class TAMExpansionService {
  private client: CrustDataClient;
  private batchSize: number;
  private maxRetries: number;

  constructor(options: TAMExpansionOptions = {}) {
    this.client = new CrustDataClient(options);
    this.batchSize = options.batchSize ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /**
   * Build optimized multi-segment filter with nested OR/AND logic.
   * Combines all segments into a single query to minimize API costs.
   *
   * Structure:
   * AND (
   *   OR (countries),
   *   employee_size IN [...],
   *   OR (
   *     segment1: AND(industries, keywords),
   *     segment2: AND(industries, keywords),
   *     segment3: industry-only,
   *     ...
   *   )
   * )
   */
  buildHighRecallFilter(): CompanyDBFilterGroup {
    // Geography: Fintech 250 countries
    const countries = [
      // Core markets
      'United States',
      'United Kingdom',
      'Canada',
      'Brazil',
      // Europe
      'Germany',
      'Netherlands',
      'France',
      'Sweden',
      'Ireland',
      'Switzerland',
      'Denmark',
      'Spain',
      'Italy',
      'Austria',
      'Poland',
      'Belgium',
      'Portugal',
      'Estonia',
      'Latvia',
      'Croatia',
      'Cyprus',
      // Asia Pacific
      'Singapore',
      'India',
      'Australia',
      'Japan',
      'South Korea',
      'Indonesia',
      'Thailand',
      'Malaysia',
      'Bangladesh',
      'Myanmar',
      'New Zealand',
      // Middle East & Africa
      'Israel',
      'United Arab Emirates',
      'Saudi Arabia',
      'Egypt',
      'Nigeria',
      'South Africa',
      'Turkey',
      // Latin America
      'Mexico',
      'Argentina',
      // Special regions
      'Hong Kong',
      'China',
      'Uzbekistan'
    ];

    // Minimum employee count (using latest LinkedIn headcount, more accurate than buckets)
    const minEmployeeCount = 50;

    // Build segment conditions - each is an AND of (industry OR) and (keyword OR)
    // Focus: Consumer-facing fintechs, digital marketplaces, gig economy
    // Exclude: Hedge funds, PE, private credit, institutional investors
    const segmentConditions: (CompanyDBFilter | CompanyDBFilterGroup)[] = [];

    // ===== SEGMENT: Consumer Fintech / Neobanks =====
    // Captures: Chime, Revolut, Nubank, N26, Dave, Varo, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Financial Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Banking' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'fintech' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'neobank' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital bank' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'challenger bank' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'mobile bank' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'banking as a service' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'consumer banking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'personal finance' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'financial wellness' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Payments & Money Transfer =====
    // Captures: Stripe, PayPal, Square, Adyen, Wise, Remitly, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Financial Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'payment processing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'payment platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'payment gateway' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'merchant services' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'card processing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'card issuing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'money transfer' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'remittance' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital wallet' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'mobile payments' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Consumer Lending & BNPL =====
    // Captures: Affirm, Klarna, Afterpay, SoFi, Upstart, LendingClub, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Financial Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Banking' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Loan Brokers' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'consumer lending' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'personal loan' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'buy now pay later' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'BNPL' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'student loan' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'auto loan' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'mortgage' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'credit builder' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'peer-to-peer lending' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'alternative lending' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'small business loan' }
          ]
        }
      ]
    });

    // ===== SEGMENT: B2C InsurTech =====
    // Captures: Lemonade, Root, Hippo, Oscar, Next Insurance, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Insurance' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Insurance Carriers' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Insurance Agencies and Brokerages' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'insurtech' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital insurance' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'insurance app' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'insurance technology' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'insurance platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'insurance comparison' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'insurance marketplace' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Consumer Crypto & Digital Assets =====
    // Captures: Coinbase, Binance, Kraken, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Financial Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'cryptocurrency' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'crypto exchange' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'crypto trading' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital asset' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'bitcoin' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'blockchain' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'web3' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'DeFi' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'crypto wallet' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Consumer Investing & Trading =====
    // Captures: Robinhood, eToro, Trading 212, Webull, Acorns, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Financial Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Investment Management' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Capital Markets' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'robo-advisor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'robo advisor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'commission-free' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'retail investing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'retail trading' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'stock trading app' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'investment app' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'micro-investing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'fractional shares' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'online brokerage' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'trading platform' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Internet Marketplaces (industry) =====
    // Captures: Uber, Airbnb, DoorDash, Instacart, etc.
    segmentConditions.push({
      filter_type: 'linkedin_industries',
      type: '(.)',
      value: 'Internet Marketplace Platforms'
    });

    // ===== SEGMENT: Digital Marketplaces & Platforms =====
    // Captures: Etsy, Fiverr, Upwork, TaskRabbit, Thumbtack, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'two-sided platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'two sided platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'platform connecting' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'peer-to-peer' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'sharing economy' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'connects buyers and sellers' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'b2b marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'b2c marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'online marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'platform economy' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Gig Economy & Independent Contractors =====
    // Captures: Uber, Lyft, DoorDash, Instacart, Shipt, Gopuff, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Ground Passenger Transportation' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Freight and Package Transportation' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'gig economy' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'gig worker' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'gig platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'independent contractor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand delivery' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand workforce' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand services' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'rideshare' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'ride-sharing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'ride hailing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'food delivery' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'grocery delivery' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'last-mile' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'delivery app' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'delivery platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'courier' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'flexible work' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: '1099 worker' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Freelance & Services Marketplaces =====
    // Captures: Fiverr, Upwork, TaskRabbit, Thumbtack, Rover, Care.com, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Staffing and Recruiting' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'freelance marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'talent marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'services marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home services platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'freelancer' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'gig platform' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Vacation Rentals & Travel =====
    // Captures: Airbnb, VRBO, Booking.com, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Hospitality' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Travel Arrangements' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'vacation rental' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'short-term rental' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home sharing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'travel booking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'hotel booking' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Home Services & Trades =====
    // Captures: Angi, Thumbtack, Handy, Porch, TaskRabbit, BuildZoom, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Consumer Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Construction' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home services' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home improvement' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'handyman' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'plumber' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'electrician' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'contractor marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'trades marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home repair' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'cleaning services' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'house cleaning' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home cleaning' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'professional cleaner' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'lawn care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'landscaping' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'HVAC' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Pet Services =====
    // Captures: Rover, Wag, PetBacker, Care.com (pets), etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Consumer Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Veterinary Services' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'pet sitting' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'dog walking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'pet care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'dog boarding' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'pet services' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'pet marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'dog sitter' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'pet sitter' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'pet grooming' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'dog groomer' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Childcare & Elder Care =====
    // Captures: Care.com, Sittercity, UrbanSitter, Honor, Papa, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Consumer Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Individual and Family Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Hospitals and Health Care' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'childcare' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'child care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'babysitter' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'babysitting' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'nanny' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'daycare' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'elder care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'senior care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'home care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'caregiver' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'care marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'family care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'in-home care' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'companion care' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Auto Services =====
    // Captures: YourMechanic, Wrench, RepairSmith, Turo, Getaround, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Motor Vehicle Manufacturing' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Automotive' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'mobile mechanic' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'auto repair' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'car repair' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'vehicle repair' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'car sharing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'car rental marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'peer-to-peer car' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'vehicle sharing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'car marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'auto service' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'tow truck' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'roadside assistance' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Beauty & Wellness =====
    // Captures: StyleSeat, Vagaro, GlossGenius, Booksy, Mindbody, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Consumer Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Wellness and Fitness Services' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Personal Care Product Manufacturing' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'beauty marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'salon booking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'salon software' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'spa booking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'beauty professional' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'hairstylist' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'hair stylist' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'barber' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'nail technician' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'esthetician' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'massage therapist' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'wellness booking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'fitness booking' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'personal trainer' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'yoga instructor' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Education & Tutoring =====
    // Captures: Wyzant, Varsity Tutors, Outschool, Preply, Chegg, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'E-Learning Providers' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Education' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'tutoring marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'tutor marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'online tutoring' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'private tutor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'tutoring platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'language tutor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'math tutor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'test prep' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'SAT prep' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'ACT prep' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'homework help' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'connects students' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'music teacher' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'instructor marketplace' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Moving & Labor =====
    // Captures: Dolly, Bellhops, GoShare, Lugg, Taskrabbit (moving), etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Internet Marketplace Platforms' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Truck Transportation' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Consumer Services' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'moving service' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'moving company' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'moving marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'furniture delivery' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'labor marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand labor' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'moving help' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'movers' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'junk removal' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'hauling' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'assembly service' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'furniture assembly' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Logistics & Supply Chain Marketplaces =====
    // Captures: Flexport, Convoy, Uber Freight, Samsara, Project44, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Freight and Package Transportation' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Transportation, Logistics, Supply Chain and Storage' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Truck Transportation' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'freight marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'logistics marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'trucking platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'freight platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'shipping platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'supply chain platform' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'logistics technology' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'fleet management' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital freight' }
          ]
        }
      ]
    });

    // ===== SEGMENT: Healthcare Gig & Staffing Marketplaces =====
    // Captures: Nomad Health, Incredible Health, ShiftMed, CareRev, etc.
    segmentConditions.push({
      op: 'and',
      conditions: [
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Staffing and Recruiting' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Hospitals and Health Care' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
            { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
          ]
        },
        {
          op: 'or',
          conditions: [
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'healthcare staffing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'nurse staffing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'medical staffing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'healthcare marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'clinician marketplace' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'per diem nursing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'travel nursing' },
            { filter_type: 'linkedin_company_description', type: '(.)', value: 'healthcare gig' }
          ]
        }
      ]
    });

    // Company types to exclude
    const excludedCompanyTypes = [
      'Self-Employed',
      'Sole Proprietorship',
      'Nonprofit',
      'Educational Institution',
      'Government Agency'
    ];

    // Industries to exclude (PE, VC, Hedge Funds, Asset Management, IT Consulting, Retail, Credit Unions, etc.)
    const excludedIndustries = [
      'Venture Capital and Private Equity Principals',
      'Capital Markets',
      'Investment Management',
      'Professional Networking',
      'IT Services and IT Consulting',
      'Retail',
      'Credit Unions'
    ];

    // Note: Description exclusions not supported by API filter
    // Bad fits will be filtered in post-processing using these terms:
    // - 'hedge fund'
    // - 'private equity fund'
    // - 'fund manager' (when primary business)

    // Combine all into final filter
    return {
      op: 'and',
      conditions: [
        // Geography filter (US only)
        {
          op: 'or',
          conditions: countries.map(country => ({
            filter_type: 'hq_location',
            type: '(.)',
            value: country
          }))
        },
        // Employee count filter (using latest LinkedIn headcount - more accurate than buckets)
        // Note: API doesn't support >=, so we use > with value-1
        {
          filter_type: 'employee_metrics.latest_count',
          type: '>',
          value: minEmployeeCount - 1  // > 49 means >= 50
        },
        // Exclude certain company types
        {
          filter_type: 'company_type',
          type: 'not_in',
          value: excludedCompanyTypes
        },
        // Exclude PE, VC, Hedge Funds, Capital Markets, IT Consulting, etc.
        ...excludedIndustries.map(industry => ({
          filter_type: 'linkedin_industries',
          type: 'not_in' as const,
          value: [industry]
        } as CompanyDBFilter)),
        // Segment filters (OR of all segments)
        {
          op: 'or',
          conditions: segmentConditions
        }
      ]
    };
  }

  /**
   * Execute high-recall search with pagination support
   */
  async searchWithHighRecall(options: SearchOptions = {}): Promise<{
    companies: CompanyDBCompany[];
    next_cursor?: string;
    total_count?: number;
  }> {
    const filter = this.buildHighRecallFilter();
    const limit = options.limit ?? this.batchSize;

    return await this.client.searchCompanyDB({
      filters: filter,
      limit,
      sorts: [
        {
          column: 'employee_metrics.latest_count',
          order: 'desc'
        }
      ]
    });
  }

  /**
   * Collect all companies matching high-recall criteria
   * Handles pagination automatically
   */
  async collectAllCompanies(options: SearchOptions = {}): Promise<CompanyDBCompany[]> {
    const maxResults = options.maxResults ?? Infinity;
    const allCompanies: CompanyDBCompany[] = [];
    let cursor: string | undefined;
    let retryCount = 0;

    console.log(`Starting TAM expansion search (max: ${maxResults} companies)...`);

    while (allCompanies.length < maxResults) {
      try {
        const remaining = maxResults - allCompanies.length;
        const limit = Math.min(this.batchSize, remaining);

        const result = await this.client.searchCompanyDB({
          filters: this.buildHighRecallFilter(),
          limit,
          cursor,
          sorts: [
            {
              column: 'employee_metrics.latest_count',
              order: 'desc'
            }
          ]
        });

        if (result.companies.length === 0) {
          console.log('No more companies found');
          break;
        }

        allCompanies.push(...result.companies);
        console.log(`Collected ${allCompanies.length} companies (total available: ${result.total_count ?? 'unknown'})`);

        cursor = result.next_cursor;
        if (!cursor) {
          console.log('Reached end of results');
          break;
        }

        retryCount = 0; // Reset retry count on success

        // Rate limiting: brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        retryCount++;
        console.error(`Error fetching companies (attempt ${retryCount}/${this.maxRetries}):`, error);

        if (retryCount >= this.maxRetries) {
          console.error('Max retries reached, stopping collection');
          throw error;
        }

        // Exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    console.log(`Collection complete: ${allCompanies.length} companies`);
    return allCompanies;
  }
}
