# Results Viewing — Design Spec

**Status:** Draft
**Date:** 2026-04-10
**Scope:** Admin, Partner, and Client portals

## Problem

Today, launching an assessment via a campaign works end-to-end (invite, take, complete), but **viewing results is fragmented and incomplete**:

- The Campaign Results tab shows only completion stats and report snapshot metadata — no actual scores or responses.
- The admin participant detail page has Scores and Responses tabs, but they're split across rolled-up tabs rather than anchored to a specific session attempt.
- The partner and client participant detail pages are much thinner than admin — no Scores, Responses, or Reports views at all.
- Report generation happens automatically in the background with no UI feedback. Users don't know where to find generated reports or which template was used.
- A participant can have multiple sessions (even for the same assessment), but there's no UI that makes individual attempts addressable.
- Timestamps don't consistently use the user's local time, causing confusion.

## Goal

Make it possible, from admin, partner, and client portals, to:

1. Launch an assessment via a campaign (already works).
2. See participant-level results and session-level results, with drill-in from campaign → participant → session.
3. Generate reports on demand against chosen templates, and view/release/download generated snapshots.
4. See timestamps in the user's local time.

## Non-goals

- New analytics, benchmarking, or comparative charts.
- CSV/bulk export.
- Report template editing (templates are consumed, not edited).
- Changes to the assessment-taking flow.
- Platform-wide timezone migration (applied only in files we touch).

## Data model

No database changes are required. The existing tables already support everything:

```
Campaign (1) ──→ (N) CampaignParticipant
                        │
                        ├─ (N) ParticipantSession ──→ Assessment
                        │        │
                        │        ├─ (N) ParticipantResponse ──→ Item
                        │        │
                        │        └─ (N) ParticipantScore ──→ Factor
                        │
                        └─ (N) ReportSnapshot (one per session per audience type)
                             └─ renderedData: Block[]
```

**Key facts:**
- A `CampaignParticipant` is the invited person (email, status, one row per enrollment).
- A `ParticipantSession` is one attempt at one assessment. A participant can have **multiple sessions** against the same assessment within the same campaign.
- A `ReportSnapshot` is one generated report per session per audience type, using a chosen template.

## Concept: session as a first-class entity

A **session** becomes the canonical unit for "results of one attempt." It gets its own URL, its own detail page, and its own report snapshots. This cleanly solves the multi-attempt problem and keeps scores and responses naturally grouped with the attempt they belong to.

## Routes

| Route | Admin | Partner | Client |
|---|---|---|---|
| Campaign results hub | `/campaigns/[id]/results` (modified) | `/partner/campaigns/[id]/results` (new) | `/client/campaigns/[id]/results` (new) |
| Participant detail | `/participants/[id]` (modified) | `/partner/campaigns/[id]/participants/[pid]` (modified) | `/client/campaigns/[id]/participants/[pid]` (modified) |
| Session detail | `/participants/[id]/sessions/[sid]` (new) | `/partner/campaigns/[id]/participants/[pid]/sessions/[sid]` (new) | `/client/campaigns/[id]/participants/[pid]/sessions/[sid]` (new) |

The partner/client nesting under campaign matches existing patterns. Admin uses a flatter path consistent with its current structure.

## Shared components

New components in `src/components/results/`:

- `session-detail-view.tsx` — the session detail page body (scores + responses + reports tabs)
- `participant-detail-view.tsx` — refactored participant detail (Overview / Activity / Sessions / Reports tabs)
- `campaign-results-hub.tsx` — the campaign results hub with by-participant / by-session toggle
- `generate-report-dialog.tsx` — modal for picking a template and audience type
- `results-by-participant-table.tsx` — DataTable for the by-participant view
- `results-by-session-table.tsx` — DataTable for the by-session view
- `local-time.tsx` — client component for user-local timestamps

Each per-surface route is a thin server component that fetches data and renders the shared view, passing surface-specific props (`canSeeResponses`, `routePrefix`, etc.).

## Campaign Results tab (hub)

**Header:** Compact stat bar (Invited / Started / Completed / completion %).

**Primary content:** Segmented control toggle between two DataTable views.

**By participant (default):**
- Columns: Participant (avatar + name + email), Status, Sessions (e.g., "3/4 completed"), Last activity, Actions
- Row click → participant detail
- Search by name/email, filter by status
- Purpose: see results rolled up per invited person

**By session:**
- Columns: Participant, Assessment, Attempt (ordinal for multi-attempt), Status, Started, Completed, Duration, Scores (count chip), Actions
- Row click → session detail
- Each row = one attempt (participant can appear multiple times)
- Search by participant name, filter by assessment, filter by status
- Purpose: see individual attempts, including multi-attempts

**What we remove from the current Results tab:**
- Per-assessment breakdown card (duplicative — already in Assessments tab)
- Report snapshots list (duplicative — now lives on session detail)

## Participant detail page

**Header:**
- Back link → appropriate list (campaign participants tab or global participants list)
- Avatar + full name + email, status badge
- Client and campaign meta row

