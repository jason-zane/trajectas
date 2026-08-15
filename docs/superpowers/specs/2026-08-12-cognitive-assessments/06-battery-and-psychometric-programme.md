# Trajectas Cognitive Battery — Architecture and Psychometric Programme

**Status: DRAFT BLUEPRINT. Not validated. Not for operational use.**
This document is the design reference for the Trajectas cognitive ability battery. Nothing in it constitutes a claim that any instrument described here is reliable, valid, fair, or fit for selection decisions. Every design target stated below is a *hypothesis to be tested* in pilot calibration, DIF screening and criterion validation (see §8, Empirical validation requirements, which is binding on the build).

Author role: psychometric design lead. Audience: engineering, item-writing, and client-services teams. UK English throughout. Terminology follows the CHC (Cattell–Horn–Carroll) taxonomy and the *Standards for Educational and Psychological Testing* (AERA/APA/NCME, 2014).

---

## Table of contents

1. Construct foundations (construct-first)
2. Battery composition, lengths, time limits, composite
3. Test-level specifications and sample items (operational documentation standard)
4. Scoring architecture: CTT pilot → 2PL IRT → reported scores
5. Calibration and item-banking operations
6. Fairness programme
7. Security and unproctored internet testing (UIT)
8. Empirical validation requirements (mandatory)

---

# 1. Construct foundations

## 1.1 What the battery measures

The battery measures **general mental ability (GMA, psychometric *g*)** through three broad CHC strata-II abilities, each operationalised as a separate test:

| Test | CHC construct | Stratum-II code | Working definition |
|---|---|---|---|
| Logical/Abstract Reasoning | Fluid reasoning | **Gf** | The deliberate, controlled ability to identify rules, induce relations among novel stimuli, and apply those relations to reach a determinate conclusion, where the stimuli carry no prior semantic content. Narrow abilities: induction (I), general sequential reasoning (RG). |
| Numerical Reasoning | Quantitative reasoning | **RQ** (narrow ability under Gf, with Gq support) | The ability to reason inductively and deductively with quantitative relations — proportions, rates, changes, comparisons — presented in tables, charts and short scenarios. It is *reasoning with numbers*, not knowledge *of* mathematics. |
| Verbal Reasoning | Crystallised/verbal reasoning | **Gc** (lexical knowledge deliberately minimised; loading targeted at verbal induction/deduction) | The ability to comprehend written propositions and draw warranted inferences from them — specifically, to distinguish what a text entails, what it contradicts, and what it leaves undetermined. |

GMA sits at stratum III. In the hierarchical model the three tests are indicators of a single *g* factor; the composite (§2.5) is our operational estimate of *g*, and the sub-scores are reported as profile information, never as independent "types of intelligence".

**What GMA predicts.** Meta-analytic evidence (Schmidt & Hunter 1998; Hunter & Hunter 1984; Salgado et al. 2003 for Europe; Sackett et al. 2022 re-analysis with more conservative range-restriction corrections) places GMA among the strongest single predictors of job performance and training success, with validity rising with job complexity. Sackett et al.'s corrected operational validity (~.31 for job performance) is lower than the older .51 figure; we design and market against the *conservative* figure. Prediction is of learning speed, problem-solving quality and performance in novel or complex task environments — not of motivation, integrity, interpersonal effectiveness or leadership style, which the platform's other instruments address.

## 1.2 Construct boundaries — what each test must NOT measure

Construct-irrelevant variance (CIV) is the enemy. Each test has explicit exclusions that item writers and reviewers enforce:

**Logical/Abstract (Gf) must not measure:**
- Mathematics knowledge. No numerals as rule-bearing content; counting is limited to enumeration ≤ 5 elements.
- Verbal ability. Instructions at ≤ CEFR B1 reading level; item content is entirely figural.
- Cultural or educational knowledge. Shapes only — no letters, icons with cultural meaning (arrows are acceptable as pure direction markers), religious or national symbols, or objects (no clocks, dice, playing cards).
- Visual acuity or colour perception. Rules are never carried by colour alone (§3.1 accessibility).

**Numerical (RQ) must not measure:**
- Arithmetic speed or mental calculation. An on-screen four-function calculator is always available; numbers are chosen so that the *reasoning step* is the difficulty, not the computation.
- Mathematics curriculum knowledge beyond percentages, ratios, rates, and basic averages (roughly UK Key Stage 3 / GCSE foundation). No algebraic notation, no geometry, no probability formulae.
- Reading speed or verbal ability. Stems ≤ 30 words, ≤ CEFR B1; all load-bearing information in the table/chart, not the prose.
- Domain knowledge. Financial vocabulary limited to a controlled list (revenue, cost, profit, units, price); no accounting conventions, exchange-rate mechanics, or industry jargon.

**Verbal (Gc-reasoning) must not measure:**
- Vocabulary breadth. Passage vocabulary controlled at ≤ CEFR B2; no low-frequency words unless defined in the passage.
- Prior/world knowledge. Every item must be answerable *solely* from the passage, and — critically — items are written so that real-world plausible beliefs point to the *wrong* answer if the passage does not support them (this is the discriminating mechanism of True/False/Cannot Say).
- Reading speed. Passages ≤ 110 words; the timing model (§3.4) budgets full reading time for a median reader.
- Cultural knowledge. Passage topics from a neutral-content list (generic workplace policies, logistics, nature, materials, fictional organisations); no politics, religion, region-specific institutions, sport, or humour.

**Everywhere:** no item may depend on test-wiseness (§3.5), device (§3.2), or first-language status beyond the controlled reading level.

## 1.3 Additional constructs evaluated

| Construct | CHC | Verdict | Rationale |
|---|---|---|---|
| Working memory | **Gwm** | **Build in Phase 2**, optional module | Gwm correlates ~.7–.85 with Gf latent factors; as a *selection* signal it is largely redundant with the Gf test, so it does not earn a core slot. It earns a module slot for job families where task-switching under load is the visible work (air-traffic-adjacent ops, dispatch, trading support) and as a research instrument for the platform's own construct-validity studies. Format: computer-administered symmetry/operation span or adaptive n-back — *not* multiple-choice, so it also diversifies the LLM-cheating surface (§7.5). |
| Processing speed / checking | **Gs** (perceptual speed, P) | **Build in Phase 1** as an optional module | Cheap to build, quick to take (4–6 min), genuinely incremental for clerical/data-entry/QA roles where speed–accuracy of routine comparison *is* the job. Deliberately speeded (§3.4). Never enters the GMA composite (its speededness would import CIV and enlarge age DIF). |
| Spatial | **Gv** (visualisation, Vz) | **Phase 3, demand-led** | Clear incremental validity for engineering, design, surgery-adjacent and skilled-trades roles, but Trajectas's current client base (executive search, professional hiring) rarely needs it, and mental-rotation items carry a well-documented gender d (~0.5–0.9 on rotation tasks). Build only when a client vertical justifies it, and prefer visualisation (paper-folding/assembly) formats over speeded rotation, which show smaller gender differences. |
| Mechanical comprehension | Gkn (domain-specific knowledge) / Gf–Gv blend | **Do not build** | Mechanical tests are part knowledge test; they violate our cultural-neutrality rule (exposure to tools, physics teaching, and tinkering is socially patterned — large, stubborn gender and SES differences), and the client base does not hire for the trades. If a client insists, license a third-party instrument rather than dilute the platform's fairness posture. |
| Error checking (transactional) | Gs/P | Folded into the checking module above | Same construct family; one module, two item styles (string comparison; table-vs-record verification). |

## 1.4 Assignment to job families

