# Admin portal — baseline scorecard

Generated: 2026-04-20
Source: rapid scan of `src/app/(dashboard)/` (97 pages, 14 sections) against the codified standards in `docs/ui-standards.md` + primitives that landed during the client-portal uplift (BrandedError, EmptyState, Alert variants, DataTable, PageHeader, type-* classes).

**Purpose**: decide for each surface whether it (a) already matches the standards, (b) needs a baseline fix, or (c) needs bespoke design work deferred to later. This is NOT phase-2 findings — no screenshots, no rubric scoring. Triage only.

---

## Headline result — the admin portal is in better shape than expected

Most global uplift work during the client sweep applied app-wide (not just `/client`). The admin portal has already inherited:

| Area | Status |
|------|:------:|
| Brand tokens (emerald / gold / cream) | ✅ global via `globals.css` |
| Dark mode removal | ✅ **zero `dark:` residue in `(dashboard)/`** (confirmed) |
| Typography — `PageHeader` primitive | ✅ 72 files use it (157 occurrences) |
| `BrandedError` root boundary — `(dashboard)/error.tsx` | ✅ uses the primitive |
| Section-level error boundaries | ✅ 11 already exist (dimensions, constructs, factors, items, response-formats, report-templates, reports, snapshot detail) |
| DataTable primitive | ✅ 33 files adopt it (273 occurrences) |
| `loading.tsx` coverage | ✅ ~50 files |
| `ease-spring` motion | ✅ inherited app-wide |
| Reduced-motion override | ✅ global in `globals.css` |

**Admin portal dark-mode, tokens, typography, motion, error surfaces — already done.** The baseline sweep is narrower than the plan estimated.

---

## Remaining baseline gaps

### G1 — `<div onClick>` anti-patterns (4 files)

Four files use a clickable `<div>` at the top level (no keyboard, no focus ring). Same fix pattern as DD-FE-01.

1. `clients/[slug]/users/client-users-table.tsx`
2. `report-templates/[id]/builder/block-builder-client.tsx`
3. `report-templates/report-templates-table.tsx`
4. `partners/[slug]/users/partner-users-table.tsx`

Effort: ~2h total (2 are simple row-click wrappers; one is inside the block builder which is in "bespoke later" territory anyway).

### G2 — Alert variants not adopted

Zero `Alert variant="warning|info|success"` usages in `(dashboard)/`. Any warning/info/success notices are still hand-rolled. Need a sweep to identify and migrate — not yet enumerated.

Estimated surfaces with hand-rolled banners (from knowledge of the code): campaign settings warnings, assessment builder validation messages, client/partner settings feature-gate notices, diagnostics results banners, invite-dialog hints. Call this **~10–15 callsites**, 2–4h of mechanical migration.

### G3 — EmptyState adoption gaps

`<EmptyState>` used in 11 files, but admin has ~25 listing pages that plausibly have empty states. Likely ~10 listing pages still render ad-hoc "No X yet" markup.

Effort: ~3h (scan listings, migrate in one PR).

### G4 — Tables outside DataTable

DataTable adopted in 33 files. A few callers still use the raw `<Table>` primitive directly (reports-table at 6 occurrences, matching-runs, etc.) — not necessarily wrong, but worth a look to confirm they're using the same zebra/hover/header treatment.

Effort: ~2h audit + any remediation.

### G5 — PageHeader title sizing on detail pages

Not measured in this scorecard — needs a quick visual pass to confirm detail-page headings use the same `type-headline` treatment the client portal got. If campaign/client/partner detail shells are already using `PageHeader`, done by default.

Effort: ~1h spot-check.

---

## Bespoke areas — defer to later (not in this sweep)

These surfaces are admin-only and have no client-portal analogue. They'll need their own phase-2 findings before a sweep:

| Section | Pages | Notes |
|---------|:----:|-------|
| **Dashboard** | 1 | Admin-specific metrics + activity; skip per product direction |
| **Library** (dimensions / constructs / factors / items / response-formats) | 12 | Construct hierarchy UI — list + create + edit per entity. Editors are heavy and domain-specific; need design input before touching. |
| **Psychometrics** (reliability / norms / item-health) | 4 | Data-viz heavy; needs dedicated design thinking |
| **Diagnostics** | ~6 | Admin-only workflow; leave alone for now |
| **Generate** (AI item generation + network graph) | 4 | Bespoke AI workflow UI; leave alone |
| **Settings → AI / Prompts / Models / Experience / Reports** | ~8 | Admin-only config UIs; leave alone |
| **Chat** | 1 | Admin chat surface |
| **Report-templates builder** | 1 | Block builder — has its own design problems, tackle separately |

Everything else — Campaigns (13), Clients staff-view (9), Partners staff-view (8), Participants (3), Users (5), Assessments (4), Report-templates list (1), Reports list (2), Directory (1), Matching (1), Profile (1) — fits the baseline-sweep pattern: listings, editors, detail pages using shared primitives.

---

## Recommended sweep order

All items are independent and can ship as small PRs. Order by quickest wins first:

1. **G1** — fix the 4 `<div onClick>` cases. Same fix pattern as DD-FE-01, ~1 PR.
2. **G5** — spot-check detail page title sizing. If gaps found, fix in same PR as G1.
3. **G3** — migrate ad-hoc empty states to `<EmptyState>`. 1 PR per portal area (campaigns, users, clients) for reviewability.
4. **G2** — migrate hand-rolled banners to `<Alert variant=>`. 1 PR; grep for common banner class patterns first.
5. **G4** — table consistency audit. May result in no changes or a small PR.

**Total estimated effort for admin baseline sweep: 1–1.5 days** (down from the 2-day estimate in the uplift plan). Deferred bespoke work is the bigger chunk.

---

## Scoped out explicitly

- No visual redesign of admin dashboard, library surfaces, psychometrics, diagnostics, generate, AI/prompts, or report-templates builder
- No new features
- No phase-2 screenshot campaign — triage is pattern-based, not evidence-based per surface
- No keyboard / a11y sweep beyond G1 (full sweep is P2-3 later)
