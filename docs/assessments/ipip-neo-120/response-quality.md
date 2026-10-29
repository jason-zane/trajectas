# Response-quality pilot

The owner authorised this supplement on 30 October 2026. It is Trajectas-authored
pilot material, not a published IPIP validity scale. The original 120 statements,
order, accuracy anchors, 55 keys, native totals and display reversals are unchanged.
The respondent completes those 120 first, then eight agreement statements. These
are stored separately and never become personality items or contribute to norms.

## Administration and rules

Module `trajectas-response-quality-v1` contains two instructed responses, two
implausible statements and four absolute positive self-descriptions. The latter
adapt existing library seed wording; the implausible statements are new pilot
wording. Exact ordered wording is frozen on the attempt and checked against the
supported version. Instruction keys are Agree (4) and Strongly disagree (1).

Policy `trajectas-response-quality-pilot-v1` evaluates:

| Indicator | Review cue | Unavailable when |
| --- | --- | --- |
| Instructions | At least one of two instructed responses missed | Either answer missing |
| Implausible endorsement | Agree or Strongly agree to either statement | Either answer missing |
| Idealised self-description | Strongly agree to all four absolute positive statements | Any of the four missing |
| Repetition | At least 20 identical consecutive raw answers in canonical 120-item order | Native form incomplete; processing fails rather than treating it as clear |
| Timing | More than 50% of usable timings below 1,000 ms | Fewer than 100 positive finite timings |

Any cue produces **Review recommended**. Otherwise, any unavailable indicator
produces **Insufficient information**. **No concerns detected** requires all five
indicators to be available and clear. Unprocessed attempts display **Not assessed**.
These are provisional review thresholds, not empirically calibrated cut-offs.
Timing is device-reported, includes revisits, and is not an objective reading test.
End-of-form attention checks cannot establish attention throughout the preceding
120 items. Idealised responses cannot establish dishonesty. No automatic penalty,
rejection, trait adjustment, norm reassignment or external notification is applied.
Do not call this an assessment-wide validity percentage or a clinical diagnosis.

Multiple indicators are preferable because methods detect different patterns and
their performance depends on context: [Meade & Craig (2012)](https://pubmed.ncbi.nlm.nih.gov/22506584/).
Pilot sensitivity, specificity, subgroup differences, wording acceptability and
the effect of the supplemented administration on comparability remain unverified.
The separate norm-reference work concerns original personality scores; it does not
validate these response-quality rules or the supplemented administration.

## Persistence and access

The additive migration assigns the module atomically at a native form's first
freeze, only for an in-progress attempt with no existing answers. There is no
backfill of existing frozen or answered attempts. The server validates participant
ownership on each supplemental load/save; saves serialise with session completion
and use revisions to reject stale tabs. Identical lost-response retries are safe.
The new app requires all assigned supplement answers before accepting submission.

The native completion dispatcher stores the original personality result, then
separate immutable quality evidence. A quality persistence failure retains native
scores and puts processing into the existing retry/recovery path; it cannot appear
as a successful quality check. Duplicate processing converges on one policy row.
Delivered report snapshots are not recalculated or extended by this feature.

All three new tables have RLS enabled and no anon/authenticated grants. Reads use
session/participant access gates plus individual-result confidentiality checks.
Profile session rows show status with a link to that attempt. The detail view shows
reasons, counts, coverage, policy, module and computation time. Campaign managers
with individual-result access may append a decision and notes; other authorised
readers cannot review. Reviews retain actor ID/time and reference the exact result.
They never erase the original flag. Request UUIDs prevent duplicate review saves.
Parent-session purge cascades the supplement, quality evidence and review history.

## Rollout and recovery

Apply `20261029233035_ipip_response_quality.sql` after the existing presentation
migration, before the new app. This is one additive migration; no reset, seed-item
import, Auth, Storage, provider permissions or production change is required.

| App | Expanded database | Behaviour |
| --- | --- | --- |
| Previous | Yes | Native forms/scoring remain usable. Old code ignores supplements and cannot claim quality checks ran. |
| New | Yes | New untouched forms get the supplement; legacy forms retain their original format. New completions get separate pilot evidence. |
| Rollback to previous | Yes | Native results/report snapshots survive; quality tables remain private and intact. Old app may finish without administering assigned checks; those attempts must not be represented as having passed. |

The new app requires this schema. Do not deploy it ahead of the migration. App
rollback does not remove new evidence. To stop assigning supplements independently
of app rollback, use a reviewed forward migration disabling the assignment trigger
for future freezes; never delete delivered assignments or revise stored results.
Production rollout still requires approval for the exact commit and migration.

Verification includes pure policy boundaries, authorisation/confidentiality,
completion bypass, save/review retries, frozen legacy compatibility, private grants,
parent purge, canonical golden scoring, and a synthetic seeded browser journey
through all 128 items, resume and assessor review. Browser screenshots cover light
and dark assessor views; the supplement is also checked at mobile width.
