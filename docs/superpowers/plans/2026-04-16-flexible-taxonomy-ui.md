# Flexible Taxonomy Hierarchy UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI layer for the flexible taxonomy hierarchy — scoring level toggle in assessment builder, dimension-construct linking on library pages, construct picker for construct-level campaigns.

**Architecture:** Additive components that mirror existing factor-level UI patterns. Scoring level toggle is a single select in the builder's settings section. Library source and canvas card components are generalised to handle both factor and construct entities via a union type. New `DimensionConstructLinker` is shared between dimension and construct pages.

**Tech Stack:** Next.js App Router, React 19, TypeScript, shadcn/ui, @dnd-kit, sonner toasts, react-hook-form (where applicable), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-16-flexible-taxonomy-ui-design.md`
**Backend plan (dependency):** `docs/superpowers/plans/2026-04-16-flexible-taxonomy-hierarchy.md` — the `feat/flexible-taxonomy` branch must be merged or checked out before this plan can be executed.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/app/(dashboard)/assessments/construct-source.tsx` | Library panel listing library constructs grouped by dimension, with search + drag-to-canvas. Mirrors `factor-source.tsx`. |
| `src/components/dimension-construct-linker.tsx` | Reusable UI for managing dimension↔construct links. Takes a `direction` prop ("from-dimension" or "from-construct") and renders the list + add/edit/remove actions. |
| `src/app/(dashboard)/campaigns/[id]/assessments/construct-picker.tsx` | Campaign-level construct selection picker, accordion grouped by dimension. Mirrors `factor-picker.tsx`. |

### Modified files

| Path | What changes |
|---|---|
| `src/app/(dashboard)/assessments/assessment-builder.tsx` | Add `scoringLevel` state + Select in settings; swap library panel between FactorSource and ConstructSource based on mode; add `minCustomConstructs` input; pass all through to save actions. |
| `src/app/(dashboard)/assessments/assessment-canvas.tsx` | Generalise the canvas to accept `BuilderEntity[]` union; render the appropriate card based on entity kind. |
| `src/app/(dashboard)/assessments/draggable-factor-card.tsx` | Accept a `kind: 'factor' \| 'construct'` prop and adjust labels/icons. Or leave as-is and add a parallel `draggable-construct-card.tsx`. **Chosen approach:** leave card components as-is and create minimal parallel `draggable-construct-card.tsx` + `sortable-construct-card.tsx` to avoid risky refactor of working drag/drop code. |
| `src/app/(dashboard)/assessments/sortable-factor-card.tsx` | No change. Parallel construct version added. |
| `src/app/actions/assessments.ts` | Add `BuilderConstruct` type export, construct-related fields to `AssessmentFormData`, and assessment_constructs persistence. |
| `src/app/(dashboard)/dimensions/dimension-form.tsx` | Add "Linked Constructs" subsection in relationships tab, rendering `<DimensionConstructLinker direction="from-dimension" ... />`. |
| `src/app/(dashboard)/constructs/construct-form.tsx` | Add "Linked Dimensions" subsection in relationships tab, rendering `<DimensionConstructLinker direction="from-construct" ... />`. |
| `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx` | Branch picker render on `assessment.scoring_level`. |
| `src/app/(dashboard)/campaigns/[id]/assessments/page.tsx` | Branch data fetching on scoring level; load constructs via `getConstructsForAssessment()` when construct-level. |

### Parallel construct cards (new)

| Path | Responsibility |
|---|---|
| `src/app/(dashboard)/assessments/draggable-construct-card.tsx` | Mirror of `draggable-factor-card.tsx` for library construct cards. |
| `src/app/(dashboard)/assessments/sortable-construct-card.tsx` | Mirror of `sortable-factor-card.tsx` for canvas construct cards. |

---

## Task 1: Add Scoring Level Select to Assessment Builder

**Files:**
- Modify: `src/app/(dashboard)/assessments/assessment-builder.tsx`

**Context:** The builder already has `Select` dropdowns for Scoring Method and Item Selection Strategy. Add a third select for Scoring Level with the same styling. Field is editable only in create mode.

- [ ] **Step 1: Add scoring level state**

In `assessment-builder.tsx`, near the existing state declarations (scoringMethod, itemSelectionStrategy):

