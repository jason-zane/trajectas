# Cognitive Reasoning Assessments — Research & Design Pack

**Date:** 2026-08-12 · **Status:** Research complete, no implementation
**Branch:** `claude/cognitive-reasoning-assessments-77uwj9`

Research pack answering four questions ahead of building cognitive ability assessments
(logical, numerical, verbal reasoning) into Trajectas:

1. What open-source tools/item banks exist that a **commercial** platform can legally use?
2. What assessments should we build?
3. What infrastructure do we already have, and what's missing?
4. What is the actual science of each instrument — blueprints, item specifications,
   documented sample items, scoring, fairness, validation?

Method note: findings come from a multi-agent research sweep (2026-08-11/12) — a codebase
audit, four web-research angles, and adversarial licence verification in which every
"commercially usable" claim was re-checked against the project's own LICENSE file or terms
page. The assessment designs are draft blueprints written to the firm's psychometric house
rules; **nothing here is validated** — every design doc ends with mandatory empirical
validation requirements.

## The headline answers

### 1. Open-source landscape → [01-open-source-landscape.md](./01-open-source-landscape.md)

**There is no shippable open item bank for verbal or numerical reasoning, and the famous
"open" banks are traps** (ICAR is academic-use-exclusive despite its public-domain branding;
MaRs-IB's items are CC BY-NC even though its paper is CC BY). What *is* genuinely usable:

- **Sandia Matrices + generator (BSD 3-Clause, verified)** — the strongest fully-permissive
  matrix-reasoning asset: parametric generator plus normed items.
- **OMIB** (220 IRT-calibrated matrices) — GPLv3 asserted only in the paper's abstract while
  the OSF repo says "No License"; usable only after written author confirmation.
- **Tooling:** jsCAT (MIT, TypeScript CAT/IRT — best technical fit), mirt (R, calibration,
  GPL-but-server-side-fine), catsim (BSD, CAT simulation), IMak (GPL-3 figural-analogy
  generator whose *outputs* are ours), WordNet (commercial-friendly) for verbal generation.
- **Strategic conclusion: generate and own.** Rule-based + LLM item generation into our own
  IRT calibration pipeline sidesteps licensing entirely, and per-candidate isomorphs are
  simultaneously the modern anti-cheating defence. The AIG methods (Embretson, Gierl & Lai,
  item-family IRT) are not copyrightable and are documented in the landscape doc.

### 2. What to build → [06-battery-and-psychometric-programme.md](./06-battery-and-psychometric-programme.md)

A three-test core battery + optional modules, reported as three profile scores plus a
unit-weighted GMA composite (Mosier composite reliability ≈ .93):

| Test | Construct | Operational form | Time | Target reliability |
|---|---|---|---|---|
| Logical/Abstract | Gf (figural matrices + deductive) | 18 scored + 3 seeds | 22 min | .84–.87 |
| Numerical | RQ (data interpretation, not arithmetic) | 16 scored + 2 seeds | 22 min | .83–.86 |
| Verbal | Gc-R (T/F/Cannot-Say + critical reasoning) | 24 scored + 3 seeds | 20 min | .85–.88 |
| Checking (optional) | Gs | 60 items | 4 min (speeded) | .85+ |
| Working memory (Phase 2) | Gwm | ~15 span trials | 8 min | model-based |

All three core tests are **power-with-limit** (speededness is construct-irrelevant variance
and a DIF liability), mobile-first, with +25%/+50% extra-time accommodation presets. Figural
matrices lead the battery deliberately: lowest language load, smallest adverse-impact
footprint, most LLM-resistant delivery (SVG/image-only).

### 3. Infrastructure → [02-infrastructure-audit.md](./02-infrastructure-audit.md)

Trajectas is much closer than expected: the delivery pipeline, relational item storage with
an answer-key substrate, section timing *schema*, per-item latency plumbing, hardened save
RPCs, dormant-but-complete IRT/CAT/CTT scoring libraries, empty psychometric schema
(item_parameters, norm_tables, dif_results…), the AI generation infrastructure, and the
reporting stack are all reusable. The load-bearing gaps: **server-authoritative timing**
(nothing enforces limits today), **answer-key security** (score_value readable by all
authenticated dashboard users), **frozen per-session forms/item versioning**, latency capture,
an ability-scoring dispatcher, norm population (per the 2026-06-13 norms-versioning note),
practice items, accommodations, exposure control, and proctoring signals. A prior spec
([2026-05-05](../2026-05-05-cognitive-ability-assessment-design.md)) covers this feature and
remains ~90% accurate; the audit lists the deltas.

### 4. The science → design blueprints

- **[03-logical-reasoning-design.md](./03-logical-reasoning-design.md)** — figural-matrix rule
  taxonomy, radicals vs incidentals, a difficulty model, distractor grammar (wrong-rule /
  incomplete-rule / perceptual-match / repetition), 8 fully specified matrix items (cell-by-cell
  text specs renderable to SVG) + 6 deductive items with belief-bias controls.
- **[04-numerical-reasoning-design.md](./04-numerical-reasoning-design.md)** — reasoning-with-
  quantitative-information construct (calculator allowed; number series considered and
  excluded), stimulus data specs, 12 documented items whose distractors each encode a specific
  miscalculation, reading-load discipline.
- **[05-verbal-reasoning-design.md](./05-verbal-reasoning-design.md)** — defence and strict
  operationalisation of True/False/Cannot-Say (the False↔Cannot-Say line, key balance,
  3-option guessing arithmetic), passage discipline (80–120 words, FK-controlled, no prior
  knowledge), 14 T/F/CS items across 4 passages + 5 critical-reasoning MCQs.
- **[06-battery-and-psychometric-programme.md](./06-battery-and-psychometric-programme.md)** —
  battery architecture, CTT pilot → 2PL IRT calibration (honest sample-size requirements),
  θ → standard score → percentile pipeline, item lifecycle & seeding, exposure control, CAT
  roadmap, DIF/fairness programme with the diversity-validity dilemma treated honestly,
  UIT/LLM-cheating security stack, and the validation roadmap to a BPS/EFPA-grade technical
  manual.

## Context that shapes the product (from the market/standards research)

- **Validity honesty:** Sackett et al. (2022/2023) cut GMA's operational validity estimate to
  ≈ .22–.31; structured interviews now rank higher. Cognitive belongs *inside* a multi-measure
  composite — which is exactly Trajectas' shape — not as a gatekeeper, and marketing must not
  say ".51, best single predictor".
- **Adverse impact is unavoidable, only manageable:** applicant-pool d ≈ .7–1.0 on g-loaded
  tests. The levers: figural-first design, no speededness, DIF screening in the pipeline,
  documented composite weighting, no score adjustment (unlawful in the US).
- **Legal runway:** EU AI Act employment high-risk obligations now bite 2 Dec 2027; NYC LL144
  bias audits are live; the ICO's 2024 AI-recruitment report is a free compliance checklist.
  Design consequences (demographic self-ID capture, impact-ratio reporting, human review,
  logging) are itemised in doc 06.
- **LLM cheating is the design constraint of the era:** GPT-4 hits ~94th percentile on
  commercial verbal tests. The durable stack: calibrated item families with per-candidate
  isomorphs, image-only figural rendering, per-item timing, telemetry tiers with human review,
  supervised verification retests for finalists.

## Recommended path (not yet scheduled)

1. **Foundations** — server-authoritative timing, answer-key RLS split, frozen form snapshots,
   latency capture, ability-scoring dispatcher (sum-correct MVP), practice mode,
   accommodations. (Gap list in doc 02.)
2. **Logical reasoning first** — build the SVG matrix renderer + SGMT/I-RAVEN-style generator,
   author the pilot pool from doc 03's specs, pilot unscored via seeding, CTT-calibrate.
3. **Numerical + verbal** — template generators (doc 04) and LLM-drafted/human-reviewed
   passages (doc 05) through the same pipeline; 2PL calibration once N permits.
4. **Programme** — norms per the versioning note, DIF screening, exposure control, technical
   manual as the artefact BPS/EFPA registration would require; CAT only when the calibrated
   bank clears the thresholds in doc 06 §5.4.
