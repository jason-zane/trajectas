# Client Portal Operations-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the client portal into a campaign-first operational surface where users can launch campaigns, copy/send links, invite participants, and find results quickly without learning the broader platform model.

**Architecture:** Build on the existing client routes and shared campaign shell. Do not replace the portal wholesale. Focus first on operational shortcuts and launch orchestration, then reshape campaign/detail/results surfaces. Reuse existing access-link actions and factor/construct selection logic where possible.

**Tech Stack:** Next.js App Router, React Server/Client Components, TypeScript, Supabase, Tailwind CSS, lucide-react, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-04-17-client-portal-operations-redesign.md`

---

## Key Reference Files

- Client dashboard page: `src/app/client/dashboard/page.tsx`
- Client dashboard UI: `src/app/client/dashboard/client-dashboard.tsx`
- Client campaigns page: `src/app/client/campaigns/page.tsx`
- Client campaign list: `src/app/client/campaigns/client-campaign-list.tsx`
- Client campaign redirect: `src/app/client/campaigns/[id]/page.tsx`
- Shared campaign detail shell: `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`
- Client participants page: `src/app/client/participants/page.tsx`
- Client global participants UI: `src/app/client/participants/global-participants.tsx`
- Client campaign participants page: `src/app/client/campaigns/[id]/participants/page.tsx`
- Client participant manager: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`
- Client assessments page: `src/app/client/assessments/page.tsx`
- Client assessment list/detail: `src/app/client/assessments/assessment-library-table.tsx`, `src/app/client/assessments/[id]/page.tsx`
- Quick launch button/modal: `src/components/campaigns/quick-launch-button.tsx`, `src/components/campaigns/quick-launch-modal.tsx`
- Campaign actions: `src/app/actions/campaigns.ts`
- Access links UI: `src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx`
- Factor/construct pickers: `src/app/(dashboard)/campaigns/[id]/assessments/factor-picker.tsx`, `src/app/(dashboard)/campaigns/[id]/assessments/construct-picker.tsx`
- Factor/construct selection actions: `src/app/actions/factor-selection.ts`, `src/app/actions/construct-selection.ts`
- Client portal nav: `src/components/app-sidebar.tsx`

---

## Delivery Strategy

Build this in five phases:

1. Shared operational primitives + dashboard data
2. Dashboard redesign
3. Launch flow redesign (`Launch campaign`, reuse, link-first sending, optional capabilities)
4. Campaign list + campaign detail + invite/result routing improvements
5. Participants/results polish + assessments de-emphasis + favorites stretch

Candidate comparison is explicitly deferred from this plan.

---

## Planned File Changes

### New files

| File | Responsibility |
|------|----------------|
| `src/components/campaigns/launch-campaign-button.tsx` | Replaces client-facing `Quick Launch` label with `Launch campaign` and opens the new launch dialog |
| `src/components/campaigns/launch-campaign-dialog.tsx` | New launcher entrypoint with `Reuse previous campaign` vs `New campaign` |
| `src/components/campaigns/reuse-campaign-panel.tsx` | Campaign picker/list for reuse flow |
| `src/components/campaigns/capability-selection-step.tsx` | Optional launch-step wrapper for capability selection grouped by higher-order taxonomy |
| `src/lib/campaign-access-links.ts` | Shared helpers for building/copying client campaign access-link URLs and choosing a primary active link |
| `src/app/actions/campaign-launch.ts` | Orchestration actions for launch/reuse flow if `campaigns.ts` becomes too crowded |
| `supabase/migrations/00XXX_campaign_favorites.sql` | Stretch: per-profile campaign favorites/pins |

### Modified files

