# Sydney cutover after the privacy releases

This candidate starts from main `6a78e1837d14812eebf25d5d9b5311b1a7bd17f4`,
which includes privacy releases #443 and #444. It retains the reviewed report-logo
relocation from #442 and restores webhook destination validation, DNS pinning and
non-following redirects. It does not publish privacy notices, activate retention,
change scoring, rewrite delivered forms/snapshots, or execute a hosted migration.
The exact tested candidate and release decision belong in its PR and the private
cutover package. Do not deploy the older #442 head as a substitute.

## Source guard before maintenance

Fetch current main in the isolated candidate, confirm the owner's approved SHA,
then run:

```sh
node scripts/release/verify-sydney-cutover.mjs <approved-40-character-SHA>
```

The source-only guard requires the exact checkout, current-main ancestry, both
unchanged privacy migrations, Sydney functions and all **nine** reviewed cron
schedules. Run it before merging; after a squash merge verify the resulting tree
and deployed SHA separately. A green result is not target schema, provider,
backup or recovery evidence. Any later main/head change needs review and fresh
applicable final-commit CI under `docs/runbook.md`.

## Privacy schema before the application and final refresh

The 6 November read-only preflight found the Sydney copy at the pre-privacy
schema: 125 public base tables, all with RLS, and 546 public/private policies.
It lacked the privacy policy table, report archive field and observer helper.
The authoritative source had 135 public base tables, 547 policies and 11
privacy-related public/private tables. These are dated observations, not fixed
future inventory limits. Re-read the actual source and target at action time.

Apply and verify the following **only to the approved non-live Sydney target**,
in this order and with the exact action-time approval:

| Source migration | SHA-256 |
| --- | --- |
| `20261104195228_privacy_data_lifecycle.sql` | `5e9f0f3acf612556a0c6b58ad96cf27d44c070e86ba894b90c0bc082ba4be2ab` |
| `20261105013646_privacy_observer_erasure.sql` | `f0c94a288120fbd4bbedefa1d5f417ff8fd9d9ce4be87e7aebcb071bb4cec4b4` |

The source's provider-assigned history versions differ from the source filenames;
the private package records the mapping. Never rename applied source files,
blindly push the whole repository history, or repair unrelated hosted history.
Verify whether either migration is already applied before any retry. The schema
must be present before the new app can serve Sydney.

The old refresh/recovery scripts enumerate **152/159 tables** and omit the new
privacy tables. They are historical templates, not executable final acceptance.
Regenerate the target-only transactional refresh from a fresh consistent source
export and the current table/column/FK inventory. Include all privacy policies,
notices, receipts, campaign assignments, holds, deletion manifests/events, account
receipts, research cases, norm releases and the private action-context table.
Replace migration-seeded draft rows with the exact source identities as part of
that complete target refresh; do not merge independently generated seed IDs.
Rehearse the regenerated refresh with rollback before committing the final copy.
Preserve Storage metadata and independently reconcile/verify actual object bytes.
Compare the complete source inventory, immutable form/report checksums, current
schema and effective privileges. Do not label the old fixed-count rehearsal as
verification of the expanded schema. Keep all protected data out of Dev/Preview.

## RLS and grants must match before reopening

Compare source and target RLS flags and policy definitions, table/column/schema
and default grants, view `security_invoker` settings, function definitions,
owners, EXECUTE permissions and SECURITY DEFINER search paths. Enable RLS is
not equivalent to correct tenant policies. Do not widen browser grants to cure
a failed copy or test. The new privacy tables intentionally deny browser reads;
`privacy_*` RPCs must not be executable by anonymous or authenticated roles.
Verify the report archive restriction and rater/governing-hold helper, along with
existing passwordless triggers and tenant/support-session confinement. Capture
advisor results and bounded negative access evidence without participant data.

Sydney has no custom auto-enable-RLS event trigger in the observed catalog.
Existing tables already have RLS and new application migrations explicitly enable
it. A future automatic guard is useful defence in depth but does not generate
tenant policies or replace these checks; adding that new database behaviour is a
separate reviewed migration, not a silent dashboard side effect of this cutover.

## Preserve inactive privacy state and recoverability

Keep `DATA_LIFECYCLE_MODE=plan` through schema, data, application and scheduler
rollout. Preserve dedicated signing/encryption settings, including any configured
privacy-ledger key. Verify the external ledger's environment/project namespace
and recovery export; do not silently create a new empty namespace or reinitialise
lost evidence. Holds/deletion replay remain necessary even when the target is
restored from an earlier source snapshot. If recovery evidence cannot be made
current, stop before reopening and resolve it.

The latest source read found two draft retention policies and zero notices,
holds or deletion requests. Re-read and copy current states at the writer freeze;
do not assume they remain empty. Migration does not approve 12/24-month policy
activation or research reuse. Do not publish notices, assign campaigns, consent
on anyone's behalf, activate disposal, or invoke live privacy/account sweeps to
test readiness. Preserve the hourly privacy cron alongside the original eight
schedules; the plan-mode sweep must remain non-destructive.

## The coordinated cutover gates still apply

Preserve the existing Saturday 7 November 02:00 AEDT window, maintenance gate,
writer freeze/drain, fresh source database-and-bytes recovery export, target-only
refresh, Production-only settings, paired public email hook/key, owner-only
acceptance, old-browser skew boundary and single scheduler authority. Do not
start late or reopen after a failed gate. Keep Singapore and a compatible current
recovery deployment; the original pre-privacy deployment is not automatically
an acceptable rollback after privacy activation. After Sydney accepts writes,
do not reverse to stale Singapore without reconciliation. Exact project IDs,
private helper paths and the final commit approval remain in the private package.
