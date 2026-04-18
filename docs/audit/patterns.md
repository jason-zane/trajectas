# Phase 2 — Patterns

Generated: 2026-04-18
Method: pattern-based scan. Quantified cross-cutting issues from targeted Grep across `src/` rather than per-surface scoring. All counts verified.

## Summary table

| # | Pattern | Severity | Category | Scope | Files affected |
|---|---------|----------|----------|-------|---------------:|
| P-001 | Missing error boundaries in client/partner/participant portals | **critical** | B3 | 3 portals | 55 pages |
| P-002 | `PageHeader` component used on only 27% of pages | **major** | C1 | app-wide | ~111 pages |
| P-003 | No breadcrumbs anywhere except the `dashboard-header` avatar dropdown | **major** | C2, C4 | app-wide | ~150 pages |
| P-004 | Animations don't respect `prefers-reduced-motion` | **major** | D3 | app-wide | ~50 surfaces with motion |
| P-005 | Hand-rolled warning / info banners (no Alert variants for warning/info/success) | minor | A3/consistency | library, participants, integrations | ~12 surfaces |
| P-006 | Dead primitive (`ScrollArea`) — defined, 0 consumers | minor | consistency | primitives | 1 file |
| P-007 | Only 1 `ActionWizard` consumer despite 3 natural candidates | minor | consistency | library, users | 3 flows |
| P-008 | Participant flow: no step indicator on consent/demographics/intro pages | **major** | C2 | participant portal | 4 pages |
| P-009 | Participant flow: redirect-heavy with no perceived-performance scaffolding | **major** | B5 | participant portal | ~8 pages |
| P-010 | 2 stub pages in client portal (always `notFound()`) | minor | cleanup | client portal | 2 files |
| P-011 | Card primitive uses ad-hoc variant typing instead of cva | minor | consistency | primitive | 1 file |
| P-012 | No `Combobox` primitive — 5 hand-rolled combobox patterns in Popover | minor | consistency | primitives | 5 callsites |

## Pattern detail

### P-001 — Missing error boundaries in client / partner / participant portals

- **Severity**: critical
- **Category**: B3 (error state)
- **Scope**: pattern (all three non-admin portals)

**Evidence** (`find <portal> -name error.tsx`):

| Portal | `error.tsx` count | Pages in portal |
|--------|------------------:|----------------:|
| Admin `(dashboard)` | 10 | 97 (10% coverage) |
| Client | **0** | 21 |
| Partner | **0** | 21 |
| Participant `assess` | **0** | 13 |

The admin portal has a top-level `(dashboard)/error.tsx` plus 9 route-scoped boundaries (constructs, dimensions, factors, items, report-templates, reports, response-formats). Every other portal is entirely unprotected — an uncaught server action error in the client or participant flow will surface as the default Next.js error page, not a branded one.

**Most critical missing boundary**: `src/app/assess/**` — the participant assessment flow. A failure mid-assessment surfacing raw Next.js error chrome is a participant-trust risk.

**Suggested fix**:
1. Add `src/app/client/error.tsx`, `src/app/partner/error.tsx`, `src/app/assess/error.tsx` — top-level route-group boundaries with branded fallbacks and a "try again" / "back to dashboard" action.
2. For `assess`, the boundary should include a contact-support link and preserve the participant token context.
3. Pattern the fallback on `src/app/(dashboard)/error.tsx` (already exists).

### P-002 — PageHeader component used on only 27% of pages

- **Severity**: major
- **Category**: C1 (page header)
- **Scope**: pattern (app-wide)

**Evidence**: `grep PageHeader` across all `page.tsx` files → 41 matches out of 152 pages (27%). The remaining 111 pages either render a custom header or no header at all.

The `PageHeader` component defines the canonical eyebrow + title + description + actions pattern per `docs/ui-standards.md`. When a page skips it, the eyebrow / description disappears and the title becomes inconsistent — users lose the "what section am I in" cue.

High-value pages without `PageHeader` include:
- Several client-portal dashboards (per `inventory/client-portal.md`)
- Admin `/dashboard` has a custom hero instead of PageHeader (per P2-C agent reconnaissance)
- Campaign / participant / assessment detail pages rely on shell-injected headers (CampaignDetailShell, ClientDetailShell) which is defensible — but for non-shelled routes, it's a gap.

**Suggested fix**:
1. Audit all 111 pages without `PageHeader`.
2. Classify as: (a) intentionally shelled (CampaignDetailShell, etc.) — no action; (b) custom hero that should migrate to PageHeader — convert; (c) no header at all — add one.
3. Document the three legitimate header patterns in `ui-standards.md`.

