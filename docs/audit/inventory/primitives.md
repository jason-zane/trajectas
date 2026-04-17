# Component primitives inventory

Generated: 2026-04-18
Source: `src/components/ui/` (30 files) + `src/components/*.tsx` top-level reusables (38 files)

All usage counts from direct Grep on `src/` of the form `@/components/ui/<name>` (import-path matches). Self-matches inside the primitive file itself are excluded.

## Summary

- **30 UI primitives** in `src/components/ui/`
- **6 use `cva`** for variant systems (button, badge, alert, tabs, input-group, sidebar) — the rest use ad-hoc typed props or no variants
- **38 top-level reusables** in `src/components/` (domain components that compose primitives)
- **1 dead primitive**: `scroll-area.tsx` — defined but has **0 consumers** in the codebase
- **ActionDialog family** (`src/components/action-dialog/`) is now the standard modal primitive (23 consumer files)

## UI primitives — full list with variants and usage

Usage = number of consumer files (not total callsites).

| # | Primitive | File | Variants | Sizes | Usage |
|---|-----------|------|----------|------:|------:|
| 1 | Button | `ui/button.tsx` | default, outline, secondary, ghost, destructive, link | default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg | **140** |
| 2 | Badge | `ui/badge.tsx` | default, secondary, destructive, outline, ghost, link, dimension, competency, trait, item, dot | — | **87** |
| 3 | Card | `ui/card.tsx` | default, glass, interactive *(ad-hoc prop — not cva)* | default, sm | **77** |
| 4 | Input | `ui/input.tsx` | *(ad-hoc sizing via parent container)* | — | **59** |
| 5 | Label | `ui/label.tsx` | — | — | **54** |
| 6 | Tooltip | `ui/tooltip.tsx` | — | — | **40** |
| 7 | Switch | `ui/switch.tsx` | — | — | **34** |
| 8 | Select | `ui/select.tsx` | — | — | **32** |
| 9 | DropdownMenu | `ui/dropdown-menu.tsx` | — | — | **20** |
| 10 | Textarea | `ui/textarea.tsx` | — | — | **20** |
| 11 | Skeleton | `ui/skeleton.tsx` | — | — | **16** |
| 12 | Checkbox | `ui/checkbox.tsx` | — | — | **14** |
| 13 | Table | `ui/table.tsx` | — | — | **13** |
| 14 | Tabs | `ui/tabs.tsx` | default (cva-defined) | — | **10** |
| 15 | Separator | `ui/separator.tsx` | — | — | **8** |
| 16 | Avatar | `ui/avatar.tsx` | — | — | **8** |
| 17 | Popover | `ui/popover.tsx` | — | — | **7** |
| 18 | Accordion | `ui/accordion.tsx` | — | — | **7** |
| 19 | Progress | `ui/progress.tsx` | — | — | **7** |
| 20 | ConfirmDialog | `ui/confirm-dialog.tsx` | (internally renders via ActionDialog) | — | **7** |
| 21 | Command | `ui/command.tsx` (+CommandDialog) | — | — | **6** |
| 22 | Alert | `ui/alert.tsx` | default, destructive | — | **5** |
| 23 | Sidebar | `ui/sidebar.tsx` | (cva-defined internal variants) | — | **3** |
| 24 | Sheet | `ui/sheet.tsx` | — | top, right, bottom, left | **3** |
| 25 | Dialog | `ui/dialog.tsx` *(legacy)* | — | — | **2** (action-dialog + command) |
| 26 | Slider | `ui/slider.tsx` | — | — | **2** |
| 27 | RadioGroup | `ui/radio-group.tsx` | — | — | **1** |
| 28 | Sonner (Toaster) | `ui/sonner.tsx` | — | — | **1** (root layout) |
| 29 | InputGroup | `ui/input-group.tsx` | default (cva-defined) | xs, sm, md, lg | **1** (inside command.tsx) |
| 30 | ScrollArea | `ui/scroll-area.tsx` | — | — | **0** — dead primitive |

