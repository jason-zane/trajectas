# Flexible Taxonomy Hierarchy — UI Design

## Problem

The backend for flexible taxonomy hierarchy is complete (see `2026-04-16-flexible-taxonomy-hierarchy-design.md`). The UI layer is missing: users have no way to choose the scoring level when creating an assessment, link constructs directly to dimensions, or select constructs for construct-level campaigns.

## Goals

1. Add a scoring level toggle to the assessment builder (create-time only, locked after)
2. Add a construct library source panel that mirrors the existing factor source when scoring level is `construct`
3. Enable dimension-construct linking from both the dimension page and the construct page
4. Add a construct picker for campaign-level construct selection, mirroring the existing factor picker
5. Preserve all existing factor-level UI — no regressions

## Non-Goals

- Changing how weights are managed for existing `factor_constructs` links
- Redesigning the existing factor picker UX
- Adding bulk-link / drag-and-drop / import UI for dimension-construct relationships (simple "link construct" button only)
- Allowing scoring level changes after assessment creation

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scoring level choice timing | Create time, locked after | Switching breaks existing scores; locking is cleanest |
| Toggle placement | In-builder Settings (not pre-builder step) | Consistent with existing scoring method / strategy selects |
| Library source panel for construct-level | Same drag-and-drop component, different data | Reuses canvas wiring, consistent mental model |
| Dimension-construct linking | Both sides (dimension page AND construct page) | Bidirectional relationship, linking from either makes sense |
| Link weight UX | Default to 1.0, edit later if needed | Simple create flow, advanced control available |
| Campaign construct picker | Mirror factor picker (accordion grouped by dimension) | Familiar pattern, consistent with factor-level campaigns |

## Assessment Builder — Scoring Level Toggle

### Placement

New select field in the builder's existing settings section, in `assessment-builder.tsx`, alongside "Scoring Method" and "Item Selection Strategy".

### Field

```
Scoring Level
[ Factor level ▼ ]
Choose whether to score at factor level (constructs grouped under factors)
or construct level (constructs grouped directly under dimensions).
Locked after creation.
```

Options:
- `factor` — "Factor level" (default)
- `construct` — "Construct level"

### Behavior

- **Create mode:** Editable. Default `factor`. Selecting `construct` swaps the library panel from factors to constructs and reveals a new `min_custom_constructs` input (mirrors existing `min_custom_factors`).
- **Edit mode:** Disabled. Helper text: "Scoring level is locked after creation."

### Files

- `src/app/(dashboard)/assessments/assessment-builder.tsx` — add scoring level state, pass through to `createAssessment` / `updateAssessment`
- `src/app/(dashboard)/assessments/construct-source.tsx` (new) — mirrors `factor-source.tsx`, shows constructs grouped by dimension

## Assessment Canvas — Construct Support

The existing `AssessmentCanvas`, `DraggableFactorCard`, and `SortableFactorCard` components need to accept construct data in construct-level mode.

### Approach

