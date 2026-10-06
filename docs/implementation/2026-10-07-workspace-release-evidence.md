# Workspace release integration evidence

This supersedes the historical publication, dependency and release status in the original acceptance/local-validation reports. The acceptance matrix remains the product checklist. Current main was re-fetched: `5b1baa8bc251fdba66b985abd3c013c3744b6540` (PR424 plus separately released Sharp PR427, EPP PR428, performance PR426 and workflow PR425). The draft was reconciled onto it; duplicate released commits were dropped and EPP filter/share-dialog corrections retained. Runtime code, tests and migrations are byte-identical to reviewed green roadmap `b55f48fe`; only the independently released policy documents differ before this evidence update. Phase 1 is retained; standalone client conversion and ownership migration are excluded.

## Delivery and coordination

The integration branch `feat/workspace-roadmap-release` is based on actual released main and contains only the remaining roadmap controls/tests/evidence beyond it. PR426 released before the corrected PR425; both retained independent review, final-head checks and normal merges. No separate release was silently replaced by this draft. The source worktrees and original roadmap commit `a664f2b2` remain preserved. An explicit RSC fixture integration commit retains cache isolation/authorization assertions and adds a disabled-feature regression. No assertions or gates were weakened.

| Separable PR | Current head | Automated result |
| --- | --- | --- |
| [427 Sharp](https://github.com/jason-zane/trajectas/pull/427) | Reviewed `5ddb0095`; merged `f4f0f179` | Applicable checks passed; GitHub Production deployment 6896657256 success |
| [428 EPP](https://github.com/jason-zane/trajectas/pull/428) | Reviewed `98f66f1a`; merged `701a111b` | Applicable checks passed; GitHub Production deployment 6896919652 success |
| [425 workflow](https://github.com/jason-zane/trajectas/pull/425) | Reviewed `c4471d5a`; merged `5b1baa8b` | CI37544347037 all seven jobs passed; GitHub Production deployment 6897448321 success |
| [426 performance](https://github.com/jason-zane/trajectas/pull/426) | Reviewed `91ac8a47`; merged `5724f87c` | CI37543217889 all four jobs and both seeded runs passed; GitHub Production deployment 6897312699 success |

All four separable PRs released through normal reviewed exact-head green PRs; only the roadmap remains unmerged. GitHub records Production success at each merged SHA, not provider-specific READY/rollback availability. Authenticated EPP visibility remains unverified: the existing Chrome tab already displayed session-expired login, and no sign-in or invitation operation was performed. EPP is distinct from the separately unresolved zero-client directory symptom. Sharp is pinned to patched `0.35.5`; a clean locked installation and native PNG encode/decode passed. Actual production audit returned zero high/critical findings and 40 unchanged moderate findings. No registry transport exception was substituted for an audit result.

## Completed product checklist

- 33 supported module switches, three independent insight switches and dashboard selection, preserving missing-row/empty-module legacy defaults.
- Reviewed immutable v1 provisioning presets, transitive dependency proposals, explicit Apply/Cancel, stale configuration rejection and transactional audit/provisioning.
- Existing delivery, authoring/publishing, campaigns/invitations, reports/templates, client-management/allocation, usage and specialist modules gated within existing roles, allocations and tenant boundaries.
- Client Unified route and dashboard entry; default off, exact experience validation and individual single-person limit retained.
- Previously issued participant continuation/self-enrollment preserved; new issuance/reactivation denied when delivery is off. Staff download denial stops new URLs, not previously issued URLs.
- SAVE webhook policy: paused events remain saved and held after re-enabling; authorised managers explicitly review/release a bounded exact-ID batch. No new specialist product, owner migration or credential access.
- Independent partner integrations route: existing managers can inspect connections/backlogs with `integrationManagement` enabled while `clientDirectory` and `clientManagement` are off. The selector exposes only client ID/name/slug, bounded to 100 rows plus a next-page sentinel, with existing managed-client and owning-partner predicates. A selected manageable client resolves its current eligible owning partner, even for multiple partner memberships; absent/foreign ownership fails without unrelated membership fallback. Existing client tabs stay gated by their unchanged ancestor; metadata/branding controls remain hidden and direct metadata mutations denied.

## Synthetic validation

| Check | Result |
| --- | --- |
| Unit suite | Passed: 247 files, 3,258 tests before target-aware follow-up; five additional target/surface regressions passed within full coverage |
| Component suite | Passed: 41 files, 216 tests |
| Architecture suite | Passed: 20 files, 97 tests |
| Release orchestration | Passed: six tests |
| Full coverage | Passed after current-main reconciliation: 318 files / 3,643 tests; 65 files / 504 local DB/environment skips |
| Focused route/harness/composition and architecture checks | Passed: 28 files / 139 tests before owner correction; 25 files / 129 tests after owner correction, including actual-page multi-partner and foreign-owner denial |
| Typecheck / max-warnings-zero lint | Passed |
| Actual DB migration/RPC/RLS cases | Both migrations and all 14 workspace-feature cases passed in CI37542201735 at reviewed `b55f48fe`; the whole integration suite passed 548 tests / 12 skips. Reconciled final head requires fresh CI. Not run on this Mac because local CLI/Docker access was denied |
| Combined normal build / seeded / smoke / release-gate | Reviewed `b55f48fe` passed every job in CI37542201735, including normal build, 16 seeded browser tests, explicit Public fallback smoke and release-gate; final reconciliation requires fresh CI |
| Local release:validate / local smoke | Unrun as a combined runner: previous local process/server restrictions remain; no denied operation retried |
| Hosted authenticated acceptance / recovery rehearsal | Blocked; no synthetic seeding or writes against production |

The first draft CI replayed both migrations and passed all 14 real workspace-feature DB cases, but failed 39 other integration cases / 11 coverage cases because older synthetic action/chat fixtures lacked the new feature context. Explicit legacy licence fixtures retain their original role/RLS assertions; denied former-owner actions now allow an earlier AuthorizationError while still requiring denial. Independent review found four blockers: bulk activation bypassed delivery/360; admin campaign composition fetched disabled launch modules; alternate admin-surface partner calls skipped entitlements; and partner managers lacked the existing scoped backlog review UI. The reviewer verified all four corrections at `72663950`. Provisioning also remains gated on client surfaces despite partner memberships, while client admins retain their own scoped editing. The unnecessary extra campaign read was removed; the existing role-checked batch read supplies kind, and architecture rules pass without new allowlists. Independent integration-owner and target-aware entitlement corrections were subsequently reviewed clean, followed by clean `b55f48fe` reconciliation review. The final released-main reconciliation still requires exact-head review/CI.

CI at `72663950` passed normal build/quality, security and smoke, but failed two real client-transfer cases because their client-only actor requested a partner surface and ten seeded browser cases because the single-host harness manufactured identical portal hosts. Host resolution chose Public before pathname inference, producing disabled workspace context. The test-only runner now leaves absent surface mappings empty while retaining explicit process/file mappings, so existing localhost pathname inference selects each portal. Seed setup verifies the existing org-admin profile and own-client admin membership through its authenticated local RLS client before supplying that exact client's signed context with the test secret. Roles, memberships, browser assertions, production routing/authorization and public/no-context fail-closed behavior are unchanged. Explicit mapping retention, root own-client/disabled/foreign-context and alternate-surface denial regressions pass. These corrections are not a claim of browser or full real-DB success: final-SHA CI results are recorded in PR429.

Real local DB cases cover defaults, scoped ownership/RLS, concurrent first inserts, service-role RPC grants, dependency rejection, optimistic conflicts, audited presets/overrides, failed-provision rollback, queued-before-pause/new-while-paused events, re-enable without replay, exact release, stale batch rejection and audit. Unit/component cases cover cancellation, actor/client delivery denial, tenant predicates, metadata-only DTOs, claim invalidation before HTTP and held-event attempt preservation. They do not establish hosted recovery.

## Ordered migration and recovery boundary

Both draft migrations are additive and **unapplied**. Order:

1. `20261007074000_workspace_delivery_features.sql` — module catalogue/defaults/compatibility, existing service-role configuration RPC and private audit trigger model. SHA256 `27b54b17bcc2c8b1a8f6c1e946bdc4e76eb95ff92ebcb900d22b256899177be9`.
2. `20261007090000_workspace_webhook_backlog_review.sql` — review marker/hold triggers and service-role-only exact-batch release RPC. SHA256 `5b8feb0fadd229f47007c416c564e99012641944f51e812b1d9223215c508804`.
3. Deploy the compatible application only after schema parity, local replay, target and recovery evidence are verified. No production capability activations are included.

Held events use the existing terminal `failed` status plus `requires_review`; old dispatchers selecting pending events cannot drain them. Re-enable never clears this marker. Completed event/endpoint successes are retained; attempts are not reset. Release excludes exhausted events and preserves event IDs. Claim rechecks limit new sends after pause, but requests already in flight cannot be recalled; receivers still deduplicate IDs under existing at-least-once delivery.

Prior apps can coexist with additive schema/defaults, but do not enforce every newly activated module or offer explicit backlog review. Therefore a prior deployment is not universally safe after feature activation: verify the chosen rollback commit against actual configuration. App rollback does not undo schema, outgoing requests, invitations or data writes. Prefer a compatible forward fix; database recovery requires verified backup/restore destinations and approved reconciliation. No production restore is a test.

## Live validation blockers and owner decisions

Jason confirmed there is no Preview Supabase and authorised bounded production read-only validation plus safe release migrations after recovery checks. That exception does not permit production synthetic seeds, customer feature toggles, memberships/invitations or write-heavy tests. Local/CI fixtures remain synthetic.

The single authorised retry through each installed connection remained blocked:

- Vercel `get_project(trajectas, jason-zanes-projects)` returned **403 Forbidden**, stating the connection is not authorised for that scope.
- Supabase `execute_sql(rwpfwfcaxoevnvtkdmkx, SELECT current_database(), current_schema())` was rejected by **automatic approval review**, which did not recognise renewed user authority. No DB read executed.

No further retry or CLI/browser/account alternative will be used. Parent has asked the owner to resolve the Vercel scope and report the Supabase approval failure; repeated user approval is not requested. GitHub now verifies the four merged SHAs with successful Production deployments; main merge is therefore treated as production release under the approved interim workflow. This does not establish provider-specific READY/configuration or safe rollback. Missing permitted evidence: compatible recovery deployment, current schema/migration parity, restorable backup point/destination and applicable read-only acceptance. Production migration/merge/deployment remain held. No account settings, branch protection, credentials, production records or invitations were changed.
