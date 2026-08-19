# Mensa Norway benchmark — first comparator sitting (2026-08-19)

**Status: analysis of one sitting, n = 1. Feeds the distractor redesign and
the next pilot form. Nothing here is a norm.**

The benchmarking plan in the round-1 handoff named Mensa Norway
(test.mensa.no) as the closest-format comparator: 35 figural matrices,
25 minutes, six options, IQ-scaled result. JH sat it on 2026-08-19, one
day after the internal pilot sitting (18/24, session `5d2a52e1`), and
screenshotted 30 of the 35 items plus the result page. This note records
what the sitting says about (1) where our pilot's 75% actually sits,
(2) how a mature matrix test is built, item by item, and (3) what to
change in the next form. It also surfaces one finding from re-reading
our own pilot data that the handoff missed.

Provenance: screenshots are in JH's local folder `~/Desktop/Mensa Test/`
and are **not** committed — they are Mensa Norway's copyright, and this
repo is public. Item descriptions below are deliberately kept at the
level of format and rule *type*; no answers, no cell-by-cell content.
Item analysis was done by a three-solver panel (catalogue, blind
re-solve, adjudication on disagreement); the panel's per-item rule
readings are more reliable on the early items (clean — unanimous and
unflagged — on 7 of the 12 before item 17) than on the late ones (clean
on 5 of the 18 from item 17 on), which is a data point about those items
in its own right.

## 1. Headline

- **Result: IQ 118, reported as the 88th percentile (SD 15).** Started
  ≈10:15:38, finished 22:54 later with ~2 minutes to spare; all 35
  attempted; JH reports guessing from roughly item 28–30, "a bit
  distracted", finding it "challenging around 20–22" and "really
  difficult from 28–30".
- **Raw score is not shown and the raw→IQ table is unpublished.**
  Best triangulation puts IQ 118 at **≈24–28 of 35 correct (69–80%)**
  (§2). Treat as a band, not a number.
- **Our pilot: 18/24 (75%) — but the item-level record says that number
  is inflated twice over**, not once, by two independent mechanisms with
  separate fixes. The known distractor leak (handoff finding 4; an
  option-set problem, fixed by the redesign spec) is one. The other, new
  here, is a form-construction problem: **the form was blocked by
  family, and five of the six misses were the first item of a family
  block** — items 2–3 of each block look like rule *reuse*, not
  induction (§3.3). Mensa never presents the same format twice in a
  row.
- **The Mensa items span a difficulty range ours does not reach.** An
  88th-percentile-on-Mensa candidate ran out of ability on Mensa around
  item 28 of 35; on our form the same candidate answered all four
  3-rule items (b = +1.25 and +2.2, the latter the hardest on the form)
  in 3.5–12 s each and got all four right. Under a 1PL with θ ≈ +1.2 and
  the declared priors, expected correct on those four is ≈1.5, not 4 —
  and the count matters less than the pace, which is surface-matching
  speed, not three-rule induction (§3.2). Either the priors are wrong
  or the items are not measuring what they claim; the leak spec already
  says which.
- **Design lessons worth copying (§5):** continuous difficulty ramp with
  format variety at every step; six options; a wide *surface* vocabulary
  (segments, bit-grids, nested containers, positional layouts) rather
  than more rules; a persistent countdown; review-and-revise within the
  section. **Not worth copying (§6):** undisclosed norms, the 85–145
  clamp, and top-end items whose difficulty comes partly from
  under-determination.

## 2. What "IQ 118" means in raw terms

Facts from the test itself (result page, test page, Mensa International
mirror): 35 items, 25 min, one point each, no guessing penalty, no speed
bonus, output clamped to 85–145 with SD 15, "an indication" only. The
norm sample is undisclosed and self-selected (people who seek out an
online IQ test); Norsk Mensa says it is still collecting data to widen
the range. Nothing published on item parameters, reliability, or
validity against supervised instruments.

Three independent routes to a raw score for 118:

