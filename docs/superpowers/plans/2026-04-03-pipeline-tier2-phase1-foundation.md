# Next-Gen Pipeline Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the configurable pipeline architecture — toggle UI, database schema for new stages, extended types, and review UI funnel summary — so that Phase 2 (Item Critique + Leakage Guard) and Phase 3 (Difficulty Targeting + Synthetic Validation) can be built on top.

**Architecture:** Extend `GenerationRunConfig` with four toggle booleans stored in the existing JSONB column (no migration needed for config). Add a `pipeline_metadata` JSONB column to `generated_items` for per-item stage data. Extend `AIPromptPurpose` enum and seed new model configs. Add toggle cards to the wizard UI and a funnel summary to the review page.

**Tech Stack:** TypeScript, Next.js, Supabase (PostgreSQL), React

**Spec:** `docs/superpowers/specs/2026-04-03-pipeline-enhancement-design.md` (Tier 2 sections)

---

### Task 1: Extend Types — Config Toggles, RemovalStage, Pipeline Metadata

**Files:**
- Modify: `src/types/database.ts:1599-1609` (GenerationRunConfig), `1650-1673` (GeneratedItem), `115-127` (AIPromptPurpose)
- Modify: `src/types/generation.ts:85` (RemovalStage), `88-112` (PipelineResult), `126-137` (ScoredCandidateItem)

- [ ] **Step 1: Add pipeline toggle fields to `GenerationRunConfig`**

In `src/types/database.ts`, add four optional boolean fields to `GenerationRunConfig` (after `constructOverrides`):

```typescript
export interface GenerationRunConfig {
  constructIds: string[]
  targetItemsPerConstruct: number
  temperature: number
  generationModel: string
  embeddingModel: string
  networkEstimator?: 'tmfg' | 'ebicglasso'
  responseFormatId?: string
  promptPurpose?: 'item_generation' | 'factor_item_generation'
  constructOverrides?: Record<string, ConstructConfigOverride>
  enableItemCritique?: boolean
  enableLeakageGuard?: boolean
  enableDifficultyTargeting?: boolean
  enableSyntheticValidation?: boolean
}
```

- [ ] **Step 2: Add new `AIPromptPurpose` values**

In `src/types/database.ts`, add `item_critique` and `synthetic_respondent` to the union:

```typescript
export type AIPromptPurpose =
  | 'competency_matching'
  | 'ranking_explanation'
  | 'diagnostic_analysis'
  | 'item_generation'
  | 'factor_item_generation'
  | 'library_import_structuring'
  | 'preflight_analysis'
  | 'embedding'
  | 'chat'
  | 'report_narrative'
  | 'report_strengths_analysis'
  | 'report_development_advice'
  | 'item_critique'
  | 'synthetic_respondent'
```

- [ ] **Step 3: Add `pipeline_metadata` to `GeneratedItem`**

In `src/types/database.ts`, add a JSONB field to `GeneratedItem` (after `facet`):

```typescript
  pipeline_metadata?: {
    critiqueVerdict?: 'kept' | 'revised' | 'dropped'
    critiqueReason?: string
    critiqueOriginalStem?: string
    leakageScore?: number
    leakageTarget?: string
    difficultyEstimate?: number
  }
```

- [ ] **Step 4: Extend `RemovalStage` type**

In `src/types/generation.ts`, update:

```typescript
export type RemovalStage = 'critique' | 'leakage' | 'uva' | 'boot_ega' | 'kept'
```

Also update `GeneratedItem.removalStage` in `src/types/database.ts` (line 1663) — it uses a hardcoded literal union instead of referencing the `RemovalStage` type. Change:

```typescript
  removalStage?: 'uva' | 'boot_ega' | 'kept'
```

to:

```typescript
  removalStage?: 'critique' | 'leakage' | 'uva' | 'boot_ega' | 'kept'
```

- [ ] **Step 5: Add pipeline stage metadata to `ScoredCandidateItem`**

In `src/types/generation.ts`, add fields to `ScoredCandidateItem` (after `isUnstable`):