| File | Change |
|------|--------|
| `src/app/actions/campaigns.ts` | Add duplicate/reuse action; optionally extend campaign summaries with primary access-link metadata |
| `src/app/actions/factor-selection.ts` | Extract or expose reusable persistence helper(s) for launch orchestration |
| `src/app/actions/construct-selection.ts` | Extract or expose reusable persistence helper(s) for launch orchestration |
| `src/app/client/dashboard/page.tsx` | Fetch richer dashboard data: active campaigns with primary link metadata + recent results |
| `src/app/client/dashboard/client-dashboard.tsx` | Full operational redesign |
| `src/app/client/campaigns/page.tsx` | Replace `Quick Launch` CTA with `Launch campaign`; align page with reuse-first flow |
| `src/app/client/campaigns/client-campaign-list.tsx` | Add direct row actions, copy-link prominence, and better open behavior |
| `src/app/client/campaigns/[id]/page.tsx` | Redirect campaign default route to the most useful operational tab |
| `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx` | Portal-specific client tab ordering/labels if needed |
| `src/app/client/campaigns/[id]/participants/page.tsx` | Support invite/link-focused entry from dashboard/list actions |
| `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` | Support deep-linked invite states, stronger results/report actions |
| `src/app/client/participants/page.tsx` | Align default landing from dashboard `View results` |
| `src/app/client/participants/global-participants.tsx` | Stronger `Open results` affordances from sessions/participants tables |
| `src/app/client/assessments/page.tsx` | Reframe as secondary operational library |
| `src/app/client/assessments/assessment-library-table.tsx` | Add stronger campaign-launch affordance from assessments |
| `src/app/client/assessments/[id]/page.tsx` | Align CTA wording with `Launch campaign` / campaign-first behavior |
| `src/components/app-sidebar.tsx` | Optional nav/order adjustments after dashboard work lands |
| `src/components/campaigns/quick-launch-button.tsx` | Either remove or convert into thin compatibility wrapper |
| `src/components/campaigns/quick-launch-modal.tsx` | Either evolve into the new launch wizard internals or reduce to “new campaign” step set |

---

## Phase 1: Shared Operational Primitives + Dashboard Data

**Goal:** Ensure the dashboard and campaign list can expose `Copy link`, `Invite participants`, and recent results without hacking around missing data.

### Task 1.1: Extract shared campaign access-link helpers

**Files:**
- New: `src/lib/campaign-access-links.ts`
- Modify: `src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx`

- [ ] Create `buildCampaignAccessLinkUrl(token: string)` helper.
- [ ] Create `getPrimaryActiveAccessLink(links)` helper that selects the best active link for operational surfaces.
- [ ] Update `CampaignAccessLinks` to use the shared helper instead of in-component URL string building.
- [ ] Verify no UI behavior changes in the existing access-links card.

**Notes:**
- This avoids duplicating `window.location.origin + /assess/join/{token}` logic across dashboard, campaign list, and participants.

### Task 1.2: Add primary access-link metadata to campaign summaries

**Files:**
- Modify: `src/app/actions/campaigns.ts`

- [ ] Extend the read layer so operational surfaces can get a campaign summary plus its best active access link.
- [ ] Choose one of:
  - extend `getCampaigns(options)` with `includeAccessLinks?: boolean`
  - or add a focused `getOperationalCampaignsForClient(clientId)` helper
- [ ] Ensure the result shape exposes enough for:
  - `Copy link`
  - `Invite participants`
  - `View results`
  - dashboard top-3 campaign cards
- [ ] Keep the default `getCampaigns()` path cheap for surfaces that do not need link metadata.

**Implementation recommendation:**
- Prefer a second query for access links keyed by campaign IDs rather than bloating the `campaigns_with_counts` view.

### Task 1.3: Add focused recent-results query for the client dashboard

**Files:**
- Modify: `src/app/actions/campaigns.ts` or `src/app/actions/participants.ts`
- Modify: `src/app/client/dashboard/page.tsx`

- [ ] Add a server action that returns the latest completed/in-progress participant/session results for a client.
- [ ] Keep the shape compact:
  - participant name
  - participant id
  - campaign id + title
  - latest session id if present
  - completed/last activity timestamp
- [ ] Fetch this data in `src/app/client/dashboard/page.tsx` together with operational campaign summaries.
- [ ] Verify the page can render with no active campaigns or no recent results.

**Recommendation:**
- Keep the action purpose-built for the dashboard rather than overloading the global participants action.

### Task 1.4: Verify data contract before UI rewrite

- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Confirm the dashboard page can fetch:
  - campaigns with primary access links
  - recent results

---

## Phase 2: Dashboard Redesign

**Goal:** Make the client dashboard the main operational home.

### Task 2.1: Rewrite the dashboard layout around actions and active work

