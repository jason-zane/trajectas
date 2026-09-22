# Public homepage and Role Builder — design QA

**final result: passed**

Scope: rendered UI and controlled interaction checks. This is not live-service or release acceptance.

## Visual truth and comparison

Source: `docs/design/2026-09-21-public-experience/approved-direction.png`, 1159 × 1358 raster pixels. The user selected its feel, not literal copy or every ornamental detail. Source CSS size and device density are unavailable; treated as a 1× composition reference.

Implementation: `output/playwright/home-reference-size.png` at 1159 × 1358 CSS pixels, device scale 1. Additional full-view evidence: `home-desktop.png` (1440 × 1100), `home-mobile.png` (390 × 844 viewport), `verify-desktop.png`, `verify-mobile.png`, `brief-desktop.png`, `working-reading.png`, `working-matching.png`, `creating-mobile.png`, `review-desktop.png`, `review-mobile.png`, `review-mobile-summary.png`, `ready-desktop.png`, `ready-mobile.png`, all in `output/playwright/`. Full-page screenshots can be taller than the viewport.

Source and rendered homepage were opened together in the same comparison input. Homepage is the same unauthenticated light state, with illustrative Operations Manager content. The 1440 screenshot was first compared proportionally, explicitly accounting for the wider viewport; the source-size capture was then used to check composition. Builder screenshots represent new states derived from this visual system, not states present in the chosen source. Their banner identifies simulated responses. Screenshots are local ignored QA artifacts.

## Required surfaces

- Typography: existing Plus Jakarta Sans retains the strong geometric sans direction; clear display/body/UI hierarchy, readable line spacing and deliberate wraps. Mobile headings and controls fit down to 320px. Exact generated typeface is not known, so this is a direction match, not a font-identical claim.
- Layout: large headline, open white space, aligned role/capability explanation and narrow summary preserve the selected concept. Real responsive rows replace the mock's nested boxes and crossing connectors. Focus movement no longer scrolls the new heading above the navigation. Mobile review now has a sticky count/time link.
- Tokens: charcoal, white/mineral surfaces, restrained emerald actions and gold accent. Visible focus, error states and reduced-motion handling retained. Primary actions use modest corners instead of the mock's pill shape, consistently across the experience.
- Assets: existing official TrajectasLogo component, existing Lucide icons, semantic product content. No generated raster artwork is represented as functional UI. The concept's invented icons and connectors were intentionally simplified to labelled matching rows under the user's request for a clear production experience.
- Copy: examples explicitly labelled; no invented clients/statistics. The mock's unsupported sharing invitation is replaced by the existing one-person assessment/report journey. Invitation gate is stated before entry. Status text changes on real response boundaries; no fabricated percentage or timed completion.

## Findings and fixes

1. [P2, fixed] Step-heading focus scrolled past the shared navigation. Focus now uses preventScroll with explicit top reset; revised review screenshot includes header and step context.
2. [P2, fixed] Mobile review summary was below all capability rows. Added sticky selected-count/time and summary link; checked at 390px and 320px, including `review-mobile-summary.png`.
3. [P1, fixed] Length controls discarded manual swaps. They now preserve choices, append unused recommendations and describe shortening. Regression check covers same-length and expanded selections.
4. [P1, fixed] Recovery omitted role-description draft and matching retry could loop on expired verification. The owned description is restored (newer tab draft wins); expired matching sends the visitor to verification.

Post-fix captures were visually inspected. Independent Impeccable finishing review checked PRODUCT.md, DESIGN.md, approved direction and actual screenshots; all four material findings addressed. Single mechanical detector pass returned `[]`. No actionable P0/P1/P2 visual findings remain.

## Interaction and engineering evidence

- 119 tests pass across 23 component/unit/architecture files: gate mode, count limits, preserved selections, draft restoration, actual reading/matching transitions, failed email delivery and uncertain-create recovery.
- Typecheck, targeted ESLint and production Next build pass. Build emits the existing Edge Runtime deprecation warning.
- Browser checked real homepage example switching, invitation form and 320px overflow; builder demo covers role input, reading, matching, review, creation and ready states. Reduced-motion spinner computes to animation `none`; mobile review has no horizontal overflow.
- Browser console inspected: no application JS errors in the builder demo. Next development reports the existing report-only CSP upgrade-insecure-requests warning.
- No live database write, OTP/email send, AI request or assessment/report creation was used for validation. Those require staging acceptance before launch. The gate remains unchanged; nothing deployed.

