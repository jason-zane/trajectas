# Priorities v2 — Phase 3 remediation plan

Generated: 2026-04-18
Based on: `findings-client-portal.md`, `findings-participant.md`, `patterns-v2.md`, `phase-2b.md`
Scope: client portal + participant assessment flow (per product-owner direction)

This replaces `priorities.md` with priorities grounded in real evidence from the phase-2-full audit, not the grep-scan inference.

---

## Status — 2026-04-20

All lanes closed for the client portal + participant flow. See `uplift-plan.md` → "Status" for the PR breakdown. Remaining open work moves to the admin + partner baseline sweep tracked separately in the uplift plan.

Deep-dive items 22 (DD-P-01), 23 (DD-BE-01), and 24 (DD-FE-01) shipped as PRs #38, #39, and #40 respectively. Lane 4 housekeeping (stub-route removal, ScrollArea deletion) shipped as #37. Lane 4 items #17 (client `error.tsx`) and #18 (alert variants) were already closed in earlier sweeps.

---

## Lane 0 — BLOCKERS (ship before any other work)

Production-breaking bugs surfaced during the audit. These affect all client users today.

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 1 | Fix `/client/campaigns` runtime error (`buttonVariants()` server/client boundary) | S (0.5d) | BUG-1 |
| 2 | Fix `/client/campaigns/[id]/participants/[pid]/sessions/[sid]` — content never renders, 23 console errors | M (1d) | BUG-2 |
| 3 | Fix session scores rendering "Unknown" for all 24 factors | M (1d) | BUG-3 |

**Total Lane 0**: ~2.5 days. These must ship this week. They negate the value of any other polish until fixed.

## Lane 1 — Participant flow essentials (ship this sprint)

Participant assessment flow is the highest-stakes product surface. These close the obvious UX gaps.

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 4 | Add branded `error.tsx` to `src/app/assess/` (covers V-001 critical: bare-red-text error on section page) | S (0.5d) | V-001, P-001 |
| 5 | Add persistent progress indicator across participant flow (see findings-participant.md §"Progress indicator") | L (3d) | V-004, P2F-P-002 |
| 6 | Replace "contact administrator" copy with actual contact CTA (`mailto:` from campaign config + fallback) | S (0.5d) | V-002, P2F-P-005, C-14-A |
| 7 | Validate join-form token before rendering (redirect invalid to `/assess/expired`) | S (0.5d) | V-003, P2F-P-006 |
| 8 | Add submitting overlay on section answer + review submit (prevents double-click, gives feedback) | S (1d) | V-005 |
| 9 | Fix "Redirecting in 1 seconds" grammar + review page "Complete" button label when 0 answered | XS | V-006, P2F-P-003-A |

**Total Lane 1**: ~6 days. Ships the participant-flow polish the product scope actually requires.

## Lane 2 — Client portal essentials (ship this sprint)

Desktop-primary per scope. The Lane 0 bugs already handle the most critical; Lane 2 covers the visible UX regressions.

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 10 | Fix CampaignDetailShell tab highlighting on nested routes (`/participants/[pid]`, `/sessions/[sid]`) | S (0.5d) | C-09-A, C-11-B, P2F-1 |
| 11 | Fix dark-mode contrast on CampaignDetailShell header (muted title/badge) | S (0.5d) | C-05-A, C-06-B, P2F-6 |
| 12 | Fix duration "0m" formatting for sub-minute completions → `<1 min` | XS | C-09-B, C-11-C, P2F-7 |
| 13 | Raise contrast on "Nothing here yet" empty-state text in dark mode | XS | C-13-A, P2F-8 |
| 14 | Add truncate-with-tooltip for long emails on dashboard + participant detail header | S (0.5d) | C-01-A, C-09-C, P2F-9 |
| 15 | Fix participant row horizontal truncation on campaign participants page | S (0.5d) | C-06-A |

**Total Lane 2**: ~2.5 days.

## Lane 3 — Mobile dashboard fix (contained scope)

Product scope is desktop-primary for client portal, but the dashboard specifically is often checked on mobile.

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 16 | Fix `/client/dashboard` mobile layout — stat cards, action card, active campaigns grid | M (1-2d) | C-01-B, P2F-5 |

