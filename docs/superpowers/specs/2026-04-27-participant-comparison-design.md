# Participant Comparison — Design Spec

**Date:** 2026-04-27
**Status:** Draft
**Scope:** Admin, Partner, and Client portals

## Problem

A coach or admin can view one participant's session results today, but there is no way to put several participants side-by-side. Real coaching, hiring, and developmental decisions are comparative: "How does Sarah's resilience compare to Marcus's?", "Has Sarah moved on Drive between February and April?", "Among these eight finalists, who scores highest on Influence?"

There is also no bulk export of scored results — the existing results pages stop at the per-session detail. The spec at `2026-04-10-results-viewing-design.md` explicitly listed CSV export of scores as out of scope and deferred it; this work picks that up.

## Goal

Enable a user to:

1. Select participants from either a campaign's participants list or the global participants list.
2. Pick the assessment(s) to compare on.
3. View a matrix of those participants × the assessment's scored items, with a heatmap colour band per cell consistent with the platform's report band scheme.
4. Switch between Dimensions (rollups) and Factors/Constructs (granular) views.
5. Compare a participant against themselves across timepoints by adding the same person more than once and choosing different sessions per row.
6. Export the matrix as CSV for downstream work.

## Non-goals

- PDF or Excel export. CSV only for v1.
- New analytics, cohort statistics (mean/SD/N), or filtering of matrix rows after selection.
- Saved/named comparisons. Selection state is encoded in the URL and can be bookmarked.
- Score interpretation pop-overs, percentile/band-label chips inside cells. Heatmap colour conveys magnitude.
- New or modified scoring rules. The comparison view consumes existing scoring.
- Schema changes. Every required field already exists.

## Concept

The comparison view is a **workspace**, not a tab. It is reached as an action from existing participant lists and lives at its own route per portal. Selection state lives in the URL.

A row in the matrix is one **comparison entry** — a participant plus a chosen session per assessment. Adding the same participant twice creates two entries; this is how compare-against-self works. Each row carries the participant name, the session date(s), and the attempt number, in distinct columns (one piece of data per cell, so CSV export round-trips cleanly).

Columns are organised in groups, one per assessment. Each group leads with a bold rollup column (the dimension or factor), then its children. A toggle at the top swaps the level of the children: Dimensions only, or the canonical scored unit per assessment (factors for factor-level assessments, constructs for construct-level assessments).

Cell colour comes from the existing band scheme — the same scheme that drives report rendering — so a "high" cell here matches a "high" band in the participant's report.

## Entry points

The feature is triggered as a bulk action from existing participant lists. **No new tab on the campaign.**

| Surface | List | Action button | Route |
|---|---|---|---|
| Admin | `/campaigns/[id]/participants` | "Compare selected" | `/campaigns/[id]/compare?ids=...` |
| Admin | `/participants` (Participants view, deduped) | "Compare selected" | `/participants/compare?ids=...` |
| Admin | `/participants` (Sessions view) | "Compare selected" | `/participants/compare?ids=...` |
| Partner | `/partner/campaigns/[id]/participants` | "Compare selected" | `/partner/campaigns/[id]/compare?ids=...` |
| Partner | `/partner/participants` (if present) | "Compare selected" | `/partner/participants/compare?ids=...` |
| Client | `/client/campaigns/[id]/participants` | "Compare selected" | `/client/campaigns/[id]/compare?ids=...` |
| Client | `/client/participants` (if present) | "Compare selected" | `/client/participants/compare?ids=...` |

The "Compare selected" button is an additional bulk action on the existing DataTable selection bar (per `2026-04-14-table-multi-select-and-width-design.md`). It is enabled when at least one row is selected. Capability is gated by the same role check that already gates bulk actions on the participants list — anyone who can bulk-act on participants can compare them.

The campaign-scoped entry passes the `campaign_participants.id` values for the selected rows to the compare route. The global entry passes `campaign_participants.id` values from the most recent record per email (mirroring the link pattern from `2026-04-14-participants-sessions-views-design.md`).

## Workspace structure

A single full-page route. Three regions, top to bottom:

### Selection bar (sticky)

Three controls plus an export button.

- **Participants** — chip list of currently selected entries. Each chip shows the participant name and the row's date pill. A `+` opens an "Add participant" picker. An `x` removes the entry. Adding the same participant twice is allowed and produces a second entry.
- **Assessments** — multi-select dropdown sourced from the union of assessments any selected participant has at least one session for. Each option shows the assessment name and a small chip with the count of selected participants who have a completed session for it.
- **Granularity toggle** — `Dimensions ⇄ Factors / Constructs`. Default is Dimensions for the cross-campaign entry point and Factors/Constructs for the within-campaign entry point.
- **Export CSV** — disabled when the matrix is empty.

