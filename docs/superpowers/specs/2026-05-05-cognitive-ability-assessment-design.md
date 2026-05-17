# Cognitive Ability Assessment Design

Date: 2026-05-05

## Executive Summary

Trajectas can add a Raven-like cognitive ability assessment, but it should not clone or imply equivalence to Raven's Progressive Matrices unless we license the instrument. The right product framing is an abstract matrix reasoning or figural pattern reasoning assessment: a nonverbal, selected-response measure of fluid reasoning/inductive reasoning.

The current platform has useful foundations: `response_format_type` already includes `cognitive`; there are `item_media` and `item_scoring_rubrics` tables; sessions store `response_time_ms`; the psychometric schema includes calibration runs, item statistics, reliability, norms, DIF, and IRT metadata; and there is a stateless CAT engine. The missing work is the actual cognitive item authoring model, runner UI, timing enforcement, keyed ability scoring, item-bank security, pilot/calibration workflow, accessibility/accommodation handling, and client-facing validity/fairness guardrails.

Recommendation: build a fixed-form matrix reasoning MVP first, using original items or a properly licensed/open item source. Score it as accuracy-first dichotomous items. Use response time only for effort/security flags until we validate speed as part of the construct. Do not launch CAT until the item bank has calibrated IRT parameters and exposure controls.

## Research Grounding

Primary standards and guidance:

- AERA/APA/NCME Standards for Educational and Psychological Testing are the core professional standard for validity, reliability/precision, fairness, accessibility, workplace testing, and technology-based testing. NCME describes the 2014 Standards as the "gold standard" for testing guidance in the US and worldwide, and notes that the 2014 edition added stronger coverage for accessibility, workplace testing, and technology.
  Source: https://ncme.org/resources/books/testing-standards/

- SIOP's 2018 Principles for the Validation and Use of Personnel Selection Procedures are the relevant employment-selection standard. Cambridge's record describes the fifth edition as an APA-approved authoritative guideline document for employee selection testing.
  Source: https://www.cambridge.org/core/journals/industrial-and-organizational-psychology/article/abs/principles-for-the-validation-and-use-of-personnel-selection-procedures/730C076329F88919D5C81C6E7D304FE2

- ITC/ATP's 2022 Guidelines for Technology-Based Assessment cover the full digital lifecycle: test development, assembly, web delivery, scoring, reporting, data governance, psychometric quality, security, privacy, fairness/accessibility, global testing, and automated item generation. Their framing is directly relevant to this feature because the assessment would be visual, digital, timed, and remotely administered.
  Source: https://www.intestcom.org/upload/media-library/guidelines-for-technology-based-assessment-v20221108-16684036687NAG8.pdf

- EEOC guidance and UGESP matter if this is used in hiring. EEOC states employment tests should be validated for the position and purpose, should be job-related, and should be replaced by an equally effective lower-impact alternative when one exists. UGESP's four-fifths rule remains the standard practical screen for adverse impact, though it is only a rule of thumb.
  Sources: https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures and https://www.eeoc.gov/laws/guidance/questions-and-answers-clarify-and-provide-common-interpretation-uniform-guidelines

Instrument landscape:

- Raven's 2 is a proprietary Pearson instrument. Pearson describes it as a nonverbal measure of clear-thinking ability, delivered via Q-global or paper, with standard score and percentile reporting. Its digital forms are assembled from an item bank to limit item overlap. That is a useful product reference, not an item source.
  Source: https://www.pearsonassessments.com/store/usassessments/en/p/raven-s-progressive-matrices-second-edition-raven-s-2/100001960

- ICAR is a public-domain/open cognitive ability resource with matrix reasoning, progressive matrices, figural analogies, rotation, number series, and other item types. It is research-oriented, not a ready-to-sell employment product, but it is a useful source of ideas and possibly source material subject to its terms.
  Source: https://icar-project.com/projects/icar-project/wiki