Introduce a union type `BuilderEntity = BuilderFactor | BuilderConstruct` at the component layer. The components branch internally on entity type to display:
- Factor mode: factor name, dimension name, construct count badge
- Construct mode: construct name, dimension name (no construct count — it's the leaf)

Weight and item-count fields work identically in both modes — they persist to `assessment_factors` or `assessment_constructs` depending on scoring level.

### Files

- `src/app/(dashboard)/assessments/assessment-canvas.tsx` — generalise to accept `BuilderEntity[]`, render based on type
- `src/app/(dashboard)/assessments/draggable-factor-card.tsx` → rename-and-generalise to `draggable-entity-card.tsx`, or add a parallel `draggable-construct-card.tsx` with shared styling
- `src/app/(dashboard)/assessments/sortable-factor-card.tsx` → same approach
- `src/app/(dashboard)/assessments/construct-source.tsx` (new) — mirrors `factor-source.tsx`

**Recommendation:** Rename-and-generalise the single set of card components to `entity-card` variants. Cleaner than duplicating two card trees.

## Dimension-Construct Linking — Relationships Tab

### Dimension page

Existing `dimension-form.tsx` has a "Relationships" tab showing "Child Factors" (read-only list with links to factor detail pages). Add a new subsection below it:

```
Linked Constructs (2)                      [+ Link construct]
─ Emotional Regulation    weight: 1.0    [edit] [✕]
─ Empathy                 weight: 1.0    [edit] [✕]
```

### Construct page

Existing `construct-form.tsx` has a relationships section for its factor links. Add a new subsection below it:

```
Linked Dimensions (1)                      [+ Link dimension]
─ Emotional Intelligence  weight: 1.0    [edit] [✕]
```

### Shared linker component

Build a reusable `DimensionConstructLinker` component that takes a direction prop:

```typescript
interface DimensionConstructLinkerProps {
  direction: 'from-dimension' | 'from-construct'
  entityId: string              // dimension_id or construct_id
  links: DimensionConstructLink[]
  availableOptions: { id: string; name: string }[]  // opposite-side entities
}
```

The component renders:
- The list of existing links with weight display and edit/remove actions
- A "+ Link" button that opens a searchable multi-select picker dialog
- Weight default is 1.0 on link creation
- `[edit]` opens a small popover with a numeric weight input

### Files

- `src/components/dimension-construct-linker.tsx` (new, shared)
- `src/app/(dashboard)/dimensions/dimension-form.tsx` — add "Linked Constructs" subsection in relationships tab
- `src/app/(dashboard)/constructs/construct-form.tsx` — add "Linked Dimensions" subsection in relationships tab
- Server page props for both must load `getDimensionConstructs(id)` / `getConstructDimensions(id)` and the opposite-side entity list

## Campaign Construct Picker

### Placement

Existing `factor-picker.tsx` lives at `src/app/(dashboard)/campaigns/[id]/assessments/factor-picker.tsx`. Create `construct-picker.tsx` alongside it with a mirrored structure.

### UX

- Accordion groups: constructs grouped by their dimension (from `assessment_constructs.dimension_id`)
- Each construct: checkbox + name + description
- Top-of-page summary: "X of Y constructs · ~N items · ~M min"
- Footer: "Minimum: `min_custom_constructs` required"
- Save / Reset buttons

### Branching

`campaign-assessments-list.tsx` reads `assessment.scoring_level` per campaign-assessment and renders the right picker:

```tsx
{assessment.scoring_level === 'construct'
  ? <ConstructPicker ... />
  : <FactorPicker ... />}
```

### Page data loading

`page.tsx` needs to fetch the right data depending on scoring level:
- Factor level: `getFactorsForAssessment(id)` → `factorsByDimension`
- Construct level: `getConstructsForAssessment(id)` → `constructsByDimension`

### Files

- `src/app/(dashboard)/campaigns/[id]/assessments/construct-picker.tsx` (new)
- `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx` — branch picker rendering
- `src/app/(dashboard)/campaigns/[id]/assessments/page.tsx` — branch data fetching

## Data Flow

All server actions already exist from the backend work:

| UI action | Server action (already built) |
|---|---|
| Create/update assessment with scoring level | `createAssessment`, `updateAssessment` |
| Link construct to dimension | `linkConstructToDimension` |
| Unlink construct from dimension | `unlinkConstructFromDimension` |
| Update link weight | `updateDimensionConstructLink` |
| Load links (dimension side) | `getDimensionConstructs` |
| Load links (construct side) | `getConstructDimensions` |
| Load constructs for campaign picker | `getConstructsForAssessment` |
| Save campaign construct selection | `saveConstructSelection` |
| Clear campaign construct selection | `clearConstructSelection` |

## Migration Safety

- **Default behavior unchanged:** `scoring_level` defaults to `factor`. Every existing assessment and campaign renders exactly as today.
- **Additive components:** `ConstructSource`, `ConstructPicker`, `DimensionConstructLinker` are new files. No existing component is deleted.
- **Relationships tab additions:** Adding a subsection below existing "Child Factors" / "Linked Factors" doesn't affect the existing read-only lists.
- **Assessment canvas changes:** Generalising the card components from `factor-card` to `entity-card` is an internal refactor; external behavior for factor-level assessments is identical.

## Testing Strategy

### Manual acceptance
- Create a factor-level assessment end-to-end → verify no regression in factor picker / canvas / settings
- Create a construct-level assessment → verify construct library panel renders, canvas accepts constructs, settings persist
- Edit a factor-level assessment → verify scoring level select is disabled
- Link a construct to a dimension from dimension page → verify the link appears on the construct page (bidirectional)
- Create a construct-level campaign → verify construct picker renders, saves, participant session uses selected constructs

### Component-level
- `DimensionConstructLinker` with both directions: link, unlink, update weight, empty state
- `ConstructPicker` with various selection counts, hitting min/max boundaries
- `ConstructSource` with search filtering, grouping by dimension
- `AssessmentCanvas` rendering both factor-entity and construct-entity cards

## File Impact Summary

| File | Change | Risk |
|---|---|---|
| `assessment-builder.tsx` | Add scoring level select, conditional construct UI | Medium — core builder |
| `assessment-canvas.tsx` | Generalise card types | Medium — refactor of shared component |
| `draggable-factor-card.tsx` | Rename/generalise | Low — internal refactor |
| `sortable-factor-card.tsx` | Rename/generalise | Low — internal refactor |
| `factor-source.tsx` | No change (kept for factor mode) | None |
| `construct-source.tsx` | New file, mirrors factor-source | Low |
| `dimension-form.tsx` | Add subsection in relationships tab | Low — additive |
| `construct-form.tsx` | Add subsection in relationships tab | Low — additive |
| `dimension-construct-linker.tsx` | New shared component | Low |
| `construct-picker.tsx` | New file, mirrors factor-picker | Low |
| `campaign-assessments-list.tsx` | Branch picker rendering | Low |
| `campaigns/[id]/assessments/page.tsx` | Branch data fetching | Low |