| Route | Raw estimate | Basis |
|---|---|---|
| Linear inversion (research agent) | ≈23–25 | Assume 0→85, 35→145 roughly linear with mean ≈17–18; z = 1.2 for 118 (the page's "88th percentile" is z ≈ 1.175 — it rounds) |
| Community table (Japanese review, note.com) | ≈27–28 | 18–20 → ~100; 24–26 → ~110; 28–30 → ~120; 32–33 → ~130; 34–35 → 140+ |
| Anecdote (HN, 2022) | ≈26–29 | "hit 118 but ran out of time around question 32" on a first attempt; 133 on a practised retake |

Working band: **24–28 correct, 69–80%.** The community table is the only
one with multiple anchor points and is consistent with the anecdote, so
the upper half of the band is more likely than the lower.

Caveats that matter for the comparison: (a) 88th percentile is of
Mensa's own online sample, which skews above the general population —
so θ on population norms is, if anything, higher; (b) unsupervised, and
JH reports distraction; (c) 25 minutes for 35 items is a speeded power
test — some of the "guessing from 28" is clock, not ceiling.

## 3. Our pilot against it

### 3.1 The comparison the handoff asked for

| | Mensa Norway | Our pilot (24 scored) |
|---|---|---|
| Proportion correct | ≈69–80% (est.) | 75% |
| Nominal time / item | 43 s | 75 s |
| Time actually used | 22:54 of 25:00 (39 s/item) | 17:12 of 30:00 (43 s/item) — then 13 min on a wedged finish screen |
| Longest single item | ≈1:48 (item 24, upper bound) | 2:36 (pos 9), 2:19 (pos 18), 2:13 (pos 17) |
| Where the candidate was beaten | ≈item 28 of 35 | only by the XOR families (1/4); the 3-rule Latin-square families (4/4 in 3.5–12.1 s) never tested him — see below |
| Options | 6 | 5 |
| Guess floor (single item) | 16.7% | 20% (before the leak; 33–50% after it, per the redesign spec) |

Read naively, "75% on ours ≈ 75% on Mensa" looks like agreement. It is
not, because the two 75%s are made of different things: Mensa's is a
candidate climbing a ramp until it beat him; ours is a candidate who was
never beaten and lost points where he should not have.

### 3.2 The item-level record of the pilot (production, session `5d2a52e1`)

Scored section 22:05:17–22:35:17 UTC, 30:00 limit, expired via the
client timer; every answer was in by 17:12. (The handoff's "round 1 ran
out of clock at item 21" is not what the record shows: the remaining
12:48 was the wedged finish screen of finding 1, not item time — the
30-minute limit was never the constraint.) Latencies are server-gap
(`participant_item_outcomes.response_time_ms`); positions 21 and 22
share an `answered_at` (batched save), so their split is unreliable.

| pos | family | rules | b | outcome | latency (s) | note |
|---|---|---|---|---|---|---|
| 1 | PROG-COUNT | 1 | −2.0 | ✓ | 5.1 | same family as the 3 practice items |
| 2 | PROG-COUNT | 1 | −2.0 | ✓ | 4.2 | |
| 3 | MOVE | 1 | −1.4 | **✗** | 35.2 | first of block |
| 4 | MOVE | 1 | −1.4 | ✓ | 80.0 | |
| 5 | MOVE | 1 | −1.4 | ✓ | 54.9 | |
| 6 | ROT | 1 | −1.4 | **✗** | 16.5 | first of block |
| 7 | ROT | 1 | −1.4 | ✓ | 75.7 | |
| 8 | ROT | 1 | −1.4 | ✓ | 7.9 | |
| 9 | SUB | 1 | −0.9 | **✗** | 155.9 | first of block; longest item of the sitting |
| 10 | SUB | 1 | −0.9 | ✓ | 69.7 | |
| 11 | SUB | 1 | −0.9 | ✓ | 12.6 | |
| 12 | ADD | 1 | −0.9 | ✓ | 25.6 | first of block |
| 13 | ADD | 1 | −0.9 | ✓ | 36.1 | |
| 14 | ADD | 1 | −0.9 | ✓ | 22.7 | |
| 15 | 2R-XLAYER | 2 | +0.8 | ✓ | 47.0 | first of block |
| 16 | 2R-XLAYER | 2 | +0.8 | ✓ | 62.5 | |
| 17 | XOR-XLAYER | 2 | +0.9 | **✗** | 133.2 | first of block |
| 18 | XOR-XLAYER | 2 | +0.9 | ✓ | 138.8 | |
| 19 | 3R-DIST | 3 | +1.25 | ✓ | 10.1 | first of block; leaky family (spec: key identified by shape+fill) |
| 20 | 3R-DIST | 3 | +1.25 | ✓ | 12.1 | |
| 21 | XOR-DIST-XLAYER | 2 | +1.8 | **✗** | 10.9 | first of block |
| 22 | XOR-DIST-XLAYER | 2 | +1.8 | **✗** | (0, rapid_guess) | |
| 23 | 3R-XLAYER | 3 | +2.2 | ✓ | 11.9 | first of block; leaky family |
| 24 | 3R-XLAYER | 3 | +2.2 | ✓ | 3.5 | |

By rule count: 1-rule **11/14 (79%)**, 2-rule **3/6 (50%)**, 3-rule
**4/4 (100%)**, at 3.5–12.1 s each. That inversion is the leak, measured.
With θ ≈ +1.2 (from the Mensa 88th percentile) and the declared priors,
a 1PL predicts P(correct) ≈ 0.49 at b = 1.25 and ≈ 0.27 at b = 2.2 —
about 1.5 of those 4 items, not 4 of 4; P(all four) ≈ 0.02. The count
alone is not decisive at n = 1: if θ is really +1.5 the expectation is
≈1.8, at +2.0 it is ≈2.3, and a lucky 4/4 is possible. What the count
cannot explain is the *latency* — 3.5–12.1 s per item is not the pace of
someone inducing three rules and checking five options; it is the pace
of surface matching, which is exactly the shortcut the redesign spec
describes for these two families. Conversely at b = −1.4 the model
predicts ≈ 0.93, and the observed rate on MOVE/ROT was 4/6.

### 3.3 The finding the handoff missed: family blocking

The form was ordered by predicted b, and because each family has one
prior, that produced blocks of 2–3 consecutive items from the same
family. Five of the six misses — positions 3, 6, 9, 17, 21 — are the
**first item of a family block.** Excluding positions 1–2 (whose family
had just been taught by the practice items) and the two leaky families:

| | first item of block | later items in block |
|---|---|---|
| positions | 3, 6, 9, 12, 15, 17, 21 | 4, 5, 7, 8, 10, 11, 13, 14, 16, 18, 22 |
| correct | **2 / 7 (29%)** | **10 / 11 (91%)** |

And the latency profiles inside the single-rule blocks read like
learning curves: MOVE 35 ✗ → 80 ✓ → 55 ✓; ROT 17 ✗ → 76 ✓ → 8 ✓;
SUB 156 ✗ → 70 ✓ → 13 ✓ — the rule induced (and got wrong) on item 1,
applied slowly-and-correctly on item 2, applied from memory on item 3.

That is the reading most consistent with the data; it is not proven by
it. Rival explanations that fit parts of the pattern: the first
exemplar of each family may simply be harder than its siblings
(position 9 and position 12 share b = −0.9 and split ✗/✓); position 22
(second in its block) was also missed; and the "not saving properly"
banner was on screen throughout. Whichever mechanism dominates, the
form-construction fix below is the same and costs nothing, and the
interleaved re-pilot decides it.

Consequences, in order of how much they matter:

1. **Items 2–3 of each block are not independent measurements.** For
   calibration this is local dependence of the worst kind — it makes
   the later items in a block look easier than they are and will bias
   every b estimated from a blocked form downward. How many independent
   measurements the pilot really contains is not something n = 1 can
   say; a re-pilot on an interleaved form can.
2. **The three "suspect easy-middle items"** in the handoff (positions
   3, 6, 9) may not be suspect at all: they were the induction cost of
   each new family, paid once. Still worth eyeballing in
   `/item-bank/review` (the 156 s on position 9 is a genuine struggle,
   not a lapse), but the prior explanation is now the block position.
3. **Positions 1–2 measured nothing**: PROG-COUNT had just been taught
   by three practice items of the same family.

Mensa never repeats a surface twice in a row (§5.1); every item is a
fresh induction. n = 1, but the effect is large, has a mechanism, and is
cheap to design out: order by b **with a no-adjacent-family constraint**,
and give the practice items their own family that is not scored.

## 4. What the Mensa test looks like, item by item

Screenshots cover 30 of 35 items (missing 4, 5, 7, 14, 18). Elapsed time
is from the sitting start inferred from the visible countdown (07:31 at
item 28, 04:33 at item 31 — both give 10:15:38); "gap" is time since the
previous screenshot, i.e. an upper bound on that item's time (where
items are missing, the gap covers them too). Format descriptions are
coarse by design (see provenance note).

