# Preflight Context-Awareness — Design Spec

## Problem

The preflight readiness check evaluates construct pairs in isolation — each discrimination call sees only two constructs, and each refinement call sees only the target construct plus its flagged overlapping pairs. This creates two compounding issues:

1. **Whack-a-mole refinements**: When the LLM refines Construct A to reduce overlap with Construct B, it may inadvertently push A's language toward Construct C — because it never saw C. The next run then flags A↔C, and the cycle repeats.
2. **Stateless reruns**: Each preflight run is completely fresh. The LLM has no awareness that definitions were just refined, so it re-evaluates everything from scratch and finds new things to nitpick even when the previous refinement was sound.

## Solution Overview

Two changes that work together:

1. **Full-set context** — Give every LLM call (discrimination and refinement) visibility into all constructs in the generation set, so suggestions are globally coherent.
2. **Change tracking on reruns** — Track what changed between runs in component state and pass that context to the LLM, so it doesn't undo intentional refinements.

## Design

### 1. Full-Set Context in Discrimination Prompts

**Current**: The discrimination prompt in `construct-discrimination.ts` receives only Construct A and Construct B.

**Change**: Add a "Construct Landscape" section to the prompt template that lists all other constructs in the set (name + definition only). The pair being evaluated still gets full detail (definition, description, all indicator levels).

**Prompt addition** (appended before the JSON response instruction):

```
## Construct Landscape

The full set of constructs in this generation run is listed below. When
assessing overlap between Construct A and Construct B, consider whether
behavioural territory you might suggest moving toward is already occupied
by another construct in the set.

{{#each otherConstructs}}
- **{{name}}**: {{definition}}
{{/each}}
```

**Data flow change**: `runConstructPreflight()` already has the full `ConstructDraftInput[]` array. When calling the discrimination prompt builder for a pair, pass the remaining constructs as `otherConstructs`.

### 2. Full-Set Context in Refinement Prompts

**Current**: The refinement prompt in `construct-refinement.ts` sees the target construct and its overlapping pairs (from the preflight results).

**Change**: Add the same construct landscape section listing all constructs in the set (name + definition). Add an explicit conservatism instruction.

**Prompt additions**:

```
## All Constructs in Set

Each construct must maintain a unique behavioural lane. When revising
fields to reduce overlap with the flagged constructs, ensure your
suggestions do not drift toward any other construct in the set.

{{#each allConstructs}}
- **{{name}}**: {{definition}}
{{/each}}
```

**Conservatism instruction** (added to the existing instructions block):

```
- Only suggest changes to fields where the overlap is genuinely problematic.
  Prefer the smallest edit that resolves the issue. Do not rewrite fields
  that are already distinct — leave them untouched.
- Your goal is surgical precision, not comprehensive rewriting.
```

### 3. Scaling Strategy for Large Sets (20+ Constructs)

For sets of 15 or fewer constructs, all constructs are included with name + definition in the landscape section. No special handling needed.

For sets above 15, use **dimension-based grouping**:

- **Same-dimension constructs**: Include name, definition, and description (fuller context for the most likely overlap candidates).
- **Cross-dimension constructs**: Include name + one-line definition only (enough to mark territory without burning tokens).

**Implementation**: The `ConstructDraftInput` type already carries an `id` which maps to library constructs. The wizard's Step 1 selection data includes the dimension each construct belongs to (via the library hierarchy). Pass this grouping information through to the prompt builders.

**Threshold constant**: Add `PREFLIGHT_FULL_CONTEXT_THRESHOLD = 15` to `construct-preflight.ts` alongside the existing threshold constants.

### 4. Change Tracking on Reruns

**State shape**: Store a snapshot of construct definitions after each preflight run completes.

```typescript
type ConstructSnapshot = Record<string, {
  definition?: string
  description?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
}>
```

This lives in the wizard's React component state (not persisted to database). It resets when the user leaves the wizard or starts a new generation run.

**Diff computation**: On rerun, compare current construct fields against the snapshot. For each construct with changes, produce a change summary:

```typescript
interface ConstructChange {
  constructId: string
  constructName: string
  changedFields: Array<{
    field: string
    previousValue: string
    currentValue: string
  }>
}
```

**Prompt addition for discrimination** (only included when changes exist for either construct in the pair):

```
## Changes Since Last Check

The following constructs were recently refined. Evaluate the current
definitions on their own merit — do not re-litigate changes that were
intentionally made unless they have created a genuine new problem.

{{#each changes}}
**{{constructName}}** — {{field}} was updated:
- Previous: "{{previousValue}}"
- Current: "{{currentValue}}"
{{/each}}
```

**Prompt addition for refinement** (only included when changes exist for the target construct or its overlapping pairs):

Same section as above, with the same instruction framing.

**Snapshot lifecycle**:
- Created after the first preflight run completes (snapshot of all construct fields at that point)
- Updated after each subsequent run (new snapshot replaces old)
- Cleared when the user navigates away from the wizard

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/ai/generation/prompts/construct-discrimination.ts` | Add `otherConstructs` and `changes` parameters to prompt builder; append landscape and change sections |
| `src/lib/ai/generation/prompts/construct-refinement.ts` | Add `allConstructs` and `changes` parameters; append landscape, conservatism instruction, and change sections |
| `src/lib/ai/generation/construct-preflight.ts` | Pass full construct array through to discrimination calls; add `PREFLIGHT_FULL_CONTEXT_THRESHOLD` constant; implement dimension-based grouping logic |
| `src/app/actions/generation.ts` | Update `suggestConstructRefinements()` to accept and forward full construct set and change context |
| `src/app/(dashboard)/generate/new/page.tsx` | Add snapshot state; compute diffs on rerun; pass construct set and changes through to server actions |
| `src/types/generation.ts` | Add `ConstructSnapshot` and `ConstructChange` types |

## What This Does NOT Change

- **Pair-by-pair evaluation structure**: Discrimination still evaluates one pair at a time — the landscape is context, not additional evaluation targets.
- **Cosine similarity thresholds**: No changes to 0.50/0.75 thresholds or top-5 selection logic.
- **Embedding computation**: Embeddings are still computed fresh each run (they're fast and cheap).
- **Database schema**: No new tables or columns. Change tracking is ephemeral React state.
- **Verdict determination logic**: The hybrid cosine + LLM status logic in `normalizePreflightStatus()` is unchanged.
