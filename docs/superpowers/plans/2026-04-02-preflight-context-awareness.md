# Preflight Context-Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the preflight readiness check full-set context and change tracking so that refinement suggestions are globally coherent and reruns don't create endless whack-a-mole cycles.

**Architecture:** Add a construct landscape section to both the discrimination and refinement LLM prompts so each call sees all constructs in the set (not just the pair/target). Track construct field snapshots in React state between preflight runs, passing diffs as "Changes Since Last Check" context to the LLM on reruns. For large sets (>15 constructs), group landscape entries by dimension to control token usage.

**Tech Stack:** TypeScript, React (client state), Next.js server actions, OpenRouter LLM API

**Spec:** `docs/superpowers/specs/2026-04-02-preflight-context-awareness-design.md`

---

### Task 1: Add Types for Change Tracking and Dimension Grouping

**Files:**
- Modify: `src/types/generation.ts:48-51` (ConstructDraftInput)
- Test: `tests/unit/construct-preflight.test.ts`

- [ ] **Step 1: Add `dimensionId` to `ConstructDraftInput`**

In `src/types/generation.ts`, update the `ConstructDraftInput` interface:

```typescript
export interface ConstructDraftInput extends ConstructConfigOverride {
  id: string
  name: string
  dimensionId?: string
}
```

- [ ] **Step 2: Add `ConstructChange` type**

In `src/types/generation.ts`, add after the `ConstructDraftField` type (line 62):

```typescript
/** A single field change between preflight runs, used for change-tracking context. */
export interface ConstructChange {
  constructId: string
  constructName: string
  field: string
  previousValue: string
  currentValue: string
}
```

- [ ] **Step 3: Add `ConstructSnapshot` type**

In `src/types/generation.ts`, add after `ConstructChange`:

```typescript
/** Snapshot of all construct fields at the time of a preflight run. Keyed by construct ID. */
export type ConstructSnapshot = Record<string, {
  definition?: string
  description?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
}>
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/types/generation.ts
git commit -m "feat(preflight): add ConstructChange, ConstructSnapshot types and dimensionId to ConstructDraftInput"
```

---

### Task 2: Add Full-Set Context to Discrimination Prompt

**Files:**
- Modify: `src/lib/ai/generation/prompts/construct-discrimination.ts`
- Test: `tests/unit/construct-preflight.test.ts`

- [ ] **Step 1: Write a test for landscape section inclusion**

In `tests/unit/construct-preflight.test.ts`, add a new describe block:

```typescript
import { buildDiscriminationPrompt } from "@/lib/ai/generation/prompts/construct-discrimination"

describe("buildDiscriminationPrompt context", () => {
  const constructA = { name: "Resilience", definition: "Ability to recover from setbacks" }
  const constructB = { name: "Adaptability", definition: "Ability to adjust to new conditions" }

  it("includes construct landscape when otherConstructs provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB, {
      otherConstructs: [
        { name: "Empathy", definition: "Understanding others' emotions" },
        { name: "Initiative", definition: "Taking action without being asked" },
      ],
    })

    expect(prompt).toContain("## Construct Landscape")
    expect(prompt).toContain("**Empathy**")
    expect(prompt).toContain("**Initiative**")
    // Should NOT include the pair being evaluated in the landscape
    expect(prompt).not.toContain("**Resilience**")
    expect(prompt).not.toContain("**Adaptability**")
  })

  it("omits landscape section when no otherConstructs provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB)
    expect(prompt).not.toContain("## Construct Landscape")
  })

  it("includes changes section when changes provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB, {
      changes: [
        {
          constructId: "1",
          constructName: "Resilience",
          field: "definition",
          previousValue: "Old definition",
          currentValue: "Ability to recover from setbacks",
        },
      ],
    })

    expect(prompt).toContain("## Changes Since Last Check")
    expect(prompt).toContain("**Resilience**")
    expect(prompt).toContain("Old definition")
  })

  it("omits changes section when no changes provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB, {
      otherConstructs: [{ name: "Empathy", definition: "Understanding others' emotions" }],
    })

    expect(prompt).not.toContain("## Changes Since Last Check")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: FAIL — `buildDiscriminationPrompt` doesn't accept a third argument

- [ ] **Step 3: Implement the context parameter**

Update `src/lib/ai/generation/prompts/construct-discrimination.ts`. Add import and third parameter:

```typescript
import type { ConstructChange } from '@/types/generation'

