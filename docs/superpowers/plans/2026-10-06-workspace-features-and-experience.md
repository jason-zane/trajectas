# Workspace Features & Experience — implementation plan

Date: 6 October 2026. Owner: Trajectas platform administration.

## Product outcome

Provision an organisation for its expected relationship from the start, then enable tools individually as it becomes ready. A partner can use an operational dashboard and later switch to a portfolio dashboard. Compare, Trajectory, and Unified Trajectory are THREE independent capabilities: none automatically enables either of the others.

Executive Performance Partners is an example of a NEW organisation for this plan. Its current records, memberships, branding, and allocations are not to be changed or used as a provisioning template.

Feature settings control tools and presentation. Tenant ownership, content allocations, quotas, and staff roles remain separate. This project does not convert client data into partner data. Features that currently require client ownership need their own ownership work before being advertised for a partner’s own data.

## Trajectas admin experience

Open Directory → partner or client → Features & Experience. The first release contains Dashboard experience and Insights. Existing Assessments, Reports, Branding, Users, and Billing tabs continue to manage their respective allocations/settings.

Each supported capability has its own labelled switch and a concrete description. Switches take effect immediately, report success/error, and do not optimistically claim success before the server commits. There is no Save button for switches. Controls are disabled while a change is pending. A failed change preserves the prior state. Dashboard style is a separate selector.

Only an active Trajectas platform administrator, on the admin surface and outside any selected tenant/support context, can change these settings. Partner admins and client admins cannot grant themselves capabilities. Support sessions use the organisation’s real enabled features; support is not a bypass. Platform administrators in their unrestricted admin workspace retain platform tools.

Later sections are added only when both the UI and server gates are implemented. No switch should be shipped that merely hides a menu or suggests a currently unavailable feature works.

## Individual control catalogue

This is the complete proposed catalogue. “Existing” means a working allocation/setting already exists; it does NOT mean a broader module switch has been implemented. “First release” means this branch implements it. “Next” and “Later” are explicit outstanding phases.