| Ex | elapsed | gap | format / surface | rule types (panel) | rules | diff (1–5) | options left after cheapest rule |
|---|---|---|---|---|---|---|---|
| 1 | 0:36¹ | — | 3×3 sub-grid, one filled cell | 2-D position progression | 1 | 1 | 1 |
| 2 | 0:28 | 28 s | outer frame × inner symbol | constant-in-column × row progression, two layers | 2 | 2 | 2 |
| 3 | 1:07 | 31 s | outer shape × inner mark | constant-row outer, distribution-of-three inner | 2 | 2 | 1 |
| 6 | 1:46 | 39 s² | tiled squares | count progression along rows and columns | 1–2 | 3 | 3 |
| 8 | 2:23 | 37 s² | dot arrangements | count / configuration (panel split) | 2 | 2 | 4 |
| 9 | 3:36 | 73 s | dot + square placement | positional distribution / nesting (panel split) | 2 | 3 | 2 |
| 10 | 4:15 | 39 s | nested triangles | orientation distribution + inner/outer opposition | 2 | 3 | 4 |
| 11 | 4:40 | 25 s | nested containers | layer add/remove progression | 1–2 | 2 | 1 |
| 12 | 5:01 | 21 s | diagonals × grey/black fill | two orthogonal distributions-of-three | 2 | 2 | 1 |
| 13 | 5:30 | 29 s | shape × fill | two orthogonal distributions-of-three | 2 | 1–2 | 1 |
| 15 | 6:19 | 49 s² | arrows + dots | direction distribution + count arithmetic (row sums) | 2 | 3 | 4 |
| 16 | 6:44 | 25 s | arrows, three fills | fill distribution + direction distinctness | 2 | 2–3 | 1 |
| 17 | 7:25 | 41 s | clock-hand angle in frame | angle progression + constant column | 2 | 3 | 1 |
| 19 | 8:16 | 51 s² | mixed shape compositions | composition parity per row (panel split) | 2 | 2–3 | 2 |
| 20 | 8:49 | 33 s | line-built shapes | shape-class progression (panel split; adjudged ambiguous) | 2 | 2–3 | 2 |
| 21 | 10:14 | 85 s | rectangle/bracket pairs | count pattern per row (panel split) | 2 | 2 | 2 |
| 22 | 11:12 | 58 s | two-part cells (top/bottom) | distribution-of-two + count progression + constant column | 3 | 2–3 | 2 |
| 23 | 12:03 | 51 s | three-shape rows with position-fill | distribution-of-three by *position* + fill by position | 3 | 2–5 | 1 |
| 24 | 13:51 | 108 s | radiating line figures | line-count progression + rotation (adjudged ambiguous) | 2–3 | 3–4 | 2 |
| 25 | 14:55 | 64 s | circle clusters, filled/outline | constant count + fill distribution-of-two + positional cluster | 3 | 3–4 | 3 |
| 26 | 15:17 | 22 s | circle + slash + dots | slash orientation distribution + dot count/position progression | 3 | 3–4 | 4 |
| 27 | 16:10 | 53 s | node with line pair | line-angle configuration distribution | 2 | 2–3 | 2 |
| 28 | 17:29 | 79 s | three-stroke line figures (H/V/diag) | stroke-set composition + rotation (adjudged ambiguous) | 3 | 4–5 | 3 |
| 29 | 18:21 | 46 s | squares + vertical line | constant column + fill distribution-of-two + composition | 3 | 3 | 5 |
| 30 | 19:25 | 64 s | dots + squares on a line "spine" | integrated spatial composition + movement (adjudged ambiguous) | 3 | 4 | 4 |
| 31 | 20:27 | 62 s | 3×3 bit-grids of black cells | Boolean composition of bit-grids (XOR/difference reading) | 3 | 3–4 | 5 |
| 32 | 21:13 | 46 s | line + squares + dots | element-type presence + count | 3 | 2–3 | 2 |
| 33 | 21:30 | 17 s | triangle pairs, hatched/outline | fill distribution-of-two + pairwise permutation + orientation | 3 | 3 | 4 |
| 34 | 22:17 | 47 s | filled/hollow dot triads | count + fill distribution-of-two + dot movement | 3 | 3 | 3 |
| 35 | 22:24 | 7 s | open polyline segments | segment-count progression + shape distribution | 3 | 2 | 3 |