export function buildDiscriminationPrompt(
  constructA: {
    name: string
    definition: string
    description?: string
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
  },
  constructB: {
    name: string
    definition: string
    description?: string
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
  },
  context?: {
    otherConstructs?: Array<{ name: string; definition?: string }>
    changes?: ConstructChange[]
  },
): string {
```

After the existing `renderConstruct` calls and before the "Focus on the behavioural boundary" paragraph, add two new sections built conditionally:

```typescript
  const landscapeSection = context?.otherConstructs?.length
    ? `\n## Construct Landscape\n\nThe full set of constructs in this generation run is listed below. When assessing overlap between Construct A and Construct B, consider whether behavioural territory you might suggest moving toward is already occupied by another construct in the set.\n\n${context.otherConstructs.map((c) => `- **${c.name}**: ${c.definition ?? '(no definition)'}`).join('\n')}\n`
    : ''

  const changesSection = context?.changes?.length
    ? `\n## Changes Since Last Check\n\nThe following constructs were recently refined. Evaluate the current definitions on their own merit — do not re-litigate changes that were intentionally made unless they have created a genuine new problem.\n\n${context.changes.map((c) => `**${c.constructName}** — ${c.field} was updated:\n- Previous: "${c.previousValue}"\n- Current: "${c.currentValue}"`).join('\n\n')}\n`
    : ''
```

Then insert `${landscapeSection}${changesSection}` into the template string, between the construct B block and the "Focus on the behavioural boundary" paragraph.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/prompts/construct-discrimination.ts tests/unit/construct-preflight.test.ts
git commit -m "feat(preflight): add construct landscape and change context to discrimination prompt"
```

---

### Task 3: Add Full-Set Context and Conservatism to Refinement Prompt

**Files:**
- Modify: `src/lib/ai/generation/prompts/construct-refinement.ts`
- Test: `tests/unit/construct-preflight.test.ts`

- [ ] **Step 1: Write a test for refinement landscape and conservatism**

In `tests/unit/construct-preflight.test.ts`, add:

```typescript
import { buildRefinementPrompt } from "@/lib/ai/generation/prompts/construct-refinement"

describe("buildRefinementPrompt context", () => {
  const baseParams = {
    constructName: "Resilience",
    currentDraft: {
      definition: "Ability to recover from setbacks",
      description: "Bouncing back",
      indicatorsLow: "Gives up easily",
      indicatorsMid: "Recovers with support",
      indicatorsHigh: "Thrives under pressure",
    },
    overlappingPairs: [
      {
        otherConstructName: "Adaptability",
        cosineSimilarity: 0.72,
        overlapSummary: "Both relate to coping with change",
      },
    ],
    parentFactors: [],
  }

  it("includes other constructs section excluding target and overlapping", () => {
    const prompt = buildRefinementPrompt({
      ...baseParams,
      allConstructs: [
        { name: "Resilience", definition: "Ability to recover" },
        { name: "Adaptability", definition: "Adjust to change" },
        { name: "Empathy", definition: "Understanding others" },
        { name: "Initiative", definition: "Taking action" },
      ],
    })

    expect(prompt).toContain("## Other Constructs in Set")
    expect(prompt).toContain("**Empathy**")
    expect(prompt).toContain("**Initiative**")
    // Target and overlapping constructs should be excluded from landscape
    expect(prompt).not.toMatch(/## Other Constructs in Set[\s\S]*\*\*Resilience\*\*/)
    expect(prompt).not.toMatch(/## Other Constructs in Set[\s\S]*\*\*Adaptability\*\*/)
  })

  it("includes conservatism instruction", () => {
    const prompt = buildRefinementPrompt(baseParams)
    expect(prompt).toContain("surgical precision")
    expect(prompt).toContain("smallest edit")
  })

  it("includes changes section when provided", () => {
    const prompt = buildRefinementPrompt({
      ...baseParams,
      changes: [
        {
          constructId: "2",
          constructName: "Adaptability",
          field: "definition",
          previousValue: "Old def",
          currentValue: "Adjust to change",
        },
      ],
    })

    expect(prompt).toContain("## Changes Since Last Check")
    expect(prompt).toContain("**Adaptability**")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: FAIL — `buildRefinementPrompt` doesn't accept `allConstructs` or `changes`

- [ ] **Step 3: Implement the changes**

Update `src/lib/ai/generation/prompts/construct-refinement.ts`.

Add import:
```typescript
import type { ConstructChange } from '@/types/generation'
```

Update the `buildRefinementPrompt` params type to add two optional fields:

```typescript
export function buildRefinementPrompt(params: {
  constructName: string
  currentDraft: ConstructDraftState
  overlappingPairs: RefinementPairContext[]
  parentFactors: ParentFactorContext[]
  allConstructs?: Array<{ name: string; definition?: string }>
  changes?: ConstructChange[]
}): string {
```

Destructure the new fields:
```typescript
const { constructName, currentDraft, overlappingPairs, parentFactors, allConstructs, changes } = params
```

Build the landscape section (excluding target and overlapping constructs):

```typescript
  const overlappingNames = new Set(overlappingPairs.map((p) => p.otherConstructName))
  const landscapeConstructs = (allConstructs ?? []).filter(
    (c) => c.name !== constructName && !overlappingNames.has(c.name),
  )

  const landscapeSection = landscapeConstructs.length > 0
    ? `\n## Other Constructs in Set\n\nEach construct must maintain a unique behavioural lane. When revising fields to reduce overlap with the flagged constructs, ensure your suggestions do not drift toward any other construct in the set.\n\n${landscapeConstructs.map((c) => `- **${c.name}**: ${c.definition ?? '(no definition)'}`).join('\n')}`
    : ''

  const changesSection = changes?.length
    ? `\n\n## Changes Since Last Check\n\nThe following constructs were recently refined. Evaluate the current definitions on their own merit — do not re-litigate changes that were intentionally made unless they have created a genuine new problem.\n\n${changes.map((c) => `**${c.constructName}** — ${c.field} was updated:\n- Previous: "${c.previousValue}"\n- Current: "${c.currentValue}"`).join('\n\n')}`
    : ''
```

Insert `${landscapeSection}${changesSection}` after the `${factorSection}` block and before the `## Instructions` section.

Update the instructions list — add two new items after item 3 ("Do NOT suggest changes..."):

```
4. Only suggest changes to fields where the overlap is genuinely problematic. Prefer the smallest edit that resolves the issue. Do not rewrite fields that are already distinct — omit them from the suggestions array.
5. Your goal is surgical precision, not comprehensive rewriting.
```

Renumber the existing items 4 and 5 to 6 and 7.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/prompts/construct-refinement.ts tests/unit/construct-preflight.test.ts
git commit -m "feat(preflight): add construct landscape, conservatism, and change context to refinement prompt"
```

---

### Task 4: Thread Full Construct Set Through Preflight Pipeline

**Files:**
- Modify: `src/lib/ai/generation/construct-preflight.ts`
- Modify: `src/app/actions/generation.ts:761-773` (checkConstructReadiness)

- [ ] **Step 1: Write test for landscape data being passed to buildDiscriminationPrompt**

In `tests/unit/construct-preflight.test.ts`, add:

```typescript
import { buildLandscapeContext, PREFLIGHT_FULL_CONTEXT_THRESHOLD } from "@/lib/ai/generation/construct-preflight"

describe("buildLandscapeContext", () => {
  it("excludes the two evaluated constructs", () => {
    const constructs = [
      { id: "1", name: "A", definition: "def A" },
      { id: "2", name: "B", definition: "def B" },
      { id: "3", name: "C", definition: "def C" },
    ]

    const landscape = buildLandscapeContext(constructs, 0, 1)
    expect(landscape).toHaveLength(1)
    expect(landscape[0].name).toBe("C")
  })

  it("returns all others with name + definition for small sets", () => {
    const constructs = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Construct ${i}`,
      definition: `Definition ${i}`,
      description: `Description ${i}`,
      dimensionId: i < 3 ? "dim-1" : "dim-2",
    }))

    const landscape = buildLandscapeContext(constructs, 0, 1)
    expect(landscape).toHaveLength(3)
    // Small set: description should NOT be merged into definition
    expect(landscape[0].definition).toBe("Definition 2")
  })

  it("uses dimension-based grouping for large sets", () => {
    const constructs = Array.from({ length: PREFLIGHT_FULL_CONTEXT_THRESHOLD + 2 }, (_, i) => ({
      id: String(i),
      name: `Construct ${i}`,
      definition: `Definition ${i}`,
      description: `Description ${i}`,
      dimensionId: i < 3 ? "dim-1" : "dim-2",
    }))

    // Evaluate pair from dim-1 (indices 0 and 1)
    const landscape = buildLandscapeContext(constructs, 0, 1)

    // Construct 2 is same dimension (dim-1) — should have description merged
    const sameDim = landscape.find((c) => c.name === "Construct 2")
    expect(sameDim?.definition).toBe("Definition 2. Description 2")

    // Construct 5 is cross-dimension (dim-2) — definition only
    const crossDim = landscape.find((c) => c.name === "Construct 5")
    expect(crossDim?.definition).toBe("Definition 5")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/construct-preflight.test.ts`
Expected: FAIL — `buildLandscapeContext` doesn't exist

- [ ] **Step 3: Add `PREFLIGHT_FULL_CONTEXT_THRESHOLD` and `buildLandscapeContext` helper**

In `src/lib/ai/generation/construct-preflight.ts`, add the constant after the existing threshold constants (line 25):

```typescript
export const PREFLIGHT_FULL_CONTEXT_THRESHOLD = 15
```

Add a new exported helper function (before `runConstructPreflight`):

```typescript
/**
 * Builds the landscape context for a discrimination call, excluding the two
 * constructs being evaluated. For large sets (>PREFLIGHT_FULL_CONTEXT_THRESHOLD),
 * same-dimension constructs get fuller context.
 */
export function buildLandscapeContext(
  constructs: Array<{ id: string; name: string; definition?: string; description?: string; dimensionId?: string }>,
  indexA: number,
  indexB: number,
): Array<{ name: string; definition?: string }> {
  const excluded = new Set([indexA, indexB])
  const others = constructs.filter((_, i) => !excluded.has(i))

  if (constructs.length <= PREFLIGHT_FULL_CONTEXT_THRESHOLD) {
    return others.map((c) => ({ name: c.name, definition: c.definition }))
  }

  // Dimension-based grouping for large sets
  const dimA = constructs[indexA]?.dimensionId
  const dimB = constructs[indexB]?.dimensionId
  const sameDimIds = new Set([dimA, dimB].filter(Boolean))

  return others.map((c) => {
    if (c.dimensionId && sameDimIds.has(c.dimensionId)) {
      // Same dimension: include description for richer context
      const def = [c.definition, c.description].filter(Boolean).join('. ')
      return { name: c.name, definition: def || undefined }
    }
    // Cross-dimension: name + definition only
    return { name: c.name, definition: c.definition }
  })
}
```

- [ ] **Step 4: Pass landscape context in `runConstructPreflight`**

In `src/lib/ai/generation/construct-preflight.ts`, update the `buildDiscriminationPrompt` call (around line 110). Add the import for `ConstructChange`:

```typescript
import type {
  ConstructDraftInput,
  ConstructForGeneration,
  ConstructChange,
  PreflightResult,
  ConstructPairResult,
  BigFiveMapping,
} from '@/types/generation'
```

Update the `runConstructPreflight` signature to accept optional changes:

```typescript
export async function runConstructPreflight(
  constructs: Array<ConstructForGeneration | ConstructDraftInput>,
  changes?: ConstructChange[],
): Promise<PreflightResult> {
```

Update the `buildDiscriminationPrompt` call inside the LLM review loop to pass the third argument:

```typescript
        prompt: buildDiscriminationPrompt(
          {
            name: constructs[i].name,
            definition: constructs[i].definition ?? constructs[i].name,
            description: constructs[i].description,
            indicatorsLow: 'indicatorsLow' in constructs[i] ? constructs[i].indicatorsLow : undefined,
            indicatorsMid: 'indicatorsMid' in constructs[i] ? constructs[i].indicatorsMid : undefined,
            indicatorsHigh: 'indicatorsHigh' in constructs[i] ? constructs[i].indicatorsHigh : undefined,
          },
          {
            name: constructs[j].name,
            definition: constructs[j].definition ?? constructs[j].name,
            description: constructs[j].description,
            indicatorsLow: 'indicatorsLow' in constructs[j] ? constructs[j].indicatorsLow : undefined,
            indicatorsMid: 'indicatorsMid' in constructs[j] ? constructs[j].indicatorsMid : undefined,
            indicatorsHigh: 'indicatorsHigh' in constructs[j] ? constructs[j].indicatorsHigh : undefined,
          },
          {
            otherConstructs: buildLandscapeContext(constructs, i, j),
            changes: changes?.filter((c) =>
              c.constructId === constructs[i].id || c.constructId === constructs[j].id
            ),
          },
        ),
```

Note: the `changes` filter ensures only changes relevant to the current pair are included.

- [ ] **Step 5: Update `checkConstructReadiness` server action**

In `src/app/actions/generation.ts`, update the action signature and pass changes through:

```typescript
export async function checkConstructReadiness(
  constructs: ConstructDraftInput[],
  changes?: ConstructChange[],
) {
  await requireAdminScope()
  try {
    const { runConstructPreflight } = await import('@/lib/ai/generation')
    const result = await runConstructPreflight(constructs, changes)
    return { success: true as const, result }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

Add the import at top of file:
```typescript
import type { ConstructChange } from '@/types/generation'
```

Note: `ConstructDraftInput` is already imported via `@/types/generation` (check the existing imports — if it's imported from `@/types/database`, add `ConstructChange` to the generation import).

- [ ] **Step 6: Run tests and type-check**

Run: `npx vitest run tests/unit/construct-preflight.test.ts && npx tsc --noEmit 2>&1 | head -20`
Expected: All tests pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/generation/construct-preflight.ts src/app/actions/generation.ts
git commit -m "feat(preflight): thread full construct set and changes through discrimination pipeline"
```

---

### Task 5: Thread Full Context Through Refinement Pipeline

**Files:**
- Modify: `src/app/actions/generation.ts:1016-1081` (suggestConstructRefinements)

- [ ] **Step 1: Update `suggestConstructRefinements` to accept and forward context**

In `src/app/actions/generation.ts`, update the params type:

```typescript
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
  allConstructs?: Array<{ name: string; definition?: string }>
  changes?: ConstructChange[]
}): Promise<
```

Update the `buildRefinementPrompt` call to pass the new fields:

```typescript
    const prompt = buildRefinementPrompt({
      constructName: params.constructName,
      currentDraft: params.currentDraft,
      overlappingPairs: params.overlappingPairs,
      parentFactors: params.parentFactors,
      allConstructs: params.allConstructs,
      changes: params.changes,
    })
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/generation.ts
git commit -m "feat(preflight): thread construct landscape and changes through refinement action"
```

---

### Task 6: Add Snapshot State and Change Tracking to Wizard UI

**Files:**
- Modify: `src/app/(dashboard)/generate/new/page.tsx`

This is the final integration task. It wires up the snapshot lifecycle and passes context to both server actions.

- [ ] **Step 1: Add snapshot state to the Step2ReadinessCheck component**

In the `Step2ReadinessCheck` component (around line 343), add state after `lastCheckedSignature`:

```typescript
  const [preflightSnapshot, setPreflightSnapshot] = React.useState<ConstructSnapshot>({});
```

Add import for the new types at the top of the file:

```typescript
import type { ConstructSnapshot, ConstructChange } from "@/types/generation";
```

- [ ] **Step 2: Add helper to compute snapshot from current inputs**

Add this helper function near the top of the file (after `buildPreflightConstructs`):

```typescript
function buildSnapshot(constructInputs: ConstructDraftInput[]): ConstructSnapshot {
  return Object.fromEntries(
    constructInputs.map((c) => [
      c.id,
      {
        definition: c.definition,
        description: c.description,
        indicatorsLow: c.indicatorsLow,
        indicatorsMid: c.indicatorsMid,
        indicatorsHigh: c.indicatorsHigh,
      },
    ]),
  )
}

function computeChanges(
  currentInputs: ConstructDraftInput[],
  snapshot: ConstructSnapshot,
): ConstructChange[] {
  const changes: ConstructChange[] = []
  for (const construct of currentInputs) {
    const prev = snapshot[construct.id]
    if (!prev) continue
    const fields = ['definition', 'description', 'indicatorsLow', 'indicatorsMid', 'indicatorsHigh'] as const
    for (const field of fields) {
      const prevVal = prev[field] ?? ''
      const curVal = construct[field] ?? ''
      if (prevVal !== curVal && prevVal !== '') {
        changes.push({
          constructId: construct.id,
          constructName: construct.name,
          field,
          previousValue: prevVal,
          currentValue: curVal,
        })
      }
    }
  }
  return changes
}
```

- [ ] **Step 3: Update `runReadinessCheck` to compute changes and capture snapshots**

Update the `runReadinessCheck` callback to compute changes from the snapshot and pass them to `checkConstructReadiness`. After a successful result, capture a new snapshot:

```typescript
  const runReadinessCheck = React.useCallback((constructInputs: ConstructDraftInput[]) => {
    setPreflightLoading(true);
    setRefinementState({});
    setPreflightError(null);
    setPreflightResult(null);
    const signature = JSON.stringify(constructInputs);
    const changes = computeChanges(constructInputs, preflightSnapshot);
    checkConstructReadiness(constructInputs, changes.length > 0 ? changes : undefined)
      .then((res) => {
        if (res.success) {
          setPreflightResult(res.result);
          setLastCheckedSignature(signature);
          setPreflightSnapshot(buildSnapshot(constructInputs));
        } else {
          setPreflightError(res.error ?? "Readiness check failed");
        }
      })
      .catch((err) => {
        setPreflightError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setPreflightLoading(false);
      });
  // preflightSnapshot is a dependency because we need the latest snapshot
  // to compute changes. The effect that triggers initial/auto runs intentionally
  // does NOT include runReadinessCheck — reruns are triggered by button click only.
  }, [preflightSnapshot]);
```

- [ ] **Step 4: Update `buildPreflightConstructs` to include `dimensionId`**

In the `buildPreflightConstructs` function, add `dimensionId` to the returned object:

```typescript
function buildPreflightConstructs(
  constructs: Construct[] | null,
  selectedIds: string[],
  drafts: ConstructDraftMap,
): ConstructDraftInput[] {
  return (constructs ?? [])
    .filter((construct) => selectedIds.includes(construct.id))
    .map((construct) => {
      const draft = drafts[construct.id] ?? createConstructDraftState(construct);
      return {
        id: construct.id,
        name: construct.name,
        dimensionId: construct.dimensionId,
        definition: normalizeDraftText(draft.definition),
        description: normalizeDraftText(draft.description),
        indicatorsLow: normalizeDraftText(draft.indicatorsLow),
        indicatorsMid: normalizeDraftText(draft.indicatorsMid),
        indicatorsHigh: normalizeDraftText(draft.indicatorsHigh),
      };
    });
}
```

- [ ] **Step 5: Pass full construct set and changes to `suggestConstructRefinements`**

Update the `handleSuggestImprovements` callback to pass `allConstructs` and `changes`:

```typescript
  const handleSuggestImprovements = React.useCallback(async (constructId: string, constructName: string) => {
    const draft = constructDrafts[constructId] ?? createConstructDraftState(
      (constructs ?? []).find((c) => c.id === constructId)
    );
    const pairs = resolveOverlappingPairs(constructId, preflightResult?.pairs ?? []);

    setRefinementState((prev) => ({
      ...prev,
      [constructId]: { loading: true },
    }));

    try {
      const parentFactors = await fetchParentFactorsForConstruct(constructId);

      // Filter changes to only those relevant to this construct and its overlapping pairs
      const relevantIds = new Set([constructId, ...pairs.map((p) => {
        // Find the ID of the overlapping construct by name
        const match = selectedConstructInputs.find((c) => c.name === p.otherConstructName);
        return match?.id;
      }).filter(Boolean)]);
      const allChanges = computeChanges(selectedConstructInputs, preflightSnapshot);
      const relevantChanges = allChanges.filter((c) => relevantIds.has(c.constructId));

      const result = await suggestConstructRefinements({
        constructId,
        constructName,
        currentDraft: draft,
        overlappingPairs: pairs,
        parentFactors,
        allConstructs: selectedConstructInputs.map((c) => ({
          name: c.name,
          definition: c.definition,
        })),
        changes: relevantChanges.length > 0 ? relevantChanges : undefined,
      });
```

Note the addition of `allConstructs` and `changes` to the params. The `selectedConstructInputs` is already available as a memoized value in this component. Update the dependency array to:

```typescript
}, [constructDrafts, constructs, preflightResult, preflightSnapshot, selectedConstructInputs]);
```

- [ ] **Step 6: Verify types compile and app builds**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/generate/new/page.tsx
git commit -m "feat(preflight): wire up snapshot state, change tracking, and full-set context in wizard UI"
```

---

### Task 7: Verify Existing Tests Still Pass

**Files:** None (verification only)

- [ ] **Step 1: Run all preflight tests**

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
2. Select 3-5 constructs with some definitional overlap
3. Advance to Step 2 (Readiness Check)
4. Verify the preflight runs and shows results as before
5. Click "Suggest Improvements" on an amber/red construct
6. Accept a suggestion and click "Re-check Readiness"
7. Verify the second run doesn't undo the accepted refinement
8. Check the browser console for any errors
