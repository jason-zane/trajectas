# Preflight Refinement Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cosine score education, AI-assisted construct refinement with before/after diffs, and save-to-library capability to the generation wizard's preflight step.

**Architecture:** Three features layered onto Step 2 of the existing generation wizard. Feature 1 is pure UI. Feature 2 adds a new server action + LLM prompt that analyses overlap diagnostics and parent factor context to suggest targeted field edits. Feature 3 adds a server action in `constructs.ts` that persists draft edits to the DB. All features integrate into the existing `page.tsx` wizard component.

**Tech Stack:** Next.js server actions, OpenRouter LLM (via existing `preflight_analysis` model config), Supabase Postgres, React state management, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-04-01-preflight-refinement-enhancements-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/types/generation.ts` | Shared `ConstructDraftState` type (extracted from page.tsx) |
| `src/lib/ai/generation/prompts/construct-refinement.ts` | **New** — `buildRefinementPrompt()` + `parseRefinementResponse()` |
| `src/app/actions/generation.ts` | `suggestConstructRefinements` + `fetchParentFactorsForConstruct` server actions |
| `src/app/actions/constructs.ts` | `saveConstructDraftToLibrary` server action |
| `src/app/(dashboard)/generate/new/page.tsx` | All three UI features: cosine guide, suggestion UI, save button |

---

### Task 1: Extract `ConstructDraftState` to shared types

**Files:**
- Modify: `src/types/generation.ts`
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

- [ ] **Step 1: Add `ConstructDraftState` to `src/types/generation.ts`**

Add after the `ConstructDraftInput` interface (around line 51):

```typescript
/** Draft state for construct fields during the generation wizard refinement flow. */
export interface ConstructDraftState {
  definition: string
  description: string
  indicatorsLow: string
  indicatorsMid: string
  indicatorsHigh: string
}

export type ConstructDraftField = keyof ConstructDraftState
```

- [ ] **Step 2: Update `page.tsx` to import the shared type**

In `src/app/(dashboard)/generate/new/page.tsx`:

1. Add `ConstructDraftState` and `ConstructDraftField` to the import from `@/types/generation` (line 42)
2. Remove the local `ConstructDraftState` interface (lines 71-77)
3. Remove the local `DraftField` type alias (line 79): `type DraftField = keyof ConstructDraftState` — replace ALL usages with `ConstructDraftField`, including:
   - The `Step2ReadinessCheck` prop type at line 333: `onDraftChange: (constructId: string, field: ConstructDraftField, value: string) => void`
   - Any other references to `DraftField` in the file
4. Keep `ConstructDraftMap` as-is (it references the now-imported type): `type ConstructDraftMap = Record<string, ConstructDraftState>`

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/generation.ts src/app/\(dashboard\)/generate/new/page.tsx
git commit -m "refactor: extract ConstructDraftState to shared types"
```

---

### Task 2: Build the refinement prompt and parser

**Files:**
- Create: `src/lib/ai/generation/prompts/construct-refinement.ts`

- [ ] **Step 1: Create `construct-refinement.ts`**

This file exports two functions. Pattern follows `construct-discrimination.ts`.