¹ Ex 1 was screenshotted on a revisit (after Ex 2). ² Gap includes the
unscreenshotted neighbour(s). Ex 27 was screenshotted twice (revisited at
17:35 for 6 s) — the test permits Previous/Next and review.

Panel agreement: the two blind solvers agreed on 21 of 30; the
adjudicator overrode a unanimous pair on 3 (items 23, 25, 29) and called
7 "genuinely ambiguous" — two options defensible — from its reading (16,
20, 24, 26, 28, 30, 31). Counting any flag: 5 of the 12 items before 17,
13 of the 18 from 17 on. Some of that is a vision model reading small
strokes; some of it is the items. Both readings lead to the same lesson
(§6).

## 5. Design lessons — what to copy

### 5.1 Difficulty is a ramp, and every step is a different surface

Positions 1–13 are single- or double-rule items on high-contrast shapes,
each solvable by one obvious rule (median "options left after the
cheapest rule" 1–2). Positions 15–27 add a second orthogonal rule and
move to less-nameable surfaces (arrows with dots, hands, brackets,
mixed compositions). Positions 28–35 keep the rule count at ~3 but shift
the difficulty into **perceptual decomposition**: line-stroke figures,
bit-grids, positional layouts where the same elements appear in every
cell and only their arrangement carries the rule. The candidate's own
account ("challenging around 20–22, really difficult from 28–30")
tracks that structure exactly, and so does his pace: 30 s items in the
first third, 45–60 s in the middle, 60–110 s in the last third with two
sub-10 s guesses at the very end.

**Adjacent items never share a surface.** Ex 12 and 13 are both
"two orthogonal distributions-of-three" but one is diagonals × grey
fill and the other is shape × fill; the induction has to be redone. This
is the property our blocked form lacked (§3.3).

For us: keep the b-ordering, add the no-adjacent-family constraint, and
— the larger point — **the top of the ramp is a content problem, not a
gate problem.** The redesign spec says the ceiling is out of scope for
the distractor work; this sitting says what the ceiling should be made
of. Candidate new families, in order of how much of Mensa's top-end
they would recover:

1. **Bit-grid Boolean** (Ex 31): 3×3 mini-grid per cell, row rule
   XOR / AND / difference on cells. Same radical as R7 on a surface with
   512 values instead of 16 bar-sets, which is also the direct answer to
   the `lrm-dist3x2` pigeonhole problem (9 cells exhausting the
   vocabulary) noted in `qa/degeneracy.ts`.
2. **Stroke-set composition** (Ex 28, 35, 20): figures built from 3
   strokes drawn from {H, V, /, \}; rules on which strokes are present
   and their arrangement. Difficulty from decomposition, not layers.
3. **Positional distribution-of-three** (Ex 23, 25, 34): same elements
   in every cell, Latin square on *position within the cell*. We have
   `satellite.anchor` (5 positions) — this is a 3-rule use of it.
4. **Count arithmetic across a row** (Ex 15): counts summing to a
   constant / column progression on count of one element type while
   another element type carries a second rule.
5. **Nesting depth as an axis** (Ex 11): container add/remove
   progression. Cheap to render with what `render/` already has.

### 5.2 Six options, and what the option sets look like

Mensa uses six options (guess floor 16.7%). Its distractors are, by
the panel's reading, mostly *near-misses on the item's own rules* plus
one or two surface-plausible foils; the "options left after the cheapest
rule" column shows Mensa **also** leaks the cheap rule on most items —
median 2 survivors. The difference from ours: on Mensa the cheap rule
usually *is* the item (single-rule items dominate the first two thirds),
so the leak costs nothing there; where Mensa gets hard, survivors rise
to 3–5 because the surface no longer affords a cheap rule at all. Ours
carries a per-item rule-count claim (Embretson-style radicals) that the
leak falsifies. So: the redesign spec stands. On top of it, a sixth
option is worth considering at the same time, since it touches the same
code and the runner already lays options out as one flexible row: the
plain guess floor drops from 20% to 16.7%, and if the new contract is
extended from "4 of 5 survive cheap elimination" to "5 of 6" (D1–D4 plus
one more hard-axis violation), the post-elimination floor drops from
25% to 20%. Whether the gate should scale that way is a design choice
for the redesign branch, not a given.

### 5.3 Timing and pacing

- 43 s/item nominal on Mensa; the candidate used 39 s/item and finished
  with 2 min spare — the limit is set so an able candidate *just* gets
  through. Ours (75 s/item nominal, 43 s used) is not the constraint;
  the handoff's proposal of 35–40 min for ~20 items (105–120 s/item)
  would loosen it further. **Recommendation: 25 min for 20 items** —
  it matches the observed 90th-percentile item time (~135 s) with room,
  and keeps the "power with a limit" character. This assumes the next
  form paces like this one; if it carries the new perceptual families
  from §5.1 (bit-grids, stroke sets), check their latencies in the
  re-pilot before fixing the limit.
- **A persistent countdown** in the corner (Mensa: mm:ss, top-left,
  always visible). Ours has `SectionTimer`; make sure the next form
  shows it by default in the scored section.
- **Tap advances, Back revises — decided and built.** Mensa: choosing an
  option moves to the next item; Previous / Next / Finish; after item 35
  an explicit "review your answers or Finish" screen. JH used the
  revisits (Ex 1 and Ex 27). JH's decision (2026-08-19): a cognitive
  item behaves exactly like every other single-select format in our
  runner — the tap advances, and Back is how a slipped tap is corrected.
  Implemented in PR #367: `cognitive` moves to the runner's
  auto-advance set; the pilot's scored section flips to
  `allow_back_nav = true` (the save RPCs already accept revisions when
  the flag is true; no migration); doc 03 §7.3's mis-tap concern is
  kept as a coupling — the tap only advances where Back exists, a locked
  section keeps tap + Continue. What it costs: a revised answer
  refreshes `answered_at`, so the recorded latency for that item is
  time-since-previous-action, not reading time (`ability-session.ts`
  documents this). Not built: the "review or Finish" screen — the last
  answer still completes the section, as it does for every other
  format.

### 5.4 Presentation

Black line art on white, heavy grid borders, a ≈480 px grid (≈160 px
cells) in a 1512 px-wide window, options rendered at cell size in one
row of six with letters above, "Select answer" label, a large "?" in the
blank cell, no colour except fill (black / white / hatched, one grey), no
chrome beyond the timer. Two things transfer directly:

- **Cell size scales with surface.** Bit-grids and three-stroke figures
  need bigger cells than shape × fill items. Our block cap of
  `min(420px, 88vw, 44dvh)` for the whole grid gives ~140 px cells —
  close to Mensa's for today's surfaces; the new families in §5.1 will
  need the cap to be a function of the family's
  `render.minElementUnits`, not a constant.
- **Options are the same size as cells.** Ours already are (round-1
  fix 3). Keep it.

### 5.5 How many items make a useful test

JH's question: is 35 the minimum, 30, 20? The honest answer has two
parts — a formula and a set of published anchors — and both give the
same numbers.

*The formula.* Reliability of a sum score grows with item count by
Spearman-Brown; matrix items typically inter-correlate at r̄ ≈ 0.12–0.20
(single items are noisy). That gives:

| items | α at r̄ = 0.12 | α at r̄ = 0.18 | SEM in IQ points (SD 15) |
|---|---|---|---|
| 10 | 0.58 | 0.69 | 9.7 / 8.4 |
| 15 | 0.67 | 0.77 | 8.6 / 7.2 |
| 20 | 0.73 | 0.81 | 7.8 / 6.5 |
| 25 | 0.77 | 0.85 | 7.2 / 5.8 |
| 30 | 0.80 | 0.87 | 6.7 / 5.4 |
| 36 | 0.83 | 0.89 | 6.2 / 5.0 |
| 48 | 0.87 | 0.91 | 5.4 / 4.5 |

The same story in IRT terms: a well-targeted item (a ≈ 1.2, b near θ)
contributes ≈ 0.25–0.36 information; 20 such items give SEM ≈ 0.45
logits (reliability ≈ 0.80), 30 give ≈ 0.37 (≈ 0.87). Past ~36 the curve
flattens: doubling from 36 to 72 buys ≈ 0.05–0.08 of reliability, for
twice the candidate's time.

*The anchors.* HeiQ (Pallentin, Danner & Rummel 2023; short forms 2024):
48 items α = 0.93, retest 0.88; the 20-item parallel short forms
α = 0.82–0.86 at 25 minutes; the 6-item form is a screener. RAPM Set II:
36 items, α ≈ 0.85–0.90 in adult samples. Mensa Norway: 35 items,
reliability unpublished. MaRs-IB's 8-minute administration (~25 items
at 30 s each) sits lower.

