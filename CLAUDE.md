# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fire Enrich is an AI-powered data enrichment platform that transforms email lists into rich company datasets. It uses a sophisticated multi-agent architecture powered by Firecrawl (web scraping) and OpenAI GPT-5 (data extraction).

## Development Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack (localhost:3000)

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint

# Troubleshooting
rm -rf .next         # Clear Next.js build cache if you encounter errors
npm install          # Fix @next/swc dependencies if warned
```

## Requirements

**Node.js Version**: **v22.x required** (Next.js 15 is NOT compatible with Node.js v25)

If you see errors like:
- `localStorage.getItem is not a function`
- `--localstorage-file was provided without a valid path`

These indicate Node.js v25 is being used. Downgrade to Node.js v22:
```bash
nvm install 22
nvm use 22
# or
conda install -c conda-forge nodejs=22
```

## Environment Setup

Required environment variables in `.env.local`:

```bash
FIRECRAWL_API_KEY=fc-...           # Required: Firecrawl API for web scraping
OPENAI_API_KEY=sk-...              # Required: OpenAI API (GPT-5)
FIRE_ENRICH_UNLIMITED=true         # Optional: Removes row/field limits
NODE_ENV=development               # Auto-enables unlimited mode
```

## Architecture Overview

### Multi-Agent System (Sequential Execution)

The core enrichment pipeline uses specialized agents that execute **sequentially** with each agent building on previous discoveries:

**Agent Execution Flow:**
```
Discovery Agent → Company Profile Agent → Metrics Agent → Funding Agent → Tech Stack Agent → General Agent
```

**Why Sequential?**
- Each agent needs context from previous agents to make accurate searches
- Example: Finding funding data is more accurate when you know the company name and industry
- Within each agent, searches run in parallel for speed

### Core Files

**Agent Orchestrator** (`/lib/agent-architecture/orchestrator.ts` - 2,193 lines)
- Brain of the system - coordinates all agents
- Categorizes requested fields and routes them to appropriate agents
- Manages progressive context building across agent phases
- Implements rolling concurrency (processes 10 rows simultaneously)

**Specialized Agents** (`/lib/agent-architecture/agents/`)
- `discovery-agent.ts` - Identifies company from email domain (Phase 1)
- `company-profile-agent.ts` - Industry, location, year founded (Phase 2)
- `metrics-agent.ts` - Employee count, revenue (Phase 3)
- `funding-agent.ts` - Funding stage, investors, total raised (Phase 4)
- `tech-stack-agent.ts` - Technologies, GitHub repos, programming languages (Phase 5)
- `general-agent.ts` - Handles custom user-defined fields (Phase 6)

**Agent Tools** (`/lib/agent-architecture/tools/`)
- `smart-search-tool.ts` - Intelligent Firecrawl search with query enhancement
- `website-scraper-tool.ts` - Direct URL scraping via Firecrawl
- `email-parser-tool.ts` - Domain extraction from emails

**Services** (`/lib/services/`)
- `openai.ts` (1,083 lines) - GPT-5 integration with Zod schemas, evidence corroboration
- `firecrawl.ts` (163 lines) - Web scraping API with retry logic and SSL error handling

**API Routes** (`/app/api/`)
- `enrich/route.ts` - Main enrichment endpoint with Server-Sent Events (SSE) streaming
- `chat/route.ts` - AI chat interface for querying enriched data
- `scrape/route.ts` - Direct URL scraping endpoint
- `generate-fields/route.ts` - AI-powered field generation

### Data Flow

```
1. User uploads CSV with emails
2. User selects enrichment fields
3. POST /api/enrich streams SSE responses
4. For each row (10 concurrent):
   a. Email parser extracts domain
   b. AgentOrchestrator categorizes fields
   c. Agents execute sequentially:
      - Each agent receives context from previous agents
      - Generates 2-3 targeted search queries
      - Runs parallel Firecrawl searches
      - Extracts structured data via GPT-5 with Zod schemas
      - Validates evidence against source text
      - Returns results with confidence scores
   d. Results streamed to client via SSE
