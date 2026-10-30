# Personality Profile product completion — 30 October 2026

This pass implements Jason’s approved Preview refinement request: a clearer
first-person questionnaire, integrated response checks, assessor evidence and
review history, responsive A4 previews, and operational source reference groups
with a versioned refresh workflow. Production remains outside this instruction.

## Delivery and compatibility

The shared runner interleaves separately stored supplementary questions through
a generic sequence composer. Personality-specific assignment, content and keys
remain in the versioned instrument module. See [response quality](response-quality.md)
for exact placement, anchors, legacy support and the first-person presentation.
All 120 source definitions and native scoring keys remain unchanged.

Native answers retain the IndexedDB retry queue. Hydration now moves a resumed
runner past answers that were still local when the server rendered the page.
Initial hydration is a distinct state from later optimistic saves. Input waits
for that initial merge and is locked during item transitions, preventing a
rapid answer from being accepted against a statement that is still changing.
Checks require confirmed native saves and their own revision-checked save before
advancing. Retry, stale-tab rejection and completion ownership remain enforced.
Concurrent first-entry requests fetch the winning session afresh, with explicit
campaign/participant scope and a request-memoization opt-out. They cannot reuse
the earlier empty lookup after another request wins the unique insert. Runner
error messages also use the runner’s contrast tokens.

The review panel groups each of five indicators with its status and evidence,
discloses provisional methodology, uses shared form controls, and keeps an
append-only assessor decision history. Timing and answer runs remain observations,
without a dishonesty verdict or automatic personality-score adjustment.

The A4 screen frame scales the fixed report to available width and measures its
actual height. All audience/template preview surfaces fit the report width.
Print routes bypass the frame; saved report payloads and original PDFs retain
their meaning. New real-source payloads include source attribution and intended use.
The information page places citations below the reading guide and uses compact
reference metadata, including raw/effective sample size. PDF tests verify source
text and that citations, metadata and footer all remain inside the A4 page.
The app content flex item can shrink beside the sidebar, keeping wide norm
tables inside their own horizontal scroll area on desktop and phone screens.

## Norm groups and refresh

The 41 prepared source populations use native empirical distributions, never a
Gaussian conversion of means/SDs. Historical preparation drafts are preserved.
Dev operational versions carry distinct IDs, provenance, review scope and hashes.
Their intended use is functional evaluation in isolated Dev/Preview; this does
not establish representativeness, administration equivalence or employment validity.

The original OSF node and parent contain no recorded licence. The
[Kajonius and Johnson supplementary-data deposit](https://doi.org/10.23668/psycharchives.2448)
explicitly identifies the Johnson (2014) IPIP120.dat dataset, 619,150 cases,
and CC BY 4.0. That published deposit supplies the reuse basis and attribution.
Its download service returned HTTP 502 during this pass; an independent
byte comparison with that mirror is not claimed. The prepared source artifact
remains hash-verified against its existing audit. Private histograms and import
SQL remain outside Git.

“New version” accepts one aggregate group, collection period, source publication,
attribution and preparation notes. Server validation checks all 35 distributions,
integer score supports, nonnegative unit probability mass, effective N and age
bounds. A refresh retains the population definition and scoring contract, copies
assessment compatibility atomically, and starts in draft without inherited
approvals or defaults. It does not carry old archive hashes into a refreshed source.
Request IDs converge retries; a reused request with changed content is rejected.

After review, a new version can be selected for future campaigns or a new report
edition. Existing campaign references, scores, interpretations and reports remain
frozen. Historical data does not refresh itself as participants complete campaigns;
a new eligible dataset and explicit version review are required.

## Ordered Preview rollout

1. Verify final-commit CI and install the compatible app on the existing Preview.
2. Apply additive migration `20261030111000` for atomic reference refresh.
3. Apply `20261030110000` to enable v2 assignment for future first freezes.
4. Apply the separately reviewed private Dev-only operational reference import.
   Inspect the 41 versions, hashes, compatibility and default; never run it on Production.
5. Complete a fresh synthetic hosted attempt, create/report against real source
   references, inspect screen/PDF output and confirm earlier snapshots are unchanged.

Rollback must keep both quality-module versions and edition-aware report writes.
Do not remove a delivered module, recode answers, mutate a source distribution,
or recreate the old two-column report uniqueness constraint.
