# Norms on the trajectory canvas — versioning design note

Status: Design note (2026-06-13). Companion to
`2026-06-13-growth-canvas-unified-trajectory-compare.md` (Phase 5 deferred
items). No implementation yet — this records the decisions so the future work
doesn't re-litigate them.

## What shipped instead

The canvas and growth report label the gold wash as "Typical range (30–70)" —
the platform's existing POMP-scale convention — rather than claiming real norm
percentiles. Change significance uses stored per-score confidence bands
(non-overlap of first vs latest) with a ±3 noise floor as the fallback when a
scorer didn't produce bands. Neither claims more rigor than the data carries.

## The deferred problem

`norm_groups` / `norm_group_constructs` exist, and `participant_scores`
stores a percentile computed at scoring time. Three gaps block surfacing them
on a longitudinal canvas honestly:

1. **Percentiles are frozen at scoring time, against whatever the norm group
   looked like that day.** Two sessions a year apart may have been normed
   against different samples; a percentile "change" can be sample drift, not
   person change.
2. **Norm groups mutate in place** (`last_refreshed_at`), so the question
   "what were the norms when this score was computed?" is unanswerable.
3. **No per-score record of which norm group applied.** `participant_scores`
   has no `norm_group_id` column.

## Decisions for the future implementation

- **Add `norm_group_id` (+ `norm_version`) to `participant_scores`** at
  scoring time. Cheap, additive, makes every stored percentile auditable.
- **Snapshot norms on refresh**: a `norm_group_versions` table (immutable
  copy of mean/sd/n per construct, stamped) written whenever a norm group is
  refreshed. Re-norming history becomes reconstructable.
- **Canvas band**: when every visible score shares one norm group, draw the
  band from that group's P25–P75 and label it with the group name + n.
  Mixed/missing groups → keep the generic typical-range band. Never an
  unlabelled wash.
- **Percentile deltas stay out of the canvas** until re-norming exists:
  comparing percentiles across norm versions is the one move that actively
  misleads. Scaled-score deltas only.
- **`cohort_label` on `campaign_participants`** (optional segmentation for
  benchmark overlays) needs product input on vocabulary — parked until a
  client asks for cohort-vs-cohort views.

## Trigger to pick this up

Populated `norm_groups` for a real instrument, or a client asking "compared
to whom?" on a growth report.