| Group | Control / proposed key | What it allows | Important separation | Delivery |
| --- | --- | --- | --- | --- |
| Experience | Dashboard style / `dashboardStyle` | Default, operational, or partner portfolio presentation | Does not grant client management or change tenant scope; clients cannot use portfolio style | First release |
| Insights | Compare / `compare` | Side-by-side participant analysis, campaign comparisons, saved comparisons | Independent of individual and unified trajectory | First release |
| Insights | Trajectory / `trajectory` | One person’s results and linked assessment history over time | Multiple people require Unified Trajectory; legacy identity correction is separately role-gated | First release |
| Insights | Unified Trajectory / `unifiedTrajectory` | Multiple people, snapshot and time perspectives in one workspace | Independent of Compare and Trajectory; partner portal currently supports it, client portal does not | First release |
| Assessments | Assigned assessment library / `assessmentLibrary` | See assessments the organisation is allocated | Allocations still determine individual assessment access | Next |
| Assessments | Assessment delivery / `assessmentDelivery` | Launch new assessments using allocated content | View old results independently; licence/quota checks still apply | Next |
| Assessments | Assessment authoring / `assessmentAuthoring` | Create, duplicate, and edit owned assessments | Does not authorise edits to platform or another partner’s content | Next |
| Assessments | Assessment publishing / `assessmentPublishing` | Publish/activate owned drafts | Authoring prerequisite; content/fairness review gates still apply | Next |
| Assessments | Individual assessment access | Allocate each specific assessment | Existing allocation + active state + quota, not one all-assessments flag | Existing |
| Assessments | Assessment quotas | Cap usage per allocation at partner/client level | Disabling a module does not reset usage or remove the allocation | Existing |
| Campaigns | Campaign viewing / `campaignViewing` | Browse existing campaigns and participants | Kept available for historical access when new delivery is disabled | Next |
| Campaigns | Campaign management / `campaignManagement` | Create campaigns; edit details and schedules; activate, close, archive | Membership/manage gates still apply; publishing depends on delivery | Next |
| Campaigns | Participant invitations / `participantInvitations` | Add/import participants, invite and remind them | Separate from reading participant history | Next |
| Campaigns | 360 feedback delivery / `feedback360` | Configure raters and run feedback campaigns | Campaign management + delivery prerequisites; respondent confidentiality remains | Later |
| Campaigns | Participant experience / `participantExperience` | Customise campaign introduction, experience and flow | Approved content/runtime constraints still apply | Later |
| Reports | Existing reports / `reportViewing` | View authorised historical/generated reports | Separate from generating a new report or editing its template | Next |
| Reports | New report generation / `reportGeneration` | Generate reports from authorised completed results | Assigned template and role checks required | Next |
| Reports | Template library / `reportTemplateLibrary` | Browse/use allocated templates | Separate from template editing | Next |
| Reports | Template authoring / `reportTemplateAuthoring` | Create/edit owned report templates and previews | Template library prerequisite; ownership checks stay authoritative | Next |
| Reports | Individual template access | Allocate each specific report template | Existing assignment rules and ownership remain | Existing |
| Exports | Participant CSV / `participantCsvExport` | Export authorised participant/result records | Distinct from access to an insight tool; export role gate remains | Later |
| Exports | Insight CSV / `insightCsvExport` | Export from an enabled insight | Requires that insight; disabling Compare cannot disable Trajectory | Later |
| Exports | Report PDF/download / `reportDownload` | Download authorised reports and insight snapshots | Does not imply authoring or new report generation | Later |
| Partners | Client directory / `clientDirectory` | View the partner’s assigned client organisations | Partner feature; no access to unrelated clients | Next |
| Partners | Client provisioning / `clientProvisioning` | Create client organisations | Client directory prerequisite; staff must also hold partner-admin role | Next |
| Partners | Client management / `clientManagement` | Edit owned clients and manage their teams/campaigns | Client directory prerequisite; per-client manage checks remain | Next |
| Partners | Client assessment allocation / `clientAssessmentAllocation` | Allocate assessments/quotas within the partner’s pool | Partner pool and quota cap remain enforced in database | Next |
| Partners | Client template allocation / `clientTemplateAllocation` | Allocate eligible templates to owned clients | Global/partner ownership rules remain enforced | Next |
| Branding | Workspace branding | Customise partner/client brand layer | Existing flags and partner/client cascade remain authoritative | Existing |
| Branding | Campaign branding / `campaignBranding` | Customise a campaign’s participant brand | Existing brand edit gate + campaign manage permission | Later |
| People | Team management / `teamManagement` | Invite/manage workspace staff | Feature availability never grants admin role or reactivates a disabled account | Later |
| People | Identity correction / `personIdentityManagement` | Link/unlink participant records belonging to the same person | Client boundary and audit trail remain; separate from insight viewing | Later |
| Diagnostics | Organisational diagnostics / `orgDiagnostics` | Run organisational data-collection campaigns and view profiles | Currently client-owned; anonymity rules remain | Later |
| Hiring | Hiring roles / `hiringRoles` | Create/manage organisation hiring roles | Currently client-owned | Later |
| Hiring | Role/competency matching / `roleMatching` | Match roles and select relevant competencies | Distinct from public Role Builder; tenant feature cannot disable the public tool | Later |
| Outcomes | Outcome studies / `outcomeStudies` | Configure/import outcome studies and run analyses | Currently client-owned; role and data provenance checks remain | Later |
| Outcomes | Business outcome reports / `outcomeReports` | Generate/view outcome reports | Distinct from assessment report templates | Later |
| Integrations | Connection management / `integrationManagement` | Configure approved external connections and credentials | Currently client-owned; secrets never sent to browser | Later |
| Integrations | External assessment launches / `integrationLaunches` | Start new assessments from integrations | Delivery/allocation/quota prerequisites; existing launches continue | Later |
| Integrations | Webhook delivery / `webhookDelivery` | Send authorised events to configured endpoints | Turning off pauses new delivery; preserve outbox/history with an explicit replay policy | Later |
| AI | Workspace assistant / `workspaceAssistant` | Ask questions using authorised workspace data | Every tool independently checks feature and tenant scope | Later |
| Business | Usage reporting / `usageVisibility` | View the workspace’s period-based usage, campaign breakdowns and exports | Separate from billing and assessment quotas; tenant/report scope remains authoritative | Next |
| Business | Billing visibility / `billingVisibility` | View permitted commercial billing information | Does not stop invoices or change the payer; charging is commercial configuration | Later |

