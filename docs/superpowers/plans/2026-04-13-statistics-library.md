# Statistics Library Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `simple-statistics` as a client-side computation library for psychometric analytics — z-scores, percentile conversions, point-biserial correlations, and descriptive statistics — so the diagnostics and item analysis tools don't rely exclusively on server-side queries for computations that can run in the browser.

**Architecture:** `simple-statistics` is 3KB tree-shakeable, pure functions, no side effects. All functions are imported individually (`import { mean, standardDeviation, zScore } from 'simple-statistics'`). A `src/lib/psychometrics.ts` wrapper adds domain-specific utilities (Cronbach's alpha, point-biserial, discrimination index) built on top of the primitives. Computation stays client-side for interactive tools; server-side remains the source of truth for stored metrics.

**Tech stack:** `simple-statistics`

**Key reference files:**
- Psychometrics page: search for `psychometrics`, `cronbach`, `alpha`, `reliability` in `src/app/`
- Item analysis: search for `discrimination`, `point-biserial` in `src/app/` and `src/lib/`
- Existing norm/scoring logic: search for `percentile`, `norm` in `src/lib/` and server actions
- Diagnostics tool: search for `diagnostics` in `src/app/`

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install simple-statistics`
- [ ] Check `node_modules/simple-statistics/README.md` for the full function list — confirm `mean`, `standardDeviation`, `zScore`, `cumulativeStdNormalProbability`, `probit`, `sampleCorrelation` are available
- [ ] Note: simple-statistics is pure ESM/CJS compatible — no special Next.js config needed

### Phase 2 — Core psychometrics utilities

- [ ] Create `src/lib/psychometrics.ts`:

  ```ts
  // Descriptive
  export { mean, standardDeviation, min, max, median, quantile } from 'simple-statistics'

  // z-score and percentile conversion
  export { zScore, cumulativeStdNormalProbability as zToPercentile } from 'simple-statistics'
  export function percentileToZ(p: number): number // use probit()

  // Cronbach's alpha
  export function cronbachAlpha(itemScores: number[][]): number
  // itemScores[i][j] = score of participant i on item j
  // formula: (k/(k-1)) * (1 - sum(item_variances) / total_variance)

  // Point-biserial correlation (item-total)
  export function pointBiserial(itemScores: number[], totalScores: number[]): number
  // use sampleCorrelation from simple-statistics

  // Discrimination index
  export function discriminationIndex(itemScores: number[], totalScores: number[]): number
  // upper 27% minus lower 27% mean scores

  // Item difficulty (p-value)
  export function itemDifficulty(itemScores: number[]): number
  // mean of binary scores (proportion correct)
  ```

- [ ] Add JSDoc to each function with the psychometric formula reference

### Phase 3 — Replace server-side-only computations where interactive feedback is needed

- [ ] Identify computation sites in the diagnostics/psychometrics page — read the page before editing
- [ ] For computations that run on each filter/sort change (e.g., re-computing alpha when items are toggled), move the computation to the client using `psychometrics.ts` — keep the stored/persisted value computed server-side
- [ ] Do NOT remove server-side computations; add client-side as an interactive layer on top

### Phase 4 — Wire into item analysis table

- [ ] In the item analysis table component, compute `pointBiserial` and `discriminationIndex` client-side from the loaded response matrix
- [ ] Show the computed values in the table alongside any server-stored values (if they match, good; if they diverge, log a warning)
- [ ] Add column sorting on these computed values (TanStack Table supports computed column accessors)

### Phase 5 — Wire into norm/scoring pipeline

- [ ] In the score display component (report blocks or results view), use `zScore` and `zToPercentile` to compute the candidate's percentile from the norm group mean/SD
- [ ] This replaces or validates any hardcoded percentile lookup tables

### Phase 6 — Expose in diagnostics tool

- [ ] Add a "Recompute" button in the diagnostics tool that runs Cronbach's alpha and item discrimination client-side from raw response data and compares to stored values
- [ ] Show a diff view if there are discrepancies

---

## Acceptance criteria

- `cronbachAlpha` matches the server-computed value for a known test dataset (within floating point tolerance)
- Item analysis table shows point-biserial and discrimination index computed client-side
- Percentile conversions use `zToPercentile` and match expected values for standard normal inputs
- No `simple-statistics` functions are called in Server Components (pure utility — fine to import anywhere, but confirm no issues)
- Tree-shaking works — bundle size increase < 5KB