```typescript
// src/lib/ai/generation/prompts/construct-refinement.ts

import type { ConstructDraftState } from '@/types/generation'

interface RefinementPairContext {
  otherConstructName: string
  cosineSimilarity: number
  overlapSummary?: string
  sharedSignals?: string[]
  uniqueSignalsForTarget?: string[]
  refinementGuidance?: string
}

interface ParentFactorContext {
  name: string
  definition?: string
  indicatorsHigh?: string
}

export interface RefinementSuggestion {
  field: keyof ConstructDraftState
  original: string
  suggested: string
  reason: string
}

export interface RefinementResult {
  analysis: string
  suggestions: RefinementSuggestion[]
}

export function buildRefinementPrompt(params: {
  constructName: string
  currentDraft: ConstructDraftState
  overlappingPairs: RefinementPairContext[]
  parentFactors: ParentFactorContext[]
}): string {
  const { constructName, currentDraft, overlappingPairs, parentFactors } = params

  const pairsSection = overlappingPairs.map((pair) => {
    const parts = [`- **${pair.otherConstructName}** (cosine: ${pair.cosineSimilarity.toFixed(3)})`]
    if (pair.overlapSummary) parts.push(`  Overlap: ${pair.overlapSummary}`)
    if (pair.sharedSignals?.length) parts.push(`  Shared signals: ${pair.sharedSignals.join(', ')}`)
    if (pair.uniqueSignalsForTarget?.length) parts.push(`  Unique to ${constructName}: ${pair.uniqueSignalsForTarget.join(', ')}`)
    if (pair.refinementGuidance) parts.push(`  Guidance: ${pair.refinementGuidance}`)
    return parts.join('\n')
  }).join('\n')

  const factorSection = parentFactors.length > 0
    ? `\n## Parent Factors\nThis construct sits beneath the following higher-order factor(s). Use this hierarchy to inform the sharpening direction.\n${parentFactors.map((f) => {
        const parts = [`- **${f.name}**`]
        if (f.definition) parts.push(`  Definition: ${f.definition}`)
        if (f.indicatorsHigh) parts.push(`  High-performer indicators: ${f.indicatorsHigh}`)
        return parts.join('\n')
      }).join('\n')}\n\nIf the construct sits under multiple factors, look for a sharpening direction that serves all of them, or note where the factor contexts suggest different directions.`
    : ''

  const fieldsSection = [
    `Definition: ${currentDraft.definition || '(empty)'}`,
    `Description: ${currentDraft.description || '(empty)'}`,
    `Low indicators: ${currentDraft.indicatorsLow || '(empty)'}`,
    `Mid indicators: ${currentDraft.indicatorsMid || '(empty)'}`,
    `High indicators: ${currentDraft.indicatorsHigh || '(empty)'}`,
  ].join('\n')

  return `Analyse the following construct and suggest targeted improvements to reduce overlap with neighbouring constructs. Only suggest changes to fields that are contributing to the overlap — leave distinct fields untouched.

## Construct: ${constructName}

### Current Fields
${fieldsSection}

## Overlapping Constructs
${pairsSection}
${factorSection}

## Instructions

1. Identify which fields (definition, description, indicatorsLow, indicatorsMid, indicatorsHigh) are driving the overlap.
2. For each problematic field, suggest a revised version that preserves the original meaning while removing the overlap territory.
3. Do NOT suggest changes to fields that are already distinct — omit them from the suggestions array.
4. In your analysis, explain what is driving the overlap and what sharpening direction you recommend.

Respond in JSON:
{
  "analysis": "2-3 sentences explaining what drives the overlap and the recommended direction",
  "suggestions": [
    {
      "field": "definition | description | indicatorsLow | indicatorsMid | indicatorsHigh",
      "original": "the current text",
      "suggested": "the improved text",
      "reason": "one sentence why this field needs change"
    }
  ]
}`
}

const VALID_FIELDS = new Set(['definition', 'description', 'indicatorsLow', 'indicatorsMid', 'indicatorsHigh'])

export function parseRefinementResponse(jsonContent: string): RefinementResult | null {
  try {
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    if (typeof parsed.analysis !== 'string') return null

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is RefinementSuggestion =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Record<string, unknown>).field === 'string' &&
          VALID_FIELDS.has((s as Record<string, unknown>).field as string) &&
          typeof (s as Record<string, unknown>).original === 'string' &&
          typeof (s as Record<string, unknown>).suggested === 'string' &&
          typeof (s as Record<string, unknown>).reason === 'string'
        )
      : []

    return {
      analysis: parsed.analysis,
      suggestions,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/generation/prompts/construct-refinement.ts
git commit -m "feat: add construct refinement prompt builder and parser"
```

