# Figural Matrix Reasoning — technical note (skeleton)

**Status: skeleton, 2026-08-19.** The bones of the technical manual the
AERA/APA/NCME *Standards* expect for a published ability test: what the
instrument is, how every item is constructed, what guarantees the
construction gives, and where the calibration numbers will go. Sections
marked *[calibration]* are empty until a non-internal sitting exists.

## 1. Construct and format

- Construct: fluid reasoning (Gf) — rule induction and application on
  figural 3×3 matrices; the genre of Raven's Progressive Matrices, the
  Culture Fair, Matrigma, SHL Inductive, HeiQ, BOLT.
- Format: 3×3 matrix, bottom-right cell blank, six response options,
  one key; tap-to-advance with Back; fixed-order linear form; 28 scored
  items in 35 minutes; raw score = number correct; guessing floor 1/6.
- Delivery: browser, light-mode stimulus, SVG rendered server-side from a
  structured spec (never a bitmap); `src/lib/cognitive/render`.

## 2. Item model — rules, surfaces, difficulty

Rules (`spec/schema.ts` `RuleId`; verifier `generator/rules.ts`):

| id | rule | generator | verifier candidate | weight |
|---|---|---|---|---|
| R0 | constant | implicit | `constantRule` | 0 |
| R1 | progression (linear / ordered ladder) | families | `progressionRule` | 0.0 |
| R2 | rotation progression | families | `rotationRule` | 0.3 |
| R3 | movement (cyclic) | families | `cyclicProgressionRule` | 0.6 |
| R4 | union | families | `setOperatorRule('union')` | 0.8 |
| R5 | difference | families | `setOperatorRule('difference'/'reverseDifference')` | 0.8 |
| R6 | distribution of three (Latin square) | families | `latinSquareRule` | 0.9 |
| R7 | symmetric difference (XOR) | families | `setOperatorRule('symdiff')` | 1.6 |
| R8 | size progression | families | (ordered-enum progression) | 0.2 |
| R9 | fill progression | families | (ordered-enum progression) | 0.2 |
| R10 | reflection (D4 composition) | families | `reflectionRule` | 0.5 |
| R11 | intersection | families | `setOperatorRule('intersection')` | 0.8 |
| R12 | count arithmetic (sum / difference) | families | `arithmeticRule` | 0.7 |

Difficulty prior (`generator/difficulty.ts`, Embretson-style linear
composite): b = −2 + Σ w(rule) [halved on declared cheap axes] + 0.5·(rules − 1)
+ 0.5·crossLayer + 0.3·perceptualLoad + 0.15·max(0, nearMisses − 2)
+ 0.3·nonCardinalAsymmetricRotation. Bands: easy < −1 ≤ moderate < 0.5 ≤ hard < 1.5 ≤ very hard.
*[calibration: replace with Rasch/2PL estimates; report LLTM R² against the radicals.]*

Surfaces (`spec/schema.ts`): shapes (13), fills (4), sizes (3), anchors
(5), orientation (8 D4 states), tick, bars (4), dots, repeat (1–6),
bit-grid (3×3), strokes (6 kinds), nest (3 rings).

## 3. Families — one row per family

For each: code · rules (cheap / hard) · surface · option contract · gates
that verify it · construction rationale and sources. Full per-family
detail lives in each family file's header (`generator/families/*.ts`).

