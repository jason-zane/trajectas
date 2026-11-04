# Privacy lifecycle verification evidence

Verified on 5 November 2026 (Sydney local time), from baseline
`473e8fa029100ad5696519b8ac23395d1a94585a`. The PR records the final commit and
its CI results; this file records local evidence and its limits.

## Isolation and commands

- Independent env-file-free checkout, branch `codex/data-lifecycle-20261105`.
- Disposable Supabase project `trajectas-privacy-20261105`, API
  `http://127.0.0.1:58321`, ports 58320–58324. Other local stacks were untouched.
- Pinned Supabase CLI 2.122.0. Used `supabase db reset --local --workdir
  /tmp/trajectas-privacy-stack-20261105` with repository migrations and synthetic
  seed symlinked into that task-only CLI directory. The final migration replayed
  from an empty local database successfully.
- Migration: `20261104195228_privacy_data_lifecycle.sql`; SHA-256
  `5e9f0f3acf612556a0c6b58ad96cf27d44c070e86ba894b90c0bc082ba4be2ab`.
- Integration launcher obtained only that local stack's generated keys from
  `supabase status --workdir … -o env`, asserted the exact loopback API origin,
  and passed them in memory to Vitest over `localCheckEnvironment(process.env)`.
  No provider credentials, inherited application endpoints or env files were
  loaded. This avoids the ordinary integration helper's default shared stack.
- Ran `vitest run tests/integration`, and separately
  `CAPACITY_DB=1 vitest run tests/integration/report-job-capacity.test.ts` through
  that isolated launcher. No service key values are part of this evidence.
- Ran `node scripts/release/validate-local.mjs` directly and unchanged. The
  managed shell needed compiler/browser permissions for build IPC; no check was
  bypassed. An earlier pass stopped at a new test fixture's incorrect preview
  type. That fixture was corrected and the entire validator rerun successfully.

## Final local results

| Check | Result |
| --- | --- |
| Release orchestration | 8 passed |
| ESLint / TypeScript | Passed |
| Unit | 3,397 passed in 265 files |
| Components | 242 passed in 45 files |
| Architecture | 97 passed in 20 files |
| Production build | Passed |
| Browser smoke | 7 passed |
| Integration, final migration | 559 passed, 16 intentionally skipped |
| Local report job capacity, separately enabled | 7 passed |
| New lifecycle integration within the full suite | 13 passed |
| SQL function lint | No new lifecycle warnings |

The full integration skip set consists of Stripe/provider channels and opt-in
capacity checks. Report capacity was exercised separately above. External
Stripe, AI and email-provider calls were not enabled. The local SQL lint retained
three baseline cast warnings across `save_responses_batch_for_session` and
`revise_library_item`; these functions were not changed. They remain separate
work, rather than being silently repaired to make this change appear clean.

Read-only PostgreSQL catalog checks on the final replay found 10 lifecycle
tables, all with RLS. Zero lifecycle tables grant browser-role SELECT. Zero
`privacy_*` functions in public/private grant anonymous or authenticated EXECUTE.
All lifecycle SECURITY DEFINER functions have an empty search path. All new
lifecycle foreign keys have supporting, non-partial indexes.

The lifecycle tests exercised draft/unapproved rejection, holds, concurrent
claims, stale lease rejection, access revocation, immutable notices/receipts,
Storage API deletion and peer preservation, quarantined restore replay, external
hold replay, verified Auth absence, aggregate-only release, source expiry,
atomic policy activation, bounded diagnostic expiry and processor-pending state
after replay identifiers expire. Unit tests additionally exercise incomplete or
lost recovery ledgers, authenticated encryption, file-journal integrity, partial
Storage failure, account ambiguity, administrative authority and research input
eligibility.

## Synthetic participant and report journey

Used an independent synthetic client, campaign, participant and new assessment
form. Existing delivered items were referenced unchanged. Outgoing providers
were absent; the app and print/PDF fetches used only the task's loopback server.

1. A signed-in synthetic platform administrator reached Privacy and retention.
   Draft policies were visible. The light appearance was visually inspected;
   the existing ThemeProvider does not activate a separate dark appearance.
2. An anonymous synthetic participant saw the assigned published test notice.
   Continue stayed disabled until acknowledgement. One receipt was recorded with
   the exact 64-character content hash; the optional research choice was disabled.
3. The participant submitted three responses. The session completed, processing
   reached ready and five construct scores were saved.
4. The report reached released with eight rendered blocks. A transient local
   harness URL problem was corrected, and the normal retry path succeeded.
5. The PDF worker returned processed=1, failed=0. Storage contained a 262,480-byte
   file with a valid `%PDF-` header. SHA-256:
   `35cb7c687912a1b4f433813fbcd0b96c6ce4b12b93212bd1a1a2658c5413bfcb`.
6. HTTP PDF access returned 401 anonymously and 200 application/pdf for the
   authorised administrator; downloaded bytes matched the stored PDF.

The synthetic fixture and its bearer links were deliberately excluded from git.
The disposable database was reset afterwards for the final migration replay.
No production participant or production report was used.

## Compatibility and recovery limits

Existing form-freeze integration cases passed; new forms add versioned research
metadata rather than changing historic answers or snapshots. Report capacity,
generation, access and stored report reads passed with the expanded schema.
Database recovery replay tests recreated synthetic pre-deletion participant rows,
then verified absence only after quarantined replay; holds preserved the subject.
File-ledger tests cover authenticated snapshot/journal corruption and file access.
This is not a provider backup restoration rehearsal or a measured production
RPO/RTO. Supabase Storage byte backup/restore still requires an approved solution.

No hosted migration, production deletion, published notice, provider credential,
email, paid resource, merge or deployment was performed. No authenticated hosted
Preview writes were attempted: a dedicated hosted synthetic target is not yet
verified. CI and the owner decision are recorded in the PR. The branch-protection
read previously denied with 403 remains unverified and was not retried elsewhere.
See [rollout and remaining decisions](2026-11-05-privacy-data-lifecycle.md).
