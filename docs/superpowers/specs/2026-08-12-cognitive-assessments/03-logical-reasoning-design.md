# Trajectas Logical Reasoning Assessment — Design Blueprint

**Status:** Draft design blueprint. Not validated. Not for operational use. See §12, *Empirical validation requirements*.
**Scope:** Design-only deliverable. No platform code. This document is the reference specification the build follows.
**Target population:** Graduate-entry through executive-level candidates in professional selection contexts, assessed remotely and unsupervised (with optional supervised verification testing).
**Language:** UK English throughout.

---

## 1. Construct definition

### 1.1 What this test measures

**Logical reasoning**, as operationalised here, is the ability to identify abstract relationships among novel elements and to draw conclusions that follow necessarily from given information, without reliance on acquired knowledge. It comprises two facets:

1. **Inductive reasoning (I):** inferring the rule or rules governing a set of stimuli and extrapolating them to a new case. Measured with **figural matrix items** — the candidate inspects a 3×3 grid whose cells vary according to one or more latent rules and selects the entry that completes the grid.
2. **Deductive reasoning (RG, general sequential reasoning):** determining what follows necessarily from stated premises, independent of the plausibility of the content. Measured with **formal syllogisms and rule-application items** using abstract or nonsense content.

### 1.2 Position in the CHC hierarchy

Within the Cattell–Horn–Carroll model, both facets are narrow abilities under **Fluid Reasoning (Gf)**:

- Figural matrices load on **Induction (I)**, the narrow ability most central to Gf. Matrix tests are the closest available marker of the Gf factor itself; in Carroll's re-analyses and in subsequent confirmatory work, matrices sit nearest the apex of the Gf loading hierarchy, and Gf in turn is the strongest single indicator of *g*. This is why the inductive component is the core of the instrument.
- Syllogistic reasoning loads on **General Sequential (Deductive) Reasoning (RG)**, also under Gf, with a secondary relationship to Gc only when content is meaningful — which is precisely why content here is abstract or nonsensical (see §1.4 and §8).

The composite is therefore a Gf measure with two narrow-ability indicators, deliberately excluding Gc (comprehension–knowledge), Grw (reading/writing), Gq (quantitative knowledge) and Gv beyond the minimal visual processing needed to perceive the stimuli.

### 1.3 What it predicts

Fluid reasoning is the best-evidenced single predictor of job performance and, especially, of **learning and adaptation in novel, complex work**: training success, time-to-competence in new roles, quality of judgement under unfamiliar conditions, and performance in roles with high information-processing demands. Validity generalises across occupations and rises with job complexity, which is what justifies its use across the graduate-to-executive range this platform serves. At executive level the relevant criterion is not routine task performance but the ability to structure ill-defined problems and reason correctly from incomplete information — exactly the demands the two facets model.

We state these expectations as the *design rationale*. Criterion-related validity for **this instrument** is an empirical claim that has not been made and cannot be made until the studies in §12 are complete.

### 1.4 Construct boundaries — what this test must NOT measure

The following are construct-irrelevant here, and every design rule in this document exists to keep them out of the score:

| Excluded source of variance | How it is excluded |
|---|---|
| **Verbal ability / reading speed** | Matrix items contain no words beyond a fixed one-line instruction learned in the practice phase. Deductive items use a controlled vocabulary (see §8.2), sentence frames of fixed structure, and a reading level at or below UK Key Stage 3 (roughly age 11–14; Flesch Reading Ease ≥ 70 for all instructional text). |
| **Mathematical knowledge** | No item requires arithmetic beyond counting to five. Numerosity in matrices is perceptual (subitisable or near-subitisable groupings), never computational. |
| **Cultural, educational or occupational knowledge** | Matrix elements are culture-fair geometric primitives (circle, square, triangle, line, dot, arrow). Deductive content uses nonsense terms (*blicks*, *stroms*) or neutral tokens, never real-world categories, so no candidate can be advantaged by domain familiarity — and belief bias is controlled (§8.1). |
| **Belief bias / prior knowledge agreement** | Nonsense-word premises make the empirical truth of conclusions unevaluable; only logical necessity can drive the answer. |
| **Test-wiseness** | Countered by the option-design rules in §9. |
| **Perceptual speed (Gs)** | Timing is power-with-limit, not speeded (§10). Perceptual complexity is a *controlled radical*, never allowed to exceed the levels specified in §4, so items are hard because of rule load, not visual clutter. |
| **Visual acuity / device quality** | Minimum element sizes, stroke widths and contrast ratios specified in §7.3 make items resolvable on a 360 CSS-px-wide phone screen. |
| **Colour vision** | Colour is never an encoding channel. Fill states are *pattern-based* (outline, solid, hatched) and remain distinct in greyscale (§7.4). |
| **Short-term memory span beyond reasoning demands** | Grids remain fully visible while answering; nothing must be memorised. Premises in deductive items remain on screen with the options. |

A candidate who reads slowly, left school early, grew up outside the UK, is colour-blind, or sits the test on a mid-range phone must face the *same effective item difficulty* as any other candidate of equal reasoning ability. Any design choice that breaks that principle is a defect.

---

## 2. Assessment architecture

| Component | Item type | Operational form length | Sample items in this document | Weight in composite |
|---|---|---|---|---|
| **LR-M: Inductive (figural matrices)** | 3×3 matrix completion, 5 options | 18 items | 8 (M1–M8) | 70% |
| **LR-D: Deductive (syllogisms / rule application)** | 4-option forced choice | 10 items | 6 (D1–D6) | 30% |

- Components are administered as separate timed sections, matrices first (lower language load makes it the better warm-up and the fairer first exposure for candidates with English as an additional language).
- Each section opens with **two unscored practice items with feedback**, drawn from the easiest difficulty band, so that instructions are learned before scored measurement begins. Practice items are excluded from all scoring and timing analytics.
- The 8 + 6 items specified here are **anchor exemplars**: one fully documented item per cell of the difficulty blueprint. The operational forms are populated by cloning these exemplars through the radical/incidental scheme in §4 (each exemplar defines a *family*; siblings share radicals and differ only in incidentals), which is also what makes bank expansion and retest forms cheap and psychometrically disciplined.

Scores are reported as theta estimates per component plus a weighted composite, norm-referenced against the pilot calibration sample (until proper norms exist, reporting must be flagged as provisional — §12).

---

## 3. Rule taxonomy for figural matrices

Every matrix item is generated from one or more of the following rule types. The taxonomy follows the Carpenter–Just–Shell analysis of Raven's Advanced Progressive Matrices, extended with the transformation rules used in automatic item generation research (Embretson; Arendasy & Sommer). Rules are stated for rows; every item in this instrument applies its rules **row-wise, verifiable column-wise** (the column consistency check is what makes the key uniquely correct and is a mandatory QA step in §5.4).

| # | Rule | Definition | Example | Relative difficulty contribution |
|---|---|---|---|---|
| R0 | **Constant (identity)** | An attribute is identical across the row. | Every cell in a row contains a square. | 0 (baseline; never the only rule in a scored item) |
| R1 | **Quantitative progression** | An attribute increases or decreases by a constant step across the row: count, size, number of sides, line weight, shading density. | 1 dot → 2 dots → 3 dots. | Low |
| R2 | **Rotation progression** | An element rotates by a constant angle per column (45°, 90°, 135°). A special case of R1 applied to orientation; listed separately because mental rotation errors are qualitatively different. | Arrow at 0° → 45° → 90°. | Low–moderate (rises with non-cardinal angles and asymmetric elements) |
| R3 | **Movement / positional progression** | An element translates along a defined path across cells (clockwise around cell corners, left-to-right across a band). | Dot at top-left → top-right → bottom-right. | Moderate |
| R4 | **Figure addition** | Cell 3 = Cell 1 ⊕ Cell 2 (superimposition; all elements of both appear). | Horizontal line + vertical line → plus sign. | Moderate |
| R5 | **Figure subtraction** | Cell 3 = Cell 1 ∖ Cell 2 (elements of Cell 2 are removed from Cell 1; Cell 2's elements are a subset of Cell 1's). | Four dots minus one dot → three dots. | Moderate |
| R6 | **Distribution of three** | Three values of an attribute each appear exactly once per row and once per column (a Latin square on that attribute). | Shapes {circle, square, triangle} distributed. | Moderate–high (rises steeply when two or more attributes are distributed simultaneously) |
| R7 | **Distribution of two (XOR)** | An element appears in exactly two of the three cells in each row; equivalently Cell 3 = Cell 1 △ Cell 2 (symmetric difference). Elements common to Cells 1 and 2 vanish; unique elements survive. | Frame+circle, circle+bar → frame+bar. | High (empirically the hardest rule in the Carpenter taxonomy) |
| R8 | **Size transformation** | Systematic size change (R1 applied to scale) or size distribution (R6 applied to {small, medium, large}). | Small → medium → large. | Low as progression; moderate as distribution |
| R9 | **Shading/fill transformation** | Fill state changes systematically: progression along an ordered fill scale (outline → hatched → solid) or distribution of three fills. | Outline → hatched → solid. | Low as progression; moderate as distribution |

**Composition constraints (design invariants):**

