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

## Product-owner answers (2026-04-18)

1. **Mobile scope**: desktop-primary is acceptable for admin / client / partner portals. **Participant assessment flow must be first-class mobile.** → this elevates mobile responsiveness on `src/app/assess/**` to Lane 1 and keeps the other portals' mobile work in Lane 3 / Lane 4.
2. **i18n (multi-language)**: not needed this year. Drop from scope.
3. **Phase 2B screenshot verification**: yes — proceed before Lane 1 remediation.

## Added to Lane 1 based on answers + Phase 2B screenshots

| # | Pattern | Effort | Impact | Rationale |
|---|---------|:------:|:------:|-----------|
| 1b | Participant-flow mobile-first pass (375px audit of all 13 assess routes) | M | **critical** | Per product-owner answer: assessment flow is the one surface where mobile is first-class. Needs dedicated viewport audit alongside P-008 / P-009. |
| V-001 | Replace "Unable to start this assessment right now" with branded error surface | S | **critical** | Screenshot-confirmed: current state is a bare red string with zero recovery path. See `phase-2b.md` §V-001. |
| V-002 | Add contact CTA to `/assess/expired` | XS | major | Currently copy says "contact administrator" with no link. See `phase-2b.md` §V-002. |
| V-004 | Add question-level progress indicator on section pages | S | major | Confirms P-008 visually: no "Q N of M" during answering. |

Phase-2B polish items (Lane 2): V-003 (validate token at join-form load), V-005 (answer-click feedback), V-006 (plural/singular grammar on complete page), V-007 (portal-aware unauthorized button), V-008 (iOS safe-area footer padding).

## What Phase 3 explicitly does NOT include

- Visual redesigns — this is a remediation pass, not a redesign
- New features — stub deletion (P-010) is cleanup, not product work
- Primitive refresh — `ScrollArea` / `Card` cva / `Combobox` are debt, not transformation

## Tracking

Each pattern should become a Linear / GitHub issue tagged `audit-phase-3` with the P-NNN identifier in the title for traceability back to `patterns.md`.
