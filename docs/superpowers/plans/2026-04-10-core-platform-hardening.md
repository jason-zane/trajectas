# Core Platform Hardening Implementation Plan

> **For agentic workers:** This is a **scoping + roadmap** document, not a single-feature execution plan. It catalogues the work required to take the Trajectas core flow from "functional" to "bulletproof", organized by the priority labels agreed with the product owner. Phases can be executed in order; individual tasks within a phase are largely independent and can be parallelised.
>
> When picking up a phase, use **superpowers:executing-plans** for inline work or **superpowers:subagent-driven-development** for task-per-subagent dispatch. Each task lists files to touch, the exact fix, and an effort estimate. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin-side assessment → campaign → candidate → report flow bulletproof, fast, and self-serviceable at every user tier (admin → partner → client), starting from correctness/security and working outward.

**Architecture:** Phased work ordered by the product owner's P0–P5 priority. P0 (security / data integrity) and P1 (hot-path performance) are quick low-risk wins that unblock everything else. P2 closes gaps in the admin-side flow. P3 and P4 extend the same capabilities down to partners and clients. P5 adds a quick-launch wizard that composes the existing flow into a 3-step modal.

**Tech Stack:** Next.js 15 App Router · Supabase (Postgres + Storage + RLS) · TypeScript · Tailwind · shadcn/ui · sonner toasts · React Server Components · Puppeteer-core + @sparticuz/chromium for PDF rendering · @dnd-kit for drag-and-drop.

---

## Priority labels

| Label | Scope | Rationale |
|---|---|---|
| **P0** | Security & data integrity | Must fix before anything else ships. Covers data leaks, silent failures, missing auth guards. |
| **P1** | Hot-path performance | Parallelize sequential queries, fix N+1s, add missing loading states. All low-risk refactors. |
| **P2** | Admin panel: full assessment → campaign → candidate → report flow | Make every step of the core admin flow polished, self-explanatory, and production-grade. |
| **P3** | Partner self-service | Unlock partner-scoped assessments, partner-created clients, feature parity with admin. |
| **P4** | Client self-service | Same parity work, one tier further down. |
| **P5** | Quick launch wizard | Compose the existing flow into a 3-step modal. Extend to partner + client portals. |

## Explicitly out of scope (deferred)

- **360 assessment support** — hide from builder registry and condition evaluators. Block components remain in the codebase for later. See P2.1.
- **Diagnostics + matching features** — partner/client routes already exist but these are not a priority. Do not extend, do not polish.
- **Norm comparison block** — deferred alongside a future norm-groups data pipeline. Hide from builder registry in P2.1.
- **Report template approval workflow, report version history, scheduled report generation** — long tail.
- **Bundle-size refactor of `/generate/new`** (currently a 1,887-line client component) — low urgency, high effort, not in the core flow.

## Cross-cutting rules (from CLAUDE.md)

- All CRUD operations emit a `sonner` toast. Success = green, error = red (persistent), delete = toast with 5s undo action.
- Every new route gets a `loading.tsx` matching its layout structure. Use `animate-shimmer`, not `animate-pulse`.
- Every change must look correct in both light and dark mode.
- No raw hex/oklch values in components — use CSS variables or Tailwind utilities only.
- Interactive cards wrap in `<TiltCard>` + `<ScrollReveal delay={index * 60}>`, use `variant="interactive"`.
- Text-area fields on Zone 2 pages may auto-save via `useAutoSave`; structural controls do not.
- `ConfirmDialog` → soft-delete (`deleted_at`) → toast with undo → redirect after timeout. Never hard-delete from UI.

## Root audit sources

This plan synthesises findings from four parallel audits run 2026-04-10 (stored in `/private/tmp/claude-501/-Users-jasonhunt-projects-trajectas/.../tasks/`):

- Admin assessment + campaign + invite flow
- Results viewing + report building + PDF generation
- Partner & client portal flows
- Performance across hot paths (RSC, queries, indexes, bundle)

---

## P0 — Security & Data Integrity

**Objective:** No data leaks, no silent failures, no missing auth guards. Everything in P0 is a correctness bug — users are being misled or data is exposed.

**Estimated total effort:** ~1 day (6–8 hours)

### P0.1 — Client report page leaks private Supabase storage path

**Problem:** The client-facing report page renders the private bucket path directly in an `<a href>`, so the URL is visible in DOM and browser history.

**Files:**
- Modify: `src/app/client/reports/[snapshotId]/page.tsx:28`
- Reference: `src/app/api/reports/[snapshotId]/pdf/route.ts` (existing signed route)

**Fix:**
- Replace the direct `<a href={snapshot.pdfUrl}>` with a link to `/api/reports/{snapshotId}/pdf?token={participantToken}`.
- The API route already handles participant-token verification (`pdf-token.ts::createReportPdfToken`) — reuse it.

**Steps:**
- [ ] Read `src/app/api/reports/[snapshotId]/pdf/route.ts` to confirm the token verification path
- [ ] Replace the href in the client report page with the signed API endpoint
- [ ] Test: participant with token can download; participant without token gets 401
- [ ] Commit

**Effort:** 30 min

---

### P0.2 — Partner + client campaign detail pages missing scope guard

**Problem:** Campaign detail pages in the partner and client portals call `getCampaignById(id)` but never validate that the caller has access to that campaign. `getCampaignById()` itself doesn't enforce scope — it just fetches. A partner could guess a campaign UUID from another partner and render the detail page.

**Files:**
- Modify: `src/app/partner/campaigns/[id]/page.tsx` (entry)
- Modify: `src/app/client/campaigns/[id]/page.tsx` (entry)
- Reference: `src/lib/auth/authorization.ts::requireCampaignAccess` (already exists, line 469–499)

**Fix:**
- At the top of each detail page, after resolving the campaign, call `requireCampaignAccess(campaign.id)` before rendering anything.
- This will throw/redirect if the caller is not in the campaign's client scope or partner scope.
- Do the same on sub-pages: `/partner/campaigns/[id]/assessments`, `/partner/campaigns/[id]/participants`, `/client/campaigns/[id]/assessments`, `/client/campaigns/[id]/participants`.

**Steps:**
- [ ] Audit all `partner/campaigns/[id]/**` and `client/campaigns/[id]/**` `page.tsx` files
- [ ] Add `await requireCampaignAccess(id)` near the top of each
- [ ] Write a test (or manual check) confirming another partner's campaign URL returns 403/redirect
- [ ] Commit

**Effort:** 1 hour

---

### P0.3 — Silent email failures in `inviteParticipant`

**Problem:** `inviteParticipant` wraps the SMTP send in a try/catch that logs to console and returns success regardless. The participant row is marked `invited` even if the email never left. Admin has no idea some invites failed.

