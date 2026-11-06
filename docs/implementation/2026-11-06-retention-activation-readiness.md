# Retention activation readiness — 6 November 2026

The scheduled deletion engine exists. This change only allows an approved
retention policy to be assigned without publishing or assigning a new participant
notice. It does not enable disposal, approve a live policy or modify campaign dates.

## Owner choices

- Recruitment: the previously selected starting period is 12 months after actual
  engagement closure; development is 24 months after actual engagement closure.
- Include existing campaigns only after reviewing their actual closure dates,
  purpose, agreed period, holds and proposed deletion scope. Do not infer closure
  from an invitation, response date or planned campaign closing date.
- Operations: Jason selected 90 days for diagnostics and two years for audit
  history. The current day-based policy field represents the latter as 730 days.
- New participant notices remain off. Retention-only changes preserve an existing
  notice, its enrollment boundary and any recorded closure. An explicitly chosen
  replacement must still be a published participant notice.

## Read-only current-state check

The authoritative pre-cutover database has two assessment policy drafts, with
their backup tails unset; no operations policy, campaign privacy assignments or
deletion requests were present. No campaigns are armed for assessment expiry.
That does not establish how many historic records would expire after review.
Both existing assessment drafts have research permission enabled. Prepare the
first retention rollout with that permission disabled unless separately approved;
approving retention must not silently approve research use.

A read-only preview of the selected operations periods found 176 diagnostic
events older than 90 days, no audit/legacy-account audit records older than 730
days, and no scheduled or overdue account-deletion requests. These are dated
observations, not an approved deletion manifest; repeat the preview at activation.

## What execution does

The hourly authenticated privacy sweep requires execute mode, an initialized
encrypted external ledger and an active operations policy. It reconciles holds,
expires permitted diagnostic/research records, queues eligible assessment
participants and processes leased deletion requests. The account-deletion cron
shares the execute-mode control, so review its pending scope too.

Assessment processing revokes access, checks holds and shared-copy blockers,
records a protected recovery manifest, removes object bytes and relational
dependencies, verifies absence and tracks backup/processor completion. Active
deletion is not proof every backup or recipient copy has disappeared. A database
backup does not include Storage bytes. Approved de-identified aggregate research
has a separate reviewed lifecycle; raw identifiable research is not kept forever.

## Remaining activation gates

1. Finish and verify the Sydney schema/app/data/Storage cutover with disposal off.
   The current approved cutover is still only PR445 and PR446. This follow-up
   needs its own release decision and is not silently added to that plan.
2. Inventory every database/PITR, Storage, migration export and retained Singapore
   recovery copy. Set a verified longest recovery tail; do not invent backup days
   merely to make the policy approvable.
3. Verify the independent ledger's access, persistence, namespace, encryption-key
   custody and protected recovery export. Preserve existing state. Never initialize
   a new empty ledger to hide missing history or change namespaces casually.
4. Rehearse a synthetic database-and-Storage restore in quarantine, replaying
   holds/deletions before any access, mail or normal workers can resume.
5. Review the actual participant/customer terms, complete the three policies,
   review existing campaigns individually and show the first expiry manifest.
   Publishing a new participant notice remains a separate decision.
6. Obtain the applicable owner decision for the exact target, policy versions,
   backup window, first scope and execute-mode side effects. Then verify natural
   cron execution, retries/review queues, holds and backup/provider completion.
   Returning to plan mode stops new disposal; it cannot undo a completed erasure.

The earlier local temporary cutover handoff and isolated CLI-auth directories
were not available at their recorded paths during this review. The scheduled
run already refuses missing protected inputs. Restore the operational package
and access in approved durable local storage before claiming cutover readiness;
source/CI records and owner decisions alone do not replace those inputs.
