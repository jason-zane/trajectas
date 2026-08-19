# Cognitive pilot — state of play after round 1 (2026-08-19)

Written as the handoff from the cloud session that built and piloted the
figural matrix instrument. Everything below is either merged to `main`,
live in production, or explicitly listed as not done.

## Where things stand

**The instrument is live and takeable.** The internal pilot assessment
("Figural Matrix Reasoning — Internal Pilot", 3 practice + 24 scored
items, `ability_dichotomous`, 30-minute scored section) is delivered by
the internal campaign `figural-matrix-pilot-internal`. Sessions on it are
excluded from calibration (`campaigns.is_internal`), and the assessment
carries `internal_pilot = true` — the named, trigger-enforced exception
that lets unreviewed draft items be served internally and only
internally (migration `20260817103000`).

**First real sitting (JH, 2026-08-18): 18/24 raw (75%).** Session
`5d2a52e1-23e5-4a19-b2e8-3832f352108f`, completed via the timer-expiry
path, scored cleanly: 27 outcomes, 3 practice items excluded, 24
counted. Score is provisional percent-correct; no norm group exists, so
it is not a percentile and must not inform any selection decision.

## What the pilot round found, and what happened to each finding

1. **Save queue could wedge permanently** — a `sendBeacon` flush saved
   an answer whose ack the client could never read; every retry was then
   refused by the no-back-nav guard without acknowledgment, so the queue
   never drained, the runner showed "not saving properly" throughout,
   and the finish screen hung forever. **Fixed and live** (#364 +
   migration `20260818230000`, applied to production after the code
   deploy — that order is load-bearing; see the migration header). The
   RPC now answers "is this answer durably stored?" (`acked`) and names
   what can never be saved (`terminal`); the client drains terminal
   entries and surfaces the loss once.
2. **Inner marks on solid shapes were invisible** (ink-on-ink; item 23's
   keyed answer was affected). **Fixed and live**: inner-layer elements
   over a solid outer render in paper colour. No content hashes changed;
   all 98 items pick it up at delivery time.
3. **Runner scrolled; options wrapped 3+2.** **Fixed and live**: one row
   of five options as wide as the grid, whole block sized by
   `min(420px, 88vw, 44dvh)`, centred, compact stem.
4. **Distractor leak — the big one, NOT yet fixed.** On multi-rule
   items, only 2–3 of 5 options share the key's outer shape, so solving
   the easy rule alone leaves a coin flip; on LRM-3R-DIST the key is
   uniquely identified by shape+fill surface-matching. Root cause is
   G-08's `KEY_VALUE_DOMINATES` check FORCING the key to be a per-axis
   minority. Full redesign is specified in
   `docs/superpowers/specs/2026-08-19-distractor-redesign-after-first-pilot.md`
   — new option-set contract, G-08 re-formalisation, new G-19 gate, five
   families to re-author. **This is the next implementation branch.**
   Consequence worth repeating: the 18/24 above is an upper bound, and
   the predicted-b values for multi-rule families are inflated until the
   redesign is re-piloted.

## Benchmarking plan (in progress, owner: JH)

Comparators, best first: Mensa Norway (test.mensa.no — 35 figural
matrices, 25 min, IQ-scaled score; closest format), SAPA Project
(sapa-project.org — ICAR items with real norms and percentile feedback),
TestMyBrain matrix reasoning, OpenPsychometrics FSIQ. Compare on
proportion correct; treat our 75% as inflated by finding 4.

**Mensa Norway sitting done and analysed** (JH, 2026-08-19: IQ 118,
88th percentile, ≈24–28/35 by triangulation) — see
`2026-08-19-mensa-norway-benchmark.md`. Two things from it change the
plan above: (a) the pilot's 75% is inflated a *second* way — the form
was blocked by family and five of the six misses were the first item of
a block, so items 2–3 of each block look like rule reuse, not induction;
(b) the "ran out of clock at item 21" below is wrong — every answer was
in by 17:12, the rest was the wedged finish screen. The next form needs
a no-adjacent-family constraint, ~25 min for 20 items, and the new gate
in the redesign spec is G-20 (G-19 already exists).

## The next session picks up here

1. **Distractor redesign implementation** (the spec above): implement
   G-19, re-formalise G-08, re-author the five leaking families'
   distractor plans, regenerate the bank, build a fresh pilot form
   (~20 items, 35–40 min — round 1 ran out of clock at item 21), second
   sitting, before/after comparison.
2. **Three suspect easy-middle items**: round 1 missed positions 3
   (LRM-MOVE), 6 (LRM-ROT), 9 (LRM-SUB) with long response times — eyeball
   those in `/item-bank/review` for ambiguity while reviewing.
3. **Outstanding, human-only**: make the repo private (the bank AND its
   answer key are reproducible from the public repo); record content +
   fairness sign-offs before any real candidate ever sits the
   instrument.
4. **Deferred repo hygiene** (unchanged from the drift audit,
   `docs/schema-drift-audit-2026-08-16.md`): reconcile the three tables
   missing from production; drop dead `factors.category_id` and the
   `competency_categories` orphan.

## Operational notes that cost time to learn

- Migrations that change an RPC's **return shape** invert the repo's
  usual deploy order: ship shape-tolerant code first, apply the
  migration after the production deploy is Ready. `20260818230000` is
  the precedent, with the warning in its header.
- Supabase security advisors were checked after this round's DDL
  (2026-08-19): no new findings; every listed warning pre-dates this
  work. The new SECURITY DEFINER trigger functions all carry
  `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`.
- The internal pilot session's expiry path (`handleExpiry`) submits even
  when the save queue is wedged — it is why round 1 scored despite the
  hang. The boundary-button path (`pushAcrossBoundary`) blocks on the
  drain; post-fix that drain always completes.
