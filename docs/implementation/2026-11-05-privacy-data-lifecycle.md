# Privacy and data lifecycle implementation

Scope: adult workplace recruitment and development, confirmed by Jason on
5 November 2026. No registered psychology/health services or minors in this
implementation scope. Source baseline: `473e8fa029100ad5696519b8ac23395d1a94585a`.

## Behaviour and rollout

Implement telemetry minimisation, finite browser cache, environment-isolated
operational keys, participant deletion, retention policies and holds, versioned
privacy notices/receipts, a restricted research workbench and operational evidence.
Policy drafts do not activate participant notices or irreversible retention jobs.
`DATA_LIFECYCLE_MODE` defaults to `plan`; `execute` is a separately reviewed
production rollout decision. Normal reversible removal continues to be distinct
from permanent erasure.

Deletion uses durable leased requests. Revoke runtime access before deleting
objects, keep a manifest across retries, recheck legal holds, delete database
dependencies, verify absence, then track provider tasks and backup expiry.
Shared outcome imports and unexplained external copies require an explicit
review task; they must never be silently declared erased or deleted wholesale.
Receipts have no participant name/email and retain replay identifiers only until
the approved backup/recovery window ends. Restores must replay the protected
deletion ledger before reopening traffic or sending notifications.

Research extraction requires a recorded permission decision and frozen version
metadata. Row-level workbench data remains personal information. Aggregate
release needs an approved risk decision; a random identifier alone does not
permit a claim of anonymity. No existing scoring, delivered form or stored
snapshot is recomputed by this change.

## Customer decisions

- Operating name: **Trajectas Intelligence**, confirmed by Jason. The public
  website and its repository footer did not expose an existing policy link.
  This is a bounded search, not proof no policy exists elsewhere. Drafts live
  in `src/lib/privacy/drafts.ts`; they are not published or seeded notices.
- Jason selected **12 months recruitment / 24 months development after
  engagement closure** as starting defaults. The migration creates draft policy
  versions with those periods. Their backup tail remains unset until verified.
- Jason selected **research in standard assessment terms, with legal review**.
  Optional research consent is supported for engagements that require it;
  it is disabled in the starting draft. Neither the selected wording approach
  nor a client permission alone proves that a secondary use is lawful.
- `hello@trajectas.com` is the published business contact used in the draft;
  Jason supplied the entity name but did not separately confirm that mailbox
  as the privacy contact. Confirm this during copy review.
- Australia-only contractual requirement and processor terms: unresolved;
  do not imply Sydney database hosting determines all processor locations.

## Verification

Use the isolated checkout and synthetic stack `trajectas-privacy-20261105`
(ports 58320–58324). No production credentials, rows or report files are used.
Verify negative access cases, legal holds, stale workers, partial object failure,
retry, backup-pending status, shared-data review blockers, privacy receipts,
research boundaries and compatibility with existing report/scoring behaviour.

Provider account settings, paid services and branch protection are not changed
as a side effect of code. The GitHub branch-protection read previously denied
with 403 remains unverified. Deployment and database activation follow the
repository's exact-commit release process after the concrete changes are ready.

## Implemented boundaries

- Unconfined platform administrators own policy, notice, hold, extraction and
  permanent-disposal decisions. Tenant workspaces, support and preview contexts
  cannot use these controls. Every new table has RLS and service-only grants;
  public policy reads project only published website text. No draft is returned
  to the public footer or privacy page.
- New notice assignments affect newly enrolled participants. Exact text hashes
  and append-only research choices are recorded without collecting an IP.
  Existing participants keep their delivered flow; their historic notice or
  research permission is not fabricated. Missing frozen research metadata
  blocks historical extraction for independent review.
- Approved expiry uses the recorded campaign closure, which cannot be reset
  by reopening the engagement. Draft rules never schedule deletion. Individual
  requests need separate approval. Leases fence stale workers; holds are checked
  before each new Storage operation. Shared outcome inputs and legacy PDF
  locations stop in review. Purge uses Storage's API and verifies metadata
  absence before cascading active relational data.
