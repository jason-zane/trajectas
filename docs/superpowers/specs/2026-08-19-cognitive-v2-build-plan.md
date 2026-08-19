# Cognitive v2 — build plan for a defensible logical reasoning form

**Status: implementation plan, being executed on branch
`feat/cognitive-v2-defensible-form` (2026-08-19).** Inputs: the
distractor redesign spec (`2026-08-19-distractor-redesign-after-first-pilot.md`),
the Mensa Norway benchmark (`2026-08-19-mensa-norway-benchmark.md`, esp.
§5.5, §7, §8), and JH's brief: "the most valid, defensible logical
reasoning test we can build and that I can sit — 24–30 items, time set by
the research — usable commercially." Every implementation agent on this
branch works from this document; where it and the redesign spec differ,
this document wins and says why.

## 0. What "defensible" means here, and what it does not

We can build, now, in code: items whose difficulty comes from their
rules and not from option-set artefacts; a form whose order and mix do
not let a candidate learn a family and reuse it; a difficulty range that
reaches the top of an above-average applicant pool; documented
construction rationale (Carpenter, Just & Shell 1990; Embretson 1998;
Pallentin, Danner & Rummel 2023 [HeiQ]; Schroeders & Walter 2026 [BOLT]);
and clean data capture for calibration. We cannot build in code: norms,
reliability and criterion validity — those need sitters. The deliverable
of this branch is the instrument that makes those sittings worth doing.

No open bank is used as content: every human-normed bank found is
non-commercial or copyleft, and every one is downloadable with its key
(benchmark §8). We borrow HeiQ's distractor-construction rule and BOLT's
Boolean generation; the items are ours, from the seeded generator.

## 1. The option-set contract

Terminology (redesign spec §"The redesign"): a family's rule axes divide
into **cheap** axes — Latin squares and constants on visually dominant
attributes, single-step progressions — and **hard** axes, the rules the
item exists to measure. Families declare the split
(`FamilyTemplate.cheapAxes`); the gates verify it was honoured.

### 1.1 Cheap + hard families (asymmetric contract)

Applies to LRM-2R-XLAYER, LRM-3R-XLAYER, LRM-XOR-XLAYER,
LRM-XOR-DIST-XLAYER. Key + 4 distractors, written as bit-vectors over
(cheap axes | hard axis), 0 = key's value:

```
key   0…0 | 0
D1    0…0 | h1      hard-rule error 1  (IR: stall — the value at the nearest cell in the axis's direction)
D2    0…0 | h2      hard-rule error 2  (WR: wrong step / wrong operator — e.g. row step for column step, OR for XOR)
D3    0…0 | h3      hard-rule error 3  (PM/RP: perseveration or context copy on the hard axis)
D4    c   | h1      incomplete correlate: exactly one cheap axis wrong, hard value SHARED with D1
```

h1, h2, h3 distinct from each other and from the key's value; every
h value must be realised somewhere in the grid (G-19 in-vocabulary).

Consequences, all verified by gates: cheap elimination leaves 4 of 5
(floor 25%, not 50%); the modal composition is D1, not the key; the
centroid is D1 (totals key = 5, D1 = 4); no distractor is a verbatim
copy of a visible cell unless the family can prove ≥ 2 options fall in
the key's copy-class (G-11 unchanged); the hard rule alone *does*
identify the key — accepted, because solving the hard rule is solving
the item (this is the one place the contract deliberately departs from
HeiQ's full balance: HeiQ's operations are comparably hard, ours are
not, and balancing cheap against hard re-creates the leak).

### 1.2 All-cheap families (balanced fractional design)

