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

**Current**: The discrimination prompt in `construct-discrimination.ts` receives only Construct A and Construct B (two positional arguments).

**Change**: Add a third `context` options parameter to `buildDiscriminationPrompt`:

```typescript
buildDiscriminationPrompt(
  constructA: ConstructDraftInput,
  constructB: ConstructDraftInput,
  context?: {
    otherConstructs?: Array<{ name: string; definition?: string }>
    changes?: ConstructChange[]
  },
): string
```

Append a "Construct Landscape" section to the prompt template that lists all other constructs in the set (name + definition only). The pair being evaluated still gets full detail (definition, description, all indicator levels).

**Prompt addition** (appended before the JSON response instruction):

```
## Construct Landscape

The full set of constructs in this generation run is listed below. When
assessing overlap between Construct A and Construct B, consider whether
behavioural territory you might suggest moving toward is already occupied
by another construct in the set.

- **{name}**: {definition}
...
```

**Data flow change**: `runConstructPreflight()` already has the full `ConstructDraftInput[]` array. When calling `buildDiscriminationPrompt` for a pair, filter out the two constructs being evaluated and pass the rest as `otherConstructs`.

### 2. Full-Set Context in Refinement Prompts

**Current**: The refinement prompt in `construct-refinement.ts` sees the target construct and its overlapping pairs via a `params` object. `buildRefinementPrompt(params)`.

**Change**: Add `allConstructs` and `changes` fields to the existing params object. The `allConstructs` list should **exclude** the target construct and any constructs already listed in `overlappingPairs` to avoid duplication and token waste.

**Prompt addition**:

```
## Other Constructs in Set

Each construct must maintain a unique behavioural lane. When revising
fields to reduce overlap with the flagged constructs, ensure your
suggestions do not drift toward any other construct in the set.

- **{name}**: {definition}
...
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

**Implementation**: `ConstructDraftInput` does not currently carry dimension information. Add an optional `dimensionId?: string` field to `ConstructDraftInput` in `src/types/generation.ts`. Populate it in the wizard when building `selectedConstructInputs` from the `Construct` type (which already has `dimensionId` and `dimensionName` from `getConstructsForGeneration()`).

The grouping logic lives in `construct-preflight.ts`: when building the `otherConstructs` list for a pair, check total construct count against the threshold. If above, partition by `dimensionId` and include fuller context for same-dimension constructs.

**Threshold constant**: Add `PREFLIGHT_FULL_CONTEXT_THRESHOLD = 15` to `construct-preflight.ts` alongside the existing threshold constants.

### 4. Change Tracking on Reruns

**State shape**: Store a snapshot of construct definitions keyed by `constructId` (stable identifier) after each preflight run completes. The snapshot captures the state the LLM evaluated — i.e., the construct fields *at the time the preflight run was triggered*, before any refinements are accepted.

```typescript
type ConstructSnapshot = Record<string /* constructId */, {
  definition?: string
  description?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
}>
```

This lives in the wizard's React component state (not persisted to database). It resets when the user leaves the wizard or starts a new generation run.

**Diff computation**: On rerun, compare current construct fields against the snapshot. For each construct with changes, produce a flattened change summary (one entry per changed field, not nested):

```typescript
interface ConstructChange {
  constructId: string
  constructName: string
  field: string
  previousValue: string
  currentValue: string
}
```

**Prompt addition for discrimination** (only included when changes exist for either construct in the pair):

```
## Changes Since Last Check

The following constructs were recently refined. Evaluate the current
definitions on their own merit — do not re-litigate changes that were
intentionally made unless they have created a genuine new problem.

**{constructName}** — {field} was updated:
- Previous: "{previousValue}"
- Current: "{currentValue}"
...
```

**Prompt addition for refinement** (only included when changes exist for the target construct or its overlapping pairs):

Same section as above, with the same instruction framing.

**Snapshot lifecycle**:
1. First preflight run completes → snapshot taken of all construct fields as they were when the run was triggered
2. User accepts refinements → construct drafts change in React state (snapshot is NOT updated yet)
3. User reruns preflight → diff computed between current drafts and snapshot → changes passed to LLM calls
4. Rerun completes → new snapshot replaces the old one
5. Cleared when the user navigates away from the wizard

## Files to Modify

| File | Change |
|------|--------|
| `src/types/generation.ts` | Add `dimensionId?: string` to `ConstructDraftInput`; add `ConstructSnapshot` type alias and `ConstructChange` interface |
| `src/lib/ai/generation/prompts/construct-discrimination.ts` | Add third `context` parameter to `buildDiscriminationPrompt`; append landscape and change sections to prompt template |
| `src/lib/ai/generation/prompts/construct-refinement.ts` | Add `allConstructs` and `changes` fields to params object in `buildRefinementPrompt`; append landscape, conservatism instruction, and change sections; exclude target + overlapping constructs from landscape |
| `src/lib/ai/generation/construct-preflight.ts` | Pass full construct array through to discrimination calls; add `PREFLIGHT_FULL_CONTEXT_THRESHOLD` constant; implement dimension-based grouping logic for landscape building |
| `src/app/actions/generation.ts` | Update `checkConstructReadiness()` to accept and forward optional `ConstructChange[]`; update `suggestConstructRefinements()` to accept and forward full construct set and change context |
| `src/app/(dashboard)/generate/new/page.tsx` | Add snapshot state; populate `dimensionId` on `ConstructDraftInput`; compute diffs on rerun; pass construct set and changes through to server actions |

## What This Does NOT Change

- **Pair-by-pair evaluation structure**: Discrimination still evaluates one pair at a time — the landscape is context, not additional evaluation targets.
- **Cosine similarity thresholds**: No changes to 0.50/0.75 thresholds or top-5 selection logic.
- **Embedding computation**: Embeddings are still computed fresh each run (they're fast and cheap).
- **Database schema**: No new tables or columns. Change tracking is ephemeral React state.
- **Verdict determination logic**: The hybrid cosine + LLM status logic in `normalizePreflightStatus()` is unchanged.