## Defaults and presets

First release preserves existing behaviour: no settings row means Compare and Trajectory on for both portals, Unified Trajectory on for partners and unavailable for clients, existing dashboard presentation. Adding a new capability later defaults it off unless an explicit backwards-compatibility migration preserves an existing published feature.

Presets are a subsequent provisioning feature, not a live policy that silently changes existing organisations. Applying a preset should show a diff and be one audited operation. Individual overrides always remain possible.

- **Client**: operational dashboard, assigned assessment delivery, campaign/participant operations, report viewing/generation, assigned templates; insight tools explicitly selectable. No partner client management or content authoring by default.
- **Partner starter**: operational dashboard, assigned content/delivery and reporting, no client provisioning, no assessment/template authoring, all three insights off until deliberately enabled.
- **Full partner**: portfolio dashboard, client management/allocation, assessment/template authoring and delivery/reporting; all three insight tools still independently selectable. Integrations, AI, outcome research and diagnostics are separate choices.

Do not apply any preset to existing organisations automatically. The new-partner form should eventually choose preset, dashboard style and individual features before invitations are sent.

## Resolution and enforcement

1. Resolve authenticated actor, signed active workspace and any support session using the existing authorization layer.
2. Resolve the feature configuration for the portal’s organisation(s). Partner portal tools use partner settings, including when that partner selects one of its clients as a data scope. For a selected client, require its ID in the resolved client set, then look up its current owning partner with a query constrained to that client ID and the authorised partner set. Other partner memberships cannot influence this selection; an unassigned or unauthorised owner enables no partner tools. Client portal tools use the selected client’s settings. A partner’s feature switch is not automatically copied to its clients. This intentionally separates the partner’s licensed tools from the client’s licensed tools.
3. An aggregate workspace across multiple organisations uses the intersection of their configurations. If organisations disagree, select one workspace before using the tool. Never let one enabled organisation unlock another by unioning flags.
4. Combine the enabled capability with existing content allocation, quota, tenant access and staff role checks. No flag widens a row-access predicate or lifts confidentiality rules.
5. Apply the same configuration to sidebar, shortcuts, dashboard widgets, server-rendered pages, server actions and export endpoints. Shared participant search requires at least one enabled insight. Scores/snapshots/export validate the specific requested experience; individual trajectory rejects a multi-person payload.
6. Cache only within one request. Read fresh settings on every new operation. Already-rendered pages may contain previously authorised data; revocation cannot recall a download or browser memory, but new operations must be blocked.
7. Database table: `workspace_feature_settings`, exactly one partner/client owner per row, distinct booleans for each insight, independent dashboard style. Authenticated users have scoped SELECT only; writes use a platform-gated service-role DAL. Audit event is written by a private database trigger in the same transaction.
8. A missing settings row uses explicit legacy defaults; a failed query raises an error, never “enable everything”. Updates patch one field; concurrent initial inserts retry against the existing row rather than replacing other switches.
9. Unsupported combinations are rejected in the application and database: client portfolio dashboard and client Unified Trajectory are not available in this release.

## Disabling and recovery