- The external AES-256-GCM ledger is acknowledged before removal. It preserves
  deletion replay and holds outside the database backup. Missing initialization,
  missing unexpired records or failed authentication stop processing. Metadata
  keys still contain opaque request IDs; the ledger is restricted personal data,
  not an anonymous analytics store. Active holds do not silently expire.
- Account receipts distinguish attempts, Auth absence and completion. A narrow
  service-only SECURITY DEFINER RPC verifies Auth absence without granting the
  service role general access to Auth tables. Account deletion disables the
  profile first; Auth removal alone cannot invalidate every already-issued JWT.
  Client assessment records have a separate lifecycle.
- Backup-pending requests retain minimum replay IDs until the longest approved
  recovery tail ends. Replay identifiers are then cleared even when an external
  task is unresolved; that request remains processor-pending and is not declared
  completed. Migration sources/exports, shared processor/support copies, and
  email/recipient copies each require evidence. An active operations policy enables bounded
  diagnostic, legacy account-audit and completion-receipt expiry; transaction
  scoped exceptions preserve ordinary append-only protections. Any active hold
  conservatively pauses unstructured diagnostic expiry.
- Restricted research rows expire within 90 days, or sooner at source expiry.
  Extraction uses frozen item versions, bounds and reverse direction; keyed
  formats require a different reviewed pipeline. Quality flags, internal tests,
  holds, withdrawn optional permission and explicit research exclusion block
  eligibility. Long-term releases contain aggregate construct means, sample SD
  and percentiles, with no source membership or individual response rows.
  They do not activate live scoring norms or recompute delivered reports.
- N=20 is a technical floor, not evidence of anonymity or psychometric validity.
  A reviewer must assess membership inference, small populations, unusual scores,
  overlapping releases, differencing and the actual release audience. Indefinite
  row-level response retention is **not enabled** by removing names or issuing
  random IDs. That would require a separate approved method and risk assessment.
- Public telemetry uses an explicit host/path allowlist and strips URL queries,
  fragments and referrers. Private assessment/report/portal routes are excluded
  from both Analytics and Speed Insights. Central diagnostics retain fixed error
  classes, recognised codes and allowed operational context; raw SDK messages,
  stacks, arbitrary records and email render/provider payloads are excluded.
- Acknowledged browser values are scrubbed immediately, retaining only revision
  tombstones for retry safety. Old fully synced sessions are removed after seven
  days on return. Unsent work is preserved. This cannot remotely clear an offline
  device; participant wording must explain shared-device handling.

## Ordered release and activation

1. Obtain final-commit CI/review evidence under `docs/runbook.md`. Verify the
   actual Sydney target and schema; never assume the parallel Singapore/Sydney
   projects establish active connection mapping. Approve the exact migration,
   target and order before any hosted write. The migration is additive, but the
   new app requires it first. Old app + expanded schema is compatible **before
   activation**; frozen-form and stored-snapshot reads remain unchanged.
2. Deploy the approved app with `DATA_LIFECYCLE_MODE=plan`. The new hourly cron
   returns a no-disposal result, and the account sweep is also paused. Review
   any already-overdue account requests explicitly; do not imply they ran.
3. Inventory every database backup, Storage backup, PITR window, migration dump,
   export and rollback copy. Choose documented RPO/RTO, backup destination,
   encryption/access and expiry. Supabase database backups do not include
   Storage file bytes. Provider backup configuration is still an operational
   dependency, not something this code silently provisions.
4. Configure a dedicated `PRIVACY_LEDGER_ENCRYPTION_KEY` through the approved
   secret store, independently in each environment. Do not reuse a signing key.
   Keep its recovery copy and the source environment/project namespace. Review
   Upstash access, region, persistence and independent backup arrangements.
   Production credential creation and paid encryption/backup changes require
   the applicable owner decision; none are performed by this branch.