### ActionDialog family (newer primitives, outside `ui/`)

| Primitive | File | Variants / sizes | Usage |
|-----------|------|------------------|------:|
| ActionDialog | `components/action-dialog/action-dialog.tsx` | size: default, xl | 20 files (plus ConfirmDialog internals) |
| ActionWizard | `components/action-dialog/action-wizard.tsx` | — | 1 file (quick-launch-modal) |
| ActionChoice | `components/action-dialog/action-choice.tsx` | — | 1 file (launch-campaign-button) |

**Total ActionDialog-family consumers**: 23 files.

## Top-level reusable components (38 files in `src/components/`)

Grouped by concern:

### Layout & chrome (7)

| File | Purpose |
|------|---------|
| `workspace-shell.tsx` | Sidebar + header shell for all authenticated portals |
| `app-sidebar.tsx` | Shared primary navigation |
| `dashboard-header.tsx` | Portal top-bar (user menu, command palette, theme toggle) |
| `page-header.tsx` | Page title + eyebrow + actions pattern |
| `breadcrumbs.tsx` | Declarative breadcrumb renderer (rarely used in practice — see C1 finding) |
| `route-tabs.tsx` | Tab-based sub-navigation wrapper |
| `section-card.tsx` | Card wrapper with collapse + header slot |

### Loading / transitions / reveal (5)

| File | Purpose |
|------|---------|
| `page-loading.tsx` | Full-page loader |
| `page-transition.tsx` | Fade/slide between routes |
| `scroll-reveal.tsx` | IntersectionObserver-triggered fade-up animation |
| `tilt-card.tsx` | Mouse-tracking 3D tilt wrapper for card hover |
| `auto-save-indicator.tsx` | "Saving / Saved" pill for autosaving forms |

### Data display helpers (3)

| File | Purpose |
|------|---------|
| `animated-number.tsx` | Counter that animates to numeric value |
| `mini-bars.tsx` | Tiny inline bar sparklines |
| `psychometric-visuals.tsx` | Radar / bar charts for score displays |
| `local-time.tsx` | Client-side formatted timestamp |

### Inputs / editors (2)

| File | Purpose |
|------|---------|
| `rich-text-editor.tsx` | Tiptap-based rich-text surface |
| `save-button.tsx` | Submit button with loading + success state |

### Feature-level reusables (11)

| File | Purpose |
|------|---------|
| `command-palette.tsx` | Global `Cmd+K` palette |
| `lazy-command-palette.tsx` | Lazy-loaded wrapper around the palette |
| `invite-member-dialog.tsx` | Shared invite modal (client + partner portals) |
| `dimension-construct-linker.tsx` | Entity-picker modal |
| `support-launch-button.tsx` | Start audited support session modal |
| `support-session-banner.tsx` | Persistent "support active" banner |
| `library-bulk-import-button.tsx` | Library bulk-import flow |
| `library-bundle-import-button.tsx` | Library bundle-import flow |
| `library-card-select-button.tsx` | Library item select action |
| `library-inline-delete-button.tsx` | Inline delete action with confirm |
| `library-selection-toolbar.tsx` | Bulk-action toolbar for library selections |

### Workspace / portal composition (4)

| File | Purpose |
|------|---------|
| `workspace-context-switcher.tsx` | Switch active workspace (staff) |
| `workspace-portal-live.tsx` | Live workspace page (published config) |
| `workspace-portal-page.tsx` | Static workspace page rendering |
| `portal-context.tsx` | Portal-kind context provider (client / partner / admin) |

### Infra (3)

| File | Purpose |
|------|---------|
| `theme-provider.tsx` | next-themes wrapper |
| `theme-toggle.tsx` | Light / dark / system picker |
| `force-light-theme.tsx` | Layout wrapper that forces light mode |
| `enter-portal-button.tsx` | Link to switch into a portal with brand |
| `empty-state.tsx` | Shared empty-state card |