```tsx
const [scoringLevel, setScoringLevel] = useState<'factor' | 'construct'>(
  (assessment?.scoring_level as 'factor' | 'construct') ?? 'factor',
)
```

- [ ] **Step 2: Add Scoring Level Select in the settings section**

Find the existing Scoring Method select block and add a new Scoring Level block after it:

```tsx
<div className="space-y-2">
  <Label htmlFor="scoring-level">Scoring Level</Label>
  <Select
    value={scoringLevel}
    onValueChange={(v) => setScoringLevel(v as 'factor' | 'construct')}
    disabled={mode === 'edit'}
  >
    <SelectTrigger id="scoring-level">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="factor">Factor level</SelectItem>
      <SelectItem value="construct">Construct level</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    {mode === 'edit'
      ? 'Scoring level is locked after creation.'
      : 'Factor level groups constructs under factors. Construct level scores constructs directly under dimensions.'}
  </p>
</div>
```

- [ ] **Step 3: Pass scoring level through to create/update actions**

Find the save/update logic. In the payload passed to `createAssessment` / `updateAssessment`, add:

```tsx
scoringLevel,
minCustomConstructs: scoringLevel === 'construct' ? minCustomConstructs : null,
```

- [ ] **Step 4: Add minCustomConstructs state + input**

Parallel to the existing `minCustomFactors` input, add:

```tsx
const [minCustomConstructs, setMinCustomConstructs] = useState<number | null>(
  assessment?.min_custom_constructs ?? null,
)
```

Show the input only when `scoringLevel === 'construct'`:

```tsx
{scoringLevel === 'construct' && (
  <div className="space-y-2">
    <Label htmlFor="min-custom-constructs">Minimum custom constructs</Label>
    <Input
      id="min-custom-constructs"
      type="number"
      min={0}
      value={minCustomConstructs ?? ''}
      onChange={(e) => setMinCustomConstructs(
        e.target.value === '' ? null : Number(e.target.value)
      )}
    />
    <p className="text-xs text-muted-foreground">
      Leave blank to disallow campaign-level construct customisation.
    </p>
  </div>
)}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`
Expected: Navigate to assessment create page, see the Scoring Level select. Switch between factor/construct — observe the min-custom-constructs input appears/disappears.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/assessments/assessment-builder.tsx
git commit -m "feat(ui): add scoring level toggle to assessment builder"
```

---

## Task 2: Create ConstructSource Library Panel

**Files:**
- Create: `src/app/(dashboard)/assessments/construct-source.tsx`

**Context:** Mirror `factor-source.tsx` at the same path. Instead of rendering `DraggableFactorCard`, render the new `DraggableConstructCard` (built in Task 3). The panel loads constructs grouped by dimension — from `dimension_constructs` links, plus any untethered constructs in "Ungrouped".

- [ ] **Step 1: Read factor-source.tsx as reference**

Review `src/app/(dashboard)/assessments/factor-source.tsx` fully so you match the search + accordion grouping pattern.

- [ ] **Step 2: Create the file**

```tsx
"use client"

import { useState, useMemo } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"
import { DraggableConstructCard } from "./draggable-construct-card"
import type { BuilderConstruct } from "@/app/actions/assessments"

interface ConstructSourceProps {
  constructs: BuilderConstruct[]
  selectedIds: Set<string>
  onToggle: (construct: BuilderConstruct) => void
}

