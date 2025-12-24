import { TAMExpansionService } from './tam-expansion-service';
import { CompanyDBFilter } from './types';

describe('TAMExpansionService', () => {
  let service: TAMExpansionService;

  beforeEach(() => {
    service = new TAMExpansionService({
      apiKey: process.env.CRUSTDATA_API_KEY || 'test-key'
    });
  });

  describe('buildHighRecallFilter', () => {
    it('should build filter with all required conditions', () => {
      const filter = service.buildHighRecallFilter();

      expect(filter).toHaveProperty('op', 'and');
      expect(filter.conditions).toHaveLength(3);

      // Should have location filter group (nested OR of countries)
      const locationFilterGroup = filter.conditions.find(
        (c: any) => 'op' in c && c.op === 'or'
      ) as any;
      expect(locationFilterGroup).toBeDefined();
      expect(locationFilterGroup.conditions[0]).toHaveProperty('filter_type', 'hq_location');

      // Should have employee size filter
      const employeeFilter = filter.conditions.find(
        (c: any) => 'filter_type' in c && c.filter_type === 'employee_count_range'
      );
      expect(employeeFilter).toBeDefined();

      // Should have keyword filter
      const keywordFilter = filter.conditions.find(
        (c: any) => 'filter_type' in c && c.filter_type === 'linkedin_company_description'
      );
      expect(keywordFilter).toBeDefined();
    });
  });

  describe('searchWithHighRecall', () => {
    it('should return companies matching high-recall criteria', async () => {
      const result = await service.searchWithHighRecall({ limit: 10 });

      expect(result).toHaveProperty('companies');
      expect(result).toHaveProperty('total_count');
      expect(result.companies.length).toBeLessThanOrEqual(10);
    });
  });

  describe('collectAllCompanies', () => {
    it('should paginate through all results', async () => {
      const companies = await service.collectAllCompanies({ maxResults: 100 });

      expect(Array.isArray(companies)).toBe(true);
      expect(companies.length).toBeLessThanOrEqual(100);

      // Each company should have required fields
      companies.forEach(company => {
        expect(company).toHaveProperty('company_name');
      });
    });
  });
});
