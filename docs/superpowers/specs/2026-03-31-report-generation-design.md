# Report Generation System — Design Spec

**Date:** 2026-03-31
**Status:** Approved for implementation planning
**Author:** Jason Hunt (via brainstorming session)

---

## Context

The platform needs a report generation system that can produce high-quality, audience-appropriate reports from psychometric assessment data. Reports must support multiple audiences, multiple score hierarchy levels, web viewing and PDF export, and a hybrid narrative model (derived from taxonomy indicators + optional AI enhancement). The system must be modular enough to support iterative addition of new block types and report templates over time.

---

## Core Design Decisions

### 1. Config-Driven Block Engine
Report templates are stored as JSONB in the database. Each template is a named, ordered array of block configs. A TypeScript block registry maps block type keys to React components. This is the correct long-term architecture — no hardcoded templates, no separate PDF codebase.

### 2. One Template Per Audience (not one template with audience toggles)
Each template is built for a single audience. A campaign's report config maps each audience type to a specific template. This gives full independent control over what each audience sees — different block ordering, different display levels, different depth of information — without the complexity of a merged multi-audience template.

### 3. One Block Engine, Two Block Libraries
Self-report and 360 assessments share the same rendering infrastructure. Self-report reports draw from the shared + self-report block library. 360 reports draw from the shared + 360-specific library. The `score_detail` block has a "360 mode" (grouped bars by rater) but is the same component.

### 4. Web-First PDF
A single HTML/React report page serves both web and PDF. Puppeteer renders `?format=print` to PDF. Print CSS handles page breaks, margins, and suppressed interactivity. Every block is print-aware from day one. No separate PDF template.

### 5. Hybrid Narrative
Default mode: derived narrative assembled from taxonomy indicators + definitions (fast, zero cost, deterministic). Optional: consultant triggers AI enhancement on specific blocks or the whole report via OpenRouter. AI enhancement is a deliberate action, not automatic.

### 6. Release Gate
Reports are generated automatically when a session completes but held until explicitly released per audience. Templates can configure `autoReleaseAudiences` to bypass the gate for specific audiences (e.g. auto-release participant report, hold HR report for manual review).

---

## Data Model

### Score Resolution Clarification

`participant_scores.scaledScore` is the POMP value (0–100). Per the scoring pipeline comments: "Score transformed to the reporting scale (e.g. 0–100)". Band resolution uses `scaledScore` as the POMP input. Sten scores are derived on-the-fly from `norm_tables.sten_cutpoints` when a norm group is assigned to the session — if no norm table exists, sten display is unavailable and blocks configured to show sten fall back to displaying the POMP score. This on-the-fly derivation is acceptable for v1; a persisted `sten_score` column can be added later if performance warrants it.

---

### Taxonomy Additions (Dimension, Factor, Construct — same fields on all three)

| Field | Type | Purpose |
|---|---|---|
| `bandLabelLow` | `text?` | Human-readable label for low band. Null = global default ("Developing"). |
| `bandLabelMid` | `text?` | Human-readable label for mid band. Null = global default ("Effective"). |
| `bandLabelHigh` | `text?` | Human-readable label for high band. Null = global default ("Highly Effective"). |
| `pompThresholdLow` | `integer?` | Upper POMP boundary for "low" band. Null = global default (40). Future: overridden automatically by norm data. |
| `pompThresholdHigh` | `integer?` | Lower POMP boundary for "high" band. Null = global default (70). Same norm-override path. |
| `developmentSuggestion` | `text?` | All three levels receive this field in the database. In reports, it surfaces at the most granular level being displayed — construct text when showing construct-level, factor text when showing factor-level, dimension text when showing dimension-level. AI generates the field value when blank in hybrid mode. |

**Band threshold resolution hierarchy:**
1. **Norm-derived (future)** — when NormTable exists for this construct + norm group, sten/percentile cutpoints define bands automatically
2. **Entity override** — `pompThresholdLow/High` on the specific construct, factor, or dimension
3. **Global default** — stored in partner config. Default: low ≤ 40, high ≥ 71

