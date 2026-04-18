# Phase 2 — Scoring & findings

Generated: 2026-04-18
Status: in progress

## Approach

Phase 2 scores surfaces against the 17-criterion rubric in `framework.md`.

**Method**: code-based evaluation (no initial screenshots). Agents read the relevant `page.tsx` + its component chain and score based on what the code objectively does — which `PageHeader`, `loading.tsx`, `error.tsx`, `aria-label`, `focus-visible:`, skeleton vs spinner, token vs hex, etc. Surfaces where visual judgement is unavoidable are flagged for later browser-based verification.

**Sampling**: ~3 pages per surface-type per portal, per the heuristic in `inventory/_master.md`. The participant flow is audited end-to-end (13 pages) because it is small and high-stakes.

**Model allocation**:
- Sonnet for per-portal scoring (judgement + pattern-matching)
- Opus for final synthesis (pattern clustering + priority recommendations)
- Haiku reserved for any truly mechanical rerun work

## Deliverables

1. `docs/audit/findings/<portal>/<surface-slug>.md` — one per scored surface, using the rubric format from `framework.md` Part 4
2. `docs/audit/findings/<portal>/_summary.md` — portal-level roll-up (counts of 3/2/1/N/A per criterion, top 5 findings, visual-verification flags)
3. `docs/audit/patterns.md` — cross-portal pattern clusters (synthesised by Opus)
4. `docs/audit/priorities.md` — prioritised punch-list for Phase 3 remediation

## Agent assignments

| Agent | Scope | Model |
|-------|-------|-------|
| P2-A | Client portal (~12 sampled) + participant flow (13 pages) | Sonnet |
| P2-B | Admin portal (~20 sampled across 14 sections) | Sonnet |
| P2-C | Partner portal (~10 sampled) + app-wide overlays (ActionDialog family + ConfirmDialog + CommandPalette) + primitive accessibility scan | Sonnet |
| P2-D | Synthesis — pattern clustering + priorities.md | Opus (me) |

## Sampling rules

For each portal + surface-type combo:
- If ≤ 3 pages of that type: score all
- If > 3: pick one with the richest interactive surface + one "typical" + one edge case (e.g. feature-gated, theme-override, stub)

**Always score**: every `dashboard`, every `error-page`, every `print-export` (low count, high signal).

**Always skip**: `redirect`, `error-page (stub)`, thin dynamic-router shells.

## Scoring shortcuts for agents

To reduce agent workload:
- `PageHeader` usage can be verified with one grep per file
- `loading.tsx` / `error.tsx` existence can be verified with one `ls` per route
- CSS variable adherence: scan className for raw hex / oklch — if none, A3 is likely a pass
- Focus rings: check for `focus-visible:` or `ring-` classes on interactive elements
- ARIA: check icon-only `Button size="icon*"` for `aria-label` prop
- Skeleton vs spinner: grep for `Skeleton` / `animate-shimmer` vs `Loader2` / `animate-spin`

## Status

- [ ] P2-A (client + participant)
- [ ] P2-B (admin)
- [ ] P2-C (partner + overlays + primitives a11y)
- [ ] P2-D (synthesis)
