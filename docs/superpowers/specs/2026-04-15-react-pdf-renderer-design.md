# React-PDF Report Renderer

**Date:** 2026-04-15
**Status:** Draft
**Goal:** Replace the Puppeteer-based PDF generation with `@react-pdf/renderer` for precise control over page layout, margins, breaks, and full-bleed cover pages — eliminating all Chrome print engine limitations.

---

## Problem

The current PDF pipeline renders report HTML in a headless Chrome instance via Puppeteer. This creates hard limitations:

- **No per-page margins** — Puppeteer margins apply uniformly; a full-bleed cover page and 25mm content margins are mutually exclusive.
- **Unreliable page breaks** — Chrome's CSS fragmentation support is inconsistent; `break-after: avoid` on headings is frequently ignored.
- **Background colour bleed** — Puppeteer's margin area doesn't respect `html`/`body` backgrounds, creating white borders.
- **CSS padding workarounds** — Using block-level padding to simulate page margins creates conflicting requirements (page-edge spacing vs inter-block gaps).

These are documented Puppeteer limitations ([#2480](https://github.com/puppeteer/puppeteer/issues/2480), [#5613](https://github.com/puppeteer/puppeteer/issues/5613)) with no clean workaround.

## Solution

Use `@react-pdf/renderer` to generate PDFs programmatically from React components. The library renders directly to PDF bytes — no browser in the loop. Every page, margin, break, and background is explicitly controlled.

The new renderer runs **alongside** the existing Puppeteer pipeline via a feature flag on the PDF download route. Both systems consume the same `ResolvedBlockData[]` input. No changes to the report template system, data pipeline, or snapshot infrastructure.

---

## Architecture

### Render function

A single entry point in `src/lib/reports/pdf-react.ts`:

```typescript
async function renderReportPdf(
  blocks: ResolvedBlockData[]
): Promise<Buffer>
```

Takes the same resolved block array the current system produces. Builds a react-pdf `<Document>` with `<Page>` elements, renders to a buffer, and returns it. No side effects.

### Route integration

The existing route `/api/reports/[snapshotId]/pdf` gains a query parameter `?engine=react-pdf`. When present, the route calls `renderReportPdf()` instead of the Puppeteer pipeline. Default remains Puppeteer until switchover.

The route handler changes are minimal — a conditional branch at the point where `generateAndStoreReportPdf()` is currently called.

### File structure

```
src/lib/reports/
  pdf-react.ts              # Entry point — renderReportPdf()
  pdf-theme.ts              # buildPdfTheme() — resolves brand theme to style object
  pdf-html.ts               # htmlToReactPdf() — converts rich text HTML to react-pdf elements
  pdf-blocks/
    cover-page.tsx           # Full-bleed cover
    custom-text.tsx          # Rich text content
    section-divider.tsx      # Visual separators
    score-overview.tsx       # Aggregate score charts (bar, radar, gauges, scorecard)
    score-detail.tsx         # Entity scores with nested children
    strengths-highlights.tsx # Top-N strength entries
    mode-styles.ts           # Shared style factories for open/featured/carded/split/inset
    charts/
      segment-bar.tsx        # Horizontal progress bar
      bar-chart.tsx          # Labelled bar rows
      radar-chart.tsx        # SVG polygon radar
      gauge-chart.tsx        # SVG semicircle gauge
      scorecard-table.tsx    # Tabular scores with inline bars
      mini-bar.tsx           # Compact progress bar
      band-badge.tsx         # Score band label
      grouped-bar-chart.tsx  # Multi-source bars (360)
      gap-indicator.tsx      # Diverging self-vs-others bar
```

### Block components

Each block is a function that takes typed data, the theme object, and layout config, and returns react-pdf elements:

```typescript
function PdfScoreDetail(props: {
  data: ScoreDetailData
  theme: PdfTheme
  mode: PresentationMode
  chartType: ChartType
}): React.ReactElement
```

The orchestrator in `pdf-react.ts` iterates the block array and dispatches to the correct block function. The cover page emits its own `<Page>` element (full-bleed). All other blocks emit `<View>` elements that flow within shared content pages.

### Presentation modes

Instead of a wrapper component hierarchy (ModeWrapper → OpenMode/FeaturedMode/etc.), each block applies mode-specific styles directly via a shared `getModeStyles(mode, theme)` function that returns react-pdf style objects:

- **open** — default: no decoration, uses theme heading/body colours
- **featured** — dark background (`theme.featuredBg`), light text (`theme.featuredText`)
- **carded** — border, border-radius, card background (`theme.cardBg`)
- **split** — two-column flexbox layout
- **inset** — left accent border, tinted background (`theme.insetBg`)

---

## Page Layout & Margins

### Cover page

Its own `<Page>` with zero padding. Background fills edge to edge. Content centred vertically and horizontally with flexbox. Logos loaded as `<Image>` from URL. This is trivially full-bleed — no workarounds needed.

### Content pages

Shared page style applied to all non-cover `<Page>` elements:

```typescript
{
  paddingTop: '25mm',
  paddingBottom: '25mm',
  paddingLeft: '20mm',
  paddingRight: '20mm',
  backgroundColor: theme.pageBg,
  fontFamily: 'Plus Jakarta Sans',
}
```

react-pdf automatically creates new pages when content overflows, inheriting the same padding. Every page gets consistent 25mm/20mm margins. Forced page breaks are achieved by closing the current `<Page>` and opening a new one.

---

## Brand Theming

### Theme resolution

`buildPdfTheme(resolvedBrandTheme?: ReportTheme): PdfTheme`

Merges the brand theme from the first block's `resolvedBrandTheme` with `DEFAULT_REPORT_THEME` defaults. Returns a flat, typed object with camelCase property names:

```typescript
interface PdfTheme {
  headingColour: string
  bodyColour: string
  mutedColour: string
  featuredBg: string
  featuredText: string
  pageBg: string
  cardBg: string
  cardBorder: string
  highBandFill: string
  midBandFill: string
  lowBandFill: string
  // ... all 54 properties
}
```

Every block component receives this theme as a prop and references colours directly (`theme.headingColour`) rather than through CSS variables.

### Font registration

Plus Jakarta Sans is registered with react-pdf at module load from Google Fonts URLs (regular, italic, semibold, bold weights). react-pdf supports remote font registration natively:

```typescript
Font.register({
  family: 'Plus Jakarta Sans',
  fonts: [
    { src: 'https://fonts.gstatic.com/...', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/...', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/...', fontWeight: 700 },
  ],
})
```

---

## HTML Parsing (custom_text block)

A utility `htmlToReactPdf(html: string, theme: PdfTheme): React.ReactElement` converts the limited HTML tag set from the rich text editor into react-pdf primitives:

| HTML Tag | react-pdf Output |
|----------|-----------------|
| `<p>` | `<Text>` with paragraph spacing |
| `<strong>`, `<b>` | `<Text style={{ fontWeight: 700 }}>` |
| `<em>`, `<i>` | `<Text style={{ fontStyle: 'italic' }}>` |
| `<ul>`, `<ol>` | `<View>` with bullet/number prefixes |
| `<li>` | `<View flexDirection="row">` with bullet + `<Text>` |
| `<a>` | `<Link>` |
| `<br>` | `<Text>{'\n'}</Text>` |

Uses `node-html-parser` (zero-dependency, server-safe) to parse the HTML string. Nested formatting (e.g., bold italic) is handled via nested `<Text>` elements.

---

## Chart Components

All charts are rebuilt as react-pdf components. The rendering approaches:

### View-based (rectangles with percentage widths)
- **Segment bar** — `<View>` container with inner `<View>` at `width: ${value}%`
- **Mini bar** — Same pattern, thinner height
- **Bar chart** — Row layout: fixed-width label `<Text>`, flex `<View>` for the bar, fixed-width score `<Text>`
- **Grouped bar chart** — Multiple bars per row with legend

### SVG-based (vector graphics)
- **Radar chart** — `<Svg>` with `<Polygon>` for rings and data shape, `<Circle>` for vertices, `<Text>` for labels. The existing polygon point calculation math ports directly.
- **Gauge chart** — `<Svg>` with `<Path>` arcs. The existing arc length math ports directly.
- **Gap indicator** — Diverging bar rendered as positioned `<View>` elements

### Table-based
- **Scorecard table** — `<View>` rows with fixed-width columns, inline mini bars
- **Band badge** — Inline `<View>` with rounded corners, band-coloured background

---

## Caching Strategy

react-pdf outputs use a separate storage path: `reports/v2/{snapshotId}.pdf`. This prevents the two engines from overwriting each other. The route checks the appropriate path based on the engine parameter.

On switchover, the `v2/` prefix is removed and old Puppeteer-generated PDFs are cleaned up.

---

## Testing & Switchover

### During development

- Append `?engine=react-pdf` to any PDF download URL to get the react-pdf version
- A "(v2)" toggle or link is added near the download button on the report page for convenience
- Both engines can be tested on the same report snapshot simultaneously

### Switchover steps

1. Change the default engine from `'puppeteer'` to `'react-pdf'` in the route
2. Remove dependencies: puppeteer-core, @sparticuz/chromium-min, pdf-lib
3. Remove: `/app/print/reports/` route, `@media print` CSS section, pdf-browser.ts, pdf-token.ts
4. Remove: `data-print`, `data-cover-page` attributes, `print:` Tailwind classes from report components (screen-view components keep their existing rendering)
5. Consolidate `reports/v2/` storage path to `reports/`

---

## Build Order

Each step produces a testable PDF via the `?engine=react-pdf` flag:

1. **Foundation** — install `@react-pdf/renderer`, register fonts, build theme helper, wire up route flag, render an empty document
2. **Cover page** — full-bleed page with participant name, subtitle, date, logos
3. **Section divider + custom text** — simple blocks, proves the HTML parser
4. **Score overview** — all chart types (bar, radar, gauges, scorecard)
5. **Score detail** — entities, nested scores, all config toggles, all presentation modes
6. **Strengths highlights** — top-N rankings with all presentation modes
7. **Remaining blocks** — 360 blocks (rater_comparison, gap_analysis, open_comments) when needed

---

## Dependencies

### Add
- `@react-pdf/renderer` — PDF generation
- `node-html-parser` — HTML parsing for custom_text

### Remove (on switchover)
- `puppeteer-core`
- `@sparticuz/chromium-min`
- `pdf-lib`

---

## Out of Scope

- Changes to the report template builder or block configuration UI
- Changes to the screen-view report renderer
- Changes to the snapshot data pipeline
- 360-specific blocks (rater_comparison, gap_analysis, open_comments) — deferred until needed
- Stub blocks (norm_comparison, development_plan) — deferred until needed
