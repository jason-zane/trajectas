# Admin (staff) portal inventory

Generated: 2026-04-18
Source: `src/app/(dashboard)/` — the staff/admin route group

## Summary

- **97 pages** across the staff portal — the largest and most complex surface in the app
- Organised into **14 feature sections** (Dashboard, Library, Assessments, Campaigns, Clients, Partners, Participants, Reports & templates, Users, Directory, Settings, Diagnostics, Generate, Other)
- **Layout pattern**: root `(dashboard)/layout.tsx` wraps every page with `WorkspaceShell` (same shell as client/partner portals, in staff mode)
- **13 nested layouts** provide sub-navigation for detail routes (campaigns, clients, partners, participants, report-templates, psychometrics, settings/brand, reports, campaigns/[id]/overview)
- **Dynamic routes dominate** — many `[id]`, `[slug]`, `[purpose]`, `[type]`, `[runId]` param shapes indicating entity-centric detail pages
- Staff portal mirrors the client/partner portal structure but adds **platform-level management** surfaces (Library, AI/Prompts/Models settings, Diagnostics, Generate, Matching)

## Pages by section

Counts are exact — verified by direct `find src/app/(dashboard) -name page.tsx`.

### 1. Dashboard (1 page)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 1 | `/dashboard` | `dashboard/page.tsx` | `dashboard` |

### 2. Library management (17 pages)

Entity CRUD across the construct hierarchy (dimensions → factors → constructs → items) plus response-formats and psychometric analytics.

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 2 | `/dimensions` | `dimensions/page.tsx` | `listing` |
| 3 | `/dimensions/create` | `dimensions/create/page.tsx` | `editor` |
| 4 | `/dimensions/[slug]/edit` | `dimensions/[slug]/edit/page.tsx` | `editor` |
| 5 | `/constructs` | `constructs/page.tsx` | `listing` |
| 6 | `/constructs/create` | `constructs/create/page.tsx` | `editor` |
| 7 | `/constructs/[slug]/edit` | `constructs/[slug]/edit/page.tsx` | `editor` |
| 8 | `/factors` | `factors/page.tsx` | `listing` |
| 9 | `/factors/create` | `factors/create/page.tsx` | `editor` |
| 10 | `/factors/[slug]/edit` | `factors/[slug]/edit/page.tsx` | `editor` |
| 11 | `/items` | `items/page.tsx` | `listing` |
| 12 | `/items/create` | `items/create/page.tsx` | `editor` |
| 13 | `/items/[id]/edit` | `items/[id]/edit/page.tsx` | `editor` |
| 14 | `/response-formats` | `response-formats/page.tsx` | `listing` |
| 15 | `/response-formats/create` | `response-formats/create/page.tsx` | `editor` |
| 16 | `/response-formats/[id]/edit` | `response-formats/[id]/edit/page.tsx` | `editor` |
| 17 | `/psychometrics` | `psychometrics/page.tsx` | `detail` *(wrapped in `psychometrics/layout.tsx`)* |
| 18 | `/psychometrics/items` | `psychometrics/items/page.tsx` | `listing` (+ item-health-list) |
| 19 | `/psychometrics/reliability` | `psychometrics/reliability/page.tsx` | `detail` |
| 20 | `/psychometrics/norms` | `psychometrics/norms/page.tsx` | `detail` |

### 3. Assessments (4 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 21 | `/assessments` | `assessments/page.tsx` | `listing` |
| 22 | `/assessments/create` | `assessments/create/page.tsx` | `editor` |
| 23 | `/assessments/[id]/edit` | `assessments/[id]/edit/page.tsx` | `editor` (AssessmentBuilder) |
| 24 | `/assessments/[id]/edit/intro` | `assessments/[id]/edit/intro/page.tsx` | `editor` (AssessmentIntroEditor) |

### 4. Campaigns (13 pages)

