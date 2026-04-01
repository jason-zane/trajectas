# Preflight Refinement Enhancements — Design Spec

## Context

The generation wizard's Step 2 (Readiness Check) runs a preflight analysis that compares construct definitions using embedding similarity and LLM discrimination checks. Users can already edit construct definitions and re-run the check, but three gaps exist:

1. Cosine similarity scores are displayed without explanation — users don't know what the numbers mean or what to aim for
2. When constructs overlap, the user must manually figure out how to improve definitions — no AI assistance
3. Edits made during preflight are ephemeral (run-scoped overrides) — there's no way to persist them back to the library

## Features

### Feature 1: Cosine Score Context

Add an inline threshold guide to the metadata panel in Step 2.

**Content:**
- Four-tier colour-coded legend:
  - Green dot: **< 0.30** — Clearly distinct
  - Green dot: **0.30–0.50** — Low overlap
  - Amber dot: **0.50–0.75** — Review recommended
  - Red dot: **> 0.75** — High overlap, refine before generation
- One-line explanation: "Cosine similarity measures how close two construct definitions are in meaning. Lower is more distinct. Pairs above 0.50 are reviewed by AI; above 0.75 usually indicates genuine overlap."

**Location:** Below the existing metadata stats (review threshold, pair counts, models) in the readiness check results panel.

**Implementation:** Pure UI change in `page.tsx` Step 2. No new data, server actions, or types.

---

### Feature 2: AI-Assisted Refinement

When a construct has overlap issues (or the user wants tighter language), they can ask the AI to suggest targeted improvements with before/after diffs.

#### Server Action

**`suggestConstructRefinements`** in `src/app/actions/generation.ts`

Parameters:
```typescript
{
  constructId: string
  currentDraft: ConstructDraftState      // current field values
  overlappingPairs: Array<{              // from preflight results
    otherConstructName: string
    cosineSimilarity: number
    overlapSummary?: string
    sharedSignals?: string[]
    uniqueSignals?: string[]             // unique signals for THIS construct
    refinementGuidance?: string
  }>
  parentFactors: Array<{                 // fetched on demand
    name: string
    definition?: string
    indicatorsHigh?: string
  }>
}
```

Returns:
```typescript
{
  success: true
  analysis: string                       // 2-3 sentences: what's driving overlap, what to change
  suggestions: Array<{
    field: 'definition' | 'description' | 'indicatorsLow' | 'indicatorsMid' | 'indicatorsHigh'
    original: string
    suggested: string
    reason: string                       // one sentence: why this field needs change
  }>
} | { success: false; error: string }
```

Fields NOT in the suggestions array are left untouched — the AI only suggests changes for fields that contribute to the overlap.

#### Parent Factor Query

**`fetchParentFactorsForConstruct`** in `src/app/actions/generation.ts`

A lightweight server action that queries `factor_constructs → factors` for a single construct ID. Returns `Array<{ name, definition, indicatorsHigh }>`. Same join pattern already used in `fetchConstructsForRun`.

#### LLM Prompt

Uses the existing `preflight_analysis` model config (same model as discrimination checks). System prompt instructs the LLM to:

1. Analyse which fields are driving the overlap based on the pair diagnostics
2. Use parent factor context to suggest a direction for sharpening (e.g. "This construct sits under Strategic Agility — lean into the proactive, strategic angle")
3. Only suggest changes to fields that need tightening — don't touch fields that are already distinct
4. For each suggestion, preserve the original meaning while removing the overlap territory
5. Return structured JSON matching the response schema above

#### UI Flow

1. **"Suggest improvements" button** appears in each construct's accordion header in the Refine Definitions section. Available for all constructs (not just amber/red — even green constructs may benefit from tighter language).

2. **Loading state:** Button shows spinner + "Analysing…" while the server action runs.

3. **Results render inline** within the construct's accordion panel:
   - **AI analysis box** (indigo-tinted card): 2-3 sentences explaining what's driving overlap and the recommended direction
   - **Per-field diffs** for suggested fields only:
     - BEFORE block (red-tinted): original text with removed portions highlighted
     - AFTER block (green-tinted): suggested text with new portions highlighted
     - Accept / Keep original buttons per field
   - **Unchanged fields**: shown with "No change needed" label, original text visible but not editable in diff mode