- MaRs-IB is an open-access matrix reasoning item bank with IRT analysis, published in Behavior Research Methods. It exists partly because public-domain matrix reasoning tests are scarce. Its open license makes it worth evaluating, but we still need to check item licensing, source files, population, norms, and commercial suitability before use.
  Source: https://link.springer.com/article/10.3758/s13428-023-02067-8

Modern personnel-selection evidence:

- Cognitive ability tests can predict learning and job performance, but they carry adverse-impact risk and should not be positioned as a standalone universal hiring answer. Recent selection meta-analytic work revisits older validity estimates and emphasizes validity-diversity tradeoffs across selection procedures. Structured interviews, work samples, SJTs, biodata, and integrity/conscientiousness measures often belong in a composite rather than treating GMA as the sole gate.
  Source: https://experts.umn.edu/en/publications/revisiting-meta-analytic-estimates-of-validity-in-personnel-selec/

## What We Should Build

Start with one construct, not a broad "IQ" test:

- Construct name: Abstract Matrix Reasoning or Figural Pattern Reasoning.
- Construct definition: ability to infer rules from nonverbal visual patterns and select the missing/next element.
- Intended use: supplement to a broader assessment battery, not a standalone hiring cutoff.
- Report label: reasoning score, percentile/norm group where supported, confidence interval/SEM when available. Avoid IQ labels.

Item format:

- 2x2 and 3x3 matrices with one missing cell.
- 4 to 8 answer options.
- Visual rules based on shape, count, position, rotation, reflection, fill, size, sequence, set operations, XOR/union/intersection, and rule composition.
- Difficulty controlled by number of rules, perceptual salience, abstraction, working-memory load, distractor plausibility, and visual complexity.
- Practice items with feedback before scored items.
- Scored items without feedback.

Administration model:

- Fixed-form MVP with 18-30 operational items plus 2-4 practice items.
- Prefer a power test or lightly timed test first. A heavily speeded test will add fairness and accessibility complexity.
- If timed, use section-level timing and persist remaining time. Enforce expiry server-side enough to prevent simple client manipulation.
- No answer review after submission.
- Back navigation should be configurable; for high-stakes ability testing, default to no back nav inside the timed section.
- Desktop/tablet recommended; mobile only if visual details remain legible after real viewport testing.
- Participant disclosure: what is measured, approximate time, device requirements, accommodation contact/process, privacy, and how results are used.

Scoring:

- MVP: dichotomous item scoring, `1 = keyed option selected`, `0 = otherwise`.
- Raw score: sum correct.
- Percent correct: raw / operational item count.
- Standard error: compute once reliability is estimated; before that, label results as pilot/unvalidated.
- Norms: only after sufficient representative sample. Do not show percentiles before the norm group exists.
- Response time: store per item, but initially use for rapid-guessing, effort, and security flags only.
- Future IRT: calibrate item parameters and score theta + SE. Use 2PL for a mature bank; 3PL only if there is enough data to estimate guessing reliably. CAT comes after that.

## What Exists In The Codebase

Database foundations:

- `cognitive` is already in the database enum, and a seeded "Pattern Recognition" response format exists with media required and a time limit config. See `supabase/migrations/00005_foundation_alignment.sql`.
- `item_media` supports image/audio/video/html assets with `alt_text`, and `item_scoring_rubrics` supports option-level scoring values. These are currently too broadly readable for a protected ability item bank and need hardening before launch.
- `assessment_sections` already supports section instructions, response format, item ordering, items per page, `time_limit_seconds`, and `allow_back_nav`.
- `participant_responses` stores `response_time_ms`, and the hardened runner RPC accepts and persists response timing.
- Psychometric infrastructure exists for calibration runs, item statistics, reliability, norms, factor analysis, and DIF.
- `item_parameters` and the IRT/CAT code can support calibrated ability testing later.

Runner and scoring foundations:

- The assessment runner loads `responseFormatType`, section `timeLimitSeconds`, and `allowBackNav` into `SectionForRunner`, but `ItemForRunner` only exposes stem and options. It does not expose media, item specs, option media, keyed answer, or item-level display metadata.
- `saveResponseLite` accepts `responseTimeMs`, but the current runner does not measure and pass elapsed item time.
- `SectionTimer` exists but is not integrated into `SectionWrapper`.
- The runner renders Likert, forced choice, binary, ranking, free text, and SJT. It does not render `cognitive`.
- `submitSession` always calls `scoreSessionCTT`.
- `scoreSessionCTT` computes mean POMP scores, which is appropriate for Likert-style scales but wrong as the primary scoring path for cognitive ability items.
- `responseFormatSchema` and `ResponseFormatType` do not include `cognitive`, so admin validation/types are currently behind the database.

## Product And Technical Gaps

Schema gaps:

- Add first-class cognitive item representation. The existing `item_media` table can work for simple images, but matrix reasoning benefits from versioned structured specs: matrix cells, rules, generated SVG, option assets, answer key, difficulty target, operational status, exposure count, and copyright/source.
- Add item-bank status and security fields: `draft`, `pilot`, `operational`, `retired`, `compromised`; source/license; version; exposure metadata; review status.
- Add per-item scored outcomes, not just raw responses: correctness, score value, response time, rapid-guess flag, omitted/timeout flag. This can be a `participant_item_scores` table or an internal scoring JSON snapshot.
- Add accommodation/session overrides: extra time multiplier, untimed mode, alternate form, approved by, reason category, audit timestamp.
- Tighten RLS for item media, rubrics, answer keys, psychometric internals, and DIF results. Candidate runner should receive only assets/options needed for the current item, never answer keys.

Authoring gaps:

- Build an internal item editor for visual matrix items.
- Support SVG/canvas preview at participant viewport sizes.
- Store item-level alt/support text, but do not assume alt text makes a visual reasoning construct accessible. Some accommodations require an alternate validated measure, not a textual description of the answer logic.
- Add expert-review workflow for construct relevance, solution uniqueness, distractor plausibility, cultural/language load, visual accessibility, and copyright/source clearance.
- Support practice item authoring separately from operational items.

Runner gaps:

- Add `CognitiveResponse` component with a matrix/stimulus area and fixed-size option grid.
- Render assets from `item_media` or structured item specs.
- Keyboard navigation: arrow/tab through options, Enter/Space to select.
- Stable layout: no content shift when options are selected or when timer changes.
- Integrate `SectionTimer`, persist remaining time through `update_session_progress_for_session`, and handle expiry.
- Capture item start time and pass `responseTimeMs` into `saveResponseLite`.
- Honor `allowBackNav`.
- Add "practice" mode with immediate feedback before the timed/scored section.
- Test desktop and mobile rendering with Playwright screenshots because small visual differences can change item difficulty.

Scoring gaps:

- Add `scoreSessionAbility` or a scoring dispatcher selected by assessment scoring method/response format.
- Score against keyed options/rubrics, not Likert POMP.
- Store raw correct, percent correct, omitted/timeout count, rapid-guess count, and flags.
- Add status labels: pilot/unvalidated, calibrated, normed.
- Once calibrated, add theta scoring using existing IRT modules and persist theta, SE, CI, score scale, and norm lookup.
- Add clear report copy: what the score supports, what it does not support, and whether the result should be used as a decision aid only.

Psychometrics and research gaps:

- Create calibration jobs that actually compute CTT statistics from responses and write to `item_statistics` and `construct_reliability`.
- For cognitive items, item difficulty should be proportion correct, discrimination should be corrected item-total or point-biserial, and distractor analysis should inspect option selection by total-score bands.
- Add rapid-guessing/effort analysis and speededness checks.
- Add DIF analysis for protected groups where collection is lawful, consented, and privacy-protected.
- Add adverse-impact monitoring at the client/campaign decision level where the tool is used for hiring decisions.
- Add criterion validation workflow: link assessment score to job-relevant outcomes only after job analysis and consent/data governance.

## Build Plan

Phase 0: Methodology decision

- Decide whether this is for hiring, development, or both. Hiring requires a much stricter validation and adverse-impact posture.
- Decide source strategy:
  - License Raven's/another commercial test and embed via vendor flow if we want immediate defensibility.
  - Use ICAR/MaRs-IB only after license and commercial suitability review.
  - Build original items and validate them ourselves.
