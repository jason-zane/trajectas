# Findings — Client Portal (Phase 2-full)

Generated: 2026-04-18
Evidence: `docs/audit/screenshots/phase-2-full/client/` (32 captures across 14 surfaces × desktop + mobile)
Method: visited every surface logged in as seeded test client user (audit-cleanup-client@trajectas.test) against the Sample Data client org. Captures at 1280×800 (desktop) and 375×812 (mobile).

## Two production-breaking bugs surfaced during capture

These are **blocker-tier** — real errors that any client user would hit today.

### BUG-1 — `/client/campaigns` crashes with a runtime error

- **Evidence**: `02-campaigns-desktop.png`, `mobile-campaigns.png`
- **Error**: `Attempted to call buttonVariants() from the server but buttonVariants is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.`
- **Scope**: primary navigation destination. Every client who clicks "Campaigns" in the sidebar hits this.
- **Visible fallback**: Next.js renders its stock "This page couldn't load" card with a Reload button. Branded-ish but not our design system.
- **Likely root cause**: a server component on the `/client/campaigns` page is importing `buttonVariants` (from `src/components/ui/button.tsx`, which is `"use client"`) and calling it at render time. Needs either a "use client" boundary or to pass the variant as className at the callsite.
- **Fix priority**: SHIP TODAY.

### BUG-2 — `/client/campaigns/[id]/participants/[pid]/sessions/[sid]` never renders

- **Evidence**: `10-campaign-session-nested-desktop.png`
- **Error**: 23 console errors in dev tools, skeleton shown forever, content never resolves.
- **Scope**: the deepest view in the campaign drill-down — how a client reads a participant's session. Blocks the main "see this participant's results" flow.
- **Non-nested version works**: `/client/campaigns/[id]/sessions/[sid]` renders (see `11-campaign-session-desktop.png`) but has its own bug (see BUG-3). So the problem is specific to the 4-level-deep route's data fetch.
- **Fix priority**: SHIP THIS WEEK.

### BUG-3 — Session scores render with "Unknown" labels

- **Evidence**: `11-campaign-session-desktop.png`
- **What we see**: 24 factor scores displayed with values and bars (89, 82, 81, 77, …) but every row is labelled "Unknown" instead of the factor name.
- **Impact**: clients can see raw numbers but cannot interpret them. A 89 for "Unknown" vs for "Self-Discipline" is the difference between the feature being useful and being literally meaningless.
- **Scope**: affects the campaign session detail page (non-nested). Probably also affects report snapshots that share the same score-rendering component.
- **Likely root cause**: factor resolution is failing — the factor_id → factor_name lookup is broken, or the name column is being read from a stale relation.
- **Fix priority**: SHIP THIS WEEK.

## UX findings per surface

Desktop-first per product-owner scope decision. Mobile captured where it's relevant. Notable mobile issues are flagged per surface but not every breakpoint is scored.

### S-01 — `/client/dashboard`

- Desktop: `01-dashboard-desktop.png` · Mobile: `mobile-01-dashboard.png`
- **Passes**: clear PageHeader ("DASHBOARD" eyebrow + "Campaign operations" + description), 4 stat cards, "What do you need?" CTA card with three primary actions, Active campaigns grid with progress bars + per-card actions (Create link · Invite participants · View results), Recent results list.
- **Issue C-01-A** (minor): "Recent results" rows show participant email like `sample+f231ebc1-b7e1-49e7-b103-0bee6ca6296c@trajectas.local` — ugly synthetic emails leaking into UX. The list should show first/last name as primary + maybe a clean truncated email.
- **Issue C-01-B** (major, mobile only): at 375px the dashboard layout breaks — stat cards collapse to unreadable widths, "Active campaigns" section shows empty voids, "What do you need?" card content overlaps itself. Even though desktop is primary per scope, this is severely broken on mobile.
  - Likely cause: grid templates without proper breakpoint fallbacks for very narrow viewports.

### S-02 — `/client/campaigns`

- **BROKEN** — see BUG-1. No usable findings from this capture.

### S-03 — `/client/campaigns/create`

- Desktop: `14-campaign-create-desktop.png` · Mobile: `mobile-campaigns-create.png`
- **Passes**: breadcrumbs (Campaigns > Create), PageHeader, form sections grouped (Campaign Details, Access Window), labelled inputs, auto-slug from title, "Create Campaign" submit.
- **Issue C-03-A** (minor): page header text "New Campaign" appears low-contrast in dark mode — it's muted against the background. Compare with `/client/participants` which has a bright title.
- **Issue C-03-B** (minor): date pickers show browser-default `dd/mm/yyyy, --:--` placeholder styling. Could use a dedicated date primitive for visual consistency with the rest of the form.

### S-04 — `/client/campaigns/[id]/overview`