**Indicator authoring standard:** Indicators must be written as complete sentences in third-person generic, e.g. "Individuals at this level tend to…". UI must show this as a hint/requirement when editing indicators.

### New Table: `report_templates`

Defines a reusable report layout for a single audience. Blocks stored as ordered JSONB array.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `partner_id` | `uuid?` | Null = platform-global |
| `name` | `text` | e.g. "Standard Individual", "Hiring Manager Brief" |
| `description` | `text?` | |
| `report_type` | `enum` | `self_report \| 360` |
| `display_level` | `enum` | `dimension \| factor \| construct` — default display level for score blocks |
| `group_by_dimension` | `boolean` | Whether score blocks group factors under dimension headings by default |
| `person_reference` | `enum` | `you \| first_name \| participant \| the_participant` — injected at render time |
| `auto_release` | `boolean` | If true, snapshot is released to its audience immediately on generation |
| `blocks` | `jsonb` | Ordered array of `BlockConfig` objects |
| `is_active` | `boolean` | |
| `deleted_at` | `timestamptz?` | Soft delete |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### New Table: `campaign_report_config`

Maps audience types to templates for a campaign. One row per campaign. Using a separate table (not JSONB on campaigns) to enable proper FK constraints and RLS.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `campaign_id` | `uuid FK UNIQUE` | References `campaigns`. One config per campaign. |
| `participant_template_id` | `uuid? FK` | References `report_templates`. Null = no participant report. |
| `hr_manager_template_id` | `uuid? FK` | References `report_templates`. Null = no HR manager report. |
| `consultant_template_id` | `uuid? FK` | References `report_templates`. Null = no consultant report. |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**RLS:** Partner admins and consultants can read/write configs for campaigns they own. No participant/client access.

### New Table: `report_snapshots`

A point-in-time render for one participant session + one audience template. Frozen at generation — immune to subsequent taxonomy edits.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `template_id` | `uuid FK` | References `report_templates` |
| `participant_session_id` | `uuid FK` | References `participant_sessions` |
| `audience_type` | `enum` | `participant \| hr_manager \| consultant` |
| `status` | `enum` | `pending \| generating \| ready \| released \| failed` |
| `narrative_mode` | `enum` | `derived \| ai_enhanced` |
| `rendered_data` | `jsonb` | Resolved block data frozen at generation time |
| `pdf_url` | `text?` | Supabase Storage path — populated async after HTML render |
| `released_at` | `timestamptz?` | Null = held at gate. Set to release. |
| `released_by` | `uuid?` | Profile ID of releasing consultant |
| `generated_at` | `timestamptz?` | |
| `error_message` | `text?` | Populated on failure |
| `campaign_id` | `uuid FK` | Denormalised from `participant_sessions → campaign_participants → campaigns` for performance and RLS clarity. |
| `released_at` | `timestamptz?` | Null = held at gate. Set to release. |
| `released_by` | `uuid?` | Profile ID of releasing consultant |
| `generated_at` | `timestamptz?` | |
| `error_message` | `text?` | Populated on failure |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Required for status transition audit trail. |

**RLS:**
- `participant` audience: row visible to the session owner on the assess surface when `released_at IS NOT NULL`
- `hr_manager` audience: row visible to org members on the client surface when `released_at IS NOT NULL`
- `consultant` audience: row visible to campaign owners on admin/partner surfaces when `status IN ('ready', 'released')`
- Insert/update: service role only (runner executes as service role)

### New AI Prompt Purpose

Add `report_narrative` to the `AIPromptPurpose` enum. Used for AI enhancement of derived narrative blocks.

### Language Cleanup

Audit and replace all instances of "candidate" with "participant" across the codebase, UI copy, database comments, and type definitions.

---

## BlockConfig Schema

Each entry in `report_templates.blocks`:

