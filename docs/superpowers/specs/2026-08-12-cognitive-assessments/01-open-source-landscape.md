# Cognitive Assessments — Open-Source Landscape & Licensing

**Date:** 2026-08-12 · **Status:** Research (no implementation yet)
**Part of:** [Cognitive assessments research pack](./README.md)

Every open-source / openly-licensed item bank, generator, platform, and library relevant to
building commercial cognitive assessments, with licences pinned to primary sources. Web
research performed 2026-08-11/12; licence claims for anything marked **verified** were
adversarially re-checked against the project's own LICENSE file, terms page, or publisher
statement.

**How to read the commercial-use column.** "Yes" = permitted for a for-profit hiring SaaS
(conditions like attribution noted). "Conditional" = permitted but with copyleft or other
obligations to manage. "No" = research/non-commercial only — do not ship. A recurring trap in
this space: *the paper is CC-BY open access but the items are licensed separately* (usually
NC), and *repo code is permissive but the dataset carries its own restriction*. Never rely on
secondary descriptions of a licence.

---

## A. Item banks and ready-made tests

### Verdict table

| Resource | What | Licence (verified) | Commercial | Use for |
|---|---|---|---|---|
| **Sandia Matrices + SGMT** | Raven-like matrix generator (Java) + normed item set (Matzen et al. 2010) | BSD 3-Clause ✅ verified (License.txt inside source zip + DOE CODE 54699) | **Yes** (generator + output). Caveat: the pre-rendered Matzen norming-stimuli zip has no licence file of its own — confirm coverage before shipping those items verbatim | Primary matrix generator basis; generated output is clean |
| **OMIB — Open Matrices Item Bank** | 220 IRT-calibrated 3×3 figural matrices, validated on N=2,572 applicants | GPLv3 asserted in paper abstract only; OSF repo shows "No License" ⚠️ | **Conditional — do not ship without author confirmation** | Best ready-made calibrated bank *if* licence confirmed in writing |
| **MaRs-IB** | 80 matrix items × 3 variants + colour-blind palettes, item-level data | Items CC BY-**NC** 3.0 (paper is CC BY — the classic trap) ✅ verified 3 ways | **No** | Design/documentation model only, or negotiate a licence |
| **ICAR** | 60+ core items + contributed sets (180 verbal / 180 abstract / 180 numeric) | "Academic use exclusively; we have to turn down any commercial requests" ✅ verified | **No** | Format/psychometrics study model; CC0 SAPA *response data* usable for norms research |
| **Hagen Matrices Test** | 20-item + 6-item figural matrices (rel. ≈ .80) | Free for non-commercial use only | **No** | Documentation template (ZIS entry) |
| **Berlin Numeracy Test** | 4-item statistical numeracy, validated across 15 countries | CC BY 3.0 (items printed in the article) ✅ verified verbatim | **Yes** (attribution) | Numeracy screen / item-writing model; answers googleable |
| **CRT-2** (Thomson & Oppenheimer 2016) | 4 verbal reflection items | CC BY 3.0 ✅ verified (original Frederick CRT is *not* cleared) | **Yes** (attribution) | Screening signal only — heavily internet-contaminated |
| **Army Alpha/Beta (Yerkes 1921)** | Complete WWI test battery: analogies, number series, disarranged sentences, etc. | Public domain (US Gov. work, pre-1930) ✅ verified | **Yes** | Item-format ancestry / parallel-form models; content archaic and culturally loaded — never verbatim |
| **ETS Kit of Factor-Referenced Tests** | 72 marker tests, 23 cognitive factors | Signed agreement + per-copy royalty, research-oriented | **No** | Factor taxonomy blueprint |
| **openpsychometrics.org** | VIQT, MGKT etc. + huge response datasets | No blanket licence; site discourages reuse | **Unclear** — email operator | Response datasets for difficulty-modelling practice |
| **NIH Toolbox** | Licensed iPad research battery | Proprietary subscription | **No** | Measure taxonomy reference |
| **UK Biobank cognitive tests** | Touchscreen battery, ~500k participants | Data access only, health-research-in-public-interest — a hiring product cannot qualify ✅ verified | **No** | Literature source only |
| **AI2 ARC** | 7,787 science MCQs with keys | CC BY-SA 4.0 ✅ verified (HF dataset card) | Conditional (ShareAlike) | Practice-mode content at most — fully public + in LLM training data |
| **word2vec analogy set** | ~19.5k A:B::C:D word pairs | Apache-2.0 ✅ verified (repo LICENSE covers file) | **Yes** | Seed data for verbal-analogy generation |
| **WordNet (Princeton)** | The English lexical database | Princeton WordNet 3.0 licence — "may be used in commercial applications" ✅ verified | **Yes** (preserve notice) | Engine for vocabulary/analogy/odd-one-out generation |
| **LEVANTE core tasks** | Modern open developmental battery | CC BY-NC 4.0 | **No** | Map of which upstream stimulus sources are genuinely permissive |