1. A scored item uses **1–3 non-identity rules**. Four or more rules produces error variance and goal-management failure rather than better discrimination at the top end; hardness beyond three rules is achieved by choosing R7 and by cross-layer rule application (rules operating on different figure layers, §4.3), not by piling on rules.
2. Rules within one item must operate on **disjoint attribute dimensions** (one rule on shape, one on count, one on fill — never two rules on the same dimension), so that each rule is independently verifiable and each distractor can violate exactly one rule.
3. Every rule must be **confirmed by all three rows and all three columns**. An item whose rule holds row-wise but produces a column inconsistency is defective: it licenses more than one defensible answer.
4. The key must be the **unique** cell content satisfying all rules; uniqueness is checked mechanically (§5.4).

---

## 4. Radicals vs incidentals

Following Irvine's item-generation framework: **radicals** are the structural parameters that determine an item's difficulty; **incidentals** are surface features that vary between clones of an item without altering difficulty. Keeping this distinction explicit is what allows the bank to be expanded by cloning with known difficulty, and what makes retest/alternate forms defensible.

### 4.1 Radicals (difficulty-driving; fixed within an item family)

| Radical | Levels | Effect |
|---|---|---|
| **Number of rules** | 1, 2, 3 | Largest single driver. Each added rule adds a goal to hold in working memory. |
| **Rule type mix** | Per taxonomy weights (§4.4) | R7 > R6 > R4/R5/R3 > R2/R8/R9 > R1. |
| **Rule-to-layer mapping** | Same layer vs cross-layer | Rules applied to *different overlaid figure layers* (outer shape vs inner motif) are harder than rules on spatially separate elements, because layers must first be decomposed (correspondence finding). |
| **Perceptual organisation** | Congruent / neutral / incongruent | Whether Gestalt grouping of the stimulus supports or conflicts with the rule-relevant decomposition. Incongruent organisation raises difficulty sharply and is capped at "neutral" in this instrument to avoid measuring Gv (see §1.4). |
| **Number of element types in play** | 2–5 | More distinct element identities to track raises encoding load, particularly for R7. |
| **Distractor set composition** | Per §5.3 | The proportion of "near-miss" distractors (violating exactly one rule) versus gross distractors modulates difficulty at the response stage. Harder items carry more near-misses. |

### 4.2 Incidentals (surface variation; free to vary between clones)

- Which specific shapes instantiate a shape set (circle/square/triangle vs circle/square/diamond), provided all are simple, nameable, culture-fair primitives.
- Left–right / top–bottom reflection of the whole grid (with rule directions transformed accordingly).
- Which rows/columns carry which value orderings within a Latin square (permutations of a distribution).
- Rotation of the entire stimulus set by a cardinal angle (where no rotation rule is present).
- Absolute sizes within the permitted size band; stroke weight within the permitted range.
- Position of the key among the options (balanced per §9).

**Incidental hygiene rule:** an incidental change must never create an accidental secondary regularity (e.g. reflecting a grid must not turn a 45° clockwise rotation rule into an apparent "pointing at the corner" heuristic). Every clone passes the same QA battery as a new item (§5.4).

### 4.3 Figure layers

Cells may contain up to three layers: **outer contour** (a closed shape), **inner motif(s)** (lines, bars, small shapes inside or overlaid), and **satellite elements** (small marks at defined anchor positions: four corners and centre of the cell canvas). Rules bind to layers. Cross-layer items (M6, M8) are the hard end of the blueprint.

### 4.4 Difficulty model

Predicted difficulty is a linear composite on the logit scale, used to *assign items to bands a priori*; empirical calibration (§12) replaces these predictions with estimates.

**Predicted b = β₀ + Σ w(rule) + γ·(rules − 1) + λ·crossLayer + π·perceptualLoad + δ·nearMissCount**

with design weights (in logit-scale units, anchored so β₀ ≈ −2.0 for a single R1 item):

| Term | Weight |
|---|---|
| w(R1) progression | +0.0 |
| w(R2) rotation | +0.3 (+0.3 more if non-cardinal angles on asymmetric elements) |
| w(R8/R9) size/fill progression | +0.2 |
| w(R3) movement | +0.6 |
| w(R4/R5) addition/subtraction | +0.8 |
| w(R6) distribution of three | +0.9 per distributed attribute |
| w(R7) distribution of two / XOR | +1.6 |
| γ (each rule beyond the first) | +0.5 |
| λ cross-layer rule mapping | +0.5 |
| π perceptual load (0 = sparse, 1 = neutral, 2 = dense-but-capped) | +0.3 per level |
| δ per near-miss distractor beyond two | +0.15 |

Bands: **Easy** b < −1.0 · **Moderate** −1.0 ≤ b < +0.5 · **Hard** +0.5 ≤ b < +1.5 · **Very hard** b ≥ +1.5. The eight sample items below span the bands in order.

These weights are design priors derived from the published difficulty ordering of the Carpenter rules and Embretson's cognitive-model regressions, not fitted values. §12 requires an LLTM-style regression of calibrated b on these radicals; radicals whose fitted weights diverge from priors trigger blueprint revision.

> **Correction (2026-08-14, issue #346, resolving open question OQ-1).** The b values stated alongside M1, M6 and M8 in §6 (−2.0, +0.7, +2.2 respectively as originally written) were hand-typed illustrative figures and did not reconcile with this formula run over those same items' own declared radicals — confirmed by `src/lib/cognitive/generator/difficulty.ts`, whose implementation of this formula is exercised as a mechanical gate (G-14: `|spec.predictedB − predictedB(spec.radicals)| < 0.005`) against every generated item. **The formula above is authoritative; the per-item prose figures in §6 are corrected to match it, not the reverse.** Three reasons:
>
> 1. The formula is the thing G-14 mechanically re-derives from an item's own radicals on every generation run. A hand-typed number that disagrees with it cannot be reproduced from `(generator_version, git_sha, seed, params)` and breaks the audit trail every other design decision in this document depends on.
> 2. The formula is explicitly a simple, auditable linear composite of a priori weights (§12: "design priors ... not fitted values"). Reverse-engineering a different, more complex function to hit three hand-picked anchor points (−2.0, +0.7, +2.2) exactly would trade that auditability for a curve fitted to three data points — precisely what §12 says the weights are *not* meant to be until the Stage 2 LLTM regression exists.
> 3. Part of the M6/M8 gap is now explained rather than papered over: both exemplars, as originally written, contained a duplicate cell (see the corrections under M6 and M8 in §6). A duplicate cell hands the solver information for free, so those exemplars were very likely *easier in practice* than their asserted band — which is a plausible, testable reason a hand-guessed "very hard" label overshot what the formula (correctly) computes from the item's actual rule content. Fixing the duplicates does not, by itself, close the reconciliation gap — see the recomputed b values under M6 and M8 above, both of which land in **Hard**, not the band originally claimed — because the gap was never *only* about the duplicates; it was primarily that the prose figures were not computed from the formula at all.
>
> **Consequence for the very-hard band.** Under the (unchanged) formula, neither M6 nor M8 reaches b ≥ +1.5 — recomputed, M6 is +0.8 and M8 is +0.9, both Hard. This does not mean the instrument cannot reach very-hard; it means the *M6/M8 exemplar pair specifically* does not, once their difficulty is computed honestly rather than asserted. §9's blueprint-coverage table is revised accordingly: reaching very-hard requires genuinely more rule content (more rules, and/or a rule combination doc's own eight exemplars do not use) — never a change to the weights above, which would relabel existing items as harder without making them so. See §9.1's revised table and the two new very-hard families it introduces.

---

## 5. Matrix item specification standard

### 5.1 Cell canvas and notation

Every cell is a square canvas with a normalised coordinate system, (0,0) top-left to (100,100) bottom-right. Anchor points: **TL** (20,20), **TR** (80,20), **BL** (20,80), **BR** (80,80), **CTR** (50,50). Grid cells are addressed **R1C1** (top-left) to **R3C3** (bottom-right); R3C3 is always the empty cell, marked with a "?" placeholder.

Attribute vocabulary (the full palette; items use subsets):

- **Shape:** circle, square, triangle (equilateral, apex up unless rotated), diamond (square rotated 45°), pentagon (regular, apex up), arrow (shaft with single closed head), line-segment.
- **Fill:** `outline` (stroke only), `solid` (filled foreground colour), `hatched` (45° diagonal hatching, 4 px spacing at reference scale). These three are the only fill states; they are distinguishable in pure greyscale and by pattern alone.
- **Size:** S (25% of canvas width), M (40%), L (60%), measured as bounding-box width; all elements centred on their anchor unless stated.
- **Rotation:** degrees clockwise from the element's canonical orientation; 0° = pointing up for arrows and apex-up for polygons.
- **Count:** integer 1–5; multiple identical elements are arranged in a single horizontal row centred on CTR with 8 px gaps at reference scale, unless anchors are specified.
- **Lines/bars:** `H-bar` (horizontal segment through CTR, length 60), `V-bar` (vertical segment through CTR, length 60), `D1-bar` (diagonal TL→BR through CTR, length 60), `D2-bar` (diagonal TR→BL through CTR, length 60).

A developer or SVG generator rendering exactly what each cell specification says, with the palette above, reproduces the item without further judgement calls.

### 5.2 Response format

Five options (A–E) rendered as cells identical in canvas size and style to the grid cells, displayed below the grid. Exactly one option (the key) satisfies all rules. Option order is fixed per item as specified; key positions across the form are balanced (§9).

### 5.3 Distractor design grammar

Each distractor embodies **one named, predictable error**, drawn from:

- **WR — wrong rule:** the result of applying a plausible but incorrect rule (e.g. addition where subtraction operates; union where XOR operates).
- **IR — incomplete rule:** correct on a subset of the operating rules, violating exactly one (the classic near-miss; the main difficulty lever at the response stage).
- **PM — perceptual match:** visually resembles nearby grid cells or the "texture" of the grid without satisfying the rules (captures gist-matching strategies).
- **RP — repetition:** copies an existing grid cell, typically an adjacent one (captures the naive "continue what I last saw" strategy common at low ability).

No distractor may satisfy all rules; no two options may be visually identical; every distractor must be *producible by a describable error*, because that is what makes wrong answers diagnostic and keeps guessing unattractive to partial-knowledge candidates.

### 5.4 Mechanical QA (mandatory per item and per clone)

1. **Uniqueness check:** enumerate the full attribute space of candidate completions; assert exactly one satisfies all rules.
2. **Column-consistency check:** assert every rule holds down columns as well as across rows.
3. **Distractor audit:** assert each distractor violates ≥ 1 rule and matches its declared error label.
4. **Accidental-regularity scan:** assert no unintended rule (alternation, symmetry, count pattern) holds across the grid that would license an alternative key.
5. **Render check at 360 px:** assert all elements ≥ 8 CSS px at minimum layout width and stroke ≥ 1.5 px.

---

## 6. Sample matrix items (M1–M8)

Predicted difficulty is computed from §4.4 and stated with its band. Target response time is the 80th-percentile design allowance per item (power conditions; see §10).

---

### M1 — Double count progression

**Family:** LRM-PROG-COUNT · **Rules:** R1 (count, rows) + R1 (count, columns) · **Layers:** satellite-free, single layer · **Predicted b ≈ −2.0 → Easy** · **Target RT: 30 s**

**Stimulus specification.** All elements: solid circles, size S, arranged per §5.1 count convention.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | 1 solid circle | 2 solid circles | 3 solid circles |
| **R2** | 2 solid circles | 3 solid circles | 4 solid circles |
| **R3** | 3 solid circles | 4 solid circles | **?** |

(4 and 5 circles are arranged as two rows within the cell: 4 = 2+2, 5 = 3+2, top row first, rows centred, to keep counts subitisable.)

**Options.**
- **A:** 4 solid circles
- **B:** 5 solid circles ← **KEY**
- **C:** 3 solid circles
- **D:** 6 solid circles
- **E:** 5 solid squares

**Solution rationale.** Count increases by 1 per column (left→right) and by 1 per row (top→bottom). R3C3 must continue both progressions from 4: **5 circles**. Column check: C3 runs 3, 4, 5 ✓; row check: R3 runs 3, 4, 5 ✓.