---

### Task 3: Add `fetchParentFactorsForConstruct` server action

**Files:**
- Modify: `src/app/actions/generation.ts`

- [ ] **Step 1: Add the server action**

Add at the end of `src/app/actions/generation.ts`, before the closing of the file. Follow the existing pattern from `fetchConstructsForRun` (line 608).

```typescript
// ---------------------------------------------------------------------------
// Parent factor context for refinement suggestions
// ---------------------------------------------------------------------------

export async function fetchParentFactorsForConstruct(
  constructId: string,
): Promise<Array<{ name: string; definition?: string; indicatorsHigh?: string }>> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('factor_constructs')
    .select('factors!inner(name, definition, indicators_high)')
    .eq('construct_id', constructId)

  if (error || !data) return []

  return data.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factor = (row as any).factors as { name: string; definition?: string; indicators_high?: string }
    return {
      name: factor.name,
      definition: factor.definition ?? undefined,
      indicatorsHigh: factor.indicators_high ?? undefined,
    }
  })
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/generation.ts
git commit -m "feat: add fetchParentFactorsForConstruct server action"
```

---

### Task 4: Add `suggestConstructRefinements` server action

**Files:**
- Modify: `src/app/actions/generation.ts`

- [ ] **Step 1: Add imports**

At the top of `src/app/actions/generation.ts`, add to the existing imports from `@/types/generation`:

```typescript
import type { ConstructDraftState } from '@/types/generation'
```

- [ ] **Step 2: Add the server action**

Add after `fetchParentFactorsForConstruct`:

```typescript
// ---------------------------------------------------------------------------
// AI-assisted construct refinement
// ---------------------------------------------------------------------------

export async function suggestConstructRefinements(params: {
  constructId: string
  constructName: string
  currentDraft: ConstructDraftState
  overlappingPairs: Array<{
    otherConstructName: string
    cosineSimilarity: number
    overlapSummary?: string
    sharedSignals?: string[]
    uniqueSignalsForTarget?: string[]
    refinementGuidance?: string
  }>
  parentFactors: Array<{
    name: string
    definition?: string
    indicatorsHigh?: string
  }>
}): Promise<
  | { success: true; analysis: string; suggestions: Array<{ field: string; original: string; suggested: string; reason: string }> }
  | { success: false; error: string }
> {
  await requireAdminScope()

  try {
    const { getModelForTask } = await import('@/lib/ai/model-config')
    const { openRouterProvider } = await import('@/lib/ai/providers/openrouter')
    const { buildRefinementPrompt, parseRefinementResponse } = await import(
      '@/lib/ai/generation/prompts/construct-refinement'
    )

    const taskConfig = await getModelForTask('preflight_analysis')

    const prompt = buildRefinementPrompt({
      constructName: params.constructName,
      currentDraft: params.currentDraft,
      overlappingPairs: params.overlappingPairs,
      parentFactors: params.parentFactors,
    })

    const response = await openRouterProvider.complete({
      model: taskConfig.modelId,
      systemPrompt:
        'You are an expert psychometrician specialising in construct definition and discriminant validity. Your task is to suggest targeted improvements to construct definitions to reduce overlap with neighbouring constructs while preserving meaning.',
      prompt,
      temperature: taskConfig.config.temperature,
      maxTokens: taskConfig.config.max_tokens,
      responseFormat: 'json',
    })

    const result = parseRefinementResponse(response.content)
    if (!result) {
      return { success: false, error: 'Could not parse refinement suggestions' }
    }

    return {
      success: true,
      analysis: result.analysis,
      suggestions: result.suggestions,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Refinement suggestion failed',
    }
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/generation.ts
git commit -m "feat: add suggestConstructRefinements server action"
```

---

### Task 5: Add `saveConstructDraftToLibrary` server action

