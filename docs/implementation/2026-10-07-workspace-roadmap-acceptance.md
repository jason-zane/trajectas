# Workspace selectability: implementation and acceptance

**Current release evidence:** [2026-10-07-workspace-release-evidence.md](2026-10-07-workspace-release-evidence.md) supersedes the historical branch, publication and release statuses below.

This implements the approved follow-on to `docs/superpowers/plans/2026-10-06-workspace-features-and-experience.md`. It extends merged PR424 rather than replacing phase 1. The historical plan’s client Unified prohibition and release boundary describe phase 1; this follow-on supplies the actual client route and permits deliberate activation. Client-to-partner conversion, upgrades and ownership migration remain excluded.

## Original implementation boundary (historical)

- Current `origin/main` re-fetched before final validation: `edf762189b6053e5898de814fea1979b8f00d626` (PR424).
- Branch: `feat/workspace-roadmap` in its isolated `.claude/worktrees/feat/workspace-roadmap` checkout.
- EPP invitation visibility changes were integrated FIRST as separate local commits `5e11056d` and `ba0374bb`, corresponding to original `d46a9b314b246cd06a2801f838de49c6102878a4` and `fdf79da43dfe9674dfdf69564bc4cfa5560db40b`. Their source checkout is unchanged. Roadmap reconciliation preserves their diagnostic read predicates and tests.
- Existing release-workflow PR425 and performance PR426 remain separate. No package, lockfile, workflow, instrumentation or observability change is included. Their reported sharp audit blocker has not been weakened or folded into this work.
- Local code and synthetic fixtures only. No production migration, customer feature setting, record, membership, invitation, credential, resource, merge, push, PR or deployment was performed. Backup stash `workspace-roadmap-before-epp-integration` is retained for recovery.

## Implementation checklist

- [x] Add 33 module capabilities alongside the three independent insight flags and dashboard selector.
- [x] Preserve missing-row and empty-module compatibility defaults: published tools remain enabled, partner-only client controls remain unavailable to client workspaces, and client Unified remains off until explicitly enabled. No preset is applied automatically.
- [x] Keep phase-1 owning-partner selection, client licensing independence, aggregate intersection, selected/support confinement, empty-context denial and request-local caching. Database errors remain errors.
- [x] Gate supported pages, actions, exports, navigation, shortcuts and dashboard compositions while retaining existing allocations, quotas, roles, tenant predicates and confidentiality checks.
- [x] Add immutable Client / Partner starter / Full partner v1 presets, provisioning overrides, compatible dependency validation and audited change history.
- [x] Persist independent patches and reviewed batch changes through a transactional service-role RPC; reviewed batches compare the expected configuration and reject stale proposals. Provision owner plus settings atomically.
- [x] Require explicit review/application or cancellation for dependencies and preset changes to existing organisations. The server recomputes the proposal. Enabling missing prerequisites only proposes them; a single-field patch remains subject to database validation.
- [x] Supply the actual client Unified route, loading/error experience and shortcut; preserve exact-experience validation, multi-person rejection for individual trajectory and existing scope checks.
- [x] Integrate the separate EPP invitation fix without hiding appropriately authorised diagnostic reads or broadening roles. Hide mutation controls and block direct mutations when tenant team/client-management controls are disabled.
- [x] Replay both additive migrations and all 14 original workspace-feature DB/RPC/audit/backlog cases in disposable CI. Two added legacy-contract/forward-fix cases require final-head CI; see the [migration/recovery packet](2026-10-07-workspace-migration-confirmation.md).
- [x] Pass a normal optimized build, existing seeded browser suite and smoke suite on the exact published roadmap head in disposable CI. Dedicated new-feature browser rendering and hosted read-only acceptance are recorded separately below.
- [ ] Verify permitted production schema/compatibility/recovery and applicable read-only acceptance before the ordered migration/application release; no customer capability activation is implied.
- [x] Add webhook delivery pause with saved events and explicit bounded batch review before release; preserve event IDs and attempt budgets.
- [x] Keep scoped connection/backlog access independently reachable for existing partner client managers; preserve client-directory and metadata controls when off.

## Acceptance matrix