**Distractor rationales.**
- **A (IR):** applies the row progression to R3 but reads the step from the wrong reference cell (repeats R3C2's count); satisfies neither final progression step.
- **C (RP):** repetition of R3C1 — the "copy the row's start" naive strategy.
- **D (WR):** wrong rule — assumes the step size itself grows (+1, +2), a common overgeneralisation.
- **E (PM):** correct count, wrong element identity; catches gist-matchers who count without checking the constant shape attribute.

---

### M2 — Arrow rotation progression

**Family:** LRM-ROT · **Rules:** R2 (rotation +45° per column; row offset +90°) · **Predicted b ≈ −1.4 → Easy** · **Target RT: 35 s**

**Stimulus specification.** Every cell: one outline arrow, size M, anchored CTR. Rotation in degrees clockwise from 0° = pointing up.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | arrow 0° | arrow 45° | arrow 90° |
| **R2** | arrow 90° | arrow 135° | arrow 180° |
| **R3** | arrow 180° | arrow 225° | **?** |

**Options.** (all arrows, size M, CTR)
- **A:** outline arrow 315°
- **B:** outline arrow 225°
- **C:** outline arrow 90°
- **D:** outline arrow 270° ← **KEY**
- **E:** hatched arrow 270°

> **Correction (2026-08-14, issue #344's representability check).** Option E was originally "double-headed arrow 270°" — not representable in §5.1's closed shape vocabulary (`ShapeId` has no double-headed-arrow variant, and no element field encodes head count). Corrected to a fill-altered arrow at the same angle, which keeps the intended reading ("correct orientation, but the element looks different — visually louder, attracts candidates matching 'leftward-ness' without checking the fill/style") and is exactly what `src/lib/cognitive/generator/families/lrm-rot.ts`'s own PM distractor already does (a fill-varied option at a shared angle) — that family predates this correction and never used the double-headed-arrow idea.

**Solution rationale.** Orientation advances 45° clockwise per column; each row starts 90° clockwise of the row above (equivalently, orientation = 45°×(column−1) + 90°×(row−1)). R3C3 = 180° + 90° = **270°** (pointing left). Column check: C3 runs 90°, 180°, 270°, a consistent +90° ✓.

**Distractor rationales.**
- **A (WR):** over-rotation — applies +90° (the row step) instead of +45° for the final column step.
- **B (RP):** repetition of R3C2; the "no change" default.
- **C (PM):** the 180°-opposite of the key; mirror confusions are the signature error in mental rotation and this catches direction-of-rotation reversal (anticlockwise application).
- **E (PM):** correct orientation but a hatched fill instead of outline — visually louder, attracts candidates matching "leftward-ness" without checking the fill attribute.

---

### M3 — Distribution of three, two attributes

**Family:** LRM-DIST3×2 · **Rules:** R6 (shape) + R6 (fill) · **Predicted b ≈ −0.7 → Easy–moderate boundary (assigned Moderate band, low end)** · **Target RT: 45 s**

**Stimulus specification.** Every cell: one shape, size M, anchored CTR. Shape set {circle, square, triangle}; fill set {solid, outline, hatched}. Both attributes form Latin squares.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | solid circle | outline square | hatched triangle |
| **R2** | outline triangle | hatched circle | solid square |
| **R3** | hatched square | solid triangle | **?** |

**Options.** (size M, CTR)
- **A:** outline circle ← **KEY**
- **B:** solid circle
- **C:** outline square
- **D:** hatched circle
- **E:** outline triangle

**Solution rationale.** Each row and each column contains each shape exactly once and each fill exactly once. Row 3 lacks *circle* among shapes and *outline* among fills; column 3 also lacks *circle* and *outline*. Unique completion: **outline circle**. Column checks: C3 shapes {triangle, square, circle} ✓, fills {hatched, solid, outline} ✓.

**Distractor rationales.**
- **B (IR):** shape correct, fill wrong — re-uses *solid* from R3C2 (solves the shape distribution, misses the fill distribution).
- **C (IR):** fill correct, shape wrong — re-uses *square* from R3C1 (solves fill, misses shape).
- **D (PM/RP):** exact copy of R2C2; the strongest perceptual lure because it is a circle and sits diagonally adjacent to the gap.
- **E (RP):** copy of R2C1; plausible to candidates who track fills only within columns and mis-carry the shape.

---

### M4 — Figure addition (line superimposition)

**Family:** LRM-ADD · **Rules:** R4 (C3 = C1 ⊕ C2, per row) · **Predicted b ≈ −0.4 → Moderate** · **Target RT: 50 s**

**Stimulus specification.** Elements are bars per §5.1 (H-bar, V-bar, D1-bar, D2-bar), stroke weight 2 px at reference scale, all through CTR. A cell's content is a *set* of bars.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | {H-bar} | {V-bar} | {H-bar, V-bar} |
| **R2** | {D1-bar} | {D2-bar} | {D1-bar, D2-bar} |
| **R3** | {H-bar, D1-bar} | {V-bar, D2-bar} | **?** |

**Options.**
- **A:** {H-bar, V-bar} 
- **B:** {D1-bar, D2-bar}
- **C:** {H-bar, V-bar, D1-bar, D2-bar} ← **KEY**
- **D:** {H-bar, V-bar, D1-bar}
- **E:** {H-bar, D1-bar}

**Solution rationale.** In every row, the third cell is the superimposition of the first two (all bars of both appear; no cancellation — rows 1 and 2 establish this because their operands are disjoint). R3C3 = {H, D1} ⊕ {V, D2} = **all four bars** (an eight-pointed star/asterisk figure). Column check: C3 = C1 ⊕ C2 holds column-wise too: {H,V} ⊕ {D1,D2} = all four ✓.

**Distractor rationales.**
- **A (RP/PM):** copies R1C3 — the most recently seen "combined-looking" cell; also the result of adding only the first elements of each R3 operand.
- **B (IR):** adds only the diagonal components — a partial superimposition that keeps the "X" gestalt of row 2.
- **D (IR):** the near-miss — three of four bars, dropping D2; catches candidates who lose one element during mental superimposition (the canonical addition error).
- **E (RP):** exact copy of R3C1; the no-operation default.

> **Correction (2026-08-14, second copy-elimination pass). The disjoint-operand layout above is solvable by counting, and does not test what it claims to test.** Two measured findings, both over 20 seeds x 8 draws of the operational family:
>
> 1. **The key is the strict maximum-ink option in 141 of 141 items (100%).** The grid's bar counts read 1,1,2 / 1,1,2 / 2,2,? and the key is the only four-bar figure that exists over a four-bar vocabulary. "Pick the fullest tile" scores this family perfectly while extracting nothing about R4. Note this is a *stronger* statement than "counting solves it": there is no four-bar distractor available at all, so no distractor search can blunt the cue.
> 2. **The stated rationale is inverted.** The rationale above argues the disjoint operands establish "no cancellation". They do the opposite: when every operand pair is disjoint, `union` and `symdiff` agree on every cell of the grid *and on the key*, so the cancellation reading is never tested — merely never contradicted. Doc's own M8 (§6) relies on candidates confusing the two operators; M4 as written cannot tell them apart.
>
> **The operational family therefore overlaps every row's operands in exactly one bar.** Rows read 2,2,3 throughout; `union` explains the grid and `symdiff` explains no row; and the "cancellation instead of addition" error becomes a real, distinguishable distractor rather than a duplicate of the key. Construction: index the four bars `[b0,b1,b2,b3]`; row *r* draws from the triangle `T_r` = all four minus `b_{r-1}`, its third cell IS `T_r`, and its two operands are two distinct 2-subsets of `T_r` (any two distinct 2-subsets of a 3-set union to the whole set, so R4 holds exactly). The eight visible cells consume all six 2-subsets and three of the four 3-subsets, leaving exactly one in-vocabulary figure the grid never shows — which is what G-11/G-19 need to be satisfiable at all. A worked instance with `[H,V,D1,D2]`:
>
> | | C1 | C2 | C3 |
> |---|---|---|---|
> | **R1** | {V-bar, D2-bar} | {V-bar, D1-bar} | {V-bar, D1-bar, D2-bar} |
> | **R2** | {D1-bar, D2-bar} | {H-bar, D1-bar} | {H-bar, D1-bar, D2-bar} |
> | **R3** | {H-bar, D2-bar} | {H-bar, V-bar} | **?** = {H-bar, V-bar, D2-bar} |
>
> Options: **A (RP)** copy of R1C3; **B (IR)** copy of R2C3; **C (WR)** symmetric difference of row 3's operands — {V-bar, D2-bar}, cancelling the shared H-bar instead of keeping it, which under the disjoint layout *was* the key and so could never be offered; **D (WR)** {H-bar, V-bar, D1-bar}, the one three-bar figure the grid never shows, reached by superimposing the wrong operand pair. Option element counts are 3,3,3,2,3 — the key's bulk is shared, and gate **G-09** now enforces that (`keyBulkExtremumCheck`).
>
> **Predicted b is unchanged at −0.4**: the radicals (`ruleIds: ['R4']`, `ruleCount: 1`, `crossLayer: false`, `perceptualLoad: 1`, `nearMissCount: 2`) are untouched. No weight and no band cutoff moved — this correction changes what the item *is*, not what it is labelled.

---

### M5 — Figure subtraction (positioned dots)

**Family:** LRM-SUB · **Rules:** R5 (C3 = C1 ∖ C2, per row; C2 ⊂ C1 throughout) · **Predicted b ≈ −0.2 → Moderate** · **Target RT: 55 s**

**Stimulus specification.** Elements: solid circles ("dots"), size S, placed at anchors TL, TR, BL, BR, CTR. A cell's content is the set of occupied anchors.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | dots at {TL, TR, BL} | dot at {TR} | dots at {TL, BL} |
| **R2** | dots at {TL, TR, BR, CTR} | dots at {TR, CTR} | dots at {TL, BR} |
| **R3** | dots at {TL, BL, BR, CTR} | dot at {BL} | **?** |

**Options.**
- **A:** dots at {TL, BR}
- **B:** dots at {TL, BL, BR, CTR}
- **C:** dot at {BL}
- **D:** dots at {TR, BR, CTR}
- **E:** dots at {TL, BR, CTR} ← **KEY**

**Solution rationale.** In each row, the third cell contains exactly the dots of the first cell that do not appear in the second (subtraction; the middle cell "removes" its dots). R3C3 = {TL, BL, BR, CTR} ∖ {BL} = **{TL, BR, CTR}**. Column check: subtraction also holds down columns ({TL,TR,BL} ∖ ... is not the column rule; columns instead satisfy the count consequence 3−1=2, 4−2=2, 4−1=3 consistently with the row rule and admit no rival rule — verified by the accidental-regularity scan, §5.4).

**Distractor rationales.**
- **A (IR):** correct subtraction but drops CTR — losing the centre element during the removal operation is the modal slip because CTR sits visually "inside" the pattern.
- **B (RP):** copy of R3C1 — treats the middle cell as inert.
- **C (RP):** copy of R3C2 — the inverse repetition error (keeps what should be removed, removes what should be kept: a full rule inversion).
- **D (PM):** same dot-count as the key and similar mass distribution, but anchored TR instead of TL; catches approximate/gist matching of "three dots, right-heavy".

---

### M6 — Two rules, cross-layer: shape distribution + inner rotation

**Family:** LRM-2R-XLAYER · **Rules:** R6 (outer shape, distribution of three) + R2 (inner tick rotation, +90° per column, +90° row offset) · **Cross-layer** · **Predicted b ≈ +0.7 → Hard (low end)** · **Target RT: 70 s**

**Stimulus specification.** Every cell has two layers: an **outer outline shape**, size L, CTR (set {square, circle, diamond}); and an **inner tick** — a line segment of length 30 from CTR outward, orientation in degrees clockwise from 0° = pointing up. Tick orientation = 90°×(row−1) + 90°×(column−1), mod 360.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | square, tick 0° | circle, tick 90° | diamond, tick 180° |
| **R2** | circle, tick 90° | diamond, tick 180° | square, tick 270° |
| **R3** | diamond, tick 180° | square, tick 270° | **?** |

**Options.** (outer size L, tick length 30, CTR)
- **A:** circle, tick 270°
- **B:** circle, tick 0° ← **KEY**
- **C:** diamond, tick 0°
- **D:** circle, tick 180°
- **E:** square, tick 0°

**Solution rationale.** Layer 1: outer shapes form a Latin square; row 3 and column 3 both lack *circle*. Layer 2: the tick rotates 90° clockwise per column with a 90° row offset; R3C3 = 180° + 90° + 90° = 360° ≡ **0°**. Key: **circle with tick pointing up**. Column checks: C3 shapes {diamond, square, circle} ✓; C3 ticks 180°, 270°, 0° — consistent +90° ✓.

**Distractor rationales.**
- **A (IR):** shape correct, rotation incomplete — repeats R3C2's tick angle (solves the distribution, stalls the rotation).
- **C (IR):** rotation correct, shape wrong — repeats R3C1's shape (solves the rotation, fails the elimination).
- **D (PM):** circle with tick 180° reproduces R3C1's tick inside the correct shape — a chimera of the two nearest cells that looks locally "consistent with the row".
- **E (RP):** copies R3C2's shape with the correctly rotated tick; catches candidates who finish the rotation rule then grab the adjacent shape instead of running the elimination.

> **Correction (2026-08-14, issues #346/#344).** The table above, as originally written, contains a genuine duplicate: (1,3), (2,2) and (3,1) are all "diamond, tick 180°" — a 90° tick step on a 3×3 grid aliases whenever `(row−1)+(col−1)` (or its difference, depending on step signs) reaches a multiple of 4, since 90°×4 = 360° ≡ 0°. A duplicated cell hands the solver information for free (one fewer genuinely-distinct cell to integrate), so this exemplar was very likely *easier* than its stated band implies — which is plausibly part of why its stated b (§4.4, below) never reconciled with the formula. The taxonomy is unchanged (R6 shape Latin square + R2 tick rotation, cross-layer) but the tick steps by **45°** per column and **−45°** per row instead of 90°/90° — 45° is doc's own first-listed R2 example (§3), not an invented value, and at that magnitude no two of the 9 cells alias. The corrected table, with the *same key* as before (circle, tick pointing up):
>
> | | C1 | C2 | C3 |
> |---|---|---|---|
> | **R1** | square, tick 0° | circle, tick 45° | diamond, tick 90° |
> | **R2** | circle, tick 315° | diamond, tick 0° | square, tick 45° |
> | **R3** | diamond, tick 270° | square, tick 315° | **?** |
>
> Key: **circle, tick 0°** (unchanged — the solution rationale above still holds verbatim, only the concrete tick angles elsewhere in the grid changed). No two of the 9 (shape, tick) pairs coincide (verified exhaustively in `src/lib/cognitive/generator/families/lrm-2r-xlayer.ts`, which generates every operational sibling of this family the same way).
>
> The distractor set above (A/C/D/E) does **not** carry over unchanged — doc 03-item-generation-pipeline.md §4.5's own repair recipe is tuned to the original 90°-step numbers and, run against the corrected 45°-step grid, still fails gate G-08 (context-blind solvability). The generator's own repair search (same file) finds a gate-clean set for this specific grid by falling back to whole-cell recombination, as it does for many operational siblings:
>
> | Slot | Cell | Label | Mechanism |
> |---|---|---|---|
> | A | square, tick 0° | PM | `copyCell:R1C1` |
> | B | circle, tick 45° | PM | `copyCell:R1C2` |
> | C | square, tick 45° | PM | `copyCell:R2C3` |
> | D | square, tick 315° | RP | `copyCell:R3C2` |
> | **key** | **circle, tick 0°** | — | — |
>
> This set passes G-08 and G-10 (verified directly against `qa/contextblind.ts`). Its options happen to include more perceptual-match whole-cell copies than doc's original IR/IR/PM/RP mix — that is a property of *this specific* grid-safe parametrisation, not a general rule; other siblings the generator draws recover doc's IR/IR/PM/RP shape when it clears the gates for them (see the family file's own worked example).
>
> **Predicted b, recomputed:** with the corrected radicals (`ruleIds: ['R6','R2']`, `ruleCount: 2`, `crossLayer: true`, `perceptualLoad: 1`, and the §4.4 non-cardinal-rotation bonus, since 45° is non-cardinal and the tick is asymmetric): b = −2.0 + (0.9 + 0.3 + 0.3) + 0.5×(2−1) + 0.5×1 + 0.3×1 + 0 = **+0.8 → Hard**, superseding the −2.0…+0.7 figures quoted above the table (see §4.4's own correction note for why the formula, not the hand-typed figure, is authoritative).

---

### M7 — Three rules: shape distribution + fill distribution + count progression

**Family:** LRM-3R-DIST · **Rules:** R6 (shape) + R6 (fill) + R1 (count = column index) · **Predicted b ≈ +1.3 → Hard (top end)** · **Target RT: 85 s**

**Stimulus specification.** Each cell contains N identical elements (N = column index: 1, 2, 3), size S, arranged per §5.1 count convention. Shape set {circle, square, triangle} and fill set {solid, outline, hatched} each form Latin squares over the grid.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | 1 solid circle | 2 outline squares | 3 hatched triangles |
| **R2** | 1 outline triangle | 2 hatched circles | 3 solid squares |
| **R3** | 1 hatched square | 2 solid triangles | **?** |

**Options.**
- **A:** 3 hatched circles
- **B:** 2 outline circles
- **C:** 3 solid circles
- **D:** 3 outline circles ← **KEY**
- **E:** 3 outline triangles

**Solution rationale.** Rule 1: count equals column index — R3C3 needs **3** elements (column check: every C3 cell holds 3 ✓). Rule 2: shape Latin square — row 3 and column 3 both lack *circle*. Rule 3: fill Latin square — row 3 and column 3 both lack *outline*. Unique completion: **3 outline circles**. Full column checks: C3 shapes {triangle, square, circle} ✓; fills {hatched, solid, outline} ✓.

**Distractor rationales.**
- **A (PM):** re-uses R2C2's shape+fill combination (hatched circles) at the right count; the strongest lure for candidates who solve count plus shape and then pattern-match fill from a diagonal neighbour.
- **B (IR):** shape and fill fully correct, count wrong (repeats column 2's count) — isolates failure of the progression rule under load.
- **C (IR):** count and shape correct, fill wrong (*solid* repeats within row 3 and column 3) — isolates failure of the fill distribution.
- **E (IR):** count and fill correct, shape wrong (*triangle* repeats within row 3) — isolates failure of the shape distribution.

This item's distractor set is deliberately dominated by single-rule near-misses (three IR + one PM), which is itself a difficulty radical (§4.1): every wrong option is "almost right", so elimination strategies without full rule induction fail.

---

### M8 — XOR with cross-layer progression

**Family:** LRM-XOR-XLAYER · **Rules:** R7 (inner bars, C3 = C1 △ C2 per row) + R1 (outer polygon sides: 3 → 4 → 5 across each row) · **Cross-layer** · **Predicted b ≈ +2.2 → Very hard** · **Target RT: 110 s**

**Stimulus specification.** Two layers per cell. **Outer:** an outline regular polygon, size L, CTR — triangle (3 sides) in C1, square (4) in C2, pentagon (5) in C3, in every row. **Inner:** a set of bars from {H-bar, V-bar, D1-bar} (§5.1), stroke 2 px, clipped to the polygon interior.

| | C1 | C2 | C3 |
|---|---|---|---|
| **R1** | triangle; inner {H-bar} | square; inner {H-bar, V-bar} | pentagon; inner {V-bar} |
| **R2** | triangle; inner {D1-bar, V-bar} | square; inner {V-bar, H-bar} | pentagon; inner {D1-bar, H-bar} |
| **R3** | triangle; inner {H-bar, D1-bar} | square; inner {D1-bar, V-bar} | **?** |

**Options.**
- **A:** pentagon; inner {H-bar, V-bar} ← **KEY**
- **B:** pentagon; inner {D1-bar}
- **C:** pentagon; inner {H-bar, D1-bar, V-bar}
- **D:** square; inner {H-bar, V-bar}
- **E:** pentagon; inner {D1-bar, V-bar}

**Solution rationale.** Outer layer: sides progress 3 → 4 → 5 left-to-right in every row, so R3C3's contour is a **pentagon** (column check: C3 is pentagon in all rows ✓). Inner layer: each row satisfies the symmetric difference — bars common to C1 and C2 vanish, bars unique to one operand survive. Row 1: {H} △ {H,V} = {V} ✓. Row 2: {D1,V} △ {V,H} = {D1,H} ✓. Row 3: {H,D1} △ {D1,V} = **{H,V}**. Equivalently stated as distribution-of-two: each bar type appears in exactly two cells per row (row 3: H in C1+C3, D1 in C1+C2, V in C2+C3). Key: **pentagon containing a plus-sign (H + V bars)**. Column verification of the XOR down columns: C1 {H}△{D1,V}… columns do not carry the XOR rule; the accidental-regularity scan confirms no rival rule licenses another option, and the two operating rules are each column-consistent in their own terms (polygon identity per column; every bar type appears exactly twice per row — the defining check for R7).

**Distractor rationales.**
- **B (WR):** intersection instead of symmetric difference — keeps only the shared bar (D1), the exact complement of the correct operation.
- **C (WR):** union instead of symmetric difference — keeps everything; the modal error, because addition (M4-style) is the more familiar combination rule and R7 punishes transfer from it.
- **D (IR):** inner bars fully correct, outer layer wrong — repeats C2's square; isolates candidates who solved the hard rule but dropped the easy cross-layer progression (goal-management failure, the signature of very hard items).
- **E (RP):** copies R3C2's inner set inside the correct pentagon — locally plausible chimera of "next contour + last seen interior".

> **Correction (2026-08-14, issues #346/#344).** The table above contains a genuine duplicate: (1,2) and (2,2) are both "square; inner {H-bar, V-bar}" — row 1's C1/C3 operands ({H} and {V}) and row 2's C1/C3 operands ({D1,V} and {D1,H}) both happen to XOR to {H,V}, and the outer shape is constant down each column, so both land on the identical cell. As with M6, a duplicated cell is one fewer genuinely-distinct cell for the solver to integrate, so this exemplar was very likely easier than its stated band implies. The taxonomy is unchanged (R7 symmetric difference on the inner bars, cross-layer with the R1 outer-polygon progression), but the per-cell bar sets are regularised to the construction doc 03-item-generation-pipeline.md's own family file uses: **every** cell carries exactly 2 of the 3 bars (not a mix of 1- and 2-bar cells as above), which is what doc's own "distribution of two" restatement in the solution rationale actually requires (every bar type in exactly 2 of 3 cells per row) — the original table's row 1, with D1 in *zero* cells, did not itself satisfy that restatement. The corrected table, with the **same key** as before:
>
> | | C1 | C2 | C3 |
> |---|---|---|---|
> | **R1** | triangle; inner {H-bar, V-bar} | square; inner {V-bar, D1-bar} | pentagon; inner {H-bar, D1-bar} |
> | **R2** | triangle; inner {H-bar, D1-bar} | square; inner {H-bar, V-bar} | pentagon; inner {V-bar, D1-bar} |
> | **R3** | triangle; inner {V-bar, D1-bar} | square; inner {H-bar, D1-bar} | **?** |
>
> Key: **pentagon; inner {H-bar, V-bar}** (unchanged). Row checks: {H,V}△{V,D1}={H,D1} ✓; {H,D1}△{H,V}={V,D1} ✓; {V,D1}△{H,D1}={H,V} ✓. No two of the 9 (shape, bar-set) pairs coincide — within each column the three bar-sets are the three distinct 2-subsets of {H,V,D1}, each used exactly once (verified exhaustively in `src/lib/cognitive/generator/families/lrm-xor-xlayer.ts`, which proves this by construction rather than by search, for every operational sibling of this family).
>
> Options **B** (intersection, {D1}) and **D** (square; {H,V}) carry over unchanged — both depend only on row 3's C1/C2 pair or on the key's own bars, which are unchanged. Option **E** changes to **pentagon; inner {H-bar, D1-bar}** (R3C2's bars in the corrected table). This particular recombination still does not clear gate G-08 (the centroid scorer recovers the key — the same "further finding" `lrm-xor-xlayer.ts` documents for several of its own parametrisations); it is retained here as the doc-legible illustration doc 03-item-generation-pipeline.md's Appendix A already treats six of the eight exemplars as (context-blind-solvable-as-written, not gate-clean), while the *generator's* own distractor search — which every operational M8 sibling actually goes through — always produces a gate-clean set, falling back to whole-cell recombination when the doc-style construction does not clear it, exactly as documented for M6 above.
>
> **Predicted b, recomputed:** with radicals `ruleIds: ['R7','R1']`, `ruleCount: 2`, `crossLayer: true`, `perceptualLoad: 1` (R1 here is a plain cardinal progression, so the non-cardinal-rotation bonus does not apply): b = −2.0 + (1.6 + 0.0) + 0.5×(2−1) + 0.5×1 + 0.3×1 + 0 = **+0.9 → Hard**, superseding the +2.2 figure quoted above the table — see §4.4's correction note. M8 alone does not reach the very-hard band under the (unchanged) formula; §9 below documents which families do.

> **Second correction (2026-08-14, copy-elimination pass 2). The three-bar vocabulary is too small for this item shape, and the corrected table above inherits the problem.** With 3 shapes and 3 two-bar sets there are exactly 9 distinguishable cells, and the duplicate-free grid plus the key consumes all 9 — which is precisely the pigeonhole `LRM-DIST3X2` was unregistered for. The consequence is not a weak distractor search but a theorem: **while the grid exhausts the vocabulary, every non-key non-copy must carry a feature value appearing in zero visible cells.** Doc's own options B (intersection, one bar) and C (union, three bars) are exactly that, in a grid where every cell shows two bars.
>
> Measured on the operational family, over 20 seeds x 8 draws, with the two-step heuristic *(1) eliminate any option that is a verbatim copy of a visible cell, (2) eliminate any option carrying a feature value that appears in no visible cell*: the key was isolated with certainty in **121 of 121** items for LRM-XOR-XLAYER and **129 of 129** for LRM-XOR-DIST-XLAYER, against 0% for all eight other registered families.
>
> **The operational families now draw their two-bar sets from all four schema bar positions** ({H, V, D1, D2}), not three. C(4,2) = 6 two-bar sets x 3 shapes = 18 distinguishable cells against 9 grid positions, so nine in-vocabulary (shape, bar-set) combinations are always left over and a genuine non-copy always exists. Row *r* draws from a three-bar triangle omitting one bar, and each cell within the row drops one further bar by role, so each row's three cells are the three 2-subsets of its triangle and `C3 = C1 △ C2` still holds exactly, by construction and without search. The full derivation — including why the grid's three bar-set collision pairs always land in different columns (which is what keeps the item duplicate-free under M8's column-only shape rule *and* under LRM-XOR-DIST-XLAYER's Latin square) — is in `src/lib/cognitive/generator/families/xor-bars.ts`. A worked instance with roles `[H,V,D1,D2]`:
>
> | | C1 | C2 | C3 |
> |---|---|---|---|
> | **R1** | triangle; inner {V-bar, D2-bar} | square; inner {D1-bar, D2-bar} | pentagon; inner {V-bar, D1-bar} |
> | **R2** | triangle; inner {H-bar, D2-bar} | square; inner {H-bar, D1-bar} | pentagon; inner {D1-bar, D2-bar} |
> | **R3** | triangle; inner {H-bar, V-bar} | square; inner {H-bar, D2-bar} | **?** = pentagon; inner {V-bar, D2-bar} |
>
> Row checks: {V,D2}△{D1,D2}={V,D1} ✓; {H,D2}△{H,D1}={D1,D2} ✓; {H,V}△{H,D2}={V,D2} ✓. The key's bar-set is also visible at (1,1) — the role map is chosen so the key is *not* the one bar pair the grid never shows, denying a candidate that reading too.
>
> **What this costs the doc-style option grammar.** Doc's B (intersection → one bar) and C (union → three bars) remain the honest names for the two wrong-operator errors, and remain offered; they are simply no longer permitted to be the *only* non-copies. Gate **G-19** now requires at least two options in the key's class under both cues at once, and both families' distractor pools were narrowed to the six in-vocabulary two-bar sets so the requirement is met by construction rather than by luck.
>
> **Predicted b is unchanged at +0.9 (Hard) for M8 and +1.8 (Very hard) for LRM-XOR-DIST-XLAYER.** The radicals are untouched: same rule ids, same rule count, same cross-layer flag, same perceptual load, same near-miss count. Widening the bar vocabulary changes which figures the grid draws, not how many rules a solver must compose — no weight and no band cutoff moved.

---

### 6.1 Matrix blueprint summary

| Item | Rules | Radical profile | Predicted b | Band | Target RT | Key |
|---|---|---|---|---|---|---|
| M1 | R1×2 (count) | 2 trivial rules, 1 layer | −2.0 | Easy | 30 s | B |
| M2 | R2 | rotation, cardinal+45°, 1 layer | −1.4 | Easy | 35 s | D |
| M3 | R6×2 | double distribution, 1 layer | −0.7 | Easy–Mod | 45 s | A |
| M4 | R4 | addition, overlapping operands throughout (see the 2026-08-14 correction under M4 — the disjoint layout was solvable by counting) | −0.4 | Moderate | 50 s | C |
| M5 | R5 | subtraction on anchored sets | −0.2 | Moderate | 55 s | E |
| M6 | R6 + R2 | 2 rules, cross-layer | +0.8 † | Hard | 70 s | B |
| M7 | R6×2 + R1 | 3 rules, near-miss-dominant options | +1.3 | Hard | 85 s | D |
| M8 | R7 + R1 | XOR, cross-layer | +0.9 † | Hard (was mislabelled Very hard) | 110 s | A |

† Recomputed from §4.4's formula per the corrections under M6/M8 in §6 and the OQ-1 resolution note under §4.4 (formula authoritative over the original hand-typed −2.0/+0.7/+2.2 figures). M1 and M2's stated values already matched the formula and are unchanged.

Key positions across M1–M8: A×2, B×2, C×1, D×2, E×1 — within the ±1 tolerance for an 8-item exemplar set; the 18-item operational form balances to A–E ± 1 exactly (§9). With M8 correctly Hard rather than Very hard, **these eight exemplars alone cover no very-hard cell** — §9.1 introduces two new families to fill it (LRM-XOR-DIST-XLAYER, b = +1.8, and LRM-3R-XLAYER, b = +2.20), each built from genuinely more rule content (not a reweighting of these eight).

**Correction, 2026-08-14 — LRM-3R-XLAYER, b +2.35 → +2.20, and its rotation rule rebuilt.** Two defects, both of which made the family's declared three-rule content partly fictional. (a) Its `nearMissCount` was 3, on the strength of a distractor plan carrying one single-axis near-miss per rule. That plan cannot exist: three distractors each wrong on exactly one of three axes leave the key's own value held by 3 of the 5 options on every axis, so the context-blind modal composition reconstructs the key and §5's G-08 rejects the set. Measured, the plan executed 0 times in 300 draws and every item silently fell back to a distractor set of four whole-cell copies. Two single-axis near-misses is the maximum a three-rule item can carry, so `nearMissCount` is now 2 (−0.15). (b) Its rotation rule stepped 45° per column AND 45° per row, making the tick angle a function of `row + col`, which takes 5 values over 9 cells with `row + col = 6` occurring only at the key. The key's angle therefore appeared in no visible cell and the tick alone identified the key in 129/129 items, leaving the two Latin squares — 1.8 of the declared b — doing no discriminating work; declared honestly as the one rule that was load-bearing, the item computed to b = −0.45, `moderate`. The steps now differ in magnitude (45°/column with 135°/row, or the swap), so all eight multiples of 45° appear and the key's angle coincides with R1C1's. Neither change touched a weight or a band cutoff; the family remains `very_hard` on rule content, with 0.70 of headroom over the +1.5 threshold instead of 0.85.

---

## 7. Construct-irrelevant variance controls (figural component)

### 7.1 Reading level
The only text a candidate reads in LR-M is the standing instruction ("Choose the option that completes the pattern"), taught with feedback in the practice phase. No item-level text exists. Instruction text is fixed across all items, Flesch Reading Ease ≥ 70, sentence length ≤ 12 words, no idiom.

### 7.2 Cultural neutrality
Only culture-fair geometric primitives (§5.1). Prohibited: letters, digits (as stimuli), arrows-as-symbols with conventional meanings (e.g. recycling motifs), clock faces, dice-face pip arrangements, playing-card motifs, national or religious symbols, and any element whose familiarity varies by culture or schooling. Reading-direction bias is controlled by the QA rule that every rule must be recoverable column-wise as well as row-wise, and by including reflected clones (incidental variation) in the bank so no scoring advantage attaches to a left-to-right scan habit.

### 7.3 Device and mobile constraints
- Layout is portrait-first: 3×3 grid above a 2–3-per-row option block; the whole item fits a 360×640 CSS-px viewport without horizontal scrolling; grid remains visible while options are scrolled if vertical overflow occurs.
- Vector rendering (SVG) only; no raster stimuli. Minimum on-screen element dimension 8 CSS px; minimum stroke 1.5 CSS px; minimum contrast 4.5:1 against the cell background.
- Option cells are tap targets ≥ 64×64 CSS px with ≥ 8 px separation. A mis-tap must be recoverable: a tap advances to the next item (as in every other single-select format) *only* in sections that allow back-navigation, where Back is the undo; a section with `allow_back_nav = false` falls back to tap + explicit "Confirm". (Revised 2026-08-19 after the Mensa Norway benchmark sitting — originally tap + Confirm unconditionally.)
- Item rendering is deterministic across DPR settings (integer-snapped strokes) so no candidate sees a degraded stimulus.
- Timer pauses on documented connection loss and the item is re-served; response latencies from interrupted exposures are excluded from timing analytics.

### 7.4 Accessibility
- **Colour-blind safety:** colour is never an encoding channel anywhere in the instrument. The three fill states (outline / hatched / solid) differ in pattern and luminance and survive full desaturation. All QA renders are checked in greyscale and under deuteranopia/protanopia/tritanopia simulation.
- **Low vision:** stimuli scale with OS/browser zoom to 200% without loss of layout; the item container reflows rather than clips.
- **Screen readers — honest limits:** figural matrix items measure visual-abstract relation finding; a verbal cell-by-cell description changes the construct (it becomes a verbal working-memory task) and is not a valid accommodation. LR-M items therefore **cannot be made meaningfully screen-reader accessible, and we do not pretend otherwise.** The platform must (a) declare this limitation to clients up front, (b) offer blind and severely visually impaired candidates a documented alternative route (the LR-D component is fully screen-reader compatible, and an individually administered assessment through the client's occupational-health/adjustments process replaces LR-M), and (c) never auto-reject a candidate for an unattempted LR-M under a declared adjustment. This is a legal-compliance point (Equality Act 2010 reasonable adjustments) as much as a psychometric one.
- **Motor accessibility:** full keyboard operability (arrow keys traverse options; Enter confirms); no drag interactions; no double-tap requirements; generous timing policy (§10) with an adjustments multiplier (1.25× / 1.5×) grantable per candidate without item exposure differences.

---

## 8. Deductive component (LR-D): design and sample items

### 8.1 Rationale and belief-bias control

Syllogistic reasoning with meaningful content confounds logic with prior belief: candidates endorse believable conclusions and reject unbelievable ones regardless of validity (belief bias). The control is content that carries **no prior beliefs**: pronounceable nonsense terms (*blicks, stroms, frems*) or neutral administrative tokens. Nonsense terms are screened to be (a) pronounceable under English phonotactics, (b) non-words in major world languages, (c) free of embedded real morphemes, and (d) phonologically distinct within an item (edit distance ≥ 2, different initial letters) so that term confusion cannot masquerade as reasoning failure.

**Existential import instruction (fixed, taught in practice):** *"Assume every group mentioned contains at least one member."* This removes the classical/modern-logic ambiguity around particular conclusions from universal premises, making keys unambiguous.

### 8.2 Item format and language controls

- Two premises (one for rule-application items), each ≤ 10 words, displayed with the question and options simultaneously (no memorisation).
- Question stem is fixed: *"Which statement must be true?"* (or, for rule-application: *"Which situation breaks the rule?"*).
- Four options, each a single short sentence of parallel grammatical structure and near-identical length (±3 words).
- Controlled vocabulary: the only verbs are *are / are not*; quantifiers only *all / no / some / some…not*; no negation stacking beyond one negative per sentence except where the logical form requires *some…are not*.
- Reading level of all fixed text: Flesch ≥ 70. The nonsense terms are the only "hard words", and they are equally novel to every candidate — that is the point.

### 8.3 Distractor grammar (deductive)

- **CNV — illicit conversion:** treating "All A are B" as "All B are A", or converting an O-proposition.
- **OVG — overgeneralisation:** upgrading a particular ("some") to a universal ("all"/"no").
- **UMD — undistributed middle / invalid linkage:** linking terms through a middle term that licenses no link.
- **ATM — atmosphere:** conclusion matches the "mood" of the premises (negative premises → negative conclusion; particular premise → particular conclusion) without being entailed.
- **REV — inverted rule reading** (rule-application items): confusing "if VEX then red" with "if red then VEX".

Exactly one option is entailed; each distractor carries one labelled error. "All/none of the above" is prohibited (§9), and the determinate-key format means no "no valid conclusion" option is ever needed.

---

### D1 — Universal chain (Barbara)

**Form:** AA-1 (All M are P; All S are M ⊢ All S are P) · **Predicted band: Easy** · **Target RT: 30 s**

**Premises.**
1. All blicks are stroms.
2. All stroms are frems.

**Stem.** Which statement must be true?

**Options.**
- **A:** All frems are blicks.
- **B:** Some stroms are not frems.
- **C:** All blicks are frems. ← **KEY**
- **D:** No frems are stroms.

**Solution rationale.** Class inclusion chains: every blick is a strom (P1) and every strom is a frem (P2), so every blick is a frem. Transitivity of the subset relation; the paradigm valid syllogism.

**Distractor rationales.**
- **A (CNV):** illicit conversion of the key — reverses the direction of inclusion; the single most frequent syllogistic error.
- **B (ATM/contradiction):** directly contradicts P2 while borrowing its terms; catches candidates who scan terms without parsing the quantifier.
- **D (ATM):** a negative conclusion from two affirmative premises — impossible; lures candidates who treat unfamiliar terms as implying disjoint categories.

---

### D2 — Undistributed middle with a valid particular

**Form:** premises All A are M; All B are M (no A–B link exists; the only entailments are conversions) · **Predicted band: Easy–moderate** · **Target RT: 40 s**

**Premises.**
1. All daxes are morks.
2. All fenls are morks.

**Stem.** Which statement must be true? *(Remember: every group mentioned has at least one member.)*

**Options.**
- **A:** All daxes are fenls.
- **B:** Some morks are fenls. ← **KEY**
- **C:** Some fenls are daxes.
- **D:** No daxes are fenls.

**Solution rationale.** From P2 with existential import, at least one fenl exists and it is a mork; hence some morks are fenls (valid per-accidens conversion). Crucially, nothing links daxes and fenls: both being morks licenses no relationship between them.

**Distractor rationales.**
- **A (UMD):** the classic undistributed-middle fallacy — merges the two subject classes because they share a predicate.
- **C (UMD):** the particular version of the same fallacy; more tempting than A because "some" feels safer, which is exactly why it is included.
- **D (ATM):** asserts disjointness that is equally unlicensed — catches candidates who correctly sense "no link is proven" but wrongly convert that into a proven negative.

---

### D3 — Universal negative chain (Camestres)

**Form:** All S are M; No M are P ⊢ No S are P · **Predicted band: Moderate** · **Target RT: 45 s**

**Premises.**
1. All quints are pemms.
2. No pemms are varls.

**Stem.** Which statement must be true?

**Options.**
- **A:** Some varls are quints.
- **B:** All varls are pemms.
- **C:** Some quints are varls.
- **D:** No quints are varls. ← **KEY**

**Solution rationale.** Every quint is inside the pemm class (P1); the pemm class and the varl class share no members (P2); therefore no quint can be a varl. Valid universal-negative conclusion.

**Distractor rationales.**
- **A (CNV+ATM):** contradicts the entailment by converting and particularising it; catches candidates who lose track of which class is nested where.
- **B (CNV):** illicit conversion targeting P2's terms — reverses an inclusion that was never asserted in either direction.
- **C (ATM):** the direct contradictory of the key; attracts candidates who default to "some overlap is always possible" and fail to see that here the premises *close off* the possibility.

---

### D4 — Particular affirmative chain (Darii)

**Form:** Some S are M; All M are P ⊢ Some S are P · **Predicted band: Moderate–hard** · **Target RT: 50 s**

**Premises.**
1. Some brins are clets.
2. All clets are drofs.

**Stem.** Which statement must be true?

**Options.**
- **A:** Some brins are drofs. ← **KEY**
- **B:** All brins are drofs.
- **C:** Some drofs are not brins.
- **D:** No clets are brins.

**Solution rationale.** The brins that are clets (at least one exists, P1) are all drofs (P2); hence some brins are drofs. The conclusion inherits the particular quantifier from P1.

**Distractor rationales.**
- **B (OVG):** overgeneralises the particular premise to a universal — the signature quantifier-upgrade error under "all" atmosphere from P2.
- **C (ATM):** matches the particular mood and reuses the right terms, but is not entailed (the premises are silent on drofs outside the clet class); a strong lure because it *feels* modest.
- **D (CNV+contradiction):** contradicts P1 via an illicit negative conversion; catches term-order confusion between subject and predicate.

---

### D5 — Conditional rule application (violation detection)

**Form:** Wason selection logic in forced-choice form: rule "If P then Q"; the violating case is P ∧ ¬Q · **Predicted band: Hard** · **Target RT: 55 s**

**Rule.** Every token marked VEX must be stored in a red container.

**Stem.** Which situation breaks the rule?

**Options.**
- **A:** A token marked VEX is stored in a grey container. ← **KEY**
- **B:** A token marked KOB is stored in a red container.
- **C:** A token marked KOB is stored in a grey container.
- **D:** A token marked VEX is stored in a red container.

**Solution rationale.** The rule is a conditional: VEX → red. It is violated only by a case that is VEX and not red. Option A is exactly P ∧ ¬Q. (Container colours here are *named states in the text*, not visual stimuli — no colour perception is involved; see §7.4.)

**Distractor rationales.**
- **B (REV):** the converse error — reads the rule as "red containers are only for VEX tokens"; the modal mistake in conditional reasoning.
- **C (REV/inverse):** the inverse error — assumes non-VEX tokens are constrained; the rule says nothing about them.
- **D (PM-analogue):** the rule-satisfying case; catches candidates who select the option that *mentions* the rule's terms most completely rather than the one that breaches it.

---

### D6 — Particular negative conclusion (Ferio)

**Form:** No M are P; Some S are M ⊢ Some S are not P · **Predicted band: Hard** · **Target RT: 60 s**

**Premises.**
1. No frems are galts.
2. Some hilps are frems.

**Stem.** Which statement must be true?

**Options.**
- **A:** Some galts are not hilps.
- **B:** Some hilps are not galts. ← **KEY**
- **C:** No hilps are galts.
- **D:** Some hilps are galts.

**Solution rationale.** At least one hilp is a frem (P2); no frem is a galt (P1); therefore that hilp is not a galt — some hilps are not galts. O-conclusions from E+I premises are the empirically hardest determinate syllogisms, which is why this anchors the top of the deductive blueprint.

**Distractor rationales.**
- **A (CNV):** illicit conversion of the key — O-propositions do not convert, and the term swap is nearly invisible when both sentences share the "Some … are not …" frame; the most discriminating distractor at high ability.
- **C (OVG):** overgeneralises the entailed particular to a universal; matches the negative atmosphere of P1.
- **D (ATM):** the contradictory-flavoured affirmative — not entailed and not refuted by the premises, which is precisely the trap: candidates must distinguish "must be true" from "could be true".

### 8.4 Deductive blueprint summary

| Item | Logical form | Error targets | Band | Target RT | Key |
|---|---|---|---|---|---|
| D1 | Barbara (AA-1) | CNV, ATM | Easy | 30 s | C |
| D2 | Undistributed middle + valid conversion | UMD ×2, ATM | Easy–Mod | 40 s | B |
| D3 | Camestres (AE-2) | CNV ×2, ATM | Moderate | 45 s | D |
| D4 | Darii (IA-1) | OVG, ATM, CNV | Mod–Hard | 50 s | A |
| D5 | Conditional violation (P ∧ ¬Q) | REV ×2 | Hard | 55 s | A |
| D6 | Ferio (EI-1) | CNV, OVG, ATM | Hard | 60 s | B |

Keys across D1–D6: A×2, B×2, C×1, D×1 — balanced within tolerance; the 10-item operational form balances A–D to ±1 (§9). Note D4/D5 place the key at A twice in adjacent blueprint rows; the operational form's item ordering must not present two same-position keys consecutively (§9).

---

## 9. Anti-test-wiseness rules (both components)

1. **No "all of the above" / "none of the above" / "cannot be determined" options.** Every item has a determinate key among substantive options (the existential-import instruction in §8.1 is what makes this possible for syllogisms).
2. **Key position balance:** across each operational form, the key appears in each position an equal number of times ±1, with no more than two consecutive items sharing a key position, verified mechanically at form assembly.
3. **Option homogeneity:** within an item, all options share format, visual complexity (matrices: element counts of options differ by at most the amounts the rules themselves make diagnostic; no option is conspicuously busier or sparser than the set), and sentence length (deductive: ±3 words, parallel syntax). The key must never be the longest, most detailed, or most hedged option.
4. **No convergence cues:** the key must not be the option that shares the most surface features with the other options (the "most typical option wins" heuristic is checked and broken at QA by adjusting distractors, never the key).
5. **No giveaway pairs:** no two options may be mutually exhaustive contradictories such that test-wise candidates can discard the other three (checked at QA; where a contradictory pair is pedagogically required, as in D6 B/D, a third strong near-miss must also be present — D6 A — so the pair does not isolate the key).
6. **Distractor plausibility floor:** in piloting, any distractor drawing < 5% of responses in its difficulty band is replaced (it is inert and effectively shortens the option list).
7. **Practice-item honesty:** practice items expose every interaction mechanic (tap, confirm, change answer) so interface familiarity cannot differentiate candidates on scored items.
8. **Exposure control:** operational items are drawn from cloned families (§4) with randomised incidentals per administration, so answer-sharing between candidates transfers poorly; identical sibling items are never served to the same candidate across retests.

---

## 10. Time-pressure policy

**Policy: power-with-limit, explicitly not speeded.** The construct is quality of reasoning under adequate time, not rate of work. Speeded administration would (a) contaminate Gf variance with Gs, (b) amplify anxiety and device-latency effects that hit disadvantaged groups hardest, and (c) invalidate the difficulty model, which assumes items are attempted, not triaged. Time limits exist only to bound the session operationally and are set so the limit is not the effective difficulty driver.

**Setting:** section limit = Σ(per-item target RTs) × 1.25, rounded up, where target RTs are the 80th-percentile design allowances in §6/§8. The pilot (§12) must confirm ≥ 90% of candidates reach the final item of each section with a genuine attempt; if not, limits are raised, not items cut.

| Section | Operational items | Σ target RT (design) | Section limit |
|---|---|---|---|
| LR-M (matrices) | 18 + 2 practice | ≈ 19 min | **24 minutes** |
| LR-D (deductive) | 10 + 2 practice | ≈ 8 min | **10 minutes** |
| **Whole test** | 28 scored | | **34 minutes + instructions (~4 min) ≈ 38 minutes** |

Per-item soft pacing: a progress indicator shows items remaining and section time remaining; there is **no per-item countdown** (per-item clocks induce speeded behaviour item-by-item, which is the contamination the policy exists to prevent). Items may be flagged and revisited within a section. Response latencies are logged per item for calibration analytics and rapid-guessing detection (RT < 3 s on matrices, < 4 s on deductive, flags the response for the aberrance analyses in §12; it does not affect the candidate's score in the operational scoring rule).

Adjusted timing (1.25× / 1.5×) is available through the accommodations route (§7.4) and is recorded as a test condition, never visible to hiring reviewers.

---

## 11. Scoring and reporting (design intent)

- Item scoring: dichotomous. Calibration model: 2PL (matrices and deductive calibrated separately); a Rasch fit is reported alongside for the item bank's cloning logic, since family-level difficulty transfer is cleanest under Rasch assumptions.
- Reported scores: LR-M theta, LR-D theta, and the 70/30 composite (§2), transformed to a standard scale (T-scores against the calibration reference group) with confidence bands displayed wherever a point score is displayed.
- No subscale narrative claims (e.g. "strategic thinker") are ever generated from these scores; the report states what was measured (inductive and deductive reasoning with abstract material) and the comparison group, nothing more.
- Until §12 is complete, any exposure of scores to clients must carry the label **"pilot — not for selection decisions"** enforced at the product level, not by convention.

---

## 12. Empirical validation requirements

**These are draft blueprints. No item in this document has been administered to a single candidate. Nothing here is validated, and nothing here may be used, marketed, or described as validated, norm-referenced, or predictive until every stage below is complete and documented.** The design-stage difficulty predictions (§4.4, §6, §8) are hypotheses to be tested, not properties of the items.

### Stage 1 — Cognitive pre-pilot (n ≈ 20–30)
Think-aloud protocols on all 14 exemplar items plus first-wave clones, sampled across education levels and including EAL candidates. Purpose: confirm instructions are understood from practice items alone; confirm distractors are being selected *for the designed reasons* (error labels in §5.3/§8.3 versus verbalised strategies); catch ambiguous renderings, unintended solution paths, and any residual verbal load. Revise before Stage 2.

### Stage 2 — Calibration pilot (n ≥ 500 per component; n ≥ 1,000 preferred for stable 2PL slopes)
Administer the full drafted bank (target: 6–10 clones per family, ≈ 120 matrix and ≈ 60 deductive items) in linked, counterbalanced booklets under operational conditions (unsupervised, mobile-permitted, power-with-limit timing). Analyses:
- 2PL and Rasch calibration; item fit (infit/outfit 0.7–1.3 or flagged); slope floor a ≥ 0.8 for retention.
- **LLTM / radical-regression:** regress calibrated b on the §4.1 radicals. R² ≥ 0.6 validates the difficulty model and licenses clone-based bank expansion; below that, the radical weights (§4.4) are revised and the blueprint re-issued.
- Distractor analysis: option-level trace lines; replace inert (< 5% in band) or key-competing distractors.
- Timing analysis: confirm the not-speeded criterion (≥ 90% genuine completion; item RT distributions stable across serial position); adjust section limits if violated.
- Dimensionality: confirm the two-factor (I, RG) structure with a correlated-factors or bifactor model; the 70/30 composite weighting is revisited against the factor solution.

### Stage 3 — DIF screening (within Stage 2 sample, minimum 200 per focal group)
Mantel–Haenszel and IRT-based DIF (Lord's chi-square / Raju's area) by sex, age band (≤ 30 / 31–45 / 46+), ethnicity (as legally collectable per jurisdiction), EAL status, and device class (phone vs desktop — a Trajectas-specific fairness obligation given mobile administration). Items with moderate-or-worse DIF (ETS B/C) are revised or retired; the *radical profile* of flagged items is inspected so DIF causes are removed from the generation scheme, not just from individual items. DIF screening repeats at every bank refresh.

### Stage 4 — Criterion and construct validation (separate studies; n ≥ 300 predictive or ≥ 150 concurrent per study)
- **Convergent/discriminant:** correlations with an established Gf marker (target r ≥ 0.6 disattenuated) and lower correlations with vocabulary/Gc markers (target: significantly lower, confirming the boundary claims in §1.4).
- **Criterion:** predictive or concurrent studies against training performance, job performance ratings, and (for executive use) structured assessment-centre judgement, with range-restriction and criterion-reliability corrections reported alongside observed coefficients. Client-facing validity claims are limited to what these studies show, for the populations they sampled.
- **Retest and alternate-form reliability** across cloned forms (target r ≥ 0.75 retest; alternate-form equivalence within 0.2 SD).

### Stage 5 — Ongoing operational monitoring
Item-exposure and drift monitoring per bank refresh cycle; annual DIF re-screen on accumulated operational data; norm refresh at defined intervals; adverse-impact monitoring (four-fifths analyses) reported to clients using the instrument in selection.

Only after Stages 1–4 are complete, documented, and reviewed may the instrument be released for operational selection use, and its technical manual must report every figure above — including the ones that came out worse than designed.
