# Assessment Results, Reporting, and PDF Pipeline Hardening Plan

> **Purpose:** This is a dedicated follow-on implementation plan for the admin -> campaign -> participant -> results -> report flow. It supersedes ad hoc patching of the session/results/report path and reframes the work around three separate layers: **scored session results**, **report snapshots**, and **PDF export**.
>
> **Reference implementation:** `/Users/jasonhunt/leadership-quarter` is the known-good behavioral reference for submission contract and completion UX. Its lead-generation gating defaults are **not** part of this migration; its explicit completion contract and direct report/PDF separation **are**.

## Goal

Make the candidate assessment completion and downstream results/report flow:

- bulletproof
- explicit in state transitions
- fast to view
- customizable for multiple report types per session
- secure across admin, partner, client, and participant surfaces

The end state should allow one completed assessment session to support:

- immediate score viewing
- optional web report generation in one or many templates
- optional PDF export from a generated report snapshot
- multiple audience-specific reports from the same scored session

---

## Core design principles

### 1. Results are first-class

If a session has been successfully scored, users must be able to inspect results even if:

- no report snapshot exists yet
- report generation is queued
- PDF generation failed

### 2. Report snapshots are customizable products, not the source of truth

`report_snapshots` should remain because they solve the right problem:

- one session can produce multiple reports
- different templates
- different audiences
- different branding
- different narrative modes

They are derived artifacts from scored results, not the canonical assessment outcome.

### 3. PDF export is a delivery layer

PDF generation should sit on top of a ready report snapshot. It must not be required for:

- session detail pages
- score visibility
- report web viewing

### 4. Completion must have an explicit contract

The runner should never "submit and hope". The server must return a structured outcome with a clear next step.

### 5. Failures must be attributable

No more generic hangs, silent scoring failures, or false 404s. Every failure class should resolve to one of:

- access denied / not found
- scoring failed
- report generation failed
- PDF export failed

---

## Current problems to solve

### Broken or unreliable today

- Session detail has recently required multiple defensive patches and still needs a more stable data contract.
- Candidate completion still spans too many asynchronous boundaries.
- Report generation and PDF generation are too tightly coupled in the perceived workflow.
- Results are not treated as independent from report state.
- The session/results/report UX is inconsistent across admin/client/partner surfaces.

### Structural root causes

- `submitSession()` marks completion, scores, triggers report generation, and leaves the UI to infer what happened afterward.
- Session detail currently fetches a composite view with several dependent lookups instead of treating each layer independently.
- `report_snapshots.status` and `pdf_status` are both surfaced in some places, but the product meaning is not consistent.
- The runner redirects into downstream pages instead of owning the finalising state directly.

---

## Target architecture

## Layer A — Scored session results

**Source tables**

- `participant_sessions`
- `participant_responses`
- `participant_scores`

**Responsibilities**

- record completion
- store scoring output
- expose responses and score bands
- power session detail and campaign results pages

**Must be enough for**

- participant session detail
- campaign-level results tables
- factor score inspection
- retry/report generation decisions

## Layer B — Report snapshots

**Source tables**

- `report_templates`
- `report_snapshots`

**Responsibilities**

- represent a generated report for a single session/template/audience combination
- persist `rendered_data` for web viewing
- preserve report-level customization decisions

**Must support**

- many snapshots from one scored session
- audience-specific snapshots
- rerender/retry of individual snapshots
- web report rendering independent from PDF

## Layer C — PDF export

**Source fields**

- `report_snapshots.pdf_status`
- `report_snapshots.pdf_url`
- `report_snapshots.pdf_error_message`

**Responsibilities**

- export a given snapshot into one or more downloadable formats
- support different generation strategies over time
- never block results viewing or report web viewing

**Design constraint**

The PDF layer should be pluggable. Today it can use Chromium. Later it may use:

- a sidecar renderer
- Render worker infrastructure
- format-specific generators

The rest of the system should only care that "snapshot X can be exported as PDF".

---

## Recommended contract changes

### Session processing contract

Add explicit processing state to `participant_sessions`.

**Recommended migration**

- [ ] Add `processing_status` enum/text to `participant_sessions`
- [ ] Add `processing_error` text to `participant_sessions`
- [ ] Add `processed_at` timestamp to `participant_sessions`

**Proposed statuses**

- `idle`
- `scoring`
- `scored`
- `reporting`
- `ready`
- `failed`

This separates "assessment was submitted" from "all downstream processing completed".

### `submitSession()` return contract

Replace the current loose `{ error?: string }` shape with an explicit union:

```ts
type SubmitSessionResult =
  | { ok: true; outcome: "ready"; sessionId: string; nextUrl: string }
  | { ok: true; outcome: "report_pending"; sessionId: string; poll: true }
  | { ok: true; outcome: "completed_no_report"; sessionId: string; nextUrl: string }
  | { ok: false; error: "invalid_access" | "save_incomplete" | "scoring_failed" | "report_failed"; message: string }
```

