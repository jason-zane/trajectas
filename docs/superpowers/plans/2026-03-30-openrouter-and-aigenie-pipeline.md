# OpenRouter Integration + AI-GENIE Pipeline Completion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all AI calls through OpenRouter with task-based model routing, then implement the real AI-GENIE item generation pipeline (pre-flight analysis, LLM generation, embeddings, and TypeScript network psychometrics).

**Architecture:** A single `OpenRouterProvider` routes all AI requests via the `openai` SDK with a custom `baseURL`. A `getModelForTask(purpose)` resolver looks up `ai_model_configs` to pick the right model per task type. The generation pipeline runs server-side: embed construct definitions → LLM discrimination check → generate items in batches → embed items → build threshold network → UVA redundancy removal → bootEGA stability → review-ready.

**Tech Stack:** OpenRouter API (OpenAI-compatible), `openai` npm package, Supabase, Next.js server actions, pure TypeScript network algorithms (cosine similarity, adaptive threshold network, Walktrap community detection, NMI/AMI, wTO, bootstrap EGA, leakage detection).

---

## Codebase Context (read before implementing)

- **Provider abstraction:** `src/lib/ai/providers/base.ts` — `AIProvider` interface with `complete()` and `isAvailable()`
- **Provider registry:** `src/lib/ai/providers/index.ts` — `Map<AIProviderType, AIProvider>`, pre-registers Anthropic + OpenAI; OpenRouter is exported but NOT registered yet
- **Matching engine:** `src/lib/ai/matching/engine.ts` — uses `getDefaultProvider()` or `options.providerId`; `modelId` option exists but is unused ("reserved for future use")
- **Types:** `src/types/ai.ts` — `AIModelRequest` has no `model` field; `AIProviderType = 'anthropic' | 'openai' | 'custom'`
- **`AIPromptPurpose`** is defined in `src/types/database.ts` (NOT `src/types/ai.ts`) as `'competency_matching' | 'ranking_explanation' | 'diagnostic_analysis'`
- **DB tables:** `ai_providers` (id, name, api_key_env_var, base_url, is_active) and `ai_model_configs` (id, provider_id, model_id, display_name, is_default, config JSONB) — no `purpose` column yet on `ai_model_configs`; unique constraint is `UNIQUE (provider_id, model_id)` — we must add a new `UNIQUE (provider_id, purpose)` constraint for idempotent seeding
- **Generation (mock):** `src/lib/ai/generation/pipeline-mock.ts` exists but `startGenerationRun` does NOT call it — it has an entirely inline mock using a local `insertMockGeneratedItems()` DB helper. Task 12 must gut `startGenerationRun`'s body and replace it, keeping `insertMockGeneratedItems` as the offline fallback path.
- **Unused packages:** `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, `@ai-sdk/openai` — installed but not used anywhere. Keep `openai` (used by OpenRouter provider) and `@anthropic-ai/sdk` (used by AnthropicProvider).
- **Env var:** `OpenRouter_API_KEY` (mixed case — this exact casing is used in `openrouter.ts`)

---

## File Map

### New Files
| File | Responsibility |
|------|----------------|
| `src/lib/ai/model-resolver.ts` | `getModelForTask(purpose)` — DB lookup with hardcoded fallback |
| `src/lib/ai/generation/embeddings.ts` | Embed text arrays via OpenRouter `text-embedding-3-small` |
| `src/lib/ai/generation/prompts/item-generation.ts` | System + user prompt templates for item generation |
| `src/lib/ai/generation/prompts/construct-discrimination.ts` | Pre-flight prompt templates |
| `src/lib/ai/generation/construct-preflight.ts` | Pre-flight orchestrator: embed → cosine → LLM discrimination check |
| `src/lib/ai/generation/pipeline.ts` | Real 7-step pipeline orchestrator |
| `src/lib/ai/generation/network/correlation.ts` | Pairwise cosine similarity matrix from embedding vectors |
| `src/lib/ai/generation/network/network-builder.ts` | Adaptive threshold network from correlation matrix |
| `src/lib/ai/generation/network/walktrap.ts` | Random-walk community detection |
| `src/lib/ai/generation/network/nmi.ts` | Normalised Mutual Information (NMI) + Adjusted MI (AMI) |
| `src/lib/ai/generation/network/wto.ts` | Weighted Topological Overlap — redundancy detection |
| `src/lib/ai/generation/network/bootstrap.ts` | bootEGA: 100-sample bootstrap stability |
| `src/lib/ai/generation/network/leakage.ts` | Cross-construct item leakage detection |
| `src/lib/ai/generation/network/index.ts` | `NetworkAnalyzerImpl` + barrel export |
| `supabase/migrations/00033_openrouter_model_configs.sql` | Add `purpose` column + seed OpenRouter provider + model configs |

### Modified Files
| File | Change |
|------|--------|
| `src/types/ai.ts` | Add `model?: string` to `AIModelRequest` |
| `src/types/database.ts` | Add `'item_generation' \| 'preflight_analysis'` to `AIPromptPurpose` |
| `src/lib/ai/providers/openrouter.ts` | Add `HTTP-Referer` + `X-Title` headers; use `request.model ?? DEFAULT_MODEL` in `complete()` |
| `src/lib/ai/providers/index.ts` | Register `openRouterProvider` as first entry (so it becomes `getDefaultProvider()` result) |
| `src/lib/ai/matching/engine.ts` | Import `getModelForTask`; resolve model via `getModelForTask('competency_matching')` before calling `complete()` |
| `src/lib/ai/generation/index.ts` | Export real pipeline, embeddings, pre-flight |
| `src/app/actions/generation.ts` | Replace mock pipeline call with real pipeline in `startGenerationRun`; move mock as fallback |
| `src/app/(dashboard)/generate/new/page.tsx` | Wire real pre-flight in Step 2 (replace static green mock) |
| `package.json` | Remove `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai` (unused Vercel AI SDK packages) |

---

## Task 1: Extend AIModelRequest + fix OpenRouter provider

**Files:**
- Modify: `src/types/ai.ts`
- Modify: `src/lib/ai/providers/openrouter.ts`

- [ ] Read `src/types/ai.ts`. In the `AIModelRequest` interface, add:
  ```typescript
  /**
   * Optional model override. When provided, the provider uses this model
   * instead of its configured default. Use OpenRouter model IDs e.g. "anthropic/claude-sonnet-4-5".
   */
  model?: string
  ```

- [ ] Read `src/lib/ai/providers/openrouter.ts`. In `getClient()`, add `defaultHeaders` to the OpenAI constructor:
  ```typescript
  this.client = new OpenAI({
    apiKey: process.env.OpenRouter_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://talent-fit.app',
      'X-Title': 'Talent Fit',
    },
  })
  ```

- [ ] In the same file, update `complete()` to use `request.model`:
  ```typescript
  const response = await client.chat.completions.create({
    model: request.model ?? DEFAULT_MODEL,
    messages,
    // ...rest unchanged
  })
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/types/ai.ts src/lib/ai/providers/openrouter.ts
  git commit -m "feat: add model field to AIModelRequest + OpenRouter attribution headers"
  ```

---

## Task 2: Migration — ai_model_configs purpose column + seed data

**Files:**
- Create: `supabase/migrations/00033_openrouter_model_configs.sql`
- Modify: `src/types/database.ts`

- [ ] Read `supabase/migrations/00001_initial_schema.sql` to confirm exact column names of `ai_providers` and `ai_model_configs`.

- [ ] Create `supabase/migrations/00033_openrouter_model_configs.sql`:

  ```sql
  BEGIN;

  -- =========================================================================
  -- 00033_openrouter_model_configs.sql
  -- Add purpose column to ai_model_configs + seed OpenRouter provider/models
  -- =========================================================================

  -- 1. Add purpose column (nullable — existing rows have no purpose)
  ALTER TABLE ai_model_configs
    ADD COLUMN IF NOT EXISTS purpose TEXT;

  CREATE INDEX IF NOT EXISTS idx_ai_model_configs_purpose
    ON ai_model_configs(purpose)
    WHERE purpose IS NOT NULL;

  -- 2. Insert OpenRouter provider (idempotent via ON CONFLICT)
  INSERT INTO ai_providers (name, api_key_env_var, base_url, is_active)
  VALUES (
    'OpenRouter',
    'OpenRouter_API_KEY',
    'https://openrouter.ai/api/v1',
    true
  )
  ON CONFLICT (name) DO UPDATE SET
    api_key_env_var = EXCLUDED.api_key_env_var,
    base_url        = EXCLUDED.base_url,
    is_active       = EXCLUDED.is_active;

  -- 3b. Add UNIQUE constraint so ON CONFLICT (provider_id, purpose) works for idempotent seeding
  ALTER TABLE ai_model_configs
    DROP CONSTRAINT IF EXISTS ai_model_configs_provider_purpose_unique;

  ALTER TABLE ai_model_configs
    ADD CONSTRAINT ai_model_configs_provider_purpose_unique
    UNIQUE (provider_id, purpose);

  -- 4. Seed model configs for each task purpose
  --    Uses a CTE to get the provider id without knowing it ahead of time.
  WITH provider AS (
    SELECT id FROM ai_providers WHERE name = 'OpenRouter'
  )
  INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, purpose, config)
  SELECT
    provider.id,
    t.model_id,
    t.display_name,
    t.is_default,
    t.purpose,
    t.config
  FROM provider,
  (VALUES
    ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Matching',     true,  'competency_matching',  '{"temperature": 0.3, "max_tokens": 4096}'::jsonb),
    ('google/gemini-2.0-flash-001',      'Gemini 2.0 Flash — Ranking',       true,  'ranking_explanation',  '{"temperature": 0.5, "max_tokens": 2048}'::jsonb),
    ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Diagnostic',   true,  'diagnostic_analysis',  '{"temperature": 0.3, "max_tokens": 4096}'::jsonb),
    ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Items',        true,  'item_generation',      '{"temperature": 0.8, "max_tokens": 4096}'::jsonb),
    ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Pre-flight',   true,  'preflight_analysis',   '{"temperature": 0.3, "max_tokens": 2048}'::jsonb)
  ) AS t(model_id, display_name, is_default, purpose, config)
  ON CONFLICT (provider_id, purpose) DO NOTHING;

  COMMIT;
  ```

- [ ] In `src/types/database.ts`, extend `AIPromptPurpose` (this type lives in `database.ts`, NOT `ai.ts`):
  ```typescript
  export type AIPromptPurpose =
    | 'competency_matching'
    | 'ranking_explanation'
    | 'diagnostic_analysis'
    | 'item_generation'
    | 'preflight_analysis'
  ```

- [ ] Run `npm run db:push` — expect migration applied.
- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add supabase/migrations/00033_openrouter_model_configs.sql src/types/database.ts
  git commit -m "feat: add purpose column to ai_model_configs + seed OpenRouter provider/models"
  ```

