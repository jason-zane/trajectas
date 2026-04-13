# UI Consistency System — Design Spec

**Date:** 2026-04-13
**Status:** Approved for implementation planning
**Approach:** Option C — parallel infrastructure + gold standard pages, admin portal first

---

## Problem Statement

The app has strong primitives (`Button`, `Input`, `Select`, `Tabs`) and strong individual pages (admin dashboard, partner details form), but the composition layer is inconsistent. The same interaction role — tabbed navigation, save actions, edit sections, loading states — is treated differently depending on which page authored it. Raw technical values (UUIDs, internal codes) surface in dropdowns. Loading skeletons range from structural and precise to empty blobs. The result is a product that feels unfinished compared to the standard it is capable of.

The target standard is Apple: restraint over decoration, typography-led hierarchy, purposeful motion, no raw plumbing visible to users, and absolute consistency in every repeated interaction pattern.

---

## Design Principles

These six rules govern every decision in this system. A surface is not done until it passes all six.

### 1. No raw plumbing visible
UUIDs, slugs, internal codes, developer-facing strings (`"Please wait..."`, `"Saving…"` with wrong ellipsis, kebab-case identifiers) never appear in the UI. Every value shown to a user is a human-readable label. The current `SelectValue` UUID bug in the quick-launch modal is the canonical example of this violation.

### 2. Typography does the work
Hierarchy is established through weight, size, and colour — not boxes, dividers, or decoration. Sections do not need heavy card chrome if the type is right. The existing CSS variable system (`--primary`, taxonomy colours, `.text-section`, `.text-caption`, `.text-overline`) is the right tool; use it consistently.

### 3. Motion is purposeful, not performative
Page transitions, loading states, and feedback animations exist to communicate state — not to decorate. Speed: 150–250ms. Curve: ease-out. The `ScrollReveal` + `TiltCard` pattern on the dashboard is the correct ceiling — not to be exceeded elsewhere.

### 4. Loading states are structural
A loading skeleton must match the actual page layout — same grid, same proportions, same card shapes. `dashboard/loading.tsx` and `settings/ai/loading.tsx` are the quality floor. `clients/[slug]/overview/loading.tsx` (blobs only) is the anti-pattern. Every `loading.tsx` in the app is rebuilt to the structural standard.

### 5. Every interaction has exactly one treatment
Tabs serving the same role look identical. Save buttons behave identically. Nothing is hand-rolled when a system component exists. If a component doesn't exist yet, build it once and use it everywhere.

### 6. Restraint is a feature
Each screen does the minimum required. Section title, one short description, content. No redundant labels, no extra borders, no duplicate calls to action. When in doubt, remove.

---

## Architecture

Two parallel tracks that converge on the admin portal gold standard, then roll to partner and client portals.

```
Track 1: Infrastructure          Track 2: Gold Standard Pages
─────────────────────────        ────────────────────────────
RouteTabs                   →    Client detail shell (uses RouteTabs)
SaveButton                  →    Partner details form (uses SaveButton + SectionCard)
SectionCard                 →    Admin dashboard (skeleton + polish)
Skeleton templates          →    All three pages have loading.tsx rebuilt
SelectValue fix pattern     →    Quick-launch modal UUID fix
```

---

## Track 1 — Infrastructure Primitives

### 1. `RouteTabs` — `src/components/route-tabs.tsx`

Replaces the three hand-rolled nav bars in:
- `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`
- `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`
- `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`

All three are already near-identical. This component makes it official and adds what they currently lack.

**API:**
```tsx
<RouteTabs
  tabs={[{ label: string; segment: string; badge?: ReactNode }]}
  basePath={string}
  activeSegment={string}
/>
```

**Owns:**
- Active underline indicator (`h-0.5 bg-primary`)
- Hover state (subtle background tint, not just colour change)
- Keyboard navigation (arrow keys between tabs)
- Focus ring (visible, not aggressive)
- Horizontal overflow scroll on narrow viewports
- Badge/status adjacency in tab label

**Does not own:** page header, child content layout, max-width constraints (those stay in the shell).

---

### 2. `SaveButton` — `src/components/save-button.tsx`