This mirrors the working contract in `leadership-quarter` without copying its lead-gen-specific behavior.

### Report snapshot contract

Treat `report_snapshots.status` as the web-report lifecycle only:

- `pending`
- `generating`
- `ready`
- `released`
- `failed`

Treat `pdf_status` as export lifecycle only:

- `queued`
- `generating`
- `ready`
- `failed`

No page should infer web report readiness from `pdf_status`.

---

## Workstreams

## R0 — Observability and state truth

**Objective:** make failures attributable before changing deeper behavior.

**Files**

- `src/app/actions/assess.ts`
- `src/app/actions/sessions.ts`
- `src/app/actions/reports.ts`
- `src/lib/reports/runner.ts`
- `src/lib/reports/pdf.ts`

**Tasks**

- [ ] Add consistent structured logging for:
  - session submit start/end
  - scoring start/end
  - snapshot generation start/end
  - PDF generation start/end
- [ ] Persist `processing_status` / `processing_error` on `participant_sessions`
- [ ] Add helper to map processing state into UI-safe labels

**Acceptance**

- Any failed session can be classified from DB state and logs without reproducing locally.

**Effort:** 0.5-1 day

---

## R1 — Session completion and scoring refactor

**Objective:** make `submitSession()` the single authoritative completion boundary.

**Files**

- `src/app/actions/assess.ts`
- `src/components/assess/review-screen.tsx`
- `src/components/assess/section-wrapper.tsx`
- `src/components/assess/use-save-queue.ts`

**Tasks**

- [ ] Rework `submitSession()` to:
  - mark session `completed`
  - set `processing_status='scoring'`
  - score synchronously
  - set `processing_status='scored'` or `failed`
  - create/queue report work only after successful scoring
- [ ] Make scoring failure return a structured error instead of soft success
- [ ] Ensure last response write is durably flushed before completion submit
- [ ] Change review/submit UI to stay in place during finalising instead of blind `router.push(nextUrl)`
- [ ] Add a real final-step CTA contract:
  - on last item: show `Review answers`
  - on review: show `Complete assessment`
  - on submit: show finalising state owned by the runner

**Acceptance**

- No completion hang
- No lost last answer
- No silent scoring failure

**Effort:** 1-1.5 days

---

## R2 — Results-first session and campaign pages

**Objective:** make scored results independently viewable, even if no report snapshot exists.

**Files**

- `src/app/actions/sessions.ts`
- `src/app/actions/campaign-results.ts`
- `src/components/results/session-detail-view.tsx`
- `src/components/results/session-scores-panel.tsx`
- `src/components/results/session-responses-panel.tsx`
- `src/app/(dashboard)/campaigns/[id]/results/page.tsx`

**Tasks**

- [ ] Stabilize `getSessionDetail()` around direct reads instead of brittle nested fetch chains
- [ ] Ensure session detail can render with:
  - scores only
  - responses only
  - no snapshots
- [ ] Add explicit "Reports" empty state when no snapshots exist
- [ ] Make campaign results page read from `participant_scores` as its primary truth
- [ ] Ensure score viewing does not require `report_snapshots`

**Acceptance**

- A scored session is always inspectable, regardless of report/PDF state

**Effort:** 1 day

---

## R3 — Snapshot generation hardening

**Objective:** keep the customizable snapshot architecture, but make generation deterministic and easier to retry.

**Files**

- `src/lib/reports/runner.ts`
- `src/app/actions/reports.ts`
- `src/app/api/reports/generate/route.ts`
- `src/components/results/generate-report-trigger.tsx`
- `src/components/results/session-reports-panel.tsx`

**Tasks**

- [ ] Make snapshot creation explicit from a scored session:
  - choose template
  - choose audience
  - create pending snapshot row
- [ ] Ensure `processSnapshot(snapshotId)` is idempotent
- [ ] Make retry operate at snapshot level only
- [ ] Keep `rendered_data` as the primary web-report payload
- [ ] Add snapshot-level error display with actionable retry copy

**Acceptance**

- One session can reliably produce many snapshots
- A failed snapshot does not poison the session or other snapshots

**Effort:** 1 day

---

## R4 — Web report rendering as a first-class surface

**Objective:** make the browser report view the default way to inspect a generated report.

**Files**

- `src/app/(dashboard)/reports/[snapshotId]/page.tsx`
- `src/app/client/reports/[snapshotId]/page.tsx`
- `src/components/reports/report-renderer.tsx`
- `src/components/assess/report-screen.tsx`

**Tasks**

- [ ] Standardize the snapshot report page around `rendered_data`
- [ ] Ensure participant report screen treats:
  - `ready/released` as renderable
  - `pending/generating` as a waiting state
  - `failed` as actionable error state