### The headline findings

1. **There is no free lunch in verbal.** No open, validated, commercially-licensed verbal
   reasoning item bank exists anywhere — ICAR's 180 verbal items are research-only, and
   everything else is either NC or not psychometric. Verbal must be generated and owned.
2. **Matrix reasoning is the best-served domain.** Sandia (BSD, with generator + norming data
   mapping generation parameters to difficulty) is fully commercial-safe. OMIB is the largest
   calibrated bank but its licence rests on one sentence in a paper abstract contradicted by
   the OSF repo's "No License" metadata — usable only after written confirmation from the
   authors (Koch/Becker et al.).
3. **"Public domain" branding lies.** ICAR calls itself a public-domain resource in its own
   papers; its actual terms are academic-exclusive. MaRs-IB is routinely described as openly
   licensed because the *paper* is CC BY; the *items* are CC BY-NC. Both are traps that would
   put licensing risk inside a paid product.
4. **The small CC-BY numeracy/reflection scales (BNT, CRT-2) are legally clean but
   operationally weak** — 3–4 items each, answers publicly indexed. Use as models, not
   instruments.

## B. Generators and automatic item generation (AIG)

The strategic conclusion of this research: **generation is the licensing strategy.** Items
generated by rules or LLMs are original works Trajectas owns outright — no copyleft, no
attribution obligations, no exposure to another publisher — and per-candidate isomorph
generation is simultaneously the modern defence against item leakage and answer-sharing.

### Tooling

| Tool | What | Licence | Commercial | Notes |
|---|---|---|---|---|
| **SGMT + `DH-Oz/raven-matrix` Python port** | Parametric Raven-like 3×3 generator; norming maps parameters → difficulty | BSD 3-Clause ✅ (Java tool). Port's BSD grant is README-only — no LICENSE file; ask the maintainer to add one before depending on it commercially | **Yes** | The practical starting point for matrix AIG; BGSU *Personnel Assessment and Decisions* review covers which subsets have selection-grade psychometrics |
| **IMak (R, CRAN)** | Figural *analogy* generator; 5 rules, difficulty dialled by rule count/type (Blum & Holling 2018) | GPL-3 ✅ | Yes (server-side use; generated items are yours) | Actively maintained (v2.1.2, 2025). Counsel check: confirm output images don't embed package-copied assets |
| **RAVEN generator** (Zhang et al. 2019) | Stochastic-grammar RPM generator, 7 configurations, rule annotations | GPL-3 ✅ | Conditional | Distractor sampling is *biased* (solvable from options alone) — must use the I-RAVEN fix |
| **I-RAVEN / SRAN** | Attribute Bisection Tree — unbiased, principled distractor generation | GPL-3 | Conditional | The open algorithm for the hardest part of matrix AIG: distractor construction |
| **raven-gen** | Customisable RAVEN rewrite: human-quality rendering (resolution, styling) | GPL-3 | Conditional | The rendering-for-humans path; validate rule logic (parity not guaranteed) |
| **DeepMind PGM** | 1.42M generated matrices (dataset only) | Repo Apache-2.0; README restricts **data to non-commercial research** ⚠️ | **No** (data) | Rule-taxonomy reference only; publicly downloadable anyway (exposure risk) |
| **ConceptNet 5** | Semantic network for verbal analogy generation | Data CC BY-SA 4.0 | Conditional (SA on redistributed *data*; items authored using it are your own) | Prefer Open English WordNet (CC BY 4.0) where possible |
| **Syllogism space** | 64 moods × 4 figures = 256 forms, 24 valid | Logic is uncopyrightable | **Yes** | A complete deductive generator is a few hundred lines of TS |

