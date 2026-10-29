# IPIP-NEO-120 implementation

Prepared 29 October 2026, with approved display names and POMP scoring. Jason
requested **active** status in Preview on 30 October 2026. The additive
`20261029224131_ipip_neo_120_profile_presentation.sql` migration brands it
**Trajectas Personality Profile**, retains the IPIP-NEO-120 source reference,
removes scientific code prefixes from the 65 library descriptions, and activates
the complete assessment. Taxonomy and item reuse stay locked. The original draft
import is historical and unchanged; its generator still reproduces that import.
Application grants, canonical items, score-label version, keys and result snapshots
are unchanged. The definition trigger is restored inside the same migration
transaction before the ordinary content guards validate each presentation update.
Production has not been migrated. Environment execution evidence belongs with
the PR and the development bootstrap receipt; generated files are not receipts.

## Native assessment contract

- Five dimensions, 30 facets, 30 locked one-to-one factor mirrors and 120 items.
- Scientific names, slugs, stems, ordering and published item keys are preserved.
- Original itemset `johnson-2014-table1-v1`; scoring `ipip-neo-120-raw-v1`;
  presentation `trajectas-personality-labels-v1`.
- Native forward response = value; reverse = `6-value`. Four items per facet
  give totals 4–20; 24 items per dimension give totals 24–120.
- POMP = `100 * (sum - itemCount) / (4 * itemCount)`.
- The primary display is **Scale score (0–100)**. Native totals and means remain
  in the versioned result. There is no overall personality score or percentile.
- N4 Social Confidence and N6 Stress Tolerance reverse **for display only**:
  displayed sum = `24-nativeSum`; displayed mean = `6-nativeMean`;
  displayed POMP = `100-nativePOMP`. Emotional Reactivity always aggregates
  the original six native facet totals, never the two reversed displays.
- Fairness describes reported avoidance of cheating, exploitation, manipulation
  and obstruction. Perceived Competence is self-report, not tested ability.

Descriptors, low/high indicators, anchors, context and reflection text are
complete in the library import. They are authored Trajectas descriptions, not a
published interpretive manual or evidence of leadership effectiveness.
`label-map.csv` gives every scientific-to-display name and direction.

## Delivery, scoring and persistence

`ipip_neo_120_v1` dispatches completed sessions to the strict native scorer.
Canonical UUIDs resolve to stable q001–q120 identities. Both application and
Postgres validate the entire frozen form, item versions/hash, order, section and
120 valid unique answers. Campaigns cannot select a subset; generic item caps
and randomization do not apply. Native items and facets cannot be reused in a
partial custom assessment. Imported library content and form configuration are
immutable; a changed instrument needs a new explicit version.

`persist_ipip_neo_120_result` independently checks native sums against responses,
checks display statistics, and atomically stores 30 factor score rows plus the
35-scale envelope in `participant_instrument_results`. Identical submission
retries converge on the stored result. Native raw totals are retained separately
from display POMP. Score rows use `metric=personality_pomp`, so competency claims guards refuse
them. No composite or norm fields are populated. Result edits are
blocked; deletion through the parent session's authorized cascade remains
possible for privacy/retention compatibility.

Existing assessment profiles and delivered snapshots retain their behavior.
New schema is additive. The initial draft import is followed by the explicit
catalogue-presentation and activation migration described above. Importing the
CSV through the generic importer is unnecessary: the dedicated migration creates
all required records atomically and checks collisions on repeat execution.

## Database and acceptance

Normal development uses hosted **Trajectas (Dev)**,
`bgrvqvtlhmfmvcytncgw`; Docker is not required. Initial inspection found a partial
bootstrap through 00048, zero users, campaigns, assessments, sessions and report
snapshots, and 15 seed items. The ordered source-hash plan is
`development-bootstrap-plan.json`. Do not infer parity from project health, reset
shared development, copy production data/credentials, or bypass provider denials.
See `docs/runbook.md` for the target and release policy.