### Matrix

The heatmap. Left-locked columns: Participant, Date, Attempt #. Right of those, one column group per chosen assessment. Each group has a wide group header (the assessment name) above two rows of column headers: the rollup column is highlighted on the leading edge; its children follow. Child header text is rotated ~−55° so a wide assessment of 10–15 children stays compact horizontally.

Cells contain a single integer score (0–100, rounded). Background is coloured per the band scheme (see Band scheme integration). Empty cells are shown as an em dash and are exported as empty strings.

Sorting: click any column header (rollup or child) to sort the matrix by that score, descending then ascending. Sticky-left columns sort lexicographically.

### Per-row session switcher

Clicking the date cell on a row opens a popover listing all sessions belonging to that participant for any of the chosen assessments. Each option shows: assessment name, attempt number, started date, status. Selecting a different session updates that row's per-assessment session id and refetches the row's cells. Default for any row added is the most recent **completed** session per (participant, assessment).

### Empty / partial states

- Matrix has no rows → empty state with an "Add participants" CTA.
- A participant has no completed session for a chosen assessment → that assessment's cells render as em dashes for that row; the rollup is also dashed.
- A participant has only in-progress sessions for a chosen assessment → still rendered as dashes, with a small "in progress" annotation on the date cell.

## Data layer

No schema changes. The existing tables already cover everything: `campaign_participants`, `participant_sessions`, `participant_scores`, `factors`, `constructs`, `dimensions`, `factor_constructs`, `dimension_constructs`, `assessment_factors`, `assessment_constructs`, and the `assessments.scoring_level` discriminator from `2026-04-16-flexible-taxonomy-hierarchy-design.md`.

### New server actions in `src/app/actions/comparison.ts`

```ts
type EntryRequest = {
  campaignParticipantId: string
  // sessionIdsByAssessment optional; missing keys resolve to most-recent-completed
  sessionIdsByAssessment?: Record<string /* assessmentId */, string /* sessionId */>
}

type ComparisonRequest = {
  entries: EntryRequest[]
  assessmentIds: string[]
  granularity: 'dimensions' | 'factors_or_constructs'
}

type ColumnGroup = {
  assessmentId: string
  assessmentName: string
  // rollup is the level the toggle is *not* set to children of, i.e. dimensions
  // when granularity = 'factors_or_constructs', and factors/constructs when
  // granularity = 'dimensions' (in which case rollups *are* the only columns).
  rollup: { id: string, name: string, level: 'dimension' | 'factor' }[]
  children: { id: string, name: string, parentId: string }[]
}

type ComparisonRow = {
  entryId: string                       // stable per (campaignParticipantId, sessionPickPerAssessment)
  campaignParticipantId: string
  participantName: string
  participantEmail: string
  perAssessment: Array<{
    assessmentId: string
    sessionId: string | null
    sessionStartedAt: string | null
    sessionStatus: string | null
    attemptNumber: number | null
    cells: Record<string /* columnId, both rollup and child */, number | null>
  }>
}

type ComparisonResult = {
  columns: ColumnGroup[]
  rows: ComparisonRow[]
}

async function getComparisonMatrix(req: ComparisonRequest): Promise<ComparisonResult>
```

- Authorization: the action calls `requireParticipantAccess(campaignParticipantId)` for every entry and `requireSessionAccess(sessionId)` for every explicitly-passed session. If any check fails, the entire request is rejected.
- Most-recent-completed resolution: per (`campaignParticipantId`, `assessmentId`), pick the `participant_sessions` row with `status = 'completed'` ordered by `completed_at desc`. If none exists, return null session id and dashed cells.
- Attempt number: derived using the same ordinal logic as the existing `getParticipantSessions` action (rank by `started_at` ascending within `(campaign_participant_id, assessment_id)`).

### Picker queries

- `getEligibleAssessmentsForParticipants(campaignParticipantIds: string[])` — returns the union of assessments any of those participants has a session for, with per-assessment "completed-session count" for the chip badges. Lives in `comparison.ts`.
- `getSessionOptionsForRow(campaignParticipantId: string, assessmentIds: string[])` — returns all sessions for the row's session-picker popover, with assessment name, attempt number, started date, status.

### Rollup computation in `src/lib/comparison/rollup-scores.ts`

A weighted average over child scores using the same weights already applied in the existing scoring pipeline (per `2026-04-16-flexible-taxonomy-hierarchy-design.md`):

