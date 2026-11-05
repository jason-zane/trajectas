# Follow-up to the PR 443 automated review

Both findings in [review 5777776463](https://github.com/jason-zane/trajectas/pull/443#pullrequestreview-5777776463)
apply to the tested source `65d2861` and deployed squash `622bdb0` (identical trees).
This branch fixes the implementation; it does not apply a hosted migration,
activate disposal or establish that existing external copies have been erased.

## Observer identity and recovery scope

The observer participant references `campaign_raters` with ON DELETE CASCADE.
That cascade runs from rater to participant, so deleting the participant alone
leaves the rater name, email and token behind. The baseline SQL reproduced this:
`privacy_finish_active_deletion` returned success while a query using the
synthetic rater token still found the rater row.

The new additive migration explicitly includes rater IDs in the manifest,
preparation, encrypted external ledger, relational purge and absence checks.
Preparation withdraws the selected raters. Related audit/integration records
include rater IDs and identifiers in their existing controlled cleanup scope.
Rater ownership/session checks prevent a cascade from expanding into a peer's
session or another campaign. Related subject holds pause observer disposal.
Newly discovered rater IDs require another preparation and confirmed ledger
write before erasure can finish.

Quarantined recovery checks rater absence and can remove an orphaned rater
restored without its participant. It verifies campaign, participant/session
scope and related holds first. Peer and subject records are preserved for an
individual observer request. Existing aggregate subject snapshots are not
recomputed by this change.

Older encrypted entries remain readable, including for export. If a deletion
entry lacks `raterIds`, recovery reports it blocked and unverified. An empty
database alone cannot establish that a separate rater row was erased. Do not
automatically add an empty array: any ledger upgrade needs reviewed source
evidence, the correct identifiers and the original expiry. If that evidence is
unavailable, preserve quarantine and resolve the case explicitly.

## Expired ledger index

Redis record TTLs do not remove sorted-set members. The old capacity guard ran
before cleanup, so a historical backlog above 10,000 permanently blocked reads.
The regression against the deployed class reproduced
`privacy_ledger_review_capacity` with 10,001 expired, absent members and one live
recovery entry.

Reads now prune expired, absent members in bounded batches before enforcing
capacity. Lua rechecks both current score and record existence atomically, so
renewed entries and present ciphertext keep their index membership. Active holds
have no expiry and remain indexed. The 10,000 live-entry guard, integrity checks,
missing-unexpired-record failure and time budget remain in effect. Large stale
backlogs can require repeated bounded attempts, with cleanup progress retained.

## Verification

Independent worktree from current main `622bdb0`; no copied env files or provider
credentials. Disposable Supabase `trajectas-privacy-review-20261105`, API loopback
59321, ports 59320–59324. Tests use only that stack's generated keys, passed in
memory through the isolated environment allowlist. The deployed migration was
replayed first to reproduce the SQL regression, then the full migration chain
was replayed with the follow-up. The already-applied source migration was not
modified.

- Observer regression: failed against the deployed SQL at the remaining rater
  token lookup; passed after the new migration.
- Ledger overflow regression: failed against the deployed class before cleanup;
  passed after the fix.
- Ledger/worker unit checks: 18 passed, including five new expiry/capacity,
  renewal, missing-record and active-hold cases.
- Observer integration: eight passed, covering individual and subject scope,
  peer preservation, rater-token absence, related holds, orphan restore, legacy
  entry refusal, foreign campaign/session rejection and manifest freshness.
- Complete integration: 567 passed, 16 intentionally skipped external-provider
  or opt-in capacity checks. Existing lifecycle cases still pass.
- Ordinary local validator passed release logic (8), lint, TypeScript, unit
  (3,402), components (242), architecture (97), production build and smoke (7).
  Two final integration cases were added afterwards; lint and types were rerun.
  An earlier validator pass caught an incorrect Redis generic signature; it was
  corrected and the whole validator rerun without bypassing checks.
- The exact Lua also passed on an ephemeral real Redis 7.4 server with synthetic
  keys: expired absent member removed; present ciphertext, renewed/missing
  renewed members and active hold retained.
- SQL lint: no privacy-function warnings; the same three baseline cast warnings
  in two unchanged functions remain. Catalog checks: all lifecycle RLS enabled,
  no browser table reads or RPC execution, fixed definer paths, all lifecycle
  foreign keys indexed.

Final-commit CI and owner release decisions belong in the follow-up PR. These
checks do not test a hosted restore, email-provider erasure or a live participant
journey. No production erasure or authenticated production write test ran.

## Release order and limitations

Keep production `DATA_LIFECYCLE_MODE=plan` throughout schema and app rollout.
The production-only value was read back as `plan`; the public Supabase URL still
identified active Singapore `rwpfwfcaxoevnvtkdmkx`. This follow-up changed neither.
Reverify the active mapping at release time; Sydney cutover remains separate.

Approve the exact follow-up migration, target and order under `docs/runbook.md`.
Apply `20261105013646_privacy_observer_erasure.sql` after the original lifecycle
migration, verify grants/schema, then deploy the reviewed app head. New workers
require explicit rater scope; old workers must not execute during a mixed-version
rollout because they cannot put rater IDs in the external ledger. Rollback must
preserve plan mode. Recovery uses the updated schema and runner together.

The original migration exists on active production under Supabase-assigned
history version `20261104235915`; its reviewed source filename/hash remain
unchanged. Do not blindly push or repair unrelated hosted migration history.
Before a future Sydney cutover, apply and verify both privacy migrations in
order, reconcile its lagging data/configuration, and follow the separate cutover
approval. Customer privacy wording, provider recovery and execute activation
remain outside this fix release.