```typescript
export interface ScoredCandidateItem extends CandidateItem {
  embedding: number[]
  communityId?: number
  initialCommunityId?: number
  finalCommunityId?: number
  wtoMax?: number
  bootStability?: number
  removalStage?: RemovalStage
  removalSweep?: number
  isRedundant: boolean
  isUnstable: boolean
  // Tier 2 pipeline stage data
  critiqueVerdict?: 'kept' | 'revised' | 'dropped'
  critiqueReason?: string
  critiqueOriginalStem?: string
  leakageScore?: number
  leakageTarget?: string
  difficultyEstimate?: number
}
```

- [ ] **Step 6: Add `pipelineStages` to `PipelineResult.aiSnapshot`**

In `src/types/generation.ts`, extend the `aiSnapshot` type in `PipelineResult`:

```typescript
  aiSnapshot?: {
    models?: Record<string, string>
    prompts?: Record<string, { id: string; version: number }>
    preflight?: {
      similarityThreshold: number
      pairCount: number
      llmPairCount: number
    }
    embeddingType?: EmbeddingType
    networkEstimator?: NetworkEstimator
    walktrapStep?: number
    nmiByStage?: Partial<Record<'initial' | 'postEmbeddingSelection' | 'postUva' | 'postBoot' | 'final', number>>
    uvaSweeps?: number
    bootSweeps?: number
    pipelineStages?: {
      critique?: { itemsReviewed: number; kept: number; revised: number; dropped: number; critiqueFailed?: boolean }
      leakageGuard?: { itemsChecked: number; flagged: number }
      difficultyTargeting?: { enabled: true }
      syntheticValidation?: { respondentsGenerated: number; estimatedAlpha?: Record<string, number> }
    }
  }
```

Also add the same `pipelineStages` field to the `aiSnapshot` type in `GenerationRun` in `src/types/database.ts` (around line 1626).

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/types/database.ts src/types/generation.ts
git commit -m "feat(pipeline-tier2): extend types for configurable pipeline stages"
```

---

### Task 2: Database Migration — Enum Extension, Pipeline Metadata Column, Model Config Seeds

**Files:**
- Create: `supabase/migrations/00063_pipeline_tier2_foundation.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/00063_pipeline_tier2_foundation.sql`:

```sql
-- =============================================================================
-- Migration 00063: Pipeline Tier 2 Foundation
--
-- 1. Extend ai_prompt_purpose enum with item_critique, synthetic_respondent
-- 2. Add pipeline_metadata JSONB column to generated_items
-- 3. Update removal_stage check constraint to allow 'critique' and 'leakage'
-- 4. Seed default model configs for new purposes
-- 5. Seed default system prompts for new purposes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend ai_prompt_purpose enum
-- ---------------------------------------------------------------------------

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'item_critique';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'synthetic_respondent';

-- ---------------------------------------------------------------------------
-- 2. Add pipeline_metadata JSONB column to generated_items
-- ---------------------------------------------------------------------------

ALTER TABLE generated_items
  ADD COLUMN IF NOT EXISTS pipeline_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN generated_items.pipeline_metadata IS
  'Per-item metadata from Tier 2 pipeline stages (critique verdicts, leakage scores, difficulty estimates)';

-- ---------------------------------------------------------------------------
-- 3. Update removal_stage check constraint
-- ---------------------------------------------------------------------------

-- IMPORTANT: This migration must NOT be wrapped in BEGIN/COMMIT because
-- ALTER TYPE ADD VALUE cannot run inside a transaction block in PostgreSQL.

ALTER TABLE generated_items DROP CONSTRAINT IF EXISTS generated_items_removal_stage_check;

ALTER TABLE generated_items
  ADD CONSTRAINT generated_items_removal_stage_check
  CHECK (removal_stage IS NULL OR removal_stage IN ('critique', 'leakage', 'uva', 'boot_ega', 'kept'));

-- ---------------------------------------------------------------------------
-- 4. Seed default model configs for new purposes
-- ---------------------------------------------------------------------------

-- Use the same provider as existing configs (OpenRouter)
INSERT INTO ai_model_configs (provider_id, model_id, display_name, purpose, config)
SELECT
  provider_id,
  model_id,
  model_id,
  'item_critique'::ai_prompt_purpose,
  config
FROM ai_model_configs
WHERE purpose = 'item_generation'
ON CONFLICT DO NOTHING;

