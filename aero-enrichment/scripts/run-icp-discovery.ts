#!/usr/bin/env npx tsx
/**
 * ICP Signal Discovery CLI
 * 
 * Usage:
 *   npx tsx scripts/run-icp-discovery.ts --target legora.com
 *   npx tsx scripts/run-icp-discovery.ts --targets "legora.com,harvey.ai" --output output.json
 *   npx tsx scripts/run-icp-discovery.ts --csv accounts.csv --website-col "Website" --name-col "Company"
 */

import { ICPDiscoveryService } from '../src/icp-discovery';
import * as fs from 'fs';
import * as path from 'path';

interface CLIConfig {
  targets: Array<{ name: string; website: string }>;
  customerLimit: number;
  competitorLimit: number;
  sameVerticalLimit: number;
  differentVerticalLimit: number;
  outputPath: string;
  skipIcpExtraction: boolean;
}

function parseArgs(): CLIConfig {
  const args = process.argv.slice(2);
  const config: CLIConfig = {
    targets: [],
    customerLimit: 30,
    competitorLimit: 5,
    sameVerticalLimit: 20,
    differentVerticalLimit: 30,
    outputPath: '',
    skipIcpExtraction: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--target':
        const website = args[++i];
        if (website) {
          const name = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
          config.targets.push({ name, website });
        }
        break;

      case '--targets':
        const websites = (args[++i] || '').split(',');
        for (const w of websites) {
          const trimmed = w.trim();
          if (trimmed) {
            const name = trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
            config.targets.push({ name, website: trimmed });
          }
        }
        break;

      case '--csv':
        const csvPath = args[++i];
        let nameCol = 'Company';
        let websiteCol = 'Website';
        
        // Check for column name args
        for (let j = i + 1; j < args.length; j++) {
          if (args[j] === '--name-col') nameCol = args[++j] || 'Company';
          if (args[j] === '--website-col') websiteCol = args[++j] || 'Website';
        }
        
        if (csvPath && fs.existsSync(csvPath)) {
          const content = fs.readFileSync(csvPath, 'utf-8');
          const lines = content.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const nameIdx = headers.findIndex(h => h.toLowerCase() === nameCol.toLowerCase());
          const websiteIdx = headers.findIndex(h => h.toLowerCase() === websiteCol.toLowerCase());
          
          for (let l = 1; l < lines.length; l++) {
            const cols = lines[l].split(',').map(c => c.trim().replace(/"/g, ''));
            const name = cols[nameIdx] || '';
            const website = cols[websiteIdx] || '';
            if (name && website) {
              config.targets.push({ name, website });
            }
          }
        }
        break;

      case '--customer-limit':
        config.customerLimit = parseInt(args[++i]) || 30;
        break;

      case '--competitor-limit':
        config.competitorLimit = parseInt(args[++i]) || 5;
        break;

      case '--same-vertical-limit':
        config.sameVerticalLimit = parseInt(args[++i]) || 20;
        break;

      case '--different-vertical-limit':
        config.differentVerticalLimit = parseInt(args[++i]) || 30;
        break;

      case '--output':
        config.outputPath = args[++i] || '';
        break;

      case '--skip-icp-extraction':
        config.skipIcpExtraction = true;
        break;

      case '--help':
        console.log(`
ICP Signal Discovery CLI

Usage:
  npx tsx scripts/run-icp-discovery.ts [options]

Options:
  --target <domain>              Single target domain (e.g., legora.com)
  --targets <domains>            Comma-separated domains (e.g., "legora.com,harvey.ai")
  --csv <path>                   Load targets from CSV file
  --name-col <column>            Column name for company name (default: "Company")
  --website-col <column>         Column name for website (default: "Website")
  --customer-limit <n>           Max customers per target (default: 30)
  --competitor-limit <n>         Max competitors per target (default: 5)
  --same-vertical-limit <n>      Same-vertical non-ICP limit (default: 20)
  --different-vertical-limit <n> Different-vertical non-ICP limit (default: 30)
  --output <path>                Output JSON file path
  --skip-icp-extraction          Skip website ICP extraction
  --help                         Show this help

Examples:
  npx tsx scripts/run-icp-discovery.ts --target legora.com
  npx tsx scripts/run-icp-discovery.ts --targets "legora.com,harvey.ai" --output results.json
  npx tsx scripts/run-icp-discovery.ts --csv accounts.csv --name-col "Company" --website-col "Website"
`);
        process.exit(0);
    }
  }

  return config;
}

async function main() {
  const config = parseArgs();

  if (config.targets.length === 0) {
    console.error('❌ No targets specified. Use --target, --targets, or --csv');
    console.error('   Run with --help for usage information');
    process.exit(1);
  }

  // Check API keys
  const exaApiKey = process.env.EXA_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!exaApiKey || !openaiApiKey) {
    console.error('❌ Missing API keys. Set EXA_API_KEY and OPENAI_API_KEY environment variables.');
    process.exit(1);
  }

  console.log('\n🚀 Starting ICP Signal Discovery...');
  console.log(`   Targets: ${config.targets.length}`);
  config.targets.forEach(t => console.log(`     - ${t.name} (${t.website})`));

  // Initialize service
  const service = new ICPDiscoveryService({
    exaApiKey,
    openaiApiKey,
    config: {
      maxCustomersPerTarget: config.customerLimit,
      maxCompetitorsPerTarget: config.competitorLimit,
      maxSameVerticalNonICP: config.sameVerticalLimit,
      maxDifferentVerticalNonICP: config.differentVerticalLimit,
    },
  });

  // Run discovery
  const results = await service.discover({
    targets: config.targets,
    config: {
      customer_limit: config.customerLimit,
      competitor_limit: config.competitorLimit,
      same_vertical_non_icp_limit: config.sameVerticalLimit,
      different_vertical_non_icp_limit: config.differentVerticalLimit,
      skip_icp_extraction: config.skipIcpExtraction,
    },
  });

  // Output results
  const outputPath = config.outputPath || `output/icp-discovery-${Date.now()}.json`;
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${outputPath}`);

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Request ID: ${results.metadata.request_id}`);
  console.log(`   Targets analyzed: ${results.metadata.targets_analyzed}`);
  console.log(`   Customers analyzed: ${results.metadata.total_customers_analyzed}`);
  console.log(`   Competitors found: ${results.metadata.competitors_found}`);
  console.log(`   Same-vertical non-ICP: ${results.metadata.same_vertical_non_icp_count}`);
  console.log(`   Different-vertical non-ICP: ${results.metadata.different_vertical_non_icp_count}`);
  console.log(`   Positive signals: ${results.signal_analysis.positive_signals.length}`);
  console.log(`   Concept clusters: ${results.signal_analysis.concept_clusters.length}`);
  console.log(`   Processing time: ${results.metadata.processing_time_seconds}s`);
  
  // Print cost summary if available
  if (results.metadata.cost_breakdown) {
    const cost = results.metadata.cost_breakdown;
    console.log(`\n💰 COST BREAKDOWN:`);
    console.log(`   Exa API: $${cost.exa.total_cost.toFixed(4)}`);
    console.log(`     - Websets: ${cost.exa.websets_created}, Items: ${cost.exa.webset_items_retrieved}`);
    console.log(`     - Searches: ${cost.exa.searches}, Content fetches: ${cost.exa.content_fetches}`);
    console.log(`   OpenAI API (${cost.openai.model}): $${cost.openai.total_cost.toFixed(4)}`);
    console.log(`     - Input tokens: ${cost.openai.input_tokens.toLocaleString()}`);
    console.log(`     - Output tokens: ${cost.openai.output_tokens.toLocaleString()}`);
    console.log(`   💵 TOTAL: $${cost.total_cost.toFixed(4)}`);
  }

  // Print top signals
  if (results.signal_analysis.positive_signals.length > 0) {
    console.log('\n📈 TOP POSITIVE SIGNALS:');
    for (const signal of results.signal_analysis.positive_signals.slice(0, 5)) {
      console.log(`   "${signal.term}"`);
      console.log(`     ICP: ${signal.positive_pct.toFixed(0)}% | Non-ICP: ${signal.negative_pct.toFixed(0)}% | Lift: ${signal.lift.toFixed(1)}x`);
    }
  }

  // Print top clusters
  if (results.signal_analysis.concept_clusters.length > 0) {
    console.log('\n📦 TOP CONCEPT CLUSTERS:');
    for (const cluster of results.signal_analysis.concept_clusters.slice(0, 3)) {
      console.log(`   ${cluster.concept.toUpperCase()}: "${cluster.representative}"`);
      console.log(`     Avg Lift: ${cluster.avg_lift.toFixed(1)}x | Phrases: ${cluster.phrases.length}`);
    }
  }

  console.log('\n✅ ICP Signal Discovery complete!');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