*So:* **~20 good items is the floor for a score you would show a
candidate (α ≈ 0.80, SEM ≈ 6–7 IQ points); 24–30 is where a selection
decision becomes defensible (α ≈ 0.85–0.88, SEM ≈ 5–6); beyond ~36 the
return is small.** Three qualifications that matter more than the count:

1. **"Good" is doing the work.** A leaky item that everyone gets right,
   or a block-position item that measures rule reuse, contributes
   almost nothing — the pilot's 24 items were nearer 10 in information
   terms. Fix the leak and the blocking first; then count.
2. **Targeting beats length.** Information is highest where b ≈ θ. A
   20-item form concentrated between b = −0.5 and +2 measures an
   above-average applicant pool more precisely than a 35-item form spread
   from −3 to +3. This is also why the ceiling matters: without items at
   b ≥ +2 the top of the pool is measured badly no matter how many easy
   items there are.
3. **Reliability is not validity.** A 30-item α = 0.87 form is a
   precise measure of *something*; that it predicts the job is separate
   evidence (criterion validity), and it is the evidence a selection
   product actually needs. HeiQ's r = −0.49 with final-year grades is
   the sort of number to aim at.

For planning: pilot forms of 20–24 items are right for calibration
(they estimate item parameters, not people); the operational form should
be 24–30 items in 25–30 minutes; and the bank behind it needs 3–4× that
for parallel forms and exposure control — the seeded generator makes the
bank the cheap part.