Replaces ~25 hand-rolled save-state implementations. Current drift: `"Saving..."` vs `"Saving…"` (wrong character) vs `"Please wait..."` in confirm dialog.

**API:**
```tsx
<SaveButton
  state="idle" | "saving" | "saved" | "error"
  onClick={() => void}
  disabled?: boolean
  className?: string
/>
```

**Lifecycle:**
- `idle` → label: `"Save Changes"`, enabled
- `saving` → label: `"Saving..."` (three-dot ellipsis, always), disabled, spinner icon
- `saved` → label: `"Saved"`, disabled, checkmark icon, auto-resets to `idle` after 2000ms
- `error` → label: `"Save Changes"`, enabled (error shown inline, not in button)

**Separate fix — ConfirmDialog:** `src/components/ui/confirm-dialog.tsx:60` — replace hardcoded `"Please wait..."` with a `loadingLabel` prop defaulting to `"Please wait…"`. This is a Track 1 deliverable, not a `SaveButton` concern. Add to Phase 1 and Definition of Done.

---

### 3. `SectionCard` — `src/components/section-card.tsx`

Standardises edit section anatomy across all settings and detail pages.

**API:**
```tsx
<SectionCard
  title={string}
  description?: string
  action?: ReactNode        // header-right action (e.g. toggle, badge)
  footer?: ReactNode        // section-scoped save action only
>
  {children}
</SectionCard>
```

**Rules:**
- Footer is only used when the save action belongs exclusively to that section (Zone 2 explicit save)
- Auto-save sections (Zone 3) never have a footer — they use `AutoSaveIndicator` in the section header
- Immediate-action sections (Zone 1) use `action` prop, not footer
- Multiple sections on one page = multiple `SectionCard` instances; one dominant edit zone = one `SectionCard` plus a separate Danger Zone card

---

### 4. Skeleton Templates — `src/components/loading/`

Four separate files, each exporting one named component. All use `animate-shimmer`, never `animate-pulse`.

| Component | File | Used by |
|---|---|---|
| `CardGridSkeleton` | `src/components/loading/card-grid-skeleton.tsx` | Dashboard, library list pages, AI settings |
| `DataTableSkeleton` | `src/components/loading/data-table-skeleton.tsx` | Client/partner list pages, users, participants |
| `DetailFormSkeleton` | `src/components/loading/detail-form-skeleton.tsx` | Detail shells (overview + settings tabs) |
| `DenseEditorSkeleton` | `src/components/loading/dense-editor-skeleton.tsx` | Brand editor, flow editor, block builder |

Each skeleton accepts a `className` prop for max-width constraints. They render the same structural grid as the real page — same column count, same card proportions, same header region.

**Quality bar:** `src/app/(dashboard)/dashboard/loading.tsx` — this is the model. Every other `loading.tsx` is rebuilt to this level of structural fidelity.

---

### 5. `SelectValue` Fix Pattern

**Root cause:** Radix UI `SelectValue` resolves its display text by looking up the matching `SelectItem` in the portal DOM. If the `SelectContent` hasn't mounted yet (async data, conditional render) when the component renders with a pre-set value, it falls back to the raw `value` string — which is a UUID.

**Fix:** Always pass `children` to `SelectValue` explicitly:
```tsx
// Before (broken)
<SelectValue placeholder="Select a client" />

// After (correct)
<SelectValue>
  {selectedItem?.name ?? <span className="text-muted-foreground">Select a client</span>}
</SelectValue>
```

**Scope:** All `SelectValue` instances in the app. Priority: quick-launch modal (`src/components/campaigns/quick-launch-modal.tsx:527`), then systematic audit of all other `Select` usages.

---

## Track 2 — Gold Standard Pages

These three pages are brought to full Apple standard in the admin portal. They become the living reference — nothing ships to partner or client portals until it matches these.

### 1. Admin Dashboard — `src/app/(dashboard)/dashboard/page.tsx`

**Current state:** Already the strongest page. TiltCard + ScrollReveal + AnimatedNumber + icon glow all present.

