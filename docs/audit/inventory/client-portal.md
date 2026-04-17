# Client portal inventory

Generated: 2026-04-18
Source: `src/app/client/`

## Summary

- **21 pages** across the client portal
- Grouped: 1 dashboard, 5 listings, 7 details, 3 editors, 1 dynamic-router, 1 redirect, 1 error-stub, 2 others (feature-gated editor, sub-navigation layout wrapper)
- **Notable**:
  - Heavy nesting inside `/client/campaigns/[id]/*` — 9 sub-routes share a `CampaignDetailShell` layout with tab navigation (Overview, Assessments, Settings, Branding, Experience, Participants)
  - Two pages (`/client/campaigns/[id]/overview`, `/client/reports/[snapshotId]`) force light theme via a `ForceLightTheme` layout wrapper — they always render light regardless of user preference
  - `/client/[[...slug]]` is a catch-all dynamic router that delegates to workspace-configurable portal pages — not a static content surface
  - `/client/participants` supports a `?view=sessions|participants` URL toggle, rendering different lists based on mode

## Pages

| # | Route | File | Surface type | Interactive elements | States to capture |
|---|-------|------|--------------|----------------------|-------------------|
| 1 | `/client/dashboard` | `src/app/client/dashboard/page.tsx` | `dashboard` | 4 stat cards (links), action card with 3 CTAs (Launch campaign, View results, Find participant), active-campaigns grid with favorite + copy-link + invite + view-results per card, recent-results list with open-results button | loaded, empty, loading |
| 2 | `/client/campaigns` | `src/app/client/campaigns/page.tsx` | `listing` | Launch campaign button (→ modal-action/wizard), New campaign link, campaign data-table with row actions | loaded, empty, loading |
| 3 | `/client/campaigns/create` | `src/app/client/campaigns/create/page.tsx` | `editor` | CampaignForm (create mode) with title, description, dates, client select, submit | loaded, error |
| 4 | `/client/campaigns/[id]` | `src/app/client/campaigns/[id]/page.tsx` | `redirect` | — (redirects to `/overview`) | redirect-only |
| 5 | `/client/campaigns/[id]/overview` | `src/app/client/campaigns/[id]/overview/page.tsx` | `detail` | CampaignStatusActions (activate/pause/close buttons), 4 stat cards, completion progress bar, CampaignAccessLinks (list + create-link modal trigger) | loaded, error (notFound) |
| 6 | `/client/campaigns/[id]/assessments` | `src/app/client/campaigns/[id]/assessments/page.tsx` | `listing` | CampaignAssessmentsList with add-assessment modal trigger, per-row factor picker + construct picker (inline), remove-assessment confirm | loaded, empty, error |
| 7 | `/client/campaigns/[id]/settings` | `src/app/client/campaigns/[id]/settings/page.tsx` | `detail` | Timeline card (created/opens/closes), CampaignSettingsToggles (allowResume, showProgress, randomizeAssessmentOrder) | loaded, error |
| 8 | `/client/campaigns/[id]/branding` | `src/app/client/campaigns/[id]/branding/page.tsx` | `editor` | CampaignBrandEditor with inherited-brand chain visualisation, colour pickers, logo upload | loaded, error, permission-denied (no branding capability) |
| 9 | `/client/campaigns/[id]/experience` | `src/app/client/campaigns/[id]/experience/page.tsx` | `editor` | FlowEditor (full-height canvas with add-page, drag-reorder, preview, delete) | loaded, error |
| 10 | `/client/campaigns/[id]/participants` | `src/app/client/campaigns/[id]/participants/page.tsx` | `listing` | Quota warning banner (conditional), CampaignAccessLinks, CampaignParticipantManager (table + invite modal + bulk import modal + import-issues modal) | loaded, empty, loading, error, quota-violation |
| 11 | `/client/campaigns/[id]/participants/[pid]` | `src/app/client/campaigns/[id]/participants/[pid]/page.tsx` | `detail` | ParticipantDetailView with tabs (sessions, activity, snapshots), resend-invite button, remove-participant confirm | loaded, error |
| 12 | `/client/campaigns/[id]/participants/[pid]/sessions/[sid]` | `src/app/client/campaigns/[id]/participants/[pid]/sessions/[sid]/page.tsx` | `detail` | SessionDetailView (read-only, client sees summary only, not raw responses) | loaded, error |
| 13 | `/client/campaigns/[id]/sessions/[sessionId]` | `src/app/client/campaigns/[id]/sessions/[sessionId]/page.tsx` | `detail` | CampaignSessionView — report rows with send-report button, link to settings | loaded, error |
| 14 | `/client/participants` | `src/app/client/participants/page.tsx` | `listing` | View-mode toggle (sessions ↔ participants), participant/session list with row actions (resend invite, view results) | loaded, empty, loading, view-mode-switch |
| 15 | `/client/assessments` | `src/app/client/assessments/page.tsx` | `listing` | New Campaign button, AssessmentLibraryTable with row actions | loaded, empty, loading |
| 16 | `/client/assessments/[id]` | `src/app/client/assessments/[id]/page.tsx` | `detail` | 4 stat cards (duration, factors, sections, quota), section grid (ScrollReveal), factor grid grouped by dimension, navigation buttons | loaded, error |
| 17 | `/client/reports/[snapshotId]` | `src/app/client/reports/[snapshotId]/page.tsx` | `detail` | ReportPdfButton, ReportRenderer (Suspense-wrapped streaming content) | loaded, loading (streaming), error (notFound if not released) |
| 18 | `/client/diagnostics/[id]` | `src/app/client/diagnostics/[id]/page.tsx` | `error-page` | — (stub, immediately notFound) | error only |
| 19 | `/client/diagnostic-results/[id]` | `src/app/client/diagnostic-results/[id]/page.tsx` | `error-page` | — (stub, immediately notFound) | error only |
| 20 | `/client/settings/brand/client` | `src/app/client/settings/brand/client/page.tsx` | `editor` *(feature-gated)* | ClientBrandEditor (when enabled) OR empty-state card with Building2 icon + "Branding disabled" copy | loaded-enabled, loaded-disabled, error |
| 21 | `/client/[[...slug]]` | `src/app/client/[[...slug]]/page.tsx` | `dynamic-router` *(new type)* | Delegates to WorkspacePortalPage / WorkspacePortalLivePage based on workspace access state | redirected, signed-out, ok, access-pending, access-denied |

