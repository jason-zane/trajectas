# Distractor redesign after the first pilot sitting

**Status: IMPLEMENTED (2026-08-19, branch `feat/cognitive-v2-defensible-form`)
— G-08′ and G-20 in `qa/`, the four cheap+hard families re-authored to the
asymmetric contract, LRM-3R-DIST moved to a balanced fractional design, and a
cheap-rule discount on the priors. The build plan that executed this spec,
including where it refines it (G-18 re-scoped to cheap axes; 3R-DIST has no
hard axis; G-20 skips when every axis is cheap), is
`2026-08-19-cognitive-v2-build-plan.md`.**
Written 2026-08-19, after the first real sitting of the internal pilot
(24 scored items, participant: JH) surfaced a structural flaw in how the
generator builds option sets.

## What the participant reported

> "It's obvious which shape needs to go in, but there's only two of that
> shape out of the five options. So you've got a 50% chance of getting it
> right."

## What the data says

For each scored item, counting options that share the keyed answer's
outer shape (and fill) — the attributes governed by the item's *easiest*
rules:

| Positions | Family | Options sharing key's shape | Effective floor after cheap elimination |
|---|---|---|---|
| 15, 16, 23, 24 | LRM-2R/3R-XLAYER | 2 of 5 | ~50% guess |
| 17, 18, 21, 22 | LRM-XOR-(DIST-)XLAYER | 2–3 of 5 | 33–50% guess |
| 19, 20 | LRM-3R-DIST | 4 share shape, **1** shares shape+fill | **key uniquely identified by surface match** |

Positions 19–20 are the worst case: solve the two cheap rules, match
shape+fill against the options, and the key is identified without ever
engaging the rule the item exists to measure. Item 23 (predicted
b = 2.20, the second-hardest item) is fully solvable from its two
Latin-square rules: pentagon → {D, E}; solid → {B, E}; intersection E.

This is a large part of why the test read as "too easy" to an able
participant despite predicted difficulties up to b = +2.2 — the hard
items' *effective* difficulty collapses to the difficulty of their
easiest rule plus a coin flip.

## Root cause — G-08's minority requirement

`contextBlindGate` (src/lib/cognitive/generator/qa/contextblind.ts)
implements the I-RAVEN finding: an option set built from single-attribute
perturbations of the key lets a solver recover the key from the options
alone, without the grid. Its third check, `KEY_VALUE_DOMINATES`, requires
the key's value to be held by **≤ 2 of 5 options on at least half the
rule axes**.

That check *forces* the leak. On a 3-axis item (outer.shape, outer.fill,
inner.rotation), at least two axes must isolate the key — and the
generator satisfies it on the two axes that are cheapest to vary, which
are exactly the axes governed by the cheapest rules. The defence against
the context-BLIND attack (guessing from options alone) constructs the
context-AWARE attack (solve the easy rules, eliminate).

Both attacks are real. The design error is treating "the key must be a
minority per axis" as the defence, when the actual requirement is:

> **No strategy cheaper than solving the hardest rule may beat chance
> among fewer than 4 options.**

## The redesign

Terminology: an item's rule axes divide into **cheap axes** (governed by
rules with low inference cost — constants, Latin squares, single-step
progressions on visually dominant attributes) and **hard axes** (the
rules the item exists to measure). Families declare the split — it is
authorship, like the distractor plan itself.

### New option-set contract, for multi-rule items

Key + 4 distractors:

- **D1–D3 — hard-axis violations.** Match the key on every cheap axis;
  each carries a *distinct, labelled* hard-rule error (stall/IR, wrong
  step/WR, perseveration or context-copy/PM-RP). All hard-axis values
  distinct from the key and from each other.
- **D4 — the incomplete correlate.** Violates exactly one cheap axis
  (hard axis value deliberately *shared with one of D1–D3*, see centroid
  note). Catches the respondent who solved the hard rule and botched an
  easy one, and keeps the option set from being a pure star around the
  key.

Consequences:
- Cheap elimination (solve easy rules, filter options) leaves **4 of 5**
  options standing → floor drops from 50% to 25%, and the surviving
  three distractors each test a specific hard-rule error, restoring the
  diagnostic value of the per-distractor error labels reviewers see.
