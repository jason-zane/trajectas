# Campaign Factor Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow partners to customise which factors within a pre-built assessment are included when running a campaign, with a visual factor picker grouped by dimension and live item/time estimates.

**Architecture:** New `campaign_assessment_factors` junction table stores custom selections. Assessment runner filters items at runtime by checking each item's construct→factor chain against selected factors. Factor picker is an inline expanding panel on the campaign assessments tab. `min_custom_factors` column on assessments controls whether customisation is available.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, React, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-07-campaign-factor-selection.md`

---

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `supabase/migrations/000XX_campaign_factor_selection.sql` | Table + column + RLS |
| `src/app/actions/factor-selection.ts` | Server actions for factor selection CRUD |
| `tests/unit/factor-selection.test.ts` | Unit tests for selection logic |
| `src/app/(dashboard)/campaigns/[id]/assessments/factor-picker.tsx` | Factor picker UI component |

### Modified files

| File | Change |
|------|--------|
| `src/types/database.ts` | Add `CampaignAssessmentFactor` type, add `minCustomFactors` to Assessment |
| `src/lib/supabase/mappers.ts` | Add mapper, update assessment mapper |
| `src/app/actions/assess.ts` | Modify `getSessionState` to filter items by selected factors |
| `src/app/actions/assessments.ts` | Add `minCustomFactors` to assessment queries/types |
| `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx` | Integrate factor picker toggle and panel |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/000XX_campaign_factor_selection.sql`

- [ ] **Step 1: Check next migration number**

Run: `ls supabase/migrations/ | tail -3`

- [ ] **Step 2: Write the migration**

```sql
-- Campaign factor selection: allows per-campaign customisation of which
-- factors within an assessment are included.

