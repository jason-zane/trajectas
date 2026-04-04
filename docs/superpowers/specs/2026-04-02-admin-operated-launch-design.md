# Admin-Operated Launch: End-to-End Assessment Delivery

**Date:** 2026-04-02
**Status:** Approved for implementation
**Related:** [Report Generation Design](./2026-03-31-report-generation-design.md), [Report Rendering Design](./2026-04-01-report-rendering-design.md), [Brand System Design](./2026-03-28-brand-system-design.md)

## Overview

Lock down the complete admin-operated workflow so a platform admin can run live campaigns with real candidates and deliver branded reports — without requiring partner/client self-service. This is the minimum viable operating mode for revenue.

## V1 Goal

A platform admin can:
- Create an assessment and publish it
- Create a campaign and attach assessments
- Configure campaign-specific branding (colors, logo)
- Invite candidates by link or by email
- Watch candidates complete assessments
- Review stored results in admin
- Generate/release branded reports
- Open reports from admin UI reliably

## Current State

### Already Working
- Assessment → campaign plumbing (CRUD, attachment, reorder)
- Candidate runtime (token validation, session creation, response saving, completion)
- CTT scoring (synchronous on submit)
- Results stored and viewable in admin (participant detail, campaign results tab)
- Report template builder (12 block types, drag/drop, campaign linkage)
- Report engine (`processSnapshot()` — 6-step pipeline, fully implemented)
- Report rendering components (ReportRenderer, 12 blocks, 9 charts, 5 modes)
- Admin report viewer at `/reports/[snapshotId]` with release/download
- Campaign experience overrides (flow config, page content, demographics)
- Brand system (platform + organization levels)
- Open enrollment via access links
- DB trigger creates pending snapshots on session completion

### Not Finished for Launch
1. **Automatic report processing** — DB trigger creates pending rows, but nothing processes them automatically. `submitSession()` never calls the report generation API.
2. **Report surfaces are placeholders** — `report-screen.tsx` says "Results view will be available once scoring pipeline is connected." `report-export-screen.tsx` says "final PDF/export pipeline will replace this interim page."
3. **No campaign-level branding** — `brand_owner_type` only supports `platform | organization`. Runner resolves org brand, never campaign brand. Report runner hardcodes `DEFAULT_REPORT_THEME`.
4. **No email invites** — No email dependency in the project. `inviteParticipant()` creates a DB row but sends nothing.
5. **Settings not enforced** — `showProgress`, `allowResume`, `randomizeAssessmentOrder` are stored but ignored in the runtime. Paused campaigns still allow responses. Consent captures hardcoded "client" instead of real IP. IRT/hybrid/CAT shown in UI but only CTT is implemented.

## Design Decisions

### Report Auto-Generation
Call `/api/reports/generate` fire-and-forget from `submitSession()` after marking the session complete. Use an `INTERNAL_API_KEY` header to bypass `requireAdminScope()` since this runs in participant context. Non-blocking — snapshots remain pending for manual retry if the call fails.

### Report Surfaces
The admin report viewer already works (`/reports/[snapshotId]` + `ReportRenderer`). For participants, update `/assess/[token]/report` to fetch the real snapshot and render via `ReportRenderer` when available, falling back to a "preparing" message when still processing. For portal launches, route HR manager/consultant audiences to the dashboard snapshot viewer.

### Campaign Branding
Add `'campaign'` to `brand_owner_type` enum (Postgres + TypeScript). Extend `getEffectiveBrand(orgId?, campaignId?)` with campaign → organization → platform → defaults resolution. Add a campaign branding tab with simplified editor (primary color, accent color, logo, brand name). Update all runner pages and the join page to pass `campaignId` to brand resolution. Wire report runner to resolve brand from `campaign_report_config.brand_mode` (column already exists from migration 00044).

### Email Invites
Resend + @react-email/components. Branded invite template using existing `EmailStyleColors` from brand config. `sendParticipantInviteEmail()` action separate from `inviteParticipant()` so resend works without re-creating the row. Send/Resend button in participant manager.

### Product Contract Tightening
- Block paused campaigns (change access.ts to only allow `active`)
- Honor `showProgress` (conditionally render ProgressBar)
- Honor `allowResume` (don't auto-resume when false)
- Capture real IP in consent (server-side via headers)
- Hide IRT/hybrid/CAT from UI (only CTT is implemented)

## Out of Scope
- Partner/client self-service portals
- Partner-level brand model
- 360 assessment flow
- Norm comparison blocks
- Adaptive/IRT/CAT scoring
- Randomize assessment order (store but don't enforce in v1)

## Phases

1. **Auto report generation** — trigger processing from submitSession
2. **Real report surfaces** — replace placeholders with snapshot-backed views
3. **Campaign branding** — campaign-level brand override across runner + reports
4. **Email invites** — Resend integration with branded templates
5. **Tighten product contract** — enforce all visible settings
6. **Full E2E test** — admin campaign lifecycle end to end