- Desktop: `04-campaign-overview-desktop.png`
- **Passes**: forced light theme is appropriate (matches design decision for metrics clarity), breadcrumbs (Campaigns > Overview), CampaignDetailShell with 5 tabs (Overview · Assessments · Participants · Experience · Settings), "Pause" + "Close" status-action buttons, **excellent** warning banner ("No assessments attached" with amber triangle + clear explanation), 4 stat cards, progress bar with 1 of 1 participants completed, Access Links panel with empty state.
- **Issue C-04-A** (minor): "Overall Completion" card shows a progress bar but the bar colour is almost identical to the card border — reduces visual contrast of the progress signal.
- **Strong pattern**: the warning banner UX is the best we've seen — copy this pattern elsewhere.

### S-05 — `/client/campaigns/[id]/assessments`

- Desktop: `05-campaign-assessments-desktop.png`
- **Passes**: empty state with clear copy ("No assessments linked yet. Add assessments to include them in this campaign."), "Add Assessment" CTA prominently placed, "0 assessments" count visible.
- **Issue C-05-A** (minor, pattern): the campaign title + "Sample Data" subtitle + "Active" badge in the detail shell look low-contrast in dark mode (muted grey). This repeats on every non-overview campaign tab (assessments, participants, experience, settings).
- **Issue C-05-B** (minor): the empty-state card has no icon or illustration — just the text. Contrast with `/assess/expired` which has a proper icon.

### S-06 — `/client/campaigns/[id]/participants`

- Desktop: `06-campaign-participants-desktop.png`
- **Passes**: Access Links card with empty state + "New Link" button, participant count ("1 participant"), Bulk Import + Invite buttons grouped, search input, sortable data table, pagination.
- **Issue C-06-A** (major): the participant row has an email column visible but the row is truncated at the right edge — "View Results" button is cut off. Requires horizontal scroll or the column is overflowing the viewport at 1280px. This is a width-management bug.
- **Issue C-06-B** (minor): same campaign-title-contrast issue from S-05.

### S-07 — `/client/campaigns/[id]/experience` (FlowEditor)

- Desktop: `07-campaign-experience-desktop.png`
- **This is a complex surface — deep-dive candidate.**
- **Passes**: 3-column layout (Pages list left, content editor middle, live preview right), "Using platform defaults" indicator, "Hide Preview" toggle, "Save Changes" button (disabled initially), light/dark/mobile preview toggle, "Preview Flow" button, drag-reorder pages list with Add Page, info items with remove buttons, button label / resume button label fields, well-organised page stages (Pre-assessment → Assessment → Post-assessment).
- **Issue C-07-A** (minor): "Save Changes" button visibility — when nothing is changed, the button is dimmed but present. Good pattern. No finding.
- **Issue C-07-B** (minor): the preview is labelled "Light" toggle but the campaign overview forces light theme — might be misleading. A participant never sees "Dark" unless a campaign configures it, which isn't visible here.
- **Issue C-07-C** (deep-dive): no keyboard-drag-reorder is obvious from a screenshot — needs D1 keyboard testing. Flagged for follow-up.

### S-08 — `/client/campaigns/[id]/settings`

- Desktop: `08-campaign-settings-desktop.png`
- **Passes**: Timeline card with "Created" timestamp, Participant Experience panel with 3 toggles (Allow Resume, Show Progress, Randomize Assessment Order) + sub-descriptions per toggle.
- **Issue C-08-A** (minor): toggle labels are clear but the toggle switches themselves are small (size-7 typical shadcn size) — on a settings page with descriptive text, the toggles could be slightly larger for tap affordance on mobile.
- **Issue C-08-B** (minor): no "Save" / "Saving…" indicator visible — are changes auto-saved? Needs B4 verification.

### S-09 — `/client/campaigns/[id]/participants/[pid]`

- Desktop: `09-campaign-participant-detail-desktop.png`
- **Passes**: PARTICIPANT eyebrow + Alex Morgan title + email + campaign context + COMPLETED badge, "Back to campaign" link (good escape hatch), participant-detail sub-tabs (Overview · Activity · Sessions · Reports), 3 stat cards (Sessions 1/completed, Completed 1/of 1, Total time 0m), Identity card + Most recent session card with "View session" link.
- **Issue C-09-A** (major, pattern bug): the CampaignDetailShell's outer tab bar shows "Overview" active even though we're on the Participants sub-route. The outer shell doesn't sync to the current route — same bug manifests on session-detail routes. Confuses the user about where they are.
- **Issue C-09-B** (minor): "0m Total time" looks broken — for a real assessment completed in under a minute, "<1 min" or "Just over 0 min" reads better than zero.
- **Issue C-09-C** (minor): the email below the name is `sample+f231ebc1-b7e1-49e7-b103-0bee6ca6296c@trajectas.local` — synthetic test email, but the UI doesn't gracefully handle long emails; it wraps awkwardly under the name. Add truncate-with-tooltip.

### S-10 — `/client/campaigns/[id]/participants/[pid]/sessions/[sid]`

- **BROKEN** — see BUG-2. No usable findings from this capture.

### S-11 — `/client/campaigns/[id]/sessions/[sid]`

