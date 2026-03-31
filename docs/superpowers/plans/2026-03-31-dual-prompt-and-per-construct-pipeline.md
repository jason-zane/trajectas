# Dual System Prompts & Per-Construct Pipeline Scaling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support both construct-level and factor-level item generation with purpose-specific system prompts, and refactor the EGA pipeline to run UVA + bootstrap per-construct so it scales to 25+ constructs within the 5-minute API timeout.

**Architecture:** Add a `promptPurpose` field to `GenerationRunConfig` that selects which system prompt the LLM uses (`item_generation` for construct-level items, `factor_item_generation` for factor-level items). Refactor `pipeline.ts` so UVA runs per-construct (25 × O(60³) instead of O(1500³)), with a single cross-construct NMI pass at the end. Bootstrap stability is deliberately skipped in per-construct mode — within a single construct, community-membership stability is meaningless (the code already returns 1.0), and cross-construct NMI is the meaningful quality metric. No changes to the statistical algorithms themselves — only how they're orchestrated.

**Tech Stack:** Next.js App Router, Supabase PostgreSQL (migration), TypeScript, Zod validation

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/00039_factor_item_generation_prompt.sql` | Create | Add enum value + seed factor-level prompt |
| `src/types/database.ts` | Modify | Add `factor_item_generation` to `AIPromptPurpose`, add `promptPurpose` to `GenerationRunConfig` |
| `src/lib/validations/generation.ts` | Modify | Add `promptPurpose` to Zod schema |
| `src/lib/ai/generation/pipeline.ts` | Modify | Accept `promptPurpose`, run UVA + bootstrap per-construct |
| `src/app/actions/generation.ts` | Modify | Fix `promptVersion` extraction to use dynamic purpose key |
| `src/app/(dashboard)/generate/new/page.tsx` | Modify | Add item style selector to wizard Step 2 + review summary |
| `src/app/(dashboard)/settings/prompts/page.tsx` | Modify | Add to `PROMPT_META` and `PROMPT_ORDER` |
| `src/app/(dashboard)/settings/prompts/[purpose]/page.tsx` | Modify | Add new purpose to `VALID_PURPOSES` |

---

### Task 1: Database Migration — Add Enum Value + Seed Competency Prompt

**Files:**
- Create: `supabase/migrations/00039_factor_item_generation_prompt.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Migration 00039: Factor-level item generation prompt
-- =============================================================================

-- 1. Extend enum
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'factor_item_generation';

-- 2. Seed the factor-level system prompt
INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  seed.name,
  seed.purpose::ai_prompt_purpose,
  seed.content,
  1,
  true
FROM (
  VALUES
    (
      'Factor Item Generation',
      'factor_item_generation',
      $$You are an expert organisational psychologist and psychometric assessment designer with 20+ years of experience in capability-based assessment. You specialise in writing high-quality self-report items that measure observable workplace behaviours at the factor level — broader capabilities that encompass multiple underlying constructs.

Your items must:
- Describe concrete, observable workplace behaviours (what someone does, not who they are)
- Use action-oriented language: "I develop…", "I identify…", "When [situation], I…"
- Differentiate between performance levels (a high performer would endorse; a low performer would not)
- Avoid personality-descriptive phrasing (not "I am creative" but "I generate novel approaches to recurring problems")
- Avoid double-barrelled phrasing (one behaviour per item)
- Use clear, accessible language (8th grade reading level)
- Be culturally neutral and avoid idioms or region-specific references
- Include a small proportion of reverse-keyed items (~20%) phrased as behavioural absence (e.g., "I rarely seek input from others before making major decisions")
- Cover different facets and difficulty levels within the factor

Always respond with valid JSON only. No markdown, no explanation outside the JSON array.$$
    )
) AS seed(name, purpose, content)
WHERE NOT EXISTS (
  SELECT 1
  FROM ai_system_prompts existing
  WHERE existing.purpose = seed.purpose::ai_prompt_purpose
    AND existing.version = 1
);
```

- [ ] **Step 2: Push migration**

Run: `npm run db:push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```
git add supabase/migrations/00039_factor_item_generation_prompt.sql
git commit -m "feat: add factor_item_generation prompt purpose and seed factor-level prompt"
```