Applies to LRM-3R-DIST (shape Latin square, fill Latin square, count =
column). None of its rules is hard — it declares all three axes cheap,
so the discount applies and G-20 skips; the structural limit in
`qa/degeneracy.ts` (G-18's header) means no option set can stop a
solver who has two of the three rules. Honest design: the 2³⁻¹
fractional factorial plus the all-wrong corner —

```
key 000   AB0   A0C   0BC   ABC
```

Every axis has the key's value in exactly 2 of 5 options → the modal
composition is ABC (a distractor), the centroid is ABC (total 6 vs 7/9),
one rule leaves 2 (G-18 ≥ 2 holds), two rules leave the key. The family
stays in the bank as a **moderate** item — its band and prior are
corrected (§3), it is no longer counted on for the ceiling.

### 1.3 Single-rule families

PROG-COUNT, ROT, MOVE, ADD, SUB: one axis, cheap-vs-hard does not
arise; plans untouched. They must still pass the re-formalised G-08
(they do — G-08′ is weakly more permissive than G-08).

## 2. Gates

- **G-08′** (`qa/contextblind.ts`): drop `KEY_VALUE_DOMINATES`. Keep
  `CENTROID_RECOVERS_KEY` (unique minimum = key fails). Replace
  `MODAL_RECOVERS_KEY` with an expected-hit-rate bound: compute the
  modal composition(s) as today (per-axis modal values, cartesian
  product over ties); `matched` = the set of options matching any
  composition on every axis it constrains; if `matched` is empty the
  blind scorer guesses among all options; P(hit) = key ∈ matched ?
  1/|matched| : 0; **fail if P(hit) > 0.25**. Reason code
  `MODAL_HIT_RATE`. `repairBalance`'s target selection
  (`mostKeyDominatedAxis`) becomes "the axis where a repair most reduces
  P(hit)" — or is simply left as-is, since with the new contract the
  families no longer call repair; either is acceptable, document which.
- **G-20** — cheap-elimination resistance (new, `qa/degeneracy.ts`):
  applies iff the family declares `cheapAxes` (non-empty). For every
  cheap axis, the number of options carrying the key's value on that
  axis must be ≥ N−1 (4 of 5); the intersection of all cheap-axis
  filters must contain ≥ N−1 options. Fail codes
  `CHEAP_AXIS_ISOLATES` / `CHEAP_INTERSECTION_ISOLATES`. `skip` with
  reason `NO_CHEAP_AXES` when none are declared, and `ALL_AXES_CHEAP` when
  every declared axis is cheap (LRM-3R-DIST: nothing for the invariant to
  protect; G-18 then applies to all its axes). Wired in `qa/index.ts`
  beside G-18/G-19; fails closed at generation like them.
- **G-18** — re-scoped: for families with declared `cheapAxes`, the
  ≥ 2 requirement applies to the cheap axes only (the hard axis may
  isolate; that is §1.1's deliberate property). For families with no
  declaration, unchanged (all declared axes). Header comment updated
  to say why.
- G-11, G-19, G-09, G-10, G-12, G-15: unchanged.
- Batch G-17 (`qa/batch.ts`): unchanged; its documented finding stands.

Numbering: G-20 is new; G-19 already exists (elimination resistance via
cue-chaining). The redesign spec was corrected to say so.

## 3. Difficulty priors

`difficulty.ts` gains a documented **cheap-rule discount**: a rule on a
declared cheap axis contributes half its weight (R6 0.9 → 0.45; R1 on a
cheap axis 0 → 0). Rationale: the pilot showed cheap rules cost seconds,
not induction; the priors are only for ordering the form until real
calibration replaces them (redesign spec: "the current predicted-b
values for multi-rule families are optimistic and must be re-derived").
Effect, approximately: 3R-DIST +1.25 → ≈ +0.35 (moderate); 3R-XLAYER
+2.2 → +1.3; 2R-XLAYER +0.8 → +0.35; XOR-XLAYER +0.9 → +0.9
(its cheap R1 already weighs 0); XOR-DIST-XLAYER +1.8 → +1.35. The
XOR families and the new bit-grid family carry the top of the form.
`item_families.predicted_b` in the DB is NOT refreshed by the ingest
(it leaves existing family rows alone by design); the v2 seed SQL
carries explicit UPDATEs for the four changed families.

Consequence stated plainly: after the discount only LRM-BITS-2OP sits
in the very-hard band (≥ +1.5). The band the two XLAYER families used to
occupy was reached through cheap rules the pilot showed to be seconds of
reading; the test asserting "two families reach very hard" now asserts
the honest figures (`tests/unit/cognitive-generator-difficulty.test.ts`).

## 4. Ceiling family — LRM-BITS-2OP (bit-grid Boolean, BOLT precedent)

Element: a 3×3 **bit-grid** filling the cell; each of its 9 mini-cells
is `empty | black | hatched`. Two independent set-valued layers on the
same lattice: `bits.black` (set of positions 0–8) and `bits.hatched`.
Rules, row-wise (col 3 = f(col 1, col 2)):

- `bits.black`: **R7 XOR** (symmetric difference) — hard.
- `bits.hatched`: **R4 union** or **R5 difference** (family parameter) —
  hard.

Both rules are hard (comparably), so the family declares no cheap axes
and its option set is HeiQ-balanced: key 00, A0 (black wrong: XOR result
minus one position — IR), 0B (hatched wrong: wrong operator — WR),
AB (both wrong — PM chimera from context), A′0 (black wrong a second
way: OR instead of XOR — WR). G-18 (≥ 2 per axis) holds: black correct
in key, 0B → 2; hatched correct in key, A0, A′0 → 3. Modal: black
modal = wrong (3 of 5 wrong: A0, AB, A′0 vary — check per draw), G-08′
verified at generation.

Vocabulary: 2⁹ = 512 values per layer; a 3×3 grid cannot exhaust it, so
the `dist3x2` pigeonhole does not arise. Rendering: mini-cells with a
1-unit gap inside the cell frame; hatched at `hatchPitch`; minimum
mini-cell 8 units (`minElementUnits: 8` at canvas 100 → 3 × 8 + gaps
fits). Density gate (G-15) must accept ~50% ink. Predicted b (formula):
−2.0 + 1.6 (R7) + 0.8 (R4/R5) + 0.5 (2 rules) + 0.5 (cross-layer) +
0.3·2 (perceptualLoad 2) ≈ **+2.0**, very hard — the ceiling the pilot
form lacked. Also register the single-layer **LRM-BITS-XOR** (R7 only,
perceptualLoad 2, ≈ +0.2, moderate) as the family's on-ramp so the
format is not first met at the ceiling.

Element schema: `{ type: 'bitgrid', layer: 'outer', black: number[],
hatched: number[] }` with positions 0–8, disjoint sets. Axes
`bits.black`, `bits.hatched` are set-valued (`{ t: 'set' }`), so
`readAxis`/`axisEq`/`cellComplexity` need a case; the content hash
covers it automatically via the spec.

## 5. Form v2

- **24 scored items + 3 practice, 30 minutes** (75 s/item — HeiQ-S's
  validated pace of ≈1:15/item; our pilot's 90th-percentile item time
  was 2:15). Parametric: `SCORED_ITEMS`, `SECTION_MINUTES` in the seed,
  so 28/35 or 30/37 is a one-line change.
- **Ordering:** by predicted b ascending, with **no two adjacent items
  from the same family** (a deterministic interleave: sort by b, then
  swap forward the first later item of a different family whenever two
  neighbours collide).
- **Practice:** LRM-PROG-COUNT ×3, unscored, and **PROG-COUNT is not in
  the scored section** (round 1 pre-taught positions 1–2).
- **Composition (24):** ROT 3, MOVE 3, ADD 3, SUB 3, BITS-XOR 2,
  2R-XLAYER 2, 3R-DIST 2, XOR-XLAYER 2, XOR-DIST-XLAYER 2, 3R-XLAYER 2,
  BITS-2OP 2 — nine families across the scored section, roughly 12
  single-rule / 12 multi-rule, spanning ≈ −1.4 … +2.0.
- **Options:** 5 (six is a stretch step, §7).
- **Runner:** tap advances, Back revises (`allow_back_nav = true`, PR
  #367); countdown visible; instructions say what a tap does.
- **Assessment:** a NEW internal pilot assessment "Figural Matrix
  Reasoning — Internal Pilot v2" (`internal_pilot = true`), delivered by
  a new internal campaign; v1 stays as the round-1 record.
- **Bank:** regenerated from a fresh seed with the new generator; v1's
  98 items stay (draft, only ever served inside v1).

## 6. Verification before hand-over

1. Unit + architecture tests green; the family smoke test covers the new
   and re-authored families.
2. Battery statistics over ≥ 20 seeds × 8 draws per family: accept rate,
   per-gate reject tallies, and the **shortcut measurements** the
   previous session used (single-cheap-rule survivors, blind modal hit
   rate, copy isolation) — all reported in the PR.
3. Rendered SVGs of ≥ 2 items per family inspected visually (converted
   to PNG), including the bit-grid legibility at 140 px cells.
4. CI green; PR merged; bank ingested to production; pilot v2 seeded;
   flag/instructions applied.
5. Hand-over note: how to sit it, what to record, what the second sitting
   is for.

## 7. Deferred (explicitly)

- **Six options** (guess floor 20 % → 16.7 %; post-elimination 25 % →
  20 %): mechanical but wide (schema slot enum, `placeOptions`,
  key-slot round-robin, every family's fifth distractor, review UI,
  tests). Do it after the above lands, as its own PR.
- **Constructed-response format** (OMIB/DESIGMA): the strategic
  alternative that removes the option-set problem entirely; design
  spike after the v2 re-pilot, not now.
- **Stroke-set family** (Ex 28/35-style): second ceiling family after
  BITS-2OP is piloted.
- **Anchor block:** OMIB's format is constructed-response, so its items
  cannot sit in our option-based runner as-is; ICAR/MaRs-IB need
  permission. Anchoring is a calibration-phase task (hundreds of
  sitters), not a v2 task; the Mensa Norway comparator per sitter stands
  in for now.
- **Norms, reliability, criterion validity:** need sitters. v2 is what
  makes those sittings worth running.