- Desktop: `11-campaign-session-desktop.png`
- **Passes**: breadcrumbs (Campaigns > Sessions), "Back to participants" link, participant header, 4 stat cards (Assessment · Attempt · Duration · Factors scored), Started/Completed/Processed timestamps, Scores section with 24 factor bars, Reports empty state with "Open campaign settings" CTA.
- **Issue C-11-A** (critical): see BUG-3 — every factor name is "Unknown".
- **Issue C-11-B** (major, same as C-09-A): outer shell tab bar shows "Overview" active while breadcrumb/URL clearly indicates Sessions.
- **Issue C-11-C** (minor): "Duration 0m" again — same issue as C-09-B.

### S-12 — `/client/participants`

- Desktop: `03-participants-desktop.png` · Mobile: `mobile-02-participants.png`
- **Passes**: PageHeader ("PARTICIPANTS" eyebrow, "All Participants", "2 participants across all campaigns"), Participants/Sessions view toggle, search input, Status filter, sortable data table (Participant · Sessions · Latest Status · Last Activity), pagination.
- **Issue C-12-A** (minor, mobile): at 375px the table horizontal scrolls. This is acceptable for data tables on mobile (expected pattern) but the scroll indicator isn't visible — users may not know they can pan horizontally.
- **Strong pattern**: this is a clean data-table surface — one of the best-designed in the client portal. Reuse its patterns.

### S-13 — `/client/assessments`

- Desktop: `12-assessments-list-desktop.png` · Mobile: `mobile-assessments.png`
- **Passes**: PageHeader ("ASSESSMENTS" eyebrow, "Assessment library", "0 assessments available to launch in your campaigns"), "New Campaign" CTA, data table (Assessment · Format · Factors · Sections · Remaining quota · Used · Updated), empty table state with count.
- **Issue C-13-A** (major): "Nothing here yet" empty-state copy is extremely low-contrast against the dark background — text is almost invisible. Grep the codebase for this string and raise the text color or use Badge/Alert with `info` variant.
- **Issue C-13-B** (minor): for a client with 0 assessments, having a sortable table shell with no data is visual noise. Consider suppressing the table and showing only an empty-state card (like `/client/campaigns/[id]/assessments` does).

### S-14 — `/client/settings/brand/client`

- Desktop: `13-settings-brand-desktop.png` · Mobile: `mobile-settings-brand.png`
- **Passes**: breadcrumbs (Settings > Brand > Client), secondary sidebar with "Back to dashboard" + "Brand" nav, Building2 icon + "Brand customisation is not enabled" title + "Contact your administrator to enable brand customisation for your organisation." copy.
- **Issue C-14-A** (minor, pattern): same as `/assess/expired` — tells the user to contact admin but has no link/email/form. No recovery path.

## Cross-cutting observations

Derived from the 14 captures:

- **Pattern**: when a campaign detail sub-page is rendered, the CampaignDetailShell's inner tab bar works fine, but the OUTER shell (CampaignDetailShell container) incorrectly marks "Overview" active even when on nested routes like `/participants/[pid]` or `/sessions/[sid]`. This is a tab-highlight sync bug that affects ~6 surfaces.
- **Pattern**: dark-mode contrast is good on primary surfaces (dashboard, participants, brand-disabled) but breaks down on detail sub-pages where the campaign title/subtitle/badges appear muted. Consistent regression class.
- **Pattern**: "contact administrator" is shown as copy in three places (brand disabled, assess/expired, assess/join invalid token) with NO contact mechanism in any of them.
- **Pattern**: breadcrumbs appear consistently across campaign detail pages — pattern finding P-003 in the prior patterns.md was too broad; breadcrumbs DO exist on campaign-scoped routes, they're missing at top-level portal routes. Downgrade P-003 severity.
- **Participant data presentation is leaky**: synthetic sample emails (`sample+<uuid>@trajectas.local`) are visible in 3 places (recent results, participants list, participant detail). These would be real emails in prod but the UI doesn't gracefully handle long emails.

## Surfaces not captured or not usable

- **Desktop `/client/campaigns`**: bug blocked capture (BUG-1)
- **Mobile campaign sub-routes**: the headless Node script rendered 404s because the workspace context cookie didn't carry over. Not a real bug; mobile campaign sub-routes work fine for a logged-in user who navigated through the dashboard. Non-blocking for audit findings.
- **`/client/reports/[snapshotId]`**: no released snapshot was available in Sample Data; report-snapshot surface was audited via the admin `/reports/[snapshotId]` equivalent in Phase 1 (same rendering component).

## What a full-score pass would still add

I chose narrative per-surface findings over the 17-criterion-per-surface rubric because:
- The product-breaking bugs (BUG-1, 2, 3) dominate any scoring finding and should ship first
- Real evidence screenshots let the product owner see specifics in 5 minutes vs reading 21 scoring tables
- Patterns are easier to cluster from narrative than from scores

If we do want the 17-criterion scoring on top of this, a Sonnet agent can produce it from the existing captures + this doc as input in one focused pass. I'd estimate ~2 hours for that.
