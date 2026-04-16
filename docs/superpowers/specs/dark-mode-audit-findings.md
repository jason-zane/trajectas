# Dark Mode Audit — Findings

**Date:** 2026-04-17
**Scope:** sampled audit across admin-dashboard dark-capable surfaces + one forced-light verification.
**Excluded:** partner/client portals (skipped in sampled run — verify later), auth pages, marketing, print.
**Screenshots:** `test-results/dark-audit/*.png`

## Summary

Dark mode is in better shape than expected across the sampled surfaces. No surface looked "broken." A handful of **minor contrast** issues emerged, all concentrated in shared UI primitives (filter pills, stat-card labels, empty states). Fixing the primitive fixes every consumer.

The template preview forced-light check **passed** — mounting a new `(dashboard)/report-templates/[id]/preview/layout.tsx` successfully locks that route to light even when the dashboard is toggled to dark. Same mechanism applies to the other 16 layouts we added. ✅

## Findings

| # | Route | Issue | Severity | Proposed fix | Screenshot |
|---|---|---|---|---|---|
| 1 | `/items` | Filter pills ("All Items", "Construct", "Impression Mgmt", etc. + format pills) have dark backgrounds + dark text — very low contrast in dark mode, hard to read which is active vs inactive | **ugly** | Adjust the pill component's dark-mode tokens — active pill should have more distinct background (e.g., brighter `--accent` background with `--accent-foreground` text); inactive should pick a muted-but-readable foreground | `items-desktop.png` |
| 2 | `/dashboard` | Stat card meta labels ("Dimensions", "Factors", etc. below the big number) render in a faint grey that blends with the card background — slightly lower contrast than desirable | **minor** | Bump the label colour one step brighter in `.dark` — either use `--foreground` at 80% or a dedicated `--card-label` variable | `dashboard-desktop.png` |
| 3 | `/dimensions` | Dimension cards' "0 factors" meta line is quite faint in dark — same root cause as #2 (muted foreground on card in dark) | **minor** | Same fix as #2 propagates; verify both surfaces after adjust | `dimensions-desktop.png` |
| 4 | `/participants` (empty state) | Empty-state illustration icon has very low contrast against dark card background | **minor** | Add a slight glow or increase icon opacity in dark mode for the `EmptyState` component | `participants-desktop.png` |
| 5 | `/assessments` (restricted page) | Actually renders nicely in dark — flagging as **OK**, not a finding | — | — | `assessments-desktop.png` |
| 6 | Template preview (forced-light) | **PASS** — confirmed light rendering with dark-mode toggle active | — (verification) | — | `template-preview-FORCED-LIGHT.png` |

## Patterns observed

- **Muted-foreground-on-card pattern** is the root cause of most faint-text issues (#2 + #3). The `--muted-foreground` value in `.dark` is `oklch(0.60 0.01 260)` — brightness ~60%, on a card background at ~17% brightness. Contrast ratio is borderline for small text. Bumping it to `oklch(0.68)` or `oklch(0.72)` would address #2 + #3 + probably a bunch more caption/label surfaces in one shot.
- **Pill components (filter chips)** have distinct issue — both active and inactive states collapse visually in dark mode. This is a local component-level fix, not a token fix.

## Triage

**To fix in this branch (priority issues):**
- [ ] Finding #1 — filter pills in dark mode (worst readability hit of the audit)
- [ ] Finding #2+#3 — bump `--muted-foreground` in `.dark` to improve caption/label contrast globally (single token change, broad benefit)
- [ ] Finding #4 — empty-state icon contrast (small, easy)

**Deferred / do in follow-up:**
- Full audit of partner portal + client portal in dark mode (skipped in sampled pass — need dedicated time)
- Mobile viewport (390×844) audit — not completed in this pass due to viewport tool issue
- Hover/focus/active state audit on tables, cards, buttons in dark mode
- Popover/dialog surfaces (command palette, confirm dialogs, bulk-import modal)

**Decision needed from user:**
Approve the three "To fix" items? Or narrow/expand the list?