-- 1. Junction table for custom factor selections
CREATE TABLE IF NOT EXISTS campaign_assessment_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_assessment_id UUID NOT NULL REFERENCES campaign_assessments(id) ON DELETE CASCADE,
  factor_id UUID NOT NULL REFERENCES factors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_assessment_factor UNIQUE (campaign_assessment_id, factor_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_assessment_factors_ca
  ON campaign_assessment_factors(campaign_assessment_id);

COMMENT ON TABLE campaign_assessment_factors IS
  'Per-campaign factor selection. No rows = full assessment (all factors). Rows = custom selection.';

-- 2. Enable customisation toggle on assessments
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS min_custom_factors INT DEFAULT NULL;

COMMENT ON COLUMN assessments.min_custom_factors IS
  'Minimum factors required for custom selection. NULL = customisation not allowed.';

-- 3. RLS
ALTER TABLE campaign_assessment_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON campaign_assessment_factors
  FOR ALL TO authenticated
  USING (is_platform_admin());

CREATE POLICY "campaign_assessment_factors_select" ON campaign_assessment_factors
  FOR SELECT TO authenticated
  USING (
    campaign_assessment_id IN (
      SELECT ca.id FROM campaign_assessments ca
      JOIN campaigns c ON c.id = ca.campaign_id
      WHERE c.client_id = auth_user_client_id()
         OR c.partner_id = auth_user_partner_id()
    )
  );
```

- [ ] **Step 3: Apply migration**

Run: `npm run db:push`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add campaign_assessment_factors table and min_custom_factors column"
```

---

## Task 2: Types and Mappers

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/supabase/mappers.ts`

- [ ] **Step 1: Add types to database.ts**

Add `CampaignAssessmentFactor` interface:

```typescript
export interface CampaignAssessmentFactor {
  id: string;
  campaignAssessmentId: string;
  factorId: string;
  created_at: string;
}
```

Add `minCustomFactors` to the existing `Assessment` interface:
```typescript
minCustomFactors: number | null; // null = customisation not allowed
```

- [ ] **Step 2: Update assessment mapper**

In `mappers.ts`, update `mapAssessmentRow` to include:
```typescript
minCustomFactors: row.min_custom_factors ?? null,
```

- [ ] **Step 3: Compile check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/lib/supabase/mappers.ts
git commit -m "feat(types): add CampaignAssessmentFactor type and minCustomFactors to Assessment"
```

---

## Task 3: Factor Selection Server Actions

**Files:**
- Create: `src/app/actions/factor-selection.ts`
- Create: `tests/unit/factor-selection.test.ts`

- [ ] **Step 1: Create server actions**

Create `src/app/actions/factor-selection.ts` with these functions:

### `getFactorSelectionForCampaignAssessment(campaignAssessmentId: string)`

Returns `{ isCustom: boolean; selectedFactorIds: string[] }`.

Query `campaign_assessment_factors` for the given `campaign_assessment_id`. If no rows, return `{ isCustom: false, selectedFactorIds: [] }`. If rows exist, return `{ isCustom: true, selectedFactorIds: [...] }`.

### `getFactorsForAssessment(assessmentId: string)`

Returns the full list of factors available in the assessment, grouped by dimension. Query chain:
1. Get `assessment_factors` for the assessment (factor_id, weight, item_count)
2. Join with `factors` to get name, description, dimension_id
3. Join with `dimensions` to get dimension name
4. Join with `factor_constructs` to get construct count per factor

Return type:
```typescript
Array<{
  dimensionId: string | null;
  dimensionName: string | null;
  factors: Array<{
    factorId: string;
    factorName: string;
    factorDescription: string | null;
    constructCount: number;
  }>;
}>
```

### `saveFactorSelection(campaignAssessmentId: string, factorIds: string[])`

Validates:
1. Campaign access via `requireCampaignAccess`
2. Assessment has `min_custom_factors` set (customisation is allowed)
3. `factorIds.length >= assessment.min_custom_factors`
4. All factorIds are valid factors for this assessment

Then replaces all rows: delete existing + insert new.

Returns `{ success: true } | { error: string }`.

### `clearFactorSelection(campaignAssessmentId: string)`

Deletes all `campaign_assessment_factors` rows for the given campaign_assessment. Returns to "full assessment" mode.

### `getFactorSelectionEstimate(assessmentId: string, factorIds: string[])`

Computes the live estimate without saving. Returns:
```typescript
{
  factorCount: number;
  constructCount: number;
  estimatedItems: number;
  estimatedMinutes: number;
}
```

Uses `item_selection_rules` to compute items-per-construct based on total construct count. Duration estimate: items × 8 seconds.

- [ ] **Step 2: Write tests**

Create `tests/unit/factor-selection.test.ts`:

Test cases:
1. `getFactorSelectionForCampaignAssessment` returns `isCustom: false` when no rows
2. `getFactorSelectionForCampaignAssessment` returns `isCustom: true` with factor IDs when rows exist
3. `saveFactorSelection` rejects when below minimum
4. `saveFactorSelection` rejects invalid factor IDs
5. `clearFactorSelection` removes all rows

Mock `requireCampaignAccess`, `createAdminClient`/`createClient`, `revalidatePath`.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/factor-selection.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/factor-selection.ts tests/unit/factor-selection.test.ts
git commit -m "feat(factor-selection): add server actions for campaign factor customisation"
```

---

## Task 4: Assessment Runner — Item Filtering

**Files:**
- Modify: `src/app/actions/assess.ts`

This is the critical task — modifying `getSessionState` to filter items based on factor selection.

- [ ] **Step 1: Read the current `getSessionState` function**

Read `src/app/actions/assess.ts` and understand the item loading query at the section where `assessment_section_items` are fetched.

- [ ] **Step 2: Extend the item query**

The current query fetches items via:
```typescript
assessment_section_items(id, item_id, display_order, items(id, stem, item_options(...)))
```

Extend the `items` select to include `construct_id` and `purpose`:
```typescript
assessment_section_items(id, item_id, display_order, items(id, stem, construct_id, purpose, selection_priority, item_options(...)))
```

- [ ] **Step 3: Add factor selection lookup**

After loading the session and before building sections, check for custom factor selection:

```typescript
// Resolve campaign_assessment_id from campaign_id + assessment_id
const { data: campaignAssessment } = await db
  .from('campaign_assessments')
  .select('id')
  .eq('campaign_id', session.campaign_id)
  .eq('assessment_id', session.assessment_id)
  .single();

let selectedFactorIds: Set<string> | null = null;

if (campaignAssessment) {
  const { data: factorRows } = await db
    .from('campaign_assessment_factors')
    .select('factor_id')
    .eq('campaign_assessment_id', campaignAssessment.id);

  if (factorRows && factorRows.length > 0) {
    selectedFactorIds = new Set(factorRows.map(r => r.factor_id));
  }
}
```

- [ ] **Step 4: Build factor→construct mapping**

If `selectedFactorIds` is set (custom selection), load the construct→factor mapping **scoped to this assessment's factors only** to know which constructs belong to selected factors:

```typescript
let allowedConstructIds: Set<string> | null = null;

if (selectedFactorIds) {
  // Get only factors that belong to this assessment, then their constructs
  const { data: assessmentFactorIds } = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', session.assessment_id);

  const assessmentFactorSet = new Set(
    (assessmentFactorIds ?? []).map(af => af.factor_id)
  );

  const { data: fcLinks } = await db
    .from('factor_constructs')
    .select('construct_id, factor_id')
    .in('factor_id', Array.from(assessmentFactorSet));

  if (fcLinks) {
    allowedConstructIds = new Set(
      fcLinks
        .filter(fc => selectedFactorIds!.has(fc.factor_id))
        .map(fc => fc.construct_id)
    );
  }
}
```

- [ ] **Step 5: Filter items in section mapping**

In the section mapping code where items are sorted and mapped, add filtering:

```typescript
// Existing: sort items by display_order
// New: filter by selected factors AND apply item count scaling

let sectionItems = (s.assessment_section_items ?? [])
  .sort((a: any, b: any) => a.display_order - b.display_order);

if (allowedConstructIds) {
  sectionItems = sectionItems.filter((si: any) => {
    const item = si.items;
    // Always include non-construct items (attention checks, etc.)
    if (item?.purpose && item.purpose !== 'construct') return true;
    // Include if construct is in an allowed factor
    return item?.construct_id && allowedConstructIds!.has(item.construct_id);
  });

  // Apply item count scaling via item_selection_rules
  // Count unique constructs remaining, lookup items_per_construct
  // Then for each construct, keep only top N items by selection_priority
  // (Implementation: group by construct_id, sort by selection_priority, slice)
}
```

NOTE: The item count scaling logic should use `getItemsPerConstructForCount` from `src/app/actions/item-selection-rules.ts` to determine how many items per construct to include. Read that function's implementation to understand how to call it.

- [ ] **Step 6: Skip empty sections**

After filtering, skip sections that have zero items:

```typescript
// Filter out empty sections before returning
const filteredSections = sections.filter(s => s.items.length > 0);
```

Update section indices and progress calculation accordingly.

- [ ] **Step 7: Test manually**

Run the dev server, create a campaign with a custom factor selection, start an assessment. Verify:
- Only items from selected factors appear
- Empty sections are skipped
- Progress bar reflects actual item count
- Scoring works correctly after completion

- [ ] **Step 8: Commit**

```bash
git add src/app/actions/assess.ts
git commit -m "feat(runner): filter items by campaign factor selection at runtime"
```

---

## Task 5: Factor Picker UI Component

**Files:**
- Create: `src/app/(dashboard)/campaigns/[id]/assessments/factor-picker.tsx`

- [ ] **Step 1: Create the factor picker component**

A client component that shows:

**Props:**
```typescript
{
  campaignAssessmentId: string;
  assessmentId: string;
  assessmentTitle: string;
  minCustomFactors: number;
  currentSelection: { isCustom: boolean; selectedFactorIds: string[] };
  factorsByDimension: Array<{
    dimensionId: string | null;
    dimensionName: string | null;
    factors: Array<{
      factorId: string;
      factorName: string;
      factorDescription: string | null;
      constructCount: number;
    }>;
  }>;
}
```

**Features:**
1. **Mode toggle**: "Full Assessment" / "Custom Selection" — only shown when `minCustomFactors` is not null
2. **When in custom mode**, show:
   - Factors grouped by dimension in collapsible sections
   - Dimension header: name + "X of Y selected" counter
   - Factor row: checkbox + name + description (truncated) + construct count badge
   - All factors start unchecked (partner builds selection from scratch)
3. **Live summary bar** (sticky): factors · constructs · ~items · est. minutes · minimum warning
   - Calls `getFactorSelectionEstimate` to compute (or computes client-side from the data)
   - Warning state when below minimum
4. **Save button**: calls `saveFactorSelection`, disabled when below minimum
5. **Switch to Full Assessment**: calls `clearFactorSelection`, confirms via dialog if currently has selections
6. **Zone 2 save** with toast feedback + `useRouter().refresh()`

**UI patterns (CLAUDE.md):**
- ScrollReveal for factor groups
- Card-based layout for the picker panel
- Dark/light mode support
- `ConfirmDialog` for destructive actions (clearing selection)

- [ ] **Step 2: Compute estimates client-side using server-fetched rules**

The component receives `itemSelectionRules` as a prop (fetched once in the server page via `getItemSelectionRules()` from `src/app/actions/item-selection-rules.ts`). This avoids hardcoding thresholds that the admin can change.

```typescript
type ItemSelectionRule = { minConstructs: number; maxConstructs: number | null; itemsPerConstruct: number };

function computeEstimate(
  selectedFactorIds: string[],
  factorsByDimension: FactorsByDimension[],
  rules: ItemSelectionRule[]
) {
  let constructCount = 0;
  for (const group of factorsByDimension) {
    for (const factor of group.factors) {
      if (selectedFactorIds.includes(factor.factorId)) {
        constructCount += factor.constructCount;
      }
    }
  }

  // Find matching rule from server-fetched item_selection_rules
  const rule = rules.find(r =>
    constructCount >= r.minConstructs &&
    (r.maxConstructs === null || constructCount <= r.maxConstructs)
  );
  const itemsPerConstruct = rule?.itemsPerConstruct ?? 6;

  const estimatedItems = constructCount * itemsPerConstruct;
  const estimatedMinutes = Math.ceil(estimatedItems * 8 / 60);

  return { factorCount: selectedFactorIds.length, constructCount, estimatedItems, estimatedMinutes };
}
```

The page component passes `rules` from the server:
```typescript
// In page.tsx
const rules = await getItemSelectionRules();
// Pass to <FactorPicker itemSelectionRules={rules} ... />
```

- [ ] **Step 3: Compile check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/assessments/factor-picker.tsx
git commit -m "feat(ui): add factor picker component for campaign assessment customisation"
```

---

## Task 6: Integrate Factor Picker into Campaign Assessments Tab

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/assessments/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx`

- [ ] **Step 1: Update the assessments page to fetch factor data**

In `page.tsx`, for each campaign assessment, fetch:
1. The assessment's `minCustomFactors` value
2. The factors available (via `getFactorsForAssessment`)
3. The current selection (via `getFactorSelectionForCampaignAssessment`)

Pass this data alongside each assessment to the list component.

- [ ] **Step 2: Integrate factor picker into assessment cards**

In `campaign-assessments-list.tsx`, for each assessment card:

1. If `minCustomFactors` is not null, show the mode indicator: "Full Assessment" or "Custom (X factors)"
2. Add an expand/collapse trigger to show the factor picker panel
3. Render `<FactorPicker>` inline below the assessment card when expanded

The picker should be visually contained within/below the assessment card, expanding the card's content area.

- [ ] **Step 3: Handle the participant warning**

When saving a factor selection, check if the campaign has any completed participants:

```typescript
// Before saving, check for existing completions
const { count } = await db
  .from('campaign_participants')
  .select('*', { count: 'exact', head: true })
  .eq('campaign_id', campaignId)
  .in('status', ['in_progress', 'completed']);

if (count && count > 0) {
  // Show confirmation dialog
}
```

This check can happen in the save action (returning `{ requiresConfirmation: true, participantCount: N }`) or in the UI before calling save.

- [ ] **Step 4: Verify admin portal**

NOTE: Client portal factor selection is out of scope for this spec (deferred). The `<FactorPicker>` component is reusable and can be added to the client portal later with minimal work.

Test in admin portal:
- Factor picker shows only when `minCustomFactors` is set
- Selection saves and loads correctly
- Switching between full/custom works
- Summary bar updates in real-time
- Minimum factor validation enforced

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/assessments/
git commit -m "feat(campaigns): integrate factor picker into assessment tabs"
```

---

## Task 7: Assessment Builder — Customisation Toggle

**Files:**
- Modify: `src/app/actions/assessments.ts` — add update for `min_custom_factors`
- Modify: Assessment edit page (find the settings section)

- [ ] **Step 1: Find the assessment edit UI**

Read the assessment edit pages to find where settings are configured. Look in:
- `src/app/(dashboard)/assessments/[id]/edit/` or similar
- Find where assessment metadata (title, description, status) is edited

- [ ] **Step 2: Add the customisation toggle**

In the assessment settings area, add:
- "Allow factor customisation" toggle (Switch component)
- When on: "Minimum factors required" number input
  - Default: max(1, floor(totalFactors / 2))
  - Min: 1, Max: total factors in the assessment
- Both save as part of the assessment's Zone 2 save

- [ ] **Step 3: Add server action for saving**

Either extend the existing `updateAssessment` action or add a new `updateAssessmentCustomisation` action:

```typescript
// In assessments.ts
export async function updateAssessmentCustomisation(
  assessmentId: string,
  minCustomFactors: number | null
): Promise<{ success: true } | { error: string }> {
  await requireAdminScope();
  const db = createAdminClient();

  if (minCustomFactors !== null) {
    // Validate: get factor count for this assessment
    const { count } = await db
      .from('assessment_factors')
      .select('*', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId);

    if (minCustomFactors < 1 || (count && minCustomFactors > count)) {
      return { error: `Minimum must be between 1 and ${count}` };
    }
  }

  const { error } = await db
    .from('assessments')
    .update({ min_custom_factors: minCustomFactors })
    .eq('id', assessmentId);

  if (error) {
    logActionError('updateAssessmentCustomisation', error);
    return { error: 'Unable to update customisation settings.' };
  }

  revalidatePath('/assessments');
  return { success: true };
}
```

- [ ] **Step 4: Verify in assessment builder**

Navigate to an assessment, toggle customisation on, set minimum, save. Verify:
- Toggle on/off persists
- Minimum value saves correctly
- Validation prevents invalid values

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/assessments.ts src/app/\(dashboard\)/assessments/
git commit -m "feat(assessments): add factor customisation toggle to assessment builder"
```

---

## Task 8: Scoring Integration Verification

**Files:**
- Modify: `src/lib/scoring/ctt-session.ts` (if needed)

- [ ] **Step 1: Read the scoring code**

Read `src/lib/scoring/ctt-session.ts` to understand how it handles the item→construct→factor rollup. Verify that:

1. It only scores items that were actually answered
2. It handles missing constructs (no items answered) gracefully
3. Factor scores are computed only from constructs that have data

- [ ] **Step 2: Verify no changes needed**

The scoring should work automatically because:
- Excluded items are never presented → never answered → no responses
- Constructs with no responses produce no score
- Factor rollup uses only constructs with scores
- Dimension rollup uses only factors with scores

If the scoring code has assumptions about "all factors must have scores" or "all constructs must be present", fix those assumptions.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add src/lib/scoring/
git commit -m "fix(scoring): handle partial factor selection in CTT rollup"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] Create an assessment in admin with 10+ factors, enable customisation with minimum 3
- [ ] Create a campaign, attach the assessment
- [ ] Switch to "Custom Selection", pick 5 factors
- [ ] Verify live summary updates (factors, constructs, items, duration)
- [ ] Start the assessment as a participant — verify only selected factors' items appear
- [ ] Complete the assessment — verify scoring only includes selected factors
- [ ] Switch back to "Full Assessment" — verify all items reappear
- [ ] Test in partner/client portal — same picker works
- [ ] Verify existing campaigns without factor selection still work unchanged