## Overlays triggered from this portal

| # | Trigger location | Component | Overlay type | Purpose |
|---|------------------|-----------|--------------|---------|
| 1 | Dashboard action card, Campaigns list "Launch" button | `LaunchCampaignButton` | `modal-action` (chooser: New / Reuse) | Entry point for launching a campaign |
| 2 | From chooser → "New campaign" | `QuickLaunchModal` | `modal-wizard` (3–4 steps) | Guided new-campaign setup with assessment picker + capabilities + invite mode |
| 3 | Campaign overview + Campaign participants | `CampaignAccessLinks` → "Create link" button | `modal-action` | Generate a shareable access URL |
| 4 | Campaign assessments list | "Add assessment" button | `modal-action` | Link an existing assessment to the campaign |
| 5 | Campaign participants list | "Invite participant" button | `modal-action` | Invite one participant by email |
| 6 | Campaign participants list | "Bulk import" button | `modal-action` | Paste CSV to bulk-invite |
| 7 | After bulk import with errors | Bulk-errors modal (auto-opens) | `modal-action` (readonly) | Show rows rejected + failed email deliveries |
| 8 | Reports detail | `SendReportButton` | `modal-action` | Send report email to participant |
| 9 | Flow editor | `AddPageDialog` | `modal-action` | Add custom page to experience flow |
| 10 | Flow editor | `FlowPreviewDialog` | `drawer-sheet` *or* full-screen preview | Preview pages in light/dark/mobile modes |
| 11 | Various (remove/delete) | `ConfirmDialog` | `modal-confirm` | Destructive action confirmations |
| 12 | Participant row action menu | `DropdownMenu` | `dropdown-menu` | Resend invite, remove, view results |
| 13 | Global (any idle tab) | `SessionExpiryWarning` | `modal-action` (blocking, no close) | Prompt to stay signed in or sign out |

## Navigation surface