- For factor-level assessments, dimension scores are the weighted average of factor scores under the dimension; the factor scores come straight from `participant_scores`.
- For construct-level assessments, dimension scores are the weighted average of construct scores under the dimension; factors are not in play.

If any child score is missing, the rollup is null. Computation is server-side and not stored. The library lives in `src/lib/comparison/` so it can be unit-tested without a DB round-trip.

## Band scheme integration

Cell colour is resolved through the existing band scheme cascade from `2026-04-16-custom-band-schemes-design.md`. Because there is no report template in the comparison context, the cascade is **partner → platform** only:

```ts
const scheme = resolveBandScheme(/* template */ null, partner, platform)
```

For admin viewers there is no partner context, so the cascade reduces to platform. For partner-portal viewers, the partner scheme is used. For client-portal viewers, the partner that owns the client provides the scheme.

For each numeric cell, the band is determined by finding the band whose `[min, max]` contains the score (POMP, 0–100). Colour comes from `getBandColour(scheme.palette, bandIndex, scheme.bands.length)` and is applied as an inline style on the `<td>`. Same colours appear in the corresponding report.

The malformed-scheme fallback in `resolveBandScheme` already logs and falls back to the default 3-band scheme; the comparison view inherits that behaviour with no additional handling.

A thin helper at `src/lib/comparison/resolve-bands.ts` wraps the resolver and the colour lookup so the matrix component receives a single `getCellStyle(score: number) => CSSProperties` function.

## CSV export

Server-side only. A new route handler at `src/app/api/comparison/export/route.ts` accepts a POST body identical to the `getComparisonMatrix` input and responds with `text/csv` and `Content-Disposition: attachment; filename="trajectas-comparison-{slug}-{YYYYMMDD}.csv"`. Pattern follows the existing CSV export at `src/app/(dashboard)/generate/[runId]/page.tsx:303` (Blob + Content-Type).

CSV format:

| Column | Source |
|---|---|
| Participant | `participantName` |
| Email | `participantEmail` |
| Date | `sessionStartedAt` formatted ISO date |
| Attempt # | `attemptNumber` |
| Assessment | `assessmentName` |
| Session Status | `sessionStatus` |
| `<rollup 1>` | rollup score for column group 1 |
| `<child 1.1>`, `<child 1.2>`, … | each child column for group 1 |
| `<rollup 2>`, `<child 2.1>`, … | next group |

Decisions:

- **Wide format, not long.** One row per `(participant, session)` pair per assessment — same shape the matrix shows on screen — with cells outside that row's assessment as empty strings. What you see is what you export.
- **Rollups + children both exported regardless of toggle.** The granularity toggle only affects what is *rendered*. Spreadsheets are good at hiding columns; people will pivot freely.
- **Numbers are integers (rounded).** Same precision as the heatmap. Blanks are empty strings (not `0`, not `—`).
- **Header row only.** No metadata banner, no totals row.
- **Email is included.** Not on screen, but expected in exports for VLOOKUP-style spreadsheet workflows.

`build-csv.ts` is a pure function over (`columns`, `rows`) → `string`. It must escape commas, quotes, and newlines per RFC 4180, and it's unit-tested against names containing each.

## Routes and components

```
src/app/(dashboard)/campaigns/[id]/compare/
  page.tsx                              server component: load campaign + initial entries from query
  loading.tsx                           shimmer skeleton matching layout

src/app/(dashboard)/participants/compare/
  page.tsx                              cross-campaign variant (admin)
  loading.tsx

src/app/partner/campaigns/[id]/compare/...        (mirror)
src/app/partner/participants/compare/...          (mirror, if global participants exists for partner)
src/app/client/campaigns/[id]/compare/...         (mirror)
src/app/client/participants/compare/...           (mirror, if global participants exists for client)

src/components/comparison/
  comparison-workspace.tsx              client: orchestrates state, owns selection
  comparison-selection-bar.tsx          client: chips + assessment picker + toggle + export button
  comparison-matrix.tsx                 client: renders table, sortable
  comparison-cell.tsx                   presentational: heat colour + value
  comparison-row-session-popover.tsx    client: session switcher per row
  add-participant-dialog.tsx            client: picker (campaign-scoped or cross)
  comparison-export-button.tsx          client: triggers CSV download

src/app/actions/comparison.ts           getComparisonMatrix, getEligibleAssessmentsForParticipants, getSessionOptionsForRow

src/app/api/comparison/export/route.ts  POST → text/csv

src/lib/comparison/
  resolve-bands.ts                      thin wrapper over resolveBandScheme + getBandColour
  build-csv.ts                          (rows, columns) → CSV string, RFC 4180 escaping
  rollup-scores.ts                      weighted-average rollup, missing-children handling
```

