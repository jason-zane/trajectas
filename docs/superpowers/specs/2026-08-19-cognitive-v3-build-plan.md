# Cognitive v3 — six options, a comprehensive and distinct item set

**Status: implementation plan, executing on `feat/cognitive-v3-six-options-surfaces` (2026-08-19).**
Supersedes nothing; builds on v2 (`2026-08-19-cognitive-v2-build-plan.md`).
JH's brief for v3, verbatim in substance: six options; the patterns
should look different and better; "a really comprehensive tool, but
discrete in its own thing, and defensible."

## 0. What the research sweep established (five lenses, ~90 sourced rows)

The full taxonomy rows are in the session's research output; the
conclusions that drive this plan:

**Rules.** The literature's rule vocabulary (Carpenter, Just & Shell
1990; Vodegel Matzen 1994; Matzen 2010 Sandia; Becker 2016 DESIGMA / Koch
2022 OMIB; Pallentin 2023 HeiQ; Schroeders & Walter 2026 BOLT;
RAVEN/I-RAVEN/PGM; Arendasy GeomGen; Embretson 1998/2002; Primi 2001) is
covered by our R0–R9 **except**: reflection/mirroring (R10), set
intersection / Boolean AND (R11), count arithmetic across a row (R12),
overlay with occlusion, shape distortion, and ternary operations. v3 adds
R10–R12; overlay/distortion/ternary are deliberately out (§6).

**Surfaces.** Established tests and generators draw on: geometric
primitives (dots, strokes, arcs, polygons incl. hexagon/star/cross), fill
vocabularies (outline/hatched/solid/grey), line properties (weight,
dashed), size levels, nested containers, corner marks, bit-grids,
positional layouts. Ours today: 6 shapes × 3 fills, a tick, four bars,
dots at five anchors, bit-grids. That is why the bank "looks the same":
the rules are varied, the surfaces are not. Surface choice is also a
difficulty driver in its own right (Primi 2001 harmonic vs nonharmonic
organisation; Meo, Roberts & Marucci 2007 element salience; BOLT's
image-derived indices) — so broadening it is measurement, not decoration.

**Layouts.** 3×3 with row/column rules is the commercial standard
(Matrigma, SHL Inductive, Saville, Talent Q, Criteria) and what our
verifier is built for; I-RAVEN's configurations (center-single, 2×2,
3×3, out-in, left-right, up-down) are *within-cell* layouts we can
reproduce with layers. 2×2 matrices and series-completion are out of
scope for v3 (verifier); odd-one-out and constructed response are out
(format).

**Option sets.** Established: CPM 6, SPM/APM 8, Mensa 6, ICAR 6, HeiQ
8–9, WMT-2 8, Matrigma/Talent Q/Saville/CCAT 6; MaRs-IB's 4 is an
acknowledged limitation. Six is the modern convention and what JH asked
for. Construction rules that make six non-eliminable: Guttman &
Schlesinger facet design (HeiQ), Matzen's distractor taxonomy, Mittring
& Rost's three bypass strategies (visual dissimilarity, element counting,
answer-only solving), RAVEN-FAIR's solve-conditional generation — all
already encoded as our G-08′/G-10/G-11/G-18/G-19/G-20.

**Difficulty and validity (for the defensibility dossier).** Difficulty
drivers with evidence: number of rules (≈ −10% accuracy per rule,
Carpenter), number of elements, rule type (binary > unary; BOLT), working
memory/goal management, perceptual organisation (Primi), distractor
quality. LLTM R² with rule taxonomies ≈ .50–.60 (Primi) to .74 (BOLT
study 2). Matrix tests: r ≈ .73–.81 with full batteries (HeiQ), g-loaded
Gf; GMA operational validity ≈ .51 for job performance (Schmidt &
Hunter); reduced adverse impact vs verbal tests (d ≈ .5–.7 vs ≈ 1.0);
sex differences negligible in adults; age correlation ≈ −.45 across 18–60
(so age-stratified norms). Standards to meet: AERA/APA/NCME reporting
(α ≥ .85, retest, criterion evidence, DIF), EFPA norm-group minimums
(200–300 per group; market 1,000+).

