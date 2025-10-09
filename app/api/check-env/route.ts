import { NextResponse } from 'next/server';
import { getEnvFirecrawlConfig } from '@/lib/config/firecrawl';

export async function GET() {
  const firecrawlEnv = getEnvFirecrawlConfig();

  const environmentStatus = {
    FIRECRAWL_API_KEY: !!firecrawlEnv.apiKey,
    FIRECRAWL_API_URL: firecrawlEnv.apiUrl,
    FIRECRAWL_MODE: firecrawlEnv.mode,
    FIRECRAWL_REQUIRES_API_KEY: firecrawlEnv.requiresApiKey,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    FIRESTARTER_DISABLE_CREATION_DASHBOARD: process.env.FIRESTARTER_DISABLE_CREATION_DASHBOARD === 'true',
  };

  return NextResponse.json({ environmentStatus });
} 