“Passed” below means automated synthetic unit/component evidence plus source review, not a live customer or browser exercise. The full suite includes existing authorization/content/confidentiality regressions; feature fixtures were made explicit without removing assertions.

| Scenario | Expected result | Evidence / status |
| --- | --- | --- |
| No stored settings; existing phase-1 rows with empty new modules | Current published customer experience; no implicit writes | `workspace-roadmap`, `workspace-feature-resolution`, existing `workspace-features`: passed |
| All eight insight combinations | Compare, individual and unified remain independent | Existing `workspace-features` tests: passed |
| Client/partner/aggregate/selected/support/empty contexts | Client uses own licence; partner-selected client uses only eligible owning partner; aggregate intersects; unrestricted admin remains unrestricted | `workspace-feature-resolution`, existing tenancy and production-route regressions: passed; real scoped ownership/RLS cases passed in disposable CI |
| Existing delivery disabled | Block new create/duplicate/activate, participant add/import and link issuance/reactivation; keep independently permitted historical campaigns/reports | Direct action denial and actual client/partner dashboard composition tests: passed |
| Previously issued self-enrollment links and participant tokens | Existing active issued access and enrolled continuation remain valid; existing expiry, campaign pause and withdrawal checks remain | `workspace-issued-access`: passed; no menu feature lookup in anonymous runtime |
| Assessment library prerequisite | Authoring and delivery require library; publishing requires authoring. Library disable proposes a transitive disable of authoring/publishing/delivery/360/integration launches | Catalogue and SQL consistency tests, preset validity and settings review/cancel tests: passed |
| Enable prerequisites | Show transitive proposal; Apply commits only the reviewed compatible batch; Cancel performs no write; no insight or unrelated delivery grant | `workspace-roadmap`, settings components: passed |
| Other prerequisites | Template authoring → template library; 360 → campaign management + delivery; integration launches → delivery; partner provisioning/management/allocations → client directory | Every declared dependency tested positively/negatively; presets validated: passed |
| Starter client directory | Browse assigned clients for delivery targeting; no provisioning, client edits or assessment/template allocations | `workspace-provisioning`, `workspace-roadmap`: passed |
| Overrides / concurrency / audit | One-field patches preserve other switches; expected batch rejects stale edit; history has tenant-filtered previous/next values and provenance | Resolver/RPC mock and component tests: passed. DB transaction, first-insert race, audit/rollback tests passed in disposable CI |
| Staff reports and exports | Historical report content can remain available while new signed PDF issuance/downloads are disabled; CSV rechecks exact insight or usage availability | `workspace-report-download`, `workspace-usage-export`, export and PDF route regressions: passed |
| Assistant and integrations | Existing assistant tools also enforce their underlying modules; new credential-authorised integration launches use client settings plus existing allocations/quotas | `workspace-roadmap`, integration confidentiality/routing regressions: passed |
| Integration inspection without client metadata/directory | Existing scoped managers reach the independent route; selected client uses current eligible owner across multiple memberships; absent/foreign ownership fails; selector stays minimal/bounded/partner-owned; original client tabs and metadata writes stay closed | `partner-integration-clients`, `partner-integration-org`, actual route/ancestor composition, settings/nav component tests: passed |
| Synthetic single-host workspace requests | Existing org-admin uses explicit own-client context; partner actor retains its existing memberships; explicit host mappings stay authoritative; empty/foreign contexts do not gain features | Harness routing, resolver, provisioning regressions: passed; existing seeded browser checks passed in exact-head disposable CI |
| Alternate surfaces and own-client administration | Public/assessment surfaces cannot bypass partner controls; client-surface editing/team exception requires the actual target in existing clientAdminIds/clientIds, never partner-derived management; team feature still applies | Synthetic direct-action own-client allowed, foreign/partner-only/unsupported surface denied and team-disabled regressions: passed |
| Team management and EPP inspection | Existing permitted pending/expired diagnostics remain inspectable; unavailable mutation controls disappear; direct staff mutations remain denied | Combined `outstanding-invites` unit/component cases and resolver/provisioning cases: passed |
| Client Unified | Actual client route accepts explicitly enabled unified, stays off by default, retains tenant scope and individual one-person limit | Production-route, client dashboard and feature-setting regressions: passed; dedicated Unified browser rendering unrun; existing browser suite passed and production activation remains off |
| Existing specialist products | 360, diagnostic sessions, role matching, outcome studies/reports, connection management, assistant and commercial reads keep their existing ownership/role restrictions | Source gate inventory, full existing regressions and per-flag availability tests: passed. Not a new specialist product or new ownership model |