**Files:**
- Modify: `src/app/client/dashboard/client-dashboard.tsx`

- [ ] Replace the analytics-first composition with an operations-first layout.
- [ ] Add a dominant action block with:
  - `Launch campaign`
  - `View results`
  - `Find participant`
- [ ] Add a compact top-3 active/recent campaign block.
- [ ] Add a recent-results block.
- [ ] Keep stats, but demote them visually below operational actions.

### Task 2.2: Add campaign cards/rows with direct actions

**Files:**
- Modify: `src/app/client/dashboard/client-dashboard.tsx`

- [ ] For each surfaced campaign, show:
  - campaign title
  - status
  - participant progress
  - `Copy link`
  - `Invite participants`
  - `View results`
- [ ] Clicking the campaign name should open the campaign.
- [ ] `Invite participants` should deep-link into the campaign participants surface with the right state already open.
- [ ] `View results` should deep-link into the campaign or global participants/results surface based on the chosen UX path.

### Task 2.3: Add a dedicated “campaign links” affordance

**Files:**
- Modify: `src/app/client/dashboard/client-dashboard.tsx`

- [ ] Make `Copy link` feel like a first-class dashboard action, not a secondary menu item.
- [ ] If there is no active link for a surfaced campaign:
  - either show `Create link`
  - or deep-link to the campaign participants/overview page where links are managed
- [ ] Keep this visually compact enough to support up to 3 campaigns.

### Task 2.4: Wire dashboard actions cleanly

**Files:**
- Modify: `src/app/client/dashboard/client-dashboard.tsx`
- Modify: `src/app/client/participants/page.tsx` (if needed)

- [ ] `Launch campaign` opens the new launch dialog.
- [ ] `View results` lands on the global participants/results surface.
- [ ] `Find participant` lands on the global participants page in the participant view.

### Task 2.5: Verify dashboard behavior

- [ ] Test:
  - no campaigns
  - draft campaigns
  - active campaigns with links
  - active campaigns without links
  - recent results present / absent
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`

---

## Phase 3: Launch Flow Redesign

**Goal:** Replace “Quick Launch” with a client-appropriate `Launch campaign` flow centered on reuse, safe sending, and optional capability tailoring.

### Task 3.1: Introduce `Launch campaign` wrapper UI

**Files:**
- New: `src/components/campaigns/launch-campaign-button.tsx`
- New: `src/components/campaigns/launch-campaign-dialog.tsx`
- Modify: `src/app/client/dashboard/client-dashboard.tsx`
- Modify: `src/app/client/campaigns/page.tsx`
- Modify: `src/components/campaigns/quick-launch-button.tsx`

- [ ] Add a new `LaunchCampaignButton` component with client-facing label `Launch campaign`.
- [ ] Add a new dialog wrapper that opens with two choices:
  - `Reuse previous campaign`
  - `New campaign`
- [ ] Replace the existing client-facing `Quick Launch` entrypoints with the new wrapper.
- [ ] Keep the old `QuickLaunchButton` only as an internal compatibility wrapper if needed during migration.

### Task 3.2: Add campaign duplication / reuse server action

**Files:**
- Modify: `src/app/actions/campaigns.ts`

- [ ] Add `duplicateCampaign(campaignId, overrides)` or `reuseCampaign(campaignId, overrides)` server action.
- [ ] Duplicate:
  - campaign record
  - campaign assessments
  - campaign access/config settings that should carry forward
  - experience/branding-related configuration if appropriate
- [ ] Do **not** copy:
  - participants
  - participant states
  - results/snapshots
- [ ] Generate a fresh slug.
- [ ] Return the new campaign id and enough metadata for the launch flow to continue.

**Recommendation:**
- Keep this action generic so it can later support admin/partner reuse, not just client portal use.

### Task 3.3: Decide orchestration path for launch submit

**Files:**
- Modify: `src/components/campaigns/quick-launch-modal.tsx`
- New or modify: `src/app/actions/campaign-launch.ts` or `src/app/actions/campaigns.ts`

- [ ] Introduce a launch orchestration action for the wizard submit path.
- [ ] This action should cover:
  - create or duplicate campaign
  - attach selected assessment if needed
  - apply optional capability selection
  - create participant invites or access link
  - activate campaign
- [ ] Prefer server-side orchestration over a long client-side chain of actions.

**Why:**
- keeps audit/revalidate logic centralized
- supports reuse and new-campaign paths consistently
- makes future dashboard launch actions easier to evolve

### Task 3.4: Add optional capability-selection step

**Files:**
- New: `src/components/campaigns/capability-selection-step.tsx`
- Modify: `src/components/campaigns/quick-launch-modal.tsx`
- Modify: `src/app/actions/factor-selection.ts`
- Modify: `src/app/actions/construct-selection.ts`

- [ ] Add an optional launch step:
  - default: full assessment
  - expandable: `Limit to selected capabilities`
- [ ] Group selectable items by the next higher taxonomy level.
- [ ] Keep the UI explorable/expandable rather than flat.
- [ ] Reuse the existing factor/construct selection validation and persistence logic where possible.

**Implementation recommendation:**
- Extract shared persistence helpers from the existing factor/construct server actions so the launch orchestrator can persist selections without duplicating validation logic.

### Task 3.5: Make sending link-first but peer with invite modes

**Files:**
- Modify: `src/components/campaigns/quick-launch-modal.tsx`

- [ ] Present these send methods as peer options:
  - `Copy link`
  - `Invite one`
  - `Bulk upload`
- [ ] Keep `Copy link` especially prominent.
- [ ] Ensure “reuse previous campaign” still lands on a confirmation step before sending.

### Task 3.6: Verify launch flow end-to-end

- [ ] Test:
  - new campaign + copy link
  - new campaign + single invite
  - new campaign + bulk upload
  - reuse previous campaign + confirm + copy link
  - optional capability selection
- [ ] Confirm participants are never copied when reusing.
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`