## Checklist

- [x] Selected visual direction implemented consistently.
- [x] Real-operation progress, slower-request feedback and reduced motion.
- [x] Desktop/mobile checks, focus, selection and recovery fixes.
- [x] Automated checks and production build.
- [ ] Staging service acceptance before release.

## User-requested colour and rhythm refinement

The subsequent user review asked for more colour and differentiation while preserving the approved restrained style. The current homepage supersedes the white-only colour treatment above; its structure and factual copy remain the same. Compared the rendered full desktop and mobile page with the earlier captured implementation. New evidence: `output/playwright/home-colour-desktop.png` (1440px viewport), `home-colour-mobile.png` and `home-colour-mobile-top.png` (390px viewport). Browser rechecked example switching, FAQ expansion and no overflow at 390px/320px. Scoped `.px-home` rules leave builder styles unchanged.

Warm neutral base, green headline emphasis, pale sage capability destinations, deep green assessment outcome/process section, and muted gold closing panel establish clear page rhythm. Body-text contrast for the introduced pairings is at least 5.51:1; light text on dark sections is 7.06:1 or better. No new claims, imagery, dependencies or motion. Targeted ESLint and diff whitespace checks pass. No new automated tests needed for this presentation-only refinement. Final result remains passed for local UI scope.

## Coherent-site and capability-depth iteration

User-requested follow-up extends the approved system rather than reverting to the old marketing pages. Source direction remains the approved concept plus the inspected colour-refinement captures. Current browser evidence: `site-home.png`, `site-how-it-works.png`, `site-for-teams.png`, `site-contact.png` at 1440px; `contact-mobile.png`, `capability-depth.png`, `capability-depth-mobile.png`, `capability-detail-mobile-close.png`. The information pages carry the same sans hierarchy, cream/green/gold tokens, shared header/footer and action treatment. Builder detail uses semantic disclosure and definition lists, with the main action in the existing summary.

Fixed substantive gaps: three displayed example capabilities vs six claimed; a navigation arrow used for example switching; broken legacy section links; no dedicated contact destination; capability detail and alternatives too hidden. Three selectable examples now display six connections. Four retired paths redirect into current content. Contact includes pending, accepted and recoverable failure states, with mocked submission checks. Capability review now exposes actual supplied library descriptions/indicators and separates recommendations from alternatives; absent data is stated honestly. Grouped related links are not represented as a similarity model.

Checks: 108 component/unit/architecture tests plus 2 contact tests pass; 5 real-browser navigation/redirect smoke tests pass after correcting the test to wait for streamed redirects. Typecheck, targeted lint and production build pass. Browser checked all four site pages and extended builder review at 320px without horizontal overflow. No live enquiry, notification email, AI or assessment operation was triggered. Staging delivery/service acceptance remains outstanding. Demo behavioural indicators are explicitly illustrative; production uses the existing library content.

Final result: passed for local UI and navigation scope.

## Whole-role example, compact review and model explorer

Latest user request supersedes the expanded inline capability layout above. Rendered evidence: `whole-role-home.png`, `compact-review.png`, `capability-modal-library.png`, `capability-modal-mobile.png`, `model-explorer.png`, `model-detail.png`, `model-detail-mobile.png`, `model-unavailable.png` under `output/playwright/`. These were inspected against the approved colour system and preceding implementation. Full role summary replaces one-to-one mapping; compact two-line rows replace inline behavioural detail. The builder carries cream/sage/forest tokens while keeping selection and focus legible. Real library definitions were inspected in the modal on desktop and mobile, including longer copy.

Native-dialog Tab initially allowed browser-chrome focus at the boundary; explicit boundary handling now keeps keyboard focus within the dialog, with Escape and trigger restoration verified in-browser. Related navigation moves focus to the new title and resets the internal scroll. Background scrolling is locked while open. Browser checks cover 320px overflow, modal detail and model search/empty results. Five navigation smoke tests pass; 103 component/architecture tests and two narrow public-model DAL tests pass. Typecheck, targeted lint and production build pass. Model reads only active/non-deleted public reference fields, tested with mocked database responses.

A separate read-only query retrieved 29 current active capabilities for the ignored local demo snapshot; no questions, answer keys, tenant data or database writes were involved. This replaces illustrative definitions in the builder demo, while its role matching remains simulated. The production page reads live reference data, and the locally unconfigured database correctly shows the designed unavailable state. No model snapshot is bundled into the production implementation. Final result: passed for UI scope; live staging acceptance remains outstanding.

