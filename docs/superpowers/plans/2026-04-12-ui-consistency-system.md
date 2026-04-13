# UI Consistency System Plan

> **For agentic workers:** Use checkbox tracking. This plan is for implementation work, not just audit readout.

**Goal:** Bring the app to a world-class, system-level standard for UI/UX consistency across route shells, section composition, edit flows, loading states, and interaction feedback without flattening meaningful differences between surfaces.

**Core conclusion:** The primitive layer is already strong. The inconsistency is mostly at the composition layer. This is not a "buttons and colors" problem anymore. It is a "same interaction role, same treatment" problem.

**Architecture:** Keep the existing shared primitives in `src/components/ui/` as the foundation. Add a thin composition layer for route tabs, save actions, section cards, and loading shells. Then migrate high-traffic surfaces onto that layer.

**Next.js note:** The local Next.js docs in `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` recommend `loading.tsx` on dynamic routes to enable partial prefetching, immediate navigation, and loading UI during render. This matters to the consistency plan because the app currently has route-level loading gaps.

**Baseline counts from current tree:**
- `158` `page.tsx` routes
- `94` `loading.tsx` files
- `64` route pages without a local loading state
- `3` hand-rolled route-shell tab implementations
- `12` `Tabs` primitive usage sites
- `20` local save-state implementations
- `14` `useUnsavedChanges` sites
- `9` `useAutoSave` sites
- `40` `ConfirmDialog` usage sites

**Key reference files (read before implementation):**
- Primitive foundation: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/tabs.tsx`
- Page framing: `src/components/page-header.tsx`
- Gold-standard card/list surfaces: `src/app/(dashboard)/dashboard/page.tsx`, `src/app/partner/dashboard/page.tsx`, `src/app/(dashboard)/factors/factor-list.tsx`, `src/app/partner/clients/page.tsx`
- Best dense settings editor: `src/app/(dashboard)/settings/brand/brand-editor.tsx`
- Best mixed save-zone form: `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`
- Route-shell drift: `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`, `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`, `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`
- Dense editor drift: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`, `src/components/flow-editor/flow-editor.tsx`
- Complex detail drift: `src/app/(dashboard)/users/[id]/user-detail-client.tsx`, `src/app/(dashboard)/clients/[slug]/settings/client-integrations-panel.tsx`
- Good in-page data tabs: `src/components/results/participant-detail-view.tsx`, `src/components/results/session-detail-view.tsx`

---

## Audit Summary

### 1. The primitive layer is already consistent

`Button`, `Input`, `Select`, and `Tabs` are already system-quality primitives:
- `button.tsx` has coherent variants and sizing
- `input.tsx` has a stable surface language
- `select.tsx` handles scroll-lock and popup behavior centrally
- `tabs.tsx` already supports both pill tabs and `variant="line"`

This is a strength. The plan should preserve it and stop page-level code from bypassing it.

### 2. Top-level navigation is not standardized

There are three route-detail shells still drawing their own underline tabs:
- `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`
- `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`
- `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`

These all render the same interaction role:
- URL-backed page-section navigation
- active-state underline
- badge/status context in the page header

But they are implemented manually instead of through a shared abstraction. That means spacing, overflow behavior, focus treatment, responsive collapse, and badge adjacency are not actually system-owned.

### 3. The app has three tab roles, but only two are formalized

The current app effectively uses three different tab semantics:

1. **Route tabs**  
URL-backed navigation between child pages.  
Examples: client, partner, campaign detail shells.

2. **Editor tabs**  
Within-page editing sections where users work through structured configuration.  
Examples: dimension, factor, construct, item, response-format forms; brand editor.

3. **View tabs**  
In-page peer views of the same record or dataset.  
Examples: participant detail, session detail, assessments page.

Only editor tabs and view tabs currently use the shared `Tabs` primitive. Route tabs are still custom.

### 4. Save semantics are conceptually good, but not systematized

The app already uses a sensible save model:
- **Zone 1:** immediate actions/toggles
- **Zone 2:** grouped explicit save
- **Zone 3:** local autosave with inline status