**Total Lane 3**: 1-2 days.

## Lane 4 — Cross-cutting gaps (next sprint)

Lower priority but valuable consistency work.

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 17 | Add `error.tsx` to `src/app/client/` (portal-level boundary) | S (0.5d) | P-001 |
| 18 | Add `warning` / `info` / `success` variants to `Alert` cva + migrate hand-rolled banners | M (1d) | P-005 |
| 19 | Add reduced-motion CSS override at root (respects `prefers-reduced-motion`) | XS | P-004 |
| 20 | Delete client-portal stub routes (`/client/diagnostics/[id]` + `/client/diagnostic-results/[id]`) | XS | P-010 |
| 21 | Decide on ScrollArea — delete or adopt | XS | P-006 |

**Total Lane 4**: ~2 days.

## Lane 5 — Deep-dive follow-ups (Phase 3b)

Closed out in `findings-deep-dives.md`. Remaining genuinely-untested items:

- Screen-reader announcer output for FlowEditor drag-reorder (once DD-FE-01 fix lands)
- CampaignForm validation / submit-error rendering
- BrandEditor in truly enabled state (blocked by DD-BE-01 cache staleness)
- Participant report pages (needs released snapshot)
- Participant consent page in fully-configured state (needs consent copy, not just flag)

Estimated ~1 day of additional targeted testing once the Lane 0–2 fixes land.

## Items added from deep-dive findings

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 22 | Differentiated error copy for participant-flow misconfiguration (vs generic "Unable to start") | S (0.5d) | DD-P-01, V-001 |
| 23 | Invalidate brand-capability cache when `can_customize_branding` toggled | S (0.5d) | DD-BE-01 |
| 24 | FlowEditor: make page-card keyboard-selectable + add visible focus ring | S (0.5d) | DD-FE-01 |

Items 22–24 land in Lane 2 (this sprint). Total now: ~18 days across all lanes.

## Effort legend

- XS: <2 hours
- S: 2–4 hours
- M: 1 day
- L: 2–3 days

## Lane totals (summary)

| Lane | Total | Parallelisable? |
|------|-------|-----------------|
| Lane 0 (blockers) | 2.5 days | Partial — BUG-1 can ship alone; BUG-2 + BUG-3 need the same session-detail area |
| Lane 1 (participant essentials) | 6 days | Yes — items 4, 6, 7, 8, 9 are independent of each other |
| Lane 2 (client polish) | 2.5 days | Yes — items 10-15 all independent |
| Lane 3 (mobile dashboard) | 1-2 days | Standalone |
| Lane 4 (cross-cutting) | 2 days | Yes |
| Lane 5 (deep-dives) | 3 days | Per-dive |

**Grand total**: ~17 days of dev work to close out the identified gaps.

## Recommended sprint plan

- **Week 1**: Lane 0 (2.5d) + Lane 1 items 4/6/7/9 (1.5d) = 4 days. Ships blockers + participant error recovery.
- **Week 2**: Lane 1 item 5 (progress indicator, 3d) + Lane 2 bits (1d) = 4 days. Ships the participant progress bar.
- **Week 3**: Lane 2 remainder + Lane 3 + Lane 4 = 5 days. Ships remaining polish.
- **Week 4+**: Lane 5 deep-dives as individual initiatives.

## What's explicitly NOT in this plan

- Admin portal work (out of scope per product-owner direction)
- Partner portal work (same)
- PageHeader coverage audit (P-002 was overstated in v1; actual gaps are specific and called out per-surface)
- Breadcrumb rollout (P-003 was overstated in v1; breadcrumbs already exist on campaign detail)
- Marketing site work
- Primitive refactors (Card cva, Combobox extraction) — defer to Phase 4

## Traceability

Every Lane item above cites its source finding ID so you can trace back to screenshots and specific observations. All source findings live in:
- `docs/audit/findings-client-portal.md`
- `docs/audit/findings-participant.md`
- `docs/audit/phase-2b.md`
- `docs/audit/patterns-v2.md`