| Job family (platform taxonomy) | Core battery (Gf + RQ + Gc) | Checking (Gs) | Working memory (Gwm) | Spatial (Gv) |
|---|---|---|---|---|
| Executive / general management | ✔ (GMA composite is the headline) | – | – | – |
| Finance, analytics, consulting | ✔ (RQ profile score emphasised) | – | optional | – |
| Sales, customer success | ✔ (shorter form permissible, §2.4) | – | – | – |
| Legal, policy, comms | ✔ (Gc profile emphasised) | – | – | – |
| Operations, logistics coordination | ✔ | ✔ | ✔ (Phase 2) | – |
| Clerical, administration, data entry | Gf + Gc short forms | ✔ (headline) | – | – |
| Technology / engineering | ✔ | – | optional | Phase 3 |
| Graduate / early-careers (volume) | ✔ | ✔ | – | – |

The rule of thumb, defensible under the Uniform Guidelines' job-relatedness requirement: **the core three run wherever complex judgement is the job; modules are added only when a job analysis shows the narrow ability is a visible, frequent, important work behaviour.** Every client engagement records the job-analysis basis for the tests switched on (§6.5).

## 1.5 Composite GMA score — weighting

**Recommendation: unit-weighted composite of the three core standardised scores** (mean of the three z/θ-derived standard scores, restandardised against the norm group), reported alongside the three profile scores.

Why unit weights and not regression or factor-score weights:

1. **Robustness.** Differential weights derived from a pilot sample of realistic size (N ≈ 500–1,500) barely outperform unit weights on cross-validation and are less stable (the classic Wainer "it don't make no nevermind" result; Ree, Carretta & Earles). With three positively correlated predictors of similar reliability, the composite correlates > .98 with any plausible alternative weighting.
2. **Transparency and defensibility.** Unit weights are explainable to a tribunal or an LL144 auditor in one sentence. Optimised weights invite the question "optimised on what, and does it hold for the focal group?"
3. **Norm stability.** Unit weights let us re-norm sub-tests independently without silently changing the composite's meaning.

**Permitted deviation:** where a client's job analysis justifies emphasis (e.g., finance roles), the platform supports *documented* alternative weightings from a fixed menu (e.g., 25/50/25 emphasising RQ), each with its own norm table and its own adverse-impact monitoring. Free-form client-chosen weights are not supported — every offered weighting is a configuration we can defend. Fairness-motivated reweighting is discussed at §6.4.

Composite reliability check (Mosier, 1943): with three scales at operational reliability .85 and observed inter-test correlations ≈ .55, the unit-weighted composite reliability is
ρ_comp = 1 − Σw²σ²(1−ρ_i) / σ²_comp = 1 − (3 × 0.15) / (3 + 6 × 0.55) = 1 − 0.45/6.3 ≈ **.93**,
comfortably above the ≥ .90 composite target even if one scale dips to .82. This is why the per-scale target can sit at .85 rather than .90 — the composite does the heavy lifting for the headline score, and per-scale SEMs are reported honestly on profile scores (§4.5).

---

# 2. Battery composition: lengths, time limits, reliability trade-offs

## 2.1 Reliability targets

- **Per scale:** α / marginal reliability ≥ **.80 at pilot** (acceptance gate for building the operational form) and ≥ **.85 operational** (after item selection and, later, IRT scoring gains).
- **Composite:** ≥ **.90** (achieved via Mosier as shown above).
- Report **conditional SEM** from the IRT phase onward; a scale that hits .85 marginally but has SE(θ) > .55 in the decision region (θ where cut-scores sit) is not fit for banding there and must be lengthened or re-targeted.

## 2.2 Spearman–Brown reasoning

For a test of k items with mean inter-item correlation r̄, α = k·r̄ / (1 + (k−1)·r̄). Well-written figural and numerical reasoning items typically achieve r̄ ≈ .15–.20 in range-restricted applicant-like samples. Taking r̄ = .17:

| Items | Predicted α | Comment |
|---|---|---|
| 12 | .71 | Too short for any decision use |
| 18 | .79 | Pilot-form floor; acceptable only with strong items |
| 20 | .80 | Pilot target length |
| 24 | .83 | Operational floor |
| 28 | .85 | Operational target |
| 40 | .89 | Diminishing returns; +12 items buys +.04 |

Doubling a 20-item α = .80 test yields 2(.80)/(1+.80) = **.89**, i.e., the second twenty items buy less than the first twenty — the Spearman–Brown curve is concave, and candidate time is the scarcest resource in hiring funnels (completion rates fall measurably beyond ~45 minutes total). The design therefore does **not** chase per-scale .90 with brute length; it takes .85 per scale plus a .93 composite, and later harvests the extra precision from IRT scoring and (eventually) CAT, which delivers .90-equivalent precision at ~60% of fixed-form length.

## 2.3 Recommended operational lengths and time limits

| Test | Items (operational) | Time limit | Per-item budget | Timing policy | Predicted operational reliability |
|---|---|---|---|---|---|
| Logical/Abstract (Gf) | 18 scored + 3 unscored seeds = 21 presented | 22 min | ~63 s | Power-with-limit | .84–.87 |
| Numerical (RQ) | 16 scored + 2 seeds = 18 presented | 22 min | ~73 s | Power-with-limit | .83–.86 |
| Verbal (Gc-R) | 24 scored + 3 seeds = 27 presented | 20 min | ~44 s | Power-with-limit | .85–.88 |
| Checking (Gs) module | 60 presented, score = correct within limit | 4 min | 4 s | **Speeded** (by construct definition) | .85+ (split-half, speeded-appropriate) |
| Working memory (Gwm) module | ~15 span trials | 8 min (task-paced) | task-paced | Neither — experimenter-paced | model-based |

Verbal reaches the .85 band at 24 items because T/F/CS items are quick and its r̄ runs slightly higher; Gf and RQ sit at 18/16 items because figural and table items cost more candidate time per unit of information — their operational reliability leans on IRT scoring (marginal reliability gains of ~.02–.04 over sum-scores for the same items) to clear .85. If pilot data show either scale below .83 after item selection, the contingency is +4 items and +4 minutes on that scale, accepted in advance as the price of the target.

**Power-with-limit, defended.** The three core tests are *power tests with a generous limit*: the limit exists for operational comparability and security (unlimited time is an open door for outside assistance), not as a source of variance. Design verification: in pilot, ≥ 90% of candidates must reach the final item and the not-reached rate on the last three items must be < 10%; item difficulty must not correlate with serial position after content balancing. If those checks fail, the limit is raised before calibration — otherwise speededness contaminates the Gf/RQ/Gc constructs with Gs variance and inflates age and disability DIF (§6.4). The checking module is the deliberate exception: there, speed *is* the construct, the items are near-trivial in untimed accuracy (p > .95 untimed), and the score is throughput.

**Extra-time accommodations:** +25% and +50% presets on the power-with-limit tests, granted through the standard accommodations flow without medical adjudication by Trajectas (client policy governs); the checking module cannot be meaningfully extended (speed is the construct) and is instead flagged as inappropriate for candidates whose accommodation relates to processing speed — an alternative evidence route is the documented advice.

## 2.4 Short forms

A 12 + 10 + 16 item short battery (~30 min) is offered for high-volume/low-complexity funnels, with reliability honestly labelled (predicted α ≈ .72–.78 per scale; composite ≈ .88). Platform rule: **short-form scores may drive banding only at the composite level, never per-scale decisions**, and the report's SEM display widens accordingly. Clients wanting per-scale decisions get the full form. This rule is enforced in product, not left to guidance text.