## 6. What not to copy

- **Undisclosed norms and a self-selected sample.** Publish ours: the
  norm group, the n, the sitting conditions, the SEM. It is the one
  thing an unsupervised online test cannot say and a supervised one can.
- **The 85–145 clamp**, and reporting a single IQ with no interval.
- **Difficulty from under-determination.** Whatever share of the
  panel's "genuinely ambiguous" calls on items 16–31 is real, our
  uniqueness gates (G-03/04/05, Level A/B) are the answer to it, and
  they are a selling point: hard because there are more rules, not
  because the one rule is hard to be sure of. Carpenter, Just & Shell
  (1990) made the same point about RAPM — even its hardest items are
  determinate.
- **Retake-ability.** The HN anecdote (118 → 133 on a practised retake)
  is the practice effect the seeded generator exists to defeat. Keep
  every form fresh from a new seed.

## 7. Consequences for the next branch

In addition to the redesign spec as written:

1. **Gate numbering.** The spec's proposed "G-19 — cheap-elimination
   resistance" collides with the existing G-19 (elimination resistance
   via cue-chaining, `qa/degeneracy.ts:363`). The new gate is **G-20**.
   Note also that G-18's header (`degeneracy.ts:447`) already states the
   structural limit the redesign resolves — "no *pair* of rules suffices
   in a 3-rule item is unsatisfiable alongside G-08" — which is exactly
   why G-08's `KEY_VALUE_DOMINATES` has to go.
2. **Form construction:** order by b, no two adjacent items from the
   same family, practice items from a family that does not appear in
   the scored section (or a purpose-built practice family). This is a
   builder constraint, cheap, and it removes a bias from every future
   calibration.
3. **Timing:** 25 min for ~20 items; countdown visible. (HeiQ-S lands
   on exactly this — 20 items, 25 min, ≈1:15 per item.)
4. **Six options** alongside the new option-set contract.
5. **Ceiling content** (§5.1) as its own workstream after the
   redesign is re-piloted — first the bit-grid Boolean family, which
   also retires the `dist3x2` pigeonhole. BOLT (§9) is the published
   precedent: Boolean algebra as the generator, binary-operation count
   as the difficulty driver, N = 7,150.
6. **Second sitting design:** the same candidate cannot re-sit blind
   (he has now seen every family). Recruit 2–3 internal sitters for the
   post-redesign form; run Mensa Norway on them too (25 min, free) so
   each has a comparator score under the same conditions.