---

## Task 3: Model resolver + wire matching engine + register OpenRouter

**Files:**
- Create: `src/lib/ai/model-resolver.ts`
- Modify: `src/lib/ai/matching/engine.ts`
- Modify: `src/lib/ai/providers/index.ts`

- [ ] Read `src/lib/ai/matching/engine.ts` (full file) and `src/lib/ai/providers/index.ts` (full file).

- [ ] Create `src/lib/ai/model-resolver.ts`:

  ```typescript
  /**
   * model-resolver.ts
   *
   * Resolves the correct model ID and config for a given AI task purpose.
   * Reads from ai_model_configs (is_default = true, purpose = X).
   * Falls back to hardcoded defaults when the DB has no config for a purpose.
   */
  import { createAdminClient } from '@/lib/supabase/admin'
  import type { AIPromptPurpose } from '@/types/database'

  const FALLBACK_MODELS: Record<AIPromptPurpose, { model: string; temperature: number; maxTokens: number }> = {
    competency_matching:  { model: 'anthropic/claude-sonnet-4-5', temperature: 0.3,  maxTokens: 4096 },
    ranking_explanation:  { model: 'google/gemini-2.0-flash-001', temperature: 0.5,  maxTokens: 2048 },
    diagnostic_analysis:  { model: 'anthropic/claude-sonnet-4-5', temperature: 0.3,  maxTokens: 4096 },
    item_generation:      { model: 'anthropic/claude-sonnet-4-5', temperature: 0.8,  maxTokens: 4096 },
    preflight_analysis:   { model: 'anthropic/claude-sonnet-4-5', temperature: 0.3,  maxTokens: 2048 },
  }

  export interface ModelConfig {
    model: string
    temperature: number
    maxTokens: number
  }

  /**
   * Returns the model + config to use for a given task purpose.
   * Queries ai_model_configs for a row where purpose = X and is_default = true.
   * Falls back to FALLBACK_MODELS on DB error or missing row.
   */
  export async function getModelForTask(purpose: AIPromptPurpose): Promise<ModelConfig> {
    try {
      const db = createAdminClient()
      const { data, error } = await db
        .from('ai_model_configs')
        .select('model_id, config')
        .eq('purpose', purpose)
        .eq('is_default', true)
        .limit(1)
        .single()

      if (error || !data) return FALLBACK_MODELS[purpose]

      const config = data.config as { temperature?: number; max_tokens?: number } | null
      return {
        model:       data.model_id,
        temperature: config?.temperature ?? FALLBACK_MODELS[purpose].temperature,
        maxTokens:   config?.max_tokens  ?? FALLBACK_MODELS[purpose].maxTokens,
      }
    } catch {
      return FALLBACK_MODELS[purpose]
    }
  }
  ```

- [ ] In `src/lib/ai/matching/engine.ts`, import `getModelForTask` and update the provider resolution block. Find where `provider.complete()` is called and replace the hardcoded temperature/maxTokens with values from the resolver. Pass `model` from resolver result into the request. Keep `options.providerId` override path working (use OpenRouter provider regardless, just override the model if specified).

  The key change: before calling `provider.complete()`, call:
  ```typescript
  const modelConfig = await getModelForTask('competency_matching')
  ```
  Then pass `model: modelConfig.model`, `temperature: modelConfig.temperature`, `maxTokens: modelConfig.maxTokens` into the request (these become overrides — existing hardcoded values in the engine should be replaced with these).