Boundaries:

- The page server component is the only place that calls authorization helpers. It dispatches `getComparisonMatrix` and renders the workspace.
- The workspace client component receives initial data and capability props (`canSeeResponses` is irrelevant here; the relevant prop is `entryContext: 'campaign' | 'cross-campaign'`, which controls the picker source).
- No client component fetches scores directly. CSV export is also server-side.
- The lib modules in `src/lib/comparison/` have no React, no Supabase client; they are unit-testable in isolation.

## State and URL

Selection state — entries, assessmentIds, granularity — lives in URL query params so a comparison is shareable and refresh-safe.

```
?entries=<base64url-encoded JSON of EntryRequest[]>
&assessments=<csv of assessmentIds>
&granularity=dimensions|factors_or_constructs
```

The workspace reads `useSearchParams`, calls the server action through a `useTransition`, and updates state via `router.replace` so the back button doesn't accumulate a history entry per change.

Encoding the `entries` array as a JSON blob (rather than separate query params per entry) keeps the URL within typical browser limits even when 20+ participants are selected and each carries explicit per-assessment session ids.

## Authorization

- Admin sees everything within their permission scope (existing platform rules).
- Partner sees only data within their assigned clients (existing scope resolution).
- Client sees only data within their own organization (existing scope resolution).
- Every participant id and session id passed into `getComparisonMatrix` is validated through the existing helpers (`requireParticipantAccess`, `requireSessionAccess`). Unauthorized ids reject the entire request.
- The cross-campaign entry point only surfaces participants the user can already see in the global participants list; the picker dialog's source query is the same authorized query that powers that list.

## Loading states

Per project UI standards in `CLAUDE.md`, every new route gets a `loading.tsx` with shimmer-animated skeletons matching the page layout: a sticky-bar skeleton, then a matrix skeleton with a few rows of placeholders. One file per portal route listed above.

## Testing

- Unit (in `tests/unit/`):
  - `rollup-scores`: weighted average, missing-children → null rollup, empty input → empty result, factor-level vs. construct-level assessments.
  - `build-csv`: RFC 4180 escaping for names with commas/quotes/newlines, blank cells as empty strings, header order matches matrix order, multi-assessment grouping.
  - `resolve-bands`: cascade correctness (partner → platform), malformed scheme fallback, score-to-band lookup including bounds.
- Integration (in `tests/integration/`, run with `npm run test:integration:local` per `AGENTS.md`):
  - `getComparisonMatrix` happy path, missing-completed-session per (participant, assessment), unauthorized participant id rejected, mixed factor-level + construct-level assessments in one request.
- Component (in `tests/components/`):
  - `comparison-matrix`: renders rollup + children, sort by column, empty state, in-progress annotation.

## Rollout

- Single feature branch. No flag — comparison view is additive and only reachable via explicit selection in existing tables.
- No DB migration.
- All portal mirrors (admin, partner, client) ship together so users do not see "Compare selected" on one surface but not another.
- Both light and dark mode supported (band colours come from `getBandColour`, which already accommodates both).

## Risks and known limits

- **Cross-campaign comparisons can mix sessions taken under different campaign-level brands or different assessment configurations.** The on-screen and CSV outputs intentionally show the assessment column so this is visible. We do not warn or filter; trust the operator.
- **Wide CSVs.** A 25-participant × 3-assessment × 12-children-per-assessment comparison produces 25 rows × ~45 columns. That's spreadsheet-friendly. Beyond ~10 assessments selected, the on-screen matrix becomes unwieldy; we don't enforce a hard cap in v1, but the assessment picker shows a soft visual cue once 5+ are selected.
- **Heat banding versus interpretation work.** The score-interpretation v2 spec (2026-04-17) is independent and may evolve band labels. Because the comparison view consumes `resolveBandScheme()` directly, any forward changes there propagate without changes here.
- **Same-participant duplicate-row UX.** Two rows for the same person rely on the date pill and attempt number to disambiguate. This is fine for ≤4 timepoints; if a person has 8+ attempts, the operator will need to be careful. Out of scope to optimize.

## Out of scope (deferred)

- PDF export of the matrix.
- Excel export (CSV opens cleanly in Excel anyway).
- Per-cell percentile chips, band labels, or interpretation tooltips.
- Saving named comparisons; comparison-as-a-resource.
- Cohort statistics: mean, SD, N by column.
- Filtering matrix rows after selection (e.g., "only show those above 70 on Influence").
- Score-trajectory lines or other visualisation modes beyond the heatmap matrix.