7. **Read HeiQ before re-authoring the distractor plans** (§9). Its
   facet-design construction — every distractor is a distinct
   combination of correctly and incorrectly applied operations, every
   figural element appears equally often across the options, so no
   option can be eliminated without solving at least one operation — is
   the published, validated form of what the redesign spec's D1–D4
   contract is reaching for, and its distractors are diagnostic of
   *which* operation the candidate missed, which is exactly the
   per-distractor error label our reviewers see. Adopt its construction
   rule; keep our gates as the verifier.
8. **Anchor block for the re-pilot** (§9): 8–10 OMIB items (item-level
   Rasch parameters on 2,572 applicants; GPLv3 bank) or, with written
   permission, MaRs-IB items, placed as an unscored block in the pilot
   form. That co-calibrates our items onto a scale with real numbers
   behind it and gives each sitter a convergent-validity score without
   a second sitting. Not for the operational form.
9. **Runner interaction — done** (PR #367): tap advances, Back revises;
   pilot section flipped to `allow_back_nav = true`.

## 8. "Could we just use an open-source one?"

JH's question, re-explored 2026-08-19 with a licence-first survey (each
candidate's licence, availability and norms checked against its
primary source by a second agent). Short answer: **not as the delivered
instrument — for two independent reasons — but yes as anchors and as
design references, and two of them change how we should build.**

The two reasons no open bank can be the product: (1) *licence* — every
human-normed bank with published item parameters is non-commercial or
copyleft (table); (2) *exposure* — every one of them is downloadable
with its answer key, which for a selection instrument is disqualifying
regardless of licence. The seeded generator is the answer to both, and
nothing found here replaces it.

| Bank / generator | What it is | Norms / item stats | Licence (primary source) | Use for us |
|---|---|---|---|---|
| **OMIB** — Open Matrices Item Bank (Koch, Spinath, Greiff & Becker 2022, *J. Intell.* 10:41; osf.io/4km79) | 220 figural matrices, six construction rules (add, subtract, XOR, AND, rotation, completeness); **construction-based response** — the candidate builds the answer from 20 elements, no options | N = 2,572 med-school *applicants* (mean age 19); Rasch/IRT item parameters published per item | Bank: **GPLv3** ("free and unlimited access"); paper CC-BY | **Anchor block** for the re-pilot (best available: applicant sample, item-level parameters). Design reference for the response format (see below) |
| **HeiQ** — Heidelberg figural matrices (Pallentin, Danner & Rummel 2023, *J. Intell.* 11:73; short forms 2024, 12:100) | 48 items (+ 20-item parallel forms A/B, 6-item XS), 7–8 options, 2–3 operations per item, **facet-design distractors** so no option is eliminable without solving an operation | N = 767; Rasch-scalable; α .93 (48) / .82–.86 (20); r = .81 with RPM; r = −.49 with school grades | Described as free-to-use for research; formal licence not stated on a primary page — ask before any use of items | **Design reference for the distractor redesign** (§7 item 7). Item use only after asking |
| **BOLT** — Boolean Operations & Logical Thinking (Schroeders & Walter, 2026, *Intelligence*; PsyArXiv 39cbv) | Matrices generated from Boolean algebra (unary/binary/ternary ops); built for upper-ability discrimination in admissions | Studies N = 473 / 430 / **7,150 operational**; Rasch b predicted by binary-op count + perceptual organisation (LLTM R² .55–.74) | Paper; items are an admissions instrument — not open | **Design reference for the ceiling** (bit-grid Boolean family) and for the difficulty model |
| **MaRs-IB** (Chierchia et al. 2019, *R. Soc. Open Sci.*; osf.io/g96f4; Gorilla open materials) | 80 items × 3 shape variants, 4 options, 30 s/item, 8-min form; difficulty = number of visual dimensions | N = 659 (11–33) + 2023 IRT recalibration N = 1,501 adults (b −3.7…+3.5, a .65–1.69) | Blakemore Lab: "academic and **non-commercial** purposes only" | Anchor only with written permission; design reference for the dimensionality→difficulty model |
| **ICAR** matrix reasoning (Condon & Revelle 2014; icar-project.com) | 11 items in ICAR60; 6 options | 2PL parameters from SAPA N ≈ 97k | Data CC0; the *items* are held for non-commercial research behind registration/approval (site not reachable to confirm wording); items are widely exposed | Not for delivery; anchor only with approval |
| **HMT** — Hagen Matrices Test (Heydasch, Haubrich & Renner 2013) | 20 items (6-item short), 8 options | N = 1,339 / 1,572 | "free for **non-commercial** use" (FernUniversität) | No |
| **Sandia** generator (Matzen et al. 2010) | Parametric 3×3 generator + normed matrices; ancestor of ours | 2010 norming tables | Original repo has **no licence file**; a Python port claims BSD-3 with Sandia attribution — unconfirmed at the primary source | Design reference; nothing it does that ours doesn't |
| **RAVEN / I-RAVEN / RAVEN-FAIR / PGM** (ML benchmarks, 2018–21) | Procedural generators; the I-RAVEN and RAVEN-FAIR papers are already the redesign spec's references | Not human-normed | GPL-3 / GPL-3 / MIT / Apache-2 code but **non-commercial dataset** | Design references only (already used) |
| TestMyBrain matrix reasoning (Many Brains Project) | 36-item form | ~80k online sample | Code LGPL-3, stimuli CC-BY-SA 4.0 | Possible anchor (copyleft on derivatives; items exposed) — behind OMIB |
| Not open, stop looking | Raven SPM/APM/CPM (Pearson), Cattell CFIT (IPAT), BOMAT (Hogrefe), WMT-2, SHL/Korn Ferry/Hogan banks | — | Proprietary | — |

