# Participants & Sessions View Restructuring

**Date:** 2026-04-14
**Status:** Draft

## Problem

Two issues with how participants/sessions are displayed:

1. **Global Participants page** (`/participants`): Every `campaign_participants` row is shown as its own table row. The same person with 3 campaign sessions appears 3 times. There's no way to see a deduplicated list of unique participants.

2. **Campaign Participants tab** (`/campaigns/[id]/participants`): The table shows participant records but the primary use case in campaign context is viewing session results. Users must click through to the participant detail to reach session results, adding unnecessary navigation.

## Design

### 1. Global Participants Page — Segmented Control

Add a segmented control above the table toolbar with two views: **Participants** (default) | **Sessions**.

**Participants view** — deduplicated by email:
- Columns: Name/Email, Sessions count, Latest status, Last activity
- Row click navigates to `/participants/{id}` (most recent `campaign_participants` record for that email)
- Search: name, email
- Filters: status
- No campaign column (participants span campaigns)

**Sessions view** — every `campaign_participants` row (current behavior):
- Columns: Name/Email, Campaign, Status, Progress, Last activity, "View Results" button
- "View Results" links to the session detail page for that record
- Search: name, email
- Filters: status, campaign
- Bulk actions remain (delete, mark completed, withdraw)

**URL:** Query param `?view=sessions` toggles to sessions view; default (no param) is participants view.

### 2. Campaign Participants Tab — Session-Focused

Reframe the existing `CampaignParticipantManager` table to be session-focused:

- Columns: Name/Email, Status, Started, Completed, "View Results" button
- "View Results" links to `/campaigns/{campaignId}/sessions/{sessionId}` — only visible for `in_progress` or `completed` participants (hidden/disabled for `invited`/`registered`)
- Invite and bulk-import actions remain unchanged
- Row action menu retains: copy link, send email, remove
- Remove the "View participant detail" link as primary action (session result is what matters in campaign context)

### 3. Data Layer

**New server action: `getUniqueParticipants`**

Groups `campaign_participants` by email (server-side for correct pagination). Returns:
- Name, email (from the most recent record)
- Total session count across all campaigns
- Latest status
- Last activity timestamp
- ID of the most recent `campaign_participants` record (for the row link)

**Modify `getCampaignById`**

Join `participant_sessions` in the campaign participants query so each `CampaignParticipant` includes its `participant_sessions` IDs. This enables the "View Results" button to link directly to the session detail route.

**No new routes.** Existing routes cover all navigation targets:
- `/participants/{id}` — participant detail
- `/campaigns/{campaignId}/sessions/{sessionId}` — session detail

### 4. Component Changes

**New:** `SegmentedControl` component (or reuse existing if one exists) — a toggle control placed above the DataTable toolbar on the global participants page.

**Modified:**
- `src/app/(dashboard)/participants/participants-table.tsx` — add segmented control, implement two column sets and data shapes
- `src/app/(dashboard)/participants/page.tsx` — pass view param, call appropriate data action
- `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` — add "View Results" button, reframe columns as session-focused
- `src/app/actions/participants.ts` — add `getUniqueParticipants` action

**Mirror changes** in client and partner portals where the same components are used.

### 5. Constraints

- Follow existing DataTable patterns for column definitions, search, filters, and bulk actions
- Segmented control should work with the existing page without new routes
- "View Results" button disabled state must be visually clear (not just invisible)
- Both light and dark mode