### Methods (freely implementable — methods are not copyrightable)

- **Embretson's cognitive design system** (strong-theory AIG): difficulty and discrimination
  predicted *a priori* from the cognitive model (rule count, working-memory load, perceptual
  complexity); calibrate generating principles, not individual items.
- **Gierl & Lai item modelling** (the dominant practical framework): SME cognitive model →
  item model with **radicals** (difficulty-driving parameters) vs **incidentals** (surface
  variation) → software instantiates valid combinations. NCME ITEMS module PDF is free.
- **Item-family IRT / item cloning** (Glas & van der Linden 2003; Geerlings et al.): clones
  share a family-level parameter distribution — **pilot-calibrate the family, not each item**;
  promote only low-variance families to unpiloted operational use. This is the formal answer
  to "can generated items inherit difficulty?" — yes, with a variance penalty that shrinks as
  radicals are controlled tightly.
- **Bejar et al. (ETS)**: on-the-fly isomorph generation *inside* an adaptive GRE quantitative
  test scored at model level — the existence proof for per-candidate fresh numerical items
  without individual pretesting.
- **Number-series difficulty models** (two open-access LLTM studies, CC BY): a small feature
  taxonomy (operations, rule span, rule count/complexity) predicts ~77% of difficulty
  variance — near-strong-theory precalibration, trivial to implement in TypeScript. (Note:
  the numerical design doc excludes number series from the *operational* blueprint for
  coachability reasons — the taxonomy still matters for any future use.)
- **Arendasy & Sommer's "automatic min-max"**: generator + quality-control module encoding
  functional constraints that block psychometrically flawed combinations — the blueprint for
  wrapping rule-based validation around LLM drafts.

### LLM-based generation (2023–2026 evidence)

- **Attali et al. 2022 (Duolingo English Test)** — the reference hybrid pipeline: transformer
  generates passage + items together → automated filters → human review → pilot on practice
  tests → operational. Directly applicable to verbal T/F/Cannot-Say generation.
- **Laverghetta & Licato 2023** — "psychometrics-in-the-prompt": condition generation on
  empirically best/worst exemplar items; improved difficulty distributions in IRT analyses.
- **Gorgun & Bulut 2025 (EMIP)** — LLM-as-reviewer catches item-writing flaws (cueing,
  implausible distractors, ambiguity) at scale before human sign-off.
- **BEA 2024 shared task (NBME)** — the sobering result: predicting difficulty from item
  *text* barely beats baselines. Rule-generated items inherit difficulty from parameters;
  LLM-drafted items need pilot calibration — treat model-predicted difficulty as a prior only.
- **Webb, Holyoak & Lu 2023 (Nature Human Behaviour)** — GPT-class models solve text-encoded
  matrices and analogies at/above human level. **AIG solves item exposure, not AI-assisted
  cheating** — assume frontier multimodal models now solve figural items too; the durable
  defences are behavioural (timing, telemetry, verification retesting), not item format alone.

Fit with the existing codebase: the AI-GENIE pipeline (`src/lib/ai/generation/`) already has
run/audit/prompt-management infrastructure to reuse, but its validation stages are
Likert-oriented (embedding coherence, EGA redundancy). A keyed-item pipeline needs new stages:
solution-uniqueness verification, distractor-rationale validation, key balance, and an
LLM-reviewer stage per Gorgun & Bulut. See the [infrastructure audit](./02-infrastructure-audit.md), gap 12.

## C. Platforms, engines, and libraries

### Verdict table