Completed on 29 October 2026: all 221 missing committed baseline migrations and
all three native IPIP migrations were applied through the authorized development
connection. `development-bootstrap-receipt.json` records successes, expired
requests, the reconciled automatic-review rejection, actual history and source
hashes. That initial bootstrap left the assessment draft and the canonical
5/30/30/120 content inactive. The later owner-requested presentation migration
activates the complete assessment while preserving content and reuse locks.

`hosted-acceptance.sql` passed under `service_role` using three independent golden
scoring payloads. It checked exact frozen forms, native/display arithmetic,
idempotent scoring, private grants, no overall/norm claims, incomplete-response
refusal, immutable content and draft status, and campaign subset/move refusal.
All synthetic fixtures were rolled back; sessions and instrument results returned
to zero. This is database acceptance, not browser/HTTP or report/PDF acceptance.
The original seed library was captured before initialization; recovery has not
been rehearsed. Tool-generated grouped migration history needs deliberate
reconciliation before a future CLI push; do not force `--include-all` or invent
source-version records.

For a new target, apply reviewed migrations in order:

1. `20261029023753_ipip_neo_120_scoring_profile.sql` (commit enum first).
2. `20261029023754_ipip_neo_120_fixed_form.sql` (service-only persistence/guards).
3. `20261029040600_ipip_neo_120_draft.sql` (atomic inactive draft data).
4. `20261029224131_ipip_neo_120_profile_presentation.sql` (reviewed branding, clean descriptions and full-form activation).
5. `20261029233035_ipip_response_quality.sql` (private, separately versioned pilot supplement and review evidence; apply before the new app).

The third migration is generated by `build-ipip-neo-120-database.mjs` and is also
available as `database-import.sql`. It inserts only deterministic namespaced
records, detects conflicting content, and safely repeats without activating or
rewriting records. Do not run it before schema prerequisites are verified.
The fourth migration is a separate presentation/activation change authorized
for Preview testing by Jason on 30 October. Hosted golden scoring acceptance
passed again after it. Full respondent-browser and report/PDF acceptance remain
separate; production migration/release approval is still required.

CI's disposable database replays the migrations and runs
`tests/integration/ipip-neo-120.test.ts`, including complete fixtures, frozen
resume, native/display arithmetic, retries, incomplete answers, immutable
content, the branded active form and refused unversioned edits. Local unit tests cover all 120 item keys and
adapter errors. Those are distinct from browser delivery and report/PDF evidence;
record what actually ran in the PR.

## Report-builder interface

`ReportContext.personalityResult` and authorized session detail expose the
immutable `IpipNeo120Result`. It contains `dimensions.N/E/O/A/C`,
`facets.N1…C6`, scientific/display names, orientation, `native` and `display`
statistics, and form/scoring/presentation versions. `scores` maps dimension,
factor and construct UUIDs to the corresponding **display** POMP; dimensions are
read from the envelope, never averaged from reversed display facets.

Register the new report with
`supportedInstrumentIds: ['ipip-neo-120-johnson-2014']`. Use
`personalityResult` for its native data and labels. Generic block reports,
effectiveness bands and incompatible custom reports fail closed. No report
template is assigned by the import; native completion skips generic platform
defaults and filters shared campaign templates to registered compatible reports; report creation is a separate workstream.
The existing competency comparison/chat timeline paths exclude this instrument
until they implement personality-specific interpretation. A high trait score is
not automatically better, stronger, more effective or more suitable.

## Supplied norm data

Jason supplied the original OSF archives. `wxvth-osfstorage-archive.zip` contains
**IPIP120.dat** and its **DAT120.doc** codebook. The other archives contain
scoring tools/questionnaires and 300-item/development data, which are not silently
substituted for a 120-item reference.

The streaming audit reproduced these counts:

| Complete-response cohort | N |
| --- | ---: |
| All recorded ages | 410,376 |
| Age 16+ | 385,902 |
| Age 18+ | 339,977 |
| Australia, age 16+ | 14,163 |
| Australia, age 18+ | 12,685 |

