# Personality Profile Preview integration

30 October 2026. This candidate combines the assessment/quality pilot, reference
catalog and editions, dependency repair, and nine-page standard renderer. It is
for the existing Trajectas (Dev) target `bgrvqvtlhmfmvcytncgw`, not a production
release. Follow `docs/runbook.md` for release policy and action-time approval.

## Connected behaviour

- The standard report consumes the frozen native result **and** the snapshot's
  frozen 35-scale reference interpretation. It checks instrument/form/scoring
  identity, itemset hash, reference identity/method, native totals, label/direction,
  all ranks, and the supported N4/N6 comparator. Native POMP stays unchanged.
- Campaign selection/launch, automatic completion, manual editions and the report
  runner explicitly support both the comparison report and standard report.
  The standard report requires a reference; the older comparison can show scale
  scores alone. Draft, incompatible and cross-client references remain refused.
- The report shows the actual reference name/version, age range, weighting and
  edition. PDFs use the existing reference/edition filename support.
- The standard template's builder edits cover wording and all 35 display labels,
  definitions and endpoint descriptions. Measurement codes/directions and source
  questions are excluded from the strict presentation schema. Template writes
  require the existing authoring feature and template write access, plus the
  expected update timestamp. A stale editor must refresh rather than overwrite.
- Presentation settings are copied with template clones and frozen in the report
  generation manifest. Queued and delivered reports retain their original copy;
  a later edition uses the newly saved template. Pre-existing payloads continue
  to render with optional-field fallbacks.

## Research publication boundary

The runtime and synthetic tests do not import or seed the held source
histograms. The public integration is based on the already-public assessment
commit; the private norm branch's history/distribution artifacts are not pushed.

`import-ipip-reference-drafts.mjs` accepts an explicit private artifact, its exact
reviewed SHA-256, and the preparation decision file. It validates all 41 groups
and 35 native distributions, then writes **private** SQL outside the repository.
It makes no connection and does not activate/default a source reference. The
norm review/activation gates remain in place. Do not commit its generated SQL.

`prepare-personality-preview.mjs` likewise generates SQL only, and refuses any
target except the named development project. It prepares two **SYNTHETIC**
references, one synthetic client and a standard-template assignment for the
profile. A synthetic default is set only when no assessment default exists.
Real source references remain drafts, inspectable through the norm catalog after
private import, and are unavailable as operational comparison choices.

## Ordered development rollout

The original native/profile/quality migrations are already recorded in development
under provider-generated history; retain their source-hash receipts. Do not use a
blanket CLI push to force canonical timestamps into that history.

1. Review/apply the additive reference expansion
   `20261029230651_reference_catalog_and_campaign_defaults.sql` to verified Dev.
   It retains the legacy report unique constraint and disables extra editions.
2. Apply `20261030004647_personality_standard_reference_delivery.sql` to Dev.
   It adds presentation configuration, extends the standard-report guards and
   registers an inactive standard template without changing source scores.
3. Configure the dedicated Preview branch and deploy the identified edition-aware
   candidate. Verify it uses Dev and that old reports/completion remain usable.
4. Drain older Preview writers before applying contract migration
   `20261029231049_reference_report_editions.sql`. It enables editions and removes
   only the legacy two-column report unique constraint. After this step, rollback
   must use an edition-aware app; never delete editions to recreate that index.
5. Import the reviewed private source catalog as **drafts**, apply the reviewed
   synthetic fixture SQL, and verify source drafts, the two synthetic choices,
   active standard template/default assignment and private report storage.
6. Repeat the fresh-campaign/submission/report/PDF/alternate-edition acceptance
   against that identified hosted candidate. This does not approve real norms or
   production release, and does not substitute for a database/object restore.

## Dedicated Preview configuration

Branch: `codex/personality-preview-ready-20261030` in the existing Trajectas Vercel
project/team. Reuse the five existing IPIP Preview aliases so the approved Dev OTP
redirects remain valid. Set Preview-only overrides for this branch; do not alter
Production or another worker's branch.

Required target marker: `TRAJECTAS_PERSONALITY_PREVIEW_TARGET=bgrvqvtlhmfmvcytncgw`.
Browser/server database mapping must both identify Dev. The existing owner-added
Preview development server key is inherited without reading/copying its value.
Use dedicated signing material and separate surface hosts, leave cookie domains
unset, disable deployed auth bypass, and disable Stripe/AI/outbound app mail and
external integrations for this synthetic test. Supabase's own Dev OTP mail is
independent of the app's outbound-mail provider.

The dedicated branch's build guard rejects missing/unsafe mapping or settings
without printing values. It also refuses Production for this dedicated target.
Ordinary local/CI builds and unrelated deployments are unaffected.

The first attempt to set these branch-scoped values was **rejected by automatic
approval review** because specific sensitive signing values and database
configuration required explicit destination approval. No alternative route was
used. The separate attempt to apply the compatible reference expansion to hosted
Dev was also rejected because exact live DDL and target approval were required.
No hosted schema/configuration writes were executed. Obtain approval for the
identified SQL/target and scoped Preview settings before retrying either action.

## Reviewed SQL identity

SHA-256 values for the exact reviewed files:

| Change | SHA-256 |
| --- | --- |
| Reference expansion `20261029230651` | `98fad178d9206458d7ad6cc5463fcaaf6f9a3146377e1ab895233df7a566ced6` |
| Edition contract `20261029231049` | `fd40590462e68a8ec84f26a8ccf0cd784515d902637e97244e008e4929adbf81` |
| Standard delivery `20261030004647` | `f85de3dd551c266872a944bdefeaec8bca2867913c6923d2a2fc8b8515372f19` |
| Prepared private 41-draft import | `ec9f15e47a9e8701620f8fbaa232eab7882ff43f631d9323e592026f942c0f5d` |
| Prepared synthetic Preview setup | `61bfbe28eff396a266899a33a27472b4d6ef7f2f8c14d94626647757c302e7b1` |

The last two files are private operator scratch outside Git. Their generators are
reviewable in `scripts/instruments/`; their SQL is not a public source-data seed.

## Verification record

Local evidence uses an isolated synthetic stack, complete migration replay and
real passwordless session minting with the development bypass disabled. The full
database suite passed 564 tests (16 intentional skips). All 18 seeded browser
checks passed, including the fresh profile journey. Both actual nine-page PDFs were rendered and visually
reviewed across all 18 pages. PDF text assertions cover the reference identity,
version and internal trait headings, protecting against app-shell print rules.

The ordinary local validator, full seeded suite and final-commit CI readout are
recorded with the integration PR. Strict adapter/orientation, presentation write
access, stale-editor protection and Preview environment guards are automated.
Both prepared private import/setup SQL files passed a rollback-only local transaction
(41 source drafts, two active synthetic choices and standard-template activation).
Hosted acceptance and a database/object restore rehearsal remain unrun.

`tests/e2e/seeded/personality-report-journey.spec.ts` covers the complete path. The browser test creates
a campaign and configures its assessment/reference/report through the UI, enrols
a synthetic participant, starts a new session through the welcome link, answers
all 120 original questions plus eight separate
supplementary statements, resumes, completes, downloads a nine-page standard PDF,
then creates/downloads a different-norm edition while proving the first snapshot
and native scores unchanged. Its privileged fixture/auth helpers refuse hosted
URLs; session files stay in ignored auth scratch, outside uploaded artifacts.

The assessment itself remains scientifically versioned and read-only. Report
presentation and campaign/reference choices are editable in their own screens.
Changing scientific items/scoring requires a new instrument/form/reference
contract, preserving existing delivered forms and report snapshots.
