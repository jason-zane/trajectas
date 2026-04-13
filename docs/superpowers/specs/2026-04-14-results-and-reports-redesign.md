# Results & Reports Redesign

**Date:** 2026-04-14
**Status:** Approved

---

## Problem Statement

The current path from participant to results to report is too long and confusing:

1. Open participant → find session → open session → see scores → click "Generate report" → choose template + audience + narrative mode → wait → find report in list → Preview / Release / Retry PDF.
2. PDF generation fails in production (Vercel) due to `@sparticuz/chromium` hardcoding the AWS Lambda binary path (`/var/task/…`).
3. "Release" is opaque — users don't know what it does.
4. The generate dialog exposes three options (template, audience, narrative mode) that should be pre-configured, not runtime choices.

---

## Goals

- Make it trivially fast to view results and reports for a participant within a campaign.
- Eliminate all unnecessary steps between "open a campaign participant" and "see their report."
- Fix PDF generation so it works reliably in production on Vercel.
- Clarify the send/delivery flow without adding infrastructure.

---

## Out of Scope

- Redesigning the scores/results visualisation UI.
- Changes to the report template editor or brand editor.
- The participants directory page (standalone, cross-campaign view — unchanged).
- Campaign setup flow for assigning report templates.

---

## Design

### 1. Two Entry Points — Different Intent

**Campaign participants list (campaign-scoped view):**
- Each row = one participant's session in that campaign.
- Participant name links to their full participant profile (unchanged).
- A separate explicit action — "View results" — links to the campaign session page.
- No ambiguity about what each link does.

**Participants directory (standalone view):**
- Unchanged concept. Click a participant → full profile showing all sessions and reports across all campaigns.

### 2. Campaign Session Page (new, purpose-built)

A dedicated page for the campaign→session entry point. URL pattern: `/campaigns/[id]/sessions/[sessionId]` or similar.

**Header:**
- Participant name + campaign name as context breadcrumb.
- Link back to the campaign participants list.

**Scores section:**
- Existing scores/dimensions display (no changes to this component).

**Reports section:**
- One row per report template configured for the campaign (derived from `campaign_report_config`).
- Columns: Template name | Who it's for | Status | Action.
- "Who it's for" is derived from the audience slot in `campaign_report_config` (participant / HR manager / consultant) — not a runtime choice.
- Status badges: Generating… / Ready / Sent.
- Action: **View** (single button, opens report in new tab). While generating, the button is disabled with a spinner. No separate "Generate" button exposed.

**No generate dialog.** No audience selector. No narrative mode selector at runtime.

### 3. Auto-Generation on Session Completion

When a participant session completes, the system automatically queues report snapshot generation for every template configured on that campaign. This is triggered server-side on session completion — no admin action required.

If auto-generation fails (e.g. AI error, timeout), the row shows a "Retry" affordance. This is the exception path, not the primary flow.

`audienceType` and `narrativeMode` are read from the campaign's report template configuration, not supplied at generation time.

### 4. Report Page (web view)

Reports are viewed as a rich web page at `/reports/[snapshotId]`. This page opens in a new tab.

**Actions on the report page:**
- **Download PDF** — generates PDF on demand via `@sparticuz/chromium-min`. If already generated and cached, instant download. If not, shows a generating state (a few seconds). PDF generation is not a prerequisite to viewing the report.
- **Send to participant** — opens an in-page review dialog (see below).

### 5. Send to Participant Flow

Replaces the current "Release" action. "Release" is removed as a concept visible to users.

**Trigger:** "Send to participant" button on the report page (secondary/quiet styling — not the primary CTA).

**Flow:**
1. Dialog opens showing the email template pre-populated with the participant's name and a secure tokenised link to this report web page.
2. Admin can edit the email body before sending.
3. Admin confirms → email is sent → report status changes to "Sent."

**What the participant receives:** An email with a link. Clicking opens the same `/reports/[snapshotId]` web page (authenticated via token). The participant can read the report and click "Download PDF" themselves.

This eliminates the need to generate or attach a PDF before sending. PDF remains available as a self-serve download for both admin and participant.

### 6. PDF Generation Fix

**Problem:** `@sparticuz/chromium` hardcodes `/var/task/node_modules/@sparticuz/chromium/bin` as the binary location — the AWS Lambda path. Vercel uses a different filesystem layout, so the binary is never found.

**Fix:** Replace `@sparticuz/chromium` with `@sparticuz/chromium-min` in `pdf-browser.ts`. The `-min` variant downloads the Chromium binary to `/tmp/` at runtime from a public GitHub releases URL, rather than bundling it. This works on any serverless platform.

- No new infrastructure (no S3, no AWS credentials, no additional services).
- Cold start adds ~2–3 seconds on first invocation per container — acceptable.
- Subsequent invocations within the same warm container reuse the cached binary.
- The `findLocalExecutablePath()` fallback in `pdf-browser.ts` remains — local dev still uses the system Chrome.

**Changes required:**
- Swap `@sparticuz/chromium` → `@sparticuz/chromium-min` in `package.json`.
- Update `pdf-browser.ts` to pass the GitHub release URL to `chromium.executablePath(url)`.
- Set `CHROMIUM_MIN_SKIP_DOWNLOAD=false` (or equivalent) in Vercel env vars if needed.
- Pin the chromium-min version to a known-good release.

---

## Data Model Notes

- `campaign_report_config` already stores up to three template slots per campaign (`participant_template_id`, `hr_manager_template_id`, `consultant_template_id`). No schema changes needed for the reports section.
- `report_snapshots` status column: remove `released` as a user-visible state. Internally, "sent" maps to the existing `released` status (the integration event fires on send).
- `audienceType` and `narrativeMode` on snapshots are still stored — they just get populated from the campaign config at generation time rather than from a dialog.

---

## What Changes

| Area | Before | After |
|---|---|---|
| Campaign participant row | Click name → participant profile | Name → profile; "View results" → session page |
| Session navigation | Participant → session → results (3 clicks) | Campaign list → session page (1 click) |
| Generate report | Dialog: template + audience + narrative | Auto-generated on session completion |
| Report access | "Preview" from a reports list | "View" button per template, opens report tab |
| PDF | Separate "Retry PDF" action, broken in prod | On-demand from report page, fixed via chromium-min |
| Release/send | "Release" button (opaque) | "Send to participant" with email review dialog |
| Participant delivery | PDF attachment or unclear | Secure link to web report; participant downloads PDF themselves |

---

## Open Questions

None — all design decisions confirmed with stakeholder.