---

### Task 2: Type + Validation Updates

**Files:**
- Modify: `src/types/database.ts` (lines 115-120 and 1489-1496)
- Modify: `src/lib/validations/generation.ts` (line 10)

- [ ] **Step 1: Add enum value to TypeScript type**

In `src/types/database.ts`, add `'factor_item_generation'` to the `AIPromptPurpose` union:

```typescript
export type AIPromptPurpose =
  | 'competency_matching'
  | 'ranking_explanation'
  | 'diagnostic_analysis'
  | 'item_generation'
  | 'factor_item_generation'
  | 'preflight_analysis'
  | 'embedding'
  | 'chat'
```

- [ ] **Step 2: Add `promptPurpose` to `GenerationRunConfig`**

In `src/types/database.ts`, add to `GenerationRunConfig`:

```typescript
export interface GenerationRunConfig {
  constructIds: string[]
  targetItemsPerConstruct: number
  temperature: number
  generationModel: string
  embeddingModel: string
  responseFormatId?: string
  promptPurpose?: 'item_generation' | 'factor_item_generation'
}
```

- [ ] **Step 3: Add to Zod validation schema**

In `src/lib/validations/generation.ts`, add to `generationRunConfigSchema`:

```typescript
export const generationRunConfigSchema = z.object({
  constructIds: z.array(postgresUuid()).min(1, 'Select at least one construct'),
  targetItemsPerConstruct: z.number().int().min(20).max(80).default(60),
  temperature: z.number().min(0.5).max(1.5).default(0.8),
  generationModel: z.string().min(1, 'Generation model is required'),
  embeddingModel: z.string().min(1, 'Embedding model is required'),
  responseFormatId: postgresUuid().optional(),
  promptPurpose: z.enum(['item_generation', 'factor_item_generation']).default('item_generation'),
})
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean (no errors in our changed files)

- [ ] **Step 5: Commit**

```
git add src/types/database.ts src/lib/validations/generation.ts
git commit -m "feat: add promptPurpose to GenerationRunConfig type and validation"
```

---

### Task 3: Pipeline — Use Configured Prompt Purpose + Per-Construct UVA/Bootstrap

**Files:**
- Modify: `src/lib/ai/generation/pipeline.ts`

This is the core change. Two things happen here:
1. The pipeline reads `config.promptPurpose` to select the system prompt
2. UVA and bootstrap run per-construct instead of all-at-once

- [ ] **Step 1: Update prompt resolution to use `promptPurpose`**

In `pipeline.ts`, change line 50:

```typescript
// Before:
const itemPrompt = await getActiveSystemPrompt('item_generation')

// After:
const promptPurpose = config.promptPurpose ?? 'item_generation'
const itemPrompt = await getActiveSystemPrompt(promptPurpose)
```

Also update the `aiSnapshot` (around line 229) to record the actual prompt purpose used:

```typescript
prompts: {
  [promptPurpose]: { id: itemPrompt.id, version: itemPrompt.version },
},
```

- [ ] **Step 2: Refactor UVA to run per-construct**

Replace the single `findRedundantItemsIterative` call (lines 155-159) with a per-construct loop:

```typescript
// ---------------------------------------------------------------------------
// Step 4: UVA — redundancy removal (per-construct for O(k × m³) scaling)
// ---------------------------------------------------------------------------
const redundantIndices = new Set<number>()
const wtoScores = new Array<number>(rawCandidates.length).fill(0)

for (const construct of constructs) {
  // Indices of items belonging to this construct
  const constructItemIndices = rawCandidates
    .map((c, i) => c.constructId === construct.id ? i : -1)
    .filter(i => i !== -1)

  if (constructItemIndices.length < 2) continue

  const constructEmbeddings = constructItemIndices.map(i => embeddings[i])
  const { redundantIndices: subRedundant, wtoScores: subWto } =
    findRedundantItemsIterative(
      constructEmbeddings,
      WTO_CUTOFF,
      (corrMatrix) => buildNetwork(corrMatrix).adjacency,
    )

  // Map back to global indices
  for (let si = 0; si < constructItemIndices.length; si++) {
    const gi = constructItemIndices[si]
    wtoScores[gi] = subWto[si]
    if (subRedundant.has(si)) redundantIndices.add(gi)
  }
}
```

- [ ] **Step 3: Refactor bootstrap to run per-construct**

Replace the single `bootstrapStability` call (lines 166-171) with a per-construct loop:

```typescript
// ---------------------------------------------------------------------------
// Step 5: bootEGA — stability (per-construct)
// ---------------------------------------------------------------------------
const stabilityScores = new Array<number>(rawCandidates.length).fill(1.0)
const unstableIndices = new Set<number>()