**Commercial conventions / distinctiveness.** 12–50 items in 10–25 min,
45–75 s/item, six options, percentile/stanine reporting; nobody publishes
their rule taxonomy or generator — ours is transparent by design
(construction rationale + gates + fresh seeded forms), which is the
distinctive claim. "Raven's Progressive Matrices" is a trademark; the
figural-matrix genre is not protected; specific items are. We copy no
item and no named test's vocabulary; every family below is our own
composition of published primitives.

## 1. Six options (Phase A — in progress)

Slots A–F; the schema accepts 5 or 6 (v1/v2 items in production keep 5);
the generator emits 6; every gate thresholds on N = options.length (G-20
≥ N−1; G-11/G-18/G-19 ≥ 2; G-08′ P ≤ ¼; G-16 balance over N; G-17
p = 1/N); every family declares a five-entry distractor plan under its
existing contract (cheap+hard families: four hard-axis errors + one
incomplete correlate; 3R-DIST: fractional design extended; single-rule
and bit-grid families: one more labelled mechanism). Runner: one row of
six, wrapping 3+3 below 360 px. A data migration relabels the response
format "Figural Matrix (5-option)" → "Figural Matrix" (option count is
per item).

## 2. Engine additions (Phase B1)

- **R10 reflection** — `flip` attribute on asymmetric shape elements
  (`none | h | v | hv`), rendered as a transform; rules: progression over
  the ordered ladder [none, h, hv] or a Latin square over {none, h, v};
  new asymmetric shapes: `arrow` (exists), `flag`, `lshape`, `half`
  (half-filled circle). Weight 0.5 (between rotation 0.3 and movement
  0.6; reflection is harder than rotation to track — Mittring & Rost).
- **R11 intersection** — `setOperatorRule('intersection')` added to the
  candidate list (rules.ts) so Level A sees it; BOLT's AND. Weight 0.8
  (as R4).
- **R12 count arithmetic** — numeric row rule `c3 = c1 + c2` (and
  `c3 = c1 − c2`) on a `count` axis; new candidate rule in rules.ts;
  Level A must distinguish it from progression (sum ≠ arithmetic
  progression unless c1 = c2 — the family draws c1 ≠ c2). Weight 0.7.
- **R8 size** and **R9 fill** used as genuine rules (ladders S/M/L and
  outline/hatched/solid/grey — `grey` added as a fourth fill rendered at
  45% ink).
- **Shape vocabulary**: add `hexagon`, `star`, `cross`, `semicircle`
  (polygon/geometry in render/primitives.ts; hatch works through the
  existing clipped-segment path); families draw shape sets from the
  widened palette so two items of one family rarely share a shape set.
- **Stroke element**: `strokes` (set over {H, V, D1, D2, ARC_T, ARC_B}
  — six stroke kinds, drawn large, no frame) for the stroke-figure
  families; reuses the set-axis machinery (`inner.bars` already proves
  Level A handles set operators).
- **Nest element**: `nest` (ordered list of up to 3 concentric
  {shape, fill} layers) with a set-valued `layers` axis for union rules
  and enum axes per layer for Latin squares.
- **Rendering**: elements sized to fill more of the cell (shape L from 60
  → 68 units where the ink ceiling allows; strokes span 70 units), stroke
  width 2 → 2.4; verified against qa/density.ts ceilings and by eye on
  the contact sheet.

## 3. The v3 family set (Phase B2/C — 20 families, six options)

