# Report Template Builder Redesign

## Problem

The report template builder has core infrastructure in place (block types, presentation modes, chart components, runner pipeline) but the UX doesn't surface controls well and the data pipeline has gaps:

- Template-level settings have no UI after creation
- The config panel auto-generates controls from block config objects, creating duplicate selectors and exposing internal fields
- Canvas cards show block type labels but give no sense of actual content
- Strengths highlights and development plan blocks have phantom chart options that don't render
- Sample data generator ignores block config (topN, entityIds, etc.)
- AI narrative is toggled inside individual blocks rather than being a first-class content type
- Strength/development commentary has no dedicated data source — it tries to derive from behavioural indicators

## Approach

Restructure the system across three layers:

1. **Block definitions** — clean registry with honest configs, remove phantom options, add AI Text as a new block type
2. **Builder UI** — expand-in-place layout (Typeform/Tally pattern), no side panels, full-width canvas
3. **Data pipeline** — new commentary fields on library entities, runner uses them directly, sample data respects config, AI Text block integrates with prompt library

---

## Block Type Registry

### Universal Block Settings

Every block (except cover page for mode, section divider for mode) carries these settings:

| Setting | Type | Notes |
|---------|------|-------|
| `eyebrow` | string \| null | Optional overline text (e.g., "Your Profile") |
| `heading` | string \| null | Optional section heading |
| `description` | string \| null | Optional supporting copy beneath heading |
| `presentationMode` | PresentationMode | featured / open / carded / split / inset |
| `columns` | 1 \| 2 \| 3 | Only when mode is carded |
| `insetAccent` | string \| undefined | Only when mode is inset |
| `printBreakBefore` | boolean | Page break before this block in PDF |
| `printHide` | boolean | Hide in PDF output |
| `screenHide` | boolean | Hide on screen |

Each block type has sensible defaults for eyebrow/heading (e.g., strengths defaults eyebrow to "Your Strengths"). Users can override or clear them.

### Template-Level Settings

Accessed via gear icon in the top bar, opens a Sheet:

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `displayLevel` | dimension / factor / construct | factor | Default for all score blocks |
| `personReference` | you / first_name / participant / the_participant / neutral | the_participant | How narrative text refers to the participant |

Auto-release is removed from template settings — it belongs at the campaign level. Page header logo is deferred to later PDF work.

### Block Types

#### Cover Page (Meta)

Fixed mode: featured. No mode selector.

| Config | Type | Default |
|--------|------|---------|
| `showDate` | boolean | true |
| `showLogo` | boolean | true |
| `showPoweredBy` | boolean | false |
| `poweredByText` | string | "Powered by Talent Fit" |

No subtitle field — assessment name is pulled automatically from session data. Logo selection determined by brand config, not template config.

#### Custom Text (Meta)

| Config | Type | Notes |
|--------|------|-------|
| `content` | string (rich text) | Admin-authored freeform content |

Rich text editor (not markdown) for user-friendliness. Universal headers (eyebrow/heading/description) handle the block's title treatment.

#### Section Divider (Meta)

No presentation mode. No universal headers. Purely a visual break.

| Config | Type | Options |
|--------|------|---------|
| `style` | string | `thin_rule` \| `thick_rule` \| `whitespace` \| `dot_break` |

- **Thin rule** — 1px horizontal line, muted colour
- **Thick rule** — 2-3px short line in brand/primary colour
- **Whitespace** — Extra vertical padding, no visible element
- **Dot break** — Three centred dots, editorial feel

#### Score Overview (Score)

| Config | Type | Default | Notes |
|--------|------|---------|-------|
| `chartType` | radar / bar / gauges / scorecard | radar | Block-level field, not inside config |
| `displayLevel` | dimension / factor / construct | (from template) | Override |
| `entityIds` | string[] | [] (all) | Empty = all scored entities at display level |
| `showScore` | boolean | true | Numeric score value on chart |
| `showBandLabel` | boolean | true | Qualitative label |
| `groupByDimension` | boolean | false | Group factors under parent dimension heading |

`chartType` exists only at the block level — the duplicate inside the config object is removed.

#### Score Detail (Score)

| Config | Type | Default | Notes |
|--------|------|---------|-------|
| `displayLevel` | dimension / factor / construct | (from template) | Override |
| `entityIds` | string[] | [] (all) | Empty = all at display level |
| `showScore` | boolean | true | Numeric score |
| `showBandLabel` | boolean | true | Band label pill |
| `showDefinition` | boolean | true | Entity definition text |
| `showIndicators` | boolean | false | Behavioural indicators for resolved band |
| `showDevelopment` | boolean | false | Development suggestions |
| `showNestedScores` | boolean | false | Show next level down grouped under parent |
| `chartType` | bar / segment / none | none | Per-entity score visualisation |