### Root client layout — `src/app/client/layout.tsx`

- Wraps every `/client/**` page
- Provides `SessionActivityProvider` + `SessionExpiryWarning` for idle-timeout handling
- Renders `WorkspaceShell` (the sidebar + top header for the authenticated portal)
- Auth gate: `getWorkspaceBootstrap("client")` — redirects to `/login` if unauthenticated
- Resolves client org context via `resolveClientOrg`

### Primary navigation — `WorkspaceShell`

Component file (referenced but not read in this task): the shared shell used by client / partner / admin portals. It renders the sidebar with primary sections and the top header.

### Campaign detail sub-navigation — `src/app/client/campaigns/[id]/layout.tsx`

- Wraps all `/client/campaigns/[id]/*` routes
- Renders `CampaignDetailShell` — campaign-scoped header with title, status badge, favorite toggle, and tab bar
- Tabs: **Overview · Assessments · Settings · Branding · Experience · Participants**
- Auth: `requireCampaignAccess` verifies the user can manage this campaign
- Fetches: favorite status, client branding capability

### Layout hierarchy

```
client/layout.tsx                          (SessionActivityProvider + WorkspaceShell)
├─ dashboard/, campaigns/, participants/, assessments/, settings/
├─ campaigns/[id]/layout.tsx              (CampaignDetailShell — campaign tabs)
│   ├─ overview/layout.tsx                (ForceLightTheme — always light)
│   ├─ assessments/, settings/, branding/, experience/, participants/
│   └─ participants/[pid]/sessions/[sid]/
├─ reports/layout.tsx                      (ForceLightTheme — always light)
│   └─ reports/[snapshotId]/
└─ [[...slug]]/                            (catch-all dynamic router)
```

### Breadcrumbs / back-stack

No explicit breadcrumb component is rendered on client pages. "Where-am-I" context is carried by:
- The sidebar's active section (set by `WorkspaceShell`)
- The page header (`PageHeader` eyebrow + title)
- The campaign tab bar (for campaign sub-pages)

This is a **likely Phase 2 finding** — no surface has true breadcrumbs to navigate back up the hierarchy beyond one level.

## Taxonomy gaps

The framework.md Part 1 taxonomy covered ~90% of what was found. Gaps / edge cases flagged for the user to review:

1. **`redirect`** — `/client/campaigns/[id]` redirects immediately to `/overview`. Not a user-visible surface, but still a routable URL. **Proposed**: add `redirect` as a non-evaluated entry in the taxonomy (skipped during Phase 2 scoring).

2. **`dynamic-router`** — `/client/[[...slug]]` is a catch-all that dispatches to different components based on workspace config. The actual content is not authored in the page file — it's driven by external config. **Proposed**: add `dynamic-router` as a distinct type in Part 1, noting that its evaluation cascades to whichever child component renders.

3. **Feature-gated surfaces** — `/client/settings/brand/client` renders either the full editor OR a "feature disabled" empty state based on a capability check. This is a single route with two surface renditions. **Proposed**: no new taxonomy type — but Phase 2 should capture both renditions as separate screenshots and evaluate each.

4. **Theme-override layouts** — `ForceLightTheme` forces light mode on overview + report pages. Not a surface itself, but affects evaluation (dark-mode criterion becomes N/A for those pages). **Proposed**: handle as a scoring note, no taxonomy change.

5. **View-mode toggles in listings** — `/client/participants` switches between sessions and participants views via a URL param. Same surface, two data shapes. **Proposed**: capture both views as separate states in Phase 1 screenshots (add `view-sessions`, `view-participants` to States column for this row).

6. **Streaming / Suspense-wrapped surfaces** — `/client/reports/[snapshotId]` uses `<Suspense>` to stream content. This means "loading" is a real visible state (not just instantaneous). **Proposed**: no taxonomy change — this is captured adequately by including `loading` in the States column.

7. **Stub / notFound pages** — `/client/diagnostics/[id]` and `/client/diagnostic-results/[id]` always trigger `notFound()`. They're placeholders for disabled features. **Proposed**: add `error-page` sub-note "stub — feature not implemented". Skip evaluation.

## Incomplete

None — every route and layout under `src/app/client/` was read and catalogued.
