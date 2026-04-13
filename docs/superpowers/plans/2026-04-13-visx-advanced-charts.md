# @visx Advanced Charts Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the platform's charting capability beyond the current custom SVG components to support psychometric-specific visualisations: normal distribution curves with candidate overlays, item characteristic curves, and confidence interval bands — using `@visx` for composable, design-token-aware SVG charts.

**Architecture:** `@visx` packages are tree-shakeable and composable — install only what's needed. Charts are Server Component-compatible (pure SVG, no browser APIs). Custom wrappers in `src/components/charts/` use the project's CSS variables for colours. Existing custom charts (radar, bar) are not replaced unless there's a concrete reason; `@visx` is additive for new chart types only.

**Tech stack:** `@visx/group`, `@visx/shape`, `@visx/scale`, `@visx/axis`, `@visx/grid`, `@visx/tooltip`, `@visx/gradient`

**Key reference files:**
- Existing charts: `src/components/charts/` (locate via Glob)
- Psychometrics page: search for `psychometrics` or `norm` in `src/app/(dashboard)/`
- Report blocks that use charts: search for chart components in `src/components/report-blocks/` or similar
- CSS brand variables: `src/app/globals.css` — the OKLCH variables

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install @visx/group @visx/shape @visx/scale @visx/axis @visx/grid @visx/tooltip @visx/gradient`
- [ ] Confirm versions are compatible with React 18/19 — check `node_modules/@visx/shape/package.json` peerDependencies
- [ ] Read `node_modules/@visx/shape/README.md` to confirm `<AreaClosed>`, `<LinePath>`, `<Bar>` API shapes before writing

### Phase 2 — Chart theme utility

- [ ] Create `src/components/charts/visx-theme.ts`:
  - Export `CHART_COLORS` object mapping semantic names to CSS variable references (not raw values — use `getComputedStyle` at runtime)
  - Export `defaultMargin = { top: 20, right: 20, bottom: 40, left: 50 }`
  - Export `axisTickStyle` and `axisLabelStyle` using the `.text-caption` font stack

### Phase 3 — Normal distribution curve component

- [ ] Create `src/components/charts/normal-distribution-chart.tsx`:
  - Props: `mean`, `stdDev`, `candidateScore`, `width`, `height`, `highlightColor`
  - Use `@visx/scale` `scaleLinear` for x (score range) and y (density)
  - Use `@visx/shape` `AreaClosed` for the filled curve
  - Use `@visx/shape` `LinePath` for a vertical line at `candidateScore`
  - Use `@visx/axis` for x-axis tick labels
  - Add a shaded region for percentile band around the candidate score
- [ ] Wire into the psychometrics/norm page — read that page before editing

### Phase 4 — Item characteristic curve (ICC)

- [ ] Create `src/components/charts/item-characteristic-curve.tsx`:
  - Props: `items: Array<{ name: string; a: number; b: number; c: number }>` (3PL IRT params), `width`, `height`
  - Compute P(θ) = c + (1-c) / (1 + exp(-a(θ - b))) for θ in [-4, 4]
  - Render one `LinePath` per item using `@visx/shape`
  - Tooltip on hover showing item name and P(θ) at cursor
- [ ] Wire into item analysis / psychometrics diagnostics page

### Phase 5 — Confidence interval bands on existing charts

- [ ] Identify which existing charts show scores without uncertainty bounds (find via code review of report block components)
- [ ] For bar/score charts that have `score` and `confidence` data, add `@visx/shape` `AreaClosed` error bands above/below the bar
- [ ] Keep existing SVG structure — add bands as an additional SVG layer, don't rewrite the chart

### Phase 6 — Scatterplot for item analysis

- [ ] Create `src/components/charts/item-scatter-chart.tsx`:
  - Props: `items: Array<{ id: string; difficulty: number; discrimination: number; label: string }>`
  - Use `@visx/shape` `Circle` for points
  - Use `@visx/axis` for both axes
  - Colour points by discrimination quartile using taxonomy colour variables
  - Tooltip on hover with item label and stats
- [ ] Wire into item bank analysis view

### Phase 7 — Responsive sizing

- [ ] All chart components accept `width` and `height` as props
- [ ] Create `src/hooks/use-chart-dimensions.ts` using `ResizeObserver` to feed container dimensions to charts
- [ ] Apply to all new chart components

---

## Acceptance criteria

- Normal distribution chart renders with candidate score overlay and correct percentile shading
- ICC chart renders multiple items with hover tooltip
- All charts use CSS variable colours (light and dark mode correct)
- Charts render at correct dimensions when container is resized
- No `window` or `document` references that break Server Components (charts are pure SVG — keep it that way)