When `showNestedScores` is on: renders child entities (e.g., factors under dimensions) grouped under each parent with proper indentation.

#### Strengths Highlights (Highlight)

| Config | Type | Default | Notes |
|--------|------|---------|-------|
| `topN` | number | 3 | How many top-scoring entities to show |
| `displayLevel` | dimension / factor / construct | (from template) | Override |

No charts. No style toggle (mode handles layout). No `aiNarrative` toggle — use AI Text block instead.

Content: entity name + `strengthCommentary` from the library record. Purely qualitative.

#### Development Plan (Highlight)

| Config | Type | Default | Notes |
|--------|------|---------|-------|
| `maxItems` | number | 3 | How many development areas |
| `displayLevel` | dimension / factor / construct | (from template) | Override |
| `prioritiseByScore` | boolean | true | Lowest scores first |
| `entityIds` | string[] | [] (all) | Optional filter |

No charts. No `aiNarrative` toggle — use AI Text block instead.

Content: entity name + `developmentSuggestion` from the library record.

#### AI Text (AI) — New

| Config | Type | Notes |
|--------|------|-------|
| `promptId` | string | Selected from prompt library dropdown |

The dropdown is populated from `ai_system_prompts` table filtered to report-related purposes. Each prompt maps to a model config in `ai_model_configs`.

Three starter prompts:
- **Overall report narrative** — synthesises all scores into a cohesive summary
- **Strengths summary** — narrative tying top strengths together
- **Development plan** — structured, actionable development recommendations

Creating new prompts in AI Settings automatically adds them to the dropdown. No code changes needed for new generation types.

#### Deferred Blocks

Registered but greyed out with "Coming soon" label:
- **Rater Comparison** (360) — grouped bars: self vs manager vs peers vs direct reports
- **Gap Analysis** (360) — blind spots and hidden strengths
- **Open Comments** (360) — aggregated qualitative feedback
- **Norm Comparison** (Score) — percentile/sten rank against norm group

---

## Builder UI

### Layout: Expand-in-Place

No side panels. Full-width canvas. Inspired by Typeform/Tally pattern.

### Top Bar

| Element | Behaviour |
|---------|-----------|
| Back button | Navigate to `/settings/reports` |
| Template name | Inline editable input |
| Report type badge | "Self-report" or "360" |
| `+ Add block` button | Opens dropdown popover with blocks grouped by category |
| Gear icon | Opens template settings sheet |
| Preview button | Opens preview in new tab |
| Save button | Saves block order + name |

### Add Block Dropdown

Categories:
- **Layout & Text**: Cover Page, Custom Text, Section Divider
- **Score Blocks**: Score Overview, Score Detail
- **Highlights**: Strengths Highlights, Development Plan
- **AI**: AI Text
- **360 Blocks**: Coming soon (greyed out)

### Canvas Cards

Collapsed state shows:
```
[Grip] [Number] [Block Type] [ModeTag] [Summary] [Delete] [Chevron]
```

Inline `+` buttons appear between cards on hover for adding blocks at specific positions.

Click a card → it expands. Only one block expanded at a time.

### Expanded Block — Four Tabs

1. **Content** — block-specific settings in a two-column grid (varies by type)
2. **Headers** — eyebrow, heading, description (identical layout for every block type)
3. **Presentation** — mode selector, chart type (if applicable), columns (if carded), inset accent (if inset)
4. **Print** — page break before, hide in PDF, hide on screen

### Collapsed Card Summaries

| Block | Summary |
|-------|---------|
| Cover Page | "Date · Logo" |
| Custom Text | First 60 chars of content |
| Section Divider | Style name (e.g., "Thick accent rule") |
| Score Overview | "{chartType} · {N or 'All'} factors" |
| Score Detail | "All factors · Score · Band · Definition · Nested" (active toggles) |
| Strengths | "Top {topN} strengths" |
| Development | "{maxItems} areas · Prioritised by score" |
| AI Text | Prompt template name |

---

## Data Pipeline

### New Data Fields

`strength_commentary` column added to dimensions, factors, and constructs tables. Stores the narrative text shown when an entity is a participant's top-scoring area.

`development_suggestion` already exists — serves as the development commentary.

Both fields are auto-save textareas in the library entity forms (factor, construct, dimension edit pages).

Migration 00056 adds the column. Migration 00057 seeds content for all 4 dimensions, 8 factors, and 5 constructs.

### Runner Changes

**Strengths Highlights resolution:**
- Ranks entities by POMP score descending
- Takes top N
- Returns `{ entityName, pompScore, bandResult, strengthCommentary }` per entity
- `strengthCommentary` pulled directly from entity library record

**Development Plan resolution:**
- Ranks entities by POMP score ascending (if `prioritiseByScore`)
- Takes bottom N (or filtered by `entityIds`)
- Returns `{ entityName, pompScore, bandResult, developmentSuggestion }` per entity
- `developmentSuggestion` pulled directly from entity library record