| Tool | What | Licence | Commercial | Fit for Next.js + Supabase |
|---|---|---|---|---|
| **jsCAT** (`@bdelab/jscat`, Stanford yeatmanlab) | TypeScript IRT ability estimation (MLE/EAP) + item selection (MFI); powers ROAR | MIT ✅ (repo LICENSE) | **Yes** | **Best technical fit found.** npm-installable, server-side capable (keeps parameters secret), active (v5.3.2, May 2026) |
| **mirt + mirtCAT** (R) | Reference IRT calibration (2PL/3PL/GPCM, DIF, scoring) | GPL ≥3 | Conditional — internal/server-side use imposes nothing | Gold standard for offline calibration; parameters land in Postgres |
| **catR / mstR** (R) | Classic CAT item selection/stopping rules (powered Concerto) | GPL ≥3 / ≥2 | Conditional (same server-side analysis) | Stable/feature-complete; well-documented spec to reimplement in TS |
| **TAM / ltm** (R) | Rasch/multifacet + classic latent trait models | GPL ≥2 | Conditional | Calibration-time alternatives |
| **py-irt** | Bayesian IRT (Pyro/PyTorch) | MIT ✅ | **Yes** | Python calibration sidecar option; heavy for serverless |
| **girth** | Pure-Python IRT (numpy/scipy) | MIT | Yes | Light but dormant (2021) |
| **catsim** | CAT *simulation* framework (selection, exposure, stopping) | BSD 3-Clause ✅ | **Yes** | Use to validate CAT design (bank size, exposure) before building |
| **EduCAT** | LLM-era neural CAT research library | MIT | Yes | Track, don't deploy — explainability matters in hiring |
| **Concerto** (Cambridge) | Full open adaptive testing platform (PHP + R workers) | Apache-2.0 ✅ | **Yes** | Licence ideal, repo dormant since 2023 — treat as a reference implementation, not an embed |
| **TAO Community** | QTI assessment platform (authoring, banking, delivery) | GPL-2.0 | Conditional (self-hosted sidecar fine) | Heavy PHP monolith; big operational lift next to Supabase |
| **jsPsych** | The standard JS library for timed cognitive tasks in-browser | MIT ✅ (v8.3.0, Jul 2026) | **Yes** | Import into a client component for reaction-time-grade tasks (working memory, checking) |
| **lab.js** | Experiment builder + runtime | Core Apache-2.0, builder AGPL | Conditional | Dormant (2021) — prefer jsPsych |
| **PsyToolkit** | Hosted experiment service + task library | Non-commercial without bespoke agreement | **No** | Rule out |
| **PEBL** | Desktop battery of ~100 tests | GPL | Conditional | Wrong architecture (C++ desktop); battery designs as prior art |
| **OpenSesame/OSWeb** | Python experiment builder + web runner | GPL-3 | Conditional (serving OSWeb JS = distribution → bundle stays GPL) | jsPsych achieves the same without copyleft entanglement |
| **Tatool Web / psychTestR** | Web cognitive-task platforms | GPL-3 | Conditional | Dormant AngularJS / owns-the-whole-UI Shiny respectively |
| **SurveyJS Form Library** | JSON-driven survey rendering (React) | MIT (library; Creator is commercial) | **Yes** | Optional delivery layer; don't confuse with the commercial Creator |
| **amp-up.io QTI 3 player** | QTI 3 item rendering (Vue) | MIT | Yes | Only if standards-based interchange becomes a requirement; QTI is likely overkill |
| **@citolab/qti-components** | QTI web components | GPL-3.0-only | Conditional | Avoid bundling into proprietary frontend |
| **@xapi/xapi / SQL LRS (lrsql)** | xAPI client / Postgres-backed LRS | MIT / Apache-2.0 | Yes | Only if enterprise LRS export is asked for |
| **Safe Exam Browser + SEB Server** | Lockdown browser ecosystem (ETH Zurich) | MPL 2.0 | **Yes** | Production-grade but heavy-handed for hiring funnels; certification-tier option |
| **Proctoring-AI** (and the OSS proctoring field) | Webcam gaze/face/phone detection | MIT but unmaintained research code | Yes (nominally) | No production-quality OSS proctoring exists in 2026; tab-focus telemetry needs no library. Webcam proctoring carries GDPR/biometric risk — build-vs-skip, not adopt |
| **OpenOLAT** | Java LMS with real item-bank management | Apache-2.0 ✅ | Yes | Poor embed; its question-pool data model is a good schema blueprint |
| **Moodle mod_adaptivequiz** | CAT plugin implementing Wright (1988) | GPL-3 | Conditional | Its documented algorithm is a clean CAT recipe to reimplement freely |