4. **Accept / Keep original per field:**
   - "Accept" copies the suggested text into the draft textarea (populates `constructDrafts[constructId][field]`)
   - "Keep original" dismisses that field's suggestion (removes the diff UI, keeps original in draft)
   - Both actions remove the diff UI for that field

5. **Bulk actions:**
   - "Accept all suggestions" — accepts every suggested field at once
   - "Re-suggest" — re-runs the AI call (useful after manual edits to other fields)

6. **Readiness refresh:** Accepting any suggestion changes the draft, which triggers the existing `readinessNeedsRefresh` mechanism — the user must re-run the preflight check before proceeding to Step 3.

#### State Management

New state in the Step 2 component:
```typescript
// Per-construct AI suggestion state
const [suggestions, setSuggestions] = useState<Record<string, {
  loading: boolean
  analysis?: string
  fieldSuggestions?: Array<{
    field: DraftField
    original: string
    suggested: string
    reason: string
  }>
  error?: string
}>>({})
```

Suggestions are cleared when:
- The user navigates back to Step 1 and changes construct selection
- The preflight check is re-run (new diagnostics may change what needs fixing)

---

### Feature 3: Save to Library

Per-construct "Save to library" button that persists draft edits back to the construct's database record.

#### Server Action

**`saveConstructDraftToLibrary`** in `src/app/actions/generation.ts`

Parameters:
```typescript
{
  constructId: string
  fields: Partial<Record<'definition' | 'description' | 'indicatorsLow' | 'indicatorsMid' | 'indicatorsHigh', string>>
}
```

Implementation: Iterates over the provided fields and calls `db.from('constructs').update(...)` with the snake_case equivalents. Revalidates `/constructs` path. Logs audit event per existing `updateConstructField` pattern.

Returns `{ success: true; updatedFields: string[] } | { success: false; error: string }`.

#### UI

- **Button placement:** In each construct's accordion header, next to "Suggest improvements"
- **Disabled state:** Disabled when no draft fields differ from the original library values (tracked by comparing `constructDrafts[id]` against the original `construct` object)
- **Button label transitions:** "Save to library" → "Saving…" → "Saved" (2s) → disabled (until next edit). Follows CLAUDE.md save button pattern.
- **Toast on save:** `toast.success("Adaptability saved to library", { description: "Updated: definition, high indicators" })` — names the construct and lists which fields were changed.
- **Post-save state update:** After saving, update the local `constructs` state to reflect the new library values. This resets the draft-vs-original comparison so the "Save to library" button correctly disables, and ensures future diff tracking is accurate for the rest of the wizard session.

---

## Data Flow Summary

```
User clicks "Suggest improvements"
  → fetchParentFactorsForConstruct(constructId)
  → suggestConstructRefinements(constructId, draft, pairs, parentFactors)
  → LLM returns analysis + targeted field suggestions
  → UI shows before/after diffs

User accepts suggestions (per-field or bulk)
  → Draft fields updated → readinessNeedsRefresh = true
  → User can "Save to library" (persists to DB)
  → User re-runs preflight → new scores reflect improvements
```

## Files Changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/generate/new/page.tsx` | Cosine guide UI, suggestion state, suggest/accept/save UI, button wiring |
| `src/app/actions/generation.ts` | `suggestConstructRefinements`, `fetchParentFactorsForConstruct`, `saveConstructDraftToLibrary` server actions |
| `src/lib/ai/generation/prompts/construct-refinement.ts` | **New file** — `buildRefinementPrompt()` and response parser |
| `src/lib/ai/generation/construct-preflight.ts` | No changes (preflight results already contain the pair diagnostics we need) |

## Non-Goals

- Refactoring the Step 2 component into sub-components (it's large but manageable for this change)
- Adding factor context to the preflight discrimination check itself (that's a separate enhancement)
- Auto-saving refinements (explicit save only, per Zone 2 principle)
- Editing factor definitions from this UI (out of scope — this is construct-level only)