```typescript
interface BlockConfig {
  id: string              // Stable UUID — used for builder drag-drop identity
  type: BlockType         // Key into the block registry
  order: number           // Sort order within the template
  config: Record<string, unknown>  // Block-type-specific settings (see below)
  printBreakBefore?: boolean  // Force CSS page break before this block
  printHide?: boolean     // Hide in PDF output (interactive-only elements)
  screenHide?: boolean    // Hide on web (print-only footer, page numbers, etc.)
}
```

No `audiences` field — the template itself is the audience scope.

---

## Block Registry — v1

### Meta Blocks
| Type | Purpose | Key config |
|---|---|---|
| `cover_page` | Participant name, assessment title, date, partner branding | `showDate`, `showLogo`, `subtitle` |
| `custom_text` | Admin-authored freeform text (intros, disclaimers). Supports markdown. | `content`, `heading` |
| `section_divider` | Visual break with title and optional subtitle. Controls print pacing. | `title`, `subtitle` |

### Score Blocks (self-report + 360)
| Type | Purpose | Key config |
|---|---|---|
| `score_overview` | High-level snapshot across all factors/dimensions. Radar or horizontal bars. | `displayLevel`, `groupByDimension`, `showDimensionScore`, `chartType` (radar \| bars), `entityIds` |
| `score_detail` | One entity's score: bar, band label, definition, indicators, development suggestion. The main workhorse block — one per factor/dimension typically. | `displayLevel`, `entityId`, `showScore`, `showBandLabel`, `showDefinition`, `showIndicators`, `showDevelopment`, `showChildBreakdown` |
| `strengths_highlights` | Top N entities by score with hero visual treatment. | `topN`, `displayLevel`, `style` (cards \| list) |
| `norm_comparison` | Percentile/sten rank against a norm group. Condition-gated — only renders if norm data exists. | `normGroupId`, `displayType`, `entityIds` |
| `development_plan` | Aggregated development suggestions, prioritised by lowest score. | `maxItems`, `prioritiseByScore`, `entityIds` |

### Score Display Levels

`score_overview` and `score_detail` both support a `displayLevel` config:

- **`dimension`** — shows dimension roll-up score only. No factor detail. Best for executive summaries.
- **`factor`** — shows factor scores. Default. Can optionally group under dimension headings via `groupByDimension: true`.
- **`construct`** — shows individual construct scores within a factor. Most granular — usually consultant-only.

Factors with no parent dimension are always rendered outside any grouping (displayed flat in an "Other" section when `groupByDimension` is true, or inline when false).

### 360-Only Blocks
| Type | Purpose | Key config |
|---|---|---|
| `rater_comparison` | Grouped bars per factor: self vs manager vs peers vs direct reports | `entityIds`, `raterGroups[]` |
| `gap_analysis` | Blind spots (self high, others low) and hidden strengths (self low, others high) | `gapThreshold` (default 1/3 of scale), `showBlindSpots`, `showHiddenStrengths` |
| `open_comments` | Aggregated qualitative feedback from raters by factor. Anonymity floor: min 3 raters per group. | `minRatersForDisplay`, `groupByFactor` |

---

## Report Runner Pipeline

Executed per snapshot when triggered (on session completion for auto-release templates, or on demand):

1. **Fetch** — load template blocks JSONB + all required data in parallel (scores, taxonomy entities with indicators, norm data if available)
2. **Condition-check** — evaluate block conditions (e.g. `hasNormData`, `has360RaterData`) — silently skip blocks whose conditions aren't met
3. **Band resolution** — for each scored entity: norm-derived → entity override → global default → returns `{ band, bandLabel, pompScore }`
4. **Derived narrative** — for each text-bearing block: select `indicatorsLow/Mid/High` based on band, prepend `definition` as intro sentence, inject `person_reference` from template config
5. **AI enhance** (if `narrative_mode = ai_enhanced`) — pass derived text + `description` + scores to OpenRouter (`report_narrative` prompt). Runs per-block, async. Adds latency.
6. **Snapshot** — write resolved block data to `rendered_data` JSONB, set `status: ready`. Trigger Puppeteer PDF generation async.