### The GPL boundary, stated once

Running GPL software **server-side inside your own infrastructure is use, not distribution** —
it imposes nothing on proprietary Next.js code. Obligations trigger only when you *distribute*
the GPL program or derivatives of its code (which includes serving GPL JavaScript to
browsers). Hence: mirt/catR/IMak/RAVEN-derived generators are all fine as offline pipelines or
sidecars; GPL *frontend* libraries are the ones to avoid. Items and images **generated** by
GPL tools are program output — generally yours — with one counsel-check: confirm outputs don't
embed assets copied from the tool itself.

### Recommended architecture (from this research)

No platform is worth embedding wholesale. The pragmatic stack:

1. **Calibration (offline batch):** R sidecar/container with mirt (or py-irt) reading
   responses from Postgres, writing to the existing `item_parameters`/`calibration_runs`
   tables.
2. **Delivery + live scoring (in-app):** existing runner + `jsCAT` server-side for theta
   scoring and (later) adaptive item selection — pure TS, MIT, parameters never leave the
   server. Trajectas' own dormant `irt/models.ts`/`estimation.ts` may make even jsCAT
   optional — evaluate side-by-side.
3. **Generation (offline pipeline):** SGMT-derived matrix generator (BSD) with I-RAVEN-style
   distractor logic + own TS syllogism/numerical template generators + LLM drafting for
   verbal, all feeding the existing generation-runs infrastructure.
4. **Simulation (design-time):** catsim to validate form/CAT design before pilots.

## D. What incumbents ship, and the rules that bind

Condensed from the market/standards research; the full fairness/legal programme is in
[`06-battery-and-psychometric-programme.md`](./06-battery-and-psychometric-programme.md).

### Competitor architecture reference points

| Vendor | Format | Length/timing | Notable |
|---|---|---|---|
| SHL Verify Interactive G+ | Adaptive, interactive items | ~24 q / 36 min | The canonical UIT security model: randomised equivalent forms + supervised **verification test** with a Confidence Indicator flagging aberrant unproctored scores |
| Criteria CCAT | Fixed, heavily speeded | 50 q / 15 min | α = .86 (n ≈ 98k) — but speeded text MCQs are the format *most* exposed to LLM cheating |
| Korn Ferry Talent Q Elements | Adaptive, **per-item timing** (60–90 s) | 12–15 items/scale | Per-item clocks starve LLM round-trips; supervised retest for surrogate detection; desktop-only is now a liability |
| Talogy Logiks | Fixed, speeded, two tiers | 50 q/12 min; 30 q/20 min | The BPS-style accreditation-gated distribution model |
| TestGorilla | Fixed modular (9–13 min/test) | up to 5 tests | The self-serve comparator: exposure-capped banks, webcam snapshots, tab/paste telemetry, honesty attestation banning AI use, "behavioural tiers" — never auto-reject |
| Alva Labs | **CAT, 3PL Bayesian**, figural only | 20 items / ~15 min, 2 min/item | The best public blueprint: technical manual documents EAP scoring, r ≈ .86, every item DIF-screened, bank recalibrated every 18 months, EFPA certification via DNV as trust signal |
| HiPeople | Modular + AI-generated items | — | Openly productises open-source science; "Living Validity" = continuous per-customer criterion monitoring |
| Arctic Shores | Task-based (no right/wrong) | — | Furthest on AI-cheat resistance (published attempts to break their own test); construct defensibility is the trade-off |
| Plum | Matrices + Big Five + SJT | ~25 min untimed-feel | Deliberately avoided verbal/numeric to reduce adverse impact; note "Raven's" is a Pearson trademark |