- Define construct blueprint and participant/client report language.
- Engage an IO psychologist/psychometrician before item writing begins.

Phase 1: Fixed-form MVP

- Add `cognitive` to app types, Zod validation, admin UI, and response-format management.
- Extend item loading to include cognitive assets/options.
- Build `CognitiveResponse` UI and practice section flow.
- Integrate section timer, back-nav rules, and response-time capture.
- Add cognitive item authoring basics: stem/instructions, matrix asset, option assets, keyed answer, practice/operational flag.
- Add `scoreSessionAbility` and scoring dispatcher.
- Add item-score persistence and report-safe summary output.
- Harden RLS around answer keys and item assets.

Phase 2: Pilot bank

- Create 60-120 draft items across easy/medium/hard targets.
- Expert review every item.
- Run cognitive interviews/usability sessions to confirm instructions and visual comprehension.
- Pilot with a broad enough sample for item screening.
- Remove items with ambiguous solutions, extreme difficulty, poor discrimination, bad distractors, high rapid-guessing, or accessibility issues.
- Publish internal technical note: construct, blueprint, item review, pilot N, reliability, SEM estimate if available, limitations.

Phase 3: Operational fixed form

- Build 2-3 parallel fixed forms or LOFT-style assembled forms from the screened bank.
- Add item exposure tracking and retest policy.
- Add norm groups only when sample size and sampling frame support them.
- Add adverse-impact monitoring and client usage warnings for hiring.
- Add admin psychometric dashboards for item health, reliability, norms, and DIF.

Phase 4: Calibrated IRT / CAT

- Calibrate 2PL/3PL item parameters after sufficient N.
- Add score equating across forms.
- Simulate CAT before launch: precision, item bank utilization, content coverage, exposure rates, termination rules, and subgroup behavior.
- Add exposure constraints and content balancing to the current CAT engine; maximum-information selection alone is not enough for operational item security.
- Launch CAT only after simulation and monitoring.

## Best-Practice Guardrails

- Do not call it Raven's, IQ, or general intelligence unless the evidence supports that exact claim.
- Do not launch a high-stakes hiring cutoff before validation.
- Do not use speed as a positive scoring input until speededness and subgroup effects are validated.
- Do not show client-facing percentiles without a documented norm group.
- Do not expose answer keys, item source files, or operational item previews broadly.
- Do not provide individual protected-class DIF/adverse-impact details to clients; use aggregate monitoring with privacy thresholds.
- Do not assume a visual test is accessible because it has alt text. Provide an accommodation workflow and alternate validated option.

## Open Decisions

1. Is the first use case selection, development, or internal benchmarking?
2. Do we want licensed defensibility now, or original IP with a longer validation runway?
3. What jurisdictions will this be sold into first?
4. Will clients use the score as advisory input, rank ordering, or cutoff?
5. What demographic data can we lawfully and ethically collect for DIF/adverse-impact monitoring?
6. What minimum technical evidence must exist before the feature is visible outside pilot clients?

## Local Implementation References

- Database cognitive/media/rubric seed: `supabase/migrations/00005_foundation_alignment.sql`
- Section timing/back-nav schema: `supabase/migrations/00009_assessment_sections.sql`
- Psychometric infrastructure: `supabase/migrations/00010_psychometric_infrastructure.sql`
- Hardened response/progress RPCs: `supabase/migrations/20260424143500_harden_assessment_runner_rpc.sql`
- Runner state and save flow: `src/components/assess/section-wrapper.tsx`
- Runner format rendering: `src/components/assess/item-card.tsx` and `src/components/assess/item-display.tsx`
- Submit-time CTT scoring: `src/lib/scoring/ctt-session.ts`
- IRT functions: `src/lib/scoring/irt/models.ts`
- CAT engine: `src/lib/scoring/adaptive/cat-engine.ts`
- Response-format validation/types: `src/lib/validations/response-formats.ts` and `src/types/database.ts`