Good examples:
- `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`
- `src/app/(dashboard)/settings/brand/brand-editor.tsx`
- `src/app/(dashboard)/factors/factor-form.tsx`

But the behavior is replicated locally across roughly `20` save-state implementations. The semantics are shared; the code and placement rules are not.

Visible drift today:
- `"Saving..."` vs `"Saving…"` vs `"Please wait..."`
- save button labels vary by author rather than by system
- some forms place the save action in the card footer, others in the page header, others in ad hoc action rows
- some autosaved fields surface `AutoSaveIndicator` in the section header, others inline near the field, others not at all

### 5. Section composition is the biggest UX drift

This is the main issue the earlier audit underweighted.

Patterns currently in play:
- read-only dashboard cards
- single-card edit forms
- multi-card settings pages
- table-inside-card layouts
- bare tables without card framing
- split-pane editors with preview

The best surfaces have clear section anatomy:
- section title
- short description
- primary action placement
- content density that matches the task
- predictable save semantics

The weaker surfaces mix these arbitrarily.

Examples:
- `partner-details-form.tsx` uses a clean three-zone model with separate Notes and Danger Zone cards
- `client-details-form.tsx` is simpler, but lacks the richer section zoning and feels more utilitarian
- `user-detail-client.tsx` packs platform role, partner memberships, client memberships, add-membership controls, and activation state into one broad detail surface with mixed table and form density
- `client-integrations-panel.tsx` has strong interaction depth, but it is effectively a custom product surface with its own micro-language for cards, dialogs, alerts, and action placement

### 6. Dense editors are not using the same scaffold

The app has at least three heavy editing environments:
- brand editor
- flow editor
- report-template block builder

They solve similar problems:
- top action bar
- dirty-state handling
- optional preview surface
- sectioned editing
- save/reset patterns

But each uses a different scaffold:
- `brand-editor.tsx` uses line tabs plus top-right save/reset
- `flow-editor.tsx` uses a three-panel workspace with a custom top bar and raw `<select>` for preview persona
- `block-builder-client.tsx` uses a split editor plus custom internal tab buttons inside expanded blocks

The result is a "different product inside the same app" feeling.

### 7. Loading and empty states are materially inconsistent

There are `64` route pages without local `loading.tsx`.

This is not cosmetic. It creates real inconsistency in transition behavior:
- some routes feel instant and polished
- others feel blank or stalled

The missing pieces matter most on:
- dynamic detail routes
- settings pages
- nested campaign/client/partner routes

The app already has enough loading patterns to standardize:
- `DataTableLoading`
- card-grid skeletons
- detail-page shimmers
- editor-page skeletons

They are just not fully applied.

### 8. Highest bar is a composite, not a single page

No single surface is the full standard. The best bar is a combination:

- **Card/list polish:** `dashboard/page.tsx`, `partner/dashboard/page.tsx`, `factors/factor-list.tsx`, `partner/clients/page.tsx`
- **Dense tabbed editor:** `settings/brand/brand-editor.tsx`
- **Mixed explicit/autosave form:** `partners/[slug]/details/partner-details-form.tsx`
- **In-page data-view tabs:** `results/participant-detail-view.tsx`, `results/session-detail-view.tsx`
- **Primitive correctness:** `src/components/ui/*`

The plan should converge surfaces toward this composite bar instead of copying one page everywhere.

---

## Consistency Model

### Standard 1: Navigation Ladder

Every tabbed interaction must belong to one of these roles:

- **RouteTabs**  
For URL-backed page navigation inside a detail shell.  
Visual treatment: underline/line tabs.  
State source: pathname.

- **EditorTabs**  
For structured editing sections within a page.  
Visual treatment: `TabsList variant="line"`.  
State source: local tab state.

- **ViewTabs**  
For peer content views within a page.  
Visual treatment: default pill tabs unless density demands line tabs.  
State source: local tab state.

Rule: no page should hand-roll a fourth tab style.

### Standard 2: Save Ladder

Every mutation must fit one of these models:

- **Immediate**  
Single, low-ambiguity toggle or action.  
Feedback: toast, optimistic UI if safe.

- **Explicit Save**  
Grouped structural edits.  
Feedback: shared save button states, dirty detection, navigate-away confirmation.

- **Auto Save**  
Local field edits that are safe to persist independently.  
Feedback: `AutoSaveIndicator` in the section header or field header.

Rule: every edit page must declare its save model in code through shared helpers, not inline string logic.

### Standard 3: Section Anatomy

Every substantial page section should use the same anatomy:
- title
- optional description
- optional header action
- body content with consistent vertical rhythm
- optional footer action only when the action belongs to that section alone

Rule: if a page has multiple edit zones, use section cards; if a page has one dominant edit zone, use one primary card plus a separate danger zone.

### Standard 4: Editor Scaffold

Heavy editors should share these decisions:
- stable top action bar
- save/reset placement on the right
- predictable preview behavior
- standard editor tab treatment
- standard empty state when no blocks/pages are present

Rule: heavy editors may differ in layout, but not in save language, preview language, or section mechanics.

### Standard 5: Loading/Empty/Confirm States

- every route has a loading state unless it intentionally inherits from a route-group loading boundary
- every collection page uses either `EmptyState` or a shared section-empty variant
- destructive actions always use `ConfirmDialog`
- confirm loading language is centralized and consistent

---

## Implementation Plan

## Task 1: Create the composition layer

**Files:**
- Create: `src/components/route-tabs.tsx`
- Create: `src/components/save-button.tsx`
- Create: `src/components/section-card.tsx`
- Create: `src/components/loading/page-skeletons.tsx`
- Modify: `src/components/ui/confirm-dialog.tsx`

- [ ] Build `RouteTabs` for URL-backed shell navigation.
- [ ] `RouteTabs` should own active styles, hover styles, keyboard focus, badge support, and horizontal overflow behavior.
- [ ] Build `SaveButton` with a shared label/state model:
  - idle label
  - saving label
  - saved label
  - optional leading icon
- [ ] Build `SectionCard` to standardize section title, description, header action, body, and optional footer.
- [ ] Build page-level skeleton helpers for:
  - card grid
  - DataTable page
  - detail form page
  - heavy editor page
- [ ] Update `ConfirmDialog` so its loading language is system-owned and no longer defaults to `"Please wait..."`.

**Acceptance criteria:**
- no new page should need to hand-roll route tabs
- no new page should need to inline save-state button text
- loading shells can be assembled from shared pieces rather than bespoke shimmer markup

---

## Task 2: Standardize route shells

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`
- Modify: `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`

- [ ] Replace the three hand-rolled nav bars with `RouteTabs`.
- [ ] Preserve existing badge/status behavior in the page header.
- [ ] Ensure mobile overflow is handled consistently.
- [ ] Keep URL structure unchanged.

**Acceptance criteria:**
- all three detail shells use the same route-tab component
- active underline, spacing, and focus treatment match exactly
- shell width logic is intentional and documented (`max-w-6xl` vs `max-w-5xl`)

---

## Task 3: Standardize detail and settings section anatomy

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/details/client-details-form.tsx`
- Modify: `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`
- Modify: `src/app/(dashboard)/users/[id]/user-detail-client.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/settings/client-integrations-panel.tsx`

- [ ] Refactor detail forms onto `SectionCard`.
- [ ] Keep the save ladder explicit:
  - partner details stays mixed explicit/autosave
  - client details should either stay simpler by intent or gain the same zone language deliberately
- [ ] Break overloaded settings/detail pages into clearer sections where needed.
- [ ] Standardize header action placement and footer action placement.
- [ ] Use the shared `SaveButton` where grouped explicit save exists.

**Acceptance criteria:**
- client details and partner details feel like members of the same family
- user detail no longer feels like several unrelated tools stitched into one page
- integrations panel keeps its depth but adopts the same section and action grammar as the rest of the app

---

## Task 4: Standardize dense editor scaffolds