- Yes, 4/5 options sharing the cheap attributes *reveals* the cheap
  attributes' answer. That is accepted and correct for a hard item: the
  cheap rules were never what it measured, and the residual measurement
  is purer. (Carpenter, Just & Shell 1990: multi-rule difficulty lives in
  rule induction + working-memory load of the *hard* rules; Embretson
  1998: radicals drive difficulty, surface variation is incidental.)

### G-08 re-formalisation

- **Drop** per-axis `KEY_VALUE_DOMINATES` entirely.
- **Keep** the centroid check. Note the star-pattern hazard: if D1–D3
  are all distance-1 from the key and D4 distance-3, the key is the
  centroid. Sharing D4's hard-axis value with one of D1–D3 moves the
  centroid onto that distractor (worked example: totals key=5, d1=4 →
  centroid = d1). The gate stays as the verifier that the family's plan
  achieved this; plans that fail it are re-authored, not repaired
  blindly.
- **Replace** the boolean modal check with an expected-hit-rate bound:
  the modal scorer, breaking ties uniformly, must have
  **P(hit) ≤ 1/4** (today any tie that *includes* the key's composition
  counts as full recovery, which over-rejects exactly the balanced
  designs we now want — a 5-way hard-axis tie is a 1-in-4-or-5 guess,
  not an identification).
- **Add G-20 — cheap-elimination resistance:** for every declared cheap
  axis, ≥ 4 of 5 options share the key's implied value; and the
  intersection of all cheap-axis filters contains ≥ 4 options. Fails
  closed at generation, like G-11/G-18/G-19. (Numbered G-20 because
  G-19 already exists — elimination resistance via cue-chaining,
  `qa/degeneracy.ts`; an earlier draft of this spec called the new gate
  G-19. Note also that G-18's header already states the structural limit
  this section resolves: "no pair of rules suffices in a 3-rule item" is
  unsatisfiable alongside G-08's minority requirement.)

### Families needing re-authored plans

`lrm-2r-xlayer`, `lrm-xor-xlayer`, `lrm-xor-dist-xlayer`,
`lrm-3r-xlayer`, `lrm-3r-dist` — every family whose distractor plan
varies outer.shape/outer.fill on a multi-rule item. Single-rule families
(PROG-COUNT, ROT, MOVE, ADD, SUB) have one axis, so cheap-vs-hard does
not arise; their sets are untouched.

### What this deliberately does not fix

- **The ceiling.** The participant found the test easy even where the
  leak wasn't in play. The bank tops out at 3 rules / b≈+2.2 by design
  prior. Raising the ceiling means new families (4-rule, distribution-
  of-three with distractor load, larger value alphabets), which is
  content authorship, not a gate change — and the priors will only be
  trusted after this redesign is re-piloted, because today's priors were
  estimated on items whose *effective* difficulty the leak had capped.
  One honest consequence: **the current predicted-b values for
  multi-rule families are optimistic and must be re-derived** after
  regeneration.
- **Existing items.** Content-hash discipline means redesigned option
  sets are NEW items. The current 98 stay as they are (they are draft,
  unreviewed, and only ever served inside the internal pilot); the
  regenerated bank replaces them in the next pilot form.

## References

- Carpenter, P. A., Just, M. A., & Shell, P. (1990). What one
  intelligence test measures. *Psychological Review, 97*(3).
- Embretson, S. E. (1998). A cognitive design system approach to
  generating valid tests. *Psychological Methods, 3*(3).
- Hu, S., et al. (2021). Stratified rule-aware network for abstract
  visual reasoning (I-RAVEN / attribute bisection: the context-blind
  attack and the balanced option-set construction).
- Benny, Y., et al. (2021). Scale-localized abstract reasoning
  (RAVEN-FAIR: chained rather than star-shaped distractor derivation).
- Matzen, L. B., et al. (2010). Recreating Raven's: software for
  systematically generating large numbers of Raven-like matrix problems
  with normed properties. *Behavior Research Methods, 42*(2) —
  distractor taxonomy (repetition, wrong-rule, incomplete-correlate).