### The load-bearing science and law (2026)

- **Validity:** Sackett et al. (2022, 2023) revised GMA operational validity to ≈ .22–.31
  (from Schmidt & Hunter's .51); structured interviews now top-ranked (≈ .42). Contested
  (Oh/Le/Roth, Ones et al. argue under-correction), but "best single predictor" marketing is
  no longer defensible. Position cognitive as one signal in a multi-measure composite —
  strongest for graduate/low-experience and high-complexity roles.
- **Adverse impact:** applicant-pool Black–White d ≈ .7–1.0 on g-loaded tests; any g-loaded
  test will trip US four-fifths analyses at realistic selection ratios. Mitigations with
  evidence (Ployhart & Holtz 2008): composite with non-cognitive predictors, documented lower
  cognitive weighting, minimal reading load (figural where possible), removing speededness,
  item-level DIF screening. Score adjustment/subgroup norming is unlawful in the US (CRA 1991).
- **Standards:** AERA/APA/NCME Standards (2014, free PDF) + SIOP Principles are what courts
  benchmark against; EFPA Test Review Model 2025 / BPS registration is the UK/EU enterprise
  trust signal (requires a full technical manual: norms, reliability, validity, SEM, sample
  reports); ISO 10667 increasingly cited in RFPs (self-declared).
- **US:** Uniform Guidelines (29 CFR 1607) four-fifths rule; EEOC 2023 confirmed it applies to
  AI tools; vendors get sued alongside employers (Mobley v. Workday).
- **EU AI Act:** employment AI is high-risk (Annex III). The 2026 "AI Omnibus" (Reg. (EU)
  2026/1744) delayed Annex III obligations to **2 December 2027**. Fixed IRT scoring arguably
  isn't "AI"; ML scoring, adaptive AI generation, or ranking engines squarely are — design in
  logging, dataset governance, human oversight now.
- **NYC LL144:** independent bias audit + published results + candidate notice for automated
  employment decision tools; audit sits on the employer but vendors win deals by supplying the
  auditable data package. Design consequence: voluntary self-ID demographics, per-category
  scoring-rate storage, impact-ratio reporting in-product.
- **UK:** ICO's AI-in-recruitment audit report (Nov 2024) is effectively a free compliance
  checklist: DPIA, lawful basis per activity, no inferred demographics, retention schedules,
  meaningful human review (Art 22), candidate objection flow. Equality Act s.19 indirect
  discrimination mirrors US adverse impact.
- **LLM cheating:** GPT-4 scored ~94th percentile on a commercial *verbal* test (Hickman et
  al. 2024) — text verbal items are effectively nullified in unproctored settings. Industry
  norm stack: randomised calibrated forms + exposure caps, per-item timing, figural/interactive
  formats, paste-blocking + telemetry with human review, supervised verification retests for
  finalists. Assume multimodal models now solve figural items too — verification + telemetry
  is the durable design, not any "AI-proof" item type.

## E. Strategic synthesis

1. **Buy nothing; license nothing exclusive; generate and own.** The open ecosystem gives
   generators, methods, and calibration tooling — not shippable verbal/numerical banks. The
   defensible path (and the one HiPeople proves viable commercially) is rule-based + LLM
   generation into an IRT calibration pipeline Trajectas owns.
2. **Bootstrap matrices from Sandia (BSD) while building an SGMT/I-RAVEN-style generator**;
   pursue written OMIB confirmation as a fast-follow calibrated bank; treat MaRs-IB/ICAR
   strictly as design references.
3. **Adopt jsCAT (MIT) or activate the in-repo IRT code for live scoring; mirt (R, offline)
   for calibration; catsim for design simulation.** No platform embed.
4. **Item security ≥ item quality for UIT.** Per-candidate isomorphs from calibrated families,
   per-item timing, telemetry tiers, and a supervised verification-retest option are the
   product features that make unproctored scores defensible in 2026.
