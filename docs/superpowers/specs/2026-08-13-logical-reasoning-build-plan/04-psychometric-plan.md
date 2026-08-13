# Trajectas Logical Reasoning — Psychometric Plan

**Status: PLAN. Nothing described here has been administered to a single human being. No claim of reliability, validity, fairness, norms or fitness for selection is made or implied anywhere in this document, and none may be made until the corresponding milestone in §5 is passed and documented.**

**Scope.** The calibration strategy for the logical reasoning instrument specified in `03-logical-reasoning-design.md`, operating under the battery programme in `06-battery-and-psychometric-programme.md`. Primary focus is the figural matrix component (LR-M); the deductive component (LR-D) follows the same machinery with the differences noted inline.

**The question this answers.** *"Getting 250 completions is hard. Can modern AI methods or existing data reduce the requirement?"*

**The short answer.** AI cannot reduce the number of humans, and the published evidence on that is unusually clear. Existing open data reduces engineering risk and sharpens the difficulty model, but does not substitute for calibration either. What genuinely reduces cost is a different set of levers — a larger *item* bank, the right estimator, a design where everybody sees the same core form, and claiming occupation-specific rather than general-population norms. Under those levers the honest numbers are **≈400 completions for a defensible internal instrument** and **≈1,200 completions before the instrument may inform a hiring decision**. That is a low-five-figure cost, not a research-grant cost, and it is smaller than the client fears — but it is not 250, and the binding constraint is not item difficulty. It is fairness evidence.

**Two amendments to existing specs are proposed here** and flagged at §9: the IRT model at launch, and the calibration sampling design.

---

## 1. The strategy in one page

Five layers. Each buys something specific, and each has a stated limit. The design intent is that no single layer carries a load it cannot bear.

### Layer 1 — Strong-theory generation: difficulty engineered in via radicals

Items are generated from an explicit rule grammar (`03-logical-reasoning-design.md` §3–§4) so that the difficulty-driving parameters — rule count, rule type, cross-layer mapping, perceptual load, distractor strategy — are recorded as structured data at generation time, not inferred afterwards.

**What this buys.** A generative bank that can be expanded without re-authoring, an audit artefact per item, and a difficulty model with named predictors that can be explained to a reviewer or a tribunal. Critically, it makes the cheap resource (items) substitutable for the expensive resource (people) in the one place where that substitution is legitimate — establishing generalisable design-feature effects, where the binding constraint is item-pool size, not person-sample size.

**What it does not buy.** Known difficulty. Across the two largest item samples in the literature the design radicals explain roughly a third to a half of clone-level difficulty variance: MaRs-IB, 384 items, element count + rule count = 38.6% of clone-level variance (67.6% at template level, where clone noise averages out); OMIB, 220 items, six rule indicators = 34%. Re-analysis of the MaRs-IB raw trial data gives a non-circular figure of **R² ≈ 0.50 including distractor strategy, 0.36 on rules and elements alone, and 0.43 out-of-sample under template-held-out cross-validation** — with an out-of-sample RMSE around 0.55 logits.

There is a hard ceiling underneath that. In the MaRs-IB data, **28% of true item-difficulty variance sits between clones that are identical on every modelled radical** and differ only in surface shapes. No radical-based model can reach it. The within-clone-family residual SD was 0.620 logits and the mean absolute difficulty difference between supposedly interchangeable clones was 0.705 logits. The authors' conclusion is the one we adopt: **item clones cannot be assumed psychometrically exchangeable.**

The higher published figures (Primi's R² = .865; Arendasy & Sommer's r = .94) come from 26-item and mental-rotation banks respectively and should not be quoted for this instrument. Primi's printed F and degrees of freedom do not reconcile, and 26 items cannot support a seven-predictor equation.

**Plan on 40–50% of difficulty variance remaining unexplained. Never write "difficulty is known by design" in any document.**

### Layer 2 — Difficulty priors from published models and open data

Two open assets are usable, subject to §8's licence gates:

- **`github.com/ndawlab/mars-irt`** (MIT, Princeton Daw Lab): 25,344 trial-level responses from 1,584 participants across 384 matrix items, plus per-item 3PL parameters and generation features. **This is not an item source and not an anchor bank** (see §2 and §8). Its value is (a) a complete real matrix-reasoning response matrix against which to build, break and benchmark the entire IRT/scoring/CAT pipeline before we collect a single response, and (b) one clean, non-circular empirical finding: **minimal-difference distractors are 0.133 in p-units harder than paired-difference distractors (0.525 vs 0.658, SE 0.018, t = 7.3), with the 192/192 item sets exactly balanced on rule count and element count.** That is a larger effect than moving from three rules to five. Distractor strategy must be a first-class, logged generation parameter and a term in our difficulty model.
- **ICAR matrix-reasoning response data** (CC0 deposit; items academic-use-only): a published external convergent-validity criterion and a reference score distribution.

**What this buys.** Weakly informative priors on the *slopes* of our difficulty model, a de-risked engineering pipeline, and a named convergent criterion.

**What it does not buy.** No published study fits a difficulty model on one matrix bank and validates it on another. The radicals are not commensurable across banks — a "rule" in MaRs-IB, in OMIB (construction response, no distractors at all) and in the Sandia taxonomy are three different things — and **the intercept does not transfer at all**, because it absorbs the source population's ability distribution, option count and timing. Port slopes as priors with inflated variance, re-estimate the intercept from our own first wave, and measure our own transfer loss empirically rather than asserting a number.

One silent trap, already sprung once in the source research: in `stats.csv` the MaRs-IB `beta` is a **discrimination-scaled intercept**. The Stan model is `gamma + (1-gamma)·inv_logit(alpha·theta − beta)`. Item location on theta is `beta/alpha`, not `beta`. Anyone reusing that file without the division will mis-target the entire bank invisibly.

### Layer 3 — A small human sample, designed properly

**Everyone sees the full core form.** No sparse matrix-sampling design at small N. The temptation is to reason "MaRs-IB got usable difficulties from ~62 responses per clone, so 400 people × 20 items covers an 80-item bank". That is a non sequitur: MaRs-IB's ~62 responses per item sat inside a design with 1,584 persons and 25,344 responses. Item-parameter precision in a marginal or hierarchical model depends on how well the person distribution is pinned down and how strongly the blocks link, not only on responses per item. Spreading 400 people thinly over 80 items produces fragile linkage and no defence.

The design instead is **a common core everybody takes, plus one rotated extension block** — near-complete linkage, not sparse sampling. Details at §4.

