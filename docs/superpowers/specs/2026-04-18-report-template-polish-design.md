# Report Template Polish — Design

Three small-to-medium report-template tweaks bundled into one spec:

1. Full Preview page matches the real report viewer shell, with a "Download PDF" option
2. Two new band-scheme palettes: `soft-rag` and `sage-ladder`
3. `score_interpretation` block supports group-level (dimension/factor) score, band, and anchors when grouping is enabled

## Non-Goals

- No changes to the real report pipeline (`processSnapshot`, `report_snapshots` table, `/api/reports/.../pdf`)
- No changes to the palette cascade resolution or persistence shape
- No new block types — we only extend the existing `score_interpretation` config

---

## Feature 1 — Preview shell + PDF download

### Current state
`src/app/(dashboard)/report-templates/[id]/preview/page.tsx` renders `ReportRenderer` under a thin amber banner. No PageHeader, no PDF download.

The real viewer at `src/app/(dashboard)/reports/[snapshotId]/page.tsx` wraps `ReportRenderer` in `PageHeader` + a card, and includes `ReportPdfButton`.

### Target

Preview page uses the same shell: `PageHeader` + card wrapper + a Download-PDF button.

```
[Eyebrow] Report templates
[Title]   <template name>
[Desc]    Preview — sample data for <assessment title>
[Actions] [Assessment ▾]  [Download PDF]

╔═══════════════════ Card ═══════════════════╗
║        <ReportRenderer blocks={...} />     ║
╚═════════════════════════════════════════════╝
```

The assessment selector moves from the old top-of-page banner into the header actions area. The amber "Preview — showing sample data" banner is dropped; preview context is communicated by the title/description.

### PDF pipeline (mirrors the real report flow)

Real reports use:
- `/print/reports/[snapshotId]/page.tsx` — server-rendered plain HTML with `ReportRenderer`
- `/api/reports/[snapshotId]/pdf` — generates/returns the PDF; backed by Playwright via an internal helper
- `ReportPdfButton` — client component that polls `/api/reports/[snapshotId]/status` and triggers download

For preview we mirror the same pattern but scoped by **template id + assessment id**, not a snapshot:

| Real | Preview |
|---|---|
| `/print/reports/[snapshotId]/page.tsx?pdfToken=<token>` | `/print/report-templates/[id]/preview/page.tsx?assessment=<id>&pdfToken=<token>` |
| `/api/reports/[snapshotId]/pdf` | `/api/report-templates/[id]/preview/pdf?assessment=<id>` |
| stores `pdf_url` on `report_snapshots` | streams PDF as response, no DB write |
| uses `verifyReportPdfToken(token, snapshotId)` | new `verifyPreviewPdfToken(token, templateId, assessmentId)` — same HMAC pattern, different payload |

**Why no DB persistence:** A preview PDF isn't shared or stored; regenerating on click is fine. This avoids `report_snapshots` rows that don't represent real participant data.

**Why a new token verifier:** The existing `verifyReportPdfToken` is keyed to `snapshotId`. Preview PDFs are keyed to `(templateId, assessmentId)`, so they need their own HMAC scope. Same signing key, same `jose` library, just different payload shape.

**Token payload shape:** `{ templateId: string, assessmentId: string, iat: number, exp: number }`

**PDF generation helper:** Find and reuse the existing Playwright helper (likely `src/lib/reports/pdf-renderer.ts` or similar — implementer should locate it). The helper accepts a URL and returns a PDF buffer; we pass the new print route.

**Button UX:** `ReportPdfButton` today expects a `snapshotId`. Either:
- (a) Generalize it to accept a `downloadUrl` prop and keep `snapshotId` as a legacy shorthand
- (b) Build a thin `PreviewPdfButton` that shares the same styling/loading states

