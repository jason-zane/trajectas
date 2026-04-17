# Partner portal inventory

Generated: 2026-04-18
Source: `src/app/partner/`

## Summary

- **21 pages** across the partner portal
- Grouped: 1 dashboard, 5 listings, 8 details, 4 editors, 1 print-export, 2 dynamic-router
- **Notable**:
  - Same layout pattern as client portal — `WorkspaceShell` + `SessionActivityProvider` at the root
  - Heavy delegation pattern — `page.tsx` files are thin routing/data layers that hand off to shared components (`CampaignsTable`, `AssessmentBuilder`, `ParticipantDetailView`, `BlockBuilderClient`, etc.)
  - Report templates have both `builder` (editor) + `preview` (print-export) sibling routes
  - `/partner/diagnostics/[id]` and `/partner/[[...slug]]` are both dynamic-router surfaces delegating to `WorkspacePortalPage` / `WorkspacePortalLivePage`
  - Brand settings (`/partner/settings/brand`) is feature-gated on `can_customize_branding`

## Pages

| # | Route | File | Surface type | Interactive elements | States to capture |
|---|-------|------|--------------|----------------------|-------------------|
| 1 | `/partner/dashboard` | `src/app/partner/dashboard/page.tsx` | `dashboard` | Stat cards (links), quick actions grid, campaign list | loaded, empty |
| 2 | `/partner/campaigns` | `src/app/partner/campaigns/page.tsx` | `listing` | LaunchCampaignButton, "New campaign" link, CampaignsTable | loaded, empty |
| 3 | `/partner/campaigns/create` | `src/app/partner/campaigns/create/page.tsx` | `editor` | CampaignForm (create mode) | loaded, precondition-check |
| 4 | `/partner/campaigns/[id]` | `src/app/partner/campaigns/[id]/page.tsx` | `detail` | Metric cards, assessment lineup, participants table with export links | loaded, error |
| 5 | `/partner/campaigns/[id]/participants/[participantId]` | `src/app/partner/campaigns/[id]/participants/[participantId]/page.tsx` | `detail` | ParticipantDetailView (sessions, activity, snapshots) | loaded, error |
| 6 | `/partner/campaigns/[id]/participants/[participantId]/sessions/[sid]` | `.../sessions/[sid]/page.tsx` | `detail` | SessionDetailView | loaded, redirect (URL validation) |
| 7 | `/partner/campaigns/[id]/sessions/[sessionId]` | `.../sessions/[sessionId]/page.tsx` | `detail` | CampaignSessionView with report rows | loaded, redirect (campaign validation) |
| 8 | `/partner/participants` | `src/app/partner/participants/page.tsx` | `listing` | View-mode toggle (participants ↔ sessions), ParticipantsTable | loaded, empty, view-participants, view-sessions |
| 9 | `/partner/assessments` | `src/app/partner/assessments/page.tsx` | `listing` | Tabs (Your / Platform), "Build assessment" button, AssessmentsTable | loaded, empty |
| 10 | `/partner/assessments/create` | `src/app/partner/assessments/create/page.tsx` | `editor` | AssessmentBuilder | loaded |
| 11 | `/partner/assessments/[id]/edit` | `src/app/partner/assessments/[id]/edit/page.tsx` | `editor` | Local nav tabs (Builder / Intro), AssessmentBuilder | loaded, not-found |
| 12 | `/partner/assessments/[id]/edit/intro` | `src/app/partner/assessments/[id]/edit/intro/page.tsx` | `editor` | AssessmentIntroEditor | loaded, not-found |
| 13 | `/partner/clients` | `src/app/partner/clients/page.tsx` | `listing` | "New client" button, ClientsTable | loaded, empty |
| 14 | `/partner/clients/create` | `src/app/partner/clients/create/page.tsx` | `editor` | ClientCreateForm (fixedPartnerId) | loaded, auth-check |
| 15 | `/partner/report-templates` | `src/app/partner/report-templates/page.tsx` | `listing` | Tabs (Your / Platform), CreateTemplateButton, ReportTemplatesTable | loaded, empty |
| 16 | `/partner/report-templates/[id]/builder` | `src/app/partner/report-templates/[id]/builder/page.tsx` | `editor` | BlockBuilderClient (drag-drop block editor, property panels) | loaded, draft-state |
| 17 | `/partner/report-templates/[id]/preview` | `src/app/partner/report-templates/[id]/preview/page.tsx` | `print-export` | ReportRenderer with warning banner, Suspense boundary | loaded, loading (streaming) |
| 18 | `/partner/reports/[snapshotId]` | `src/app/partner/reports/[snapshotId]/page.tsx` | `print-export` | ReportRenderer, ReportPdfButton | loaded, error (notFound) |
| 19 | `/partner/settings/brand` | `src/app/partner/settings/brand/page.tsx` | `editor` *(feature-gated)* | PartnerBrandEditor (when `can_customize_branding`), else disabled empty-state | loaded-enabled, loaded-disabled |
| 20 | `/partner/diagnostics/[id]` | `src/app/partner/diagnostics/[id]/page.tsx` | `dynamic-router` | Delegates to WorkspacePortalLivePage / WorkspacePortalPage | access-restricted, loaded |
| 21 | `/partner/[[...slug]]` | `src/app/partner/[[...slug]]/page.tsx` | `dynamic-router` | Catch-all: redirects empty slug to `/dashboard`, else delegates to workspace portal page | redirect, not-found, config-driven |

## Overlays triggered from this portal

| # | Trigger location | Component | Overlay type | Purpose |
|---|------------------|-----------|--------------|---------|
| 1 | Dashboard, Campaigns list | `LaunchCampaignButton` | `modal-action` → `modal-wizard` | Launch / reuse campaign |
| 2 | Clients list | "New client" CTA (inline form, not modal) | — | (no overlay) |
| 3 | Report-templates list | `CreateTemplateButton` | `modal-action` | Create new report template |
| 4 | Partners clients table | "Assign client" | `modal-action` | Assign platform client to partner |
| 5 | Partner assessment assignments | "Assign assessment" | `modal-action` | Link assessment to partner pool |
| 6 | Partner users settings | `InvitePartnerUserDialog` (→ `InviteMemberDialog`) | `modal-action` | Invite partner team member |
| 7 | Reports detail | `SendReportButton` | `modal-action` | Send report email |
| 8 | Various tables | `ConfirmDialog` | `modal-confirm` | Destructive confirmations |
| 9 | Row action ellipses | `DropdownMenu` | `dropdown-menu` | Row-scoped actions |
| 10 | Global (idle) | `SessionExpiryWarning` | `modal-action` (blocking) | Stay signed in |

## Navigation surface

**Root layout** — `src/app/partner/layout.tsx`
- `SessionActivityProvider` + `SessionExpiryWarning`
- `WorkspaceShell` (shared sidebar/header component — same one used by client/admin portals)
- Auth gate: `getWorkspaceBootstrap("partner")`

**Sidebar sections** (rendered by `WorkspaceShell` in partner mode):
- Dashboard
- Campaigns
- Participants
- Assessments
- Report templates
- Clients
- Settings

**Sub-navigation patterns**:
- Assessments edit: top-level tabs (Builder / Intro)
- Assessments + Report-templates lists: `Tabs` for "Your" vs "Platform" scope

## Taxonomy gaps

None — the 7 edge-case notes added in framework v2 cover every pattern observed in partner (feature-gated settings, dynamic-router, redirect-validation flows).
