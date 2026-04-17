# Audit Framework

This document is **the knowledge a Phase 1 / Phase 2 agent needs**. Read fully before running any audit task.

---

## Part 1 — Surface taxonomy

Every interactive thing in the app maps to one of these types. If you find something that doesn't fit, note it and propose a new type rather than force-fitting.

### Page-level surfaces

| Type | Definition | Example |
|------|------------|---------|
| `public-landing` | Unauthenticated landing / marketing | (out of scope) |
| `auth` | Sign-in, sign-up, OTP, password reset | `/login` |
| `onboarding` | First-run setup flows | — |
| `dashboard` | Stat-card / widget summary of a domain | `/client/dashboard` |
| `listing` | Paginated list of entities (table or card grid) | `/client/campaigns`, `/library/dimensions` |
| `detail` | One entity in focus with metadata + actions | `/client/campaigns/[id]/overview` |
| `editor` | In-place or full-page editor for one entity | `/report-templates/[id]/builder` |
| `wizard` | Multi-step flow with distinct stages | (also see Overlay: `modal-wizard`) |
| `empty-state` | Page shown when a listing has zero entities | — |
| `error-page` | 404, 500, permission-denied pages | `/not-found` |
| `print-export` | Report PDF render routes, print layouts | `/client/reports/[id]/print` |
| `redirect` | Route that immediately redirects — not user-visible | `/client/campaigns/[id]` → `/overview` |
| `dynamic-router` | Catch-all route that delegates to workspace-config-driven children | `/client/[[...slug]]` |

**Evaluation notes for edge cases:**

