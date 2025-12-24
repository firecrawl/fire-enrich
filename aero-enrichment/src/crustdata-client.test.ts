import { CrustDataClient } from './crustdata-client';
import { CompanyDBFilterGroup, CompanyDBFilterCondition } from './types';

describe('CrustDataClient - CompanyDB Search v2', () => {
  let client: CrustDataClient;

  beforeEach(() => {
    client = new CrustDataClient({
      apiKey: process.env.CRUSTDATA_API_KEY || 'test-key'
    });
  });

  it('should execute companydb search with complex filters', async () => {
    const filters: CompanyDBFilterGroup = {
      op: 'and',
      conditions: [
        {
          filter_type: 'hq_location',
          type: '(.)',
          value: 'United States'
        },
        {
          filter_type: 'employee_count_range',
          type: 'in',
          value: ['51-200', '201-500']
        }
      ]
    };

    const result = await client.searchCompanyDB({
      filters,
      limit: 10
    });

    expect(result).toHaveProperty('companies');
    expect(result).toHaveProperty('total_count');
    expect(Array.isArray(result.companies)).toBe(true);
  });

  it('should support pagination with cursor', async () => {
    const filters: CompanyDBFilterCondition = {
      filter_type: 'hq_country',
      type: '=',
      value: 'United States'
    };

    const firstPage = await client.searchCompanyDB({
      filters,
      limit: 100
    });

    expect(firstPage).toHaveProperty('companies');
    expect(Array.isArray(firstPage.companies)).toBe(true);

    if (firstPage.next_cursor) {
      const secondPage = await client.searchCompanyDB({
        filters,
        limit: 100,
        cursor: firstPage.next_cursor
      });

      expect(secondPage.companies).toBeDefined();
    }
  });
});