**AI Text resolution:**
- Looks up prompt template by `promptId` from `ai_system_prompts`
- Looks up model config for that prompt's purpose from `ai_model_configs`
- Assembles data context: all scores, bands, entity definitions, commentary, participant info
- Calls the configured model via OpenRouter
- Returns `{ generatedText, promptName, model }`
- Falls back gracefully — returns error message as text, doesn't fail the snapshot

**Score Overview / Score Detail:**
- No fundamental changes to resolution logic
- `chartType` sourced from block-level field only — duplicate inside config removed

### Sample Data Generator

`sample-data.ts` updated to respect block config:
- `topN` on strengths → generate matching count of sample highlights
- `maxItems` on development → generate matching count
- `entityIds` filter → only include selected entities
- `displayLevel` → generate appropriate entity names
- AI Text → placeholder: "AI-generated narrative will appear here when the report is generated"
- Sample entities include `strengthCommentary` and `developmentSuggestion`

### Prompt Library Integration

AI Text block's `promptId` dropdown populated from `ai_system_prompts` table (report-related purposes).

Three starter prompts already seeded (migration 00051):
- `report_narrative`
- `report_strengths_analysis`
- `report_development_advice`

Each prompt gets its own model config entry. Settings page manages prompts — creating a new one automatically adds it to the AI Text dropdown.

---

## Rendering Fixes

### Cover Page
- Reduce vertical size — proportional padding, not full-viewport
- Remove subtitle field — assessment name from session data
- Simplify logo: single `showLogo` toggle, brand config determines which logos

### Section Divider
- New component with four style variants
- No mode wrapper — renders directly
- No text content

### Strengths Highlights
- Remove `supportedCharts` from registry
- Remove `style` config — mode handles layout
- Render: entity name + strength commentary. No scores, no charts.
- Remove `aiNarrative` toggle

### Development Plan
- Remove `aiNarrative` toggle
- Render: entity name + development suggestion

### Score Overview
- Single `chartType` at block level
- `radar_360` only shown for 360 templates
- Remove dot indicators on bar charts — clean filled bars

### Score Detail
- `showChildBreakdown` renamed to `showNestedScores`
- Child entities grouped under parent with proper indentation
- Segment bar option for per-entity visualisation

### AI Text (New)
- Renders generated text as formatted content
- Preview mode: placeholder text
- Subtle "AI-generated" attribution badge

### Presentation Modes
- All five remain: featured, open, carded, split, inset
- Cover page: always featured
- Section divider: no mode wrapper
- All others: user-selectable from supported modes

---

## Key Files

| File | Changes |
|------|---------|
| `src/lib/reports/registry.ts` | Updated block registry — new AI Text type, removed phantom charts from strengths/development, corrected configs |
| `src/lib/reports/types.ts` | New `AiTextConfig`, updated block config interfaces, removed `aiNarrative` from strengths/development |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx` | Full rebuild — expand-in-place layout, tab system, add block dropdown |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-config-panels.tsx` | Per-block content tab panels |
| `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx` | Pass template settings |
| `src/lib/reports/runner.ts` | Strengths uses strengthCommentary, development uses developmentSuggestion, new AI Text resolution |
| `src/lib/reports/sample-data.ts` | Respect block config for preview |
| `src/components/reports/blocks/strengths-highlights.tsx` | Render commentary, remove chart/AI |
| `src/components/reports/blocks/development-plan.tsx` | Render suggestion, remove AI toggle |
| `src/components/reports/blocks/ai-text.tsx` | New component |
| `src/components/reports/blocks/section-divider.tsx` | Four style variants |
| `src/components/reports/blocks/cover-page.tsx` | Tighter sizing, simplified config |
| `src/app/actions/reports.ts` | Remove autoRelease from template settings |
| `src/types/database.ts` | `strengthCommentary` on Dimension, Factor, Construct |
| `src/lib/supabase/mappers.ts` | Map `strength_commentary` |
| `src/app/actions/factors.ts` | Allow auto-save of strengthCommentary, developmentSuggestion |
| `src/app/actions/constructs.ts` | Allow auto-save of strengthCommentary, developmentSuggestion |
| `src/app/actions/dimensions.ts` | Allow auto-save of strengthCommentary, developmentSuggestion |
| `src/app/(dashboard)/factors/factor-form.tsx` | Add strengthCommentary, developmentSuggestion textareas |
| `src/app/(dashboard)/constructs/construct-form.tsx` | Add strengthCommentary, developmentSuggestion textareas |
| `src/app/(dashboard)/dimensions/dimension-form.tsx` | Add strengthCommentary, developmentSuggestion textareas |
| `supabase/migrations/00056_add_strength_commentary.sql` | Add column (done) |
| `supabase/migrations/00057_seed_commentary_data.sql` | Seed content (done) |
