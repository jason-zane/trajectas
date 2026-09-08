# Autonomous Likert pipeline: implementation and evaluation

The pipeline now provides autonomous Likert drafting, blind AI review, repair, form assembly and guarded publication without a human reviewer gate. The software and scoring safeguards have strong test coverage. Real-model testing has exposed a harder limitation: many individually acceptable items still cannot form a sufficiently distinct scale. An eight-item form has now passed the current structured pair policy and published with matching wording, anchors and reverse keys, after substantial automatic repair. A fresh run with content planning also completed: 26 candidates, 19 individual passes and eight selected items in 88 attempted model calls. Both completed forms subsequently passed active-library and assessment-builder handoff checks. The results below separate policy versions and record failures as well as successes.

This evaluation accompanies [PR #405](https://github.com/jason-zane/trajectas/pull/405). The [implementation guide](autonomous-likert-pipeline.md) explains the author workflow, acceptance policies, checkpoints and reproduction commands.

## Confidence and what it means

| Question | Confidence from this work | Basis and limit |
|---|---|---|
| Does the tested software preserve item identity, anchors and reverse keys? | High for the exercised paths | Deterministic scoring tests, database checkpoint tests and real local publications under both pair policies with zero wording/key/format mismatches |
| Can it identify common item-writing defects and correct an incorrect key? | Moderate | Seven deliberately flawed challenge items rejected; a deliberately incorrect key corrected; one plausible preference item blocked by reviewer disagreement |
| Can it create coherent, distinct items for the requested construct? | Moderate, construct dependent | Actual generated items passed separate content reviews and explicit pair checks; larger development runs exposed coverage and redundancy failures |
| Will a specified form finish autonomously on the first run? | Not established across workloads | Small, authored development scenarios; provider errors and repairs occurred, and some runs resumed after implementation fixes |
| Are its resulting scores reliable, unidimensional, fair across groups or predictively useful? | Unmeasured | No respondent sample, repeated administration, subgroup comparison, criterion study or norming sample was used |

These are engineering judgments about the evidence, not numerical confidence intervals. A pass rate on this authored suite is not an estimated population success rate. Three separately prompted provider families do not establish statistically independent judgments. The writer's provider also participates in one blind item review; the two final-pair reviewers come from other provider families.

The distinction between content checks and observed measurement evidence follows the scope of validity in the [AERA/APA/NCME Standards for Educational and Psychological Testing](https://www.testingstandards.net/uploads/7/6/6/4/76643089/standards_2014edition.pdf): evidence supports particular score interpretations and uses. This implementation makes no claim that generated text or model agreement establishes those properties. It adds no external-review prerequisite.

## Gaps fixed

| Finding | Implemented change | Verification |
|---|---|---|
| Generation and review could operate on incomplete or inconsistent construct/facet information | One versioned specification includes definitions, exclusions, audience, context, recall, anchors and score direction | Contract and checkpoint tests; real prompts retained |
| A malformed response, missing key or empty output could look like success | Strict typed item/review schemas, exact IDs/counts, explicit booleans and complete response categories | Malformed, missing, duplicate and out-of-scope response tests |
| Reviewer decisions were insufficiently independent and actionable | Three separate blind requests infer construct, facet, key, response interpretation and defects; all unresolved major/critical issues block the item | Real reviewer outputs and deliberately flawed challenge items |
| Rewording requests repeatedly produced the same underlying actions | A non-writer plans each candidate’s concrete content, necessary conditions, distinction and polarity before drafting; saved plans are bound to the current specification and pool, and remain hidden from blind reviewers | Exact index/key tests, saved-plan and coverage-blocker integration cases, and a fresh frozen-code model run |
| Poor items were left for manual cleanup | Targeted generation and rewriting, a separate wording editor, automatic form reassembly and one bounded facet redesign per failing construct | Real repair histories plus deterministic recovery tests |
| The first failing scale could consume the whole instrument's facet-repair allowance | Track redesign eligibility per construct, retaining the shared 600-call cap and preventing repeated redesign of the same construct | Regression with sequentially failing constructs and an already-used repair budget |
| Legacy easy/medium/hard quotas encouraged incidental demands and adjacent constructs | Standard Likert blueprints allocate items directly to facets; conditions are included only when the construct calls for them | Local blueprint integration assertion and a fresh real-model run |
| A pool-wide claim of checking overlap could miss repeated content in the final form | Every selected within-construct pair receives two explicit judgments; either retained redundancy flag forces reassembly | Pair enumeration/completeness tests and real final-form checks |
| Pair reviewers could confuse the shared trait with the same behaviour, or miss a mirror | Full facet context; structured action/experience and condition comparison; one separate self-check per reviewer for disputed pairs | Coherent-comparison tests, corrected/retained/interrupted self-check cases, and real-model reruns |
| Model copying errors corrupted long item/pair identifiers | Short item, construct and pair references are validated and mapped back to exact database IDs | Reordered, missing and unknown-reference tests; recovered real review steps |
| One incoherent reviewer profile discarded an otherwise complete batch | A bounded self-check addresses the inconsistent item; unresolved disagreement fails that item while retaining other reviews | Integration cases for both a successful correction and continued disagreement |
| Reverse scoring differed between 1-based Likert and legacy 0-based calculations | Scoring uses `minimum + maximum - response`; calibration explicitly supplies the Likert lower bound | A 1–5 reverse response of 1 remains 5 through matrices and CTT scoring |
| Changed text, specifications or review policy could reuse old approval metadata | SHA-256 fingerprints, versioned item/pair evidence and recomputation from actual complete judgments; exact accepted-set and response-format publication checks | Stale item/specification, forged-pass and obsolete-pair-evidence tests |
| Publishing wrote correct items but left them as inactive library drafts | Complete reviewed Likert forms now activate atomically under a service-only RPC, with exact content/key/format/construct checks and safe retry of unchanged drafts | Eleven activation integration cases plus real completed forms appearing with four active items per construct and eight items in the correct builder format |
| Concurrent or delayed generation could overwrite checkpoints or race publication | Service-only transactional commit checks the lease, revision, specification, item timestamps and publication state | Local concurrency, expiry, replay, stale-edit and publication-race tests |
| Reporting overstated psychometric evidence | Alpha is a planning goal; scenarios remain per construct; no invented reliability interval or calibration from sample size alone | Evidence/report tests and inspected browser output |

Other repaired legacy paths include facet mapping, rejected-item coverage, critique result unwrapping, fairness result parsing/counts and exclusion of superseded evidence. Newly published library constructs retain their operational definition. AI decisions are stored separately from human cognitive-item sign-offs.

## Test design

Tests used actual OpenRouter calls and a local Supabase database. Authentication and model-configuration reads were substituted in the opt-in benchmark; item generation, model requests, review, persistence, assembly and the real publication action executed. No participant responses were simulated as empirical evidence. No benchmark data was written to production.

The configured writer was MiniMax M2.5; the blueprint model was Claude Sonnet 4.5. The three item reviewers were Claude Sonnet 4.5, MiniMax M2.5 and DeepSeek V3.2. Claude and DeepSeek supplied the final-pair checks. Requested/returned models, exact new-call prompts, outputs, usage and retries are retained in stage evidence. Provider/network attempts without a completed response are charged to the job budget but may have no returned token usage.

The creation scenarios used plain-English work-development briefs, five agreement categories, a three-month recall period, entry-level readability and a one-third reverse-key target, rounded separately for each construct. Four items per construct therefore requires one reverse item each; six requires two each.

These were **development runs used to discover and fix defects**, not a frozen holdout benchmark. Several were resumed after code changes. Their counts describe those runs, not completion probability, production cost or a latency service level. The defect challenges were authored for this evaluation and were also rerun while refining error handling.

The final structured pair policy is `likert-pair-v2`. Earlier unstructured pair results remain historical evidence and cannot qualify a form under this version. Strong ratings among selected items are also conditional on selection; they are not out-of-sample validation of the reviewer system.

## Observed results

### A misleading early completion caught during testing

An earlier development build (`7427100b-933b-415f-af5f-3c7353cb6ac2`) selected and locally published 12 items after pool-wide overlap scans. Inspection still found obvious repetition: “I met the deadlines I promised for my work” and “I finished my assigned work by the due dates,” as well as forward/reverse mirrors about continuing the same work when priorities changed. Its history records 101 candidates and 42 individual passes.

That result is **not counted as a successful final-policy form**. It demonstrated that a model saying it scanned the pool was insufficient. The explicit, complete pair-by-pair gate was added in response. The eight-item result below subsequently passed the first explicit pair gate. The later structured pair policy is stricter again; its results are reported separately.

### Historical eight-item behaviour form: pair policy v1

Build `aa096317-9d0b-47af-b6ea-eb21ddeeda0d` requested four Dependability and four Behavioural Adaptability items. It used the earlier intensity-based blueprint and unstructured pair policy. The current `likert-pair-v2` gate correctly does not reuse those old judgments. Browser/API observations below were made before that policy upgrade.

- 35 candidates generated and reviewed; 24 passed individual checks; eight selected.
- Two selected reverse keys, as required by per-construct rounding.
- All 12 within-construct pairs checked by both final-pair reviewers. The run examined 34 distinct pairs across proposed alternatives.
- 96 attempted model calls across the development/resume history.
- Two library constructs, two factors and eight items published locally with zero warnings.
- A separate database comparison found zero published wording, key or response-format mismatches.
- Browser inspection confirmed the selected form, scoring rule and planning-goal labels. The JSON evidence endpoint returned HTTP 200 with eight selected items, 12 checked pairs and 68 history records, using a private/no-store response.

Two examples from the selected form illustrate both value and residual concerns:

| Generated wording | Key | Interpretation |
|---|---|---|
| Over the past three months, I followed through on small work commitments I made to others. | Forward | Clear connection to follow-through; the incidental word “small” reflects the earlier blueprint policy |
| Over the past three months, when urgent new work came up, I kept doing my current work instead of switching to it. | Reverse | Direction is consistent with priority adjustment, but switching may depend on the job's priorities and authority |

These conditional items passed the AI panel. Their residual contextual dependence is a reason to retain moderate content confidence and to remove artificial difficulty tiers from subsequent generation. Passing AI checks should remain an inspectable decision, not an assertion that no reviewer could identify another weakness.

### Twelve authored review challenges

| Challenge group | Result |
|---|---|
| Double-barrel, absolute virtue, confusing negation, off-construct content, family-status proxy, health proxy, idiom | All seven rejected |
| Straightforward forward item | Accepted with forward key |
| Clear reverse item carrying an intentionally wrong writer key | Accepted with corrected reverse key |
| Climate item with negative words but a forward meaning | Accepted with forward key |
| Self-rated numerical capability | Accepted with forward key |
| Preference for prescribed steps rather than personal method choice | Blocked: two reviewers inferred reverse, one inferred forward and misread anchor direction |

The completed two-item-batch challenge run recorded 22 model responses, including retries. Four of five plausible controls passed. The preference control is an observed false rejection relative to its authored intent; its key was not resolved unanimously. The suite does not establish sensitivity, specificity or subgroup fairness beyond these examples.

### Larger development scenarios

The earlier six-item-per-construct behaviour run (`810c0dad-8ab3-4bc7-aede-a5c7b380572b`) stopped without a ready form. It accumulated 126 historical candidates; after facet changes, 73 had current reviews and 27 passed, but required deadline-adherence coverage still failed. The system preserved blockers and selected no final items. This run used the older forced difficulty layout and informed its removal.

The trait run (`e4292dcf-cb6b-4c24-8de3-9b5eaa366e9e`) also stopped on quality constraints, without publishing. It requested six Orderliness and six Sociability items and accumulated 144 historical candidates, 83 current reviews and 55 current individual passes. After one facet redesign and final-form repair attempts, Sociability still could not meet coverage, diversity and two reverse keys in six items. The development history charged 514 model attempts; 288 pair decisions remained in the final checkpoint after its last specification revision. Earlier pair judgments remain in the stage history. This was a resumed development run, including the earlier difficulty-based blueprint and later repair/transport changes; it is not a clean estimate for a fresh final-version trait build.

The facet-only behaviour build (`e11e16b4-12a6-47da-be3d-274a7ac79995`) also stopped without a ready form. It accumulated 92 historical candidates, 71 current reviews and 53 individual passes. Both constructs received their single permitted facet redesign. A re-evaluation of the fixed pool under structured pair policy v2 increased the shared model-attempt count from 417 to 475, but could not assemble the required three distinct Task Reprioritization items. The final checkpoint held 160 current v2 pair comparisons: 10 initially disagreed, seven became jointly non-redundant after the bounded independent self-checks, and three retained a concern. This shows that self-checking can change a comparison; it does not prove those changed judgments objectively correct or establish a causal improvement rate. The initial/final pools and pair selection differ from the larger diagnostic snapshot below.

A separate fresh eight-item control (`ac7bd468-dc1d-48c1-ae52-c7e287045fdd`, code `de3fe3d6`, pair v1) hit the 40-minute benchmark limit after 231 attempted model calls. Its saved state was still in review, with 69 historical candidates, 40 current reviews and 34 passes after two facet redesigns. It was not a completed form or a terminal quality-budget failure. The production step runner has no 40-minute job limit; the benchmark limit is a harness bound. This control was not resumed merely to obtain a success.

### Structured pair control and final content-planning run

The structured control (`7f1bc3f6-e2d4-41de-92df-f80f448abe7b`, code `18bdb74d`) **completed and published under the current pair-v2 gate**. It started fresh under that policy and resumed the saved job after a benchmark time limit, with no quality-policy or generation changes during the resume.

- 52 candidates, all reviewed; 39 individual passes; eight selected with two reverse keys.
- All 12 required final pairs passed both structured reviewers. Across alternative proposed forms, 174 current-version pair decisions were retained; seven initially disputed pairs received bounded self-checks.
- 253 model attempts, one construct-facet redesign and multiple form repair/reassembly steps.
- Two constructs, two factors and eight items published locally with zero warnings. A separate database query confirmed eight published items, two reverse keys and zero wording/key/format mismatches.

This establishes an actual completion path under the released acceptance policy. It also demonstrates a significant efficiency problem: eight final items required 52 drafts and 253 attempted calls. Content remains open to substantive criticism even after those gates. For example, letting agreed tasks slide when other priorities arise can reflect either poor follow-through or a reasonable priority decision; readiness does not resolve that response-process question empirically.

The fresh content-planned run (`c51c79d9-cb27-48e6-9f68-11db1eace8b3`) **completed its full generation/review run without a resume**, starting from frozen generation code `f24e42ec`. Its initial manifest records source hashes, a clean tracked-code state and the model configuration.

- 26 candidates, all reviewed; 19 individual passes; eight selected with two reverse keys.
- All 12 final within-construct pairs passed both reviewers; 35 current pair decisions were retained across proposed forms.
- 88 attempted model calls, with item/form repairs and no facet redesign.
- Two constructs, two factors and eight library items created with zero warnings.

The 88 versus 253 attempted calls is encouraging descriptive evidence, not a controlled causal estimate: these are single stochastic runs with different generated facets, content and repair histories. First-pass drafts still included mirrors and adjacent content, so content planning itself cannot certify distinctness or fit.

The selected form includes “I kept the promises I made verbally to people at work” (forward) and a reverse item about failing to tell anyone when a promised task could not be completed. That reverse item raises a residual boundary question: is communicating a failure an intended part of Dependability, or primarily accountability/communication? The three-model panel accepted it. This is a concrete reason to retain moderate content confidence and to evaluate operational boundaries on a larger frozen benchmark. Generated context-dependent statements also need real response-process evidence.

### Publication activation and actual builder availability

The original publication action wrote **draft** library items. Earlier observations of eight inserted rows and matching keys did not establish delivery availability. The extended handoff test detected this gap, and it was fixed before release.

After the model runs completed, publication was retried under the activation fix for both current-policy eight-item forms. This additional step used no model calls and did not alter their wording, keys or review decisions. Both passed: four active items per published construct, eight items in the saved Likert response format, exact library wording/keys, and availability through `getConstructsForBuilder` and `getFormatBreakdown`. Activation of the fresh content-planned form was therefore verified separately from its frozen generation run, rather than represented as one cold run of the eventual release commit.

The new RPC activates the whole set together or rejects it. It checks the publication lease, job revision, current specification, accepted set, item versions, library text, scoring keys, response format and construct links. It refuses archived/deleted or cognitive items. It creates no human sign-offs and does not claim measured reliability or a calibrated lifecycle stage. A server-side quality check precedes the transaction; an unreviewed complete flag cannot activate a form.

The two factor records remain outside automatic Architect recommendations and retain their existing metadata-completeness rules. Authors can use the reviewed scales through the builder’s construct selector immediately. This handoff test verifies content availability and format resolution; it does not claim a respondent delivery study.

The current-policy control’s review API returned HTTP 200, private/no-store, eight selected items, 12 checked pairs and 215 history records. A fresh headless browser rendered its technical report with separate four-item reliability-planning rows (.31/.50/.63 under the stated hypothetical correlations).

### Why larger forms remained difficult

A diagnostic snapshot of completed final-pair steps in the two larger runs contained 1,243 pair-judgment events: both models called 240 redundant, both called 720 distinct, and they disagreed on 283. These are development events, including repeat judgments across specification revisions, not 1,243 independent or unique pairs. A disagreement is not automatically a model error. The current policy excludes the pair if either reviewer flags it.

The rationales show inconsistent application of the redundancy definition. In one case Claude treated filing information and putting physical tools away as the same orderliness dimension; DeepSeek treated the actions and objects as different. Elsewhere DeepSeek treated a straightforward forward/reverse mirror as different coverage because one statement named a specific context. This prompted the structured comparison and bounded self-check in `likert-pair-v2`. The final rule remains conservative: any retained redundancy concern excludes the pair. More model calls alone do not resolve the underlying calibration problem.

## Software verification

- Unit suite: 208 files, **2,861 tests passed**.
- Local integration suite: **503 passed, 12 skipped**, including 19 dedicated Likert checkpoint cases and 11 activation cases.
- Architecture checks: 19 files / 93 passed. Components: 27 files / 145 passed. TypeScript, ESLint, production build and browser smoke checks passed during implementation. CI repeats the release checks on the PR revision.
- A focused report regression confirms that repeated construct display names cannot combine item counts or reliability-planning scenarios; aggregation uses construct IDs.
- The service-only checkpoint and activation migrations were applied locally, tested, then applied to the live schema before release (`20260908053836` and `20260908093707`). Post-migration advisors identified no new Likert-related issue; unrelated existing advisor notices remain.

The software tests exercise business contracts and concurrency failures; their count is not evidence of psychometric validity. The real-model suite is opt-in so CI does not silently incur model charges.

## Remaining gaps and next technical work

| Gap | Practical next step | Human-review prerequisite? |
|---|---|---|
| Larger forms can have many passing items but still fail assembly; pair reviewers disagree materially | Measure the new content planner’s effect on completion; calibrate the structured comparison/self-check against frozen same-action, mirror and distinct-manifestation pairs before further policy changes | No |
| No measured reliability, dimensionality, response-process behaviour, DIF, criterion relationship or norms | Bind actual response data and analysis results to exact delivered item/specification versions; automate calibration and monitoring as data arrives | No; the missing input is respondent evidence |
| Unknown completion and false-rejection rates across constructs, formats and audiences | Freeze the released policy and run repeated, preregistered scenarios across trait, behaviour, preference, capability, climate and response-style scales; report failures and provider variation | No |
| Providers can disagree or fail to return valid data | Retain fail-closed gates; expand transport-error recovery and compare provider combinations on held-out cases | No |
| Long creation requires an open browser page | Move the existing leased steps to a durable background worker with pause/cancel, cost limits and resumable status | No |
| Final-pair work grows quadratically with form length | Keep the preflight budget and explicit pair audit; benchmark alternative assembly strategies and cache exact-version decisions | No |
| Library schema requires a difficulty category | Treat legacy `mid`/`medium` values as compatibility tags, not observed item difficulty; separate design metadata from empirical calibration in a future schema change | No |

No claim of “world-first” or “best-in-class” is established by this test. The delivered improvement is an autonomous, auditable Likert workflow with actual failure handling and enforceable acceptance checks. Its next quality gains should be measured against frozen benchmarks and real response data.
