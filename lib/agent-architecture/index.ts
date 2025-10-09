import { AgentOrchestrator } from './orchestrator';
import type { FirecrawlClientConfig } from '../config/firecrawl';

export { AgentOrchestrator } from './orchestrator';
export * from './core/types';

// Factory function for easy initialization
export function createAgentOrchestrator(
  firecrawlConfig: FirecrawlClientConfig,
  openaiApiKey: string
) {
  return new AgentOrchestrator(firecrawlConfig, openaiApiKey);
}
