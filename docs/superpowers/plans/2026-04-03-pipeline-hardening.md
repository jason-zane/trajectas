# Pipeline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix item generation reliability — temperature awareness, more retry headroom, full batch requests, and facet diversity guidance to prevent constructs from falling short of their target item count.

**Architecture:** Four independent, surgical changes to the existing pipeline. Temperature awareness adds a field to the OpenRouterModel type and conditionally disables the wizard slider. The other three changes are in the pipeline's batch loop and prompt builder. No new files, no schema changes, no new dependencies.

**Tech Stack:** TypeScript, Next.js, OpenRouter API

**Spec:** `docs/superpowers/specs/2026-04-03-pipeline-enhancement-design.md` (Tier 1 section)

---

### Task 1: Temperature Awareness — Type and Model Fetch

**Files:**
- Modify: `src/types/generation.ts:241-256` (OpenRouterModel interface)
- Modify: `src/lib/ai/providers/openrouter.ts:105-123` (listModels method)
- Test: `tests/unit/construct-preflight.test.ts` (or a new test file)

- [ ] **Step 1: Add `supported_parameters` to `OpenRouterModel`**

In `src/types/generation.ts`, add the field to the `OpenRouterModel` interface:

```typescript
export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing?: {
    prompt: string
    completion: string
  }
  context_length?: number
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
    tokenizer?: string
  }
  supported_parameters?: string[]
}
```

- [ ] **Step 2: Verify the OpenRouter provider doesn't strip extra fields**

Read `src/lib/ai/providers/openrouter.ts` line 118. The `listModels` method casts the API response directly: `const data = await response.json() as { data?: OpenRouterModel[] }`. Since there's no field-by-field mapping, adding `supported_parameters` to the type is sufficient — the field will flow through from the API response automatically. No code changes needed in this file.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/generation.ts
git commit -m "feat(pipeline): add supported_parameters to OpenRouterModel type"
```

---

### Task 2: Temperature Awareness — Wizard UI

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx:1337-1363` (temperature slider section)

- [ ] **Step 1: Find the selected generation model's supported_parameters**

In the `Step3ConfigureGeneration` component (around line 1260), the component receives `textModels: OpenRouterModel[]` and `config.generationModel` (the selected model ID). Look up the selected model to check temperature support.

Add this before the return statement of the component:

```typescript
  const selectedGenModel = textModels.find((m) => m.id === config.generationModel);
  const supportsTemperature = selectedGenModel?.supported_parameters?.includes("temperature") ?? true;
```

Note: default to `true` when `supported_parameters` is undefined (fallback models and older API responses don't include this field).

- [ ] **Step 2: Conditionally disable the temperature slider**

Replace the temperature slider section (lines 1337-1363) with:

```tsx
        {/* Temperature */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Generation Temperature</label>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {supportsTemperature ? config.temperature.toFixed(1) : "N/A"}
            </span>
          </div>
          <Slider
            min={0.5}
            max={1.5}
            step={0.1}
            value={[config.temperature]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v;
              onChange({ temperature: Math.round(n * 10) / 10 });
            }}
            disabled={!supportsTemperature}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5 — Focused</span>
            <span>1.5 — Diverse</span>
          </div>
          {supportsTemperature ? (
            <p className="text-xs text-muted-foreground">
              Higher values produce more diverse items but may increase redundancy. The pipeline
              filters redundant items automatically.
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This model does not support temperature adjustment.
            </p>
          )}
        </div>
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/generate/new/page.tsx"
git commit -m "feat(pipeline): disable temperature slider when model doesn't support it"
```

---

### Task 3: Increase Attempt Ceiling and Always Request Full Batch

**Files:**
- Modify: `src/lib/ai/generation/pipeline.ts:101,103`

- [ ] **Step 1: Increase the attempt ceiling**

In `src/lib/ai/generation/pipeline.ts`, line 101, change:

```typescript
    while (accumulated.length < target && attempts < Math.ceil(target / BATCH_SIZE) + 4) {
```

to:

```typescript
    while (accumulated.length < target && attempts < Math.ceil(target / BATCH_SIZE) + 8) {
```

- [ ] **Step 2: Always request full batch size**

On line 103, change:

```typescript
      const needed = Math.min(BATCH_SIZE, target - accumulated.length)
```

to:

```typescript
      const needed = BATCH_SIZE
```

The prompt will always say "Generate 20 NEW psychometric items" regardless of how many are needed. This is intentional — it gives the model a full creative run and maximises the pool available for deduplication. The `if (accumulated.length >= target) break` on line 156 already prevents over-accumulation.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/generation/pipeline.ts
git commit -m "feat(pipeline): increase attempt ceiling to +8 and always request full batch size"
```

---

### Task 4: Facet Diversity Guidance

**Files:**
- Modify: `src/lib/ai/generation/prompts/item-generation.ts:3-9` (params type), `43-71` (prompt template)
- Modify: `src/lib/ai/generation/pipeline.ts:107-113` (prompt builder call)
- Test: `tests/unit/construct-preflight.test.ts`

- [ ] **Step 1: Write a test for facet coverage section**

In `tests/unit/construct-preflight.test.ts`, add:

```typescript
import { buildItemGenerationPrompt } from "@/lib/ai/generation/prompts/item-generation"

describe("buildItemGenerationPrompt facet diversity", () => {
  const baseConstruct = {
    id: "1",
    name: "Resilience",
    slug: "resilience",
    definition: "Ability to recover from setbacks",
    existingItemCount: 0,
  }

  it("includes facet coverage section when previousFacets provided", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: ["I bounce back quickly from setbacks"],
      previousFacets: ["emotional recovery", "persistence", "stress tolerance"],
    })

    expect(prompt).toContain("## Facet Coverage")
    expect(prompt).toContain("emotional recovery")
    expect(prompt).toContain("persistence")
    expect(prompt).toContain("stress tolerance")
    expect(prompt).toContain("different behavioural expressions")
  })

  it("omits facet coverage section when no previousFacets", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
    })

    expect(prompt).not.toContain("## Facet Coverage")
  })

  it("omits facet coverage when previousFacets is empty", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: ["I bounce back"],
      previousFacets: [],
    })

    expect(prompt).not.toContain("## Facet Coverage")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: FAIL — `buildItemGenerationPrompt` doesn't accept `previousFacets`