**Files:**
- Modify: `src/app/actions/campaigns.ts:793+` (single invite path)
- Modify: `src/app/actions/campaigns.ts:750-759` (bulk invite loop)
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` (UI that surfaces the result)

**Fix:**
- Change the return shape to `{ success: true, emailSent: boolean, emailError?: string }` (or an array for bulk).
- If SMTP fails, still create the participant row (so the admin can retry), but return `emailSent: false` with the error message.
- UI: render participants with `emailSent === false` with a yellow badge "Email failed" and a "Retry" button that calls `sendParticipantInviteEmail()` on demand.
- Use `toast.error("N emails failed to send")` after bulk invite if any failed.

**Steps:**
- [ ] Update the server action signature and return type
- [ ] Update the participant table row to show the `emailSent: false` state
- [ ] Add a "Retry email" row action
- [ ] Add toast feedback after bulk invite showing success/failure counts
- [ ] Test: force an SMTP error, confirm participant is created, UI shows "Email failed", retry works
- [ ] Commit

**Effort:** 2 hours

---

### P0.4 — Bulk invite silently drops duplicates

**Problem:** `bulkInviteParticipants` uses `.upsert(..., ignoreDuplicates: true)` which means duplicates in the uploaded CSV are silently discarded. Admin uploads 50 emails, sees "success", has no idea whether it was 50 new, 0 new, or 25/25.

**Files:**
- Modify: `src/app/actions/campaigns.ts:743` (the `.upsert` call)
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` (the toast + UI)

**Fix:**
- Before insert: fetch existing `(campaign_id, email)` pairs. Split the incoming list into `new` vs `existing`.
- Insert only the `new` set. Do not upsert.
- Return `{ inserted: number, skipped: number, errors: Array<{ row: number, message: string }> }`.
- UI toast: "20 participants invited, 5 already existed, 1 invalid email". Show a dialog with the errors array if `errors.length > 0`.

**Note:** The P1.5 migration (already shipped) removed the `UNIQUE (campaign_id, email)` constraint at the DB level, so duplicates within a campaign are now legal. The "duplicate" concept here is advisory — ask the admin whether they intended to re-invite the same person. Add a confirmation dialog: "5 emails already exist in this campaign. Create retake invites for them as well?".

**Steps:**
- [ ] Update `bulkInviteParticipants` to return detailed result
- [ ] Add the confirmation dialog for already-present emails (retake flow)
- [ ] Update the toast to show inserted/skipped/error counts
- [ ] Test with: 10 new, 5 duplicates, 1 invalid email — confirm all three paths work
- [ ] Commit

**Effort:** 2 hours

---

### P0.5 — Missing `error.tsx` on report + template + results routes

**Problem:** Unhandled errors on these routes render a blank white page instead of an error boundary.

**Files (all new):**
- Create: `src/app/(dashboard)/reports/error.tsx`
- Create: `src/app/(dashboard)/reports/[snapshotId]/error.tsx`
- Create: `src/app/(dashboard)/report-templates/error.tsx`
- Create: `src/app/(dashboard)/report-templates/[id]/builder/error.tsx`
- Create: `src/app/(dashboard)/campaigns/[id]/results/error.tsx`

**Fix:**
- Each `error.tsx` renders a `Card variant="interactive"` with the error heading, a short description, and a "Try again" button calling `reset()`.
- Use the existing `PageHeader` + `Card` components to match the rest of the platform's premium feel (CLAUDE.md).
- Log the error to the console for debugging and to Sentry (if wired).

**Steps:**
- [ ] Create a shared `<ErrorBoundaryCard>` component under `src/components/errors/error-boundary-card.tsx` to avoid duplication
- [ ] Wire it up in each `error.tsx` file
- [ ] Test by deliberately throwing in each route
- [ ] Commit

**Effort:** 1 hour

---

### P0.6 — `getAllReadySnapshots` hardcoded `limit(200)`

**Problem:** The reports list globally caps at 200 snapshots. Snapshots older than the 200th simply disappear from the UI. There's no pagination.

**Files:**
- Modify: `src/app/actions/reports.ts:488` (`getAllReadySnapshots`)
- Modify: `src/app/(dashboard)/reports/page.tsx` (consumer)

**Fix:**
- Replace the hardcoded limit with a cursor-based pagination parameter: `{ cursor?: string, limit?: number }`.
- Default limit = 50. Return `{ snapshots, nextCursor }`.
- Update the reports page to use a `DataTable` with server-side pagination (this project already has DataTable infrastructure — see partner/client polish commit `0c4a1ed`).