| code | rules | surface | contract (six options) | literature |
|---|---|---|---|---|
| LRM-PROG-COUNT | R1 count | repeat shapes | IR/WR/PM/RP/RP on count | Carpenter et al. 1990 quantitative progression |
| LRM-ROT | R2 rotation | asymmetric glyph | stall / wrong step / altfill / copies | Carpenter 1990; Mittring & Rost 2008 |
| LRM-MOVE | R3 movement | satellite marker | cyclic stalls/copies, OQ-3 | Matzen 2010 Sandia |
| LRM-ADD / LRM-SUB | R4 / R5 on bars or dots | bars / dots | operand copies, wrong operator, incomplete | Carpenter 1990 figure addition/subtraction |
| LRM-2R-XLAYER | R6 shape (cheap) / R2 inner rotation | frame + inner | 4 hard errors + 1 correlate | Embretson 1998 radicals; HeiQ facet design |
| LRM-3R-DIST | R6 × 3 (all cheap) | shape/fill/size | fractional design 000/AB0/A0C/0BC/ABC | Guttman–Schlesinger facets |
| LRM-XOR-XLAYER / XOR-DIST-XLAYER | R7 bars (hard) + cheap shape | frame + bars | in-vocab bar errors + wrong-shape correlate | BOLT XOR; Carpenter 1990 |
| LRM-3R-XLAYER | R6, R6, R2 | frame/fill/rotation | 4 rotation errors + correlate | Embretson; Primi 2001 |
| LRM-BITS-XOR / BITS-2OP | R7 / R7+R4 on bit-grids | 3×3 bit-grid | operand/operator errors | BOLT (Schroeders & Walter 2026) |
| LRM-MIRROR | R10 | flag / L / trapezoid | 5 wrong D4 orientations (stall, wrong order, other axis, copies) | Raven APM reflection items; Mittring & Rost 2008 |
| LRM-FILL-ROT | R6 fill (cheap) / R2 | one glyph | 4 rotation errors + wrong-fill correlate | Carpenter 1990; Primi 2001 |
| LRM-FILL-COUNT | R6 fill (cheap) / R1 count | repeat shapes | 3 count errors + 2 wrong-fill correlates (floor 4) | Carpenter 1990; Embretson 1998 |
| LRM-SUM | R6 shape (cheap) / R12 | repeat shapes | opposite op, operand copies, off-by-one + 2 correlates | Carpenter 1990; Matzen 2010 |
| LRM-DOTS-AND | R11 | five-anchor dots | union/difference/symdiff/operand copies | BOLT AND; Carpenter 1990 |
| LRM-CORNER-XOR | R6 shape (cheap) / R7 corners | corner marks + centre | union, operand copies, intersection + wrong-shape correlate | BOLT; HeiQ |
| LRM-STROKE-XOR | R7 strokes | frameless line figures | union/operand copies/difference/intersection | Sandia stroke sets; BOLT |
| LRM-NEST-ADD | R4 rings | nested containers | operand copies, symdiff/difference, incompletes, OQ-3 | Raven figure addition; Embretson overlay radical |

## 4. Construction guarantees (what every delivered item has passed)

Per item (`generator/qa/index.ts`): G-01 schema; G-02 axis uniqueness;
G-03/04/05 Level A — every candidate rule consistent with the eight
visible cells (progressions, rotations, cyclic, Latin square, five set
operators in both directions, reflection pairs, arithmetic, plus five
accidental-regularity probes) implies the same (3,3); G-06 Level B — one
option realises it and no other is defensible; G-07 distractor gate; G-08′
context-blind expected hit rate ≤ ¼ and centroid ≠ key; G-09 homogeneity /
complexity spread / key not the bulk extremum; G-10 no giveaway pair;
G-11 copy class ≥ 2; G-12 grid degeneracy; G-13 duplicate (content and
structural hash); G-14 difficulty self-consistency; G-15 render / ink /
overlap; G-18 cheap-axis survivors ≥ 2; G-19 cue-chaining classes; G-20
cheap elimination leaves ≥ max(4, N−2). Per batch: G-16 key-slot balance
within ±1; G-17 expected blind hits ≤ chance.

Reproducibility: (generator version, seed, family) → byte-identical spec
→ content hash; `bankFromGeneration` is the single projection; ingest is
idempotent by hash.

## 5. Evidence *[calibration — all empty]*

- Reliability: KR-20 / α (target ≥ .85 at 28 items), test–retest.
- Item statistics: p, point-biserial, Rasch b with SE, infit/outfit; DIF
  by sex, age band, language, device.
- Validity: correlation with an established Gf measure (Mensa Norway /
  ICAR-16 as first anchors), with job-performance criteria later.
- Norms: age-stratified, n ≥ 200–300 per group (EFPA); percentile /
  stanine reporting.
- Fairness and adverse impact analysis.

## 6. Changes log

- 2026-08-13 v1 (8 families, 5 options); 2026-08-19 v2 (12 families,
  asymmetric contract, G-08′/G-20, bit-grids); 2026-08-19 v3 (20 families,
  six options, R10–R12, widened surfaces, G-20 floor, G-17 restated).
