/**
 * Firecrawl configuration helper.
 * Allows switching between the managed Firecrawl service and self-hosted deployments.
 */

const DEFAULT_FIRECRAWL_CLOUD_URL = 'https://api.firecrawl.dev';

export type FirecrawlMode = 'saas' | 'self_hosted';

export interface FirecrawlConfig {
  apiKey: string | null;
  apiUrl: string;
  mode: FirecrawlMode;
  requiresApiKey: boolean;
}

export interface FirecrawlConfigInput {
  apiKey?: string | null;
  apiUrl?: string | null;
}

export type FirecrawlClientConfig = Pick<FirecrawlConfig, 'apiKey' | 'apiUrl'>;

const urlEnvOrder = [
  'FIRECRAWL_API_URL',
  'FIRECRAWL_BASE_URL',
  'FIRECRAWL_SELF_HOSTED_URL',
] as const;

const selfHostedKeyEnvOrder = [
  'FIRECRAWL_SELF_HOSTED_API_KEY',
  'FIRECRAWL_API_KEY',
] as const;

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

function isCloudUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'api.firecrawl.dev';
  } catch {
    return false;
  }
}

function firstDefinedEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function cleanEnvValue(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveFirecrawlConfig(overrides: FirecrawlConfigInput = {}): FirecrawlConfig {
  const envBaseUrl = firstDefinedEnv(urlEnvOrder);
  const hasBaseOverride = Object.prototype.hasOwnProperty.call(overrides, 'apiUrl');
  const baseOverride = hasBaseOverride ? normalizeBaseUrl(overrides.apiUrl ?? null) : null;
  const baseUrl = normalizeBaseUrl(baseOverride ?? envBaseUrl) ?? DEFAULT_FIRECRAWL_CLOUD_URL;

  const mode: FirecrawlMode = isCloudUrl(baseUrl) ? 'saas' : 'self_hosted';

  const envApiKey = cleanEnvValue(process.env.FIRECRAWL_API_KEY);
  const envSelfHostedKey = firstDefinedEnv(selfHostedKeyEnvOrder);
  const apiKeySource = mode === 'saas' ? envApiKey : envSelfHostedKey ?? envApiKey;
  const hasApiKeyOverride = Object.prototype.hasOwnProperty.call(overrides, 'apiKey');
  const apiKey = hasApiKeyOverride ? overrides.apiKey ?? null : apiKeySource;
  const requiresApiKey = mode === 'saas';

  return {
    apiKey: apiKey ?? null,
    apiUrl: baseUrl,
    mode,
    requiresApiKey,
  };
}

export function getEnvFirecrawlConfig(): FirecrawlConfig {
  return resolveFirecrawlConfig();
}