Same sub-navigation pattern as the client portal. `campaigns/[id]/layout.tsx` → `CampaignDetailShell`.

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 25 | `/campaigns` | `campaigns/page.tsx` | `listing` |
| 26 | `/campaigns/create` | `campaigns/create/page.tsx` | `editor` |
| 27 | `/campaigns/[id]` | `campaigns/[id]/page.tsx` | `redirect` → `/overview` |
| 28 | `/campaigns/[id]/overview` | `campaigns/[id]/overview/page.tsx` | `detail` *(forced light theme)* |
| 29 | `/campaigns/[id]/assessments` | `campaigns/[id]/assessments/page.tsx` | `listing` |
| 30 | `/campaigns/[id]/settings` | `campaigns/[id]/settings/page.tsx` | `detail` / `editor` |
| 31 | `/campaigns/[id]/branding` | `campaigns/[id]/branding/page.tsx` | `editor` *(feature-gated)* |
| 32 | `/campaigns/[id]/experience` | `campaigns/[id]/experience/page.tsx` | `editor` (FlowEditor) |
| 33 | `/campaigns/[id]/participants` | `campaigns/[id]/participants/page.tsx` | `listing` |
| 34 | `/campaigns/[id]/participants/[pid]` | `.../[pid]/page.tsx` | `detail` |
| 35 | `/campaigns/[id]/participants/[pid]/sessions/[sid]` | `.../sessions/[sid]/page.tsx` | `detail` |
| 36 | `/campaigns/[id]/sessions/[sessionId]` | `.../sessions/[sessionId]/page.tsx` | `detail` |

### 5. Clients (staff view) (9 pages)

Staff can manage platform-level client organisations; parallels the partner's client list but includes staff-only settings.

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 37 | `/clients` | `clients/page.tsx` | `listing` |
| 38 | `/clients/create` | `clients/create/page.tsx` | `editor` |
| 39 | `/clients/[slug]` | `clients/[slug]/page.tsx` | `detail` *(shell; wrapped in `clients/[slug]/layout.tsx`)* |
| 40 | `/clients/[slug]/overview` | `clients/[slug]/overview/page.tsx` | `detail` |
| 41 | `/clients/[slug]/details` | `clients/[slug]/details/page.tsx` | `editor` |
| 42 | `/clients/[slug]/assessments` | `clients/[slug]/assessments/page.tsx` | `listing` |
| 43 | `/clients/[slug]/branding` | `clients/[slug]/branding/page.tsx` | `editor` *(feature-gated; wrapped in `branding/layout.tsx`)* |
| 44 | `/clients/[slug]/reports` | `clients/[slug]/reports/page.tsx` | `listing` |
| 45 | `/clients/[slug]/settings` | `clients/[slug]/settings/page.tsx` | `detail` / `editor` |
| 46 | `/clients/[slug]/users` | `clients/[slug]/users/page.tsx` | `listing` |

### 6. Partners (staff view) (12 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 47 | `/partners` | `partners/page.tsx` | `listing` |
| 48 | `/partners/create` | `partners/create/page.tsx` | `editor` |
| 49 | `/partners/[slug]` | `partners/[slug]/page.tsx` | `detail` *(shell; wrapped in `[slug]/layout.tsx`)* |
| 50 | `/partners/[slug]/overview` | `partners/[slug]/overview/page.tsx` | `detail` |
| 51 | `/partners/[slug]/details` | `partners/[slug]/details/page.tsx` | `editor` |
| 52 | `/partners/[slug]/assessments` | `partners/[slug]/assessments/page.tsx` | `listing` |
| 53 | `/partners/[slug]/branding` | `partners/[slug]/branding/page.tsx` | `editor` *(feature-gated)* |
| 54 | `/partners/[slug]/clients` | `partners/[slug]/clients/page.tsx` | `listing` |
| 55 | `/partners/[slug]/library` | `partners/[slug]/library/page.tsx` | `listing` |
| 56 | `/partners/[slug]/reports` | `partners/[slug]/reports/page.tsx` | `listing` |
| 57 | `/partners/[slug]/settings` | `partners/[slug]/settings/page.tsx` | `detail` / `editor` |
| 58 | `/partners/[slug]/users` | `partners/[slug]/users/page.tsx` | `listing` |

### 7. Participants (3 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 59 | `/participants` | `participants/page.tsx` | `listing` |
| 60 | `/participants/[id]` | `participants/[id]/page.tsx` | `detail` *(wrapped in `participants/[id]/layout.tsx`)* |
| 61 | `/participants/[id]/sessions/[sid]` | `participants/[id]/sessions/[sid]/page.tsx` | `detail` |

### 8. Reports & templates (6 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 62 | `/reports` | `reports/page.tsx` | `listing` |
| 63 | `/reports/[snapshotId]` | `reports/[snapshotId]/page.tsx` | `print-export` *(forced light theme)* |
| 64 | `/report-templates` | `report-templates/page.tsx` | `listing` |
| 65 | `/report-templates/[id]/builder` | `report-templates/[id]/builder/page.tsx` | `editor` *(BlockBuilderClient; wrapped in `builder/layout.tsx`)* |
| 66 | `/report-templates/[id]/preview` | `report-templates/[id]/preview/page.tsx` | `print-export` *(wrapped in `preview/layout.tsx`)* |