The archive contains 619,150 records with distinct case IDs and 208,774
incomplete cases. No malformed-width, invalid-numeric or out-of-range response
records were observed. Case-ID uniqueness does not establish unique people.
The Australian 16+ group has 5,252 coded male and 8,911 coded female respondents,
matching the sample described in [NovoPsych's January 2026 technical
paper](https://novopsych.com/wp-content/uploads/2026/01/IPIP-NEO-120-Review-Paper.pdf),
pp. 3–4.

**The raw archive responses are already reverse-keyed.** Sum those effective
values directly; never apply the app's item key again. Zero means missing;
complete-case candidate distributions exclude any zero. Codebook fields are
fixed width: case 1–6, sex 7, age 8–9, country 23–31 and responses 32–151.

`norm-data-audit.json` retains archive/member hashes, exclusion counts,
demographic counts and candidate raw-score histograms for all 35 scales. No raw
respondent rows are committed. The distributions are **not installed norms**.

Before norm activation, agree the reference population (including 16+ versus
18+, country and any age/sex adjustment), verify applicable dataset/model reuse
terms, and validate a versioned percentile method with explicit ties and tails.
These are self-selected Internet samples, not leadership or representative
population norms. The raw archives do not contain NovoPsych's fitted cNORM
model. IPIP item public-domain status does not itself establish reuse terms for
that model or every raw dataset. The [UK/Ireland
norms](https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/1/163537/files/2023/07/UKnorms.pdf)
are for the 300-item instrument.

Maintain original native orientation in the reference distributions. Reversed
N4/N6 percentiles require the same tie convention; do not blindly compute
`100-percentile` without one. Freeze the chosen reference/version with results.

## Reproduce

```sh
node scripts/instruments/prepare-ipip-neo-120.mjs --check
node scripts/instruments/build-ipip-neo-120-database.mjs --check
python3 scripts/instruments/audit-ipip-neo-120-norms.py /path/to/wxvth-osfstorage-archive.zip /tmp/ipip-norm-audit.json
npx vitest run tests/unit/ipip-neo-120.test.ts tests/unit/ipip-neo-120-session.test.ts
node scripts/release/validate-local.mjs
```

Generators are offline; `--check` writes nothing. The norm auditor streams the
provided archive and emits aggregates only. It never extracts or uploads raw
respondent records. Database commands require a separately verified development
target. CI continues to provision disposable local Supabase stacks.

Secret scanning identified the two SHA-256 entries whose filenames contain
`key` as generic API keys. `.gitleaksignore` records only their exact source
commit/path/rule/line fingerprints. All scanner rules and other findings remain
active; the source integrity tests independently verify both file digests.

A further comparison of the supplied printable 120-item questionnaire found
119/120 canonical stems after ignoring punctuation/numbering. Printable item 32
adds “other” (“around other people” versus Table 1's “around people”). The
canonical Johnson 2014 wording is preserved. The raw .dat file has no item text;
confirm the administration/version equivalence before activating a normative
reference. Item 58 in the supplied printable agrees with the preserved “or”.


## Catalogue review and response-quality scope

The authoring overview exposes dimensions, all 30 traits, original ordered
statements, administration instructions and a separate scientific-reference
section. Content remains read-only; the lock must not hide the overview.
`/items?profile=personality` filters the shared library to the profile's source.
The complete personality form has 120 construct-purpose Likert items. None of
the nine generic validity items or six older example items is part of it.
The examples include free text and a forced-choice item with illustrative
construct assignments; those are not IPIP evidence or validated scales.

`src/lib/scoring/validity.ts` defines generic attention, infrequency, impression
management and rapid-response heuristics. No completion/scoring path currently
invokes `runValidityAnalysis`; they must not be described as operational checks.
The native profile does not administer those generic library items. The later
owner-authorised [response-quality pilot](response-quality.md) adds a separately
stored eight-statement supplement to new untouched attempts, plus completion-time
quality evidence and assessor review. Its explicit pilot rules replace neither
the personality scorer nor the generic calibration diagnostics. Legacy forms and
stored reports retain their original format. It does not label someone dishonest
or alter trait scores. Hosted migration and rollback-only test evidence are in
`response-quality-receipt.json`; browser and CI outcomes are recorded on the PR.

The participant runner repeats the profile-specific accuracy question above each
original statement. This supplies context for short stems without rewriting
them or changing response anchors, item hashes or keys.