5. Initialize a **new** ledger once with the recovery tool, then export an
   authenticated encrypted copy to the approved recovery store. Never
   reinitialize after ledger loss. Restore current evidence or stop disposal.
6. Review the participant notice, website policy and customer/DPA clauses.
   Confirm the legal entity form, contact, coverage, processor countries,
   closure event and retention overrides. The draft describes Singapore→Sydney
   migration and overseas email handling, not Australia-only residency.
   The existing account-deletion confirmation's broad “associated data” wording
   also needs review against the narrower account operation before activation.
7. Complete and approve draft policies using the verified longest backup window,
   then publish reviewed notice versions and assign them to campaigns. Record
   real past closure dates deliberately. Historic research needs separately
   evidenced permissions and compatible frozen scoring evidence.
8. Rehearse database **and bytes** restoration in quarantine. Disable outgoing
   email, billing, webhooks and ordinary workers; apply the migration, then replay
   external holds and deletions. Verify restored absence and preserved peer data.
   A replay success is one recovery check, not permission to reopen service.
9. Approve execute mode only after that evidence and processor procedures exist.
   Watch queue age, retry/review states, legal-hold reviews and backup tails.
   Email-provider and recipient-copy evidence is a manual task; an operator must
   not confirm it merely because the active database is clear. Processor terms,
   exact retention and recipient cooperation can limit the result.
10. Stop new disposal by returning to plan mode. After notices or permanent
    deletion have been activated, a baseline app rollback can bypass new reads
    or fail acknowledgement writes. Use a compatible build retaining privacy
    access/receipt guards, or keep affected traffic quarantined and forward-fix.
    An app rollback cannot restore deleted data. Do not restore a backup into
    traffic to undo a deletion. Singapore retirement is separately approved.

## Recovery runner

`node scripts/privacy-recovery.mjs --help` runs the shared audited modules via
a pinned build-only dependency. It does not load `.env.local` automatically.
Supply source ledger configuration from the recovery secret store. Use the
separate `PRIVACY_RECOVERY_SERVICE_ROLE_KEY` for the quarantined destination;
changing the source namespace would make existing ledger authentication fail.
No secret values belong in shell history or evidence.

```sh
node scripts/privacy-recovery.mjs --initialize-ledger --confirm-new-ledger
node scripts/privacy-recovery.mjs --export-ledger /approved/private/ledger.enc
node scripts/privacy-recovery.mjs --target http://127.0.0.1:58321
node scripts/privacy-recovery.mjs --target http://127.0.0.1:58321 --execute --confirm-quarantined
```

Hosted execution additionally requires `PRIVACY_RECOVERY_APPROVED_TARGET` to
equal the exact target origin and the applicable action-time approval. Never
point the runner at live traffic. It defaults to plan and does not send messages,
create credentials, change scoring or provision resources. Offline recovery can
use `--ledger-file /approved/private/ledger.enc --confirm-current-ledger` only
after its currency/completeness is established. It uses a locked, authenticated,
encrypted journal with owner-only permissions and durable atomic writes. A stale
backup is not silently substituted for the current external ledger.

## Assurance still requiring people and providers

The branch is not an ISO 27001 certification, SOC 2 report or legal opinion.
Keep the private audit/action register with the PwC work. Assign owners and
evidence for Privacy Act applicability, customer-purpose/APP 6 review, supplier
contracts/APP 8, breach response, access/MFA reviews, vulnerability treatment,
recovery, training, risk treatment, management review and the ISMS/SoA or SOC
scope. Provider attestations do not certify Trajectas. Preserve the denied
branch-protection read as unverified; do not route around it.

Primary guidance behind these gates: [OAIC APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information),
[OAIC de-identification](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/handling-personal-information/de-identification-and-the-privacy-act),
[Supabase backups](https://supabase.com/docs/guides/platform/backups),
[ISO/IEC 27001](https://www.iso.org/standard/27001),
[AICPA SOC services](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services).
These are supporting guidance, not a declaration that every rule applies in
every engagement. The private audit records the jurisdictional uncertainties.