- [ ] In `src/lib/ai/providers/index.ts`, read the file first. The file already imports `OpenRouterProvider` and exports `openRouterProvider` but does NOT register it. Add the `openRouterProvider` import (it's already re-exported; just add the import for use in registry setup), then insert `registry.set('custom', openRouterProvider)` as the **first** `registry.set(...)` call — before the existing `registry.set('anthropic', new AnthropicProvider())` and `registry.set('openai', new OpenAIProvider())` lines.

  The `getDefaultProvider()` function iterates `registry.values()` — Maps preserve insertion order, so OpenRouter wins by being first.

  The result should look like:
  ```typescript
  import { openRouterProvider } from './openrouter'
  // ...existing imports (AnthropicProvider, OpenAIProvider, etc.)...

  const registry = new Map<AIProviderType, AIProvider>()

  // OpenRouter FIRST so it wins getDefaultProvider():
  registry.set('custom', openRouterProvider)
  registry.set('anthropic', new AnthropicProvider())
  registry.set('openai', new OpenAIProvider())
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/lib/ai/model-resolver.ts src/lib/ai/matching/engine.ts src/lib/ai/providers/index.ts
  git commit -m "feat: task-based model resolver + register OpenRouter as default provider"
  ```

---

## Task 4: Remove unused Vercel AI SDK packages

**Files:**
- Modify: `package.json`

- [ ] Run:
  ```bash
  npm uninstall ai @ai-sdk/anthropic @ai-sdk/openai
  ```

- [ ] Verify no imports of these packages remain:
  ```bash
  grep -r "from 'ai'" src/ --include="*.ts" --include="*.tsx"
  grep -r "from '@ai-sdk/" src/ --include="*.ts" --include="*.tsx"
  ```
  Expect: no matches.

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: remove unused Vercel AI SDK packages (ai, @ai-sdk/anthropic, @ai-sdk/openai)"
  ```

---

## Task 5: Pre-flight prompt templates + construct-preflight orchestrator

**Files:**
- Create: `src/lib/ai/generation/prompts/construct-discrimination.ts`
- Create: `src/lib/ai/generation/construct-preflight.ts`

**Context:** The pre-flight check runs before item generation. It embeds construct definitions, computes pairwise cosine similarity, and for any pair with similarity > 0.75 asks the LLM to generate discriminating example items. If the LLM cannot produce clearly discriminating items, the pair is flagged red.

- [ ] Create `src/lib/ai/generation/prompts/construct-discrimination.ts`:

  ```typescript
  export const DISCRIMINATION_SYSTEM_PROMPT = `You are an expert psychometrician. Your task is to assess whether two psychological constructs are sufficiently distinct to support independent self-report item development.`

  export function buildDiscriminationPrompt(
    constructA: { name: string; definition: string },
    constructB: { name: string; definition: string },
  ): string {
    return `Assess whether these two constructs can produce clearly discriminating self-report items.

  ## Construct A: ${constructA.name}
  Definition: ${constructA.definition}

  ## Construct B: ${constructB.name}
  Definition: ${constructB.definition}

  Generate 3 example items that would ONLY belong to Construct A and not B, and 3 that would ONLY belong to Construct B and not A.
  If you cannot produce clearly discriminating items, explain why.

  Respond in JSON:
  {
    "canDiscriminate": true | false,
    "itemsForA": ["item1", "item2", "item3"],
    "itemsForB": ["item1", "item2", "item3"],
    "explanation": "brief explanation"
  }`
  }
  ```

- [ ] Create `src/lib/ai/generation/construct-preflight.ts`:

  ```typescript
  /**
   * construct-preflight.ts
   *
   * Step 0 of the AI-GENIE pipeline.
   * 1. Embeds construct definitions using text-embedding-3-small
   * 2. Computes pairwise cosine similarity between definition embeddings
   * 3. For pairs with similarity > 0.75, runs LLM discrimination check
   * 4. Returns PreflightResult with green/amber/red status per pair
   */
  import { embedTexts } from './embeddings'
  import { openRouterProvider } from '@/lib/ai/providers/openrouter'
  import { getModelForTask } from '@/lib/ai/model-resolver'
  import { DISCRIMINATION_SYSTEM_PROMPT, buildDiscriminationPrompt } from './prompts/construct-discrimination'
  import type { ConstructForGeneration } from '@/types/generation'
  import type { PreflightResult, ConstructPairResult } from '@/types/generation'

  const SIMILARITY_THRESHOLD = 0.75

  function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  export async function runConstructPreflight(
    constructs: ConstructForGeneration[],
  ): Promise<PreflightResult> {
    if (constructs.length < 2) {
      return { pairs: [], overallStatus: 'green' }
    }

    // 1. Embed all definitions
    const texts = constructs.map(c =>
      [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
    )
    const embeddings = await embedTexts(texts)

    // 2. Pairwise similarity
    const pairs: ConstructPairResult[] = []
    for (let i = 0; i < constructs.length; i++) {
      for (let j = i + 1; j < constructs.length; j++) {
        const similarity = cosineSimilarity(embeddings[i], embeddings[j])
        if (similarity <= SIMILARITY_THRESHOLD) {
          pairs.push({
            constructAId: constructs[i].id,
            constructAName: constructs[i].name,
            constructBId: constructs[j].id,
            constructBName: constructs[j].name,
            cosineSimilarity: similarity,
            status: 'green',
          })
          continue
        }

        // 3. LLM discrimination check for similar pairs
        const modelConfig = await getModelForTask('preflight_analysis')
        let pairResult: ConstructPairResult
        try {
          const response = await openRouterProvider.complete({
            model:          modelConfig.model,
            systemPrompt:   DISCRIMINATION_SYSTEM_PROMPT,
            prompt:         buildDiscriminationPrompt(
                              { name: constructs[i].name, definition: constructs[i].definition ?? constructs[i].name },
                              { name: constructs[j].name, definition: constructs[j].definition ?? constructs[j].name },
                            ),
            temperature:    modelConfig.temperature,
            maxTokens:      modelConfig.maxTokens,
            responseFormat: 'json',
          })

          const parsed = JSON.parse(response.content) as {
            canDiscriminate: boolean
            itemsForA: string[]
            itemsForB: string[]
            explanation: string
          }

          pairResult = {
            constructAId:          constructs[i].id,
            constructAName:        constructs[i].name,
            constructBId:          constructs[j].id,
            constructBName:        constructs[j].name,
            cosineSimilarity:      similarity,
            status:                parsed.canDiscriminate ? 'amber' : 'red',
            discriminatingItemsA:  parsed.itemsForA ?? [],
            discriminatingItemsB:  parsed.itemsForB ?? [],
            llmExplanation:        parsed.explanation,
          }
        } catch {
          pairResult = {
            constructAId:     constructs[i].id,
            constructAName:   constructs[i].name,
            constructBId:     constructs[j].id,
            constructBName:   constructs[j].name,
            cosineSimilarity: similarity,
            status:           'amber',
            llmExplanation:   'Could not complete discrimination check',
          }
        }
        pairs.push(pairResult)
      }
    }

    const overallStatus = pairs.some(p => p.status === 'red')
      ? 'red'
      : pairs.some(p => p.status === 'amber')
        ? 'amber'
        : 'green'

    return { pairs, overallStatus }
  }
  ```

- [ ] Run `npx tsc --noEmit` — expect clean (embeddings.ts doesn't exist yet, so expect a missing module error — that's Task 6, note it and proceed).

  **Note:** If TS errors on missing `./embeddings`, stub the module temporarily or proceed to Task 6 first.

- [ ] Commit after Task 6 makes it clean.

---

## Task 6: Embeddings utility

**Files:**
- Create: `src/lib/ai/generation/embeddings.ts`

**Context:** OpenRouter supports embeddings via `POST /api/v1/embeddings` (OpenAI-compatible). Use the `openai` SDK's `client.embeddings.create()`. Default model: `openai/text-embedding-3-small` (1536 dims).

- [ ] Read `src/lib/ai/providers/openrouter.ts` to understand how the OpenAI client is initialised.

- [ ] Create `src/lib/ai/generation/embeddings.ts`:

  ```typescript
  /**
   * embeddings.ts
   *
   * Embeds arrays of text via OpenRouter using text-embedding-3-small.
   * Returns a float array per input text (1536 dimensions).
   */
  import OpenAI from 'openai'

  const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
  const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
  const BATCH_SIZE = 100   // OpenRouter limit per request

  function getEmbeddingClient(): OpenAI {
    if (!process.env.OpenRouter_API_KEY) {
      throw new Error('OpenRouter_API_KEY is not set')
    }
    return new OpenAI({
      apiKey:         process.env.OpenRouter_API_KEY,
      baseURL:        OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://talent-fit.app',
        'X-Title':      'Talent Fit',
      },
    })
  }

  /**
   * Embed an array of texts. Returns a float[] per text.
   * Processes in batches of BATCH_SIZE to stay within API limits.
   */
  export async function embedTexts(
    texts: string[],
    model = EMBEDDING_MODEL,
  ): Promise<number[][]> {
    if (texts.length === 0) return []

    const client = getEmbeddingClient()
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const response = await client.embeddings.create({
        model,
        input: batch,
      })
      // OpenAI SDK returns embeddings sorted by index
      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding)
      results.push(...batchEmbeddings)
    }

    return results
  }

  /**
   * Embed a single text string.
   */
  export async function embedText(text: string, model = EMBEDDING_MODEL): Promise<number[]> {
    const results = await embedTexts([text], model)
    return results[0] ?? []
  }
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit tasks 5 + 6 together:
  ```bash
  git add src/lib/ai/generation/prompts/construct-discrimination.ts \
          src/lib/ai/generation/construct-preflight.ts \
          src/lib/ai/generation/embeddings.ts
  git commit -m "feat: pre-flight construct analysis + embeddings utility"
  ```

