# Cognitive pilot v2 — hand-over (2026-08-19)

The state of the instrument after the v2 build (branch
`feat/cognitive-v2-defensible-form`; plan
`2026-08-19-cognitive-v2-build-plan.md`; rationale in the redesign spec and
the Mensa Norway benchmark). Written so JH can sit the v2 form and so the
next session starts from the repo.

## What is different from round 1

| | Round 1 (v1) | v2 |
|---|---|---|
| Multi-rule option sets | key a per-axis minority (old G-08) → the two cheap rules identified the key; 3-rule items answered in 3.5–12 s | cheap axes give the answer away on 4 of 5 options; the hard rule discriminates (G-08′ + G-20); modal hit rate 0 on every item |
| 3R-DIST | "very hard" b +1.25 | honest: all three rules cheap → balanced fractional set, b +0.35, moderate |
| Ceiling | b +2.2 on paper, easy in practice | LRM-BITS-2OP: two hard Boolean rules on a bit-grid, b +2.00; LRM-BITS-XOR as the on-ramp (+0.20) |
| Priors | rule count, all rules equal | cheap rules at half weight (ordering prior until calibration) |
| Form order | by b → same-family blocks; 5 of 6 misses were first-of-block | three tiers, round-robin over families inside a tier: no two adjacent items from one family |
| Practice | PROG-COUNT ×3, and PROG-COUNT ×2 scored at positions 1–2 | PROG-COUNT practice only; not in the scored section |
| Length / time | 24 + 3, 30 min (17 min used) | 24 + 3, 30 min (75 s/item — HeiQ-S's validated pace) |
| Runner | tap + Continue, no Back | tap advances, Back revises (PR #367) |
| Families | 10 | 12 |

## Measurements (20 seeds × 8 draws per family, this branch)

| family | accept | b (band) | modal P(hit) | cheap-elimination survivors |
|---|---|---|---|---|
| PROG-COUNT | 68 % (G-13 dups) | −2.00 easy | 0 | n/a |
| ROT / MOVE | 91 % / 93 % | −1.40 easy | 0 | n/a |
| ADD / SUB | 89 % / 98 % | −0.90 moderate | 0 | n/a |
| 2R-XLAYER | 98 % | +0.35 moderate | 0 | 4/5 on every item |
| 3R-DIST | 84 % | +0.35 moderate | 0 | all-cheap (G-20 skips) |
| XOR-XLAYER | 91 % | +0.90 hard | 0 | 4/5 |
| BITS-XOR | 100 % | +0.20 moderate | 0.20 (chance) | n/a |
| XOR-DIST-XLAYER | 98 % | +1.35 hard | ≤ 0.2 (chance) | 4/5 |
| 3R-XLAYER | 98 % | +1.30 hard | 0 | 4/5 |
| BITS-2OP | 100 % | +2.00 very hard | 0 | n/a (both rules hard) |

Bank at seed `v2-2026-08-19`, 12 per family: **123 items**, 0/123 batch
blind hits, all twelve families producing (PROG-COUNT 4 — its structural
space is small; the form needs 3). Tests: 2102 unit + architecture green.

## The last mile (production) — two steps, in this order

Both need the DB password or the admin UI; neither could be run from the
build session (production writes are permission-gated there).

1. **Ingest the v2 bank.** Either `/item-bank/generate` with seed
   `v2-2026-08-19` and 12 per family, or:
   ```sh
   node --import ./scripts/cognitive/register-ts-loader.mjs \
     scripts/cognitive/ingest-to-live.ts \
     --conn='postgresql://postgres@db.rwpfwfcaxoevnvtkdmkx.supabase.co:5432/postgres' \
     --requested-by=<your profile uuid> --seed=v2-2026-08-19 --per-family=12 --confirm
   ```
   Idempotent by content hash; re-running completes a partial load. The
   two new families are created by the ingest with their priors.
2. **Seed the v2 form.** Run `scripts/cognitive/seed-pilot-v2-assessment.sql`
   (psql or the SQL editor). It refreshes the four changed families'
   priors, creates assessment `b3…0002`, sections `b4…0003/0004`, places
   3 + 24 items from the `v2-2026-08-19` bank (pinned to that exact seed)
   in tier/round-robin order, and creates
   campaign `figural-matrix-pilot-v2-internal`. Idempotent. The commented
   sanity query at the bottom prints the placed form with family per
   position — check no two adjacent scored positions share a family.

Then add yourself as a participant on campaign `b5…0002` (the INSERT is in
the seed's comments) and open `/assess/<access_token>`.

If step 2 is run before step 1 it places nothing and can simply be
re-run.

## Sitting it — what to record

- Sit it once, cold, no notes. It is a different test from v1: the option
  sets no longer give the hard rule away, the order interleaves families,
  and eight of the 24 are bit-grids you have not seen.
- Afterwards, the item-level record is the same query as before
  (`participant_item_outcomes` joined to `assessment_section_items` and
  `items.family_id`); the benchmark doc §3.2 has it. What we want to see:
  the multi-rule items no longer answered in 10 s; the misses no longer
  concentrated on the first item of anything; the bit-grid 2OP items
  actually hard.
- Then 2–3 more internal sitters, each with a Mensa Norway sitting as the
  comparator (25 min, free, `test.mensa.no`). At n ≈ 4 nothing is
  calibrated, but the direction of every claim above is testable.

## What v2 does not claim

Norms, reliability and criterion validity — those need sitters, and v2
is the instrument that makes those sittings worth running. The priors
are ordering priors. Nothing has been through content or fairness
review; the assessment carries `internal_pilot = true` and can only be
attached to an internal campaign, as v1 was.

## Deferred, deliberately (build plan §7)

Six options (own PR); a constructed-response format (design spike after
this re-pilot); a stroke-set family; an anchor block for calibration
(OMIB's format does not fit our runner; ICAR/MaRs-IB need permission);
making the repo private (human-only, still outstanding: the bank AND its
key are reproducible from source).