**Files:**
- Modify: `src/app/actions/constructs.ts`

- [ ] **Step 1: Add the server action**

Add at the end of `src/app/actions/constructs.ts`, after `updateConstructField` (line 393). Reuse the existing `ALLOWED_FIELDS` mapping (line 356) and follow the `updateConstructField` pattern.

```typescript
// ---------------------------------------------------------------------------
// Bulk field save from generation wizard refinement
// ---------------------------------------------------------------------------

export async function saveConstructDraftToLibrary(
  constructId: string,
  fields: Partial<Record<string, string>>,
): Promise<
  | { success: true; updatedFields: string[]; savedValues: Record<string, string> }
  | { success: false; error: string }
> {
  const scope = await requireAdminScope()

  // Validate and map field names
  const updatePayload: Record<string, string | null> = {}
  const updatedFields: string[] = []
  const savedValues: Record<string, string> = {}

  for (const [field, value] of Object.entries(fields)) {
    const dbField = ALLOWED_FIELDS[field]
    if (!dbField) continue
    updatePayload[dbField] = value || null
    updatedFields.push(field)
    savedValues[field] = value ?? ''
  }

  if (updatedFields.length === 0) {
    return { success: false, error: 'No valid fields to update' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update(updatePayload)
    .eq('id', constructId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/constructs')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.draft_saved_to_library',
    targetTable: 'constructs',
    targetId: constructId,
    metadata: { updatedFields },
  })

  return { success: true, updatedFields, savedValues }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/constructs.ts
git commit -m "feat: add saveConstructDraftToLibrary server action"
```

---

### Task 6: Add cosine score context UI (Feature 1)

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

- [ ] **Step 1: Add the cosine guide below the metadata panel**

In `page.tsx`, find the metadata panel (the `{metadata && (` block around line 536). After the closing `</div>` of the metadata panel (around line 564), add the cosine guide:

```tsx
{metadata && (
  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
    <p className="text-overline">Understanding cosine similarity</p>
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {[
        { range: "< 0.30", label: "Clearly distinct", color: "bg-green-500" },
        { range: "0.30 – < 0.50", label: "Low overlap", color: "bg-green-500" },
        { range: "0.50 – < 0.75", label: "Review recommended", color: "bg-amber-500" },
        { range: "≥ 0.75", label: "High overlap — refine", color: "bg-red-500" },
      ].map(({ range, label, color }) => (
        <span key={range} className="inline-flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${color}`} />
          <span><strong className="text-foreground">{range}</strong> — {label}</span>
        </span>
      ))}
    </div>
    <p>
      Cosine similarity measures how close two construct definitions are in meaning. Lower is more distinct. Pairs at 0.50 or above are reviewed by AI; 0.75 or above usually indicates genuine overlap.
    </p>
  </div>
)}
```

Place this immediately after the existing metadata stats `<div>` but still inside the `{preflightResult && (` block.

- [ ] **Step 2: Verify in browser**

Run the dev server, navigate to `/generate/new`, select 2+ constructs, and verify the cosine guide appears below the metadata stats after the readiness check completes.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/generate/new/page.tsx
git commit -m "feat: add cosine score context guide to preflight UI"
```

---

### Task 7: Add suggestion state and A/B signal resolution helper

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

- [ ] **Step 1: Add imports for the new server actions**

Update the import from `@/app/actions/generation` (line 34-39) to include:

```typescript
import {
  getConstructsForGeneration,
  getResponseFormatsForGeneration,
  createGenerationRun,
  checkConstructReadiness,
  suggestConstructRefinements,
  fetchParentFactorsForConstruct,
} from "@/app/actions/generation";
```

Add import for the save action:

```typescript
import { saveConstructDraftToLibrary } from "@/app/actions/constructs";
```

Update the import from `@/types/generation` (line 42) to include `ConstructDraftState`, `ConstructDraftField`, and `ConstructPairResult`:

```typescript
import type {
  ConstructDraftInput,
  PreflightResult,
  ConstructPairResult,
  ConstructDraftState,
  ConstructDraftField,
  OpenRouterModel,
} from "@/types/generation";
```

- [ ] **Step 2: Add the A/B signal resolution helper**

Add as a module-level helper function near the other helper functions (around line 92-116):

```typescript
/** Resolve overlapping pair data for a specific construct, mapping A/B fields to target-relative fields. */
function resolveOverlappingPairs(
  constructId: string,
  pairs: ConstructPairResult[],
): Array<{
  otherConstructName: string
  cosineSimilarity: number
  overlapSummary?: string
  sharedSignals?: string[]
  uniqueSignalsForTarget?: string[]
  refinementGuidance?: string
}> {
  return pairs
    .filter((pair) => pair.reviewedByLlm && (pair.constructAId === constructId || pair.constructBId === constructId))
    .map((pair) => {
      const isA = pair.constructAId === constructId;
      return {
        otherConstructName: isA ? pair.constructBName : pair.constructAName,
        cosineSimilarity: pair.cosineSimilarity,
        overlapSummary: pair.overlapSummary,
        sharedSignals: pair.sharedSignals,
        uniqueSignalsForTarget: isA ? pair.uniqueSignalsA : pair.uniqueSignalsB,
        refinementGuidance: isA ? pair.refinementGuidanceA : pair.refinementGuidanceB,
      };
    });
}
```

- [ ] **Step 3: Add suggestion state and save state**

Inside the Step 2 component (the `ReadinessStep` function), add state variables alongside the existing preflight state:

```typescript
// AI refinement suggestion state — keyed by construct ID
const [refinementState, setRefinementState] = useState<Record<string, {
  loading: boolean
  analysis?: string
  fieldSuggestions?: Array<{
    field: ConstructDraftField
    original: string
    suggested: string
    reason: string
  }>
  error?: string
}>>({});

// Save-to-library state — keyed by construct ID
const [saveState, setSaveState] = useState<Record<string, {
  saving: boolean
  saved: boolean
}>>({});
```

- [ ] **Step 4: Clear suggestion state when preflight re-runs**

In the `runReadinessCheck` callback (around line 384), add at the start:

```typescript
setRefinementState({});
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/generate/new/page.tsx
git commit -m "feat: add refinement state, save state, and A/B signal resolution helper"
```

---

### Task 8: Add "Suggest improvements" handler and UI

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

- [ ] **Step 1: Add the suggest handler**

Inside the Step 2 component, add the handler function:

```typescript
const handleSuggestImprovements = useCallback(async (constructId: string, constructName: string) => {
  const draft = constructDrafts[constructId] ?? createConstructDraftState(
    (constructs ?? []).find((c) => c.id === constructId)
  );
  const pairs = resolveOverlappingPairs(constructId, preflightResult?.pairs ?? []);

  setRefinementState((prev) => ({
    ...prev,
    [constructId]: { loading: true },
  }));

  try {
    // Fetch parent factors — degrade gracefully on failure
    let parentFactors: Array<{ name: string; definition?: string; indicatorsHigh?: string }> = [];
    try {
      parentFactors = await fetchParentFactorsForConstruct(constructId);
    } catch {
      // Proceed without factor context
    }

    const result = await suggestConstructRefinements({
      constructId,
      constructName,
      currentDraft: draft,
      overlappingPairs: pairs,
      parentFactors,
    });

    if (result.success) {
      setRefinementState((prev) => ({
        ...prev,
        [constructId]: {
          loading: false,
          analysis: result.analysis,
          fieldSuggestions: result.suggestions as Array<{
            field: ConstructDraftField
            original: string
            suggested: string
            reason: string
          }>,
        },
      }));
    } else {
      setRefinementState((prev) => ({
        ...prev,
        [constructId]: { loading: false, error: result.error },
      }));
      toast.error("Refinement suggestion failed", { description: result.error });
    }
  } catch (err) {
    setRefinementState((prev) => ({
      ...prev,
      [constructId]: { loading: false, error: err instanceof Error ? err.message : "Unknown error" },
    }));
  }
}, [constructDrafts, constructs, preflightResult]);
```

- [ ] **Step 2: Add accept and dismiss handlers**

```typescript
const handleAcceptSuggestion = useCallback((constructId: string, field: ConstructDraftField, suggested: string) => {
  onDraftChange(constructId, field, suggested);
  setRefinementState((prev) => {
    const current = prev[constructId];
    if (!current?.fieldSuggestions) return prev;
    return {
      ...prev,
      [constructId]: {
        ...current,
        fieldSuggestions: current.fieldSuggestions.filter((s) => s.field !== field),
      },
    };
  });
}, [onDraftChange]);

const handleDismissSuggestion = useCallback((constructId: string, field: ConstructDraftField) => {
  setRefinementState((prev) => {
    const current = prev[constructId];
    if (!current?.fieldSuggestions) return prev;
    return {
      ...prev,
      [constructId]: {
        ...current,
        fieldSuggestions: current.fieldSuggestions.filter((s) => s.field !== field),
      },
    };
  });
}, []);

const handleAcceptAll = useCallback((constructId: string) => {
  const state = refinementState[constructId];
  if (!state?.fieldSuggestions) return;
  for (const suggestion of state.fieldSuggestions) {
    onDraftChange(constructId, suggestion.field, suggestion.suggested);
  }
  setRefinementState((prev) => ({
    ...prev,
    [constructId]: { ...prev[constructId]!, loading: false, fieldSuggestions: [] },
  }));
}, [refinementState, onDraftChange]);
```

- [ ] **Step 3: Add the "Suggest improvements" and "Save to library" buttons to the accordion header**

In the Refine Definitions section (around line 695-710), find the `AccordionTrigger` for each construct. Add buttons to the accordion header area. Replace the existing accordion header block for each construct with one that includes the action buttons. The buttons go OUTSIDE the `AccordionTrigger` but inside the `AccordionItem`, between the trigger and the panel:

After the `</AccordionTrigger>` and before `<AccordionPanel>`, add:

```tsx
<div className="flex items-center gap-2 px-4 pb-2">
  <Button
    variant="outline"
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      handleSuggestImprovements(construct.id, construct.name);
    }}
    disabled={refinementState[construct.id]?.loading}
    className="text-xs h-7"
  >
    {refinementState[construct.id]?.loading ? (
      <>
        <Loader2 className="size-3 animate-spin" />
        Analysing…
      </>
    ) : (
      <>
        <Wand2 className="size-3" />
        Suggest improvements
      </>
    )}
  </Button>
  {/* Save to library button — Task 9 */}
</div>
```

- [ ] **Step 4: Add the suggestion results UI inside the accordion panel**

At the top of each construct's `AccordionPanel`, before the definition textarea, add the refinement results:

```tsx
{refinementState[construct.id]?.analysis && (
  <div className="space-y-3 mb-4">
    {/* AI analysis box */}
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 p-3">
      <p className="text-overline text-indigo-600 dark:text-indigo-400 mb-1">AI Analysis</p>
      <p className="text-sm text-foreground/80 leading-relaxed">{refinementState[construct.id]!.analysis}</p>
    </div>

    {/* Per-field diffs */}
    {(refinementState[construct.id]!.fieldSuggestions ?? []).map((suggestion) => (
      <div key={suggestion.field} className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-overline">{suggestion.field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</label>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-6 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
              onClick={() => handleAcceptSuggestion(construct.id, suggestion.field, suggestion.suggested)}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-6"
              onClick={() => handleDismissSuggestion(construct.id, suggestion.field)}
            >
              Keep original
            </Button>
          </div>
        </div>
        <div className="rounded-t-md border border-b-0 border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20 p-2.5">
          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">BEFORE</span>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{suggestion.original}</p>
        </div>
        <div className="rounded-b-md border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 p-2.5">
          <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">AFTER</span>
          <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{suggestion.suggested}</p>
        </div>
        <p className="text-xs text-muted-foreground italic">{suggestion.reason}</p>
      </div>
    ))}

    {/* Unchanged fields */}
    {(['definition', 'description', 'indicatorsLow', 'indicatorsMid', 'indicatorsHigh'] as const)
      .filter((field) => !(refinementState[construct.id]!.fieldSuggestions ?? []).some((s) => s.field === field))
      .filter((field) => draft[field])
      .map((field) => (
        <div key={field} className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</span>
          <span className="italic">No change needed</span>
        </div>
      ))}

    {/* Bulk actions */}
    {(refinementState[construct.id]!.fieldSuggestions ?? []).length > 0 && (
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => handleSuggestImprovements(construct.id, construct.name)}
          disabled={refinementState[construct.id]?.loading}
        >
          <Wand2 className="size-3" />
          Re-suggest
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
          onClick={() => handleAcceptAll(construct.id)}
        >
          Accept all suggestions
        </Button>
      </div>
    )}
  </div>
)}

{refinementState[construct.id]?.error && (
  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 mb-4 flex items-start gap-2">
    <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
    <p className="text-xs text-red-700 dark:text-red-400">{refinementState[construct.id]!.error}</p>
  </div>
)}
```

- [ ] **Step 5: Verify types compile and UI renders**

Run: `npx tsc --noEmit`
Then verify in browser: navigate to `/generate/new`, select constructs, complete preflight, open Refine Definitions accordion, confirm "Suggest improvements" button appears.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/generate/new/page.tsx
git commit -m "feat: add AI-assisted refinement suggest/accept/dismiss UI"
```

---

### Task 9: Add "Save to library" button and handler

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

**Architecture note:** `setConstructs` lives in the parent `GenerateNewPage` component (line 1182), but the save handler lives in `Step2ReadinessCheck` (line 322). We need to add an `onConstructUpdate` callback prop to bridge this.

- [ ] **Step 1: Add `onConstructUpdate` prop to `Step2ReadinessCheck`**

Update the props interface (around line 329-335) to add:

```typescript
  onConstructUpdate: (constructId: string, updates: Partial<Construct>) => void;
```

In the parent component where `Step2ReadinessCheck` is rendered, wire this prop:

```tsx
onConstructUpdate={(constructId, updates) => {
  setConstructs((prev) =>
    (prev ?? []).map((c) => (c.id === constructId ? { ...c, ...updates } : c))
  );
}}
```

- [ ] **Step 2: Add the save handler**

Inside the Step 2 component, add:

```typescript
const handleSaveToLibrary = useCallback(async (constructId: string, constructName: string) => {
  const construct = (constructs ?? []).find((c) => c.id === constructId);
  if (!construct) return;

  const draft = constructDrafts[constructId] ?? createConstructDraftState(construct);
  const changedFields: Record<string, string> = {};

  if (draft.definition !== (construct.definition ?? "")) changedFields.definition = draft.definition;
  if (draft.description !== (construct.description ?? "")) changedFields.description = draft.description;
  if (draft.indicatorsLow !== (construct.indicatorsLow ?? "")) changedFields.indicatorsLow = draft.indicatorsLow;
  if (draft.indicatorsMid !== (construct.indicatorsMid ?? "")) changedFields.indicatorsMid = draft.indicatorsMid;
  if (draft.indicatorsHigh !== (construct.indicatorsHigh ?? "")) changedFields.indicatorsHigh = draft.indicatorsHigh;

  if (Object.keys(changedFields).length === 0) return;

  setSaveState((prev) => ({ ...prev, [constructId]: { saving: true, saved: false } }));

  try {
    const result = await saveConstructDraftToLibrary(constructId, changedFields);
    if (result.success) {
      // Update local constructs state via parent callback so "original" baseline matches saved values
      onConstructUpdate(constructId, Object.fromEntries(
        Object.entries(result.savedValues).map(([k, v]) => [k, v || undefined])
      ));

      setSaveState((prev) => ({ ...prev, [constructId]: { saving: false, saved: true } }));
      const fieldLabels = result.updatedFields
        .map((f) => f.replace(/([A-Z])/g, ' $1').toLowerCase())
        .join(', ');
      toast.success(`${constructName} saved to library`, { description: `Updated: ${fieldLabels}` });

      // Reset saved state after 2s
      setTimeout(() => {
        setSaveState((prev) => ({ ...prev, [constructId]: { saving: false, saved: false } }));
      }, 2000);
    } else {
      setSaveState((prev) => ({ ...prev, [constructId]: { saving: false, saved: false } }));
      toast.error("Failed to save", { description: result.error });
    }
  } catch (err) {
    setSaveState((prev) => ({ ...prev, [constructId]: { saving: false, saved: false } }));
    toast.error("Failed to save", { description: err instanceof Error ? err.message : "Unknown error" });
  }
}, [constructs, constructDrafts, onConstructUpdate]);

- [ ] **Step 2: Add the "Save to library" button**

In the button bar added in Task 8 Step 3 (the `{/* Save to library button — Task 9 */}` placeholder), replace with:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    handleSaveToLibrary(construct.id, construct.name);
  }}
  disabled={
    saveState[construct.id]?.saving ||
    saveState[construct.id]?.saved ||
    !hasConstructDraftChanges(construct.id)
  }
  className="text-xs h-7"
