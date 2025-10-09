import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';
import { isRateLimited } from '@/lib/rate-limit';
import { resolveFirecrawlConfig } from '@/lib/config/firecrawl';

interface ScrapeRequestBody {
  url?: string;
  urls?: string[];
  [key: string]: unknown;
}

interface ScrapeResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

interface ApiError extends Error {
  status?: number;
}

export async function POST(request: NextRequest) {
  const rateLimit = await isRateLimited(request, 'scrape');
  
  if (!rateLimit.success) {
    return NextResponse.json({ 
      success: false,
      error: 'Rate limit exceeded. Please try again later.' 
    }, { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimit.limit.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      }
    });
  }

  const firecrawlApiKeyHeader = request.headers.get('X-Firecrawl-API-Key');
  const firecrawlApiUrlHeader = request.headers.get('X-Firecrawl-API-Url') || request.headers.get('X-Firecrawl-Base-Url');

  const firecrawlConfig = resolveFirecrawlConfig({
    ...(firecrawlApiKeyHeader ? { apiKey: firecrawlApiKeyHeader } : {}),
    ...(firecrawlApiUrlHeader ? { apiUrl: firecrawlApiUrlHeader } : {}),
  });

  if (firecrawlConfig.requiresApiKey && !firecrawlConfig.apiKey) {
    return NextResponse.json({ 
      success: false, 
      error: 'API configuration error. Please provide a Firecrawl API key.' 
    }, { status: 500 });
  }

  try {
    const app = new FirecrawlApp({
      apiKey: firecrawlConfig.apiKey ?? undefined,
      apiUrl: firecrawlConfig.apiUrl,
    });
    const body = await request.json() as ScrapeRequestBody;
    const { url, urls, ...params } = body;

    let result: ScrapeResult;

    if (url && typeof url === 'string') {
      result = await app.scrapeUrl(url, params) as ScrapeResult;
    } else if (urls && Array.isArray(urls)) {
      result = await app.batchScrapeUrls(urls, params) as ScrapeResult;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid request format. Please check your input and try again.' }, { status: 400 });
    }
    
    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Error in /api/scrape endpoint (SDK):', error);
    const err = error as ApiError;
    const errorStatus = typeof err.status === 'number' ? err.status : 500;
    return NextResponse.json({ success: false, error: 'An error occurred while processing your request. Please try again later.' }, { status: errorStatus });
  }
} 