### P-003 — No breadcrumbs anywhere except the avatar dropdown

- **Severity**: major
- **Category**: C2 (where am I), C4 (back-stack)
- **Scope**: pattern (app-wide)

**Evidence**: `grep Breadcrumbs` across `src/` → 3 occurrences in 2 files (`dashboard-header.tsx`, `breadcrumbs.tsx`). The primitive exists but is only consumed by the header avatar area (tenant switcher label) — not as a "where am I" indicator.

"Where am I in the hierarchy" is currently carried by:
- Sidebar active section (one level)
- Page header title + eyebrow (one level)
- Tab shells (one level within a detail)

None of these give the user a click-to-return-to-parent affordance beyond browser back. For deep routes like `/partner/campaigns/[id]/participants/[pid]/sessions/[sid]` (4 levels deep), there's no on-page way to jump back up.

**Suggested fix**:
1. Wire `breadcrumbs.tsx` into `PageHeader` as an optional prop.
2. Render breadcrumbs on all detail routes deeper than 2 levels.
3. Auto-derive from the URL where possible; accept explicit overrides when the URL doesn't reflect the logical parent (e.g. reports accessed from a session link).

### P-004 — Animations don't respect `prefers-reduced-motion`

- **Severity**: major (accessibility regression class)
- **Category**: D3 (contrast + motion)
- **Scope**: pattern (app-wide)

**Evidence**: `grep "motion-safe:\|prefers-reduced-motion"` → 7 files total. `animate-shimmer` + `animate-pulse` + `animate-spin` appear in 85+ files. Motion-safety wrappers are present in:
- `src/app/globals.css` (root level — may define shimmer safely)
- 2 marketing-site files
- `src/components/tilt-card.tsx`
- `src/components/scroll-reveal.tsx`
- 2 marketing hooks

Everything else (including every `loading.tsx` with shimmer, every toggle with scale animation, every hover glow) appears to animate regardless of the user's OS setting.

