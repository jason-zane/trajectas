# Workspace migration confirmation and recovery boundary

This is a review packet, **not approval to execute**. The latest direct local
approval permits schema/migration/permission metadata reads only. No production
migration, capability change, preset application, invitation operation or restore
has been performed. Final commit/check results are recorded in PR429.

## Verified starting point

- Target: production Supabase `rwpfwfcaxoevnvtkdmkx`, PostgreSQL 17.6.
- Current released application: `5b1baa8bc251fdba66b985abd3c013c3744b6540`;
  GitHub Production deployment `6897448321` reports success. Provider-specific
  READY, environment configuration and rollback controls remain unverified.
- Bounded metadata reads used the existing connection, read-only transactions
  and a five-second timeout. No customer rows or secrets were read.
- Relevant workspace/outbox columns, defaults, constraints, indexes, RLS,
  trigger, helper-schema access and provisioning/audit dependency columns match
  the expected starting schema. Roadmap columns/functions are absent.
- Phase-one history uses production version `20261006063715`, name
  `workspace_feature_settings`, for repository file `20261006061154`. Stored SQL
  and repository file MD5 are both `a0cfee70e7b1d2e43b3867ba557da0f2`; normalized
  audit-function body MD5 is `ed9d22371a217891e3800923eddaa695` in both. No history
  repair, rename or phase-one reapplication is needed. These fingerprints prove
  the compared content, not a full unrelated-database drift audit.

## Exact ordered changes requiring action-time approval

| Order | Repository migration | SHA256 | Persistent changes |
| --- | --- | --- | --- |
| 1 | `20261007074000_workspace_delivery_features.sql` | `27b54b17bcc2c8b1a8f6c1e946bdc4e76eb95ff92ebcb900d22b256899177be9` | Add module/provenance columns; permit deliberate client Unified while retaining client portfolio restriction; add validation/configuration helpers and patch/provision RPCs; replace the existing private audit function. |
| 2 | `20261007090000_workspace_webhook_backlog_review.sql` | `5b8feb0fadd229f47007c416c564e99012641944f51e812b1d9223215c508804` | Add held-review columns/constraint/index and hold triggers; add exact reviewed-batch release RPC. |

The first creates `private.workspace_feature_configuration`,
`private.validate_workspace_feature_configuration`, `public.patch_workspace_features`
and `public.provision_workspace_with_features`, granting execution only to the
existing `service_role` (and object owner), with PUBLIC/anon/authenticated revoked.
It replaces the already-existing postgres-owned, private SECURITY DEFINER audit
function without exposing it. The second grants the existing service role
execution of `private.hold_paused_webhook_event`,
`private.hold_existing_webhooks_on_pause` and
`public.release_reviewed_webhook_events`, again revoking PUBLIC/anon/authenticated.
New mutation/hold functions use SECURITY INVOKER. Existing service-role USAGE on
`private` is verified; no new schema-USAGE grant, login role, credential, tenant
ownership migration, authenticated write grant or RLS-policy change is proposed.
These are persistent database functions/privileges and must be included in the
specific production-migration confirmation, not inferred from read approval.

Each file is transactional. Neither performs a blanket data repair, applies a
preset or updates existing capability values. Module flags default to `{}` and
review markers to false; current customer experiences remain compatible before
deliberate new feature activation. Pausing later holds unfinished events and new
inserts; re-enable never automatically releases saved events. Review/release
preserves IDs and attempt counts. Already selected/in-flight requests cannot be
recalled, and receivers retain existing at-least-once deduplication.

## Synthetic recovery evidence and limits

`tests/integration/workspace-features.test.ts` runs only against whitelisted local
Supabase hosts, with synthetic owners/users/events. Disposable CI verifies:

- The exact deployed phase-one four-column settings SELECT/INSERT/UPDATE contract
  remains usable against expanded schema, preserving default empty module flags.
- An incompatible patch leaves settings and audit counts unchanged. A corrected
  dependency patch commits once with audit while retaining the old insight fields.
- Held events are absent from legacy pending scans. A legacy retry that writes
  pending without clearing the review marker fails the database CHECK atomically.
  Explicit authorized review makes the same ID pending without resetting attempts.
- Existing tests also verify failed-provision rollback, optimistic stale rejection,
  concurrent first writes, authenticated RPC denial and exact-batch release audit.

These are real database contract/transaction tests, **not** a full previous-app
browser rehearsal or provider backup restoration. They do not prove backup
availability, recovery time/data loss, Storage-object recovery or live acceptance.
The local Docker/process restrictions remain; final DB evidence comes from
disposable CI, not an alternate route to a denied local or production stack.

## Stop, forward fix and app rollback

1. Keep the released app serving and freeze new module/client Unified/preset
   activation during schema expansion. Apply only specifically approved files,
   in the order above, after recovery evidence is supplied. Record provider-assigned
   history versions and content mapping; never rename an applied repository file
   to conceal timestamp differences.
2. If either transaction fails, stop. Do not deploy the roadmap app, repeatedly
   retry DDL, edit live history or run a blanket reset/restore. A failed transaction
   leaves that file unapplied; if only file 1 committed, retain its additive schema
   with the old app and review a narrow forward fix for file 2.
3. Verify required columns, constraints, function grants/owners and both history
   entries through approved metadata reads before normal app merge/deployment.
   Require final-head CI and independent review; do not race automatic deployment
   with an incomplete schema expansion.
4. Before any new feature activation, the old app's database contracts remain
   compatible with additive schema. Actual provider rollback availability is still
   unverified. App rollback does not remove schema or undo outgoing requests,
   invitations, audit/events or subsequent valid writes.
5. After module overrides or client Unified are activated, the previous app cannot
   enforce all new licensing/review controls. Do not treat `5b1baa8b` as universally
   safe: prefer a compatible forward app fix, or obtain a reviewed configuration
   and rollback decision. Never auto-disable customer features or replay held events.

## Remaining evidence and final confirmation

The installed connection exposes no backup-list/restorable-point method. Obtain
only the existing backup/PITR latest available UTC point, retention/window and
actual restore method/destination, with accepted data-loss/recovery limits. Do not
perform a production restore as a test. Database backup alone does not establish
recovery of private PDF Storage bytes; this change leaves existing forms/report
snapshots and Storage objects unchanged. Vercel's earlier scope denial remains
blocked; do not retrieve unavailable settings through another interface.

Once evidence and exact final CI/review are complete, the confirmation must name
the target, the two IDs/hashes and order, the persistent functions/privileges above,
and subsequent normal release of the identified PR429 head. Read-only approval
does not cover those writes. No customer capability settings, memberships,
invitations, credentials, paid resources, protection/security settings or restore
operation are included in that migration/application release.