Insight off: stop new calculations, saving/opening comparisons, new snapshots and exports for that insight. Preserve source data and saved records. Re-enabling restores access under current permissions. The first release does not implement a separate read-only historical-insight mode. Already-generated report files remain governed by existing report access; their separate download control belongs to the reporting/export phase.

Delivery off (next phase): stop NEW campaigns/launches/invitations as defined by the separate controls. Already-issued participant tokens, assessments in progress, scheduled processing and historical reports need explicit continuation rules; default to allowing an enrolled person to finish. Never place a workspace menu flag in the anonymous participant runtime.

Dashboard changes do not stop background work. Billing controls do not disable commercial charging. Integration switches need separate intake/outbox handling. No feature change deletes data or revokes a staff membership.

## Implementation sequence and acceptance

### Phase 1 — Insights and dashboard (this branch)

- Dedicated settings schema and audit trigger; per-request tenant-aware resolver.
- Trajectas-only Features & Experience tabs for both partner/client records.
- Three independent insight switches, with Unified Trajectory marked unavailable on clients.
- Partner dashboard operational/portfolio presentation. Existing client dashboard is already operational; selecting operational retains that dashboard.
- Sidebar and participant bulk shortcut filtering; page/action/export checks, including saved comparisons and shared canvas loaders.
- Unit tests for independent combinations, empty/aggregate contexts, input validation, support-session restrictions and database failure behaviour.
- Local integration tests for SELECT isolation, blocked authenticated writes, per-field updates and transactional audit evidence.
- Component tests for immediate save/error handling and operational dashboard presentation.
- Validate typecheck, lint, architecture checks, affected insight regressions, local migration and browser rendering before PR/deployment.

### Phase 2 — Delivery, reporting and partner controls

Add the “Next” module switches in the table, with route/action inventory for each. Keep content allocations in their existing tables. Gate quick actions, create/edit/publish routes, server actions and AI/integration entry points. Add preview of dependency changes. Each new switch must have positive and negative tests before appearing in the UI.

### Phase 3 — Provisioning presets and dependencies

Choose a preset on partner/client creation; optionally apply it to an existing organisation after a concrete diff. Add immutable preset versions, individual overrides, audit/history and dependency validation. Dependencies never couple the three insight flags. Disable a prerequisite only after showing the dependent capabilities that will be disabled; apply the approved change atomically.

### Phase 4 — Specialist modules and ownership work

Add remaining “Later” controls from the catalogue as their owning features mature. Treat partner-owned diagnostics/roles/integrations and full client-to-partner conversion as separate migrations, with separate acceptance criteria. Client Unified Trajectory requires an actual client route and tested scope/UX before its switch can be enabled.

## Verification matrix

Test all eight combinations of the three partner insight flags. Include Compare off + Trajectory on and Trajectory off + Unified on. Test no settings, database unavailable, no authorised tenant, selected client, selected partner, aggregate multi-membership, platform admin, tenant-selected admin and support sessions. Test bookmarked global/campaign URLs, saved configurations, direct server action calls, invalid experience strings, multi-person calls disguised as individual and CSV requests. Test cross-tenant participant IDs remain rejected when every feature is enabled.

For presentation, verify menus and shortcuts match enabled features, no empty Insights heading remains, operational dashboard hides portfolio/client-allocation blocks while keeping authorised campaign activity, and settings pages are keyboard-accessible and use the shared theme tokens. The current dashboard theme provider is light-only; a real dark palette must be checked when shared theme support returns. Confirm feature updates leave campaigns, participants, responses, membership IDs, branding and billing rows unchanged.

## Release boundary

This is a staged implementation. Only Phase 1 is being built now; the remaining catalogue is the detailed follow-on plan. Do not advertise future module switches as already enforced. Apply the additive migration to production only after local validation, following AGENTS.md, then create a PR and follow CI. Existing feature values are never changed during deployment.