**Steps:**
- [ ] Update the action signature and return type
- [ ] Add cursor handling (order by `created_at desc`, cursor = last row's created_at)
- [ ] Swap the page into a server-paginated DataTable
- [ ] Test with 300+ snapshots (seed if necessary)
- [ ] Commit

**Effort:** 2 hours

---

## P1 — Hot-Path Performance

**Objective:** Eliminate sequential query waterfalls, N+1 patterns, and missing loading states on the pages admins hit most often.

**Estimated total effort:** ~1 day (6–8 hours)

**Expected impact after this phase:** ~500–800ms shaved off partner overview, client overview, campaign list, and campaign detail pages. Bulk invite for 100 participants goes from ~20s to ~4s.

### P1.1 — Parallelize `getPartnerStats`

**Problem:** 4 sequential queries for stats on every partner dashboard load. Queries 3, 4, 5 depend on the result of query 2 but are otherwise independent of each other.

**Files:**
- Modify: `src/app/actions/partners.ts:60-103`

**Fix:**
```typescript
const [clientsResult, membersResult] = await Promise.all([
  db.from('clients').select('id', { count: 'exact' }).eq('partner_id', partnerId).is('deleted_at', null),
  db.from('partner_memberships').select('*', { count: 'exact', head: true }).eq('partner_id', partnerId).is('revoked_at', null),
])

const clientIds = clientsResult.data?.map(c => c.id) ?? []

const [campaignResult, assessmentResult] = await Promise.all([
  clientIds.length > 0
    ? db.from('campaigns').select('*', { count: 'exact', head: true }).in('client_id', clientIds).eq('status', 'active')
    : Promise.resolve({ count: 0 }),
  clientIds.length > 0
    ? db.from('client_assessment_assignments').select('*', { count: 'exact', head: true }).in('client_id', clientIds)
    : Promise.resolve({ count: 0 }),
])
```

**Steps:**
- [ ] Refactor `getPartnerStats` as above
- [ ] Run the partner dashboard and verify visually identical output
- [ ] Commit

**Effort:** 1 hour

---

### P1.2 — Parallelize `getClientStats`

**Problem:** Same waterfall pattern as P1.1.

**Files:**
- Modify: `src/app/actions/clients.ts:169-216`

**Fix:** Same shape as P1.1 — parallelize campaigns, assessments, diagnostic sessions; conditionally fetch participant counts after campaign IDs are known.

**Steps:**
- [ ] Refactor `getClientStats`
- [ ] Verify client dashboard output unchanged
- [ ] Commit

**Effort:** 1 hour

---

### P1.3 — Fix `getCampaigns` N+1 for completed counts

**Problem:** First query fetches campaigns with aggregated `campaign_participants(count)`. A second query then fetches only `status='completed'` rows to build a completion map. The first aggregated count is thrown away.

**Files:**
- Modify: `src/app/actions/campaigns.ts:71-122`

**Fix options:**
1. Use a filtered count in a single PostgREST query — unfortunately Supabase JS client doesn't support `COUNT FILTER`, so:
2. Create a SQL view `campaign_with_counts` that computes both `participant_count` and `completed_count` server-side, and select from that instead.
3. Or keep two queries but run them in parallel via `Promise.all` (lowest risk).

**Recommendation:** Start with option 3 (parallel) as a quick win. Schedule option 2 as a follow-up if profiling shows it still matters.

**Steps:**
- [ ] Wrap the second query in `Promise.all` with the first
- [ ] Verify campaign list output unchanged
- [ ] Commit
- [ ] (Follow-up) Create a `campaigns_with_counts` view if still slow

**Effort:** 1 hour for the quick win; 2 hours more for the view.

---

### P1.4 — Parallelize `getCampaignById`

**Problem:** 3 sequential queries (assessments → participants → access links) after the initial campaign fetch.

**Files:**
- Modify: `src/app/actions/campaigns.ts:158-176`

**Fix:**
```typescript
const [assessmentRows, participantRows, linkRows] = await Promise.all([
  db.from('campaign_assessments').select(...).eq('campaign_id', id).order('display_order'),
  db.from('campaign_participants').select(...).eq('campaign_id', id).is('deleted_at', null).order('created_at'),
  db.from('campaign_access_links').select(...).eq('campaign_id', id).is('deleted_at', null).order('created_at'),
])
```

**Note:** Result is already wrapped in `React.cache()`, so within a single render tree the saving is zero. But on cold loads this shaves ~150ms.

**Steps:**
- [ ] Refactor as above
- [ ] Verify campaign detail page renders correctly
- [ ] Commit

**Effort:** 30 min

---

### P1.5 — Parallelize email sends in `bulkInviteParticipants`

**Problem:** The for-loop in `bulkInviteParticipants` calls `sendParticipantInviteEmail()` sequentially. 100 participants = 100 serial SMTP calls = ~20 seconds of UI freeze.

**Files:**
- Modify: `src/app/actions/campaigns.ts:750-759`

**Fix:**
- Use a concurrency-limited parallel map. Options:
  - Hand-rolled chunking: split into chunks of 5, await each chunk with `Promise.all`, move on.
  - Install `p-limit` (2 KB, no deps) — cleaner API.
- Capture results per email so P0.3's error surfacing still works.

```typescript
const CONCURRENCY = 5
const results: SendResult[] = []
for (let i = 0; i < participants.length; i += CONCURRENCY) {
  const chunk = participants.slice(i, i + CONCURRENCY)
  const chunkResults = await Promise.all(
    chunk.map(p => sendParticipantInviteEmail(p).then(
      () => ({ email: p.email, ok: true }),
      (err) => ({ email: p.email, ok: false, error: err.message }),
    ))
  )
  results.push(...chunkResults)
}
```

**Steps:**
- [ ] Implement chunked concurrency
- [ ] Wire results into the P0.3 return shape
- [ ] Test with a simulated 20-participant bulk invite
- [ ] Commit

**Effort:** 1 hour

**Note:** This task depends on P0.3 (unified return shape).

---

### P1.6 — Fix N+1 in `getReportSnapshotsForCampaign` (PDF URL per snapshot)

**Problem:** After fetching snapshots, the action does `snapshots.map(async (s) => ({ ...s, pdfUrl: await getSignedReportPdfUrl(s.id) }))`. The map is not awaited as a single `Promise.all`, so it creates a race and an N+1.

**Files:**
- Modify: `src/app/actions/reports.ts:332-337`

**Fix:**
```typescript
const snapshotsWithUrls = await Promise.all(
  snapshotRows.map(async (snapshot) => ({
    ...snapshot,
    pdfUrl: await getSignedReportPdfUrl(snapshot.id),
  }))
)
```

Or, better: don't sign URLs server-side at all. Pass snapshot IDs to the client and sign on demand when the user clicks "Download". This removes the whole N+1.

**Recommendation:** Do the defer-to-client fix. It's cleaner and eliminates unnecessary Supabase Storage calls for snapshots the user never downloads.

**Steps:**
- [ ] Remove the PDF URL resolution from `getReportSnapshotsForCampaign`
- [ ] Add a client-side `onDownload` handler that calls `getSignedReportPdfUrl(snapshotId)` on click
- [ ] Verify download still works
- [ ] Commit

**Effort:** 1 hour

---

### P1.7 — Add missing `loading.tsx` files

**Problem:** A handful of routes are missing skeleton states and feel slow on first load.

**Files (all new):**
- Create: `src/app/(dashboard)/campaigns/[id]/results/loading.tsx`
- Create: `src/app/partner/diagnostics/[id]/loading.tsx` (stub — diagnostics is deferred, but the route exists)
- Create: `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx`

**Fix:**
- Each `loading.tsx` renders a skeleton that matches the page layout (PageHeader placeholder, card grid placeholder, table rows).
- Use `animate-shimmer`, not `animate-pulse` (CLAUDE.md).

**Steps:**
- [ ] Create each `loading.tsx` with a layout-matching skeleton
- [ ] Commit

**Effort:** 1 hour

---

## P2 — Admin Panel: Assessment → Campaign → Candidate → Report Flow

**Objective:** Polish the end-to-end admin flow so that creating an assessment, attaching it to a campaign, inviting candidates, reviewing results, and generating reports is fast, obvious, and bulletproof.

**Estimated total effort:** 3–5 days

**Recommended execution order:**
1. Safety + expectation setting: P2.1, P2.2, P2.3
2. Mutation polish: P2.11, P2.12
3. Assessment selection + authoring ergonomics: P2.4, P2.5
4. Results visibility: P2.6
5. Async report generation UX: P2.8
6. Builder workflow improvements: P2.9, P2.10

### P2.1 — Hide 360-dependent blocks from builder registry

**Problem:** The report template builder exposes 4 blocks (`rater_comparison`, `gap_analysis`, `open_comments`, `norm_comparison`) that depend on pipelines not yet implemented. The blocks render empty or show placeholders. Admins will add them to templates and be confused when reports are blank.

**Files:**
- Modify: `src/lib/reports/registry.ts` — add `status: 'hidden' | 'deferred'` field per block
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx` — filter out hidden blocks from the "Add block" dropdown
- Modify: `src/lib/reports/runner.ts:316` — keep `has360Data` returning false, but also short-circuit block rendering before narrative/AI enhancement

**Fix:**
- Mark `rater_comparison`, `gap_analysis`, `open_comments`, `norm_comparison` with `status: 'deferred'`.
- Filter `registry.filter(b => b.status !== 'deferred')` when rendering the Add-block dropdown.
- On existing templates that already contain these blocks, render a yellow "Coming soon — hidden from participants" inline notice in the builder, and skip them entirely in the runner.

**Steps:**
- [x] Add `status` field to the registry entries
- [x] Filter the Add dropdown
- [x] Gate rendering in the runner + in the preview
- [x] Test: existing templates with these blocks still load without error
- [x] Commit

**Effort:** 2 hours

---

### P2.2 — Validate assessments at campaign creation, not activation

**Problem:** You can create a campaign, save it, invite 50 people — then hit "Activate" and get an error: "Campaign has no assessments". This is the wrong error boundary.

**Files:**
- Modify: `src/app/actions/campaigns.ts::createCampaign` and `::updateCampaign`
- Modify: `src/app/(dashboard)/campaigns/create/page.tsx` (form)

**Fix:**
- On campaign create: allow saving a draft without assessments, but show a persistent yellow warning banner on the campaign detail page ("This campaign has no assessments — participants will see nothing.").
- On campaign detail page, highlight the "Assessments" tab with a red dot if empty.
- Before activation, the existing validation in `activateCampaign` still catches it — but now the admin can't be surprised.

**Steps:**
- [x] Add the warning banner component to campaign overview page (admin + client)
- [x] Add the red-dot indicator to the Assessments tab
- [x] Commit

**Effort:** 2 hours

---

### P2.3 — Pre-activation confirmation modal

**Problem:** Clicking "Activate" on a campaign fires `activateCampaign()` immediately with no confirmation. This is a high-stakes action (sends emails to real people) with no review step.

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/overview/campaign-status-actions.tsx:17-22`

**Fix:**
- Wrap the activate action in a `<ConfirmDialog>` showing:
  - Campaign title
  - Number of assessments attached
  - Number of participants with pending invites
  - Opens at / closes at dates
  - Two buttons: "Activate campaign" / "Cancel"

**Implementation note:** activation currently changes campaign status only. It does not send invite emails, so the confirmation copy must stay accurate to that behavior.

**Steps:**
- [x] Fetch summary data at render time
- [x] Add the ConfirmDialog wrapper
- [x] Wire up the confirm action
- [ ] Test: click activate, confirm modal shows correct data, confirm button activates, cancel does nothing
- [x] Commit

**Effort:** 2 hours

---

### P2.4 — Enrich Add-Assessment dialog (factor count, duration, items) ⚠️ **DEFERRED**

**Problem:** The "Add Assessment" dialog on the campaign assessments page shows only the assessment title. Admins can't tell which assessment they're picking.

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx:104-138`
- Reference: `src/app/actions/assessments.ts::getWorkspaceAssessmentSummaries`

**Fix:**
- For each assessment in the dialog, show:
  - Title (existing)
  - Factor count badge
  - Section count + format type (Likert / Forced-choice / Mixed)
  - Item count
  - Estimated duration (items × seconds-per-item heuristic; 15s for Likert, 30s for SJT)
  - Status badge (draft / published)
- Filter out draft assessments by default, with a toggle to show them.

**Steps:**
- [ ] Extend the server action to return the enriched fields
- [ ] Update the dialog UI
- [ ] Test with 5+ assessments of mixed formats
- [ ] Commit

**Effort:** 3 hours

---

### P2.5 — Inline section title editing in `SectionConfigurator`

**Problem:** Section titles auto-fill with `"Self-Report Questionnaire"`, `"Situational Judgement"`, etc. (from `DEFAULT_TITLES` at `section-configurator.tsx:55-61`). Admins can't edit them without going into a separate edit mode. Participants see these defaults if unchanged.

**Files:**
- Modify: `src/app/(dashboard)/assessments/section-configurator.tsx`

**Fix:**
- Add an inline editable title field at the top of each section card in the configurator.
- Placeholder text = the default. Actual value = null until the admin types something. At save time, if the field is empty, persist `null` (not the default string).
- The runner already shows the assessment name instead of the section title when the section title is missing or is a known default (see completed work in review-screen.tsx).

**Note:** The review screen already treats these defaults as noise and hides them. This task is about giving admins a way to set meaningful titles for multi-section assessments.

**Steps:**
- [x] Add the editable title input to each section card
- [x] Wire it to the section state
- [x] On save, persist null when empty
- [x] Commit

**Effort:** 2 hours

---

### P2.6 — Campaign results page: show factor scores inline

**Problem:** The campaign results page today is a status dashboard — it shows completion funnel and snapshot status but no actual scores. Admins must drill into each participant's report preview to see scores.

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/results/page.tsx`
- New: `src/components/campaigns/participant-scores-table.tsx`
- Reference: `participant_scores` table (factor_id → scaled_score, already populated by scoring pipeline)

**Fix:**
- Add a "Participant scores" section to the results page showing a table:
  - Row per participant
  - Columns = factor names (from the attached assessment's factors)
  - Cell = scaled score + percentile band colour chip
  - Last column = "Open report" button linking to `/reports/{snapshotId}`
- Sort by most recent completion by default. Filter by assessment if multiple attached.
- Empty state: "No scores yet — participants haven't completed the assessment."

**Steps:**
- [x] Write the server action that fetches `participant_scores` joined with `campaign_participants` and factor metadata (`getCampaignFactorScores` in `src/app/actions/campaign-results.ts`)
- [x] Build the table component with column-per-factor (`ResultsFactorScoresTable`)
- [x] Add the band colour logic (with dark-mode variants)
- [x] Wire into the results page (admin, partner, client — partner fixed to use `/partner/reports/{id}`)
- [x] Commit

**Effort:** 5 hours

---

### P2.7 — Pagination on `/reports` list

**Covered in P0.6** — see that task. This is the same fix. Listed here so P2 is complete.

---

### P2.8 — PDF generation status polling ⚠️ **DEFERRED**

**Problem:** Clicking "Generate PDF" fires off a Puppeteer job that takes 5–15 seconds. During that time the UI shows nothing. Users assume it's broken and click again, causing duplicate generations.

**Files:**
- Modify: `src/app/api/reports/generate/route.ts` (return a job ID immediately)
- New: `src/app/api/reports/[snapshotId]/status/route.ts` (polling endpoint)
- Modify: the "Generate PDF" button in the reports page + report preview page

**Fix:**
- POST `/api/reports/generate` returns `{ jobId, status: 'queued' }` immediately and kicks off Puppeteer in a background task.
- GET `/api/reports/[snapshotId]/status` returns `{ status: 'queued' | 'generating' | 'ready' | 'failed', pdfUrl?, error? }` by reading `snapshot.status`.
- Client polls every 2s with exponential backoff, up to 60s total.
- UI shows "Generating report... ⟳" with a spinner during poll, then switches to "Download PDF" when ready.
- Guard against duplicate clicks: disable button while polling.

**Steps:**
- [ ] Split the generate endpoint into queue + background
- [ ] Add the status endpoint
- [ ] Add the polling hook (`useReportStatus`)
- [ ] Wire into the UI button
- [ ] Test: click generate, see spinner, PDF appears in <15s, duplicate click is blocked
- [ ] Commit

**Effort:** 4 hours

---

### P2.9 — Report template builder: live preview pane ⚠️ **DEFERRED**

**Problem:** The template builder is form-based. To see what a block looks like, users have to click "Preview" which opens a separate route. No live feedback while editing.

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/page.tsx`
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`
- Reference: `src/app/(dashboard)/report-templates/[id]/preview/page.tsx`

**Fix:**
- Replace the full-page builder layout with a split-pane:
  - Left pane: existing block list + editor
  - Right pane: live preview rendered inline, scrolling independently
- Preview uses the same sample data as the `/preview` route. Debounce re-renders on form change (500ms).
- On small screens, hide the preview and add a "Preview" floating button that opens a Sheet.

**Steps:**
- [ ] Extract the sample-data fetcher from the preview route
- [ ] Build the split-pane layout
- [ ] Wire the block editor state into the preview
- [ ] Add debounced re-render
- [ ] Mobile: collapse into Sheet
- [ ] Commit

**Effort:** 6 hours

---

### P2.10 — Report template builder: inline settings ⚠️ **DEFERRED**

**Problem:** Template-level settings (display level, person reference, logo) live in a Sheet modal that has to be opened separately. Builder state feels fragmented.

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx:266-328`

**Fix:**
- Move the settings out of the Sheet into a collapsible section at the top of the builder (collapsed by default, expands on click).
- Keep the existing form controls; just change the container.

**Steps:**
- [ ] Replace the Sheet with a Collapsible component
- [ ] Verify all settings still save correctly
- [ ] Commit

**Effort:** 1 hour

---

### P2.11 — Participant removal undo

**Problem:** `removeParticipant()` soft-deletes but shows no undo toast. CLAUDE.md requires delete operations to show a 5s undo action toast.

**Files:**
- Modify: `src/app/actions/campaigns.ts::removeParticipant` (should already set `deleted_at`)
- Modify: `src/app/actions/campaigns.ts::restoreParticipant` (new)
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` (the UI)

**Fix:**
- Add `restoreParticipant(id)` server action that clears `deleted_at`.
- After remove, call `toast.success("Participant removed", { action: { label: "Undo", onClick: () => restoreParticipant(id) }, duration: 5000 })`.

**Steps:**
- [x] Add `restoreParticipant` action
- [x] Update the remove handler to show undo toast
- [ ] Test: remove, click undo, participant reappears
- [x] Commit

**Effort:** 1 hour

---

### P2.12 — Bulk invite detailed result toast

**Covered in P0.4.** Listed here so P2's picture of the admin flow is complete.

---

## P3 — Partner Self-Service

**Objective:** Partners should be able to operate independently: create their own clients, build their own assessments, run campaigns end-to-end without admin intervention.

**Estimated total effort:** 3–5 days

### P3.1 — Partner-scoped assessment creation

**Problem:** Every assessment creation action calls `requireAdminScope()`. Partners cannot create assessments at all — they can only add existing (admin-owned) ones to campaigns.

**Files:**
- Modify: `src/app/actions/assessments.ts` (every mutation: `createAssessment`, `updateAssessment`, `persistSections`, `createAssessmentSection`, `updateAssessmentSection`, `createAssessmentBlock`, `updateAssessmentBlock`)
- New migration: add `partner_id` column to `assessments` table (nullable — null = platform-owned)
- Modify: `src/app/actions/assessments.ts::getWorkspaceAssessmentSummaries` — filter by caller's partner scope
- New: `src/app/partner/assessments/` route tree (list, create, edit)

**Fix:**
- Schema: `ALTER TABLE assessments ADD COLUMN partner_id UUID REFERENCES partners(id) ON DELETE CASCADE`. Add a CHECK constraint: `partner_id IS NULL OR created_by_role = 'partner'`.
- Add index: `CREATE INDEX assessments_partner_id_idx ON assessments(partner_id) WHERE deleted_at IS NULL`.
- RLS: add a policy so partners can only see/write assessments with their own `partner_id`. Admins see everything.
- Actions: replace `requireAdminScope()` with a new `requireAssessmentWriteAccess(partnerId?)` helper that accepts either platform admin or partner admin of the matching partner.
- Add the `/partner/assessments/**` route tree. Reuse existing components from `(dashboard)/assessments/**` — they should work with minimal changes if the scope is passed through.

**Steps:**
- [x] Write the migration (`20260411103000_partner_owned_assessments.sql`)
- [x] Add the new RLS policies (select_all + partner_admin_manage)
- [x] Replace `requireAdminScope()` calls with `requireAssessmentAccess` helper
- [x] Create the partner assessment route tree (`/partner/assessments/{create,[id]/edit}`)
- [x] Update `getWorkspaceAssessmentSummaries` filter logic
- [x] Add "Your assessments" vs "Platform assessments" tabs on the list page
- [ ] Test: partner can create assessment, cannot see other partners' assessments, admin sees all
- [x] Commit

**Effort:** 8 hours

---

### P3.2 — `/partner/clients/create` route

**Problem:** Partners can view their own clients but there's no route to create one. They must ask an admin.

**Files:**
- New: `src/app/partner/clients/create/page.tsx`
- Reference: `src/app/(dashboard)/clients/create/page.tsx` (admin version)
- Reference: `src/app/actions/clients.ts::createClient`

**Fix:**
- Copy the admin `create` page structure.
- Force `partner_id` to the calling partner's ID (hidden field).
- Update `createClient` action to accept partner scope.
- Add "New client" button on the partner clients page.

**Steps:**
- [x] Create the route + form (pre-existing from partner portal polish work)
- [x] Update the server action to accept partner scope
- [x] Add the CTA button on the list page
- [ ] Test: partner creates client, appears in their list, invisible to other partners
- [x] Commit

**Effort:** 3 hours

---

### P3.3 — Partner assessment builder parity

**Problem:** Assessment builder, section configurator, factor picker, and item selection rules are all admin-only components. Partners need the same tools.

**Files:**
- Modify: Component exports from `src/app/(dashboard)/assessments/**` to accept a `scope` prop
- New: `src/app/partner/assessments/[id]/build/page.tsx` (wrap the shared component)

**Fix:**
- Lift the assessment builder components out of `(dashboard)` into `src/components/assessments/` as reusable, scope-agnostic.
- Both admin and partner pages import the same components and pass their scope.

**Steps:**
- [ ] Move the shared components — **NOTE:** not lifted; partner tree imports `AssessmentBuilder` directly from `@/app/(dashboard)/assessments/assessment-builder`. Functional but architecturally deviates from plan. Defer lifting to future refactor.
- [x] Update imports in the admin tree (no changes needed — admin uses existing path)
- [x] Create the partner tree that reuses them
- [ ] Test: partner builds an assessment end-to-end
- [x] Commit

**Effort:** 6 hours

**Depends on:** P3.1

---

### P3.4 — Partner report template creation

**Problem:** Report templates are currently globally scoped or `partner_id`-scoped (the schema already has `partner_id`), but there's no partner UI for creating/editing templates.

**Files:**
- Reference: `src/app/(dashboard)/report-templates/**` (admin tree)
- New: `src/app/partner/report-templates/**`

**Fix:**
- Similar to P3.3: lift the shared builder components, create a partner route tree.
- Filter the list by the caller's `partner_id`.
- Enforce scope in `createReportTemplate`, `updateReportTemplate`, `deleteReportTemplate`.

**Steps:**
- [ ] Lift shared template builder components — same architectural note as P3.3: components imported from `(dashboard)` tree, not lifted.
- [x] Create partner routes (`/partner/report-templates/{,[id]/builder,[id]/preview}`)
- [x] Scope-enforce the actions (`requireReportTemplateAccess` replaces `requireAdminScope` in all template mutations)
- [ ] Test: partner creates a template, uses it on a campaign
- [x] Commit

**Effort:** 4 hours

---

### P3.5 — Scope audit: every partner mutation server action

**Problem:** The security audit found that some partner detail pages don't call `requireCampaignAccess()`. We should do a full sweep of every mutation action to confirm it either calls `requireAdminScope()` (admin-only) or an explicit partner scope check.

**Files:**
- Audit all files under `src/app/actions/**`
- Likely need to add: `requirePartnerAccess(partnerId)`, `requireClientAccess(clientId)` helpers if they don't already exist

**Fix:**
- Grep for `requireAdminScope()` in `src/app/actions/**` and classify each:
  - Platform admin only → leave as is
  - Should allow partner admin → add partner scope check
  - Should allow client admin → add client scope check
- Add a unit/integration test for each changed action confirming cross-tenant calls are denied.

**Steps:**
- [x] Produce the audit list (session and experience pages found to lack guards)
- [x] Update each action (`getCampaignSessions` + `client/campaigns/[id]/experience/page.tsx` now call `requireCampaignAccess`)
- [x] Add denial tests (`tests/integration/report-template-actions.test.ts`, `tests/integration/assessment-intro-actions.test.ts`, unit tests in `authorization-rules.test.ts`)
- [x] Commit

**Effort:** 4 hours

---

## P4 — Client Self-Service

**Objective:** Give clients the same end-to-end flow partners have — build (or choose) an assessment, run a campaign, view results, download reports.

**Estimated total effort:** 2–3 days

**Note:** Most client-side work is small because it's mostly extending P2 improvements + P3 patterns to one more scope. The heavy lifting is in P3.

### P4.1 — Client campaign lifecycle parity

**Files:**
- Audit: `src/app/client/campaigns/**` — confirm all admin P2 improvements also appear here
- Modify as needed

**Scope / status:**
- [x] Pre-activation confirmation modal (shared `CampaignStatusActions`)
- [ ] Enriched Add-Assessment dialog (deferred with P2.4)
- [x] Validation at creation, not activation (warning banner now present on client overview too)
- [x] Bulk invite detailed result toast (shared)
- [x] Participant removal undo (shared `CampaignParticipantManager`)
- [x] Campaign results page with factor scores (`ResultsFactorScoresTable` wired into client results page)
- [ ] PDF generation status polling (deferred with P2.8)

**Effort:** 4 hours (assuming P3.3 lifted the shared components)

---

### P4.2 — Client report viewing + PDF download

**Problem:** Clients can see released reports. Need to confirm the full path works end-to-end after P0.1's fix.

**Files:**
- Audit: `src/app/client/reports/**`
- Reference: `canExportReports` logic in `src/lib/auth/workspace-access.ts:106-111`

**Fix:**
- Verify `canExportReports` returns true for client admins (currently: yes, per the audit).
- Verify the P0.1 fix (signed API endpoint) works when called by a client admin.
- Add "Download PDF" button on the client reports page (already exists? — confirm).

**Steps:**
- [ ] End-to-end test as a client admin
- [x] Fix any gaps found (`requireReportSnapshotAccess` on client report page; PDF signed via API)
- [x] Commit

**Effort:** 2 hours

---

### P4.3 — Client assessment library (read-only)

**Problem:** Clients should see a read-only list of assessments available to them via `client_assessment_assignments`, so they know what they can attach to a campaign.

**Files:**
- New: `src/app/client/assessments/page.tsx` (list)
- New: `src/app/client/assessments/[id]/page.tsx` (detail, read-only)
- Reference: `client_assessment_assignments` table

**Fix:**
- List the assessments assigned to the client.
- Detail page shows factors, sections, estimated duration (no edit controls).
- Link to "Use in a new campaign" which pre-selects the assessment in the campaign create flow.

**Effort:** 4 hours

---

### P4.4 — Client scope audit

Same as P3.5 but for `requireClientAccess` guards.

**Status:** ✅ Covered via P3.5 sweep — client portal routes rely on `requireCampaignAccess` (which delegates to client scope checks). Client report access hardened in commit `2f270f5`. No dedicated standalone audit commit; work folded into P3.5.

**Effort:** 2 hours

---

## P5 — Quick Launch Wizard

**Objective:** Reduce the minimum "launch a campaign" flow from 7+ clicks across 5 pages to 3 clicks in a single modal. Reuse existing server actions — this is a UI composition layer, not new logic.

**Estimated total effort:** 2 days

### P5.1 — Admin quick-launch modal

**Problem:** See Phase 2 introduction. 7+ clicks minimum today.

**Files:**
- New: `src/components/campaigns/quick-launch-modal.tsx`
- Modify: `src/app/(dashboard)/campaigns/page.tsx` (add the CTA button)
- Reference: existing `CampaignForm`, `inviteParticipant`, `addAssessmentToCampaign`, `activateCampaign` server actions

**Design:**
```
┌─ Step 1: Campaign ──────────────────┐
│ Title               [________]       │
│ Client              [dropdown ▼]    │
│ Opens at            [date picker]    │
│ Closes at           [date picker]    │
│ Description         [textarea]       │
│              [Cancel]  [Next →]      │
└──────────────────────────────────────┘

┌─ Step 2: Assessment ─────────────────┐
│ Pick one to launch with:             │
│ ○ Leadership Fundamentals            │
│   8 factors · Likert · 45 min · 126 items
│ ○ Emotional Intelligence             │
│   5 factors · Forced choice · 20 min · 60 items
│                                       │
│ + Create new assessment (opens full builder)
│                                       │
│              [← Back]  [Next →]      │
└──────────────────────────────────────┘

┌─ Step 3: Invite ─────────────────────┐
│ How do you want to invite people?    │
│ ○ Single email  [_____@_____.com]    │
│ ○ Paste CSV                           │
│    email,first_name,last_name         │
│    [textarea]                         │
│ ○ Just generate an access link        │
│                                       │
│              [← Back]  [Launch ✓]    │
└──────────────────────────────────────┘

On success:
  Toast: "Campaign 'Q2 Leadership' launched — 5 invites sent"
  Navigate to /campaigns/{id}/overview
```

**Fix:**
- Build a `QuickLaunchModal` client component with `step` state (1 | 2 | 3).
- Each step validates before `Next` is enabled.
- Step 3's "Launch" button runs:
  1. `createCampaign(data)` → campaign_id
  2. `addAssessmentToCampaign(campaign_id, assessment_id)`
  3. `inviteParticipant(campaign_id, email)` or `bulkInviteParticipants(campaign_id, rows)` or `createAccessLink(campaign_id)`
  4. `activateCampaign(campaign_id)`
- If any step fails, roll back by soft-deleting the campaign and showing the error.
- Add "Quick Launch" button on the campaigns list page next to the existing "New Campaign" button.

**Steps:**
- [ ] Create the modal shell with step state
- [ ] Build step 1 (campaign details form)
- [ ] Build step 2 (assessment picker, reuse P2.4 enriched data)
- [ ] Build step 3 (invite form with 3 modes)
- [ ] Implement the launch handler with rollback on error
- [ ] Wire the CTA button on the campaigns list page
- [ ] Test: happy path all 3 invite modes + error rollback
- [ ] Commit

**Effort:** 10 hours

**Depends on:** P2.4 (enriched assessment picker), P0.4 (bulk invite detailed result)

---

### P5.2 — Extend quick-launch to partner portal

**Files:**
- Modify: `src/app/partner/campaigns/page.tsx` (add the CTA)
- Reuse: `QuickLaunchModal` component as-is

**Fix:**
- The modal is scope-agnostic if Step 1's client dropdown is filtered by the caller's scope. Confirm this is the case.
- Add the CTA button.

**Effort:** 1 hour

---

### P5.3 — Extend quick-launch to client portal

**Files:**
- Modify: `src/app/client/campaigns/page.tsx` (add the CTA)
- Modify: `QuickLaunchModal` to hide the client dropdown when there's only one option (the calling client)

**Effort:** 1 hour

---

### P5.4 — Campaign copy / "duplicate campaign" (stretch)

**Problem:** Running Q2 testing with the same structure as Q1 requires rebuilding from scratch.

**Files:**
- New: `duplicateCampaign(campaignId, overrides)` server action
- Modify: campaign detail page — add "Duplicate" action in the header dropdown

**Fix:**
- Server action copies the campaign + its assessments + (optionally) its report template config, with a new slug and empty participant list.
- Result: new campaign opens in edit mode for the admin to tweak.

**Steps:**
- [ ] Write the duplicate action
- [ ] Add the UI action
- [ ] Test duplicate + edit cycle
- [ ] Commit

**Effort:** 3 hours

---

## Appendix A — Dependencies between tasks

```
P0.3 ──┐
       ├──► P1.5 (parallel email sends need the unified result shape from P0.3)
P0.4 ──┘

P2.4 ──► P5.1 (quick launch step 2 needs the enriched picker)
P0.4 ──► P5.1 (quick launch step 3 needs the detailed bulk result)

P3.1 (partner assessments) ──┬──► P3.3 (partner builder)
                             ├──► P3.4 (partner templates)
                             └──► P5.2 (partner quick launch)

P3.3 ──► P4.1 (client campaign lifecycle parity)
```

## Appendix B — Files touched, grouped by phase

**P0:**
- `src/app/client/reports/[snapshotId]/page.tsx`
- `src/app/partner/campaigns/[id]/**/page.tsx`
- `src/app/client/campaigns/[id]/**/page.tsx`
- `src/app/actions/campaigns.ts` (invite paths)
- `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`
- `src/app/(dashboard)/reports/**/error.tsx` (new)
- `src/app/(dashboard)/report-templates/**/error.tsx` (new)
- `src/app/(dashboard)/campaigns/[id]/results/error.tsx` (new)
- `src/app/actions/reports.ts::getAllReadySnapshots`

**P1:**
- `src/app/actions/partners.ts::getPartnerStats`
- `src/app/actions/clients.ts::getClientStats`
- `src/app/actions/campaigns.ts::getCampaigns / getCampaignById / bulkInviteParticipants`
- `src/app/actions/reports.ts::getReportSnapshotsForCampaign`
- `src/app/(dashboard)/campaigns/[id]/results/loading.tsx` (new)
- `src/app/partner/diagnostics/[id]/loading.tsx` (new)
- `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx` (new)

**P2:**
- `src/lib/reports/registry.ts` (deferred status field)
- `src/lib/reports/runner.ts`
- `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`
- `src/app/(dashboard)/campaigns/create/page.tsx`
- `src/app/(dashboard)/campaigns/[id]/overview/campaign-status-actions.tsx`
- `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx`
- `src/app/(dashboard)/assessments/section-configurator.tsx`
- `src/app/(dashboard)/campaigns/[id]/results/page.tsx`
- `src/components/campaigns/participant-scores-table.tsx` (new)
- `src/app/api/reports/generate/route.ts`
- `src/app/api/reports/[snapshotId]/status/route.ts` (new)
- `src/app/(dashboard)/report-templates/[id]/builder/page.tsx` (split-pane)
- `src/app/actions/campaigns.ts::removeParticipant / restoreParticipant`

**P3:**
- New migration: add `partner_id` to `assessments` + RLS policies
- `src/app/actions/assessments.ts` (all mutations)
- `src/app/actions/clients.ts::createClient`
- `src/lib/auth/authorization.ts` (new `requireAssessmentWriteAccess` helper)
- `src/app/partner/assessments/**` (new route tree)
- `src/app/partner/clients/create/page.tsx` (new)
- `src/app/partner/report-templates/**` (new route tree)
- Shared component lift: `src/components/assessments/**`

**P4:**
- `src/app/client/campaigns/**` (parity with P2)
- `src/app/client/reports/**` (verify after P0.1)
- `src/app/client/assessments/**` (new, read-only list)

**P5:**
- `src/components/campaigns/quick-launch-modal.tsx` (new)
- `src/app/(dashboard)/campaigns/page.tsx` (add CTA)
- `src/app/partner/campaigns/page.tsx` (add CTA)
- `src/app/client/campaigns/page.tsx` (add CTA)
- `src/app/actions/campaigns.ts::duplicateCampaign` (new, stretch)

## Appendix C — Effort summary

| Phase | Items | Est. effort | Cumulative |
|---|---|---|---|
| P0 — Security & data integrity | 6 | ~8 hours | 1 day |
| P1 — Hot-path performance | 7 | ~7 hours | ~2 days |
| P2 — Admin panel flow | 12 | ~30 hours | ~6 days |
| P3 — Partner self-service | 5 | ~25 hours | ~9 days |
| P4 — Client self-service | 4 | ~12 hours | ~11 days |
| P5 — Quick launch wizard | 4 | ~15 hours | ~13 days |
| **Total** | **38** | **~97 hours** | **~12–13 working days** |

These are rough estimates assuming one full-time engineer familiar with Next.js + Supabase. Expect ±30% variance based on codebase learning curve.

## Appendix D — Open questions for the product owner

_Resolved 2026-04-11._

1. **Partner → client creation limits**: should there be a plan-based limit on how many clients a partner can create? Needs entitlement check?
   - **Resolved:** No limit. Partners can create as many clients as they need. No entitlement check required.

2. **Partner-owned assessments discoverability**: can clients see assessments owned by their partner, or only assessments explicitly assigned via `client_assessment_assignments`?
   - **Resolved:** Clients see assessments owned by their partner **or** explicitly assigned via `client_assessment_assignments`. No requirement for explicit assignment — partner-owned assessments are discoverable by default.

3. **Quick-launch wizard step 2**: when a user has zero existing assessments, should the "+ Create new assessment" link open the full builder in a new tab, or launch an inline mini-builder?
   - **Resolved:** Inline mini-builder. Constrained scope (name, description, pick a starter template) so users stay in the quick-launch flow. Full customisation remains available from the assessments page.

4. **PDF generation concurrency**: if 10 people click "Generate PDF" at the same time, do we queue them, run in parallel, or rate-limit? (Puppeteer launches are expensive.)
   - **Resolved:** DB-backed queue with bounded concurrency (1–2 workers). Add `pdf_status` column on the snapshot (`pending | generating | ready | failed`) and a small worker that polls and processes serially. UI shows the queued/generating state until the PDF is ready. Single clicks feel near-instant under normal load; bulk operations degrade gracefully. If PDF generation becomes a bottleneck in production, escalate to the Render worker path documented in `docs/architecture/2026-04-10-infrastructure-render-evaluation.md`.

5. **Deferred 360 blocks**: when re-enabled in the future, do existing templates that were saved with these blocks automatically re-render them, or do admins need to re-add them manually?
   - **Resolved:** Keep whatever 360-related blocks are already in existing templates as-is. No automatic migration or re-render logic needed. When/if 360 is fully re-enabled, admins can re-add blocks manually on a per-template basis.

6. **Client assessment library (P4.3)**: should this route exist at all, or is it enough for clients to discover assessments through the quick-launch wizard's assessment picker?
   - **Resolved:** The read-only client assessment library should exist. Keep P4.3 in scope.

### Follow-up questions raised by the resolutions above (unresolved)

_Added 2026-04-11 — these need answers before implementation starts._

7. **RLS policy shape for partner-owned assessments (follow-up to Q2)**: the resolution says clients see partner-owned assessments OR explicitly assigned ones. This needs to be reflected in the assessments RLS policy as an additive `OR` clause, not a gating filter. Otherwise rows in `client_assessment_assignments` become dead weight. Confirm: is the policy `owner_id = <partner_id> OR id IN (SELECT assessment_id FROM client_assessment_assignments WHERE client_id = <client_id>)`? Are there any edge cases (e.g. soft-deleted assignments, draft assessments, archived assessments) where the OR should not apply?

8. **PDF worker concurrency: where does the cap live? (follow-up to Q4)**: the resolution specifies 1–2 concurrent PDF workers. Decisions needed:
   - Where is the concurrency cap configured? Environment variable, `platform_settings` row, or hardcoded constant? Should it be tunable without a deploy?
   - What triggers the worker to pick up pending jobs? Options:
     (a) Vercel cron job on a fixed interval (e.g. every 10s)
     (b) The `pdf_status = 'pending'` insert itself triggers a fire-and-forget route (like the current report generation pattern in `src/app/actions/assess.ts:796`)
     (c) A Supabase database webhook / pg_net call
   - What happens if a worker crashes mid-generation? Do we mark the job `failed` on a timeout, or retry automatically?
   - Do we expose queue depth and worker status somewhere in the admin UI, or is log-level visibility enough for v1?

## Appendix E — Not in this plan (long tail)

These were flagged by the audits but explicitly deferred. Keep them on a "later" list:

- `unstable_cache()` wrapping for `getCampaigns`, `getPartnerStats`, `getClientStats` (small ~100ms win, needs careful revalidation strategy)
- Refactor `src/app/(dashboard)/generate/new/page.tsx` (1,887-line client component → RSC + leaf)
- Report template approval workflow
- Report version history (so updating a template doesn't lose old rendered snapshots)
- Scheduled report generation on campaign completion
- Batch PDF generation for an entire campaign at once
- Norm comparison block pipeline
- Full 360 assessment pipeline (rater-specific tables, open comments, gap analysis)
- Diagnostics + matching features in client portal
- Campaign templates library (beyond the simple duplicate in P5.4)
- CSV import preview UI (validate-before-submit pattern)
- Template builder keyboard shortcuts + button-based block reorder
