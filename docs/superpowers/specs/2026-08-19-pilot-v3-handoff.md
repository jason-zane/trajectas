# Cognitive pilot v3 — handoff (six options, twenty families)

**Status: built on `feat/cognitive-v3-six-options-surfaces` (2026-08-19).**
Plan: `2026-08-19-cognitive-v3-build-plan.md`. Predecessors: v2 handoff
(`2026-08-19-pilot-v2-handoff.md`), benchmark (`2026-08-19-mensa-norway-benchmark.md`).

## 1. What changed since v2 — the one-screen version

| | v2 | v3 |
|---|---|---|
| Options | 5 (A–E) | **6 (A–F)**; schema accepts 5 or 6, v1/v2 items keep 5 |
| Families | 12 | **20** (12 re-surfaced + 8 new) |
| Rules | R0–R9 | **R0–R12** (+ reflection, intersection, count arithmetic) |
| Shapes | 6 | **13** (+ hexagon, star, cross, semicircle, flag, L, trapezoid) |
| Fills | 3 | **4** (+ grey) |
| Elements | shape, tick, bars, dots, repeat, bitgrid | + **strokes** (6-kind line figures), **nest** (concentric containers) |
| Orientation | rotation | + **flip** — the eight D4 states, so a reflection-only item has 5 wrong orientations |
| Form | 24 + 3 practice, 30 min | **28 + 3 practice, 35 min**, three tiers (7 / 9 / 12), round-robin inside a tier |
| G-20 floor | ≥ N−1 after cheap elimination | **≥ max(4, N−2)** — the 25%-guess floor v2 set at N=5, kept as an absolute floor |
| G-17 | hits === 0 | **expected blind hits ≤ chance over the batch** (an all-distinct option set ties the scorer at 1/6) |

The visual change JH asked for is real: MIRROR (flag/L/trapezoid mirrored
about four axes), STROKE-XOR (frameless line figures), NEST-ADD
(concentric containers), CORNER-XOR (corner marks + centre shape),
DOTS-AND (five-anchor dots, intersection), SUM / FILL-COUNT (repeated
small shapes with arithmetic / progression), FILL-ROT (one glyph turning
and filling), plus hexagon/star/cross sets and glyph variety in the old
families. Contact sheets: `var/v3-families/<code>.html` (per family, 12
samples) and `var/v3-bank/preview.html` (the whole seed-v3 bank).

## 2. The v3 family set, measured (20 seeds × 8 draws each)

| code | rules (cheap / hard) | surface | prior b | accept | max P(blind hit) |
|---|---|---|---|---|---|
| LRM-MIRROR | R10 reflection (op pair over h/v/d1/d2) | one asymmetric glyph, size L | −1.5 easy | 0.99 | 0.167 |
| LRM-FILL-ROT | R6 fill (cheap) / R2 rotation 45° | one glyph, cross-attribute | −0.45 mod | 0.72 | 0 |
| LRM-FILL-COUNT | R6 fill (cheap) / R1 count | repeat S shapes | −1.05 easy | 0.77 | 0 |
| LRM-SUM | R6 shape (cheap) / R12 sum·difference | repeat S shapes | +0.10 mod | 0.93 | 0 |
| LRM-DOTS-AND | R11 intersection | five-anchor dots | −0.75 mod | 0.84 | 0.167 |
| LRM-CORNER-XOR | R6 shape (cheap) / R7 XOR on corners | corner marks + centre shape | +1.35 hard | 1.00 | 0.167 |
| LRM-STROKE-XOR | R7 XOR | strokes, no frame | +0.35 mod | 1.00 | 0.167 |
| LRM-NEST-ADD | R4 union | nested containers | −0.75 mod | 1.00 | 0 |
| (twelve v2 families, re-surfaced, six options) | | | | 0.41–0.97 | ≤ 0.167 |

Priors are ordering priors under the cheap-rule discount (difficulty.ts);
MIRROR and NEST-ADD take OQ-3's `permitKeyEqualsCell` (small finite
orbits: eight orientations / seven ring subsets over eight visible cells
— MOVE's precedent). All 2,292 unit + architecture tests pass; the bank
for seed `v3-2026-08-19` × 12/family is 218 items, key slots 37/37/36/36/36/36.

## 3. Form v3 (seed-pilot-v3-assessment.sql)

28 scored + 3 practice (PROG-COUNT, practice-only), 35 min (75 s/item):
- tier 1 (7): MIRROR 2, ROT 2, FILL-COUNT 2, MOVE 1
- tier 2 (9): SUB, NEST-ADD, SUM, DOTS-AND, ADD, FILL-ROT, 2R-XLAYER, 3R-DIST, STROKE-XOR × 1
- tier 3 (12): BITS-XOR, XOR-XLAYER, CORNER-XOR, XOR-DIST-XLAYER, 3R-XLAYER, BITS-2OP × 2, BITS-2OP last in order

Round k inside a tier = the k-th item of every family, so no two adjacent
items share a family and the form ends on the two ceiling items without
placing them next to each other. Assessment `b3…0003`, sections
`b4…0005/0006`, campaign `b5…0003` (`figural-matrix-pilot-v3-internal`).

## 4. Production steps (in this order — the renderer must know the new elements before items that use them are served)

1. Merge the PR; wait for the Vercel production deploy.
2. Apply `supabase/migrations/20260819120000_figural_matrix_six_options.sql`
   (response-format label/config; data-only, idempotent).
3. Ingest seed `v3-2026-08-19`, 12 per family — `/item-bank/generate`, or
   the ingest pathway replayed through the Supabase MCP (same
   `ingestGeneratedBank` logic; the store records the writes).
4. Run `scripts/cognitive/seed-pilot-v3-assessment.sql`; check the sanity
   report at its foot returns 3 + 28 rows.
5. Add a participant to campaign `b5…0003`; visit `/assess/<access_token>`.

## 5. Sitting guidance (unchanged from v2)

35 minutes, six options, tap advances, Back revises. Record the sitting
time and the per-item times; the analysis to re-run is benchmark doc §3
(first-of-family misses, time per rule count) plus the v3 question: do
the new surfaces change error patterns (reflection vs rotation; stroke
figures vs framed figures)? Two or three sitters with Mensa comparators
remain the target before any norming claim.

## 6. Deferred (plan §6/§7)

Overlay with occlusion, shape distortion, ternary operations, 2×2 and
series formats, constructed response; a second very-hard family
(STROKE-2OP); automatic rendering-size bump (stroke 2.4) once the contact
sheet is judged at delivery size; technical-note body
(`2026-08-19-cognitive-technical-note.md` holds the skeleton).