## 2.5 Composite computation pipeline

sum score → (post-calibration) θ per test → standardised score per test (T-score, norm-group referenced) → unit-weighted mean of three T-scores → restandardised composite T and percentile → band (§4.6). Profile scores are reported with their own SEM bars; the composite with its (smaller) SEM.

---

# 3. Test-level specifications and sample items

## 3.1 Cross-test design rules

**Reading level.** All instructions and verbal content ≤ CEFR B1 (instructions) / B2 (verbal-test passages). Automated readability screening (Flesch–Kincaid ≤ grade 8 for instructions) plus human ESL review on every item.

**Cultural neutrality.** Content drawn from a controlled neutral-topic list. Banned: currency symbols other than a fictional "credits" or context-free "£/€ as label only" (numerical items use unit-labelled quantities), proper names carrying ethnicity/gender cues (fictional org names only: "Arvo Ltd", "Meridian Group"), idioms, humour, sport, politics, religion, US-specific or UK-specific institutions. Measurement units metric; dates in ISO or written-month format.

**Device constraints (mobile-first).** Every item must render on a 360 × 640 CSS-px viewport without horizontal scrolling. Figural matrices ≤ 3×3 cells; option panels stack vertically on narrow screens; tables ≤ 4 columns × 6 rows; tap targets ≥ 44 px; no hover-dependent interactions; no drag-and-drop in scored items (motor CIV + mobile unreliability). Font floor 16 px. The checking module requires landscape or desktop and says so at launch (string-comparison legibility), and the platform records form factor with every response for speededness/DIF analysis by device.

**Accessibility.**
- Figural items: colour never carries a rule alone (shape/fill-pattern redundancy); palettes pass deuteranopia/protanopia simulation; line weights ≥ 2 px.
- Verbal and numerical items: fully screen-reader compatible (semantic HTML tables, ARIA labels); the platform supports text scaling to 200%.
- Figural (Gf) and checking items **genuinely cannot be made screen-reader accessible without changing the construct** — a verbal description of a matrix is a verbal-reasoning item. This is stated openly: the documented alternative for blind candidates is the verbal + numerical evidence plus a client-side structured interview, per the *Standards*' guidance on construct-preserving accommodation. We do not pretend an inaccessible item type is accessible; we document the alternative route.
- Timing accommodations as §2.3.