**What this buys.** Item difficulties on the core precise to roughly **±0.10 to ±0.15 logits** at N = 400 (Wright & Stone's derivation gives modelled item standard errors between 2/√N and 3/√N, the lower end when p is 40–60%, the upper when more extreme than 15/85%), internal-consistency reliability with a defensible confidence interval, a fitted rule model, and a provisional reference distribution.

**What it does not buy.** Norms for more than one group. DIF evidence for ethnicity or disability. Any criterion-validity claim. And note the SE that actually matters for scoring is the SE of the *difference* between two item difficulties, which is about √2 larger again.

### Layer 4 — Bayesian / LLTM calibration

Rasch/1PL by conditional maximum likelihood as the **pre-registered primary model**, with penalised JML and MML as cross-checks and agreement reported; an explanatory LLTM-**R** (with a random item residual) fitted alongside as construct-representation evidence and as the prior generator for un-piloted items; a hierarchical Bayesian 2PL as a documented sensitivity analysis only. Full analysis plan at §3.

**What this buys.** The cleanest small-sample story available. CML separates item parameters from the person distribution, so we make no assumption about the shape of a paid panel's ability distribution — which is our single biggest untested assumption. Estimator choice demonstrably matters at these sample sizes, and pre-registering it converts "we ran four estimators and they agreed" from a forking-paths problem into a robustness argument.

**What it does not buy.** Discrimination parameters. **Do not run an unconstrained 2PL by MML below N = 500.** At small N, `mirt` returns inadmissible solutions at rates between 10% and 99%, and among apparently converged solutions at N < 100 between 11% and 25% carry negative discriminations. The hierarchical Bayesian alternative (König, Spoden & Frey, 2020: non-centred parameterisation, LKJ prior on the Cholesky factor, half-Cauchy hyperpriors) is real and peer-reviewed and does recover parameters at N = 100 — but it is *parametric recovery in simulation*, with data generated from the fitted model, and its accuracy is conditional on the true discrimination heterogeneity being modest (τ_α ≤ 0.4). An AIG bank with clone families is a plausible candidate for *larger* slope heterogeneity, not smaller. It is a sensitivity check, not the headline model.

Nor does LLTM buy people. Its economy is in items. Published LLTM simulations report rule-parameter RMSE around 0.57 logits, which is worse than the item precision we are targeting, and the LLTM-versus-Rasch likelihood-ratio test is almost always significant — in the best-documented figural analogy study the plain Rasch model fitted **significantly better** than the LLTM (p < 0.001) at N = 307. There is also a specific trap: Q-matrix misspecification biases rule parameters while leaving the Rasch–LLTM difficulty correlation — the statistic we would naturally report — unaffected. We cannot detect Q-matrix error from the number we would headline.

The most sobering single fact in the whole evidence base: in the same authors' two samples of their own generated items, one rule family (trapezium rotations) moved from among the most difficult (1.27–1.61 logits) to non-significant or reversed (0.36, −0.26, 0.11), and they could not explain why. That is why the rule model is a prior and a validity argument, never a calibration method.

### Layer 5 — Sequential refinement in production

Every live administration is structured as **anchor block (parameters fixed) + operational block + 2–4 seeded items**, seeded in middle or late positions, estimated by Bayesian multiple-EM-cycle methods, with the reporting scale frozen at the panel calibration and drift monitored against the anchors rather than silently re-scaled.

**What this buys.** Continuous bank growth at zero incremental recruitment cost, plus — eventually — the applicant-population DIF and criterion evidence that a panel cannot produce.

**What it does not buy.** Speed. Under sparse seeding the ratio of calibration sample to valid cases per item is roughly 10–12:1, so keep the seeded pool small. And the seeded population is range-restricted and differently motivated from the panel, which is precisely why the anchor block exists and why the scale must be frozen.

### Where this lands

| Claim | Honest minimum | Why |
|---|---|---|
| Raw score with internal-consistency reliability | 150 | At α = .85, N = 150, the Feldt 95% CI is [0.813, 0.883] — the lower bound already clears 0.80. Reliability is a test-length problem, not a sample-size problem. |
| Rasch-scaled score, provisional difficulties | 300–400 | 300 is the floor once 10–20% exclusions and Linacre's own 10–40% inflation for unmodelled disturbance are taken. |
| Norms (one named occupational group) | 300–400 per group | EFPA v2025, high-stakes: 200–299 adequate, 300–399 good, 400–999 excellent, **per norm group**. |
| DIF by protected characteristic | 300 per focal group | This is the gate, not calibration. |
| Criterion validity | Not obtainable from a panel at any N | Requires job-performance data. See §5 M5. |

**Recommendation: 400 for the internal beta; ~1,200 in total before any hiring use.** Detail and budget at §4.

---

## 2. What AI can and cannot do here

The client asked directly. The evidence is unusually decisive, and mostly negative.

### Cannot: produce calibration data

Two independent reasons, either of which is sufficient.

**Perception.** Frontier multimodal models sit at or near chance on image-presented abstract reasoning. On VRIQ (1,500 expert-authored IQ-style items) average accuracy on abstract puzzles is **around 28%**, and the failure decomposition is the decisive part: **56% of failures are perceptual alone, 43% perceptual and reasoning together, and 1% reasoning alone.** Perceptual failure is driven by stroke weight, element count and resolution — properties largely orthogonal to human relational-reasoning difficulty. A model-derived difficulty ordering for our items would therefore be not merely noisy but *systematically wrong*, and wrong in a way we could only detect by running the human pilot we were trying to avoid.

**Mathematics.** LLM examinees are "too accurate and too uniform". In IRT, item difficulty is identified only relative to the location and scale of the person-ability distribution. Collapse that distribution and *b* is not imprecise — it is on a different, unidentified scale — and *a* is unidentifiable altogether, because discrimination is estimated from the covariance between theta and response. No better model fixes this; it is analytic, not empirical. Note also the reported finding that mathematically *weaker* models predict human item difficulty better than stronger ones. That is diagnostic of post-hoc fitting by model selection, not of a validated method, and an opposing expert would characterise it exactly that way.

### Cannot: estimate discrimination

Across 42 proprietary and open-weight models, the best zero-shot Spearman correlation with human-calibrated discrimination was **0.152** by direct prediction and **0.241** via a synthetic-respondent CTT route. Text-embedding regression converges on the same conclusion from a different direction: difficulty is somewhat predictable, "discrimination and pseudo-guessing parameters are poorly predicted". For a selection instrument, discrimination is what separates a usable item from a dud.

### Cannot: predict difficulty from content to a useful precision

On the largest competitive benchmark for this exact capability (BEA 2024 / NBME, 667 retired USMLE items, 17 submitting teams), **the best system reached RMSE 0.29 against a DummyRegressor baseline of 0.31**, with the top ten systems inside 0.009 of one another. The best-documented optimistic result — R² ≈ 0.53 from text embeddings — is the EEDI mathematics figure, obtained with a very large in-domain calibrated training bank; on the smaller medical bank the same method "explain[ed] almost no variance". A novel 60–80 item figural bank with no training corpus is far closer to the second condition than the first. There is essentially **no published evidence at all** on LLM difficulty prediction for figural matrix items specifically.

**Operational rule: any AI difficulty-prediction claim, internal or vendor, must be benchmarked against a mean-prediction baseline on held-out items before it is believed.** This is a hard gate in the evaluation protocol.

### Cannot: produce fairness evidence

Synthetic respondents have no protected characteristics. Under EU AI Act Annex III this instrument is high-risk employment AI, and Article 10 requires that training, validation and testing data be examined for possible bias — a requirement synthetic respondents cannot satisfy in principle. The one quantified automated item-review model also **fails specifically on bias, sensitivity, fairness and accessibility flags**.

### Cannot: satisfy a reviewer

The EFPA v2025 model scores norm samples against human-N thresholds. "N = 0 humans, 5,000 model completions" does not map onto the form and cannot be scored. No ITC, ATP or AERA/APA/NCME guidance endorses synthetic calibration. The operational precedent usually cited in favour — Duolingo's LLM-generated content since 2022 — calibrates on real test-taker responses with human review in the loop.

### Do not argue from ARC-AGI

Someone will. ARC-AGI is solved as a **symbolic text task over JSON grids** by program synthesis at $2–$30 per task with heavy test-time compute; naively rendering ARC grids as images *degrades* model performance relative to the text baseline. Our items are rendered images of geometric figures with distractors. The transfer is not established. Make the argument from modality, not from scores — 2026 leaderboard figures above ~55% come from aggregators and are not verifiable.

### Can: five legitimate uses

1. **Item generation.** AI-authored items match or beat human-authored ones on SME paired comparison in selection contexts, and match on realised difficulty and discrimination *once piloted on humans*. This is where AI clearly pays, and it pays on the axis that matters — item-pool size is the binding constraint for the difficulty model and for LLTM-R inference (which needs on the order of 80 items to avoid inflated Type I error and reach power .90 for a moderate rule effect).
2. **Pre-pilot triage.** An automated item-evaluation model trained on 52,759 items predicts human accept/reject at **accuracy .75, AUC .80, sensitivity .64, specificity .81**. Sensitivity of .64 means it misses roughly a third of bad items: **it filters, it does not certify.** Killing duds before they consume pilot slots is a real saving that never touches the validity argument. Human bias, sensitivity and accessibility review stays entirely intact — that is the documented failure mode.
3. **Weakly informative Bayesian priors on difficulty.** The one peer-reviewed pipeline (Ulitzsch, Belov, Lüdtke & Robitzsch, *JEM* 63(1) e12426) blends item-difficulty-modelling predictions into informative priors and reports reduced calibration sample requirements — but the authors' own framing is that prediction accuracy alone is currently insufficient, and **we quote no savings figure until someone has read the paper.** Mandatory conditions: prior-sensitivity analysis across diffuse / moderate / tight settings, a pre-registered diffuse-prior fallback, and both prior-informed and diffuse estimates reported side by side. The specific risk in our case is worse than in the paper: if the prior comes from the same rule model that generated the items, it is our own theory re-entered as data. The posterior then confirms the theory, and because the prior tightens the posterior it *shrinks the standard errors that would have warned us the theory was wrong*.
4. **Simulation for form assembly and CAT design.** Wholly legitimate and standard — but it *consumes* calibrated parameters and does not produce them. Do not let anyone conflate the two.
5. **Solution-uniqueness checking.** This is a program, not an LLM, and it is the strongest quality control available. No published generator proves single-solution: SGMT performs no check at all (and pads unfilled option slots with blanks, which is disqualifying); I-RAVEN's Attribute Bisection Tree fixes only the statistical leak; RAVEN-FAIR runs a symbolic scorer and rejects candidates scoring ≥ the key, but assumes the sampled rule set is the only reading of the context. Implement the two-level check nobody else does: **(A) enumerate every rule assignment consistent with the eight context cells in every direction the rendering exposes, and reject the item unless all surviving assignments imply the same missing cell; (B) reject any option that equals that cell or satisfies any surviving assignment; then (C) run a context-blind scorer over the options alone and reject items where per-attribute modal voting recovers the key.** Persist the surviving-assignment set in the item spec. That JSON is the audit artefact for a reviewer. The rule space is small enough to brute-force in milliseconds. This mechanises `03-logical-reasoning-design.md` §5.4 and strengthens it.

### The test-security implication

The same evidence that says AI cannot calibrate figural matrices also says AI currently cannot reliably *solve* them from a screenshot — near-chance on abstract image puzzles, with failures dominated by perception. Relative to text-based reasoning items, where models exceed most humans, that is a genuine and documentable advantage for the figural component right now.

**Plan for it to expire.** On a recent primary-school non-verbal reasoning benchmark the best models already reached 78%. Standing controls, to be written into the technical manual rather than assumed:

- A large auto-generated bank with per-candidate sampling and **family-level** exposure caps (a candidate who has seen one sibling has effectively seen the family).
- Server-side raster rendering, never inline SVG in the DOM. Inline SVG hands an automated solver a symbolic representation and removes the need for vision entirely; a symbolic solver against a declared rule space is essentially 100% accurate in milliseconds. Randomised IDs and minification defeat none of this. Rasterising downgrades an attacker from exact symbolic solving to vision-model solving — it is a real control, but it is not a barrier to a phone camera and must not be sold as one.
- Response-time forensics per `06-battery-and-psychometric-programme.md` §7.3.
- A supervised verification retest for progressing candidates — the only control with an actual evidence base.
- **A standing six-monthly solve-rate check of the unexposed bank subset against current frontier models**, logged, with a defined action threshold.

Do not cite the "about 50% of candidates cheat" figure in any client-facing document. It is assessment-vendor marketing with no visible methodology.

---

## 3. The calibration design

### 3.0 Pre-registration

Before a single response is collected, an analysis plan is written, dated, version-controlled and frozen: primary model and estimator, cross-check estimators, exclusion rules, item-retention criteria, DIF methods and thresholds, the prior specification and its sensitivity grid, and the reporting scale. Everything below is that plan. Running four estimators and reporting agreement is a robustness argument only if the choice was fixed in advance; otherwise it is a forking path, and an opposing expert will say so.

### Stage 0 — Cognitive pre-pilot (n ≈ 25–30)

Think-aloud protocols on every exemplar item and first-wave clones, sampled across education levels and including EAL participants, per `03-logical-reasoning-design.md` §12 Stage 1.

- **Purpose.** Confirm instructions are learned from practice alone; confirm distractors are chosen for the *designed* reasons (verbalised strategy versus declared error label); catch ambiguous renderings and unintended solution paths that the symbolic uniqueness checker cannot see (it checks the declared rule space, not human misreadings).
- **Acceptance.** Every item where two or more participants articulate a defensible alternative answer is revised or retired before Stage 1, regardless of what the uniqueness checker says.
- **No statistics are computed from n = 25 and none are reported.**

### Stage 1 — Calibration wave (N = 400 completions)

**Software.** `eRm` (CML), `TAM` / `sirt` (penalised JML, MML, LLTM-R), `mirt` (fit statistics, MML cross-check), Stan via `cmdstanr` (hierarchical Bayesian sensitivity), `difR` (MH, logistic-regression DIF), `psych` (CTT, Feldt intervals). All analysis code version-controlled, seeded, and re-runnable end-to-end from raw data.

**Primary model.** Rasch / 1PL by **conditional maximum likelihood**, pre-registered. CML is the cleanest model to put in front of a review panel: item parameters are separable from the person distribution, so no assumption is made about the shape of a paid panel's ability distribution.

**Cross-checks, reported in the same table.** Penalised JML (JML-ε), MML. Report the three sets of difficulties, their pairwise correlations and their maximum absolute disagreement in logits. Disagreement above 0.20 logits on any item is a flag, not a finding — investigate before interpreting.

**Sensitivity analyses, reported but not used for scoring at this stage.**
- **Lower asymptote.** Rasch assumes a zero lower asymptote. Multiple-choice figural matrices empirically do not have one: a 3PL/4PL analysis of Raven's CPM (N = 1,127) found guessing evident, and the MaRs-IB calibration fixed *c* = 0.25 for precisely this reason. Our items have five options, so chance is 0.20. Refit with *c* fixed at 0.20 and report both parameter sets and their effect on theta ordering above the cut region. Unmodelled guessing biases the difficulty of hard items downward and distorts fit at exactly the top of the scale where selection decisions sit — this is the single most important misspecification risk in the plan, and it must be stated in the manual rather than discovered by a reviewer.
- **Hierarchical Bayesian 2PL** per the König specification (non-centred, LKJ prior on the Cholesky factor, half-Cauchy hyperpriors on variance components). **Report the estimated τ_α** so a reader can judge whether the shrinkage-bias condition (τ_α ≤ 0.4) holds. Report prior-sensitivity across diffuse / moderate / tight settings. Do not switch scoring to 2PL on the strength of it at N = 400.
- **LLTM-R**, never plain LLTM. Plain LLTM is liberally biased when residual item variance exists; LLTM-R's bias in the opposite case is minor and conservative. Use the likelihood-ratio test for rule effects, **not AIC or BIC** (AIC yields many false positives, BIC many false negatives). Report the residual item SD as a headline number alongside R². Expect R² in the 0.40–0.55 band; expect an underpowered test of moderate rule effects if the bank is below ~80 items, and say so.

**Item acceptance criteria** (applied within the calibration wave; consistent with `06-battery-and-psychometric-programme.md` §4.2):

| Statistic | Retain | Revise and re-pilot | Retire |
|---|---|---|---|
| Classical p-value (5 options, chance .20) | .30 – .85 | .25–.30 or .85–.90 with sound content | < .25 or > .90 |
| Corrected item–total r | ≥ .20 | .15 – .20 | < .15 or negative |
| Rasch infit / outfit MNSQ | 0.7 – 1.3 | 0.6–0.7 or 1.3–1.4 | outside 0.6 – 1.4 |
| Item SE(b) | ≤ 0.20 logits | 0.20 – 0.30 (provisional flag) | > 0.30 (insufficient data, not a bad item) |
| Distractor endorsement | every distractor ≥ 5% within band | 3–5% | < 3%, or a distractor whose choosers outscore key-choosers → **automatic hold, content re-review, suspected miskey or genuine ambiguity** |
| Estimator disagreement (CML vs JML-ε vs MML) | ≤ 0.20 logits | 0.20 – 0.35 | > 0.35 → investigate before any use |
| DIF (sex, age band, device) | ETS A | ETS B — content review, retain with note | ETS C — remove from scoring pending review |
| Yen's Q3 residual correlation with any other item | < .20 | .20 – .30 → do not co-assign to a form | ≥ .30 → treat family as a testlet |
| Rapid-guessing rate on the item | < 5% | 5–10% | > 10% → investigate rendering or position |

**Model-level checks, all reported regardless of outcome.**
- Andersen likelihood-ratio test of Rasch fit against high/low score split and against sex; Wald tests per item. **State plainly that fit tests have low power at N = 400** — "we tested fit and it passed" is weak evidence at this N, and a bootstrap is required for the Rasch LR/Wald statistics to approximate their limiting distribution below N ≈ 500.
- **Local dependence.** Clone families sharing a template are a textbook local-dependence risk, and the consequence is specific: dependency inflates reliability and gives a false impression of precision. Compute Yen's Q3 across the whole matrix, report the maximum and the distribution, and report a **testlet-adjusted reliability alongside raw alpha**. Expect the adjusted figure to be lower. If forms will draw more than one clone per family, model families as testlets; the default is one clone per family per form.
- **Within-family difficulty variance.** Report the estimated within-family SD explicitly. The published benchmarks to beat are MaRs-IB's 0.620 logit clone-level residual SD and 0.705 logit mean absolute clone difference. If ours are comparable, we must either score at family level with an inflated SEM, use fixed forms, or prune the offending clones. "It cancels on average across applicants" is a population-level statement and is not a defence available to an individual claimant — the unit of harm in hiring is the individual, and the random draw is controlled by the employer.
- **Dimensionality.** Confirm the LR-M / LR-D structure with a correlated-factors model; revisit the 70/30 composite weighting against the solution rather than asserting it.
- **Speededness audit** per `03-logical-reasoning-design.md` §10: ≥ 90% reaching the final item with a genuine attempt, item difficulty uncorrelated with serial position after content balancing, not-reached rate on the last three items < 10%. If it fails, raise the limit and re-pilot; do not cut items.

**Exclusion rules, fixed in advance.** Rapid-guessing threshold (< 3 s on matrices, < 4 s on deductive) applied at the response level for analytics; a participant excluded if more than 20% of their responses are sub-threshold, or they fail the instructed-response check, or they complete the whole section in under a pre-specified floor. Budget 10–20% exclusion and recruit accordingly.

### Stage 2 — Fairness and norming wave (further N ≈ 800)

Analysis plan at §7. The point of separating it is that it is recruited to *quotas*, not to volume, and it is the wave that gates hiring use.

### Stage 3 — Production sequential refinement

- Anchor block with parameters fixed; operational block; 2–4 seeded items per sitting, seeded mid or late (seeding position affects calibration accuracy), estimated by Bayesian multiple-EM-cycle methods.
- Accrual target for a seeded item before promotion: **≥ 250 valid cases** for stable Rasch recovery across the scale; do not promote below that. Under sparse seeding at 10–15% of test length the ratio of sittings to valid-cases-per-item is roughly 10–12:1, so keep the seeded pool small and prioritise deliberately.
- **The reporting scale is frozen at the Stage 1/2 calibration.** Drift is monitored against the anchor block using robust z on b-shift; drifting anchors are dropped from the link, never bent to fit. No silent re-scaling, ever.
- Applicant-population re-calibration is a scheduled deliverable, not an aspiration: the panel is unproctored and low-stakes, applicants are range-restricted and differently motivated, and both difficulty and discrimination will shift. This is an untested linking assumption sitting under the scale, and it must be named in the manual and then discharged.

---

## 4. Sample plan

### Design

**Wave 1 — calibration, N = 400 completions (recruit 480).**

| Block | Items | Who sees it | Responses per item |
|---|---|---|---|
| LR-M core | 30 matrix items | everyone | 400 |
| LR-M extension | 3 rotated blocks × 15 items = 45 items | one block each | ~133 |
| LR-D core | 16 deductive items | everyone | 400 |
| LR-D extension | 2 rotated blocks × 8 items = 16 items | one block each | ~200 |

Total bank calibrated in Wave 1: **75 matrix + 32 deductive items**. The 30-item common core links the rotated blocks at 100% overlap — far above the 28–36% anchor share that short-form Rasch linking research recommends under likely model misfit — so this is a common-core design, not a sparse one. Block assignment is spiralled (round-robin within recruitment stream) so block samples are randomly equivalent.

Expected precision: core items **SE(b) ≈ 0.10–0.15 logits** (2/√400 to 3/√400), extension items **≈ 0.17–0.26 logits**, both worse at the extremes of the difficulty range. Poorly targeted items need roughly 2.2× the N for the same SE, so cap the difficulty range of the *core* form and put the deliberately extreme items in the rotated blocks where the estimate is honestly labelled provisional.

Session length ≈ 55 minutes including instructions, practice and a short demographic and effort questionnaire. That is longer than the 38-minute operational form; panellists are paid for it, and it is the cheapest way to calibrate 107 items with everyone on a common core.

**Wave 2 — fairness and norming, N ≈ 800, quota-recruited.** Operational-length form (18 matrix + 10 deductive) drawn from Wave 1's calibrated items, plus 2 seeded items. Quotas at §7.

### Where the people come from

**Prolific or an equivalent UK-representative panel**, not MTurk, and not a convenience sample of the client's network.

- **Match the mode.** The operational instrument is unproctored, remote, mobile-permitted. The panel must be too. Mode and condition mismatch for a timed ability test is a named norms defect.
- **Cannot match the stakes**, and should not pretend to. Mitigate with an explicit performance-contingent bonus (e.g. top-quartile bonus, stated up front), record the incentive structure in the manual as a test condition, and treat applicant re-calibration as mandatory rather than optional.
- **Recruit for spread, not convenience.** Targeting is worth more than raw N in Rasch. Deliberately over-sample education and occupational extremes rather than accepting the modal graduate-in-their-twenties panellist.
- Log **device class, viewport and DPR with every response** — device DIF is a Trajectas-specific fairness obligation given mobile administration, and the evidence on form-factor effects on cognitive scores is mixed rather than reassuring.

### Cost

Assumptions stated so they can be argued with: Prolific's recommended rate £9/hour; 33% platform service fee; 20% VAT on the fee; 20% over-recruitment for exclusions and attrition; demographic screening surcharge on the quota wave.

| Wave | Session | Recruited | Per completion | Total |
|---|---|---|---|---|
| Stage 0 pre-pilot (n = 25, 60 min think-aloud, incentive + researcher time) | 60 min | 25 | ~£35 all-in | **~£900** |
| Wave 1 calibration (target 400) | 55 min | 480 | £8.25 + fees ≈ **£11.50** | **~£5,500** |
| Wave 2 fairness and norming (target 800, quota) | 35 min | 960 | £5.25 + fees ≈ **£7.50**, plus screening surcharge on low-incidence quotas | **~£8,500–11,000** |
| **Total human data before hiring use** | | **≈ 1,200 completions** | | **≈ £15,000–17,500** |

Add analyst time — realistically 15–25 days across pre-registration, analysis, DIF, norming and the technical manual — and a modest contingency for a Wave 1b re-pilot of revised items. **Call the whole programme £25,000–35,000 including analysis.** For an instrument intended to inform hiring decisions in the UK and EU, that is not an unreasonable number, and it is the number to put in front of the client instead of debating 250.

### Sequencing

1. Freeze the item spec schema, generator version and rendering pipeline. Build the uniqueness checker (§2.5) and the distractor-type screen. Content and sensitivity review of 100% of items.
2. Build and validate the entire IRT / scoring / form-assembly pipeline against the MIT-licensed MaRs-IB response matrix. This is weeks of engineering de-risked before recruitment opens.
3. AI pre-pilot triage over the generated pool. Human bias/fairness review of everything that survives.
4. Stage 0 cognitive pre-pilot. Revise. Re-run the uniqueness checker on every revision.
5. **Pre-register the analysis plan.** Date it, version it, do not touch it afterwards.
6. Wave 1. Analyse. Assemble operational forms. → **Milestone M2, internal beta.**
7. Wave 2, quota-recruited. Norming and DIF. → **M3 / M4.**
8. Soft launch as decision *support* with the M3/M4 claim set enforced in product, seeding live from day one.
9. Criterion studies as client data accrues. → **M5.**

### Seeded versus standalone

**Standalone panel for Waves 1 and 2; seeding thereafter.** Seeding cannot bootstrap a bank from zero at acceptable speed — the 10–12:1 accrual ratio means a bank of 75 items seeded four at a time needs volume we will not have at launch, and every candidate who sits an uncalibrated instrument during that period is being measured on an instrument we cannot describe. The standalone panel front-loads the cost and buys a defensible starting position; seeding then maintains it forever at nearly zero marginal cost.

---

## 5. The claims ladder

This is the governance artefact. **The rule is: no marketing claim may exceed the technical manual, and the manual may not exceed the data.** Enforced in product, not by convention — the score-release path checks the milestone flag on the instrument version.

| Milestone | Data required | What may be said | What may **not** be said |
|---|---|---|---|
| **M0 — Design** *(current state)* | Blueprint, content review, sensitivity review, uniqueness verification per item | "A figural matrix reasoning instrument designed to measure inductive reasoning (CHC Gf, narrow ability I), specified against a documented rule taxonomy." Describe the design. Describe the intended construct. | Anything with a number attached. No difficulty, no reliability, no comparison to any other test, no "validated", no "research-backed", no "psychometrically designed" if that phrase will be heard as "psychometrically evidenced". |
| **M1 — Cognitively pre-piloted** | n ≈ 25 think-aloud; documented revisions | "Items were reviewed with participants using think-aloud protocols; the response processes observed were consistent with the intended reasoning demands, and items where they were not have been revised or removed." | Any statistic. n = 25 produces no numbers. |
| **M2 — Internally calibrated (beta)** | Wave 1, N = 400 full core form; pre-registered CML analysis; fit, LD, LLTM-R, guessing sensitivity all reported | "Provisional item difficulties with standard errors, estimated on a paid UK panel of N = 400 under unproctored conditions." "Internal consistency α = x, Feldt 95% CI [a, b]." "Rule-based difficulty model R² = x, residual item SD = y logits." "A provisional reference distribution derived from [named sample, N, dates, conditions]." Use for research, product development, and side-by-side comparison against human judgement **with candidate disclosure and no candidate rejected on the score**. | Norms. Percentiles. Any validity claim. Any fairness claim. Any use where a score can exclude a candidate. The word "validated" in any form. |
| **M3 — Normed (one occupational group)** | Wave 2; ≥ 300 in a **named occupational norm group**, defined by population, recruitment window, first-attempt-only rule, demographic composition, administration conditions and dates | "Scaled scores and percentiles referenced to the [named] norm group, N = x, collected [dates], under [conditions]." Conditional SEM on every reported score. | "General population norms" — we will not have them and EFPA explicitly distinguishes them. Percentiles against any group other than the one named. Any claim for a second occupational group without its own N. |
| **M4 — Fairness-evidenced (for the groups covered)** | ≥ 300 per focal group for each characteristic analysed; MH + logistic-regression DIF with ETS classification; adverse-impact ratios at recommended cut scores; documented job analysis | "Differential item functioning was analysed by sex, age band and device class; results and item actions are reported in §x." "Impact ratios at the recommended cut are y." | Any fairness statement about a characteristic not analysed. The technical manual must contain an explicit statement of which characteristics have **no** DIF evidence and why. |
| **M5 — Criterion-supported** | Either a local study n ≥ 150 with range-restriction and criterion-reliability corrections reported alongside uncorrected coefficients, **or** documented validity generalisation plus a role-specific job analysis | "In [client, role family, n], scores correlated r = x (uncorrected) / y (corrected) with [criterion]." Or: "Job-relatedness rests on a documented job analysis linking abstract reasoning to [role], together with the meta-analytic GMA evidence cited in §x." | "Predicts job performance" without naming the study, the population and the coefficient. Corrected coefficients presented alone. Transporting a claim from one role family to another without a job analysis. |
| **M6 — Review-ready** | Everything above plus a manual structured to EFPA Test Review Model v2025, an EU AI Act Annex III technical file, and an independent review | "Submitted for EFPA/BPS review." | "EFPA reviewed", "BPS approved" or equivalent, until it is. |

**Phrases banned in every document, at every milestone:**
"AI-validated" · "difficulty is known by design" · "clones inherit the parent's parameters" · "the Rasch literature sets 250 as the high-stakes threshold" (the source is an AERA special-interest-group newsletter, and it says ±0.5 logits at 99% confidence, not ±0.25) · "EFPA rates 150–300 as adequate for norms" (that is the superseded v4.2.6 operationalisation; **v2025 sets high-stakes norms at 200–299 adequate / 300–399 good / 400–999 excellent, per norm group**) · any use of "validated" before M5.

---

## 6. Reliability and precision reporting

### Compute and report all of these, always

1. **Cronbach's α with the Feldt exact 95% confidence interval.** Never the bare point estimate. This costs nothing, EFPA rewards it, and at our N the interval is already narrow: for a 25-item test at α = .85, N = 150 gives [0.813, 0.883] and N = 300 gives [0.824, 0.873]. **Reliability is a test-length problem, not a sample-size problem** — the intervals barely move between N = 150 and N = 500. Stop treating N as the reliability lever.
2. **Testlet-adjusted reliability alongside raw α**, given clone families (§3, local dependence). Expect it to be lower. Report the lower one as the headline.
3. **Marginal IRT reliability** from the test information function. For a well-targeted Rasch form with theta ~ N(0,1): k = 20 → ≈ .80; k = 25 → ≈ .84; k = 30 → ≈ .87; k = 40 → ≈ .90. **The only lever that moves this is test length.** The current 18-item operational LR-M form sits below .80 on this curve and will need either lengthening or the IRT-scoring gain to reach the .85 target in `06-battery-and-psychometric-programme.md` §2.1 — this must be settled on Wave 1 data, not assumed.
4. **Conditional SEM as a function of theta**, plotted, with the decision region marked. Report the value *at the cut*, not just the average.
5. **Person SEM in logits and in reported-score units.** This is the number that has been missing from the programme so far and it is the number a tribunal will care about. A well-targeted 20–25 item figural matrix form has a person SEM of roughly **0.40–0.55 logits even with perfectly known item parameters**; 40 items brings it to about 0.35. On a T-score scale (SD 10), 0.50 logits ≈ **5 T-points**, so a 95% interval spans about ±10 T-points — close to two of the bands in `06-battery-and-psychometric-programme.md` §4.6. That is what determines whether two adjacent candidates are distinguishable, and it dwarfs any improvement in item-parameter precision that cleverer estimation could buy. **Publish it, set banding from it, and never rank-order candidates within a band.**
6. **Item standard errors on every published difficulty**, and the SE of item-difficulty *differences* where forms are compared (≈ √2 larger).
7. **Test–retest and alternate-form reliability** at M3+ — we cannot sell interchangeable generated forms without demonstrating they are interchangeable.

### How to be honest at small N

- Report intervals, never point estimates, for every parameter and every reliability coefficient.
- Report the estimator disagreement table (§3) as evidence of robustness — but only because it was pre-registered.
- State the power of every fit test performed. "Rasch fit was tested and not rejected at N = 400" is a weak statement and should be written as one, with the bootstrap caveat attached.
- Where an item's SE exceeds 0.30 logits, label the item **provisional** in the bank and in the manual, and exclude it from cut-score-adjacent form positions until accrual improves.
- Distinguish, in every table, between *this parameter is imprecise* and *this item is bad*. They are different findings with different remedies.

---

## 7. Fairness

### The honest position

A figural matrix test is a general mental ability measure, and GMA carries the largest documented subgroup differences of any selection method. The 2024 UK meta-analysis of 21st-century high-stakes data (23 tests, over two million observations) reports grand meta-analytic effect sizes relative to White GMA of **Black d = .65, Other d = .49, Asian d = .33, Mixed d = .14**. A d of .65 produces an impact ratio below four-fifths at almost any cut score.

**Adverse impact is not a risk for this instrument. It is a near-certainty by construction.** The employer's exposure under the Equality Act 2010 is indirect discrimination, and the defence is objective justification — documented job-relatedness, a documented search for less discriminatory alternatives, and documented fairness analysis. *Government Legal Service v Brookes* is the case to hold in mind: the test served a legitimate aim, and the absence of an alternative is what lost it.

This, not item-parameter precision, is what sets the sample size for a commercially sold hiring instrument.

### What is possible at N = 400 (Wave 1)

| Analysis | Feasible at N = 400? | Notes |
|---|---|---|
| Sex DIF (MH + logistic regression) | **Yes**, with 50/50 quota → ~200 per group | 200 is the bare minimum; interpret with caution and treat as screening, not promotion-grade |
| Age-band DIF (< 40 / ≥ 40) | **Yes**, with quota → ~200 per group | Same caveat |
| Device-class DIF (phone / desktop) | **Yes**, with quota | Trajectas-specific obligation given mobile administration |
| Ethnicity DIF | **No.** | An unquota'd N = 400 UK panel yields focal groups of roughly 20–60. That supports nothing. |
| Disability / EAL DIF | **No.** | Same reason |
| Rasch invariance tests (Andersen LR, Wald) | **Marginally, with bootstrap** | The limiting chi-square approximation stabilises around N ≥ 500 with 10 items; below that, bootstrap with a large replication count |

### What Wave 2 must therefore do

Recruit **to quota, not to volume**: ≥ 300 per focal group for every characteristic on which we intend to make a fairness statement. In practice for a UK launch that means sex, a two-level age split, device class, and **at least one ethnicity focal group at n ≥ 300**, with a stated plan and date for the others. That is what drives Wave 2 to ~800 and the programme total to ~1,200.

Methods, run in tandem, per `06-battery-and-psychometric-programme.md` §6.1: Mantel–Haenszel with thin-strata total-score matching and two-stage purification, ETS A/B/C classification; logistic-regression DIF for non-uniform DIF that MH cannot see, flagged on LRT p < .01 **and** ΔR² ≥ .035; IRT-based DIF as convergent evidence once parameters are stable. Flagged items go to **blind content review** — reviewers see the item, not the direction of the statistic. Inspect the *radical profile* of flagged items so DIF causes are removed from the generation scheme, not just from individual items.

Report adverse-impact ratios at the recommended cut scores, at M4, in the manual, whatever they show.

### What to do when N is too small — stated plainly

We will reach M2 with **no DIF evidence for ethnicity, disability or EAL status.** There is no methodological trick that fixes this. What we do instead:

1. **Say so, in the manual, in those words.** The sentence is: *"The calibration sample supports item-difficulty estimation, internal-consistency reliability and provisional reference statistics. It does not support differential item functioning analysis by ethnicity, disability or first-language status. No fairness claim is made for those characteristics."* An honest gap is survivable; a concealed one is not.
2. **Gate the product on it.** Instruments at M2 cannot be configured for a decisional use path. Enforce in code.
3. **Attack the construct-irrelevant portion of the gap relentlessly**, because that portion is measurement error we own — reading level, speededness, cultural content, colour, device constraints, rendering quality, accessibility. Every control in `03-logical-reasoning-design.md` §7 is fairness engineering and is free of validity cost.
4. **Substitute qualitative fairness evidence where quantitative evidence is impossible.** A documented sensitivity-review panel with diverse membership, per-item sign-off, and a recorded rationale is not DIF analysis and must never be described as such — but it is real evidence, it is what the EFPA model asks for under "fairness and diversity" at the lower rating levels, and it is available now.
5. **Report subgroup descriptives with confidence intervals where n ≥ 50, explicitly labelled as descriptive and underpowered**, and never as invariance evidence.
6. **Prioritise seeding into sittings with richer demographic mix** and hold items in a "DIF-pending" sub-state, per the existing lifecycle model.
7. **Address coachability as a fairness issue, because that is how it will be argued.** A short training intervention on the two difficult logical rules (intersection, single-element addition) moves performance substantially — the published effect is Cliff's d ≈ −0.39, which is an *ordinal dominance* statistic and must never be reported as if it were Cohen's d. The defensible framing is not "coaching changes scores" but **differential access to coaching correlating with socio-economic status and protected characteristics**. The mitigations follow directly: broad rule coverage, the difficult rules not concentrated at the hard end of the bank, a large generated bank with per-candidate sampling, documented exposure caps, and free practice materials offered to every candidate. Do not repeat the claim that learning the rules leaves construct validity unimpaired; it is contested and it is not ours to assert.
8. **Reasonable adjustments.** The existing position on screen-reader inaccessibility (`03-logical-reasoning-design.md` §7.4) is correct and should be kept verbatim: declare the limitation, provide a documented alternative route, never auto-reject on an unattempted component under a declared adjustment. "The standard permits it" is a weaker answer to a tribunal than "the standard permits it and here is our adjustment process."

---

## 8. What would have to be true for EFPA / BPS review — and what to record now

### The bars, from the current model

Use **EFPA Test Review Model v2025 (v5, August 2025)**, not the superseded v4.2.6 operationalisation. For **high-stakes use**, the norm-sample thresholds are **200–299 adequate, 300–399 good, 400–999 excellent — per norm group**. Norm recency: under 10 years excellent, 10–14 good, 15–19 adequate, 20+ inadequate. The gating rule matters more than the thresholds: an instrument rated 0 or 1 on any attribute regarded as critical to safe use falls below the minimum standard, and validity, reliability and norms are all treated as critical by default.

The consequence for us is not that 400 is too few for norms — it clears "excellent" for one group. It is that **the attribute we will score lowest on is validity**, followed by fairness. Plan accordingly.

Two structural concessions in the model are worth using deliberately:

- **Occupation-specific norm groups may be adequate at smaller N than representative general-population norms.** Claim occupational norms. They are cheaper, they are more useful to the client, and they are what the data supports.
- **Continuous norming** across an age or occupation grid buys roughly a threefold reduction in per-cell N (about 70 per group continuous ≈ 200 per group classical). Use it, and document the method.

### What would have to be true

1. A technical manual mapped section by section to EFPA v2025, containing every figure — including the ones that came out worse than designed.
2. At least one norm group at N ≥ 300, fully specified: population, sampling procedure, participation rate, weighting, collection dates, administration conditions, demographic composition, first-attempt-only rule.
3. Reliability: internal consistency with intervals, testlet-adjusted; conditional SEM across the decision region; test–retest; alternate-form equivalence across generated forms.
4. Validity: content evidence (blueprint, SME review, coverage matrix); response-process evidence (the Stage 0 think-aloud work, plus rapid-guessing and latency analytics); internal-structure evidence (dimensionality, LLTM-R as construct representation); and criterion evidence, either local or by documented validity generalisation with a job analysis.
5. Fairness: DIF by every characteristic claimed, adverse-impact ratios, differential-prediction analysis in every criterion study, and an explicit statement of coverage gaps.
6. Administration, scoring, security, accommodation and user-qualification procedures.
7. An EU AI Act Annex III technical file: Article 10 data governance (calibration and norm sample provenance and representativeness, examined for bias — note that synthetic data cannot satisfy this in principle), Article 11 / Annex IV technical documentation, Article 14 human oversight (the product never auto-rejects), Article 15 accuracy and robustness, plus per-sitting logging.

### What to record now, so the door stays open

Cheap now, impossible to reconstruct later:

- **The pre-registered analysis plan**, dated and version-controlled, before Wave 1 opens.
- **Fully resolved item specs as JSON** — every cell's primitives with explicit coordinates, the rule assignment, the option set with per-option error-type labels and the key index, and **the surviving consistent-rule-assignment set from the uniqueness checker** — versioned with a `generatorVersion` and `specSchemaVersion`. Seed plus parameters is *not* a sufficient reproducibility contract, because any generator change silently changes what a seed means. Treat a generator change as producing a **new item requiring recalibration**, never as a silent regeneration.
- **Golden-file tests in CI**: a fixed set of seeds whose serialised specs and rendered image hashes are asserted, so an accidental change to draw order or geometry fails the build.
- **Every administration condition**, per sitting: device class, viewport, DPR, browser, timing configuration, whether the incentive bonus applied, whether accommodations applied, proctored or not, stakes.
- **Demographics collected voluntarily, stored separately from scores**, with per-jurisdiction consent language and an explicit fairness-analytics purpose — collected from Wave 1 onward even where we cannot yet analyse them, because retrofitting demographics onto a completed sample is impossible.
- **Licence provenance, in writing, before anything commercial depends on it.** This is a live gap. The `ndawlab/mars-irt` repository is MIT-licensed but the MIT text grants rights "in the Software", and whether that word reaches a CSV of human responses is a drafting question, not a settled one — and in the UK/EU the relevant right over a response database is the sui generis database right, which an MIT grant does not obviously waive. Obtain a one-line confirmation from the Daw Lab and file it. Separately: **do not use MaRs-IB items or the OSF-hosted materials at osf.io/g96f4** — the non-commercial restriction covers "any of the materials", statistics included — and **do not anchor our scale to MaRs-IB parameters**, both because of the licence and because their median posterior SD is 0.391 logits, which would propagate straight into our theta scale. **Rule out OMIB in writing**: the paper claims GPLv3 while the OSF metadata says "No License", and both readings fail — copyleft would force source disclosure and destroy item security, no-licence means all rights reserved. **Rule out the Sandia norming file in writing**: each item was seen by four people, the values take only five distinct levels, the repository has no LICENSE at any path, and the answer key contains a duplicated item with conflicting keys plus one unkeyed stimulus. Being seen to have surveyed and rejected weak sources is itself credibility — provided the rejection record is accurate.
- **The AI-use statement**, maintained from day one: exactly what AI did and did not do in the instrument's construction. The defensible sentence, and the one to write into the manual now, is:

> *Every item in this instrument was administered to human respondents. No item parameter reported in this manual was derived from, or informed by, simulated or model-predicted response data. AI was used for item authoring and for pre-pilot quality triage only; both uses are documented in §x, and every AI-authored item was reviewed by a qualified human for content, bias, sensitivity and accessibility before piloting.*

- **A job-analysis template**, operational before the first client configuration. In an objective-justification defence the job analysis does the legal work, and it is cheap relative to everything else in this programme.

---

## 9. Proposed amendments to existing specs

Flagged rather than made, because both are decisions for the design owner.

1. **`03-logical-reasoning-design.md` §11 and `06-battery-and-psychometric-programme.md` §4.3 — IRT model at launch.** Both currently name 2PL as the target with Rasch as fallback. At the N this plan can deliver, that ordering should be reversed: **Rasch/1PL by CML as the pre-registered primary, with a fixed lower asymptote sensitivity analysis and a hierarchical Bayesian 2PL as a documented sensitivity check; upgrade to 2PL when operational accrual passes 500 responses per item.** Rasch is nested in 2PL, so the bank survives the upgrade. The honest caveat that must accompany this, and which the existing docs do not yet state: Rasch assumes a zero lower asymptote and multiple-choice figural matrices empirically do not have one, so we are choosing a knowingly imperfect model on affordability grounds and must demonstrate fit rather than assume it — with an acknowledgement that fit tests have low power at N = 400.

2. **`03-logical-reasoning-design.md` §12 Stage 2 — calibration design.** The current text specifies "linked, counterbalanced booklets" over ~120 matrix items at n ≥ 500 per component. At the achievable N, replace with the **common-core-plus-rotated-block design at §4**: 30 core items seen by everyone, 45 extension items in three rotated blocks, 400 completions. Reserve sparse designs for post-launch seeding only.

3. **`03-logical-reasoning-design.md` §4.4 — difficulty-model expectations.** The design priors are stated without an expected fit. Set the expectation now at **R² ≈ 0.43–0.50 with a residual SD around 0.7–0.8 logits**, from the two large open item samples, and treat the existing §12 threshold of "R² ≥ 0.6 validates the difficulty model" as **unreachable and therefore the wrong gate** — no published figural-matrix study reaches it at clone level. Replace it with a residual-SD reporting requirement.

4. **Add distractor strategy to the radical table (§4.1) and to the difficulty model (§4.4).** It is worth more than two extra rules in the only balanced experimental contrast available, and it is currently treated as a response-stage modifier rather than a first-order radical.

5. **Add a perceptual-organisation / element-salience radical.** Three independent literatures place it at or above information load, and the MaRs-IB authors concede its omission as a limitation. It is the largest known omitted variable in the difficulty prior. The existing spec caps perceptual organisation at "neutral" to avoid measuring Gv, which is right — but "capped" still needs to be a logged, modelled parameter rather than an implicit constraint.

6. **Reconsider five options.** With four or five options the generator is forced to leave one construct-irrelevant solution path open — either pop-out effects or answer-options-only solvability. Six or eight options closes both, and reduces the guessing floor from .20 to .17 or .125, which materially reduces the Rasch misspecification at the hard end. The cost is screen real estate on a 360 px viewport and distractor-authoring burden. Worth a decision rather than an inheritance.

---

## 10. The one-paragraph answer to the client

No, AI cannot reduce the number of people, and the evidence on that is stronger than the evidence for most things in this document: frontier models sit near chance on abstract visual puzzles with over half their failures purely perceptual, they cannot estimate item discrimination at all, they cannot produce fairness evidence in principle, and no professional standard recognises synthetic calibration data. Existing open data reduces engineering risk and sharpens the difficulty model, but every open matrix bank is either non-commercially licensed, licence-ambiguous, or too thin to anchor anything. What genuinely reduces cost is a bigger item bank built by a rule-based generator (AI pays here, and pays well), pre-pilot triage that stops duds consuming pilot slots, choosing Rasch over 2PL where fit permits, a design where everyone sees the same core form, and claiming occupation-specific rather than general-population norms. Under those levers the number is **about 400 completions for a defensible internal instrument and about 1,200 before the score may influence a hiring decision — roughly £25,000–35,000 all in.** And the binding constraint is not item difficulty, which 400 people settle comfortably. It is fairness evidence: a figural reasoning test is a general mental ability test, general mental ability carries the largest subgroup differences of any selection method, adverse impact is near-certain by construction, and a tribunal will attack job-relatedness and impact ratios long before it attacks our item parameter standard errors.
