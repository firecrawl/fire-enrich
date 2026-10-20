import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { FirecrawlService } from './firecrawl';
import type { SearchResult } from '../types';

export type ResearchProvider = 'parallel' | 'firecrawl' | 'disabled';
export type SearchOptions = { limit?: number; scrapeContent?: boolean };

export interface ResearchService {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  scrapeUrl(url: string): Promise<{ data?: { markdown?: string; html?: string }; error?: string }>;
  close(): Promise<void>;
}

export function resolveResearchProvider(apiKey?: string, configured = process.env.WEB_SEARCH_PROVIDER): ResearchProvider {
  if (configured && !['parallel', 'firecrawl', 'disabled'].includes(configured)) {
    throw new Error('WEB_SEARCH_PROVIDER must be parallel, firecrawl or disabled');
  }
  const provider = configured || (apiKey ? 'firecrawl' : 'parallel');
  if (provider === 'firecrawl' && !apiKey) {
    throw new Error('A Firecrawl API key is required when WEB_SEARCH_PROVIDER=firecrawl');
  }
  return provider as ResearchProvider;
}

const responseSchema = z.object({
  results: z.array(z.object({
    url: z.string().refine(value => {
      try { return ['http:', 'https:'].includes(new URL(value).protocol); }
      catch { return false; }
    }, 'Expected an HTTP(S) source URL'),
    title: z.string().nullish(),
    excerpts: z.array(z.string()).optional(),
    full_content: z.string().nullish(),
  })),
  errors: z.array(z.unknown()).optional(),
});

/** One instance belongs to one row's research run, including all search/fetch calls. */
class ParallelResearchService implements ResearchService {
  private readonly sessionId = randomUUID();
  private readonly client = new Client({ name: 'fire-enrich', version: '0.1.0' });
  private connecting?: Promise<void>;

  constructor(private readonly signal?: AbortSignal) {}

  private async connect() {
    this.signal?.throwIfAborted();
    if (!this.connecting) {
      this.connecting = (async () => {
        const transport = new StreamableHTTPClientTransport(new URL('https://search.parallel.ai/mcp'), {
          requestInit: { headers: { 'User-Agent': 'fire-enrich/0.1.0 (+https://github.com/firecrawl/fire-enrich)' } },
        });
        await this.client.connect(transport, { signal: this.signal, timeout: 30_000 });
        const { tools } = await this.client.listTools({}, { signal: this.signal, timeout: 30_000 });
        for (const name of ['web_search', 'web_fetch']) {
          if (!tools.some(tool => tool.name === name)) throw new Error(`Parallel MCP is missing ${name}`);
        }
      })();
    }
    await this.connecting;
    this.signal?.throwIfAborted();
  }

  private async call(name: string, args: Record<string, unknown>) {
    await this.connect();
    const result = await this.client.callTool({
      name,
      arguments: { ...args, session_id: this.sessionId },
    }, undefined, { signal: this.signal, timeout: 30_000 });
    this.signal?.throwIfAborted();
    if (result.isError) throw new Error('Parallel MCP research request failed');
    const text = (result.content as Array<{ type: string; text?: string }> | undefined)
      ?.filter(item => item.type === 'text').map(item => item.text).join('\n');
    const parsed = responseSchema.parse(result.structuredContent ?? JSON.parse(text || 'null'));
    if (parsed.errors?.length && !parsed.results.length) throw new Error('Parallel could not retrieve the requested sources');
    return parsed.results;
  }

  async search(query: string, { limit = 5, scrapeContent = true }: SearchOptions = {}): Promise<SearchResult[]> {
    const results = await this.call('web_search', {
      objective: `Find reliable sources for company research: ${query}`,
      search_queries: [query],
    });
    return Array.from(new Map(results.map(item => [item.url, item])).values())
      .slice(0, Math.max(0, limit)).map(item => ({
        url: item.url,
        title: item.title || '',
        description: (item.excerpts || []).join('\n\n'),
        markdown: scrapeContent ? (item.full_content || (item.excerpts || []).join('\n\n')) : undefined,
      }));
  }

  async scrapeUrl(url: string) {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Expected an HTTP(S) page URL');
    const results = await this.call('web_fetch', {
      urls: [parsed.href],
      objective: 'Find company information, leadership, products and business details.',
    });
    const page = results[0];
    return { data: { markdown: page ? (page.full_content || (page.excerpts || []).join('\n\n')) : '' } };
  }

  async close() { await this.client.close(); }
}

export function createResearchService(apiKey?: string, signal?: AbortSignal): ResearchService {
  const provider = resolveResearchProvider(apiKey);
  if (provider === 'parallel') return new ParallelResearchService(signal);
  if (provider === 'disabled') return {
    async search() { return []; },
    async scrapeUrl() { return { error: 'Web research is disabled' }; },
    async close() {},
  };
  const firecrawl = new FirecrawlService(apiKey!);
  return {
    async search(query, options) {
      signal?.throwIfAborted();
      const result = await firecrawl.search(query, options);
      signal?.throwIfAborted();
      return result;
    },
    async scrapeUrl(url) {
      signal?.throwIfAborted();
      const result = await firecrawl.scrapeUrl(url);
      signal?.throwIfAborted();
      return result;
    },
    async close() {},
  };
}