**Anti-test-wiseness rules (enforced by checklist and by automated linting where possible).**
- Option lengths within ±20% of the median option length in the item (automated check on character counts).
- No "all of the above" / "none of the above" / "cannot be determined" as a dodge option (the verbal test's "Cannot Say" is a *keyed construct option*, present on every item, which removes its cue value).
- Key position balanced across the form (each position keyed 20% ± 5% for 5-option items) and never more than twice consecutively.
- No convergence cues: the key must not be the only option sharing features with the stem, nor the "middle value" systematically in numerical items (keys drawn from all rank positions).
- Distractors generated from *diagnosed error models* (see items below), never by random perturbation — random distractors are eliminable by test-wise candidates.
- Grammatical consistency between stem and all options.

**Item documentation standard.** Every item in the bank carries: stimulus (or generating template + parameters), key, solution rationale, per-distractor rationale (the error model that makes it attractive), predicted difficulty band, target response time, content codes (rule types / operation types / passage topic), reading-level check, accessibility check, sensitivity-review sign-off, and lifecycle state (§5.3). The samples below model this standard.

---

## 3.2 Logical/Abstract Reasoning (Gf) — specification

- **Format:** 3×3 figural matrix, bottom-right cell missing; 5 options. Items delivered as SVG rendered server-side to raster with per-session watermarking (§7.4) — never as text or accessible DOM describing the rule.
- **Rule taxonomy (content blueprint):** progression (rotation, size, count), distribution-of-three (Latin square), figure addition/subtraction, XOR/overlay, attribute constancy. Operational form: ≥ 3 rule families, ≤ 40% of items from any one family; difficulty driven by number of simultaneous rules (1 rule ≈ easy, 2 ≈ medium, 3 or perceptually non-obvious rules ≈ hard), per Carpenter, Just & Shell's analysis of Raven's.
- **Item ordering:** approximately ascending difficulty (candidate experience + reduces early discouragement), with seeds inserted position-matched to their predicted band.

### Sample item COG-GF-0001 (documented to operational standard)

- **Stimulus (rendered as SVG; described here for the design record):** 3×3 grid. Each cell shows a bold outline arrow and a cluster of small solid dots in the lower-left corner.
  - Row 1: arrow ↑ (1 dot) | arrow → (1 dot) | arrow ↓ (1 dot)
  - Row 2: arrow ↑ (2 dots) | arrow → (2 dots) | arrow ↓ (2 dots)
  - Row 3: arrow ↑ (3 dots) | arrow → (3 dots) | **?**
- **Rules:** (R1, rows) arrow rotates 90° clockwise left→right; (R2, columns) dot count increases by one top→bottom (equivalently: constant within row).
- **Key:** C — arrow ↓ with 3 dots.
- **Solution rationale:** apply R1 to row 3 (↑ → → → ↓) and R2/row-constancy for the count (3).
- **Options and per-distractor rationale:**
  - A. arrow ↓, 2 dots — R1 applied correctly, count perseverated from row 2 (*partial-rule error: rotation solved, count rule missed*).
  - B. arrow →, 3 dots — repeats the adjacent cell (*perceptual matching heuristic: choose the option most similar to the last cell seen*).
  - **C. arrow ↓, 3 dots — key.**
  - D. arrow ←, 3 dots — rotation over-applied one step (*rule over-extension: continues the sequence past the required cell*).
  - E. arrow ↑, 4 dots — column-continuation misread (takes column 3 as a downward count series and restarts direction) (*wrong-axis error for candidates who scan columns only*).
- **Predicted difficulty band:** easy, p ≈ .75–.85 (2 rules but both maximally salient). Positioned in the first third of the form.
- **Target response time:** 30–45 s; latency floor for security analytics 8 s (§7.3).
- **Accessibility:** direction carried by arrow shape (not colour); dots ≥ 6 px; single-colour rendering.
- **Anti-test-wiseness check:** all options visually equal complexity; key position C, balanced at form level.

### Sample item COG-GF-0002 (hard band)

- **Stimulus:** 3×3 grid; each cell contains one large shape (circle, square, triangle) with a fill state (empty, hatched, solid).
  - Row 1: circle-hatched | square-solid | triangle-empty
  - Row 2: square-empty | triangle-hatched | circle-solid
  - Row 3: triangle-solid | circle-empty | **?**
- **Rules:** (R1) distribution-of-three on shape across every row and column (Latin square); (R2) distribution-of-three on fill across every row and column.
- **Key:** B — square, hatched.
- **Solution rationale:** row 3 lacks square among shapes; column 3 lacks square; row 3 lacks hatched among fills; column 3 lacks hatched. Both constraints intersect uniquely at square-hatched.
- **Options and per-distractor rationale:**
  - A. square-solid — shape rule solved, fill rule ignored, fill copied from the most visually dominant cell in row 1 (*single-rule solver*).
  - **B. square-hatched — key.**
  - C. triangle-hatched — fill rule solved, shape perseverated from the cell directly above pattern misread (*wrong-attribute carryover*).
  - D. circle-hatched — shape taken from diagonal (*diagonal-rule misinduction, a common wrong hypothesis on Latin-square items*).
  - E. square-empty — shape rule solved, fill chosen as "missing from row 2 column 1 neighbourhood" (*locally rather than globally applied fill rule*).
- **Predicted difficulty band:** hard, p ≈ .30–.45 (two simultaneous distribution rules, no progression cue). Final third of the form.
- **Target response time:** 75–90 s; floor 15 s.
- **Accessibility:** fill states are pattern-distinct (empty/hatched/solid), not colour-distinct; passes CVD simulation trivially.
- **Anti-test-wiseness:** every option is a shape–fill pair occurring elsewhere in the matrix family; no option is eliminable by "odd one out" inspection.

## 3.3 Numerical Reasoning (RQ) — specification

- **Format:** data panel (table or simple bar/line chart) + question stem ≤ 30 words + 5 numeric options. On-screen calculator always available and its use logged (a UX affordance and a latency-analytics signal, not a scored variable).
- **Operation blueprint:** percentage change, ratio/proportion, rate (per-unit), weighted average, multi-step combination (≤ 2 steps), trend comparison. ≤ 35% of the form from any one operation type.
- **Number design:** magnitudes ≤ 6 significant digits; answers never resolvable by "roughest option wins" (distractor spacing overlaps plausible estimation error); units always stated; charts carry exact value labels so chart-reading precision is not the construct.

### Sample item COG-NR-0001

- **Stimulus (table):**

  | Region | Q1 units (000s) | Q2 units (000s) |
  |---|---|---|
  | North | 240 | 288 |
  | South | 320 | 272 |

- **Stem:** "In Q2, units sold in North were what percentage higher than units sold in South?"
- **Key:** A — 5.9% (16 / 272 = 0.0588…).
- **Solution rationale:** comparison of two Q2 values; difference 288 − 272 = 16; base is the *comparison* value (South, 272); 16/272 ≈ 5.9%.
- **Options and per-distractor rationale:**
  - **A. 5.9% — key.**
  - B. 5.6% — 16/288: correct difference, wrong base (uses the larger/North figure) (*base-selection error, the canonical percentage-comparison mistake*).
  - C. 6.7% — 16/240: difference divided by North's Q1 value (*row/column slip under time pressure — anchors on the first number in the row*).
  - D. 16.0% — reports the absolute difference (in thousands) as a percentage (*difference-as-percentage confusion*).
  - E. 20.0% — computes North's own Q1→Q2 growth, 48/240 (*answers a different, more familiar question than the one asked — reading-precision failure on "than South"*).
- **Predicted difficulty band:** medium, p ≈ .55–.70. Middle third of the form.
- **Target response time:** 60–75 s; floor 12 s.
- **Construct-boundary check:** arithmetic is two operations on 3-digit numbers with the calculator available — difficulty lives in base selection and question parsing (reasoning), not computation. No financial knowledge needed ("units").
- **Anti-test-wiseness:** options span ranks so the key is not the median value; all options to one decimal place; each distractor derived from a named error model.

## 3.4 Verbal Reasoning (Gc-R) — specification

- **Format:** passage of 70–110 words + one statement; response set fixed at **True / False / Cannot Say** (keyed as: entailed / contradicted / undetermined by the passage). 2–3 statements may share one passage (testlet), and testlet dependence is handled at calibration (§4.3 — testlet-level scoring or item dispersion across forms).
- **Blueprint:** keys balanced ~33/33/33 across the form; statement types: paraphrase entailment, scope/quantifier inference ("some/all/only"), negation, condition vs outcome, and unsupported-plausible (the belief-bias trap). Passage topics from the neutral list only.
- **The construct mechanism, stated plainly:** the test measures the discipline of confining inference to the given text. "Cannot Say" items are deliberately written so that *background plausibility* pulls toward True — resisting that pull is verbal reasoning, not general knowledge.

### Sample item COG-VR-0001

- **Passage:** "Arvo Ltd ran a six-month trial in which employees could work away from the office for up to three days each week. Taking part was voluntary and needed a manager's approval. By the end of the trial, 62% of eligible employees had taken part. The company will review the trial's results before deciding whether to make the arrangement permanent."
- **Statement:** "Employees who took part in the trial were more productive than those who did not."
- **Response options:** True / False / Cannot Say.
- **Key:** Cannot Say.
- **Solution rationale:** the passage reports participation and process only; it contains no information about productivity in either group, so the statement is neither entailed nor contradicted.
- **Per-option (distractor) rationale:**
  - True — chosen by candidates importing the widely held prior that flexible working improves productivity, or over-reading "the company will review the results" as implying positive results (*belief-bias / unwarranted-implication error — the diagnostic error this item type exists to detect*).
  - False — chosen by candidates who treat absence of evidence as evidence of absence, or who import the opposite prior (*over-correction error*).
  - **Cannot Say — key.**
- **Predicted difficulty band:** medium, p ≈ .50–.65.
- **Target response time:** 45–60 s (passage read + statement judgement); floor 10 s.
- **Reading-level check:** CEFR B1–B2; no low-frequency vocabulary; sentence length ≤ 22 words.
- **Cultural-neutrality check:** fictional company, globally familiar policy topic, no jurisdictional content.
- **Anti-test-wiseness:** the T/F/CS set is constant across all items, so option form carries zero cue; key balance enforced at form level so "Cannot Say" is not the modal safe guess.

## 3.5 Checking module (Gs) — specification and sample

- **Format:** pairs of alphanumeric strings; respond **Same / Different**. 60 pairs, 4-minute limit; score = correct responses within the limit with a correction applied for random responding (accuracy floor: flag if error rate > 15%, since untimed accuracy is near-ceiling by design — high error rates indicate disengagement or gaming, not low Gs).
- **Timing policy:** **speeded by construct definition** — perceptual speed *is* throughput on trivially easy discriminations. Stated to candidates before start.

### Sample item COG-CK-0001

- **Stimulus:** `GX-4471-PB` vs `GX-4711-PB`
- **Key:** Different.
- **Solution rationale:** transposition of the middle digits (47**71** vs 47**11** — positions 3–4 of the digit block differ).
- **Error model / difficulty rationale:** adjacent-digit transpositions are the hardest discrimination class in proofreading research (perceptual chunking reads "4471" and "4711" as the same gestalt); this class populates the hard tail of the module. Other classes in the blueprint: identical pairs (~50%), single-character substitution, case change, hyphen/segment shift.
- **Predicted difficulty:** untimed p > .95; contributes variance only under time constraint (as designed).
- **Target response time:** 4–6 s.
- **Device note:** desktop/landscape enforced; monospaced font; string length ≤ 12 characters for mobile-width safety margin.

## 3.6 Working memory module (Gwm) — specification and sample (Phase 2)

- **Format:** operation span. Alternating verification–storage trials: candidate verifies a trivial arithmetic statement (True/False, 3-second response window), then sees a consonant for 800 ms to hold; after 3–7 pairs, recalls the consonants in order. Score: partial-credit load score (sum of correctly recalled-in-position letters), modelled psychometrically rather than CTT-summed.
- **Sample trial COG-WM-0001:** verify "(3 × 4) − 2 = 9" → **False** (key: 12 − 2 = 10; the statement is designed so the error is small-magnitude, forcing genuine computation rather than gross-implausibility rejection); then store "K". Documented rationale: the processing task's only function is to occupy the phonological loop — its difficulty must stay trivial (target verification accuracy ≥ 85%) or it contaminates the span score with arithmetic ability; trials with verification accuracy < 85% for a candidate are flagged and the span score annotated.
- **Timing:** experimenter-paced; neither speeded nor power (span paradigm).
- **Why not MCQ:** span tasks resist paste-into-LLM cheating structurally (§7.5) and avoid distractor-writing burden; the cost is bespoke calibration (not 2PL-MCQ; use a graded/partial-credit or process model at calibration).

---

# 4. Scoring architecture

## 4.1 Phase overview

**Phase A — Pilot (CTT).** Sum scores, classical item analysis, form assembly. No candidate-facing decisions from pilot data beyond research-participation feedback.
**Phase B — Calibration (IRT 2PL).** Item parameters estimated; bank established; scoring switches to θ-based.
**Phase C — Operational.** θ → standardised score → percentile → band, with conditional SEM; ongoing drift and DIF monitoring.

## 4.2 CTT pilot analysis — decision rules

Per item, computed within test and within pilot form:

- **Difficulty (p-value):** keep **.30 ≤ p ≤ .85**. Below .30, an MCQ item is operating near its chance floor (5-option chance = .20) and its discrimination estimate is unstable; above .85 it contributes little variance (retain a small number of .80–.90 items deliberately as warm-up/anchor content, flagged as such, but they do not count toward the reliability budget).
- **Discrimination:** corrected item–total correlation **r_it ≥ .20 to keep**; .15–.20 → revise and re-pilot; < .15 or negative → kill. Also inspect item-deleted α.
- **Distractor analysis (mandatory, per option):** each distractor must attract ≥ 3% of respondents (else it is dead weight — replace); each distractor's mean total score must be *below* the key's (an option whose choosers outscore key-choosers signals a miskeyed or genuinely ambiguous item — automatic hold + content re-review); trace lines (option choice by total-score quintile) eyeballed for non-monotone keys.
- **Not-reached and omission rates** per item (speededness audit, §2.3); **response-time distributions** per item versus target RT band (items whose median RT exceeds 1.5× target are flagged for stimulus simplification even if statistics pass — they tax the form's time budget).
- **Key-balance and option-length lint** re-run on the surviving set.

Gate to Phase B: per-scale α ≥ .80 on the assembled operational-candidate form, ≥ 90% completion within limit, blueprint coverage intact after kills.

## 4.3 IRT model choice — 2PL, defended honestly

**Recommendation: 2PL** (two-parameter logistic: difficulty b, discrimination a) for all MCQ scales, moving from CTT once per-item calibration Ns reach the threshold below.

- **Why not Rasch (1PL)?** Rasch's equal-discrimination assumption is empirically false for heterogeneous reasoning banks (figural rule families and verbal statement types reliably differ in a); forcing Rasch either discards good high-a items or mis-weights them, and misfit at the item level becomes misfit in θ. Rasch's genuine advantages — specific objectivity, small-N stability (usable from **N ≈ 200–300**) — make it the *fallback*, not the target: if calibration volume stalls, we can run Rasch as an interim scoring model and upgrade, because Rasch is nested in 2PL and re-calibration preserves the bank.
- **Why not 3PL?** The guessing parameter c is the right theory for MCQs (5-option chance ≈ .20) but is notoriously hard to estimate: c and b are strongly collinear, and stable 3PL calibration realistically needs **N ≈ 1,000+ per item** with good low-ability coverage — which selection samples, being range-restricted at the low end, conspicuously lack. Freeing c on 500 responses buys noise, not truth. Instead: **2PL with a fixed lower asymptote as a sensitivity analysis** (2PL vs fixed-c "3PL-with-c=.20/k" compared on information and θ-ordering; adopt fixed-c only if it materially changes decisions, which it rarely does above the cut regions we use).
- **Required Ns, stated honestly:** Rasch **~200–300** responses/item minimum; 2PL **~500** responses/item for stable a and b (down to ~400 tolerable with strong priors/MAP estimation and a well-targeted sample); 3PL **~1,000+**. Calibration proceeds bank-slice by bank-slice as seeds accumulate responses (§5.1); no item is promoted to operational scoring below its model's N floor.
- **Testlets (verbal):** shared-passage items violate local independence. Either (a) cap at 2 statements per passage and confirm residual correlations (Q3 < .20) or (b) calibrate at testlet level (polytomous graded model on testlet scores). Decision taken on pilot Q3 evidence, not by preference.
- **Estimation:** marginal maximum likelihood (MML/EM) for item parameters (mirt/IRTPRO-class tooling); **EAP** for candidate θ (stable at short test lengths, defensible priors: standard normal on the calibration population); calibration code and seeds version-controlled, every parameter set immutable and versioned (§5.4).

## 4.4 θ → reported score pipeline

1. **θ (EAP)** on the test's calibrated metric, with posterior SD as conditional SEM.
2. **Scale linkage:** all forms report on the bank metric via anchor-item linking (§5.2), so θ is form-independent.
3. **Standardised score:** T-score (mean 50, SD 10) referenced to a **named norm group** (§8.3) — the report always states which norm group, its N, and its collection window. No percentile is ever shown against a norm group with N < 500 (§8.3).
4. **Percentile** from the empirical norm distribution (not the normal approximation, unless normality is confirmed).
5. **Composite:** §2.5.
6. **Conditional SEM displayed** as a band on every score (e.g., "T = 62 ± 4"), with plain-language framing ("scores within this range are not meaningfully different").

## 4.5 SEM reporting

- Per-scale conditional SEM from the IRT information function at the candidate's θ; pre-IRT, classical SEM = SD·√(1−α).
- **Design constraint:** SE(θ) ≤ .40 (marginal reliability ≈ .84+) across θ ∈ [−1.5, +1.5], the region where hiring cuts live; forms are assembled against the target information function, not just blueprint counts.
- Client-facing reports show SEM bands graphically; the API exposes numeric SEM so clients' own pipelines cannot silently drop it.

## 4.6 Score bands for hiring decisions — defended

**Recommendation: report scores in 4–5 labelled bands anchored to the norm distribution (e.g., A ≥ 90th, B 70–89th, C 30–69th, D 10–29th, E < 10th), with the exact percentile and SEM available underneath — and advise clients to decide at band level.**

Why banding, rather than strict rank-ordering:

1. **Measurement honesty.** With SEM ≈ 3–4 T-points, adjacent candidates 2 points apart are statistically indistinguishable; rank-ordering on raw score manufactures spurious precision and is indefensible under cross-examination ("what is the reliability of the difference between rank 4 and rank 5?").
2. **Adverse-impact management within the law.** Banding reduces the adverse impact of top-down selection at a modest, quantifiable validity cost (Cascio, Outtz, Zedeck & Goldstein's SED-banding literature). Bands are fixed *ex ante* from the norm distribution and SEM — never drawn after seeing subgroup results, and never race/sex-conscious (which US law prohibits post-Ricci; the UK Equality Act likewise bars positive discrimination at the decision point).
3. **Appropriate role of the test.** GMA is one input; band-level use structurally invites clients to combine it with other evidence rather than let a 1-point difference decide.
4. **Band edges are still edges.** The report shows the SEM bar crossing band boundaries when it does, and the guidance text tells clients to treat boundary-straddling candidates as members of both bands. Band width (~0.5–1.0 SD) is chosen so that a 1-SEM movement rarely jumps two bands.

**Sequential screening (defended configuration):** where a client uses the battery as an early sieve, the recommended cut is low (e.g., exclude only E band), documented as minimum-competency screening rather than top-down selection — the configuration with the best validity-per-adverse-impact profile for volume funnels.

---

# 5. Calibration and item-banking operations

## 5.1 Pilot and seeding design

**Stage 1 — Standalone pilot (pre-launch).** Volunteer/incentivised sample, demographically tracked, N ≥ 300 per form for CTT gates. Forms of ~30 candidate items + 6 anchor candidates each; **spiralled assignment** (forms allocated round-robin within recruitment stream) so form samples are randomly equivalent; motivation screened (instructed-response check, RT floor filters) because low-stakes pilot data understate operational p-values by ~.05 — a shift we correct for at operational recalibration.

**Stage 2 — Live seeding (perpetual).** Every operational sitting carries **2–3 unscored seed items** (§2.3 table), indistinguishable from scored items, position-matched to predicted difficulty. Candidates are told the test "may include unscored trial questions" (informed, per the *Standards*), never which ones. Seeds accrue responses across sittings until their model-N floor is met (2PL: ~500), then calibrate onto the bank metric via the operational items as internal anchors (fixed-parameter calibration). Seeding rate 10–15% of test length is the deliberate ceiling — enough for ~40–60 new calibrated items per test per year at moderate volume, cheap enough in candidate time to be ethical.

**Stage 3 — Cross-form anchoring.** Parallel operational forms share an **anchor set of 5–6 items (~25–30% of scored length), blueprint-representative and difficulty-spread**, placed in matching serial positions. Anchors are the linking spine: new forms calibrate through them (Stocking–Lord or fixed-anchor); anchor drift is tested every calibration cycle (robust z on b-shift; drifting anchors are dropped from the link, never bent to fit).

## 5.2 Item lifecycle states

State machine (enforced in the platform's item-bank schema; transitions logged, role-gated):

```
draft → content-reviewed → fairness-reviewed → piloting → calibrated → operational
                                                   ↘ killed          ↕
                                                             suspended (drift/DIF/exposure)
                                                                  ↓
                                                               retired (archived, never re-keyed)
```

- **draft:** written to template with full documentation (§3.1 standard) including predicted difficulty and error-model distractors.
- **content-reviewed:** second psychometrician sign-off on construct fit, key correctness, anti-test-wiseness lint pass.
- **fairness-reviewed:** sensitivity review against the cultural-neutrality and accessibility checklists; ESL read-through.
- **piloting:** live as unscored seed; accumulating responses; CTT screens run continuously; auto-kill on r_it < .10 at N ≥ 200 (no point waiting for the full calibration N on a dead item).
- **calibrated:** parameters estimated, fit checked (S-X² / infit-outfit as applicable), DIF-screened (§6.1) — DIF screening is a *promotion gate*, not an afterthought.
- **operational:** scoreable; exposure metered (§5.3); parameters frozen per version; annual drift check (b-shift, a-shift, RT-shift — RT drift is an early leak indicator, §7).
- **suspended:** pulled from assembly pending investigation (DIF flag, drift, suspected exposure); reversible.
- **retired:** permanent; retained for research and audit; never returns (a leaked item is leaked forever).

## 5.3 Exposure control for fixed forms

- **Exposure budget per item:** target ≤ 25% of a construct's annual volume sees any given item; achieved with ≥ 4 parallel forms per test in year 1, growing with the bank.
- **Within-form randomisation:** option order randomised per sitting (with key-balance bookkeeping done on the canonical form); item order fixed within difficulty blocks but block-internal order shuffled — full shuffle is avoided so the ascending-difficulty candidate experience and position-matched seeding survive.
- **Assembly-on-demand (year 2+):** once ≥ ~120 calibrated items per construct exist, replace fixed forms with **linear-on-the-fly testing (LOFT)**: each sitting assembled from the bank under blueprint + target-information constraints, anchors implicit in the shared bank metric. LOFT multiplies effective form count, collapses per-item exposure, and is the natural stepping stone to CAT.
- **Exposure telemetry:** per-item exposure count, unique-client spread, and calendar exposure curve on the item dashboard; automatic suspension proposal at budget breach or anomalous regional exposure spikes (leak signature).

## 5.4 CAT roadmap — when it becomes worth it

CAT is **not** a launch feature. It becomes worth building when *all* of:

1. **Bank depth:** ≥ 150–200 *calibrated, DIF-clean, in-fit* items per construct (≥ 8–10× test length), with information spread across θ ∈ [−2, +2] — the high-difficulty tail is always the bottleneck and must be deliberately over-commissioned.
2. **Parameter stability:** two consecutive annual recalibrations with negligible drift on the anchor spine.
3. **Volume:** enough sittings that the seeding pipeline can keep refreshing a bank that CAT will burn faster at the θ extremes.

What the engine needs (catR/jsCAT-class functionality, built or adopted **server-side only** — client-side adaptive logic would ship item parameters and the key-adjacent information structure to the browser, §7.1):

- θ estimation: EAP with normal prior (switchable to MLE past 10 items); **starting θ from a mild prior, never from CV/application data** (fairness and defensibility).
- Selection: maximum Fisher information at current θ̂, wrapped in **randomesque top-k selection** (k = 5) plus **Sympson–Hetter exposure control** (target max exposure .20) and **content balancing** (weighted-deviation or shadow-test constraints so every candidate still gets a blueprint-valid experience).
- Stopping: SE(θ) ≤ .32 (reliability ≈ .90 equivalent) or 25-item / 25-minute ceiling, whichever first; minimum 12 items regardless (face validity + content coverage).
- Full item-level audit log (θ path, information, exposure state) retained per sitting for LL144-grade auditability.
- Expected payoff, stated plainly: ~.90-precision measurement in ~60% of the fixed-form time, and a step-change in security because no two candidates see the same test. Until the three conditions hold, LOFT delivers most of the security benefit at a fraction of the engineering and bank cost.

---

# 6. Fairness programme

## 6.1 DIF analysis plan

**When:** at the calibrated→operational promotion gate for every item, and annually on the operational bank; additionally on demand after any content-policy change.

**Groups:** gender (men/women; non-binary candidates included in analyses when cell sizes permit, never singled out in reporting below n=50), age (< 40 vs ≥ 40, mirroring ADEA; plus continuous-age LR as sensitivity), ethnicity (per jurisdictional taxonomy — UK ONS categories for UK norms, EEOC categories for US clients; analysis per available focal group), and **English-as-second-language** (self-reported first language, the platform's most sensitive CIV probe for verbal/numerical stems). Demographics collected voluntarily, stored separately from scores, used solely for fairness analytics, per-jurisdiction consent language.

**Methods, run in tandem:**
- **Mantel–Haenszel** with total-score matching (thin strata), two-stage purification (flagged items removed from the matching variable, re-run), effect size ΔMH with **ETS classification: A (|ΔMH| < 1.0) negligible; B (1.0–1.5) slight, review; C (> 1.5, significant) — automatic suspension pending content review.** MH is the workhorse: robust at focal-group n as low as ~100–200, transparent to auditors.
- **Logistic regression DIF** (score, group, score×group) for **non-uniform DIF that MH cannot see**; flag on likelihood-ratio test p < .01 *and* ΔR² ≥ .035 (Zumbo–Thomas moderate) — significance alone at large N flags trivia.
- From the IRT phase: **IRT-based DIF (Lord's χ²/Raju area)** as convergent evidence, and DIF-as-drift monitoring on anchors.
- **Minimum focal-group n = 100 for MH screening (interpret with caution), 200 for promotion decisions.** Items lacking focal-group data queue in a "DIF-pending" sub-state and are prioritised for seeding into sittings with richer demographic mix; the honest position is that some focal groups (small ethnic categories in early UK volume) will take time to reach analysable n, and the technical manual says so rather than pretending coverage we do not have.
- **Outcome protocol:** flagged item → blind content review (reviewers see the item, not the statistics' direction) → revise-and-repilot or retire. DIF statistics alone never "convict" an item without a content account, but a C-classification always removes it from scoring while under review. All DIF decisions logged for audit.

## 6.2 Expected subgroup differences — stated honestly

Cognitive ability measures show some of the largest and most stable subgroup mean differences in psychology, and this document will not pretend otherwise. Planning figures from the meta-analytic literature (US-dominated; UK evidence is thinner but directionally similar):

- **Black–White:** d ≈ 0.8–1.0 on GMA composites in applicant samples (somewhat smaller in some recent applicant-pool estimates, ~0.6–0.8, but plan on the larger figure).
- **Hispanic–White:** d ≈ 0.5–0.8, larger on verbally loaded content.
- **ESL effects:** verbal tests commonly show d ≈ 0.5+ against non-native speakers *independent of reasoning ability* — this is CIV we can and must attack through reading-level control (§1.2) and ESL-targeted DIF.
- **Gender:** ≈ 0 on g; small differences on numerical (d ≈ 0.1–0.3 favouring men in applicant pools) and verbal (small, sometimes favouring women); large on speeded perceptual checking (favouring women, d ≈ 0.3–0.5) and on mental rotation (favouring men, d ≈ 0.5–0.9 — a reason Gv is demand-led and visualisation-format, §1.3).
- **Age:** Gf and Gs decline with age (Gf d ≈ 0.4–0.8 comparing 50s to 20s cross-sectionally; Gs larger), Gc is flat-to-rising. Removing speededness from the power tests (§2.3) is the single most effective age-fairness design decision available; the speeded checking module will show age differences and its job-family gating (§1.4) is the justification discipline.

**The diversity–validity dilemma, treated honestly:** GMA's predictive validity and its adverse impact arrive together; no scoring trick removes group differences while leaving validity untouched (Ployhart & Holtz; Sackett et al.). Trajectas's position: (a) never hide the trade-off from clients — the platform surfaces projected impact ratios alongside validity expectations; (b) attack the *construct-irrelevant* portion of the gap relentlessly (reading level, speededness, cultural content, UIT conditions, DIF hygiene) because that portion is measurement error we own; (c) manage the *construct-relevant* remainder through configuration choices that are legally available (below), and (d) refuse the two indefensible corners — abandoning cognitive measurement entirely for complex roles, and within-group score adjustment, which is unlawful in the US (CRA 1991 §106 ban on score adjustment) and positive discrimination in the UK.

## 6.3 Mitigations (in order of preference)

1. **CIV removal** — everything in §1.2/§3.1; this is fairness engineering, costless to validity.
2. **Remove speededness** from power tests (§2.3) — shrinks age and disability impact and some ethnic-group impact attributable to differential time-pressure familiarity.
3. **Composite weighting** — within the documented weighting menu (§1.5), weightings that lean on lower-d components (e.g., greater Gc weight where job analysis supports it) modestly reduce composite d; only ever justified *by job analysis*, with the validity cost quantified, never by subgroup results alone (that would be adjustment by the back door).
4. **Banding** (§4.6) and **low-cut sequential screening** rather than top-down rank order.
5. **Battery-level design:** encourage clients to combine GMA with lower-impact valid predictors (SJTs, structured interviews, the platform's non-cognitive instruments) in a compensatory composite — the best-evidenced route to Pareto improvements on the validity/diversity frontier.
6. **Monitoring:** per-client adverse-impact dashboards (4/5ths ratio plus statistical tests at realistic Ns) so impact is detected in weeks, not at lawsuit time.

## 6.4 Legal-defensibility documentation

Maintained as living artefacts, versioned with the bank:

- **US (Uniform Guidelines, 29 CFR 1607):** job-analysis linkage per client engagement (§1.4), validity evidence file (content + criterion as it accrues, §8), adverse-impact monitoring records, documentation of consideration of less-adverse alternatives (§6.3 is that record), and the technical manual. Score adjustment by group: never (CRA 1991).
- **UK (Equality Act 2010):** indirect-discrimination exposure analysis — the test is a "provision, criterion or practice"; our defence is the *proportionate means of achieving a legitimate aim* file: validity evidence, the CIV-reduction programme, banding, and the documented rejection of more-discriminatory configurations. Reasonable-adjustments register (§2.3, §3.1 accessibility) with per-candidate accommodation logs.
- **EU AI Act:** employment-selection AI is **Annex III high-risk**. Obligations mapped and owned: risk-management system (this programme), data-governance documentation (norm/calibration sample provenance and representativeness), technical documentation and logging (per-sitting audit trail, §5.4), transparency to candidates (test purpose, unscored-seed notice, complaint route), **human oversight** (the platform never auto-rejects; scores feed a human decision, and the product enforces this positioning in client workflows), accuracy/robustness evidence (reliability, SEM, drift monitoring), and conformity-assessment readiness. Algorithmic scoring here is transparent psychometrics (2PL is a published, inspectable model — a genuine advantage over black-box scoring, and we say so in the documentation).
- **NYC Local Law 144:** the battery used for NYC candidates is an AEDT → annual **independent bias audit** (impact ratios by sex, race/ethnicity, and intersections; scored-rate ratios for banded outputs), public summary posting, 10-business-day advance candidate notice. The platform's data model retains what the audit needs (selection-stage outcomes by category) by design, and client contracts allocate the notice obligation explicitly.
- **Candidate-facing transparency pack** (all jurisdictions): what is measured, how scores are used, practice items, accommodation route, retake policy, data retention.

---

# 7. Security and UIT

## 7.1 Server-side scoring, absolutely

- Answer keys, item parameters, and scoring logic live server-side only. The client receives stimulus content and records responses; **no key, no parameter, no per-item correctness feedback ever crosses the wire** (no immediate right/wrong, no adaptive tell). Responses posted per item with server timestamps (client timestamps recorded but never trusted).
- Item content delivered just-in-time (one item ahead at most), authenticated session, short-lived signed URLs for figural assets; no bulk form download.

## 7.2 Exposure and forms

- Exposure budgets and multi-form/LOFT rotation per §5.3. Randomised option order per sitting. Regional/temporal exposure anomaly alarms (an item's traffic spiking from one geography or one client is the classic leak signature).
- **Item-harvest tripwires:** honeypot monitoring of paste/copy events (blocked and logged), devtools-open detection (logged, not blocked — blocking is evadable and punishes the innocent), and periodic web/Telegram sweep for leaked stimuli (hash-matched via the watermark scheme below).

## 7.3 Response-latency and behavioural anomaly detection

Per sitting, computed post-hoc (flags feed a review queue; **no candidate is ever auto-failed on analytics alone**):

- **Per-item RT floors** (§3 item cards): a correct response faster than the item's floor (e.g., 8 s on a matrix whose median is 45 s) is individually innocuous, but *patterns* are not — flag on ≥ 3 sub-floor corrects, weighted by item difficulty (fast-correct-on-hard is the pre-knowledge signature).
- **RT ceilings / rhythm:** metronomic inter-item intervals (low RT variance) suggest scripted assistance; long-stall-then-fast-correct cycles suggest out-of-band lookup.
- **Model-based:** lognormal response-time model (van der Linden) residuals per person-item; person-fit (l_z) on the response pattern; RT–accuracy incongruence score combining both.
- **Score-context checks:** seed-vs-scored performance divergence (help on scored items only), and verification-retest divergence (§7.6).

## 7.4 LLM-cheating countermeasures

Assume every verbal/numerical stem can be pasted into an LLM that answers at a high-θ level in seconds. Layered response:

1. **Item types that resist paste:** figural matrices delivered as **flattened SVG-to-raster images with per-session visual watermarking and no semantic markup** — a screenshot into a multimodal model remains possible but is slower, clumsier on a phone, and lands squarely in the RT-analytics net; span/WM tasks (Phase 2) are structurally unpasteable. The battery's centre of gravity (Gf headline) is deliberately its most paste-resistant test.
2. **Time discipline:** per-item budgets tight enough that systematic out-of-band querying costs more time than it saves across the whole form (the whole-form time limit is the real constraint, §2.3), plus the floor/ceiling analytics above.
3. **Honesty contract:** pre-test attestation naming prohibited aids (other people, AI tools, capture devices), consequences, and the existence of verification retesting. Evidence says this shifts marginal cheaters; nobody should pretend it stops determined ones — it exists for norm-setting and for the paper trail.
4. **Environment signals:** focus-loss/tab-switch counts, paste events, multi-display heuristics, device fingerprint continuity — logged, weighted into the anomaly score, never used alone.
5. **The honest architectural position:** UIT is screening. The design goal is to make cheating *costly, detectable and reversible*, not impossible; irreversibility comes from §7.6.

## 7.5 Verification retest

- Shortlisted candidates (client-configurable stage) sit a **10–12 minute supervised or proctored short parallel form** (LOFT-assembled from unexposed bank items). Decision statistic: regression-based expected score given UIT θ, flag when verification θ falls below the one-sided 95% band (per ITC UIT guidelines' verification model).
- Divergence triggers a defined protocol: second verification opportunity under proctoring, human review, client-facing "verification not confirmed" status — **never an accusation of cheating in candidate-facing language** (the divergence could be illness, environment, or measurement error; the language and the workflow respect that).

## 7.6 Retake policy

- Standard retake interval: **180 days per construct** (practice effects on figural reasoning are largest and decay slowly); a client-initiated exception path at 90 days delivers a different form with zero item overlap with the candidate's history (per-candidate exposure ledger enforces this mechanically).
- Best-score vs latest-score: **latest score stands** (pre-announced); practice-effect research on our own bank (retest cohort analysis) is a standing research-agenda item, and norms are applicant-first-attempt only.
- All prior attempts visible to the scoring system (person-level exposure ledger), never more than the latest reported to clients.

---

# 8. Validation roadmap and — **Empirical validation requirements**

Everything above is blueprint. **These instruments are drafts. They must not be used for live hiring decisions until the following programme gates have been passed, in order.** This section is the binding checklist.

## 8.1 Content validity (pre-pilot gate)

- Construct definitions (§1) and test blueprints (§3) reviewed by ≥ 2 independent chartered/registered psychometricians; every item mapped to blueprint cells; coverage matrix published in the technical manual.
- Formal content-review panel per test (item-level Lawshe-style essentiality ratings from ≥ 8 SMEs; items below CVR threshold for panel size revised or dropped).
- Sensitivity/fairness review sign-off per item (§5.2 lifecycle gate) — completed for 100% of piloted items, no grandfathering.
- Job-analysis linkage template operational in the platform before the first client configuration (§1.4).

## 8.2 Pilot and calibration (empirical gates)

1. **Standalone pilot:** N ≥ **300 per form per test** (≥ 600 per test across two forms), demographically tracked, motivation-screened. CTT gates per §4.2: p ∈ [.30, .85], r_it ≥ .20, clean distractor analysis, α ≥ .80 per assembled scale, ≤ 10% not-reached on final items.
2. **Speededness audit** passed (§2.3) or time limits revised and re-piloted.
3. **2PL calibration:** ≥ **500 responses per item** (interim Rasch permissible at 200–300 with the upgrade path stated in §4.3); item fit (S-X² p > .01 or documented exception), local-independence checks (Q3 < .20), testlet decision (verbal) resolved on evidence.
4. **DIF screening:** MH + LR per §6.1 for every operational candidate item, focal-group n ≥ 200 per promoted item for gender and age; ethnicity and ESL screening at best-available n with the coverage gap explicitly recorded in the manual until n ≥ 200 is reached. No ETS-C item enters operational scoring.
5. **Reliability:** marginal reliability ≥ .85 per operational scale, composite ≥ .90 (Mosier, on observed intercorrelations), SE(θ) ≤ .40 across θ ∈ [−1.5, 1.5]. Test–retest (2–4 week, n ≥ 100 per test) r ≥ .80 target.

## 8.3 Norming

- **No percentile or band is reported against any norm group with N < 500.** Launch norm groups: UK general applicant, UK managerial/professional, graduate/early-careers; each defined by population, recruitment window, first-attempt-only rule, and demographic composition table published in the manual. Client-local norms offered only at client-N ≥ 500 with the same documentation.
- Norm refresh cycle ≤ 3 years or on drift evidence, whichever first.

## 8.4 Construct (convergent/discriminant) validation

- Convergent study (n ≥ 200): corrected correlations targeted at **r ≥ .60–.70** between our Gf test and an established figural-reasoning measure (e.g., ICAR matrix set / Raven's APM short form), and analogous targets for RQ and Gc-R versus established numerical/verbal reasoning tests; composite vs full established GMA measure r ≥ .70 corrected.
- Discriminant: sub-test correlations with the platform's non-cognitive scales materially lower than with cognitive markers; verbal test's correlation with an ESL-proxy/reading-speed measure examined as a CIV check, not celebrated as validity.
- CFA: hierarchical g model fit reported honestly (fit indices and the competing bifactor solution both published).

## 8.5 Criterion validation

- Standing client research programme: predictive designs where feasible (scores banked at application, criteria collected at 6–12 months — supervisor ratings on a structured instrument, training outcomes, objective indicators where honest ones exist), concurrent designs as the pragmatic bridge; per-study n ≥ 150 before any client-facing validity claim, meta-analysed across clients as studies accrue, with range-restriction and criterion-reliability corrections reported alongside uncorrected coefficients — never corrected-only.
- Adverse-impact and differential-prediction analysis in every criterion study (intercept/slope tests, reported regardless of result).

## 8.6 Technical manual (the artefact BPS/EFPA registration requires)

One manual per test plus a battery manual, structured to the **EFPA Test Review Model** criteria (which BPS test registration applies): construct rationale and boundaries; development history; item-analysis and calibration evidence; reliability (internal, retest, conditional SEM); validity (content, construct, criterion — with the honest state of each); norms (definitions, Ns, composition, dates); fairness evidence (DIF, subgroup statistics, differential prediction); administration, scoring, accommodation and security procedures; user-qualification requirements; and known limitations. The manual is versioned with the bank; **no marketing claim may exceed the manual**, and the manual may not exceed the data.

## 8.7 Concrete sequencing

| Step | Gate | Minimum N |
|---|---|---|
| 1. Item authoring + reviews | 100% items through content + fairness review | ~2× target bank size authored (attrition budget 40–50%) |
| 2. Standalone pilot | CTT gates, speededness audit | 300/form/test |
| 3. Form assembly + soft launch (research-labelled, non-decisional) | α ≥ .80, blueprint intact | — |
| 4. 2PL calibration | fit, LI, N floors | 500/item (Rasch interim at 200–300) |
| 5. DIF promotion screen | no C-items operational | 200/focal group/item |
| 6. Norming | published norm tables | 500/norm group |
| 7. Convergent study | targets in §8.4 | 200 |
| 8. Operational release for decision support | all above + manual v1.0 | — |
| 9. Criterion studies + LL144 audit + drift/DIF annual cycle | ongoing | 150/study |

**Restated for the record: the battery described in this document is a design. It has no reliability, no validity, no norms and no fairness evidence until the gates above are passed, and no Trajectas material — sales, product UI, or reports — may state or imply otherwise before Step 8 is complete.**