---

## Phase 4: Campaign List and Campaign Detail Behavior

**Goal:** Make campaign surfaces action-oriented and reduce the distance from “open campaign” to useful work.

### Task 4.1: Make `Copy link` the key campaign-list action

**Files:**
- Modify: `src/app/client/campaigns/client-campaign-list.tsx`

- [ ] Add an action column or primary row affordance for `Copy link`.
- [ ] Keep clicking the campaign name as `Open campaign`.
- [ ] Add visible secondary action: `Invite participants`.
- [ ] Use the shared primary-link helper from Phase 1.

### Task 4.2: Change client campaign default landing route

**Files:**
- Modify: `src/app/client/campaigns/[id]/page.tsx`

- [ ] Change the default redirect from `/overview` to the most useful operational tab.
- [ ] Recommended default:
  - `/participants`

### Task 4.3: Reorder client campaign tabs for usage, not configuration

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`

- [ ] Add portal-specific tab ordering for `client`.
- [ ] Recommended client order:
  - `Participants`
  - `Assessments`
  - `Experience`
  - `Overview`
  - `Branding` (if enabled)
  - `Settings`
- [ ] Avoid changing admin/partner ordering unless explicitly desired.

### Task 4.4: Support deep-linked invite actions from dashboard/list

**Files:**
- Modify: `src/app/client/campaigns/[id]/participants/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`

- [ ] Support query-parameter deep links such as:
  - `?action=invite`
  - `?action=bulk`
  - `?action=link`
- [ ] Auto-open the relevant participant-management UI state when arriving from dashboard/list CTA buttons.
- [ ] Preserve manual navigation behavior when no action param is present.

### Task 4.5: Improve empty/next-best-action prompts in campaign surfaces

**Files:**
- Modify: `src/app/client/campaigns/[id]/overview/page.tsx`
- Modify: `src/app/client/campaigns/[id]/participants/page.tsx`

- [ ] If campaign is active with no participants, show prominent `Invite participants`.
- [ ] If campaign has no access link, show clear path to create/copy one.
- [ ] Keep the UI focused on operational next steps rather than passive stats.

### Task 4.6: Verify campaign surfaces

- [ ] Test campaign list and campaign detail behavior:
  - open campaign
  - copy link
  - invite deep link
  - active campaign with no participants
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`

---

## Phase 5: Participants, Assessments, and Favorites

**Goal:** Tighten result-finding and assessment-launch behavior, then optionally add favorites/pins.

### Task 5.1: Strengthen global participants as the results hub