**Overview tab** (polished):
- Premium stat cards (ScrollReveal + TiltCard + icon glow, matching dashboard style):
  - Sessions total
  - Sessions completed
  - Total time (as text in description — fixes today's broken 0/1 numeric display)
  - Invited date
- Quick identity card: email, campaign, client, invited/started/completed dates
- "Most recent session" card with drill-in button

**Activity tab** (polished):
- Vertical timeline with colored event dots
  - invited = muted, started = primary, session_started = brand, session_completed = primary, completed = emerald
- Each event: icon + label + session title (if applicable) + `<LocalTime>`
- Subtle connecting line, `ScrollReveal` on each event, better spacing

**Sessions tab** (new):
- Table of all sessions for this participant
- Columns: Assessment, Attempt #, Status, Started, Completed, Duration, Scores (count), Actions
- Row click → session detail
- Sortable

**Reports tab** (kept, rolled up):
- All snapshots across all sessions for this participant
- Columns: Session (assessment + attempt), Template, Audience, Status, Generated, Actions (preview / release / download PDF)

**Tabs removed:**
- Scores (moved to session detail)
- Responses (moved to session detail, admin-only)

## Session detail page

**Header:**
- Back link → participant detail
- Breadcrumb: Campaign · Participant · Assessment
- Title: assessment name
- Meta row: participant name + email, started timestamp, completed timestamp, duration, status badge
- Primary button: **Generate Report**

**Stats strip** (4 mini cards):
- Status
- Duration (or "in progress")
- Factors scored (count)
- Response count

**Scores tab** (default, all surfaces):
- One card per factor
- Contents: factor name, item count, scoring method, horizontal bar (0–100), scaled score, percentile chip, confidence interval
- Sortable by factor name or score
- Empty state: "Scores will appear here when generated"

**Responses tab** (admin only — tab not rendered for partner/client):
- Grouped by assessment section (collapsible)
- Per item: stem text, chosen response value, response time in seconds
- Uses existing `getParticipantResponses(sessionId)` server action

**Reports tab** (all surfaces):
- List of snapshots for *this session only*
- Columns: Template, Audience, Status, Generated, Actions
- Actions: preview / release / download PDF / retry (if failed)
- Empty state: "No reports generated yet — use the Generate Report button above"

## Generate Report dialog

- Opened from the session detail header button
- Fields:
  - **Template** — dropdown of report templates (filtered to those compatible with the session's assessment, if such compatibility metadata exists; otherwise all templates)
  - **Audience type** — Participant / HR Manager / Consultant
  - **Narrative mode** — AI-enhanced / Derived (optional)
- Submit calls new server action `generateReportSnapshot({ sessionId, templateId, audienceType, narrativeMode })`
- Dialog closes, toast confirms, new snapshot appears in Reports tab in "pending" state
- The Reports tab polls or re-fetches to surface "ready" state (polling or a simple "refresh" button — implementation detail for the plan stage)

## Auto-generation removal

- Find all call sites of `queueSnapshotsForSession` (likely in session completion triggers)
- Replace with a no-op or remove the call entirely
- Underlying snapshot generation plumbing stays intact — it's still needed for on-demand generation
- Existing pending auto-generated snapshots in the database remain as harmless data

## Surface authorization (defense-in-depth)

- Shared components accept `canSeeResponses: boolean` prop
- The partner/client session detail **server components** do not call `getParticipantResponses` — the data is never loaded
- Shared components also guard on the prop so the tab isn't rendered
- Even if someone crafts a URL, they get no response data

## Timezone handling

- New `src/components/local-time.tsx` client component
- Signature: `<LocalTime iso={string} format="date" | "date-time" | "date-time-full" | "relative" />`
- Uses `Intl.DateTimeFormat` with `en-AU` locale and **no explicit `timeZone`** — this automatically uses the user's browser timezone
- Format variants:
  - `date` — "10 Apr 2026"
  - `date-time` — "10 Apr 2026, 2:45 pm"
  - `date-time-full` — "Friday, 10 April 2026 at 2:45 pm"
  - `relative` — "2h ago", "3d ago", falls back to `date` for older dates
- Hydration: server emits a placeholder (e.g., the ISO string truncated) inside a container with `suppressHydrationWarning`, client swaps on mount
- Applied in all files we touch in this work. Not a platform-wide migration.

## Server actions

**New:**
- `generateReportSnapshot({ sessionId, templateId, audienceType, narrativeMode })` in `src/app/actions/reports.ts` — creates a new `ReportSnapshot` row and triggers the existing generation pipeline

**Modified:**
- Add `getSessionDetail(sessionId)` in `src/app/actions/sessions.ts` (new file if it doesn't exist) — returns session + scores + (conditionally) responses + report snapshots for that session, with authorization scoping
- Existing `getParticipantSessions`, `getParticipantResponses`, `getReportSnapshotsForParticipant` stay as-is

## Authorization

- Admin sees everything
- Partner sees only data within their assigned clients (existing scope resolution)
- Client sees only data within their own organization (existing scope resolution)
- Responses are admin-only (partner and client never receive response data from server)

## Testing

- One integration test per shared component: `session-detail-view`, `participant-detail-view`, `campaign-results-hub`. Verify data renders, tabs switch, and surface-specific restrictions are honored.
- Unit test for `generateReportSnapshot` action: happy path, unauthorized, invalid input.
- Unit test for `LocalTime` component: formats correctly, handles invalid dates.
- No E2E tests in scope.

## Rollout

All changes ship together on one feature branch. No feature flags. Existing auto-generated snapshots remain in the database as harmless residue. No database migrations required.

## Out of scope (for future work)

- New analytics and benchmarking charts on the results hub
- CSV export of scores and responses
- Report template editor improvements
- `LocalTime` migration across non-results pages
- Lead-generation report flow (user mentioned as possible future use of auto-generation)