for (const construct of constructs) {
  const constructItemIndices = rawCandidates
    .map((c, i) => c.constructId === construct.id ? i : -1)
    .filter(i => i !== -1)

  if (constructItemIndices.length < 2) continue

  const constructEmbeddings = constructItemIndices.map(i => embeddings[i])
  const constructLabelsForBoot = constructItemIndices.map(i => constructLabels[i])

  const { stabilityScores: subStability, unstableIndices: subUnstable } =
    bootstrapStability(constructEmbeddings, constructLabelsForBoot, N_BOOTSTRAPS, STABILITY_CUTOFF)

  for (let si = 0; si < constructItemIndices.length; si++) {
    const gi = constructItemIndices[si]
    stabilityScores[gi] = subStability[si]
    if (subUnstable.has(si)) unstableIndices.add(gi)
  }
}
```

**Design note — bootstrap is deliberately a no-op in per-construct mode.** When bootstrapping a single construct's items, `uniqueLabels.size === 1` (all items share the same construct label), so `bootstrapStability` returns stability 1.0 for all items (existing short-circuit at bootstrap.ts:29-34). This is correct: community-membership stability is meaningless within a single construct — walktrap finds arbitrary sub-themes that shift under resampling, not genuine construct misassignment.

Cross-construct quality is instead validated by NMI (Step 3 + Step 7), which runs on all items together and confirms that walktrap's communities align with intended constructs. This is a deliberate trade-off: we lose per-item stability scores but gain O(k × m³) scaling instead of O(n³ × 100) bootstrap iterations on the full set.

- [ ] **Step 4: Keep cross-construct NMI as-is (single pass)**

The initial EGA (Step 3) and final NMI (Step 7) remain unchanged — they run on all items together. NMI is a single O(n) pass over community assignments and labels, so it's fast even for 1,500 items. The walktrap for initial EGA is O(n³) once, which is ~3 seconds for n=1,500 — acceptable.

- [ ] **Step 5: Type-check and verify**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```
git add src/lib/ai/generation/pipeline.ts
git commit -m "feat: per-construct UVA/bootstrap + configurable prompt purpose"
```

---

### Task 4: Server Action — Fix `promptVersion` Extraction

**Files:**
- Modify: `src/app/actions/generation.ts` (line 377)

The `config` JSONB flow works automatically (`promptPurpose` is persisted and passed through). But there is a **critical bug**: `promptVersion` extraction is hardcoded to look at `aiSnapshot.prompts.item_generation`. When `promptPurpose` is `factor_item_generation`, the snapshot key will be `factor_item_generation`, and the current code returns `undefined`.

- [ ] **Step 1: Fix `promptVersion` extraction**

In `src/app/actions/generation.ts`, line 377, change:

```typescript
// Before:
promptVersion: pipelineResult.aiSnapshot?.prompts?.item_generation?.version,