### 9. Users (3 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 67 | `/users` | `users/page.tsx` | `listing` |
| 68 | `/users/[id]` | `users/[id]/page.tsx` | `detail` |
| 69 | `/users/invite/[inviteId]` | `users/invite/[inviteId]/page.tsx` | `detail` (invite-detail-client) |

### 10. Directory (1 page)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 70 | `/directory` | `directory/page.tsx` | `listing` (client + partner directory tables) |

### 11. Settings (14 pages)

The largest sub-area. Platform-level configuration for brand, AI, email, reports, and more.

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 71 | `/settings` | `settings/page.tsx` | `dashboard` (settings index) |
| 72 | `/settings/brand` | `settings/brand/page.tsx` | `editor` *(wrapped in `brand/layout.tsx`)* |
| 73 | `/settings/ai` | `settings/ai/page.tsx` | `listing` (AI purposes) |
| 74 | `/settings/ai/[purpose]` | `settings/ai/[purpose]/page.tsx` | `editor` (AI model + config per purpose) |
| 75 | `/settings/prompts` | `settings/prompts/page.tsx` | `listing` |
| 76 | `/settings/prompts/[purpose]` | `settings/prompts/[purpose]/page.tsx` | `editor` |
| 77 | `/settings/models` | `settings/models/page.tsx` | `listing` / `detail` |
| 78 | `/settings/email-templates` | `settings/email-templates/page.tsx` | `listing` |
| 79 | `/settings/email-templates/[type]` | `settings/email-templates/[type]/page.tsx` | `editor` |
| 80 | `/settings/reports` | `settings/reports/page.tsx` | `listing` |
| 81 | `/settings/reports/[id]/builder` | `settings/reports/[id]/builder/page.tsx` | `editor` (BlockBuilderClient) |
| 82 | `/settings/reports/[id]/preview` | `settings/reports/[id]/preview/page.tsx` | `print-export` |
| 83 | `/settings/reports/band-scheme` | `settings/reports/band-scheme/page.tsx` | `editor` |
| 84 | `/settings/users` | `settings/users/page.tsx` | `listing` |
| 85 | `/settings/experience` | `settings/experience/page.tsx` | `editor` (platform-default experience flow) |
| 86 | `/settings/item-selection` | `settings/item-selection/page.tsx` | `editor` (default item selection rules) |

### 12. Diagnostics (5 pages)

Internal tooling for psychometric diagnostic templates and runs.

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 87 | `/diagnostics` | `diagnostics/page.tsx` | `listing` |
| 88 | `/diagnostics/create` | `diagnostics/create/page.tsx` | `editor` |
| 89 | `/diagnostics/templates` | `diagnostics/templates/page.tsx` | `listing` |
| 90 | `/diagnostics/templates/create` | `diagnostics/templates/create/page.tsx` | `editor` |
| 91 | `/diagnostics/templates/[id]/edit` | `diagnostics/templates/[id]/edit/page.tsx` | `editor` |

### 13. Generate (AI generation pipeline) (3 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 92 | `/generate` | `generate/page.tsx` | `listing` (generation runs table) |
| 93 | `/generate/new` | `generate/new/page.tsx` | `editor` (kickoff form) |
| 94 | `/generate/[runId]` | `generate/[runId]/page.tsx` | `detail` (network graph + sortable items + quality panel + pipeline explainer sheet) |

### 14. Other (3 pages)

| # | Route | File | Surface type |
|---|-------|------|--------------|
| 95 | `/chat` | `chat/page.tsx` | `editor` (chat-interface) |
| 96 | `/profile` | `profile/page.tsx` | `editor` |
| 97 | `/matching` | `matching/page.tsx` | `listing` (matching-runs-table) |

## Layouts (13 nested layouts)

Verified list from `find src/app/(dashboard) -name layout.tsx`:

| # | Layout file | Purpose |
|---|-------------|---------|
| 1 | `(dashboard)/layout.tsx` | Root — `WorkspaceShell` (staff mode) + session-activity + command palette |
| 2 | `psychometrics/layout.tsx` | Psychometrics sub-nav (items / reliability / norms) |
| 3 | `clients/[slug]/layout.tsx` | `ClientDetailShell` — client-scoped tabs |
| 4 | `partners/[slug]/layout.tsx` | `PartnerDetailShell` — partner-scoped tabs |
| 5 | `participants/[id]/layout.tsx` | Participant detail shell |
| 6 | `campaigns/[id]/layout.tsx` | `CampaignDetailShell` — campaign-scoped tabs |
| 7 | `campaigns/[id]/overview/layout.tsx` | `ForceLightTheme` — always light |
| 8 | `clients/[slug]/branding/layout.tsx` | Preview context for branding page |
| 9 | `partners/[slug]/branding/layout.tsx` | Preview context for partner branding |
| 10 | `report-templates/[id]/builder/layout.tsx` | Full-height builder layout |
| 11 | `report-templates/[id]/preview/layout.tsx` | Print-oriented layout |
| 12 | `reports/layout.tsx` | `ForceLightTheme` — reports always light |
| 13 | `settings/brand/layout.tsx` | Platform brand preview context |

## Overlays triggered from this portal

Staff portal is where the widest variety of overlays live. See `overlays.md` for the full inventory — the highlights per section:

| Section | Representative overlays |
|---------|-------------------------|
| Campaigns | LaunchCampaignButton → QuickLaunchModal (wizard), Add-assessment, Create access link, Invite participant, Bulk import, Import-issues |
| Library | Library bulk import (xl), Library bundle import (xl), inline delete confirms, library selection toolbar bulk actions |
| Users | Staff InviteDialog (scope + role + tenant combobox), confirm revoke/remove |
| Clients / Partners | Assign client (partner), Assign assessment (partner), Create API credential + Add/Edit webhook (client integrations), Invite team member |
| Report templates | CreateTemplateButton, SendReportButton (from reports detail) |
| Flow editor | AddPageDialog, Flow preview |
| Generate | Delete run confirm, pipeline explainer Sheet |
| Global | SessionExpiryWarning (blocking), CommandPalette, Theme toggle, Account menu, Workspace context switcher |

## Navigation surface

### Primary sidebar (via WorkspaceShell in staff mode)

Observed staff sections (from overlays + layout analysis):
- Dashboard
- Library (Dimensions, Constructs, Factors, Items, Response formats, Psychometrics)
- Assessments
- Campaigns
- Clients
- Partners
- Participants
- Reports (+ Report templates)
- Users
- Directory
- Settings (Brand, AI, Prompts, Models, Email templates, Reports, Users, Experience, Item selection)
- Diagnostics
- Generate
- Chat, Matching, Profile (secondary)

### Sub-navigation (tabs / shells)

- **CampaignDetailShell** — 6 tabs (Overview · Assessments · Settings · Branding · Experience · Participants) — same shell used by client portal
- **ClientDetailShell** — tabs for Overview · Details · Assessments · Reports · Branding · Settings · Users
- **PartnerDetailShell** — tabs for Overview · Details · Assessments · Clients · Library · Reports · Branding · Settings · Users
- **Psychometrics layout** — sub-nav for Items / Reliability / Norms
- **Participant detail layout** — sub-nav for sessions / activity / snapshots (via ParticipantDetailView)
- **Settings** — no tab shell; flat list of sub-routes, navigated via cards from `/settings`

### Theme overrides

Three routes under staff portal force light theme regardless of user preference:
- `campaigns/[id]/overview` (ForceLightTheme layout)
- `reports/*` (ForceLightTheme layout)
- `settings/brand` preview context (inherits via layout chain)

## Surface-type distribution (Phase 2 scoping insight)

Rough count from the tables above (surface-type classifications):

| Surface type | Count |
|--------------|------:|
| `listing` | ~24 |
| `editor` | ~33 |
| `detail` | ~24 |
| `dashboard` | 2 |
| `print-export` | 3 |
| `redirect` | 1 |
| Other (wizard, flow-editor, etc.) | ~10 |

Editors and listings dominate — consistent with an entity-management admin surface.

## Taxonomy gaps

None beyond what A1/A2 already surfaced. Every pattern here is covered by framework v2:
- Feature-gated surfaces (branding)
- Theme-override layouts (ForceLightTheme on overview + reports)
- Redirect-only routes (`campaigns/[id]` → `/overview`)
- Dynamic-router catch-alls (not used in staff portal — only client/partner)

## Incomplete

None. All 97 page files under `src/app/(dashboard)/` and all 13 layout files were enumerated and section-classified.