**Suggested fix**:
1. Audit `globals.css` — confirm `animate-shimmer` keyframes are wrapped in `@media (prefers-reduced-motion: no-preference)` or similar.
2. Add a root CSS override: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` as a belt-and-braces safeguard.
3. For JS-driven motion (`ScrollReveal`, `TiltCard`, `AnimatedNumber`), use the `useReducedMotion` hook (or its Motion-library equivalent) to skip the animation entirely.

### P-005 — Hand-rolled warning / info banners (no Alert variants)

- **Severity**: minor
- **Category**: A3 / consistency
- **Scope**: pattern (library, participants, integrations)

**Evidence**: `src/components/ui/alert.tsx` has only `default` and `destructive` variants. Grep shows ~12 hand-rolled warning banners across the app (quota warning on campaign participants, import-issues banner, integration webhook-error row, etc.) using custom className strings like `bg-amber-*` or `text-warning`.

**Suggested fix**:
1. Add `warning`, `info`, `success` variants to `alertVariants` cva config.
2. Grep + migrate hand-rolled callsites to `<Alert variant="warning">`.

### P-006 — Dead primitive: ScrollArea

- **Severity**: minor
- **Category**: consistency
- **Scope**: 1 file

**Evidence**: `src/components/ui/scroll-area.tsx` is defined but `grep "@/components/ui/scroll-area"` returns 0 consumer files.

**Suggested fix**: Either delete it or adopt it where long popover / sidebar content lives. Don't leave it floating.

### P-007 — Only 1 ActionWizard consumer

- **Severity**: minor
- **Category**: consistency
- **Scope**: 3 flows

**Evidence**: `grep ActionWizard` → only `QuickLaunchModal` consumes it. `inventory/overlays.md` identified 3 natural candidates currently using custom step logic inside `ActionDialog`:
- Library bulk import (2-step "Prepare / Review")
- Library bundle import (same pattern)
- Staff invite dialog (could be 3-step: scope → role → review)

**Suggested fix**: Migrate one flow as a proof-of-consistency, then the others.

### P-008 — Participant flow: no step indicator on consent/demographics/intro

- **Severity**: major
- **Category**: C2 (where am I)
- **Scope**: 4 pages in participant portal

**Evidence**: Only `/assess/[token]/section/[sectionIndex]` renders a progress indicator (and only when `campaign.showProgress === true`). The preceding pages (join, welcome, consent, demographics, assessment-intro) show nothing — the participant has no "I'm 3 of 8 steps in" cue for the first half of the flow.

**Suggested fix**:
1. Render a unified step indicator on every stage of the participant flow (since stages are dynamic per campaign, derive from `experience.stages` config).
2. Style as a subtle pills-with-connector at the top (below the brand header).
3. Respect `campaign.showProgress === false` — but still show a minimal "step N" without the visual bar.

### P-009 — Participant flow: redirect-heavy, no perceived-performance scaffolding

- **Severity**: major
- **Category**: B5 (perceived performance)
- **Scope**: ~8 pages in participant portal

**Evidence**: Every form submit in the participant flow is a server round-trip + server redirect — `inventory/participant.md` §Preliminary observations. No skeletons, no optimistic "submitting…" indicator, no route-transition scaffolding. On slow connections (mobile, poor Wi-Fi) this feels laggy and participants may click submit twice.

**Suggested fix**:
1. Add a submitting overlay to each form that disables the submit button, shows a branded "Submitting…" indicator, and stays on screen until the redirect completes.
2. Add `loading.tsx` to each participant route (currently missing per the 95-file loading.tsx scan — none are under `src/app/assess/`).
3. Consider an optimistic UI where the next stage renders a skeleton immediately while the server finalises the previous stage.

### P-010 — Two stub pages in client portal

- **Severity**: minor
- **Category**: cleanup
- **Scope**: client portal

**Evidence**: `src/app/client/diagnostics/[id]/page.tsx` and `src/app/client/diagnostic-results/[id]/page.tsx` always call `notFound()`. Feature-not-implemented placeholders.

**Suggested fix**: Delete both, remove any linking UI that points at them. If the feature is planned, use a typed feature-flag stub instead of dead routes.

### P-011 — Card primitive uses ad-hoc variant typing

- **Severity**: minor
- **Category**: consistency
- **Scope**: 1 primitive, 77 consumer files

**Evidence**: `src/components/ui/card.tsx` handles `variant?: "default" | "glass" | "interactive"` through inline `className` if-chains, not cva. Every other variant-having primitive (Button, Badge, Alert, Tabs, Sidebar, InputGroup) uses cva.

**Suggested fix**: Migrate Card to cva for consistency. Low-risk — existing consumers keep the same prop API.

### P-012 — No Combobox primitive

- **Severity**: minor
- **Category**: consistency
- **Scope**: 5 callsites

**Evidence**: `inventory/overlays.md` identified 5 Popover usages that implement combobox patterns manually: `TenantCombobox` (invite dialog), entity search (dimension-construct-linker), block config context, block-level text editing, "Add block" picker, model-picker-combobox.

**Suggested fix**: Extract a shared `<Combobox>` primitive (built on Popover + Command internally), migrate the 5 callsites.

## Cross-cutting observations (not in table)

1. **Success feedback is consistent.** `toast()` is imported in 88 files — a strong signal that Zone-1 mutations uniformly trigger toasts. The real `B4` failure mode is the OPPOSITE — too many toasts would be a finding, but current prevalence is healthy.

2. **Skeleton coverage is strong.** 258 `animate-shimmer` occurrences across 85 files + 95 `loading.tsx` files → the shimmer skeleton pattern is well-adopted. Exception: `src/app/assess/` has no `loading.tsx` files at all (0), reinforcing P-009.

3. **Focus rings exist at the primitive level.** Every `ui/*.tsx` primitive with interactive state has `focus-visible:ring-`. Custom surfaces that hand-roll interactions (e.g., the TiltCard wrapper on dashboard stat cards) risk losing the focus ring — spot-check.

4. **Hex colours appear in 30 files.** Most are legitimate (brand preview, PDF rendering, email templates, marketing site particle config, band-scheme visualiser). Spot-check to confirm none are in plain app surfaces.

## What code-based pattern scan cannot tell us

These require either browser testing or a screenshot set — deferred to a later session:

- Actual contrast ratios in dark mode
- Keyboard focus order correctness (vs merely "focus rings exist")
- Screen-reader announcement quality (vs merely "aria-label is set")
- Mobile responsive behaviour (all `sm:/md:/lg:` prefixes are declared, but actual rendering needs verification)
- Animation subjective quality (smooth vs janky)

**Recommendation**: Phase 2B (optional) — run Playwright smoke across ~15 sampled routes at 3 viewports, capture screenshots, manually verify top findings visually. This is NOT required before Phase 3 remediation on P-001 through P-012 — those are code-verified.

## Incomplete

None. Pattern scan is complete. Deliverable is `priorities.md` for Phase 3 sequencing.