---

## PDF Output

- Route: `/reports/[snapshotId]?format=print`
- Puppeteer renders this URL in headless Chrome → saves PDF to Supabase Storage → sets `pdf_url` on snapshot
- `?format=print` adds `data-print` to document root — Tailwind `print:` variants and `[data-print]` selectors control layout
- `@page { margin: 20mm }` in global CSS
- Every block component is responsible for its own print rules:
  - `break-inside-avoid` on score cards and narrative sections
  - `print:hidden` for interactive-only elements (tooltips, expand buttons)
  - `printBreakBefore: true` in block config injects `break-before-page` class

---

## Builder UI

### Template Library (`/settings/reports`)
- Grid of templates with name, block count, report type badge
- Actions: create from blank, clone existing template
- Three seeded templates shipped as migration seed data:
  1. **Standard Individual** — participant-facing, self-report, 8 blocks, factor-level
  2. **Hiring Manager Brief** — hr_manager, self-report, 5 blocks, scores + brief narrative only
  3. **360 Debrief** — participant + consultant, 360, 11 blocks, full rater breakdown

### Block Builder (`/settings/reports/[id]/builder`)
Three-panel layout:
- **Left panel:** Block palette (drag to add) grouped by category
- **Centre panel:** Canvas — ordered block list, drag to reorder, shows block name + key config summary
- **Right panel:** Config panel for selected block — block-specific toggles, `displayLevel`, `entityId`, print options
- **Top bar:** Template name, Preview button (renders against mock score data including print preview), Save button

---

## Release Gate & Report Flow

1. Participant completes session → scoring pipeline runs automatically → `participant_scores` populated
2. `report_snapshot` rows created (one per audience with a template assigned in campaign config) — status: `pending`
3. Runner generates each snapshot — status: `generating` → `ready`
4. If template has `auto_release: true` — status immediately → `released`, `released_at` set
5. Otherwise — consultant sees snapshot in admin/partner portal (preview mode), manually releases per audience
6. Released snapshots become visible to their audience in the appropriate portal
7. PDF generated async; download link appears when complete

### Snapshot Status
| Status | Visible to |
|---|---|
| `pending` | Nobody |
| `generating` | Nobody |
| `ready` | Consultant (preview only) |
| `released` | Intended audience + consultant |
| `failed` | Nobody — consultant sees error + retry option |

### Portal Routing
| Portal | Audience | Access rule |
|---|---|---|
| `assess.talentfit.com` | Participant | Token-authenticated, `released_at` must be set |
| `client.talentfit.com` | HR manager | Org-scoped, `released_at` must be set |
| `admin` / `partner.talentfit.com` | Consultant | Campaign-scoped, sees `ready` + `released` snapshots |

---

## Seeded Templates (v1)

Three templates shipped as Supabase migration seed data so the system is usable from day one:

**Standard Individual** (`self_report`, participant audience)
- Cover page → Custom text (intro) → Score overview (radar, factor-level) → Score detail ×4 → Strengths highlights → Development plan

**Hiring Manager Brief** (`self_report`, hr_manager audience)
- Cover page → Score overview (bars, factor-level) → Score detail ×4 (scores + band labels only, no indicators) → Custom text (disclaimer)

**360 Debrief** (`360`, participant + separate consultant copy)
- Cover page → Custom text (confidentiality notice) → Score overview → Rater comparison → Gap analysis → Score detail ×4 (with indicators) → Open comments → Development plan

---

## Out of Scope for v1

- Norm-derived band thresholds (architecture supports it, implementation deferred until calibration data exists)
- Report versioning / diff between re-generates
- Scheduled/batch report generation
- Participant comparison views (side-by-side across a cohort)
- Custom branding per report (uses partner-level branding from existing brand system)
- Diagnostic 360 session reports (separate from assessment 360 — not yet built)
