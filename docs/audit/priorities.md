# Phase 3 — Priorities

Generated: 2026-04-18
Source: `docs/audit/patterns.md` (12 patterns) + Phase 1 inventory findings.

## Sequencing principles

1. **User-visible trust issues first** (participant flow, uncaught errors) — these directly affect the product's reputation.
2. **Cheap + high-leverage next** (motion-safety, Alert variants) — big consistency win for small effort.
3. **Consistency tightening last** (Combobox, Card-cva, dead primitive) — refactor once no urgent user-facing work is outstanding.

## Priority lanes

### Lane 1 — Ship this week (critical / high-user-impact)

| # | Pattern | Effort | Impact | Rationale |
|---|---------|:------:|:------:|-----------|
| 1 | P-001 — Error boundaries on client/partner/assess portals | S | **critical** | 3 new `error.tsx` files + shared fallback component. Prevents raw Next.js errors from surfacing during a participant's assessment. |
| 2 | P-009 — Submitting indicator + `loading.tsx` in participant flow | M | **critical** | Assessment completion rates directly depend on participants not double-clicking. One shared `saving-overlay` component + 13 `loading.tsx` stubs. |
| 3 | P-008 — Step indicator across all participant stages | M | **major** | New component + wiring to `experience.stages` config. Reduces mid-flow abandonment. |
| 4 | P-004 — Global reduced-motion override | XS | **major** | One CSS block in `globals.css`. Belt-and-braces for ~50 animated surfaces. Accessibility + legal exposure mitigation. |

### Lane 2 — Ship this sprint (consistency wins, easy)

| # | Pattern | Effort | Impact | Rationale |
|---|---------|:------:|:------:|-----------|
| 5 | P-005 — Add `warning` / `info` / `success` variants to `Alert` + migrate hand-rolled banners | S | major | One cva config change + ~12 callsite migrations. Unlocks consistent banner styling app-wide. |
| 6 | P-010 — Delete client-portal stub routes | XS | minor | `git rm` two files + audit linking. Removes dead routes. |
| 7 | P-006 — Decide on ScrollArea (delete or adopt) | XS | minor | Either delete, or wrap the 2–3 candidates (long popover content, sidebar on short viewports). |

### Lane 3 — Ship next sprint (structural)

| # | Pattern | Effort | Impact | Rationale |
|---|---------|:------:|:------:|-----------|
| 8 | P-002 — Audit + migrate 111 pages to `PageHeader` or document their header pattern | L | major | Biggest-scope pattern. Do in waves by portal — admin first (most pages), then client, then partner. |
| 9 | P-003 — Wire breadcrumbs into `PageHeader` and render on deep routes | M | major | Component already exists. Needs a URL-to-breadcrumb helper + rollout to ~30 detail routes. |
| 10 | P-007 — Migrate one of {library-bulk-import, library-bundle-import, staff-invite} to `ActionWizard` | M | minor | Proof-of-consistency for the wizard primitive. Do the staff-invite (cleanest 3-step shape). |

### Lane 4 — Refactor debt (low urgency)

| # | Pattern | Effort | Impact | Rationale |
|---|---------|:------:|:------:|-----------|
| 11 | P-011 — Migrate `Card` primitive to cva | S | minor | 1 file, keeps the API stable. Pure consistency cleanup. |
| 12 | P-012 — Extract `<Combobox>` primitive + migrate 5 callsites | M | minor | Reduces duplication but current Popover-based callsites work. Defer until Phase 4 primitive refresh. |

## Effort legend

- XS: <1 hour
- S: 1–4 hours
- M: 1–2 days
- L: 3–5 days

## Lane totals

- Lane 1 (this week): ~3 days of dev work, critical user-facing impact
- Lane 2 (this sprint): ~1 day, quick wins
- Lane 3 (next sprint): ~8 days, biggest-scope items
- Lane 4 (later): ~3 days, nice-to-have

## Open questions for the product owner

1. **Is mobile a first-class target for admin + client portals, or is desktop-primary acceptable?** (Affects how deep P-002 + P-003 breadcrumb rollout goes on admin surfaces.)
2. **Should the participant flow support i18n this year?** (`inventory/participant.md` flagged English-only; if planned, Lane 1 would add an i18n-scaffolding row.)
3. **Do we want a Phase 2B screenshot verification pass** before starting Lane 1 remediation? (Recommended for P-004 / P-009 / P-008 to confirm the fixes actually land. Roughly half a day with Playwright.)

## What Phase 3 explicitly does NOT include

- Visual redesigns — this is a remediation pass, not a redesign
- New features — stub deletion (P-010) is cleanup, not product work
- Primitive refresh — `ScrollArea` / `Card` cva / `Combobox` are debt, not transformation

## Tracking

Each pattern should become a Linear / GitHub issue tagged `audit-phase-3` with the P-NNN identifier in the title for traceability back to `patterns.md`.