---

## Task 7: Item generation prompt templates + LLM generation logic

**Files:**
- Create: `src/lib/ai/generation/prompts/item-generation.ts`

**Context:** Items are generated in batches of 20. Each batch includes all previously generated items in the prompt to avoid duplication. The system prompt establishes a psychometrician persona.

- [ ] Create `src/lib/ai/generation/prompts/item-generation.ts`:

  ```typescript
  import type { ConstructForGeneration } from '@/types/generation'

  export const ITEM_GENERATION_SYSTEM_PROMPT = `You are an expert psychometrician with 20+ years of experience in personality and organisational assessment. You specialise in writing high-quality psychometric items that:
  - Capture individual differences in the target construct
  - Avoid double-barrelled phrasing (one idea per item)
  - Use clear, accessible language (8th grade reading level)
  - Include a mix of positively and negatively keyed items (~60/40 split)
  - Are culturally neutral and avoid idioms or region-specific references
  - Produce adequate variance across the response scale

  Always respond with valid JSON only. No markdown, no explanation outside the JSON array.`

  export function buildItemGenerationPrompt(params: {
    construct:        ConstructForGeneration
    batchSize:        number
    responseFormatDescription: string
    previousItems:    string[]
  }): string {
    const { construct, batchSize, responseFormatDescription, previousItems } = params

    const indicatorSection = [
      construct.indicatorsLow  ? `Low scorers: ${construct.indicatorsLow}`  : null,
      construct.indicatorsMid  ? `Mid scorers: ${construct.indicatorsMid}`  : null,
      construct.indicatorsHigh ? `High scorers: ${construct.indicatorsHigh}` : null,
    ].filter(Boolean).join('\n')

    const previousSection = previousItems.length > 0
      ? `\n## Previously generated items for this construct (do NOT repeat or closely rephrase):\n${previousItems.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : ''

    return `Generate ${batchSize} NEW psychometric items for the following construct.

  ## Construct: ${construct.name}
  ${construct.definition ? `Definition: ${construct.definition}` : ''}
  ${construct.description ? `Description: ${construct.description}` : ''}
  ${indicatorSection ? `\nBehavioural Indicators:\n${indicatorSection}` : ''}

  ## Response Format
  ${responseFormatDescription}
  ${previousSection}

  Return a JSON array of exactly ${batchSize} objects:
  [{ "stem": "...", "reverseScored": false, "rationale": "one sentence why this item captures the construct" }]`
  }

  export interface GeneratedItemRaw {
    stem:          string
    reverseScored: boolean
    rationale:     string
  }

  export function parseGeneratedItems(jsonContent: string): GeneratedItemRaw[] {
    // Strip markdown fences if present
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    const parsed = JSON.parse(cleaned) as unknown
    if (!Array.isArray(parsed)) throw new Error('Expected JSON array')

    return parsed.map((item, i) => {
      if (typeof item !== 'object' || item === null) throw new Error(`Item ${i} is not an object`)
      const obj = item as Record<string, unknown>
      return {
        stem:          String(obj.stem          ?? ''),
        reverseScored: Boolean(obj.reverseScored ?? obj.reverse_scored ?? false),
        rationale:     String(obj.rationale     ?? ''),
      }
    }).filter(item => item.stem.length > 0)
  }
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/lib/ai/generation/prompts/item-generation.ts
  git commit -m "feat: item generation prompt templates with adaptive batching support"
  ```

---

## Task 8: Network algorithms — correlation matrix + network builder

**Files:**
- Create: `src/lib/ai/generation/network/correlation.ts`
- Create: `src/lib/ai/generation/network/network-builder.ts`

- [ ] Create `src/lib/ai/generation/network/correlation.ts`:

  ```typescript
  /**
   * correlation.ts
   * Computes a pairwise cosine similarity matrix from embedding vectors.
   * Returns an n×n matrix where entry [i][j] = cosine similarity of items i and j.
   */

  export function cosineSimilarityMatrix(embeddings: number[][]): number[][] {
    const n = embeddings.length
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])

    // Pre-compute norms
    const norms = embeddings.map(e => Math.sqrt(e.reduce((s, v) => s + v * v, 0)))

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1
      for (let j = i + 1; j < n; j++) {
        if (norms[i] === 0 || norms[j] === 0) { matrix[i][j] = matrix[j][i] = 0; continue }
        let dot = 0
        for (let k = 0; k < embeddings[i].length; k++) {
          dot += embeddings[i][k] * embeddings[j][k]
        }
        const sim = dot / (norms[i] * norms[j])
        matrix[i][j] = matrix[j][i] = sim
      }
    }
    return matrix
  }
  ```

- [ ] Create `src/lib/ai/generation/network/network-builder.ts`:

  ```typescript
  /**
   * network-builder.ts
   *
   * Builds an unweighted adjacency matrix from a correlation matrix using an
   * adaptive threshold. Starting at 0.3, the threshold is adjusted up if the
   * network is too dense (>50% possible edges) or down if too sparse
   * (disconnected components exist).
   *
   * Returns the adjacency matrix and the chosen threshold.
   */
  import type { AdjacencyMatrix } from '@/types/generation'

  export interface NetworkResult {
    adjacency:  AdjacencyMatrix
    threshold:  number
    edgeCount:  number
  }

  export function buildNetwork(
    correlationMatrix: number[][],
    initialThreshold = 0.3,
  ): NetworkResult {
    const n = correlationMatrix.length
    const maxEdges = (n * (n - 1)) / 2

    let threshold = initialThreshold
    let adjacency = applyThreshold(correlationMatrix, threshold)

    // Adjust threshold to avoid extremes
    for (let attempt = 0; attempt < 10; attempt++) {
      const edgeCount = countEdges(adjacency, n)
      const density = edgeCount / maxEdges

      if (density > 0.5) {
        threshold += 0.05
        adjacency = applyThreshold(correlationMatrix, threshold)
      } else if (!isConnected(adjacency, n) && threshold > 0.1) {
        threshold -= 0.05
        adjacency = applyThreshold(correlationMatrix, threshold)
      } else {
        break
      }
    }

    return { adjacency, threshold, edgeCount: countEdges(adjacency, n) }
  }

  function applyThreshold(matrix: number[][], threshold: number): AdjacencyMatrix {
    const n = matrix.length
    return matrix.map((row, i) =>
      row.map((val, j) => (i !== j && val >= threshold) ? 1 : 0)
    )
  }

  function countEdges(adj: AdjacencyMatrix, n: number): number {
    let count = 0
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (adj[i][j]) count++
    return count
  }

  function isConnected(adj: AdjacencyMatrix, n: number): boolean {
    if (n === 0) return true
    const visited = new Set<number>([0])
    const queue = [0]
    while (queue.length > 0) {
      const node = queue.shift()!
      for (let j = 0; j < n; j++) {
        if (adj[node][j] && !visited.has(j)) {
          visited.add(j)
          queue.push(j)
        }
      }
    }
    return visited.size === n
  }
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/lib/ai/generation/network/correlation.ts \
          src/lib/ai/generation/network/network-builder.ts
  git commit -m "feat: cosine similarity matrix + adaptive threshold network builder"
  ```

---

## Task 9: Walktrap community detection + NMI/AMI

**Files:**
- Create: `src/lib/ai/generation/network/walktrap.ts`
- Create: `src/lib/ai/generation/network/nmi.ts`

**Context:** Walktrap uses random walks to compute a distance metric between nodes, then performs Ward's agglomerative clustering. For n < 300, this runs in well under a second.

- [ ] Create `src/lib/ai/generation/network/walktrap.ts`:

  ```typescript
  /**
   * walktrap.ts
   *
   * Simplified Walktrap community detection:
   * 1. Build transition probability matrix P = D^{-1} * A (row-normalised adjacency)
   * 2. Compute P^t for t=4 (4-step random walk probabilities)
   * 3. Squared Euclidean distance between row i and row j of P^t
   * 4. Ward's agglomerative hierarchical clustering on that distance matrix
   * 5. Cut dendrogram to maximise modularity Q
   *
   * Returns community assignments (0-indexed) for each node.
   */
  import type { AdjacencyMatrix, CommunityAssignment } from '@/types/generation'

  export function walktrap(
    adjacency:           AdjacencyMatrix,
    trueConstructLabels: number[],    // for modularity cut
    steps = 4,
  ): CommunityAssignment[] {
    const n = adjacency.length
    if (n === 0) return []

    // 1. Degree vector
    const degree = adjacency.map(row => row.reduce((s, v) => s + v, 0))
    const totalEdges = degree.reduce((s, d) => s + d, 0) || 1

    // 2. Transition matrix P (row-normalised). Isolated nodes self-loop.
    const P: number[][] = adjacency.map((row, i) => {
      const d = degree[i]
      return d === 0
        ? row.map((_, j) => (j === i ? 1 : 0))
        : row.map(v => v / d)
    })

    // 3. P^t via repeated matrix multiplication
    let Pt = P
    for (let step = 1; step < steps; step++) {
      Pt = multiplyMatrices(Pt, P, n)
    }

    // 4. Squared Euclidean distance weighted by degree
    const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let d = 0
        for (let k = 0; k < n; k++) {
          const diff = Pt[i][k] - Pt[j][k]
          d += (diff * diff) / (degree[k] / totalEdges || 1e-9)
        }
        dist[i][j] = dist[j][i] = d
      }
    }

    // 5. Ward's agglomerative clustering → find best cut for number of communities
    const nCommunities = new Set(trueConstructLabels).size || Math.max(2, Math.round(Math.sqrt(n / 2)))
    const labels = wardsClustering(dist, n, nCommunities)

    return labels.map((communityId, itemIndex) => ({
      itemIndex,
      communityId,
      stability: 1,   // stability is updated by bootEGA
    }))
  }

  function multiplyMatrices(A: number[][], B: number[][], n: number): number[][] {
    const C: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
    for (let i = 0; i < n; i++)
      for (let k = 0; k < n; k++)
        if (A[i][k] !== 0)
          for (let j = 0; j < n; j++)
            C[i][j] += A[i][k] * B[k][j]
    return C
  }

  /** Ward's hierarchical clustering — returns integer cluster labels (0-indexed). */
  function wardsClustering(dist: number[][], n: number, nClusters: number): number[] {
    // Each node starts in its own cluster
    let clusters: number[][] = Array.from({ length: n }, (_, i) => [i])

    while (clusters.length > nClusters) {
      let bestI = 0, bestJ = 1, bestDist = Infinity

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const d = wardDistance(clusters[i], clusters[j], dist)
          if (d < bestDist) { bestDist = d; bestI = i; bestJ = j }
        }
      }

      // Merge clusters bestI and bestJ
      clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]]
      clusters.splice(bestJ, 1)
    }

    // Assign integer labels
    const labels = new Array(n).fill(0) as number[]
    clusters.forEach((cluster, label) => {
      cluster.forEach(node => { labels[node] = label })
    })
    return labels
  }

  function wardDistance(clusterA: number[], clusterB: number[], dist: number[][]): number {
    const nA = clusterA.length, nB = clusterB.length
    let sum = 0
    for (const i of clusterA)
      for (const j of clusterB)
        sum += dist[i][j]
    return (sum / (nA * nB)) * (nA * nB / (nA + nB))
  }
  ```

- [ ] Create `src/lib/ai/generation/network/nmi.ts`:

  ```typescript
  /**
   * nmi.ts — Normalised Mutual Information + Adjusted Mutual Information
   *
   * NMI(U, V) = 2 * MI(U, V) / (H(U) + H(V))
   * AMI adjusts for chance using the expected MI under random labelling.
   * Both return values in [0, 1] where 1 = perfect agreement.
   */

  export function computeNMI(predicted: number[], actual: number[]): number {
    const n = predicted.length
    if (n === 0) return 0

    const mi  = mutualInformation(predicted, actual, n)
    const hP  = entropy(predicted, n)
    const hA  = entropy(actual,    n)
    const denom = (hP + hA) / 2
    return denom === 0 ? 1 : mi / denom
  }

  export function computeAMI(predicted: number[], actual: number[]): number {
    const n = predicted.length
    if (n === 0) return 0

    const mi        = mutualInformation(predicted, actual, n)
    const expectedMI = expectedMutualInformation(predicted, actual, n)
    const hP        = entropy(predicted, n)
    const hA        = entropy(actual,    n)
    const denom     = (hP + hA) / 2 - expectedMI
    return denom === 0 ? 1 : (mi - expectedMI) / denom
  }

  function entropy(labels: number[], n: number): number {
    const counts = new Map<number, number>()
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1)
    let h = 0
    for (const c of counts.values()) {
      const p = c / n
      h -= p * Math.log(p)
    }
    return h
  }

  function mutualInformation(U: number[], V: number[], n: number): number {
    const contingency = new Map<string, number>()
    const uCounts     = new Map<number, number>()
    const vCounts     = new Map<number, number>()

    for (let i = 0; i < n; i++) {
      const key = `${U[i]},${V[i]}`
      contingency.set(key, (contingency.get(key) ?? 0) + 1)
      uCounts.set(U[i], (uCounts.get(U[i]) ?? 0) + 1)
      vCounts.set(V[i], (vCounts.get(V[i]) ?? 0) + 1)
    }

    let mi = 0
    for (const [key, nij] of contingency) {
      const [ui, vi] = key.split(',').map(Number)
      const ni = uCounts.get(ui)!
      const nj = vCounts.get(vi)!
      mi += (nij / n) * Math.log((n * nij) / (ni * nj))
    }
    return Math.max(0, mi)
  }

  function expectedMutualInformation(U: number[], V: number[], n: number): number {
    // Simplified estimate: E[MI] ≈ (|U_classes| - 1)(|V_classes| - 1) / (2n)
    const nU = new Set(U).size
    const nV = new Set(V).size
    return ((nU - 1) * (nV - 1)) / (2 * n)
  }
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/lib/ai/generation/network/walktrap.ts \
          src/lib/ai/generation/network/nmi.ts
  git commit -m "feat: Walktrap community detection + NMI/AMI calculation"
  ```

---

## Task 10: wTO redundancy + bootstrap stability + leakage detection

**Files:**
- Create: `src/lib/ai/generation/network/wto.ts`
- Create: `src/lib/ai/generation/network/bootstrap.ts`
- Create: `src/lib/ai/generation/network/leakage.ts`
- Create: `src/lib/ai/generation/network/index.ts`

- [ ] Create `src/lib/ai/generation/network/wto.ts`:

  ```typescript
  /**
   * wto.ts — Weighted Topological Overlap
   *
   * wTO(i,j) = (Σ_u A[i,u]·A[j,u] + A[i,j]) / (min(k_i, k_j) + 1 - A[i,j])
   * where k_i = degree of node i.
   *
   * Items with max wTO > cutoff (default 0.20) are flagged redundant.
   * Iterative removal: always remove the item with higher total wTO.
   */
  import type { AdjacencyMatrix, RedundancyResult } from '@/types/generation'

  export function computeWTO(adjacency: AdjacencyMatrix): number[] {
    const n = adjacency.length
    const degree = adjacency.map(row => row.reduce((s, v) => s + v, 0))
    const wto = new Array(n).fill(0) as number[]

    for (let i = 0; i < n; i++) {
      let maxWto = 0
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        let shared = 0
        for (let u = 0; u < n; u++) {
          if (u !== i && u !== j) shared += adjacency[i][u] * adjacency[j][u]
        }
        const numerator   = shared + adjacency[i][j]
        const denominator = Math.min(degree[i], degree[j]) + 1 - adjacency[i][j]
        const wtoIJ       = denominator === 0 ? 0 : numerator / denominator
        if (wtoIJ > maxWto) maxWto = wtoIJ
      }
      wto[i] = maxWto
    }
    return wto
  }

  export function findRedundantItems(
    adjacency: AdjacencyMatrix,
    cutoff    = 0.20,
  ): RedundancyResult {
    let adj = adjacency.map(row => [...row])  // copy
    const n  = adj.length
    const redundantIndices = new Set<number>()

    let changed = true
    while (changed) {
      changed = false
      const wto = computeWTO(adj)
      let maxWto = 0, maxIdx = -1
      for (let i = 0; i < n; i++) {
        if (!redundantIndices.has(i) && wto[i] > cutoff && wto[i] > maxWto) {
          maxWto = wto[i]; maxIdx = i
        }
      }
      if (maxIdx !== -1) {
        redundantIndices.add(maxIdx)
        // Zero out this node in the working adjacency
        for (let j = 0; j < n; j++) adj[maxIdx][j] = adj[j][maxIdx] = 0
        changed = true
      }
    }

    return { redundantIndices, wtoScores: computeWTO(adjacency) }  // final scores on original
  }
  ```

- [ ] Create `src/lib/ai/generation/network/bootstrap.ts`:

  ```typescript
  /**
   * bootstrap.ts — bootEGA stability analysis
   *
   * Runs N bootstrap resamples of the item set, builds a network on each,
   * detects communities, and records which community each item is assigned to.
   * Stability = proportion of samples where item stays in its modal community.
   * Items with stability < 0.75 are flagged unstable.
   */
  import { cosineSimilarityMatrix }  from './correlation'
  import { buildNetwork }            from './network-builder'
  import { walktrap }                from './walktrap'
  import type { StabilityResult }    from '@/types/generation'

  export function bootstrapStability(
    embeddings:         number[][],
    constructLabels:    number[],
    nBootstraps      = 50,     // 50 is a good balance of accuracy vs speed
    stabilityCutoff  = 0.75,
  ): StabilityResult {
    const n = embeddings.length
    if (n === 0) return { stabilityScores: [], unstableIndices: new Set() }

    // Track community assignments per bootstrap iteration per item
    const communityHistory: number[][] = Array.from({ length: n }, () => [])

    for (let b = 0; b < nBootstraps; b++) {
      // Resample with replacement
      const sampleIndices = Array.from({ length: n }, () => Math.floor(Math.random() * n))
      const sampleEmbeddings   = sampleIndices.map(i => embeddings[i])
      const sampleLabels       = sampleIndices.map(i => constructLabels[i])

      try {
        const corrMatrix  = cosineSimilarityMatrix(sampleEmbeddings)
        const { adjacency } = buildNetwork(corrMatrix)
        const communities   = walktrap(adjacency, sampleLabels)

        // Map bootstrap assignments back to original item indices
        for (let si = 0; si < sampleIndices.length; si++) {
          const originalIdx = sampleIndices[si]
          communityHistory[originalIdx].push(communities[si]?.communityId ?? 0)
        }
      } catch {
        // Skip failed iterations
      }
    }

    // Compute stability as proportion in modal community
    const stabilityScores = communityHistory.map(history => {
      if (history.length === 0) return 0
      const counts = new Map<number, number>()
      for (const c of history) counts.set(c, (counts.get(c) ?? 0) + 1)
      const modalCount = Math.max(...counts.values())
      return modalCount / history.length
    })

    const unstableIndices = new Set(
      stabilityScores
        .map((s, i) => s < stabilityCutoff ? i : -1)
        .filter(i => i !== -1)
    )

    return { stabilityScores, unstableIndices }
  }
  ```

- [ ] Create `src/lib/ai/generation/network/leakage.ts`:

  ```typescript
  /**
   * leakage.ts — Cross-construct item leakage detection
   *
   * An item "leaks" when its assigned communityId consistently differs from
   * the modal community of its intended construct. These items may be
   * well-written but semantically closer to another construct.
   */
  import type { CommunityAssignment } from '@/types/generation'

  export interface LeakageResult {
    /** Set of item indices that consistently cluster with a different construct. */
    leakingIndices: Set<number>
    /** Map from item index to the construct whose community it leaked into. */
    suggestedConstructByIndex: Map<number, number>
  }

  export function detectLeakage(
    communities:      CommunityAssignment[],
    constructLabels:  number[],   // true construct label per item (0-indexed)
  ): LeakageResult {
    const n = communities.length

    // Find modal communityId for each construct
    const constructCommunityMap = new Map<number, number>()
    const byConstruct = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const c = constructLabels[i]
      const arr = byConstruct.get(c) ?? []
      arr.push(communities[i]?.communityId ?? 0)
      byConstruct.set(c, arr)
    }
    byConstruct.forEach((communityIds, constructLabel) => {
      const counts = new Map<number, number>()
      for (const cId of communityIds) counts.set(cId, (counts.get(cId) ?? 0) + 1)
      const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      if (modal) constructCommunityMap.set(constructLabel, modal[0])
    })

    // Build reverse map: communityId → construct label (which construct owns this community)
    const communityToConstruct = new Map<number, number>()
    constructCommunityMap.forEach((communityId, constructLabel) => {
      communityToConstruct.set(communityId, constructLabel)
    })

    const leakingIndices = new Set<number>()
    const suggestedConstructByIndex = new Map<number, number>()

    for (let i = 0; i < n; i++) {
      const expectedCommunity = constructCommunityMap.get(constructLabels[i])
      const actualCommunity   = communities[i]?.communityId
      if (
        expectedCommunity !== undefined &&
        actualCommunity   !== undefined &&
        actualCommunity   !== expectedCommunity
      ) {
        leakingIndices.add(i)
        const suggestedConstruct = communityToConstruct.get(actualCommunity)
        if (suggestedConstruct !== undefined) {
          suggestedConstructByIndex.set(i, suggestedConstruct)
        }
      }
    }

    return { leakingIndices, suggestedConstructByIndex }
  }
  ```

- [ ] Create `src/lib/ai/generation/network/index.ts`:

  ```typescript
  /**
   * network/index.ts — NetworkAnalyzerImpl + barrel export
   *
   * Implements the NetworkAnalyzer interface from @/types/generation using
   * the TypeScript algorithms in this directory.
   */
  import { cosineSimilarityMatrix }  from './correlation'
  import { buildNetwork }            from './network-builder'
  import { walktrap }                from './walktrap'
  import { computeNMI, computeAMI }  from './nmi'
  import { findRedundantItems }      from './wto'
  import { bootstrapStability }      from './bootstrap'
  import { detectLeakage }           from './leakage'
  import type {
    NetworkAnalyzer,
    AdjacencyMatrix,
    CommunityAssignment,
    RedundancyResult,
    StabilityResult,
  } from '@/types/generation'

  export class NetworkAnalyzerImpl implements NetworkAnalyzer {
    buildNetwork(correlationMatrix: number[][]): AdjacencyMatrix {
      return buildNetwork(correlationMatrix).adjacency
    }
    detectCommunities(adjacency: AdjacencyMatrix): CommunityAssignment[] {
      // Use degree sequence as proxy for true labels when none provided
      const n = adjacency.length
      const labels = new Array(n).fill(0) as number[]
      return walktrap(adjacency, labels)
    }
    computeNMI(predicted: number[], actual: number[]): number {
      return computeNMI(predicted, actual)
    }
    findRedundantItems(adjacency: AdjacencyMatrix, cutoff: number): RedundancyResult {
      return findRedundantItems(adjacency, cutoff)
    }
    bootstrapStability(
      embeddings:  number[][],
      nBootstraps: number,
      cutoff:      number,
    ): StabilityResult {
      const n      = embeddings.length
      const labels = new Array(n).fill(0) as number[]
      return bootstrapStability(embeddings, labels, nBootstraps, cutoff)
    }
  }

  export { cosineSimilarityMatrix }   from './correlation'
  export { buildNetwork }             from './network-builder'
  export { walktrap }                 from './walktrap'
  export { computeNMI, computeAMI }   from './nmi'
  export { findRedundantItems, computeWTO } from './wto'
  export { bootstrapStability }       from './bootstrap'
  export { detectLeakage }            from './leakage'
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/lib/ai/generation/network/
  git commit -m "feat: wTO redundancy, bootEGA stability, leakage detection, NetworkAnalyzerImpl"
  ```

---

## Task 11: Real pipeline orchestrator

**Files:**
- Create: `src/lib/ai/generation/pipeline.ts`
- Modify: `src/lib/ai/generation/index.ts`

**Context:** The real pipeline replaces `pipeline-mock.ts` for server-side execution. It calls the LLM and embedding API via OpenRouter, then runs the network algorithms. Progress is reported via a callback so `startGenerationRun` can update the DB between steps.

**Important:** Server actions in Next.js can time out (default 300s). For large runs (5 constructs × 60 items = 300 items), the pipeline takes roughly:
- Item generation: ~15 LLM calls × 3s = 45s
- Embeddings: ~3 batches × 2s = 6s
- Network analysis: ~10s (correlation + walktrap + UVA + bootEGA)
- Total: ~60s — well within limits

- [ ] Create `src/lib/ai/generation/pipeline.ts`:

  Structure the file as follows. Read `src/lib/ai/generation/pipeline-mock.ts` for comparison.

  ```typescript
  /**
   * pipeline.ts — Real AI-GENIE 7-step pipeline
   *
   * Step 0: Pre-flight (already run in wizard — optional here)
   * Step 1: Generate items via LLM (batches of 20, adaptive prompting)
   * Step 2: Embed all items via text-embedding-3-small
   * Step 3: Build correlation matrix + network (EGA)
   * Step 4: UVA — remove redundant items (wTO > 0.20)
   * Step 5: bootEGA — flag unstable items (stability < 0.75)
   * Step 6: Leakage detection
   * Step 7: Finalise + return scored candidates
   */
  import { openRouterProvider }         from '@/lib/ai/providers/openrouter'
  import { getModelForTask }            from '@/lib/ai/model-resolver'
  import { embedTexts }                 from './embeddings'
  import {
    ITEM_GENERATION_SYSTEM_PROMPT,
    buildItemGenerationPrompt,
    parseGeneratedItems,
  }                                     from './prompts/item-generation'
  import { cosineSimilarityMatrix }     from './network/correlation'
  import { buildNetwork }               from './network/network-builder'
  import { walktrap }                   from './network/walktrap'
  import { computeNMI }                 from './network/nmi'
  import { findRedundantItems }         from './network/wto'
  import { bootstrapStability }         from './network/bootstrap'
  import { detectLeakage }              from './network/leakage'
  import type { ConstructForGeneration, ScoredCandidateItem, PipelineResult } from '@/types/generation'
  import type { GenerationRunConfig }   from '@/types/database'
  import type { ProgressCallback }      from './types'

  const BATCH_SIZE = 20
  const WTO_CUTOFF = 0.20
  const STABILITY_CUTOFF = 0.75
  const N_BOOTSTRAPS = 50

  export async function runPipeline(
    config:     GenerationRunConfig,
    constructs: ConstructForGeneration[],
    onProgress: ProgressCallback,
  ): Promise<{
    items:  ScoredCandidateItem[]
    result: PipelineResult
  }> {
    const modelConfig = await getModelForTask('item_generation')
    const model = config.generationModel ?? modelConfig.model
    let totalInputTokens  = 0
    let totalOutputTokens = 0

    // -----------------------------------------------------------------------
    // Step 1: Generate items
    // -----------------------------------------------------------------------
    await onProgress('item_generation', 10)
    const rawCandidates: Array<{
      constructId:   string
      stem:          string
      reverseScored: boolean
      rationale:     string
    }> = []

    const responseFormatDesc = 'A 5-point Likert scale from "Strongly Disagree" to "Strongly Agree"'

    for (const construct of constructs) {
      const target      = config.targetItemsPerConstruct
      const accumulated: string[] = []

      while (accumulated.length < target) {
        const needed    = Math.min(BATCH_SIZE, target - accumulated.length)
        const prompt    = buildItemGenerationPrompt({
          construct,
          batchSize:                  needed,
          responseFormatDescription:  responseFormatDesc,
          previousItems:              accumulated,
        })

        const response = await openRouterProvider.complete({
          model,
          systemPrompt:   ITEM_GENERATION_SYSTEM_PROMPT,
          prompt,
          temperature:    config.temperature ?? modelConfig.temperature,
          maxTokens:      modelConfig.maxTokens,
          responseFormat: 'json',
        })

        totalInputTokens  += response.usage.inputTokens
        totalOutputTokens += response.usage.outputTokens

        try {
          const parsed = parseGeneratedItems(response.content)
          for (const item of parsed) {
            if (item.stem && !accumulated.includes(item.stem)) {
              accumulated.push(item.stem)
              rawCandidates.push({ constructId: construct.id, ...item })
            }
          }
        } catch { /* skip malformed batch */ }
      }
    }

    await onProgress('embedding', 30, { itemsGenerated: rawCandidates.length })

    // -----------------------------------------------------------------------
    // Step 2: Embed items
    // -----------------------------------------------------------------------
    const stems      = rawCandidates.map(c => c.stem)
    const embeddings = await embedTexts(stems, config.embeddingModel)

    await onProgress('initial_ega', 50)

    // -----------------------------------------------------------------------
    // Step 3: Initial EGA — build network + detect communities
    // -----------------------------------------------------------------------
    const corrMatrix    = cosineSimilarityMatrix(embeddings)
    const { adjacency } = buildNetwork(corrMatrix)
    const constructLabels = rawCandidates.map(c =>
      constructs.findIndex(co => co.id === c.constructId)
    )
    const communities   = walktrap(adjacency, constructLabels)
    const nmiInitial    = computeNMI(communities.map(c => c.communityId), constructLabels)

    await onProgress('uva', 60)

    // -----------------------------------------------------------------------
    // Step 4: UVA — redundancy removal
    // -----------------------------------------------------------------------
    const { redundantIndices, wtoScores } = findRedundantItems(adjacency, WTO_CUTOFF)

    await onProgress('boot_ega', 75)

    // -----------------------------------------------------------------------
    // Step 5: bootEGA — stability
    // -----------------------------------------------------------------------
    const { stabilityScores, unstableIndices } = bootstrapStability(
      embeddings, constructLabels, N_BOOTSTRAPS, STABILITY_CUTOFF,
    )

    await onProgress('leakage', 90)

    // -----------------------------------------------------------------------
    // Step 6: Leakage detection
    // -----------------------------------------------------------------------
    const { leakingIndices } = detectLeakage(communities, constructLabels)

    // -----------------------------------------------------------------------
    // Step 7: Final NMI on non-redundant, non-unstable items
    // -----------------------------------------------------------------------
    const keptIndices   = rawCandidates
      .map((_, i) => i)
      .filter(i => !redundantIndices.has(i) && !unstableIndices.has(i))

    const keptPredicted = keptIndices.map(i => communities[i]?.communityId ?? 0)
    const keptActual    = keptIndices.map(i => constructLabels[i])
    const nmiFinal      = computeNMI(keptPredicted, keptActual)

    // -----------------------------------------------------------------------
    // Assemble scored items
    // -----------------------------------------------------------------------
    const scoredItems: ScoredCandidateItem[] = rawCandidates.map((c, i) => ({
      ...c,
      embedding:    embeddings[i] ?? [],
      communityId:  communities[i]?.communityId,
      wtoMax:       wtoScores[i],
      bootStability: stabilityScores[i],
      isRedundant:  redundantIndices.has(i),
      isUnstable:   unstableIndices.has(i),
    }))

    const itemsAfterUva  = rawCandidates.length - redundantIndices.size
    const itemsAfterBoot = itemsAfterUva - [...unstableIndices].filter(i => !redundantIndices.has(i)).length

    await onProgress('final', 100)

    return {
      items: scoredItems,
      result: {
        runId:         '',   // filled by caller
        itemsGenerated: rawCandidates.length,
        itemsAfterUva,
        itemsAfterBoot,
        nmiInitial,
        nmiFinal,
        modelUsed:     model,
        tokenUsage:    { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      },
    }
  }
  ```

- [ ] Update `src/lib/ai/generation/index.ts` to also export:
  ```typescript
  export { runPipeline } from './pipeline'
  export { embedTexts, embedText } from './embeddings'
  export { runConstructPreflight } from './construct-preflight'
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/lib/ai/generation/pipeline.ts src/lib/ai/generation/index.ts
  git commit -m "feat: real AI-GENIE pipeline (LLM generation + embeddings + network psychometrics)"
  ```

---

## Task 12: Wire real pipeline into server action + pre-flight into wizard

**Files:**
- Modify: `src/app/actions/generation.ts`
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

**Context:** `startGenerationRun` currently has an **entirely inline mock** — it calls `insertMockGeneratedItems()` (a DB helper defined in the same file) and immediately sets status to `reviewing` with fake metrics. There is **no call to `runMockPipeline`** in the current code. This task guts that inline mock block and replaces it with the real pipeline, while keeping the inline mock as a fallback branch for offline development.

**Also:** `updateGenerationRunProgress` currently has no `tokenUsage` field — add it before wiring it into the pipeline callback.

- [ ] Read `src/app/actions/generation.ts` (full file). Identify:
  - The `updateGenerationRunProgress` function signature
  - The `startGenerationRun` function — specifically the mock block starting around `// Run mock pipeline` and ending with the `status: 'reviewing'` update
  - The `insertMockGeneratedItems` local helper function

- [ ] Add `tokenUsage` to `updateGenerationRunProgress`'s input type and its DB update so the pipeline can persist token counts:
  ```typescript
  // In the progress update object, add:
  tokenUsage?: { inputTokens: number; outputTokens: number }
  ```
  In the DB update inside `updateGenerationRunProgress`, add:
  ```typescript
  ...(update.tokenUsage ? { token_usage: update.tokenUsage } : {}),
  ```

- [ ] In `startGenerationRun`, replace the inline mock block with:
  ```typescript
  // Fetch constructs for this run
  const constructs = await fetchConstructsForRun(config.constructIds)  // new helper (add below)

  const onProgress: ProgressCallback = async (step, pct, details) => {
    await updateGenerationRunProgress(runId, {
      currentStep: step,
      progressPct: pct,
      ...(details?.itemsGenerated ? { itemsGenerated: details.itemsGenerated as number } : {}),
    })
  }

  const useRealPipeline = Boolean(process.env.OpenRouter_API_KEY)
  let scoredItems: ScoredCandidateItem[]
  let pipelineResult: PipelineResult

  if (useRealPipeline) {
    const result = await runPipeline(config, constructs, onProgress)
    scoredItems    = result.items
    pipelineResult = result.result
  } else {
    // Offline fallback — no API key available
    await insertMockGeneratedItems(runId, config)  // keep existing inline helper (2 args: runId, config)
    await updateGenerationRunProgress(runId, {
      status: 'reviewing', progressPct: 100,
      nmiInitial: 0.71, nmiFinal: 0.89,
      itemsGenerated: config.targetItemsPerConstruct * config.constructIds.length,
      itemsAfterUva: Math.floor(config.targetItemsPerConstruct * config.constructIds.length * 0.75),
      itemsAfterBoot: Math.floor(config.targetItemsPerConstruct * config.constructIds.length * 0.65),
    })
    return { success: true }
  }

  // Persist real pipeline results
  // ... bulk insert scoredItems, update run status to reviewing
  ```

  Add `fetchConstructsForRun(constructIds: string[])` as a private helper (not exported) that queries `constructs` joined with `traits` for the given IDs, returning `ConstructForGeneration[]`.

  After the pipeline completes, bulk insert `scoredItems` into `generated_items` (similar to `insertMockGeneratedItems`) and set the run to `reviewing` with real NMI/item counts from `pipelineResult`. Also persist `tokenUsage` via `updateGenerationRunProgress`.

- [ ] Add imports at top of `generation.ts`:
  ```typescript
  import { runPipeline } from '@/lib/ai/generation'
  import type { ScoredCandidateItem, PipelineResult } from '@/types/generation'
  import type { ProgressCallback } from '@/lib/ai/generation/types'
  ```

- [ ] Add `.env.example` entry (create the file if it doesn't exist, otherwise append):
  ```bash
  # OpenRouter API key — required for real item generation (mock pipeline used when absent)
  OpenRouter_API_KEY=
  ```

- [ ] Read `src/app/(dashboard)/generate/new/page.tsx`. Find Step 2 (the readiness panel). Replace the static "all green" mock with a real call to `runConstructPreflight`:

  Import from `@/lib/ai/generation` (or the server action — prefer calling via a new server action so it runs server-side):

  Add a new server action to `src/app/actions/generation.ts`:
  ```typescript
  export async function checkConstructReadiness(constructIds: string[]) {
    // fetch construct data, call runConstructPreflight, return PreflightResult
  }
  ```

  In the wizard Step 2, call `checkConstructReadiness(selectedConstructIds)` on mount/when entering the step, and display the real green/amber/red results instead of static green.

  Keep the existing UI (the readiness panel component is already built) — just replace the hardcoded mock data with the real results.

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/app/actions/generation.ts \
          src/app/(dashboard)/generate/new/page.tsx
  git commit -m "feat: wire real pipeline and pre-flight into app (mock fallback when API key absent)"
  ```

---

## Task 13: Phase 8 Polish — re-run + CSV export + edge cases

**Files:**
- Modify: `src/app/actions/generation.ts`
- Modify: `src/app/(dashboard)/generate/[runId]/page.tsx`
- Modify: `src/app/(dashboard)/generate/page.tsx`

- [ ] **Re-run capability:** In `src/app/actions/generation.ts`, add:
  ```typescript
  export async function rerunGenerationRun(runId: string): Promise<GenerationRun>
  ```
  This creates a NEW generation run with the same config as an existing run, then calls `startGenerationRun` on it. Returns the new run so the client can navigate to it.

- [ ] **CSV export:** Add:
  ```typescript
  export async function exportRunItemsAsCSV(runId: string): Promise<string>
  ```
  Returns a CSV string with columns: `stem, reverse_scored, construct_name, wto_max, boot_stability, is_redundant, is_unstable, status`.

- [ ] In `src/app/(dashboard)/generate/[runId]/page.tsx`, add to the accept bar area:
  - "Re-run with same settings" button → calls `rerunGenerationRun`, navigates to new run
  - "Export CSV" button → calls `exportRunItemsAsCSV`, triggers file download via `Blob` + `URL.createObjectURL`

- [ ] In `src/app/(dashboard)/generate/page.tsx`, show the run's `modelUsed` on each card.

- [ ] **Edge cases:** In `startGenerationRun`, add guard:
  ```typescript
  if (!config.constructIds.length) {
    return { success: false, error: 'No constructs selected' }
  }
  ```

- [ ] Run `npx tsc --noEmit` — expect clean.

- [ ] Commit:
  ```bash
  git add src/app/actions/generation.ts \
          src/app/(dashboard)/generate/[runId]/page.tsx \
          src/app/(dashboard)/generate/page.tsx
  git commit -m "feat: re-run capability, CSV export, edge case guards (Phase 8 polish)"
  ```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` passes clean at end of every task
- [ ] `npm run db:push` applied migration 00033 successfully
- [ ] OpenRouter provider uses `request.model ?? DEFAULT_MODEL`
- [ ] OpenRouter provider sends `HTTP-Referer` and `X-Title` headers
- [ ] `getModelForTask('item_generation')` returns a model config from DB
- [ ] Matching engine resolves model via `getModelForTask('competency_matching')`
- [ ] Pre-flight wizard Step 2 shows real green/amber/red status
- [ ] Real pipeline generates items, embeds them, runs network analysis
- [ ] NMI improves after UVA + bootEGA (nmiFinal > nmiInitial in most runs)
- [ ] Accepted items appear in the items library
- [ ] Mock fallback works when `OpenRouter_API_KEY` is absent
- [ ] CSV export downloads correctly
- [ ] Re-run creates a new run with same config
