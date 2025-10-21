# Suggested README Updates for Custom Base URL Feature

## 1. Update to the "Quick Start" section (line 26-36)

Replace the current Quick Start code block with:

```markdown
### Quick Start

1. Clone this repository
2. Create a `.env.local` file with your API keys:
   ```
   FIRECRAWL_API_KEY=your_firecrawl_key
   OPENAI_API_KEY=your_openai_key

   # Optional: Use OpenAI-compatible endpoints (Azure OpenAI, local LLMs, etc.)
   # OPENAI_BASE_URL=https://your-custom-endpoint.com/v1
   ```
3. Install dependencies: `npm install` or `yarn install`
4. Run the development server: `npm run dev` or `yarn dev`
5. Open [http://localhost:3000](http://localhost:3000)
```

## 2. New section to add after "Quick Start" (insert after line 36)

```markdown
### Using OpenAI-Compatible Endpoints

Fire Enrich supports any OpenAI-compatible API endpoint, giving you flexibility to use different LLM providers:

#### Supported Providers

- **Azure OpenAI Service**: Enterprise-grade OpenAI models with Azure infrastructure
- **Local LLM Servers**: Run models locally using tools like [LM Studio](https://lmstudio.ai/), [Ollama](https://ollama.ai/) (with OpenAI compatibility), or [vLLM](https://github.com/vllm-project/vllm)
- **Alternative Providers**: Any service that implements the OpenAI API specification

#### Configuration Methods

**Method 1: Environment Variable** (Recommended for permanent setup)

Add to your `.env.local` file:
```env
OPENAI_BASE_URL=https://your-custom-endpoint.com/v1
```

**Method 2: HTTP Header** (Useful for per-request overrides)

When making API requests to Fire Enrich endpoints, include:
```bash
curl -X POST http://localhost:3000/api/enrich \
  -H "X-OpenAI-Base-URL: https://your-custom-endpoint.com/v1" \
  -H "X-OpenAI-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"rows": [...], "fields": [...]}'
```

#### Example Configurations

**Azure OpenAI:**
```env
OPENAI_BASE_URL=https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name
OPENAI_API_KEY=your-azure-api-key
```

**Local LM Studio:**
```env
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio  # LM Studio doesn't require a real key
```

**Ollama (with OpenAI compatibility):**
```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama  # Ollama doesn't require a real key
```

#### Notes

- If `OPENAI_BASE_URL` is not set, Fire Enrich uses the default OpenAI endpoint
- The base URL should include the `/v1` path if required by your provider
- Ensure your custom endpoint is compatible with OpenAI's chat completions API
- Fire Enrich uses `gpt-5` and `gpt-5-mini` model names - your endpoint must support these or map them to equivalent models

#### Model Compatibility

Fire Enrich is optimized for the following models:
- **Primary**: `gpt-5` (used for main extraction, search queries, and response generation)
- **Secondary**: `gpt-5-mini` (used for lighter tasks like field generation and source selection)

If using a custom endpoint, ensure these model names are available or configure your endpoint to map them to equivalent models (e.g., `gpt-4o`, `gpt-4o-mini` for current OpenAI models, or local model names for self-hosted solutions).
```

## 3. Alternative: Shorter version (if you prefer brevity)

If the above is too detailed, here's a more concise version to add after "Quick Start":

```markdown
### Using Custom OpenAI Endpoints

Fire Enrich works with any OpenAI-compatible API, including Azure OpenAI and local LLM servers:

```env
# Optional: Point to a custom OpenAI-compatible endpoint
OPENAI_BASE_URL=https://your-endpoint.com/v1
```

**Popular alternatives:**
- **Azure OpenAI**: `https://your-resource.openai.azure.com/openai/deployments/your-deployment`
- **Local LM Studio**: `http://localhost:1234/v1`
- **Ollama**: `http://localhost:11434/v1`

You can also override the base URL per-request using the `X-OpenAI-Base-URL` HTTP header.

> **Note**: Fire Enrich uses `gpt-5` and `gpt-5-mini` model names. Ensure your endpoint supports these or maps them to equivalent models.
```

## Placement Recommendation

Insert the new section immediately after the "Quick Start" section (after line 36 in the current README), before the "Example Enrichment" section. This keeps all setup-related information together and flows naturally from installation to configuration to usage examples.