### Auth / session (subfolder `components/auth/`)

- `account-menu.tsx` — Avatar → profile / sign-out dropdown
- `session-expiry-warning.tsx` — Blocking idle-warning modal

## Variant / API observations

1. **Only 6 of 30 primitives use cva** — Button, Badge, Alert, Tabs, Sidebar, InputGroup. Others rely on:
   - **Ad-hoc typed props** (Card uses `variant?: "default" | "glass" | "interactive"` + `size?: "default" | "sm"` without cva)
   - **No variants** (Label, Tooltip, Popover, Switch, etc.)

2. **Card is an API outlier.** It handles `variant` through if-chains in the className, not cva. This works today but deviates from the pattern used in Button/Badge. Low-risk refactor candidate for consistency — not urgent.

3. **Badge has the richest semantic variant system** (11 variants including domain-specific ones: `dimension`, `competency`, `trait`, `item`, `dot`). This is the codebase's canonical "entity type" indicator — very consistent.

4. **Button has 8 sizes** (default, xs, sm, lg, + 4 icon variants). The icon sizes map 1:1 to text sizes, which is elegant.

5. **Alert is minimal** — only two variants (default, destructive). No `warning` or `info` variant. **Gap candidate** — many toast/banner surfaces hand-roll warning/info colours because Alert doesn't have them.

6. **Dialog is legacy.** Only `action-dialog.tsx` and `command.tsx` still import it directly. The migration is effectively complete (see `overlays.md`).

7. **ScrollArea is dead code.** Defined but no consumer. Either remove or integrate where vertical scroll regions exist (e.g., long popover content, sidebar content on short viewports).

8. **RadioGroup is barely used** (1 consumer — invite-dialog for scope selection). Most boolean/exclusive choices in the app use Switch or Select instead.

9. **Slider is barely used** (2 consumers — factor-form, generate/new/page). Niche.

10. **Sonner (Toaster)** is mounted once at root and fired via the `sonner` package's imperative `toast()` API across the app. Consistent.

## Usage distribution (insight)

- **Top 5 by consumer count**: Button (140), Badge (87), Card (77), Input (59), Label (54)
- **Mid-tier (15–50)**: Tooltip, Switch, Select, DropdownMenu, Textarea, Skeleton, Checkbox
- **Low-usage (<15)**: Table, Tabs, Separator, Avatar, Popover, Accordion, Progress, ConfirmDialog, Command, Alert
- **Rare (<5)**: Sidebar, Sheet, Dialog, Slider, RadioGroup, Sonner, InputGroup, ScrollArea

The distribution is heavily top-weighted — Button alone accounts for ~20% of primitive imports across the app. This is normal for a data-heavy admin surface.

## Taxonomy gaps

1. **No `Combobox` primitive.** `overlays.md` noted that ~5 Popover callsites are combobox patterns (tenant picker, entity search, model picker, add-block picker, block context). Consolidating these into a shared `Combobox` primitive would reduce duplication. **Recommendation**: Phase 2 finding — flag but don't block on it.

2. **No `Alert` variants for `warning` / `info` / `success`.** Many surfaces hand-roll these (e.g., quota warning banner on campaign participants, import-issues modal). **Recommendation**: Phase 2 — extend Alert with `warning` + `info` + `success` variants, migrate hand-rolled callsites.

3. **Inconsistent variant APIs.** Card uses ad-hoc prop typing; everything else with variants uses cva. **Recommendation**: Low-priority consistency cleanup — migrate Card to cva.

4. **Dead primitive (ScrollArea).** **Recommendation**: Either delete or adopt. Don't leave floating.

## Incomplete

None — all 30 `ui/` primitives and 38 top-level components were enumerated with real Grep-verified consumer counts.