- [ ] **Step 3: Add `previousFacets` to the prompt builder**

In `src/lib/ai/generation/prompts/item-generation.ts`, update the params type to add `previousFacets`:

```typescript
export function buildItemGenerationPrompt(params: {
  construct:        ConstructForGeneration
  batchSize:        number
  responseFormatDescription: string
  previousItems:    string[]
  previousFacets?:  string[]
  contrastConstructs?: Array<Pick<ConstructForGeneration, "name" | "definition" | "description">>
}): string {
  const {
    construct,
    batchSize,
    responseFormatDescription,
    previousItems,
    previousFacets = [],
    contrastConstructs = [],
  } = params
```

After the `previousSection` variable (around line 32), add:

```typescript
  const facetCoverageSection = previousFacets.length > 0
    ? `\n## Facet Coverage\nPrevious batches covered these facets: ${previousFacets.join(', ')}.\nExplore different behavioural expressions of the construct that are not yet represented.`
    : ''
```

Then insert `${facetCoverageSection}` into the template string, after `${previousSection}` and before the `## Per-Item Metadata` section.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: PASS

- [ ] **Step 5: Thread facets from the pipeline into the prompt builder**

In `src/lib/ai/generation/pipeline.ts`, update the `buildItemGenerationPrompt` call (around line 107) to pass accumulated facets:

```typescript
      // Collect facets from already-generated items for this construct
      const accumulatedFacets = rawCandidates
        .filter((c) => c.constructId === construct.id && c.facet)
        .map((c) => c.facet!)
      // Only include facet guidance if we have enough data (>50% of items have facets)
      const previousFacets = accumulatedFacets.length >= accumulated.length * 0.5
        ? [...new Set(accumulatedFacets)]
        : []

      const prompt = buildItemGenerationPrompt({
        construct,
        batchSize: needed,
        responseFormatDescription: responseFormatDesc,
        previousItems: [...(construct.existingItems ?? []), ...accumulated],
        previousFacets,
        contrastConstructs,
      })
```

Note: the `previousFacets` is deduplicated with `new Set()` and only included when ≥50% of accumulated items have facet data, preventing misleadingly sparse lists.

- [ ] **Step 6: Run tests and type-check**

Run: `npx vitest run tests/unit/construct-preflight.test.ts && npx tsc --noEmit 2>&1 | head -20`
Expected: All tests pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/generation/prompts/item-generation.ts src/lib/ai/generation/pipeline.ts tests/unit/construct-preflight.test.ts
git commit -m "feat(pipeline): add facet diversity guidance to batch 2+ prompts"
```

---

### Task 5: Full Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all preflight/pipeline tests**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: All tests pass

- [ ] **Step 2: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (or only pre-existing failures)

- [ ] **Step 4: Manual smoke test**

1. Open the generation wizard (`/generate/new`)
2. Select a model known to NOT support temperature (e.g., an o1/o3 model if available) — verify slider is disabled with amber message
3. Select a model that DOES support temperature — verify slider works normally
4. Select 3-5 constructs and launch a generation run
5. Check server logs for `[pipeline]` output showing:
   - Batch sizes always 20 (not shrinking toward the end)
   - Facet coverage appearing in logs after batch 1
   - More than 7 attempts if deduplication is high
6. Verify the run completes with more items than before
