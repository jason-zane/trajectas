# IPIP-NEO-120 preparation and integration status

Prepared 29 October 2026 on `codex/ipip-neo-120-preparation`. This is a draft
instrument implementation, not an activated assessment or an import receipt.
No database, invitation, provider setting or production record was changed.

Jason approved the display labels in `label-map.csv`, including Social
Confidence and Stress Tolerance. The published scientific names, slugs, item
wording, item order, key directions and native domain aggregation are retained.
The itemset remains `johnson-2014-table1-v1`, scoring remains
`ipip-neo-120-raw-v1`, and presentation is separately versioned as
`trajectas-personality-labels-v1`.

## Implemented

- All five domain and 30 facet labels, with canonical aliases retained.
- Complete library descriptors; N4 and N6 low/high text and anchors reverse
  with their display direction. Fairness is explicitly limited to reported
  avoidance of manipulation, exploitation, cheating and obstruction; Perceived
  Competence describes self-report rather than demonstrated ability.
- Reproducible 155-row CSV: five dimensions, 30 constructs, 120 draft items.
  Existing importer mirroring would create 30 locked factors. Taxonomy records
  are inactive. Item keys are never inverted to implement a display rename.
- A pure server-side scoring core, `scoreIpipNeo120`, that requires 120 unique,
  known integer responses in 1–5 and produces 30 facets and five dimensions.
  Facet native totals are 4–20; domain totals 24–120. Means and POMP are retained.
  There is no overall score or normative interpretation.
- Pure exact-form and campaign-selection guards, with tests. They are not yet
  connected to the application's delivery or activation paths.
- Preserved source files with checksums and a separately pinned itemset hash.

Jason selected 0–100 POMP scale scores as the primary display, with native raw
totals retained. The participant-facing label is “Scale score (0–100)”. A POMP
score is not a percentile. It must not acquire population bands or effectiveness
labels from generic report or comparison defaults.

## Score direction and compatibility

Each item retains its published key: forward `response`, reverse `6-response`.
Four items form each facet; six original facet totals form each domain, once.
The factor mirror must not be counted again.

For N4 and N6 only, the result contains both `native` and `display` statistics:

- `display.rawSum = 24 - native.rawSum`.
- `display.itemMean = 6 - native.itemMean`.
- `display.pomp = 100 - native.pomp`.

For example, native N4 Self-Consciousness total 8 has mean 2 and POMP 25.
Displayed as Social Confidence, its total is 16, mean 4 and POMP 75. The native
8 still contributes to Emotional Reactivity. Social Confidence and Stress
Tolerance increase as native Self-Consciousness and Vulnerability decrease.

Existing scoring profiles, delivered forms, report snapshots and session
processing are untouched by this preparation. There are no migrations in this
change. The new scorer is not registered in session dispatch, so this change
cannot silently rescore an existing assessment.

## Application work required before use

1. Create/verify the exact source and response format and check slug collisions
   in an isolated synthetic target. Import the inactive bundle and verify
   5/30/30/120 records, source links and locked one-to-one factor links. The
   current importer creates records, is not idempotent and can omit an unknown
   source; a partial run must be inspected before retry.
2. Resolve UUIDs to stable instrument IDs and build a frozen form binding the
   canonical 120-item identity, key/mapping, form, scoring and presentation
   versions. Persist immutable native and display results atomically and make
   submission retries return the same stored result.
3. Add the IPIP scoring dispatch profile and connect the exact-form/selection
   guards to activation, assembly and submission. Prevent filters, item caps,
   substitutions, random ordering and library edits from changing the form.
   A locked factor composition alone does not lock the entire assessment.
4. Wire the results API, reports and comparisons to the explicit display
   direction. Existing generic scoring writes POMP into `raw_score` and an
   overall mean composite; those conventions must not be reused for IPIP.
   Store actual native raw totals, expose the 35 scientific scores and omit
   the overall composite and automatic competency/effectiveness rankings.
5. Prove import → fresh session → 120-item delivery → resume → submit → stored
   results, including retries, malformed/incomplete input and attempted campaign
   shortening, on an isolated synthetic stack. Add compatibility evidence for
   existing profiles and frozen snapshots before the application change ships.

The current CSV has inverse display labels and descriptors but unchanged native
item keys. **Do not activate it under the generic POMP profile.** The generic
profile cannot apply these presentation inversions or guarantee this full form.
No report template is assigned. Follow `docs/runbook.md` for subsequent scoring,
schema, migration, acceptance and release work; production approval is separate.

## Norm-data access and remaining evidence

No respondent dataset or norms are included or loaded. The original archive's
norm status remains a preparation claim, not evidence of installed norms.

The original locator is [IPIP's norms page](https://ipip.ori.org/newNorms.htm),
which points to [Johnson's OSF repository](https://osf.io/tbmh5/). Automated access
returned HTTP 403 during this work. No alternate route, mirror or account was
used to bypass that denial. A normal authorised download of the original
120-item response file and its codebook, supplied by Jason or the repository
owner, would unblock data validation. File names and the raw-data licence have
not been independently verified here.

There is a concrete Australian reference lead. [NovoPsych's January 2026
technical paper](https://novopsych.com/wp-content/uploads/2026/01/IPIP-NEO-120-Review-Paper.pdf),
pp. 3–4, describes starting from Johnson's 619,150 responses, excluding records
with zero-valued answers, retaining respondents aged at least 16, and selecting
14,163 Australian respondents (5,252 male and 8,911 female). It documents
age/gender modelling with cNORM. That publication is methodological evidence;
we have not obtained a machine-readable fitted model or checked its complete
reproduction from the original data. Its reuse statement addresses researchers
and clinicians; commercial reuse of underlying files/models needs an explicit
applicable licence, rather than an assumption from the IPIP items' public-domain
status.

After legitimate raw-data access:

1. Record the exact file hash, licence and codebook. Confirm whether responses
   are already keyed, how missing values are encoded, country/age/gender coding,
   and alignment to this 120-item form including item 58.
2. Reproduce and audit cleaning, documenting exclusions and subgroup sizes.
   Do not silently substitute a 300-item administration or an IPIP-50 dataset.
3. Agree the reference population and age/gender policy with Jason after
   reviewing those sample properties. An Australian Internet sample must not be
   presented as an executive, applicant or representative population sample.
4. Calculate versioned distributions for all 35 scales. Use empirical percentile
   lookup or a validated fitted model with documented tie/tail conventions.
   Existing `scoreToPercentile` assumes a normal distribution and is not a
   replacement for the chosen empirical reference model.
5. Preserve canonical native orientation in the reference dataset and apply the
   same explicit N4/N6 reversal to the displayed score and its reference. Do
   not assume reversed percentiles equal `100 - percentile` without a defined
   tie convention. Freeze the reference/version with each stored result.

[UK/Ireland published norms](https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/1/163537/files/2023/07/UKnorms.pdf)
are for the 300-item instrument and are not drop-in norms for this 120-item form.

## Reproduce and verify

```sh
node scripts/instruments/prepare-ipip-neo-120.mjs
node scripts/instruments/prepare-ipip-neo-120.mjs --check
npx vitest run tests/unit/ipip-neo-120.test.ts
node scripts/release/validate-local.mjs
```

The generator has no database or network operations. `--check` writes nothing.
Source hashes and fixed fixtures are verified independently of generated output.
Application integration, database import and end-to-end acceptance remain unrun;
the focused tests prove arithmetic, identity, preparation and pure guards only.