export function ConstructSource({
  constructs,
  selectedIds,
  onToggle,
}: ConstructSourceProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = useMemo(() => {
    if (!searchQuery) return constructs
    const q = searchQuery.toLowerCase()
    return constructs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.dimensionName && c.dimensionName.toLowerCase().includes(q)),
    )
  }, [constructs, searchQuery])

  const grouped = useMemo(() => {
    const acc: Record<string, BuilderConstruct[]> = {}
    for (const c of filtered) {
      const key = c.dimensionName || "Ungrouped"
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
    }
    return Object.entries(acc).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1
      if (b === "Ungrouped") return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  const allGroupNames = grouped.map(([name]) => name)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Construct Library
        </h3>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search constructs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <Accordion type="multiple" defaultValue={allGroupNames}>
        {grouped.map(([name, groupConstructs]) => (
          <AccordionItem key={name} value={name}>
            <AccordionTrigger>
              {name}
              <span className="text-xs text-muted-foreground ml-auto mr-2">
                {groupConstructs.length}
              </span>
            </AccordionTrigger>
            <AccordionPanel>
              <div className="space-y-1.5">
                {groupConstructs.map((c) => (
                  <DraggableConstructCard
                    key={c.id}
                    construct={c}
                    isAdded={selectedIds.has(c.id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/assessments/construct-source.tsx
git commit -m "feat(ui): add ConstructSource library panel for assessment builder"
```

---

## Task 3: Create Draggable and Sortable Construct Cards

**Files:**
- Create: `src/app/(dashboard)/assessments/draggable-construct-card.tsx`
- Create: `src/app/(dashboard)/assessments/sortable-construct-card.tsx`

**Context:** Parallel to the existing factor card components. Use the same icons, styling, and DnD setup. A construct has no construct count (it's the leaf), so show only item count and dimension badge.

- [ ] **Step 1: Create draggable-construct-card.tsx**

```tsx
"use client"

import { useDraggable } from "@dnd-kit/react"
import { Dna, FileQuestion, CheckCircle, Plus } from "lucide-react"
import type { BuilderConstruct } from "@/app/actions/assessments"

interface DraggableConstructCardProps {
  construct: BuilderConstruct
  isAdded: boolean
  onToggle: (construct: BuilderConstruct) => void
}

export function DraggableConstructCard({
  construct,
  isAdded,
  onToggle,
}: DraggableConstructCardProps) {
  const { ref, isDragging } = useDraggable({
    id: `source-${construct.id}`,
    data: { constructId: construct.id },
  })

  return (
    <div
      ref={ref}
      className={`group/construct relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
        isAdded
          ? "border-competency-accent/30 bg-competency-bg/30 ring-2 ring-competency-accent/20"
          : "border-border/50 bg-card hover:border-border hover:bg-muted/30"
      } ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-competency-bg">
        <Dna className="size-3.5 text-competency-accent" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-snug">
          {construct.name}
        </p>
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-0.5">
          <span className="inline-flex items-center gap-0.5">
            <FileQuestion className="size-3" />
            {construct.itemCount}
          </span>
        </div>
      </div>

      {isAdded ? (
        <CheckCircle className="size-4 shrink-0 text-competency-accent" />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(construct)
          }}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-0 group-hover/construct:opacity-100 hover:text-primary hover:bg-primary/10 transition-all"
          aria-label={`Add ${construct.name}`}
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create sortable-construct-card.tsx**

```tsx
"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import { GripVertical, X, Dna, FileQuestion } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { BuilderConstruct } from "@/app/actions/assessments"

interface SortableConstructCardProps {
  construct: BuilderConstruct
  index: number
  onRemove: (id: string) => void
}

export function SortableConstructCard({
  construct,
  index,
  onRemove,
}: SortableConstructCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: construct.id,
    index,
  })

  return (
    <Card
      ref={ref}
      className={`border-l-[3px] border-l-competency-accent transition-all duration-200 ${
        isDragging ? "opacity-50 scale-[0.98] ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <button
          ref={handleRef}
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-competency-bg">
          <Dna className="size-4 text-competency-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{construct.name}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {construct.dimensionName && (
              <Badge variant="dimension" className="text-[10px] px-1.5 py-0">
                {construct.dimensionName}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="size-3" />
              {construct.itemCount}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(construct.id)}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Remove ${construct.name}`}
        >
          <X className="size-4" />
        </button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/assessments/draggable-construct-card.tsx src/app/(dashboard)/assessments/sortable-construct-card.tsx
git commit -m "feat(ui): add draggable + sortable construct card components"
```

---

## Task 4: Add BuilderConstruct Type and Construct Data Loading

**Files:**
- Modify: `src/app/actions/assessments.ts`

**Context:** The builder needs a `BuilderConstruct` type and a way to load library constructs grouped by their dimensions (via `dimension_constructs`). Add this alongside the existing `BuilderFactor` exports.

- [ ] **Step 1: Add BuilderConstruct type**

In `src/app/actions/assessments.ts`, near the existing `BuilderFactor` export, add:

```typescript
export type BuilderConstruct = {
  id: string
  name: string
  description: string | null
  dimensionId: string | null
  dimensionName: string | null
  itemCount: number
}

export type AssessmentConstructLink = {
  constructId: string
  dimensionId: string | null
  weight: number
  itemCount: number
}
```

- [ ] **Step 2: Add server action to load library constructs**

Near the existing `getLibraryFactors` (or equivalent) action, add:

```typescript
export async function getLibraryConstructs(): Promise<BuilderConstruct[]> {
  await requireAssessmentBuilderScope()
  const db = createAdminClient()

  // Load all active constructs with their dimension link (via dimension_constructs)
  // A construct may belong to multiple dimensions; take the first one for display
  const { data: constructs, error } = await db
    .from('constructs')
    .select('id, name, description')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)

  const constructIds = (constructs ?? []).map((c) => c.id)
  if (constructIds.length === 0) return []

  // Load dimension links
  const { data: dcLinks } = await db
    .from('dimension_constructs')
    .select('construct_id, dimension_id, dimensions(id, name)')
    .in('construct_id', constructIds)

  // Build construct_id → first dimension mapping
  const dimByConstruct = new Map<string, { id: string; name: string }>()
  for (const link of dcLinks ?? []) {
    if (!dimByConstruct.has(link.construct_id)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dim = (link as any).dimensions as { id: string; name: string } | null
      if (dim) dimByConstruct.set(link.construct_id, dim)
    }
  }

  // Count items per construct
  const { data: items } = await db
    .from('items')
    .select('construct_id')
    .in('construct_id', constructIds)
    .is('deleted_at', null)

  const itemCountByConstruct = new Map<string, number>()
  for (const i of items ?? []) {
    itemCountByConstruct.set(
      i.construct_id,
      (itemCountByConstruct.get(i.construct_id) ?? 0) + 1,
    )
  }

  return (constructs ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    dimensionId: dimByConstruct.get(c.id)?.id ?? null,
    dimensionName: dimByConstruct.get(c.id)?.name ?? null,
    itemCount: itemCountByConstruct.get(c.id) ?? 0,
  }))
}
```

- [ ] **Step 3: Update createAssessment/updateAssessment to persist assessment_constructs**

In the existing `createAssessment` function, after the `assessment_factors` insert block, add:

```typescript
// Insert construct junction records (when scoring_level = 'construct')
if (scoringLevel === 'construct' && Array.isArray(payload.constructs)) {
  const constructs = payload.constructs as AssessmentConstructLink[]
  if (constructs.length > 0) {
    const links = constructs.map((c) => ({
      assessment_id: assessment.id,
      construct_id: c.constructId,
      dimension_id: c.dimensionId,
      weight: c.weight,
      item_count: c.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_constructs').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }
}
```

And in `updateAssessment`, parallel to the `assessment_factors` replace block:

```typescript
// Replace construct junction records (when scoring_level = 'construct')
if (updatedScoringLevel === 'construct') {
  await db.from('assessment_constructs').delete().eq('assessment_id', id)

  const constructs = Array.isArray(payload.constructs)
    ? (payload.constructs as AssessmentConstructLink[])
    : []

  if (constructs.length > 0) {
    const links = constructs.map((c) => ({
      assessment_id: id,
      construct_id: c.constructId,
      dimension_id: c.dimensionId,
      weight: c.weight,
      item_count: c.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_constructs').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }
}
```

- [ ] **Step 4: Load existing assessment_constructs on edit**

In the page/edit loader (wherever `getAssessmentForEdit` or similar lives), add:

```typescript
const { data: constructLinks } = await db
  .from('assessment_constructs')
  .select('construct_id, dimension_id, weight, item_count')
  .eq('assessment_id', id)

// Include in returned data:
// existingConstructs: (constructLinks ?? []).map((c) => ({
//   constructId: c.construct_id,
//   dimensionId: c.dimension_id,
//   weight: Number(c.weight),
//   itemCount: c.item_count ?? 0,
// }))
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/assessments.ts
git commit -m "feat(ui): add BuilderConstruct type and assessment_constructs persistence"
```

---

## Task 5: Wire Assessment Canvas to Handle Construct-Level Mode

**Files:**
- Modify: `src/app/(dashboard)/assessments/assessment-canvas.tsx`
- Modify: `src/app/(dashboard)/assessments/assessment-builder.tsx`

**Context:** The `AssessmentCanvas` currently accepts `factors: BuilderFactor[]`. Extend its props with an optional `constructs: BuilderConstruct[]` and a `mode: 'factor' | 'construct'`, render `SortableConstructCard` when mode is construct. The builder passes the right data based on `scoringLevel`.

- [ ] **Step 1: Read assessment-canvas.tsx**

Read the full file to understand its current structure.

- [ ] **Step 2: Generalise AssessmentCanvas**

Add a `mode` prop and a parallel `constructs` prop. Keep the existing factor rendering path unchanged when mode is 'factor'. When mode is 'construct', render `SortableConstructCard` for each construct in the list.

Key changes:
- Props gain `mode: 'factor' | 'construct'` and `constructs?: BuilderConstruct[]`
- Internal sort/add/remove logic works identically (same IDs, same weights/item counts)
- The rendered card component branches based on mode

- [ ] **Step 3: Wire up in assessment-builder.tsx**

In `assessment-builder.tsx`:
- Add `constructs` state parallel to existing `factors` state
- Add `onAddConstruct`, `onRemoveConstruct` handlers parallel to factor handlers
- Render `<FactorSource>` or `<ConstructSource>` based on `scoringLevel`
- Render `<AssessmentCanvas mode={scoringLevel} factors={factors} constructs={constructs} ... />`

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`
Expected: Creating a construct-level assessment shows the Construct Library panel on the left; dragging a construct onto the canvas works identically to how factors do.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/assessments/assessment-canvas.tsx src/app/(dashboard)/assessments/assessment-builder.tsx
git commit -m "feat(ui): wire assessment canvas for construct-level mode"
```

---

## Task 6: Build DimensionConstructLinker Component

**Files:**
- Create: `src/components/dimension-construct-linker.tsx`

**Context:** Reusable component used on both dimension and construct pages. Shows the list of linked entities with weight + remove, and a "+ Link" button that opens a searchable multi-select dialog.

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"
import { Plus, X, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  linkConstructToDimension,
  unlinkConstructFromDimension,
  updateDimensionConstructLink,
} from "@/app/actions/dimension-constructs"
import { useRouter } from "next/navigation"

type LinkRow = {
  id: string
  otherId: string
  otherName: string
  weight: number
}

type Option = { id: string; name: string }

interface DimensionConstructLinkerProps {
  direction: "from-dimension" | "from-construct"
  entityId: string // dimension_id or construct_id (the "from" side)
  links: LinkRow[]
  availableOptions: Option[] // the opposite-side entities available to link
}

export function DimensionConstructLinker({
  direction,
  entityId,
  links,
  availableOptions,
}: DimensionConstructLinkerProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const linkedIds = new Set(links.map((l) => l.otherId))
  const unlinkedOptions = availableOptions.filter((o) => !linkedIds.has(o.id))
  const filtered = search
    ? unlinkedOptions.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : unlinkedOptions

  const otherLabel = direction === "from-dimension" ? "construct" : "dimension"
  const otherLabelPlural = direction === "from-dimension" ? "constructs" : "dimensions"

  async function handleLinkMany() {
    if (selectedNew.size === 0) return
    setSaving(true)
    try {
      for (const otherId of selectedNew) {
        const dimensionId = direction === "from-dimension" ? entityId : otherId
        const constructId = direction === "from-dimension" ? otherId : entityId
        await linkConstructToDimension(dimensionId, constructId, 1.0, 0)
      }
      toast.success(`Linked ${selectedNew.size} ${otherLabelPlural}.`)
      setDialogOpen(false)
      setSelectedNew(new Set())
      setSearch("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link.")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnlink(otherId: string) {
    try {
      const dimensionId = direction === "from-dimension" ? entityId : otherId
      const constructId = direction === "from-dimension" ? otherId : entityId
      await unlinkConstructFromDimension(dimensionId, constructId)
      toast.success(`Unlinked ${otherLabel}.`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlink.")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Linked {otherLabelPlural.replace(/^./, (c) => c.toUpperCase())}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {links.length} linked
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3.5 mr-1" /> Link {otherLabel}
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No {otherLabelPlural} linked yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="text-sm font-medium flex-1">{link.otherName}</span>
              <WeightEditor link={link} />
              <button
                type="button"
                onClick={() => handleUnlink(link.otherId)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Unlink"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Link {otherLabelPlural} to this{" "}
              {direction === "from-dimension" ? "dimension" : "construct"}
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder={`Search ${otherLabelPlural}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-80 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {unlinkedOptions.length === 0
                  ? `All ${otherLabelPlural} are already linked.`
                  : "No matches."}
              </p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedNew.has(opt.id)}
                    onCheckedChange={() => {
                      setSelectedNew((prev) => {
                        const next = new Set(prev)
                        if (next.has(opt.id)) next.delete(opt.id)
                        else next.add(opt.id)
                        return next
                      })
                    }}
                  />
                  <span className="text-sm">{opt.name}</span>
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleLinkMany} disabled={saving || selectedNew.size === 0}>
              {saving ? "Linking..." : `Link ${selectedNew.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WeightEditor({ link }: { link: LinkRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(link.weight)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateDimensionConstructLink(link.id, { weight: value })
      toast.success("Weight updated.")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" /> weight: {link.weight.toFixed(1)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2">
        <div>
          <label className="text-xs font-medium">Weight</label>
          <Input
            type="number"
            step="0.1"
            min="0.01"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dimension-construct-linker.tsx
git commit -m "feat(ui): add DimensionConstructLinker shared component"
```

---

## Task 7: Add Linker to Dimension Page Relationships Tab

**Files:**
- Modify: `src/app/(dashboard)/dimensions/dimension-form.tsx`
- Modify: `src/app/(dashboard)/dimensions/page.tsx` or whichever loader provides dimension data

**Context:** Add a "Linked Constructs" subsection below the existing "Child Factors" section. Load the linked constructs and all available constructs from the loader.

- [ ] **Step 1: Update the page-level data loader**

Find where the dimension detail page loads data. Add:

```typescript
import { getDimensionConstructs } from "@/app/actions/dimension-constructs"
import { getAllConstructs } from "@/app/actions/constructs"  // or equivalent

// In the loader:
const [dimensionConstructs, allConstructs] = await Promise.all([
  getDimensionConstructs(dimension.id),
  getAllConstructs(),  // returns { id, name }[]
])
```

Pass these to `<DimensionForm>` as props.

- [ ] **Step 2: Update DimensionForm props**

In `dimension-form.tsx`, extend the props:

```tsx
interface DimensionFormProps {
  mode: "create" | "edit"
  dimension?: DimensionWithChildren
  dimensionConstructs?: Array<{
    id: string
    construct_id: string
    weight: number
    constructs: { id: string; name: string } | null
  }>
  allConstructs?: Array<{ id: string; name: string }>
}
```

- [ ] **Step 3: Render the linker in the Relationships tab**

Find the existing `<TabsContent value="relationships">` block. Below the existing "Child Factors" card, add:

```tsx
<Card className="mt-4">
  <CardHeader>
    <CardTitle>Linked Constructs</CardTitle>
    <CardDescription>
      Constructs linked directly to this dimension. Used when an assessment
      scores at construct level (factors skipped).
    </CardDescription>
  </CardHeader>
  <CardContent>
    <DimensionConstructLinker
      direction="from-dimension"
      entityId={dimension!.id}
      links={(dimensionConstructs ?? []).map((dc) => ({
        id: dc.id,
        otherId: dc.construct_id,
        otherName: dc.constructs?.name ?? dc.construct_id,
        weight: Number(dc.weight),
      }))}
      availableOptions={allConstructs ?? []}
    />
  </CardContent>
</Card>
```

Don't forget the import:

```tsx
import { DimensionConstructLinker } from "@/components/dimension-construct-linker"
```

- [ ] **Step 4: Add getAllConstructs action if it doesn't exist**

In `src/app/actions/constructs.ts`, if no suitable loader exists, add:

```typescript
export async function getAllConstructs(): Promise<Array<{ id: string; name: string }>> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('constructs')
    .select('id, name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`
Expected: Navigate to a dimension detail page → Relationships tab. See "Linked Constructs" section with [+ Link construct] button. Click it, select a construct, save, verify it appears in the list.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/dimensions src/app/actions/constructs.ts
git commit -m "feat(ui): add construct linker to dimension relationships tab"
```

---

## Task 8: Add Linker to Construct Page Relationships Tab

**Files:**
- Modify: `src/app/(dashboard)/constructs/construct-form.tsx`
- Modify: `src/app/(dashboard)/constructs/page.tsx` or the detail page loader

**Context:** Mirror Task 7 for constructs. Add a "Linked Dimensions" subsection with the same UX.

- [ ] **Step 1: Update the page-level loader**

Add:

```typescript
import { getConstructDimensions } from "@/app/actions/dimension-constructs"
import { getAllDimensions } from "@/app/actions/dimensions"

const [constructDimensions, allDimensions] = await Promise.all([
  getConstructDimensions(construct.id),
  getAllDimensions(),
])
```

- [ ] **Step 2: Update ConstructForm props and render the linker**

Pass `constructDimensions` and `allDimensions` to `ConstructForm`. In the relationships-related tab, add:

```tsx
<Card className="mt-4">
  <CardHeader>
    <CardTitle>Linked Dimensions</CardTitle>
    <CardDescription>
      Dimensions this construct is linked directly to. Used for construct-level
      scoring (factors skipped).
    </CardDescription>
  </CardHeader>
  <CardContent>
    <DimensionConstructLinker
      direction="from-construct"
      entityId={construct!.id}
      links={(constructDimensions ?? []).map((cd) => ({
        id: cd.id,
        otherId: cd.dimension_id,
        otherName: cd.dimensions?.name ?? cd.dimension_id,
        weight: Number(cd.weight),
      }))}
      availableOptions={allDimensions ?? []}
    />
  </CardContent>
</Card>
```

- [ ] **Step 3: Add getAllDimensions if needed**

In `src/app/actions/dimensions.ts`:

```typescript
export async function getAllDimensions(): Promise<Array<{ id: string; name: string }>> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('dimensions')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 4: Verify in browser**

Expected: Construct detail page → Relationships tab shows "Linked Dimensions". Link a dimension, verify the link appears on the matching dimension's relationships tab (bidirectional).

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/constructs src/app/actions/dimensions.ts
git commit -m "feat(ui): add dimension linker to construct relationships tab"
```

---

## Task 9: Build ConstructPicker for Campaigns

**Files:**
- Create: `src/app/(dashboard)/campaigns/[id]/assessments/construct-picker.tsx`

**Context:** Mirror `factor-picker.tsx` entirely. The data shape is similar — constructs grouped by dimension instead of factors grouped by dimension. No `constructCount` per item (constructs are the leaf). Uses `saveConstructSelection` / `clearConstructSelection` server actions.

- [ ] **Step 1: Read factor-picker.tsx in full**

Read `src/app/(dashboard)/campaigns/[id]/assessments/factor-picker.tsx` completely. You'll adapt its structure line-for-line.

- [ ] **Step 2: Create construct-picker.tsx**

Mirror the structure of factor-picker with these changes:
- Props use `constructsByDimension` with shape `{ dimensionId, dimensionName, constructs: [{ constructId, constructName, constructDescription }] }`
- Props use `minCustomConstructs` instead of `minCustomFactors`
- The estimate calculation uses `selectedIds.size` as the construct count directly (no multiplication via `factor.constructCount`)
- Calls `saveConstructSelection` / `clearConstructSelection` from `@/app/actions/construct-selection`
- Labels say "construct(s)" instead of "factor(s)" throughout

Core structural template:

```tsx
"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ScrollReveal } from "@/components/scroll-reveal"
import {
  saveConstructSelection,
  clearConstructSelection,
} from "@/app/actions/construct-selection"
import { cn } from "@/lib/utils"

type ConstructPickerProps = {
  campaignAssessmentId: string
  minCustomConstructs: number
  currentSelection: { isCustom: boolean; selectedConstructIds: string[] }
  constructsByDimension: Array<{
    dimensionId: string | null
    dimensionName: string | null
    constructs: Array<{
      constructId: string
      constructName: string
      constructDescription: string | null
    }>
  }>
  itemSelectionRules: Array<{
    minConstructs: number
    maxConstructs: number | null
    itemsPerConstruct: number
  }>
  hasCompletedParticipants?: boolean
}

function computeEstimate(
  selectedIds: string[],
  rules: ConstructPickerProps["itemSelectionRules"],
) {
  const constructCount = selectedIds.length
  const rule = rules.find(
    (r) =>
      constructCount >= r.minConstructs &&
      (r.maxConstructs === null || constructCount <= r.maxConstructs),
  )
  const itemsPerConstruct = rule?.itemsPerConstruct ?? 6
  const estimatedItems = constructCount * itemsPerConstruct
  const estimatedMinutes = Math.ceil((estimatedItems * 8) / 60)
  return { constructCount, estimatedItems, estimatedMinutes }
}

// ... (rest of the component structure mirrors FactorPicker:
// - isCustom toggle
// - expandedDimensions state
// - toggleConstruct, toggleDimension, toggleAllInDimension handlers
// - belowMinimum + canSave computed
// - save/clear with confirmation dialogs
// - Accordion-style dimension groups with checkboxes
// - Estimate bar at top
// - Save/Reset buttons at bottom
// Replace every "factor"/"factors" label with "construct"/"constructs"
// Remove constructCount badges (constructs are the leaf))
```

Follow the factor-picker structure exactly, just with construct terminology and data shape. No new UX patterns — full fidelity mirror.

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/assessments/construct-picker.tsx
git commit -m "feat(ui): add ConstructPicker for campaign-level construct selection"
```

---

## Task 10: Branch Campaign Picker Rendering and Data Loading

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/assessments/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx`

**Context:** The campaign assessments page currently always renders `FactorPicker`. Branch on `assessment.scoring_level` to render `ConstructPicker` instead when needed. Fetch the appropriate data (factors vs constructs) based on level.

- [ ] **Step 1: Update page.tsx to fetch scoring_level per assessment**

In the page loader, update the per-assessment data fetching to include `scoring_level`. For each campaign-assessment:

```typescript
const assessmentScoringLevel = assessment.scoring_level as 'factor' | 'construct'

const pickerData = assessmentScoringLevel === 'construct'
  ? {
      kind: 'construct' as const,
      constructsByDimension: await getConstructsForAssessment(assessment.id),
      selection: await getConstructSelectionForCampaignAssessment(ca.id),
    }
  : {
      kind: 'factor' as const,
      factorsByDimension: await getFactorsForAssessment(assessment.id),
      selection: await getFactorSelectionForCampaignAssessment(ca.id),
    }
```

Pass `pickerData` down to the list component.

- [ ] **Step 2: Branch rendering in campaign-assessments-list.tsx**

In the assessment card render block:

```tsx
{pickerData.kind === 'construct' ? (
  <ConstructPicker
    campaignAssessmentId={ca.id}
    minCustomConstructs={assessment.min_custom_constructs ?? 0}
    currentSelection={pickerData.selection}
    constructsByDimension={pickerData.constructsByDimension}
    itemSelectionRules={itemSelectionRules}
  />
) : (
  <FactorPicker
    campaignAssessmentId={ca.id}
    minCustomFactors={assessment.min_custom_factors ?? 0}
    currentSelection={pickerData.selection}
    factorsByDimension={pickerData.factorsByDimension}
    itemSelectionRules={itemSelectionRules}
  />
)}
```

Add the `ConstructPicker` import.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Expected: A factor-level campaign still shows the factor picker; a construct-level campaign shows the construct picker. Save/clear works in both.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/assessments/
git commit -m "feat(ui): branch campaign picker rendering by scoring level"
```

---

## Task 11: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run Next.js dev build**

Run: `npm run build`
Expected: Build succeeds. Warnings OK, errors not OK.

- [ ] **Step 3: Manual acceptance — factor-level regression**

1. Create a factor-level assessment end to end (select "Factor level" or leave default)
2. Verify the factor library panel renders as before
3. Drag factors onto the canvas; weights and item counts work
4. Save; re-open in edit mode
5. Verify the scoring level select is disabled with the locked-helper-text
6. Create a campaign using this assessment; verify the factor picker renders

- [ ] **Step 4: Manual acceptance — construct-level flow**

1. Create an assessment; change scoring level to "Construct level"
2. Verify the Construct Library panel appears (replacing the factor library)
3. Verify `min_custom_constructs` field appears
4. Drag constructs onto the canvas; verify weights/item counts
5. Save; re-open
6. Verify scoring level is locked
7. Create a campaign with this assessment; verify the Construct Picker renders
8. Custom-select constructs; save; verify persistence

- [ ] **Step 5: Manual acceptance — dimension-construct linking**

1. Open a dimension detail page → Relationships tab
2. Link 2-3 constructs via the "+ Link construct" dialog
3. Verify they appear in the list with weight 1.0
4. Click the weight editor; change weight; save
5. Remove one link
6. Open the construct detail page for one of the linked constructs
7. Verify it shows the dimension under "Linked Dimensions" (bidirectional)

- [ ] **Step 6: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix(ui): integration verification fixes"
```