INSERT INTO ai_model_configs (provider_id, model_id, display_name, purpose, config)
SELECT
  provider_id,
  model_id,
  model_id,
  'synthetic_respondent'::ai_prompt_purpose,
  config
FROM ai_model_configs
WHERE purpose = 'chat'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Seed default system prompts for new purposes
-- ---------------------------------------------------------------------------

SELECT activate_ai_system_prompt(
  'item_critique',
  'Item Critique v1',
  $$You are an expert psychometrician reviewing AI-generated self-report items for quality and construct validity. Your task is to evaluate each item in a batch and decide whether it should be kept as-is, revised with specific improvements, or dropped entirely.

## Evaluation Criteria

For each item, assess:

1. **Construct purity** — Does this item clearly measure the target construct and nothing else? Would a factor analysis place it cleanly on the intended factor?
2. **Discriminant validity** — Could this item cross-load onto any of the contrast constructs? If it fits multiple constructs equally well, it should be dropped.
3. **Inflation risk** — Would someone genuinely LOW on this construct still rate themselves 4-5 on a 5-point scale? If yes, the item needs more specificity, friction, or trade-off framing.
4. **Readability** — Is the item accessible at an 8th-grade reading level? No jargon, no double-barrelled statements, no ambiguous pronouns.
5. **Reverse-key quality** — If reverse-scored, does it describe a genuine, non-deficient alternative? Not a straw man or trivial negation.

## Verdicts

For each item, assign one verdict:
- **keep** — Item meets all criteria. No changes needed.
- **revise** — Item has potential but needs specific improvements. Provide the revised stem and explain what was changed.
- **drop** — Item is fundamentally flawed (wrong construct, unfixable cross-loading, straw man). Explain why.

## Output Format

Return a JSON array with one entry per input item, in the same order:
[{ "originalStem": "...", "verdict": "keep|revise|drop", "revisedStem": "...(only if verdict is revise)", "reason": "one sentence explanation (required for revise and drop)" }]$$
);

SELECT activate_ai_system_prompt(
  'synthetic_respondent',
  'Synthetic Respondent v1',
  $$You are simulating how a specific person would respond to a set of self-report psychometric items. You will be given a persona description and a list of items. Rate each item on a 1-5 Likert scale as that persona would.

## Rating Scale
1 = Strongly Disagree
2 = Disagree
3 = Neutral
4 = Agree
5 = Strongly Agree

## Instructions
- Stay in character as the described persona throughout.
- Consider the persona's trait levels when rating. A persona described as "high conscientiousness" should rate conscientiousness items higher than someone described as "low conscientiousness".
- Add natural variance — do not give the same rating to every item. Real people have nuanced responses even within a single trait.
- Reverse-scored items should be rated inversely (a high-trait persona should disagree with reverse-scored items).

## Output Format
Return a JSON array of ratings in the same order as the items:
[{ "itemIndex": 0, "rating": 4 }, { "itemIndex": 1, "rating": 2 }, ...]$$
);
```

- [ ] **Step 2: Verify migration syntax**

Run: `npm run db:status 2>&1 | tail -5`
Expected: Shows the new migration as pending (or similar status output)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00063_pipeline_tier2_foundation.sql
git commit -m "feat(pipeline-tier2): add migration for enum extension, pipeline_metadata column, and seed prompts"
```

---

### Task 3: Update Item Insert to Persist Pipeline Metadata

**Files:**
- Modify: `src/app/actions/generation.ts:383-404` (item insert mapping)

- [ ] **Step 1: Add `pipeline_metadata` to the item insert**

In `src/app/actions/generation.ts`, find the `generated_items` insert (around line 383-404). Add `pipeline_metadata` to the mapped object:

```typescript
      const { error: insertError } = await db.from('generated_items').insert(
        scoredItems.map((item: ScoredCandidateItem) => ({
          generation_run_id: runId,
          construct_id:      item.constructId,
          stem:              item.stem,
          reverse_scored:    item.reverseScored,
          rationale:         item.rationale ?? null,
          embedding:         item.embedding,
          community_id:      item.communityId ?? item.finalCommunityId ?? item.initialCommunityId ?? null,
          initial_community_id: item.initialCommunityId ?? null,
          final_community_id: item.finalCommunityId ?? null,
          wto_max:           item.wtoMax ?? null,
          boot_stability:    item.bootStability ?? null,
          removal_stage:     item.removalStage ?? null,
          removal_sweep:     item.removalSweep ?? null,
          is_redundant:      item.isRedundant,
          is_unstable:       item.isUnstable,
          difficulty_tier:   item.difficultyTier ?? null,
          sd_risk:           item.sdRisk ?? null,
          facet:             item.facet ?? null,
          pipeline_metadata: {
            ...(item.critiqueVerdict ? {
              critiqueVerdict: item.critiqueVerdict,
              ...(item.critiqueReason ? { critiqueReason: item.critiqueReason } : {}),
              ...(item.critiqueOriginalStem ? { critiqueOriginalStem: item.critiqueOriginalStem } : {}),
            } : {}),
            ...(item.leakageScore !== undefined ? {
              leakageScore: item.leakageScore,
              ...(item.leakageTarget ? { leakageTarget: item.leakageTarget } : {}),
            } : {}),
            ...(item.difficultyEstimate !== undefined ? { difficultyEstimate: item.difficultyEstimate } : {}),
          },
        }))
      )
```

- [ ] **Step 2: Update the `GeneratedItem` read mapping**

Find where `generated_items` rows are read and mapped to `GeneratedItem` objects. Search for `mapGeneratedItemRow` or where the select query maps results. Ensure `pipeline_metadata` is included in the select and mapped to the type.

If items are read with `select('*')`, the new column will be included automatically. Just ensure the `GeneratedItem` type (already updated in Task 1) matches.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/generation.ts
git commit -m "feat(pipeline-tier2): persist pipeline_metadata on generated items"
```

---

### Task 4: Pipeline Toggle UI in Wizard

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx` (Step3Configure component)

- [ ] **Step 1: Add pipeline toggle defaults to WizardConfig**

Find the `WizardConfig` interface and `DEFAULT_CONFIG` (around lines 58-72). Add the four toggle fields:

```typescript
interface WizardConfig {
  selectedConstructIds: string[];
  targetItemsPerConstruct: number;
  temperature: number;
  generationModel: string;
  embeddingModel: string;
  responseFormatId?: string;
  promptPurpose: 'item_generation' | 'factor_item_generation';
  enableItemCritique: boolean;
  enableLeakageGuard: boolean;
  enableDifficultyTargeting: boolean;
  enableSyntheticValidation: boolean;
}
```

Update `DEFAULT_CONFIG` to include defaults:

```typescript
const DEFAULT_CONFIG: WizardConfig = {
  // ... existing defaults ...
  enableItemCritique: true,
  enableLeakageGuard: true,
  enableDifficultyTargeting: false,
  enableSyntheticValidation: false,
};
```

- [ ] **Step 2: Add toggle cards to Step3Configure**

In the `Step3Configure` component, after the Response Format section (around line 1414), add a new "Pipeline Options" section. Use the existing `Card` and `Switch` components:

```tsx
        {/* Pipeline Options */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Pipeline Options</label>
          <p className="text-xs text-muted-foreground">
            Optional quality stages that run during generation. Enabled stages improve item quality but increase processing time.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                key: "enableItemCritique" as const,
                label: "Item Critique",
                description: "A second AI model reviews each batch for construct purity, inflation risk, and readability.",
                cost: "+1 LLM call per batch",
              },
              {
                key: "enableLeakageGuard" as const,
                label: "Leakage Guard",
                description: "Checks each item's embedding against other constructs to catch cross-loading during generation.",
                cost: "Embedding comparison (fast)",
                requiresMultiple: true,
              },
              {
                key: "enableDifficultyTargeting" as const,
                label: "Difficulty Targeting",
                description: "Steers generation toward difficulty gaps so the item pool covers easy, moderate, and hard items.",
                cost: "Embedding analysis between batches",
              },
              {
                key: "enableSyntheticValidation" as const,
                label: "Synthetic Validation",
                description: "Simulates respondent data to estimate factor structure and reliability before human testing.",
                cost: "+50-100 LLM calls per construct",
              },
            ].map((option) => {
              const isDisabled = option.requiresMultiple && config.selectedConstructIds.length < 2;
              const isChecked = isDisabled ? false : config[option.key];
              return (
                <Card key={option.key} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                      <p className="text-caption text-muted-foreground/70 mt-1">
                        {isDisabled ? "Requires 2+ constructs" : option.cost}
                      </p>
                    </div>
                    <Switch
                      checked={isChecked}
                      onCheckedChange={(checked) => onChange({ [option.key]: checked } as Partial<WizardConfig>)}
                      disabled={isDisabled}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
```