**Work:**
- Rebuild `loading.tsx` to match current page structure exactly (it's good but slightly outdated)
- Tighten typography: verify eyebrow/title/description follow the hierarchy rules
- Dark mode audit: shadow-driven light, border-driven dark, no raw colours
- Motion audit: confirm ScrollReveal stagger feels Apple-paced (not showy)

### 2. Client Detail Shell + Overview — `src/app/(dashboard)/clients/[slug]/`

**Current state:** Hand-rolled tab nav, blob loading skeleton, overview content is functional but not polished.

**Work:**
- Replace hand-rolled nav with `RouteTabs`
- Rebuild `clients/[slug]/overview/loading.tsx` using `DetailFormSkeleton` as base, customised to match the actual overview layout
- Apply `SectionCard` to the overview content sections
- Verify `PageHeader` eyebrow, title, badge placement matches the gold standard
- Once done: `partner-detail-shell.tsx` and `campaign-detail-shell.tsx` are near-direct copies

### 3. Partner Details Form — `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`

**Current state:** Best edit form in the app. Mixed explicit/autosave model. Three-zone section structure (details, notes, danger zone).

**Work:**
- Migrate to `SectionCard` for each zone
- Wire `SaveButton` component in place of inline save-state logic
- Verify `AutoSaveIndicator` placement for Zone 3 fields
- Verify `useUnsavedChanges` navigate-away dialog is wired
- Typography audit: field labels, descriptions, help text all consistent

---

## Rollout Order

### Phase 1 — Admin portal (review gate before Phase 2)

1. Build Track 1 infrastructure (RouteTabs, SaveButton, SectionCard, skeleton templates, SelectValue fix, ConfirmDialog `loadingLabel` prop)
2. Bring three gold standard pages to Apple bar
3. Jason reviews — sign-off required before Phase 2
4. Migrate remaining admin surfaces:
   - Partner and campaign detail shells (adopt RouteTabs — near-zero effort given shared code)
   - All settings and edit forms → SectionCard + SaveButton
   - All `loading.tsx` files → rebuilt from skeleton templates
   - SelectValue audit across all Select usages
   - Library list pages → verify TiltCard + ScrollReveal + icon glow

### Phase 2 — Partner portal

Direct inherit via portal context. Primary delta: any shell or form not already shared with admin. Same standards, same components.

### Phase 3 — Client portal

Lightest surface. Inherits everything from Phase 1 and 2.

---

## Definition of Done

A surface is complete when it passes all of the following:

- [ ] No raw UUIDs, slugs, or internal codes visible in any rendered state
- [ ] All save buttons use `SaveButton` component — no inline state strings
- [ ] All edit sections use `SectionCard` — no ad-hoc card+form compositions
- [ ] All tabbed navigation uses `RouteTabs` (URL-backed) or the shared `Tabs` primitive (in-page)
- [ ] `loading.tsx` is structural — matches the real page layout, uses `animate-shimmer`, built from skeleton templates
- [ ] Motion is within the Apple bar: 150–250ms, ease-out, no gratuitous animation
- [ ] Typography hierarchy is correct: eyebrow → title → description → section label → body → caption
- [ ] Dark mode verified: shadows in light, borders in dark, no raw colour values
- [ ] `ConfirmDialog` uses `loadingLabel` prop — no hardcoded `"Please wait..."` strings anywhere
- [ ] Would this look out of place on apple.com or in an Apple product? If yes, it goes back.

---

## Key Reference Files

| Role | File |
|---|---|
| Gold standard dashboard | `src/app/(dashboard)/dashboard/page.tsx` |
| Gold standard loading skeleton | `src/app/(dashboard)/dashboard/loading.tsx` |
| Gold standard edit form | `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx` |
| Gold standard AI settings skeleton | `src/app/(dashboard)/settings/ai/loading.tsx` |
| Hand-rolled tab bar (to replace) | `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx` |
| SelectValue UUID bug | `src/components/campaigns/quick-launch-modal.tsx:527` |
| Save text drift sites | `src/app/(dashboard)/campaigns/[id]/settings/report-config-panel.tsx:202`, `src/app/(dashboard)/clients/[slug]/settings/client-integrations-panel.tsx:351` |
| Confirm dialog fix | `src/components/ui/confirm-dialog.tsx:60` |