5. UI displays real-time updates
```

## Configuration

**Concurrency Settings** (`/lib/config/enrichment.ts`)
```typescript
CONCURRENT_ROWS: 10        // Process 10 rows in parallel
BATCH_DELAY_MS: 1000      // 1s delay between batches
```

**UI Limits** (`/app/fire-enrich/config.ts`)
```typescript
// Development = unlimited, production = limited
MAX_ROWS: Infinity (dev) / 15 (prod)
MAX_COLUMNS: Infinity (dev) / 5 (prod)
MAX_FIELDS_PER_ENRICHMENT: 50 (dev) / 10 (prod)
```

## Key Implementation Details

### Agent Coordination Pattern

Each agent follows this execution pattern:
1. Receives `OrchestrationContext` with data from previous agents
2. Generates search queries enhanced with context (e.g., adding company name to funding searches)
3. Executes parallel Firecrawl searches (typically 2-3 queries per agent)
4. Ranks results by relevance using scoring algorithm
5. Extracts structured data via GPT-5 with Zod schema validation
6. Validates extracted values exist in source text (evidence corroboration)
7. Returns `EnrichmentResult[]` with confidence scores and source citations
8. Updates shared context for next agent

### Field Categorization System

The orchestrator automatically routes fields to specialized agents based on keywords:
- Discovery: "company name", "website", "description"
- Profile: "industry", "headquarter", "location", "year founded"
- Metrics: "employee", "revenue", "headcount"
- Funding: "fund", "invest", "series", "valuation", "raised"
- Tech Stack: "tech" + "stack", "github", "programming language"
- General: Everything else (custom fields)

### Evidence Corroboration

OpenAI extraction includes evidence validation:
1. GPT-5 extracts data with source snippets
2. Filter invalid evidence (empty, page titles, hallucinated URLs)
3. Validate snippet contains exact value match
4. Calculate confidence based on source consensus
5. Reduce confidence if evidence is weak or conflicting

### GPT-5 Usage

This project uses OpenAI's latest GPT-5 models:
- `gpt-5` - Main orchestrator and extraction (most agents)
- `gpt-5-mini` - Simpler tasks (field generation, basic extraction)

**NOT GPT-4** - The codebase has been upgraded to use GPT-5 throughout.

## Styling System

### Design System (.cursor/rules)

**Color System** (P3 color space with sRGB fallbacks):
- Heat colors: `--heat-4` through `--heat-100` (fire orange shades)
- Accent colors: `--accent-black`, `--accent-amethyst`, `--accent-bluetron`, `--accent-crimson`
- All colors have browser fallbacks

**Typography**:
- Display: SuisseIntl (400, 450, 500, 600, 700)
- Mono: System monospace stack
- Type scale: `.title-h1` through `.title-h5`, `.body-*`, `.label-*`, `.mono-*`

**Component CSS** (`styles/components/`):
- Only create CSS files for components that need them
- Prefix component classes (e.g., `.button-primary`, `.modal-backdrop`)
- Keep animations performant (use transform/opacity)
- Use P3 colors with sRGB fallbacks

### Styling Guidelines

1. For most components, use Tailwind utilities
2. For custom effects (fire shadows, complex animations), create component CSS
3. Import component CSS in `styles/main.css`
4. Use Radix UI primitives (49 components available)

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI, Framer Motion
- **AI/Data**: OpenAI SDK (GPT-5), Firecrawl JS SDK, Zod, LangChain/LangGraph
- **Validation**: React Hook Form, Zod schemas
- **Data Processing**: PapaParse (CSV), nanoid, lodash-es

## Adding New Features

### Creating a New Agent

1. Create agent file in `/lib/agent-architecture/agents/`
2. Define Zod schema for structured output
3. Implement agent interface (search query generation + extraction)
4. Update orchestrator to route fields to new agent

### Adding Fields to Existing Agents

Modify the Zod schema in the agent file:
```typescript
const FundingResult = z.object({
  fundingStage: z.string().optional(),
  totalRaised: z.string().optional(),
  // Add new field:
  debtFinancing: z.string().optional(),
});
```

### Modifying Field Routing

Edit `categorizeFields()` in `/lib/agent-architecture/orchestrator.ts`:
```typescript
if (fieldName.includes('your-keyword')) {
  categories.yourCategory.push(field);
}
```

## Important Notes

- **Skip List**: Automatically filters personal emails (Gmail, Yahoo, etc.) to save API costs
- **SSE Streaming**: All enrichment progress uses Server-Sent Events for real-time updates
- **Type Safety**: Zod schemas ensure type-safe data extraction throughout
- **Source Citations**: Every enrichment includes source URLs and evidence snippets
- **Confidence Scores**: Each field includes a 0-1 confidence rating
- **Rolling Concurrency**: Starts new row enrichments as others complete (maintains 10 active rows)