Add the `Switch` import at the top of the file if not already present:

```typescript
import { Switch } from "@/components/ui/switch"
```

- [ ] **Step 3: Thread toggle values into the generation run config**

Find where the `GenerationRunConfig` is assembled before `createGenerationRun` (search for `const runConfig`). Add the toggle fields:

```typescript
        const runConfig: GenerationRunConfig = {
          // ... existing fields ...
          enableItemCritique: config.enableItemCritique,
          enableLeakageGuard: config.enableLeakageGuard,
          enableDifficultyTargeting: config.enableDifficultyTargeting,
          enableSyntheticValidation: config.enableSyntheticValidation,
        };
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/generate/new/page.tsx"
git commit -m "feat(pipeline-tier2): add pipeline option toggles to generation wizard"
```

---

### Task 5: Review UI — Pipeline Funnel Summary

**Files:**
- Modify: `src/app/(dashboard)/generate/[runId]/page.tsx` (ReviewView component)

- [ ] **Step 1: Add funnel summary card to ReviewView**

In the `ReviewView` component (around line 163), before the existing content (network graph, item table), add a pipeline funnel summary. Insert it after the component's state declarations and before the return's main content:

Compute the funnel data from items and run:

```typescript
  // Pipeline funnel stats
  const funnelStats = React.useMemo(() => {
    const total = items.length;
    const stages = run.aiSnapshot?.pipelineStages;
    // Critique drops happen before items enter the DB, so use the aiSnapshot count
    const droppedByCritique = stages?.critique?.dropped ?? 0;
    const droppedByLeakage = items.filter((i) => i.removalStage === 'leakage').length;
    const droppedByUva = items.filter((i) => i.removalStage === 'uva').length;
    const droppedByBoot = items.filter((i) => i.removalStage === 'boot_ega').length;
    const kept = items.filter((i) => i.removalStage === 'kept').length;
    // Total generated includes critique drops (which aren't in the items array)
    const totalGenerated = total + droppedByCritique;

    return { totalGenerated, droppedByCritique, droppedByLeakage, droppedByUva, droppedByBoot, kept, stages };
  }, [items, run.aiSnapshot]);
```

Then in the JSX, add the funnel card at the top of the review content:

```tsx
      {/* Pipeline Funnel Summary */}
      <Card className="p-5">
        <p className="text-sm font-semibold mb-3">Pipeline Funnel</p>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="tabular-nums font-medium">{funnelStats.totalGenerated} generated</span>
          {funnelStats.droppedByCritique > 0 && (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                −{funnelStats.droppedByCritique} critique
              </span>
            </>
          )}
          {funnelStats.droppedByLeakage > 0 && (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                −{funnelStats.droppedByLeakage} leakage
              </span>
            </>
          )}
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            −{funnelStats.droppedByUva} redundancy
          </span>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            −{funnelStats.droppedByBoot} instability
          </span>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="tabular-nums font-semibold text-primary">{funnelStats.kept} kept</span>
        </div>
        {run.config.enableItemCritique === false && run.config.enableLeakageGuard === false && (
          <p className="text-caption text-muted-foreground mt-2">
            Item Critique and Leakage Guard were disabled for this run.
          </p>
        )}
      </Card>
```

Add `ChevronRight` to the lucide-react imports if not already present.

- [ ] **Step 2: Update progress steps to be dynamic**

Replace the static `PIPELINE_STEPS` array (line 44-52) with a function that builds steps based on config:

```typescript
function buildPipelineSteps(config?: GenerationRunConfig) {
  const steps = [
    { key: "preflight", label: "Pre-flight Check", description: "Validate constructs and config" },
    { key: "item_generation", label: "Item Generation", description: "Generate candidate items with LLM" },
  ]

  if (config?.enableItemCritique !== false) {
    steps.push({ key: "item_critique", label: "Item Critique", description: "AI review of generated items" })
  }

  steps.push(
    { key: "embedding", label: "Embedding", description: "Compute semantic embeddings" },
  )

  if (config?.enableLeakageGuard !== false) {
    steps.push({ key: "leakage_check", label: "Leakage Guard", description: "Cross-construct leakage detection" })
  }

  steps.push(
    { key: "initial_ega", label: "Network Analysis (EGA)", description: "Exploratory graph analysis" },
    { key: "uva", label: "Redundancy Removal", description: "Unique variable analysis (UVA)" },
    { key: "boot_ega", label: "Stability Check", description: "Bootstrap EGA for stability" },
  )

  if (config?.enableSyntheticValidation) {
    steps.push({ key: "synthetic_validation", label: "Synthetic Validation", description: "In silico respondent simulation" })
  }

  steps.push({ key: "final", label: "Review Ready", description: "Items ready for human review" })

  return steps
}
```

Update `ProgressView` to use `buildPipelineSteps(run.config)` instead of the static `PIPELINE_STEPS` constant. Also update the `PipelineStepKey` type to derive from the default array:

```typescript
type PipelineStepKey = (typeof PIPELINE_STEPS_DEFAULT)[number]["key"]
```

Keep the old `PIPELINE_STEPS` as a fallback renamed to `PIPELINE_STEPS_DEFAULT`:

```typescript
const PIPELINE_STEPS_DEFAULT = [
  { key: "preflight", label: "Pre-flight Check", description: "Validate constructs and config" },
  { key: "item_generation", label: "Item Generation", description: "Generate candidate items with LLM" },
  { key: "embedding", label: "Embedding", description: "Compute semantic embeddings" },
  { key: "initial_ega", label: "Network Analysis (EGA)", description: "Exploratory graph analysis" },
  { key: "uva", label: "Redundancy Removal", description: "Unique variable analysis (UVA)" },
  { key: "boot_ega", label: "Stability Check", description: "Bootstrap EGA for stability" },
  { key: "final", label: "Review Ready", description: "Items ready for human review" },
] as const
```

In `ProgressView`, use:
```typescript
  const pipelineSteps = run.config ? buildPipelineSteps(run.config) : PIPELINE_STEPS_DEFAULT
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/generate/[runId]/page.tsx"
git commit -m "feat(pipeline-tier2): add pipeline funnel summary and dynamic progress steps to review UI"
```

---

### Task 6: Update Model Settings Purpose Metadata

**IMPORTANT:** This task is compile-blocking after Task 1. `PURPOSE_META` is typed as `Record<AIPromptPurpose, PurposeMeta>` — once Task 1 adds `item_critique` and `synthetic_respondent` to `AIPromptPurpose`, TypeScript will error until this task adds the corresponding entries.

**Files:**
- Modify: `src/lib/ai/purpose-meta.ts` (PURPOSE_META record and PURPOSE_ORDER array)

- [ ] **Step 1: Add purpose metadata for new model configs**

In `src/lib/ai/purpose-meta.ts`, add entries for the two new purposes to the `PURPOSE_META` record:

```typescript
  item_critique: {
    label: "Item Critique",
    description: "Reviews generated items for construct purity, discriminant validity, and readability.",
    icon: ScanSearch,
    glowColor: "var(--primary)",
  },
  synthetic_respondent: {
    label: "Synthetic Respondent",
    description: "Simulates persona-conditioned respondents for in silico scale validation.",
    icon: MessageSquare,
    glowColor: "var(--primary)",
  },
```

Also add them to the `PURPOSE_ORDER` array in the appropriate position (after the existing generation-related purposes).

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/purpose-meta.ts
git commit -m "feat(pipeline-tier2): add item_critique and synthetic_respondent to model settings"
```

---

### Task 7: Full Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Manual smoke test**

1. Open the generation wizard (`/generate/new`)
2. Select 3+ constructs, advance to Step 3
3. Verify the four Pipeline Options toggle cards appear below the existing config
4. Verify Leakage Guard auto-disables when only 1 construct is selected
5. Toggle options on/off and verify they're reflected in the config
6. Open `/settings/ai` (or `/settings/models`) and verify "Item Critique" and "Synthetic Respondent" model selectors appear
7. Do NOT launch a generation run yet — the pipeline stages don't exist yet. This is foundation only.