**Files:**
- Modify: `src/app/client/participants/page.tsx`
- Modify: `src/app/client/participants/global-participants.tsx`

- [ ] Ensure the global participants page is the right destination for dashboard `View results`.
- [ ] Strengthen `Open results` affordances from the sessions view.
- [ ] Keep participant search fast and clear.
- [ ] If the current actions menu is too hidden, pull `Open results` into a more direct row action.

### Task 5.2: Improve in-campaign result opening

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`

- [ ] Keep `View Results` visible and direct from participant rows.
- [ ] Evaluate whether a lightweight `Open report` affordance is cheap enough to add when a viewable report exists.
- [ ] Do not block this phase on report-link enrichment if it requires heavy new queries.

### Task 5.3: Reframe the assessments surface as secondary

**Files:**
- Modify: `src/app/client/assessments/page.tsx`
- Modify: `src/app/client/assessments/assessment-library-table.tsx`
- Modify: `src/app/client/assessments/[id]/page.tsx`

- [ ] Keep `Assessments` in the client nav for now.
- [ ] Update page copy to reinforce that assessments are used through campaigns.
- [ ] Add or strengthen direct launch/use affordances from assessment list/detail.
- [ ] Prefer `Launch campaign` / `Use in campaign` wording over admin-style builder language.

### Task 5.4: Favorites / pinned campaigns (stretch)

**Files:**
- New: `supabase/migrations/00XXX_campaign_favorites.sql`
- New or modify: `src/app/actions/campaign-favorites.ts` or `src/app/actions/campaigns.ts`
- Modify: `src/app/client/dashboard/page.tsx`
- Modify: `src/app/client/dashboard/client-dashboard.tsx`
- Modify: `src/app/client/campaigns/client-campaign-list.tsx`

- [ ] Add per-profile campaign favorites/pins.
- [ ] Recommended schema:
  - `campaign_favorites(profile_id, campaign_id, created_at)`
  - unique on `(profile_id, campaign_id)`
- [ ] Add toggle action(s):
  - `favoriteCampaign`
  - `unfavoriteCampaign`
- [ ] Show favorites above generic recent campaigns on the dashboard when present.
- [ ] Add a star/pin affordance in the campaigns list.

**Recommendation:**
- Keep favorites user-specific, not client-wide. This is a UX preference, not a shared operational template.

### Task 5.5: Verify final UX pass

- [ ] Manual verification:
  - dashboard to participants flow
  - campaign list to invite flow
  - assessment detail to launch flow
  - favorites if implemented
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`

---

## Explicitly Deferred

- Side-by-side candidate comparison
- Formal campaign templates beyond reuse/duplicate behavior
- Partner portal adaptation of this same operational model
- Client-to-partner upgrade workflow

---

## Recommended Sequencing for Actual Build Work

If this plan is implemented incrementally, the best order is:

1. Phase 1.1-1.3 — shared helpers + dashboard data
2. Phase 2 — dashboard redesign
3. Phase 3.1-3.3 — launch wrapper + duplicate/reuse + orchestration
4. Phase 4.1-4.4 — campaign list/detail operational behavior
5. Phase 3.4-3.5 — capability step + send-step polish
6. Phase 5.1-5.3 — participants/results/assessments polish
7. Phase 5.4 — favorites stretch

This yields visible UX wins early while keeping the more complex capability-selection work behind a stable launch architecture.

---

## Acceptance Criteria

- [ ] Client dashboard is task-first and centered on `Launch campaign`, `View results`, and `Find participant`.
- [ ] Dashboard shows the top operational campaigns with direct `Copy link`, `Invite participants`, and `View results`.
- [ ] Client users can start launch from one button and choose `Reuse previous campaign` or `New campaign`.
- [ ] Reusing a campaign carries forward setup, but never participants.
- [ ] Capability selection is optional, expandable, and grouped by higher-order taxonomy.
- [ ] Campaign list makes `Copy link` easy without hiding `Open campaign`.
- [ ] Opening a client campaign lands on the most useful operational surface.
- [ ] Dashboard and campaign surfaces can deep-link directly into invite flows.
- [ ] Participants/results can be found quickly from dashboard or participants pages.
- [ ] Candidate comparison remains out of scope for this build.