Two of these change how we build, not just what we compare against:

- **HeiQ's distractor construction is the answer to our leak, published
  and validated.** Mittring & Rost (2008) showed ~50% of RAPM items are
  solvable by "counting" the options without seeing the matrix — the
  context-blind attack our G-08 targets. HeiQ's fix: for an item with
  operations {A, B, …}, the distractor set is the facet design of
  correctly/incorrectly-applied operations, balanced so every figural
  element appears equally often across options; incorrect applications
  stay visually close to the correct one (same element, wrong position /
  size / orientation). Consequences: no option can be eliminated without
  solving an operation, and each distractor tells you *which* operation
  the candidate got wrong. That is our redesign spec's D1–D4 with the
  authorship rule made explicit, and it comes with α .93 and r = .81
  against RPM. Adopt the construction rule for the five re-authored
  families; keep G-08′/G-20 as the machine verifier that the rule was
  achieved.
- **OMIB's construction-based response format removes the distractor
  problem entirely.** No options → no leak, no context-blind attack, no
  guess floor, and G-08/G-19/G-20 become unnecessary. It is Becker &
  Spinath's DESIGMA format ("Design a Matrix"), and it validated well on
  2,572 applicants. The cost is real: a different task (construction,
  not recognition — correlations with option-based matrices are high
  but not 1), a heavier runner (compose from a palette, on mobile,
  accessibly), and a break from the format every candidate recognises.
  **Not a recommendation for now** — the redesign spec is the right
  next step and it is a week's work, not a quarter's — but it is the
  strategic alternative if the option-set problem keeps resurfacing
  after the redesign is re-piloted, and worth a design spike then.

The remaining honest use is the anchor block (§7 item 8): 8–10 OMIB
items in the re-pilot form, unscored, so our items are co-calibrated
onto a scale that has 2,572 real applicants behind it and each internal
sitter gets a convergent-validity number for free. That is worth more
than any of these banks would be as content.

## 9. Sources

- test.mensa.no result page (screenshot, 2026-08-19 10:38): "Your IQ was
  measured to 118 which is equivalent to the 88 percentile, with a
  standard deviation of 15."
- test.mensa.no test page; mensa.org "Mensa IQ Challenge" (35 items,
  25 min, credits O. H. Dørum for items and scoring).
- mensa.no/iq-test — the supervised Norwegian test is 45 items in 20 min,
  same format ("mønstergjenkjenningstest … matrise").
- iqcognify.com/mensa-norway-iq-test; cognitivetesting.org (2026-05-18)
  on the tests' limits; the 85–145 clamp; no published norms.
- note.com/akane_marika77 (2026-04): community raw→IQ approximation.
- news.ycombinator.com/item?id=31252501 (2022): 118 on first attempt
  running out of time at ~32; 133 on retake.
- Production: `participant_item_outcomes`, `participant_responses`,
  `participant_section_states` for session
  `5d2a52e1-23e5-4a19-b2e8-3832f352108f`; `item_families` for priors.
- Carpenter, Just & Shell (1990); Embretson (1998) — as cited in the
  redesign spec.
- §5.5 / §8: Koch, Spinath, Greiff & Becker (2022), *Development and
  Validation of the Open Matrices Item Bank*, J. Intell. 10:41
  (mdpi.com/2079-3200/10/3/41; osf.io/4km79). Pallentin, Danner &
  Rummel (2023), *Construction and Validation of the HeiQ*, J. Intell.
  11:73 (mdpi.com/2079-3200/11/4/73); Pallentin et al. (2024), HeiQ
  short forms, J. Intell. 12:100. Schroeders & Walter (2026), *Developing
  BOLT*, PsyArXiv 10.31234/osf.io/39cbv. Chierchia et al. (2019),
  MaRs-IB, R. Soc. Open Sci. 6:190232 (osf.io/g96f4; licence at
  sites.google.com/site/blakemorelab/research/mars-ib). Condon &
  Revelle (2014), ICAR, Intelligence 43. Heydasch, Haubrich & Renner
  (2013), HMT (fernuni-hagen.de/arbeitspsychologie/forschung/
  hagener-matrizentest-en.shtml). Matzen et al. (2010), Sandia
  generator, Behav. Res. Methods 42. Mittring & Rost (2008) on
  option-counting in RAPM, as cited by Pallentin et al. TestMyBrain:
  github.com/manybrainsproject/TestMyBrainCodeRepo (LGPL-3 / CC-BY-SA
  stimuli). Licence quotes were checked against these primary pages on
  2026-08-19; where a page could not be reached (icar-project.com) the
  table says so.