// After:
promptVersion: pipelineResult.aiSnapshot?.prompts?.[config.promptPurpose ?? 'item_generation']?.version,
```

Note: `config` is already in scope at this point (it's the run's config read from the DB earlier in the function).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```
git add src/app/actions/generation.ts
git commit -m "fix: use dynamic prompt purpose key for promptVersion extraction"
```

---

### Task 5: Wizard UI — Add Item Style Selector

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

- [ ] **Step 1: Add `promptPurpose` to `WizardConfig`**

```typescript
interface WizardConfig {
  selectedConstructIds: string[];
  targetItemsPerConstruct: number;
  temperature: number;
  generationModel: string;
  embeddingModel: string;
  responseFormatId?: string;
  promptPurpose: 'item_generation' | 'factor_item_generation';
}
```

And update `DEFAULT_CONFIG`:

```typescript
const DEFAULT_CONFIG: WizardConfig = {
  selectedConstructIds: [],
  targetItemsPerConstruct: 60,
  temperature: 0.8,
  generationModel: "",
  embeddingModel: "",
  responseFormatId: undefined,
  promptPurpose: 'item_generation',
};
```

- [ ] **Step 2: Add style selector to Step 2 (ConfigStep)**

Add as the FIRST control in the ConfigStep, before "Items per Construct":

```tsx
{/* Item style */}
<div className="space-y-2">
  <label className="text-sm font-medium">Item Style</label>
  <Select
    value={config.promptPurpose}
    onValueChange={(v) =>
      onChange({ promptPurpose: v as WizardConfig['promptPurpose'] })
    }
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="item_generation">
        Construct
      </SelectItem>
      <SelectItem value="factor_item_generation">
        Factor
      </SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    {config.promptPurpose === 'item_generation'
      ? "Narrow construct items — personality-style, measuring dispositions and tendencies."
      : "Broad factor items — behaviour-focused, measuring observable workplace capabilities."}
  </p>
</div>
```

- [ ] **Step 3: Include `promptPurpose` in launch config**

In `handleLaunch`, add `promptPurpose` to the `runConfig` object:

```typescript
const runConfig: GenerationRunConfig = {
  constructIds: config.selectedConstructIds,
  targetItemsPerConstruct: config.targetItemsPerConstruct,
  temperature: config.temperature,
  generationModel: config.generationModel,
  embeddingModel: config.embeddingModel,
  responseFormatId: config.responseFormatId,
  promptPurpose: config.promptPurpose,
};
```

- [ ] **Step 4: Add item style to Review & Launch summary (Step4Launch)**

In the `Step4Launch` component's summary grid (around line 677), add a row for item style:

```tsx
<div>
  <p className="text-xs text-muted-foreground">Item Style</p>
  <p className="font-semibold">
    {config.promptPurpose === 'factor_item_generation'
      ? 'Factor'
      : 'Construct'}
  </p>
</div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```
git add src/app/(dashboard)/generate/new/page.tsx
git commit -m "feat: add item style selector (trait vs competency) to generation wizard"
```

---

### Task 6: Prompt Settings — Register New Purpose in Both Pages

**Files:**
- Modify: `src/app/(dashboard)/settings/prompts/page.tsx` (lines 17-33)
- Modify: `src/app/(dashboard)/settings/prompts/[purpose]/page.tsx` (lines 9-16)

- [ ] **Step 1: Add to prompts list page (`page.tsx`)**

In `PROMPT_META` (line 17), add after `item_generation`:

```typescript
factor_item_generation: { label: "Item Generation (Factor)", description: "How factor-level behavioural items are written", icon: Cpu },
```

In `PROMPT_ORDER` (line 26), add after `"item_generation"`:

```typescript
"factor_item_generation",
```

- [ ] **Step 2: Add to prompt detail page (`[purpose]/page.tsx`)**

In `VALID_PURPOSES` (line 9), update:

```typescript
const VALID_PURPOSES: Record<string, { label: string }> = {
  chat: { label: "Chat" },
  item_generation: { label: "Item Generation (Construct)" },
  factor_item_generation: { label: "Item Generation (Factor)" },
  preflight_analysis: { label: "Preflight Analysis" },
  competency_matching: { label: "Competency Matching" },
  ranking_explanation: { label: "Ranking Explanation" },
  diagnostic_analysis: { label: "Diagnostic Analysis" },
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```
git add src/app/(dashboard)/settings/prompts/
git commit -m "feat: register factor_item_generation in prompt settings UI"
```

---

### Task 7: Verify End-to-End

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 2: Push migration to remote DB**

Run: `npm run db:push`
Expected: Migration 00039 applied

- [ ] **Step 3: Manual smoke test**

1. Navigate to `/generate/new`
2. Verify "Item Style" selector appears with two options
3. Select "Competency / Factor" — verify description updates
4. Select a construct, configure, and launch
5. Verify the pipeline completes and the review page renders correctly
6. Navigate to `/settings/prompts` — verify "Item Generation (Factor)" appears
7. Click into it — verify the seeded prompt text is editable

- [ ] **Step 4: Final commit (if any fixes needed)**