**Files:**
- Modify: `src/app/(dashboard)/settings/brand/brand-editor.tsx`
- Modify: `src/components/flow-editor/flow-editor.tsx`
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`
- Modify as needed: supporting subpanels in these directories

- [ ] Define a shared editor scaffold contract:
  - top bar
  - action cluster
  - preview behavior
  - empty state
  - internal tab treatment
- [ ] Keep `brand-editor.tsx` as the reference scaffold for explicit-save dense editors.
- [ ] Move `flow-editor.tsx` off raw HTML `<select>` in the preview controls and onto shared form primitives.
- [ ] Replace the custom internal block-tab strip in `block-builder-client.tsx` with the tabs system unless there is a proven reason not to.
- [ ] Standardize save/reset wording and preview wording across all heavy editors.

**Acceptance criteria:**
- dense editors feel like variants of one product, not three separate tools
- no heavy editor uses custom tab chrome when the app already has the right tab role
- top action bars follow the same rules

---

## Task 5: Standardize save semantics app-wide

**Files:**
- Modify all explicit-save forms currently managing local save labels
- Prioritize:
  - `src/app/(dashboard)/clients/[slug]/details/client-details-form.tsx`
  - `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`
  - `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx`
  - `src/app/(dashboard)/partners/[slug]/branding/partner-brand-editor.tsx`
  - `src/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor.tsx`
  - `src/app/(dashboard)/settings/brand/brand-editor.tsx`
  - `src/app/(dashboard)/settings/email-templates/[type]/email-template-editor.tsx`
  - `src/components/flow-editor/flow-editor.tsx`
  - `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`

- [ ] Replace local save button text logic with `SaveButton`.
- [ ] Normalize ellipsis and saved-state wording.
- [ ] Normalize disabled behavior after save.
- [ ] Normalize icon usage in saving/saved states.

**Acceptance criteria:**
- save state wording is consistent across the app
- save buttons communicate the same lifecycle everywhere
- `ConfirmDialog` loading language no longer drifts from the rest of the system

---

## Task 6: Close loading-state coverage gaps

**Files:**
- Add `loading.tsx` to missing route segments, prioritizing dynamic and high-traffic routes

- [ ] Create skeleton templates using `page-skeletons.tsx`.
- [ ] Audit all dynamic routes first.
- [ ] Add `loading.tsx` to all missing high-traffic settings/detail pages.
- [ ] Finish the remainder of missing route files or intentionally document inherited coverage via route groups.

**Priority targets:**
- nested client/partner/campaign detail routes
- settings pages
- remaining library and editor routes

**Acceptance criteria:**
- dynamic routes no longer blank-transition
- every route either has a local loading state or a documented inherited loading boundary

---

## Task 7: Final polish pass on card/list pages

**Files:**
- Library list pages
- Remaining partner/client/admin list/detail pages

- [ ] Apply the established card-grid polish where missing:
  - `TiltCard`
  - `ScrollReveal`
  - icon glow where appropriate
- [ ] Standardize empty states to `EmptyState` or a shared action variant.
- [ ] Ensure table pages use the same list-page framing and density.

**Acceptance criteria:**
- card-grid pages feel first-class across the entire app
- list pages and detail pages belong to the same visual system

---

## Rollout Order

1. Composition layer primitives
2. Route shells
3. Save semantics
4. Detail/settings section anatomy
5. Dense editor scaffolds
6. Loading-state coverage
7. Card/list polish

This order matters. If route tabs, save buttons, section cards, and loading skeletons are not system-owned first, the later migration work will just reintroduce drift.

---

## Definition of Done

- [ ] No hand-rolled route-shell tab bars remain
- [ ] Every tabbed interaction maps to RouteTabs, EditorTabs, or ViewTabs
- [ ] No explicit-save page inlines its own save-state string logic
- [ ] Section anatomy is consistent across detail and settings pages
- [ ] Dense editors share the same action/save/preview grammar
- [ ] All routes have loading coverage or documented inherited boundaries
- [ ] Empty states and confirm flows use shared patterns
- [ ] The app feels like one product, not a set of individually polished screens
