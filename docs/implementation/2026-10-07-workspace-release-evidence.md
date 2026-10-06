# Workspace release integration evidence

This supersedes the historical publication, dependency and release status in the original acceptance/local-validation reports. The acceptance matrix remains the product checklist. Current main was re-fetched: `edf762189b6053e5898de814fea1979b8f00d626` (merged PR424). Phase 1 is retained; standalone client conversion and ownership migration are excluded.

## Delivery and coordination

The integration branch `feat/workspace-roadmap-release` contains independent commits for Sharp, PR425 release orchestration, the EPP invitation visibility fix, roadmap controls, and PR426 performance work. The source worktrees and original roadmap commit `a664f2b2` remain preserved. An explicit RSC fixture integration commit retains cache isolation/authorization assertions and adds a disabled-feature regression. No assertions or gates were weakened.

| Separable PR | Current head | Automated result |
| --- | --- | --- |
| [427 Sharp](https://github.com/jason-zane/trajectas/pull/427) | `5ddb0095698bade23001c2b07f9d4991bb36e431` | Security, integration, normal build/quality and smoke passed |
| [428 EPP](https://github.com/jason-zane/trajectas/pull/428) | `9c46b8040ef9e6e2e1dfcaa5344fe6380215d023` | Security, integration, normal build/quality and smoke passed; stacked on 427 |
| [425 workflow](https://github.com/jason-zane/trajectas/pull/425) | `9f51741c` | All applicable jobs including normal build, seeded E2E and release-gate passed |
| [426 performance](https://github.com/jason-zane/trajectas/pull/426) | `106e42da` | Main CI and separate seeded E2E passed |

These changes remain unmerged. EPP visibility is first priority and is distinct from the separately unresolved zero-client directory symptom. Sharp is pinned to patched `0.35.5`; a clean locked installation and native PNG encode/decode passed. Actual production audit returned zero high/critical findings and 40 unchanged moderate findings. No registry transport exception was substituted for an audit result.

## Completed product checklist

- 33 supported module switches, three independent insight switches and dashboard selection, preserving missing-row/empty-module legacy defaults.
- Reviewed immutable v1 provisioning presets, transitive dependency proposals, explicit Apply/Cancel, stale configuration rejection and transactional audit/provisioning.
- Existing delivery, authoring/publishing, campaigns/invitations, reports/templates, client-management/allocation, usage and specialist modules gated within existing roles, allocations and tenant boundaries.
- Client Unified route and dashboard entry; default off, exact experience validation and individual single-person limit retained.
- Previously issued participant continuation/self-enrollment preserved; new issuance/reactivation denied when delivery is off. Staff download denial stops new URLs, not previously issued URLs.
- SAVE webhook policy: paused events remain saved and held after re-enabling; authorised managers explicitly review/release a bounded exact-ID batch. No new specialist product, owner migration or credential access.

## Synthetic validation

| Check | Result |
| --- | --- |
| Unit suite | Passed: 240 files, 3,215 tests |
| Component suite | Passed: 39 files, 213 tests |
| Architecture suite | Passed: 20 files, 97 tests |
| Release orchestration | Passed: six tests |
| Focused webhook/backlog/UI/RSC checks | Passed: four files, 32 tests |
| Typecheck / max-warnings-zero lint | Passed before final documentation; final repeat recorded in PR |
| Actual DB migration/RPC/RLS cases | Awaiting integration draft CI using disposable local Supabase; not run on this Mac because local CLI/Docker access was denied |
| Combined normal build / seeded / smoke / release-gate | Awaiting draft CI for final commit |
| Local release:validate / local smoke | Unrun as a combined runner: previous local process/server restrictions remain; no denied operation retried |
| Hosted authenticated acceptance / recovery rehearsal | Blocked; no synthetic seeding or writes against production |

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

No further retry or CLI/browser/account alternative will be used. Parent has asked the owner to resolve the Vercel scope and report the Supabase approval failure; repeated user approval is not requested. Missing permitted evidence: exact production deployment/SHA and automatic release policy, compatible recovery deployment, current schema/migration parity, restorable backup point/destination and applicable read-only acceptance. Production migration/merge/deployment remain held. No account settings, branch protection, credentials, production records or invitations were changed.