The gate inventory has 389 source entries, and the route inventory has 130 feature checks. They include existing phase-1 insight gates, delegated helper checks and presentation checks; counts are a source-navigation aid, not proof that every product journey has run end to end. See `workspace-gate-inventory.json` and `workspace-route-inventory.json` for locations and actual checks.

## Explicit defaults and preset choices

Legacy defaults preserve all existing published module operations within their original roles. Presets instead start with explicit operational choices: assigned assessments/delivery, campaign/participant operations, report viewing/generation, assigned templates and usage. Starter also enables only the assigned-client directory. Full partner additionally enables content authoring/publishing and client provisioning/management/allocation. All three insights and specialist modules are independently selectable and off in presets. Downloads, branding/experience editing, identity/team administration, connections, assistant and billing visibility are also deliberate overrides; presets do not grant staff roles or invite anybody.

No capability removes allocations, resets usage, deletes data, changes tenant ownership or stops charging/background processing. Partner controls do not disable the client’s own administrative operations. Appropriately permitted platform admins in their unrestricted admin surface retain platform tools; selected tenants and support sessions continue to use actual enabled features.

## Continuation and remaining product decisions

Already issued self-enrollment links may continue to register people after portal delivery is disabled. New links and reactivation are blocked. This continuation policy was explicitly confirmed with the parent; revoking issued links is a separate policy and operation, not implied by disabling delivery.

`reportDownload` stops new staff signed-URL issuance and download operations. It does not revoke already issued URLs, recall previous downloads/browser data, alter storage/token security or change participant-token access. Report processing and valid issued participant continuation remain unchanged.

Webhook delivery uses the explicitly approved SAVE policy. Disabling holds existing pending/unfinished claims and saves new events. Re-enabling permits fresh delivery but does not drain held events. Authorised client managers review metadata for at most 100 events and explicitly release exactly those IDs. Stale/foreign/exhausted batches reject atomically; successful endpoint deliveries and event IDs are retained for deduplication. Requests already in flight cannot be recalled. See the current release evidence for implementation, migration ordering and tests.

`hiringRoles` and `participantCsvExport` are not offered because the corresponding proposed independent products/export operation do not exist in the current source. Existing role matching is controlled. Partner-owned diagnostic/role/outcome/integration ownership products and client-to-partner conversion are not created. Billing visibility does not change charging, payer or payment settings.

## Original local validation (historical)

Final command results are recorded in `workspace-validation.md`. Matching lockfile dependencies were copied locally; no dependency manifest was changed.

The additive migration `supabase/migrations/20261007074000_workspace_delivery_features.sql` is saved but **unapplied**. It retains existing scoped SELECT/service-role mutation boundaries and the existing private audited-trigger model. A release must first validate local schema/RPC permissions, invalid dependency rejection, race handling, optimistic conflicts, transaction audit and provisioning rollback. Existing integration tests include these synthetic local fixtures; source-consistency tests cannot establish SQL execution/RLS correctness.

Local Supabase CLI creation/help attempted a telemetry write outside the permitted roots and was denied; Docker socket inspection was also denied. Both actions stopped. Previously denied Vercel project/environment and Supabase DB reads were never retried through another interface. Do not substitute remote customer data for local acceptance.

Normal `npm run build` did not complete Turbopack compilation and was stopped (exit 130). The bounded alternative webpack build failed with `UnhandledSchemeError` for untouched `node:crypto` / `node:util/types` instrumentation imports. The parent supplied a historical reproduction at untouched `4dc792a2` with the same dependencies; that is limited evidence, not proof for this branch’s `edf76218` baseline and not a passing release build. No unrelated instrumentation change is included.

Browser/E2E and production activation are unrun. Any migration, activation, publication, merge or deployment requires its own authorisation after local DB/build/browser acceptance. No live customer feature choice has been made by this work.