Existing twelve, with the surface upgrade applied (wider shape sets;
ROT rotates arrows *or* flags *or* half-circles; MOVE moves a dot *or* a
small square *or* a small triangle; ADD/SUB on bars *or* corner dots;
XOR families' frames drawn from the wider palette): LRM-PROG-COUNT, ROT,
MOVE, ADD, SUB, 2R-XLAYER, 3R-DIST, XOR-XLAYER, XOR-DIST-XLAYER,
3R-XLAYER, BITS-XOR, BITS-2OP.

New eight (code · layout/surface · rules · contract · prior):

| code | surface | rules (axes) | cheap / hard | b (formula) |
|---|---|---|---|---|
| **LRM-MIRROR** | one asymmetric glyph (flag / lshape / half / arrow) filling the cell | R10 reflection ladder [none, h, hv] per column, same every row; shape constant per row (incidental) | single hard | −2 + 0.5 + 0 = **−1.5** (easy) |
| **LRM-FILL-ROT** | asymmetric shape | R9 fill progression per row (cheap) + R2 rotation 45°/col (hard), cross-attribute | fill cheap; rotation hard | −2 + 0.1 + 0.3 + 0.5 + 0.3·nonCard ≈ **−0.8** (moderate) |
| **LRM-SIZE-COUNT** | repeated small shapes | R8 size progression per column + R1 count progression per row | both cheap-ish quantitative; declare no split (balanced set, G-18 both) | −2 + 0.2 + 0 + 0.5 = **−1.3** (easy) |
| **LRM-SUM** | dots scattered (no anchors) | R12 count arithmetic c3 = c1 + c2 (and the − variant as a parameter) | single hard | −2 + 0.7 + 0.3 (load 1) = **−1.0** (moderate) |
| **LRM-DOTS-AND** | corner + centre dots (five anchors) | R11 intersection row-wise | single hard | −2 + 0.8 + 0.3 = **−0.9** (moderate) |
| **LRM-CORNER-XOR** | four corner marks + a centre shape | R7 XOR on corners (hard) + R6 Latin square on centre shape (cheap), cross-layer | shape cheap; corners hard | −2 + 1.6 + 0.45 + 0.5 + 0.5 + 0.3 = **+1.35** (hard) |
| **LRM-STROKE-XOR** | 2–3 large strokes, no frame | R7 XOR on the stroke set (six-kind vocabulary) | single hard, perceptualLoad 2 | −2 + 1.6 + 0.6 = **+0.2** (moderate) |
| **LRM-NEST-ADD** | concentric containers | R4 union on the layer set (which of the three containers is present), shapes fixed per layer per item | single hard, perceptualLoad 1 | −2 + 0.8 + 0.3 = **−0.9** (moderate) |

Coverage after v3: rules R0–R12 all exercised; surfaces — shapes (10),
fills (4), sizes (3), ticks, bars, strokes, dots/corner marks, nested
containers, bit-grids; layouts — center-single, out-in (nest, XLAYER),
corner/anchor (MOVE, SUB, DOTS-AND, CORNER-XOR), grid (BITS). Bands:
easy 4, moderate 9, hard 5, very hard 2 (BITS-2OP; and 3R-XLAYER/XOR-DIST
at the top of hard). The ceiling stays BITS-2OP; a second very-hard
family (STROKE-2OP: XOR on strokes + union on a second stroke layer) is
the first candidate after v3 is piloted.

Every family: deterministic `buildDistractors`, its own header stating
the contract and the modal/centroid arithmetic, G-03/06 unique
solvability (samplers redraw when Level A would not find the declared
rule unique — the bit-grid pattern), six options, measured over 20 seeds
× 8 draws before registration.

## 4. Form v3 (Phase D)

28 scored + 3 practice, **35 minutes** (75 s/item). Four tiers, round-
robin over families inside a tier (no two adjacent items from one
family), practice from LRM-PROG-COUNT only:

- tier 1 (easy, 7): MIRROR 2, ROT 2, MOVE 1, SIZE-COUNT 2
- tier 2 (moderate, 9): SUB 1, ADD 1, SUM 1, DOTS-AND 1, NEST-ADD 1,
  FILL-ROT 1, 2R-XLAYER 1, 3R-DIST 1, STROKE-XOR 1
- tier 3 (hard, 8): BITS-XOR 2, XOR-XLAYER 2, CORNER-XOR 2, XOR-DIST 1,
  3R-XLAYER 1
- tier 4 (top, 4): XOR-DIST 1, 3R-XLAYER 1, BITS-2OP 2

Seed `v3-<date>`, 12 per family; ingest via the app pathway; seed SQL
pinned to that seed (as v2's).

## 5. Verification and defensibility artefacts

Unit + architecture tests; per-family battery tables in the PR; contact
sheet eyeballed; CI; and a **technical-note skeleton**
(`docs/.../cognitive-technical-note.md`) listing, per family, the rule
ids, the construction rationale with citations, the option-set contract
and the gates that verify it — the bones of the technical manual the
AERA/APA/NCME standards expect, filled with calibration numbers later.

## 6. Deliberately not built

Overlay with occlusion and shape distortion (not machine-verifiable with
our verifier); ternary operations (need a fourth column); 2×2 and series
layouts (verifier); odd-one-out and constructed response (format);
colour (monochrome by design — print-safe, colour-vision-safe);
adaptive delivery (needs calibrated items first).