- [ ] Add consistent links from:
  - session detail
  - campaign results
  - participant detail
- [ ] Avoid tying page rendering to PDF existence

**Acceptance**

- If a snapshot is ready, users can always view it in-browser

**Effort:** 0.5-1 day

---

## R5 — PDF export redesign

**Objective:** keep PDF separate from core report visibility while preserving future flexibility.

**Files**

- `src/lib/reports/pdf.ts`
- `src/app/api/reports/[snapshotId]/pdf/route.ts`
- `src/components/reports/report-pdf-button.tsx`
- `src/components/results/session-reports-panel.tsx`
- `src/app/actions/reports.ts`

**Tasks**

- [ ] Reframe PDF as export from a snapshot, not a gate for report readiness
- [ ] Preserve `pdf_status` but only for export lifecycle
- [ ] Support two modes behind one interface:
  - on-demand export from `rendered_data`
  - background generation for prewarming/high-volume cases
- [ ] Keep storage-backed `pdf_url` for reuse when helpful
- [ ] Ensure `forceRefresh` remains possible for template changes

**Recommended interface**

```ts
generateSnapshotPdf(snapshotId, { mode?: "background" | "sync", forceRefresh?: boolean })
```

**Acceptance**

- A report snapshot can be viewed without a PDF
- A PDF can be generated later without regenerating the report snapshot

**Effort:** 1 day

---

## R6 — Navigation and route normalization

**Objective:** ensure every participant/session path is canonical and context-preserving.

**Files**

- `src/app/(dashboard)/campaigns/[id]/participants/**`
- `src/app/(dashboard)/participants/**`
- `src/app/client/campaigns/[id]/participants/**`
- `src/app/partner/campaigns/[id]/participants/**`
- `src/components/results/participant-detail-view.tsx`
- `src/components/results/participant-sessions-panel.tsx`

**Tasks**

- [ ] Normalize admin, client, and partner participant/session route structures
- [ ] Redirect stale participant/session URLs to canonical path rather than 404 where possible
- [ ] Make campaign participant names clickable into campaign-scoped detail
- [ ] Standardize tab design and actions across admin/client/partner participant detail pages

**Acceptance**

- No false 404s on session detail
- All session links preserve the correct campaign/tenant context

**Effort:** 0.5 day

---

## R7 — Performance and perceived-speed polish

**Objective:** keep the flow feeling fast even when backend work takes time.

**Files**

- `src/app/actions/assess.ts`
- `src/components/assess/*`
- `src/app/assess/[token]/**`

**Tasks**

- [ ] Continue collapsing repeated participant runtime bootstrap reads
- [ ] Add branded loading/finalising panels for:
  - intro page transitions
  - submit finalising
  - report preparing
- [ ] Add timing instrumentation around intro load, submit, scoring, and report generation

**Acceptance**

- Users always see clear progress states on slow transitions

**Effort:** 0.5-1 day

---

## R8 — Verification and regression coverage

**Objective:** make the full path provable.

**Files**

- `tests/e2e/**`
- relevant unit tests under `src/**` or test directories

**Tasks**

- [ ] Add end-to-end coverage for:
  - create campaign
  - attach assessment
  - invite participant
  - complete assessment
  - open session detail
  - view scores
  - generate report snapshot
  - view web report
  - export PDF
- [ ] Add targeted tests for:
  - last-answer durability
  - scoring failure surfacing
  - snapshot failure retry
  - PDF export retry/failure
  - stale route redirects

**Acceptance**

- The entire core path is testable without manual reconstruction

**Effort:** 1-1.5 days

---

## Recommended execution order

1. `R0` Observability and state truth
2. `R1` Session completion and scoring refactor
3. `R2` Results-first session and campaign pages
4. `R6` Navigation and route normalization
5. `R3` Snapshot generation hardening
6. `R4` Web report rendering
7. `R5` PDF export redesign
8. `R7` Performance/perceived-speed polish
9. `R8` Verification and regression coverage

This order gets correctness first, then visibility, then customization/export.

---

## Acceptance criteria for the whole plan

- A completed assessment never hangs without user feedback.
- The last answer of a session cannot be lost.
- A scored session is always viewable in the results UI.
- Report snapshots are optional, explicit, and retryable.
- One session can generate multiple report types from the same scored data.
- PDF export is separate from report readiness and can run later.
- Session detail pages never false-404 because of internal load failures.
- Admin, client, and partner routes behave consistently.

---

## Notes on what not to change

- Do **not** collapse the customizable snapshot architecture into a single-report-per-session model.
- Do **not** copy the old app's lead-generation defaults into this app.
- Do **not** make PDF generation the primary path to report visibility.

The right move is to keep the new architecture, but tighten its contracts so the workflow is explicit and reliable.