>
  {saveState[construct.id]?.saving ? (
    <>
      <Loader2 className="size-3 animate-spin" />
      Saving…
    </>
  ) : saveState[construct.id]?.saved ? (
    <>
      <CheckCircle2 className="size-3 text-green-600" />
      Saved
    </>
  ) : (
    "Save to library"
  )}
</Button>
```

- [ ] **Step 3: Add the `hasConstructDraftChanges` helper**

Add as a helper inside or near the Step 2 component:

```typescript
const hasConstructDraftChanges = useCallback((constructId: string) => {
  const construct = (constructs ?? []).find((c) => c.id === constructId);
  if (!construct) return false;
  const draft = constructDrafts[constructId] ?? createConstructDraftState(construct);
  return (
    draft.definition !== (construct.definition ?? "") ||
    draft.description !== (construct.description ?? "") ||
    draft.indicatorsLow !== (construct.indicatorsLow ?? "") ||
    draft.indicatorsMid !== (construct.indicatorsMid ?? "") ||
    draft.indicatorsHigh !== (construct.indicatorsHigh ?? "")
  );
}, [constructs, constructDrafts]);
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/generate/new/page.tsx
git commit -m "feat: add save-to-library button with toast and state transitions"
```

---

### Task 10: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Verify full flow in browser**

1. Navigate to `/generate/new`
2. Select 2+ constructs that have some definition overlap
3. Proceed to Step 2 — verify cosine guide appears in the metadata panel
4. Open Refine Definitions accordion — verify "Suggest improvements" and "Save to library" buttons appear
5. Click "Suggest improvements" on a construct — verify loading state, then AI analysis + before/after diffs appear
6. Accept one suggestion — verify it populates the draft field and "Re-run check to continue" appears
7. Accept all — verify bulk accept works
8. Click "Save to library" — verify saving state, toast, and "Saved" state transition
9. Re-run preflight — verify suggestions clear and new scores appear
10. Verify "Save to library" disables after save when no further edits exist

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit if any fixes needed**

Stage only the specific files that were fixed, then commit:

```bash
git commit -m "fix: address end-to-end verification issues"
```
