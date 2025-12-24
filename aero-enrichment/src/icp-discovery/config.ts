/**
 * ICP Signal Discovery - Configuration
 */

import type { PipelineConfig } from './types';

export const DEFAULT_CONFIG: PipelineConfig = {
  // Limits
  maxPagesPerSite: 10,
  maxCustomersPerTarget: 30,
  maxCompetitorsPerTarget: 5,
  maxSameVerticalNonICP: 20,
  maxDifferentVerticalNonICP: 30,
  
  // TF-IDF
  ngramRange: [2, 3],
  minDocFrequency: 2,
  topSignalsToReport: 30,
  
  // Models
  embeddingModel: 'text-embedding-3-small',
  extractionModel: 'gpt-4o-mini',
  
  // Rate limiting
  requestDelayMs: 200,
  maxConcurrentRequests: 5,
  
  // Timeouts
  websetTimeoutSeconds: 120,
  websetPollIntervalSeconds: 3,
  
  // Output
  outputDir: 'output/icp-reports',
  useCache: true,
  cacheDir: 'cache/icp-pipeline',
};

export function mergeConfig(partial: Partial<PipelineConfig>): PipelineConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}