- **`redirect`** surfaces are **skipped** in Phase 2 scoring — they're not user-visible.
- **`dynamic-router`** surfaces cascade evaluation to whichever child component renders. Score the child, not the router.
- **`error-page` stubs** (routes that always trigger `notFound()` because a feature isn't implemented) are tagged `error-page (stub)` and skipped in Phase 2.
- **Feature-gated routes** (one URL, two renditions based on capability) are captured twice in screenshots — once enabled, once disabled — and evaluated as two separate surfaces sharing a parent route.
- **Theme-override routes** (e.g. wrapped in `ForceLightTheme`) have A3 "Colour system" scored against *only* the rendered theme — the other theme is marked N/A.
- **View-mode toggles** (same route, different data shape based on URL param) are captured as separate states (`view-<mode>`) in the inventory's "States" column, and evaluated once per meaningfully-distinct view.

### Overlay surfaces

| Type | Definition | Example |
|------|------------|---------|
| `modal-action` | Single-step action dialog (ActionDialog) | "Invite participant" |
| `modal-wizard` | Multi-step wizard dialog (ActionWizard) | "Launch campaign" |
| `modal-confirm` | Destructive / risky confirmation | "Delete assessment?" |
| `drawer-sheet` | Side panel, slides in | `pipeline-explainer-sheet` |
| `command-palette` | `Cmd+K` / command search UI | `CommandDialog` |
| `popover` | Contextual pop-up (date picker, colour picker, etc.) | Colour picker |
| `tooltip` | Hover-only short help | — |
| `context-menu` | Right-click / ellipsis menu on a row | Table row actions |
| `dropdown-menu` | Button-triggered action list | Avatar menu |

### Within-page surfaces

| Type | Definition | Example |
|------|------------|---------|
| `form` | Collection of inputs + submit | Campaign settings form |
| `data-table` | Sortable/filterable/paginated rows | Participants table |
| `card-grid` | Entity cards in a grid (taxonomy entities) | Dimensions grid |
| `chart` | Data viz / graph | Band-scheme visualiser |
| `stepper` | Linear progress indicator | Quick-launch progress pills |
| `tabs` | Top-level view toggle within a page | Campaign detail tabs |
| `accordion` | Expandable row/section | Pipeline explainer |
| `search` | Query input with results | Library search |
| `filter-panel` | Multi-facet filter controls | — |
| `inline-editor` | Click-to-edit field | Renaming a campaign |

### Feedback surfaces

| Type | Definition |
|------|------------|
| `toast` | Non-blocking transient notification |
| `banner` | In-page alert strip (info / warning / error) |
| `badge-chip` | Small status / count indicator |
| `progress` | Linear / circular progress indicator |
| `skeleton` | Loading placeholder shimmer |

---

## Part 2 — Evaluation rubric

17 criteria, grouped into four categories. **Each criterion is scored 3 / 2 / 1**:

- **3 = pass**: meets the standard without reservations
- **2 = partial**: works but has a visible gap
- **1 = fail**: missing or wrong
- **N/A**: criterion doesn't apply to this surface type

Agents MUST justify every score in one sentence, even passes. Unscored criteria produce no finding.

### A. Visual foundations

**A1 — Typography hierarchy**
- Pass: clear title → section → body → meta progression using `.text-title`, `.text-section`, `.text-caption`, etc. One visible font family for display + one for body.
- Partial: hierarchy works but uses ad-hoc sizes (`text-lg`, `text-xl`) instead of semantic classes.
- Fail: flat visual hierarchy, no clear entry point for the eye, or raw font-size utilities without a system.
- **Reference**: `PageHeader` component, `docs/ui-standards.md § Typography`.

**A2 — Spacing rhythm**
- Pass: consistent vertical rhythm (`space-y-4`, `space-y-6`, `space-y-10` for section breaks). Padding inside cards/containers uses design tokens.
- Partial: ad-hoc spacing values (`mt-3`, `gap-5`) but overall rhythm is OK.
- Fail: cramped or wildly inconsistent spacing; content touching container edges.
- **Reference**: Tailwind spacing scale; client dashboard uses `space-y-10` between sections.

**A3 — Colour system adherence**
- Pass: only CSS variables (`var(--primary)`, `var(--muted)`) or Tailwind semantic utilities (`bg-primary`, `text-muted-foreground`). Dark mode looks intentional, not accidental.
- Partial: mostly tokens with a few hardcoded colours.
- Fail: raw hex/oklch values, or dark mode broken.
- **Reference**: `docs/ui-standards.md § Colour Usage`.

**A4 — Responsive behaviour**
- Pass: works at 375px (mobile), 768px (tablet), 1280px (desktop). Uses responsive Tailwind prefixes (`sm:`, `md:`, `lg:`).
- Partial: works at desktop + one other, but one breakpoint is awkward.
- Fail: horizontal scroll, overlapping content, or unusable at any common breakpoint.
- **N/A**: for admin-only surfaces where mobile is not expected (rare — still flag).

**A5 — Information density**
- Pass: density matches the task. Dashboards summarise, editors show detail. No huge empty gutters or overstuffed rows.
- Partial: a section feels too sparse or too cramped relative to its siblings.
- Fail: blank expanses (like the old "What do you need?" card) or suffocating density.

### B. Interaction & feedback

**B1 — Loading state**
- Pass: uses `animate-shimmer` skeleton matching the target layout, renders immediately, doesn't flash spinners.
- Partial: uses generic `animate-pulse` or a spinner in a void.
- Fail: nothing — blank page until data arrives, or jank on hydration.
- **Reference**: every route should have `loading.tsx`.

**B2 — Empty state**
- Pass: helpful copy (explains *why* it's empty), plus primary action ("Create X"), plus illustration/icon.
- Partial: has copy but no next action, or action but no copy.
- Fail: "No data" or blank table.

**B3 — Error state**
- Pass: inline where possible (red text on the offending field), toast for transient server errors, full-page error boundary for route-level failures. Retry / go-back action visible.
- Partial: error shown but no recovery path.
- Fail: error swallowed silently or only in console.

**B4 — Success feedback**
- Pass: toast confirmation on Zone-1 mutations, inline "Saved" indicator on Zone-3, navigation transition on Zone-2. Never both + never nothing.
- Partial: inconsistent — some actions confirm, others don't.
- Fail: mutation happens silently with no confirmation.
- **Reference**: `docs/ui-standards.md § Save & Persistence Principles`.

**B5 — Perceived performance**
- Pass: optimistic updates on toggles, skeletons for lists, instant feedback on click (button disables immediately).
- Partial: some optimism but laggy in places.
- Fail: every action waits on the server round-trip before any UI change.

### C. Navigation & context

**C1 — Page header**
- Pass: `PageHeader` component with eyebrow (context), title, description.
- Partial: has title but no eyebrow/description, or custom header that doesn't match.
- Fail: no header, title buried in content.

**C2 — Where am I**
- Pass: breadcrumbs OR clear page title + eyebrow tell the user their location.
- Partial: title is clear but hierarchy / parent is not.
- Fail: user could land here and not know what section they're in.

**C3 — Where can I go**
- Pass: primary actions visible without scrolling. Navigation to related views (e.g. "View all campaigns") is one click away.
- Partial: primary action visible but secondary navigation buried.
- Fail: user has to hunt for the expected next action.

**C4 — Back-stack / return path**
- Pass: browser back works correctly. After mutation, user returns to the right place (not dumped on an unrelated page).
- Partial: back mostly works but some edge case is wrong.
- Fail: back goes to a broken page, or redirect loop.

### D. Quality

**D1 — Keyboard navigation**
- Pass: every interactive element reachable via Tab. Focus ring always visible. Escape closes overlays. Enter submits forms. Arrow keys navigate lists / menus where expected.
- Partial: most things work but one or two elements are unreachable.
- Fail: mouse-only interactions, focus traps, missing focus rings.

**D2 — Screen reader / ARIA**
- Pass: semantic HTML (`<button>`, `<nav>`, `<main>`). `aria-label` on icon-only controls. Live regions for async updates. No `div onClick=` where a button should be.
- Partial: semantic in most places, a few icon buttons missing labels.
- Fail: div/span masquerading as interactive elements; no labels on form controls.

**D3 — Contrast + reduced motion**
- Pass: text contrast ≥ 4.5:1 in both themes. `prefers-reduced-motion` respected (animations disabled or simplified).
- Partial: contrast OK but motion plays regardless of preference.
- Fail: low-contrast text in dark mode, or motion that induces nausea for vestibular-sensitive users.

---

## Part 3 — Surface inventory format

Each portal inventory is a single markdown file at `docs/audit/inventory/<portal>.md` with this structure:

```markdown
# <Portal> portal inventory

Generated: YYYY-MM-DD
Source: src/app/<portal>/

## Summary
- N pages
- M overlays
- Primary navigation surfaces: …

## Pages

| # | Path | File | Surface type | Interactive elements | States to capture |
|---|------|------|--------------|----------------------|-------------------|
| 1 | `/client/dashboard` | `src/app/client/dashboard/page.tsx` | `dashboard` | stat cards (×4), "What do you need?" action card, active-campaigns grid, recent-results list | loaded, empty, loading, error |
| 2 | `/client/campaigns` | `src/app/client/campaigns/page.tsx` | `listing` | data-table, "Launch campaign" button, filters | loaded, empty, loading |
| … |

## Overlays triggered from this portal

| # | Trigger location | Component | Overlay type | Purpose |
|---|------------------|-----------|--------------|---------|
| 1 | Any page with campaign list | `LaunchCampaignButton` | `modal-action` → `modal-wizard` | Launch a campaign |
| … |

## Interactive primitives used

(Just a count — detailed audit of primitives happens at the component level.)

| Primitive | Usage count | Surfaces |
|-----------|-------------|----------|
| `Button variant="default"` | 47 | — |
| `Select` | 18 | — |
| … |
```

---

## Part 4 — Finding format

Each surface's evaluation is a single markdown file at `docs/audit/findings/<portal>-<surface-slug>.md`:

```markdown
# Finding: <Surface name>

Path: `/client/dashboard`
Surface type: `dashboard`
Audited: YYYY-MM-DD
Screenshots: `docs/audit/screenshots/client/dashboard/`

## Scores

| Criterion | Score | Note |
|-----------|:-----:|------|
| A1 Typography hierarchy | 3 | Uses PageHeader, text-title, text-caption correctly. |
| A2 Spacing rhythm | 3 | `space-y-10` between sections, consistent. |
| A3 Colour system | 3 | All CSS variables, dark mode tested. |
| A4 Responsive | 2 | Stat cards stack nicely at mobile, but "What do you need?" card columns don't collapse cleanly below `md`. |
| A5 Information density | 3 | — |
| B1 Loading state | 2 | `loading.tsx` exists but uses `animate-pulse` not shimmer. |
| B2 Empty state | 3 | "No campaigns yet. Launch your first campaign…" with CTA. |
| B3 Error state | 1 | No error boundary on the dashboard; server errors bubble to a white screen. |
| B4 Success feedback | 3 | — |
| B5 Perceived performance | 3 | Favorite toggle optimistic. |
| C1 Page header | 3 | — |
| C2 Where am I | 3 | Eyebrow "Dashboard" + title present. |
| C3 Where can I go | 3 | Primary actions grouped in action card. |
| C4 Back-stack | N/A | Top-level dashboard. |
| D1 Keyboard | 2 | Stat cards are Links now ✓, but favorite button has no visible focus ring. |
| D2 ARIA | 2 | Favorite button missing `aria-label` (icon-only). |
| D3 Contrast + motion | 3 | — |

## Findings

### F-001 — No error boundary on dashboard
- **Severity**: major
- **Category**: B3
- **Scope**: pattern (likely affects every route)
- **Detail**: dashboard/page.tsx has no `error.tsx` sibling. Uncaught errors surface as default Next.js error UI, not our branded error state.
- **Suggested fix**: add `error.tsx` per portal root; create shared `ErrorBoundary` component.

### F-002 — Favorite button icon-only, no aria-label
- **Severity**: major
- **Category**: D2
- **Scope**: component-level (affects everywhere `FavoriteCampaignButton` appears)
- **Detail**: screen readers announce "button" with no context.
- **Suggested fix**: add `aria-label={isFavorite ? "Unfavorite" : "Favorite"}` to component.

…
```

---

## Part 5 — Pattern format

After Phase 2, we cluster recurring findings. A pattern lives in `docs/audit/patterns.md`:

```markdown
## P-001 — Icon-only buttons missing aria-labels

**Source findings**: F-002, F-014, F-028, F-051 (appears in 12 surfaces)
**Category**: D2
**Severity**: major (accessibility regression class)

### The pattern
Many icon-only buttons (`<Button size="icon">`) across campaign, participant, and library surfaces have no `aria-label`, making them silent for screen readers.

### Root cause
No lint rule or code-review checklist enforces aria-label on icon-only buttons.

### Proposed standard
Every icon-only Button MUST have `aria-label` describing its action. Add this to `docs/ui-standards.md` and add an ESLint rule to enforce it at lint time.

### Reference implementation
`src/components/ui/button.tsx` — add a dev-time runtime warning if `size="icon"` and `aria-label` is missing.

### Sweep target
Sweep "Accessibility pass 1": audit every icon Button callsite, add labels. Estimate: ~40 callsites.
```

---

## Part 6 — Severity scale

Used in findings and patterns:

- **Blocker** — breaks a core workflow, excludes users, or ships broken experience to customers.
- **Major** — visible friction, causes confusion, or breaks a standard in a pattern way (affects multiple surfaces).
- **Polish** — an isolated rough edge. Worth fixing but not critical.

A single-surface "major" severity can be downgraded to "polish" if the pattern cluster reveals it's an outlier rather than systemic.

---

## Part 7 — Out of scope for the rubric

These are important but handled elsewhere:

- **Copy tone / voice consistency** — separate copy audit
- **Analytics / event tracking** — separate instrumentation audit
- **Performance (actual, not perceived)** — separate perf audit
- **SEO / metadata** — not relevant to authenticated app

Flag any of these issues you find incidentally, but don't score against them.
