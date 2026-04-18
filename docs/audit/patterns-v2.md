# Patterns v2 — derived from Phase 2-full findings

Generated: 2026-04-18
Supersedes: `docs/audit/patterns.md` (v1 was grep-based; v2 is grounded in real screenshots + walkthrough)

This document consolidates cross-cutting patterns from `findings-client-portal.md`, `findings-participant.md`, and `phase-2b.md` — scoped to client + participant surfaces per product-owner direction.

## Highest-severity (production-breaking)

### PB-1 — `/client/campaigns` is broken in production

- **Source findings**: BUG-1
- **Impact**: every client user who clicks "Campaigns" in the sidebar hits a runtime error.
- **Root cause**: server component calling `buttonVariants()` from `ui/button.tsx` (client module).
- **Fix class**: code — add client boundary, or pass variant class at callsite.

### PB-2 — `/client/campaigns/.../sessions/[sid]` never renders (nested form)

- **Source findings**: BUG-2
- **Impact**: deepest drill-down on participant session data is unreachable.
- **Fix class**: code — 23 console errors need diagnosis; likely a data-fetch throw during RSC streaming.

### PB-3 — Session scores render as "Unknown" for all factors

- **Source findings**: BUG-3
- **Impact**: clients get numbers without labels; the reporting feature is literally meaningless.
- **Fix class**: data — factor name resolution is broken, check score→factor join or stale relation.

## Major UX patterns

### P2F-1 — Outer tab shell doesn't sync to nested routes

- **Source findings**: C-09-A, C-11-B
- **Affected surfaces**: every `/client/campaigns/[id]/{participants,sessions}/...` nested route
- **Symptom**: CampaignDetailShell keeps "Overview" highlighted in the top tab bar even when URL + breadcrumb clearly say the user is in Participants or Sessions.
- **Fix class**: client — the active-tab logic must match the current route pathname, not just the first segment.

### P2F-2 — Participant flow lacks a persistent progress indicator

- **Source findings**: V-004, P2F-P-002 (doubled evidence from both phases)
- **Affected surfaces**: welcome, consent, demographics, intro, section (except review)
- **Impact**: measurable completion-rate risk — participants abandon flows where they can't see progress.
- **Fix class**: design + code — add segmented progress bar with per-stage + per-question fill. See `findings-participant.md` § "Progress indicator — consolidated recommendation" for specifics.

### P2F-3 — "Contact administrator" copy without any contact mechanism

- **Source findings**: V-002, P2F-P-005, C-14-A
- **Affected surfaces**: `/assess/expired`, `/assess/join/<invalid>`, `/client/settings/brand/client` (disabled state)
- **Impact**: user sees the dead end and has no path forward.
- **Fix class**: design + content — surface admin email from campaign/client config, or default to a support email. Apply the same recovery-CTA component across all three surfaces.

### P2F-4 — Token/permission validation happens on submit, not on route load

- **Source findings**: V-003, P2F-P-006
- **Affected surface**: `/assess/join/[linkToken]`
- **Impact**: participant fills out the form before learning the link is dead.
- **Fix class**: code — validate upstream in the page's server component before rendering.

### P2F-5 — Dashboard breaks at mobile

- **Source findings**: C-01-B
- **Affected surface**: `/client/dashboard` at 375px
- **Impact**: cards collapse to unreadable widths, voids between sections. Per product scope, mobile is NOT first-class for client portal — but the dashboard specifically is still user-visible on mobile often (quick check on phone).
- **Fix class**: design + code — audit grid templates for very narrow viewports, add `@container` queries or explicit `sm:` fallbacks.

### P2F-6 — Dark mode contrast regression on campaign detail sub-pages

- **Source findings**: C-05-A (repeats on C-06-B, C-07)
- **Affected surfaces**: every campaign sub-page (assessments, participants, experience, settings)
- **Symptom**: campaign title + "Sample Data" subtitle + "Active" badge render muted/low-contrast in dark mode. Overview page uses forced light theme so this isn't visible there; the issue is the CampaignDetailShell's header rendering in dark mode specifically.
- **Fix class**: CSS tokens — raise text colour on the shell header in dark mode, or use PageHeader pattern consistently.

### P2F-7 — Participant session total time shows "0m" for quick completions

- **Source findings**: C-09-B, C-11-C
- **Affected surfaces**: participant detail stat card + session detail stat card
- **Fix class**: UI — format sub-minute durations as "<1 min" or display seconds when duration < 1 min.

## Minor / polish patterns

### P2F-8 — "Nothing here yet" empty-state copy is low-contrast in dark mode

- **Source findings**: C-13-A
- **Affected surface**: `/client/assessments` (and likely other empty table shells that use the same component)
- **Fix class**: CSS — the empty-state text colour needs to meet WCAG contrast in dark mode.

### P2F-9 — Synthetic emails leak into UX with poor long-string handling

- **Source findings**: C-01-A, C-09-C
- **Affected surfaces**: dashboard recent results, participant detail header
- **Fix class**: UI — truncate-with-tooltip for email columns; prefer name display when available.

### P2F-10 — Settings page has no visible save/saved indicator

- **Source findings**: C-08-B
- **Affected surface**: `/client/campaigns/[id]/settings`
- **Fix class**: UX — either auto-save with an indicator, or explicit Save button. Ambiguity is a known UX smell per `docs/ui-standards.md`.

### P2F-11 — Grammar: "Redirecting in 1 seconds..."

- **Source findings**: V-006 (carried forward)
- **Fix class**: UI string — use plural helper.

## Validated FROM v1 (pattern scan was correct)

- **P-001 (missing error boundaries in client/participant/partner)**: confirmed. BUG-1 and BUG-2 both surface Next.js default "This page couldn't load" because there's no branded `error.tsx` in `src/app/client/`.
- **P-004 (reduced-motion)**: unchanged — not re-tested this pass, still a valid Lane-1 item.
- **P-008 (participant step indicator)**: strengthened by P2F-P-002 visual evidence.
- **P-009 (participant perceived performance)**: less critical than originally thought — the flow I exercised felt fast enough on local dev. In real conditions this might still matter, but the A-tier issues are progress indicator and error recovery, not perceived performance.

## Downgraded FROM v1 (pattern scan was misleading)

- **P-002 (PageHeader 27% coverage)**: the 27% number counted all 152 pages including marketing, assess, and layout-shelled routes. Actual PageHeader adoption on "pages that should have it" is much higher. Narrow findings still valid (e.g., C-03-A contrast on New Campaign header) but the broad claim was overstated.
- **P-003 (no breadcrumbs)**: breadcrumbs ARE present on every campaign detail page — this was not obvious from grepping. Downgrade the cross-portal claim; keep the specific observation that top-level pages (dashboard, campaigns list, participants list, assessments list) don't have them.

## Carried forward unchanged

- **P-005** (Alert warning/info variants missing) — still true.
- **P-006** (ScrollArea dead code) — still true.
- **P-007** (only 1 ActionWizard consumer) — still true.
- **P-010** (stub pages in client portal) — still true.
- **P-011** (Card ad-hoc variants) — still true.
- **P-012** (no Combobox primitive) — still true.