Implementer's choice; recommend **(b)** — it's simpler and keeps the real-report button untouched. The preview variant just triggers a direct download without polling for status (PDFs generate synchronously for preview since there's no AI enhancement to wait on).

### Files
- Modify: `src/app/(dashboard)/report-templates/[id]/preview/page.tsx`
- Create: `src/app/print/report-templates/[id]/preview/page.tsx`
- Create: `src/app/api/report-templates/[id]/preview/pdf/route.ts`
- Create: `src/lib/reports/preview-pdf-token.ts` (HMAC helpers)
- Create: `src/components/reports/preview-pdf-button.tsx`

---

## Feature 2 — Two new palette variants

### Current palettes
`src/lib/reports/band-scheme.ts` defines 4 palettes: `red-amber-green | warm-neutral | monochrome | blue-scale`. They all use two `PALETTE_STOPS` endpoints and linearly interpolate — except `red-amber-green` which routes through amber at the midpoint.

### New palettes

**`soft-rag`** — same three-way structure as `red-amber-green` but with softer hues. Less alarmist reds; less fluorescent greens.
- Low: `#c78a8a` (muted rose)
- Mid: `#d7b26a` (soft amber)
- High: `#7aa87a` (sage green)
- Interpolation: same as `red-amber-green` (routes through mid)

**`sage-ladder`** — the user's request: 5 distinct hues climbing from non-negative cool to confident green. Works with 3/5/7-band schemes via interpolation across the fixed stops.
- Stop 1: `#64748b` (slate) — low, no "alarm" connotation
- Stop 2: `#60a5fa` (sky)
- Stop 3: `#14b8a6` (teal)
- Stop 4: `#84cc16` (lime)
- Stop 5: `#22c55e` (green) — high, clearly positive

### Structural change

`PALETTE_STOPS` currently uses `[start, end]` tuples. For `sage-ladder` we need 5 stops, and `red-amber-green`/`soft-rag` need 3. Generalize:

```typescript
const PALETTE_STOPS: Record<PaletteKey, string[]> = {
  'red-amber-green': ['#c62828', '#e67a00', '#2e7d32'],
  'soft-rag':        ['#c78a8a', '#d7b26a', '#7aa87a'],
  'sage-ladder':     ['#64748b', '#60a5fa', '#14b8a6', '#84cc16', '#22c55e'],
  'warm-neutral':    ['#8a7a5a', '#c9a962'],
  'monochrome':      ['#6b6b6b', '#1a1a1a'],
  'blue-scale':      ['#90caf9', '#0d47a1'],
}
```

`getBandColour(palette, bandIndex, bandCount)` becomes a generic multi-stop interpolator:

```typescript
function interpolateMultiStop(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0]
  const scaled = t * (stops.length - 1)
  const i = Math.floor(scaled)
  if (i >= stops.length - 1) return stops[stops.length - 1]
  const localT = scaled - i
  return interpolateHex(stops[i], stops[i + 1], localT)
}
```

This replaces the current special-case for `red-amber-green` — the three-stop interpolation falls out naturally. All existing band-scheme persistence stays valid.

### Files
- Modify: `src/lib/reports/band-scheme.ts` (add two keys, generalize stops + interpolation)
- Modify: `src/app/(dashboard)/settings/reports/band-scheme/page.tsx` — the palette picker UI (add the two new options to whatever select/swatch component lists them)

---

## Feature 3 — Group-level bands, labels, anchors in score_interpretation

### Current state

When `groupByDimension` is enabled, the block groups entities under their parent dimension's name — but only as a plain label. No score, no band, no anchors for the group itself.

### Target

Add three new config flags:

```typescript
interface ScoreInterpretationConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension: boolean           // existing
  showScore: boolean                  // existing — for children
  showBandLabel: boolean              // existing — for children
  showAnchors: boolean                // existing — for children
  showGroupScore?: boolean            // NEW
  showGroupBand?: boolean             // NEW
  showGroupAnchors?: boolean          // NEW
}
```

New behavior: when grouping is on and any `showGroup*` flag is set, each group's header row shows the group entity's score/band/anchor treatment (same visual language as children) above the list of children.

### Group score computation

Per the Q3 decision (use stored score where possible, recompute otherwise):

1. If the group entity (dimension or factor) has a row in `participant_scores` for this session → use its `scaled_score` (POMP, 0–100)
2. Otherwise compute weighted mean of the children's POMP scores using link weights:
   - Dimension grouping in construct-level assessments: `dimension_constructs.weight`
   - Dimension grouping in factor-level assessments: unweighted mean of child factor POMPs
   - Factor grouping: `factor_constructs.weight`

Fallback note: in builder preview there's no session-level stored score for dimensions (schema enum is `factor|construct`), so the weighted-mean path always runs for dimension groupings. The real runner reads from `participant_scores` for factor-level rows directly.

This is already implemented for the builder preview in `loadConstructLevelEntities` / `loadFactorLevelEntities`; the group score is just the parent entity's `pompScore`. So on the server side we pass the parent's POMP through with every group; no new computation is needed in the renderer. The real runner (`runner.ts`) reads from `participant_scores` directly, so the same code path already covers it for real reports.

### Anchor source

Anchors for the group entity come from the library (`dimensions.anchor_low/high`, `factors.anchor_low/high`). They're already loaded by `getPreviewEntitiesForAssessment` and the real runner's entity resolution.

### Sample data generator

`sample-data.ts` → `score_interpretation` case: when building groups, attach a `groupEntity` object to each group `{ entityId, entityName, pompScore, bandResult, anchorLow, anchorHigh }`. Renderer reads it.

### Renderer

`src/components/reports/blocks/score-interpretation.tsx`: for each group, if `showGroupScore || showGroupBand || showGroupAnchors`, render a "group header card" above the children using the same `SegmentBar` or card component as children (visually consistent).

### Files
- Modify: `src/lib/reports/sample-data.ts` — emit `groupEntity` in `score_interpretation` data
- Modify: `src/lib/reports/runner.ts` — same for the real render path
- Modify: `src/lib/reports/types.ts` — add `groupEntity` to the block's resolved data, add the three config flags
- Modify: `src/components/reports/blocks/score-interpretation.tsx` — render group header when flags set
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` — surface the three new toggles in the builder UI

---

## Testing strategy

### Unit
- `interpolateMultiStop` — endpoints, midpoints, 3-stop, 5-stop
- `soft-rag` at 50% returns the mid stop
- `sage-ladder` at 0%, 25%, 50%, 75%, 100% returns each named stop
- `sample-data.ts`: `score_interpretation` emits `groupEntity` with correct pompScore when grouping enabled

### Manual
- Band-scheme editor shows the two new palettes, selecting either one re-renders the preview with the new colours
- Score interp block: enable group toggles → header row appears with correct score/band/anchors; toggles can be mixed (e.g. only show group band label)
- Full preview page: visually matches real report viewer; PDF download produces the same content as the on-screen render

---

## File impact summary

| File | Change | Risk |
|---|---|---|
| `src/lib/reports/band-scheme.ts` | Generalize PALETTE_STOPS + getBandColour; add 2 palette keys | Low — same output for existing palettes |
| `src/app/(dashboard)/settings/reports/band-scheme/page.tsx` | Add 2 options to picker | Low |
| `src/lib/reports/types.ts` | Add 3 config flags + `groupEntity` field | Low |
| `src/lib/reports/sample-data.ts` | Emit groupEntity in score_interpretation | Low |
| `src/lib/reports/runner.ts` | Emit groupEntity in score_interpretation | Medium — real report path |
| `src/components/reports/blocks/score-interpretation.tsx` | Render group header when toggles set | Medium — rendering logic |
| `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` | 3 new toggle controls | Low |
| `src/app/(dashboard)/report-templates/[id]/preview/page.tsx` | New shell (PageHeader, card, PDF button) | Medium |
| `src/app/print/report-templates/[id]/preview/page.tsx` (new) | Plain HTML preview for PDF render | Low |
| `src/app/api/report-templates/[id]/preview/pdf/route.ts` (new) | PDF API endpoint | Medium — invokes Playwright |
| `src/lib/reports/preview-pdf-token.ts` (new) | HMAC token scoped to (templateId, assessmentId) | Low |
| `src/components/reports/preview-pdf-button.tsx` (new) | Client component | Low |

---

## Rollout

All changes are additive or backward-compatible:
- New palettes don't affect existing schemes
- Score interpretation flags default to `false` — existing templates render exactly as before
- Preview page restructure is cosmetic
- PDF endpoint is new; no existing URL changes