## Library preview integration fix

The initial preview handoff was incomplete: the real /capability-model route queried an unavailable local Supabase service, and some builder/footer links led there instead of the isolated snapshot explorer. Fixed with an explicit development-only PUBLIC_CAPABILITY_MODEL_SNAPSHOT option. The actual page now renders the snapshot with a prominent local-preview notice; production ignores the option and still reads the live library. No snapshot is bundled, and no production credentials are installed in the preview server. Replaced the dialog's native anchor with shared Next Link so harness links resolve to the real public route; removed the special click interception.

Browser verified homepage navigation and builder-dialog new-tab navigation both load all 29 capabilities at /capability-model. Search and details work. Evidence: output/playwright/library-fixed.png. Thirteen targeted tests and lint pass, including a production guard regression test.

## Core model management — 21 September 2026

- Added `/model-management` under Library → Core Model. The shared table provides search, group/readiness/channel filters, individual switches, bulk enable/disable, and capability editor links.
- Availability uses independent matching, assessment-building, and public-library flags. Existing matching and assessment defaults are preserved; public publication defaults off and requires an explicit choice. Draft assessment flags inherited as on remain blocked by readiness in the builder. Existing assessment compositions and saved role profiles are retained.
- Global administration requires platform-admin authority in an unconfined platform workspace. Public reads are restricted to active, published, platform-owned reference content. New manual assessment selections are checked server-side; existing selections can be retained. Internal system-scoped campaign creation retains its existing path.
- The migration adds two columns plus a service-role-only, security-invoker RPC. It locks and validates all selected rows before updating, preventing partial bulk changes. No migration or production writes have been executed.
- Verified migration against isolated PGlite PostgreSQL: defaults, independent flags, mixed-validity batch rollback, draft/tenant rejection, authenticated-role denial. This is not a substitute for the full local Supabase integration run; Docker daemon is unavailable.
- 35 targeted tests passed across eight files: policy, server-action validation/auth, public projection, component mutation/error/bulk-search behavior, shared table navigation, and architecture guards. Targeted lint and TypeScript checks passed.
- Browser preview `/manage.html` on port 3118 renders the actual component with explicitly simulated persistence. Verified individual switches, bulk controls after search, and no page overflow at390px. Screenshots in `output/playwright/model-management-{desktop,mobile,dark}.png`. Existing global theme currently retains its light palette when `.dark` is applied; this screen uses shared tokens.
- Browser testing exposed unstable filtered-array identity in the shared table, causing pagination resets/repeated rendering during search. Memoized the search result; added an accessible search label and regression coverage through the management bulk-selection test.
- New research task `01a0c194-f5e4-7b30-a04b-6e04185cf4b3` combines the prior Design leadership competency model discussion/artifacts with the five-category platform taxonomy; it does not change this implementation or production data.

## Production release verification — 21 September 2026

Docker/Supabase was started and the actual migration applied locally. Four real-database integration tests pass (independent flags, atomic rollback, public-content prerequisites, anonymous RPC denial). The migration has now been applied to production. It explicitly publishes the established active, categorised, non-draft reference capabilities, while future additions default private. Production verification confirms the RPC cannot be called by anonymous or authenticated roles. Supabase security advisors report existing auth-helper/password-protection warnings, none for the new security-invoker RPC. Full local unit/component/architecture sweep ran3164 tests; the three compatibility failures were corrected, and all34 tests in the affected files pass.

## Platform homepage expansion — 21 September 2026

The platform-first homepage keeps the approved public identity and makes the wider assessment offer clear. The former homepage is preserved at `/role-builder`; `/build` retains its existing verification and invitation gate. Shared navigation, supporting CTAs, canonical metadata and the public-route/sitemap registry reflect the new structure. `/how-it-works` now explains the wider platform method. Examples are illustrative, contain no synthetic scores, and use existing capability names.

Verified desktop1440px and mobile390px renders, with no page overflow. Keyboard operation of example controls works; reduced-motion navigation reaches the unchanged gated builder. Five browser navigation/legacy-redirect tests and45 targeted component/proxy tests passed. Targeted lint, TypeScript and production build passed. The independent Impeccable finishing reviewer found no material fixes. Screenshots are in `output/playwright/platform-home-{desktop,mobile,growth}.png`. This iteration is available for review at local port3119; the production website has not been changed by this iteration.
