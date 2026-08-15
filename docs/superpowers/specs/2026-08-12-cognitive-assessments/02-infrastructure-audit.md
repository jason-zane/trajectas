# Cognitive Assessments — Infrastructure Audit

**Date:** 2026-08-12 · **Status:** Research (no implementation yet)
**Part of:** [Cognitive assessments research pack](./README.md)

What Trajectas already has that a timed cognitive-ability test family can reuse, and what is
genuinely missing. Supersedes nothing — it refreshes the codebase-audit half of
[`2026-05-05-cognitive-ability-assessment-design.md`](../2026-05-05-cognitive-ability-assessment-design.md),
which remains ~90% accurate; the deltas since May are keyed options landing
(`20260702100000`), batch-save bounds validation (`20260810093000`), and taxonomy unification.

## Summary

Trajectas already has one end-to-end assessment machine, built for untimed Likert-style
capability/personality instruments (Five Brains is scored through it), plus a large layer of
**dormant psychometric infrastructure that anticipates ability testing**. Items are relational
rows (`items` + `item_options` + optional `item_media`/`item_scoring_rubrics`), organised into
`assessment_sections` that already carry `time_limit_seconds`, `allow_back_nav`,
`item_ordering`, and `items_per_page`. Participants are anonymous token holders
(`campaign_participants.access_token`; passwordless platform, no auth rows); the runner at
`src/app/assess/[token]` talks to server actions in `src/app/actions/assess.ts`, which use the
admin client behind `requireParticipantRuntime*` guards.

`getSessionState` assembles the form at read time — campaign factor filtering,
difficulty-balanced per-construct selection, and a session-seeded shuffle — and returns
`ItemForRunner` DTOs that deliberately exclude answer keys. Responses persist through hardened
`SECURITY DEFINER` RPCs (token + status + item-membership + response-bounds validation) via an
offline-resilient save queue, with `response_time_ms` plumbed end-to-end **but never actually
measured**, and `time_remaining_seconds` persisted per-section **but only if the client
volunteers it**. `submitSession` enforces completeness, then runs `scoreSessionCTT`
server-side: mean POMP per construct rolled up to weighted factor scores plus a composite.

A keyed-option path exists (`item_options.score_value`), so right/wrong keys have a home — but
they feed POMP means, not sum-correct or theta, and any authenticated dashboard user can read
`score_value` via RLS. Dormant but real: full IRT (1PL/2PL/3PL), MLE/EAP estimation, a
stateless MFI CAT engine, CTT item statistics with distractor analysis, POMP/z/percentile/
stanine/sten transforms, and empty schema for `calibration_runs`, `item_statistics`,
`item_parameters`, `norm_groups`/`norm_tables`, and `dif_results`. Nothing wires them: no
calibration job, no scoring dispatcher (`scoring_method = 'irt'` exists on assessments but is
ignored), no norm population, and the 2026-06-13 norms-versioning note records unresolved debt.

The AI generation pipeline (AI-GENIE: LLM batches, embeddings, EGA/bootEGA pruning, construct
preflight, leakage guard, semantic difficulty proxy) is production-grade but entirely
self-report-oriented — no answer keys, distractors, or solution-uniqueness validation.
Reporting is mature (templates/blocks, react-pdf snapshots, band schemes, AI narrative,
aggregate-only confidentiality enforced in app code and RLS).

**Bottom line:** the delivery pipeline, item storage, scoring dispatch point, psychometric
schema, and reporting stack are all reusable. The load-bearing gaps are timing enforcement,
answer-key security, frozen forms, and wiring the dormant IRT/norms machinery.

## What exists and is reusable

1. **Participant delivery pipeline** — campaigns → `campaign_assessments` →
   `campaign_participants` (token-authed, no `auth.users` rows) → `participant_sessions` →
   `participant_responses` → `participant_scores` → `report_snapshots`, with a
   processing-status state machine and a completeness hard-gate at submit.
2. **Item storage** — `items` (stem, purpose enum, difficulty easy/medium/hard,
   reverse_scored, status draft/active/archived) + `item_options` + `item_media`
   (image/audio/video/html with alt_text) + `item_scoring_rubrics`.
3. **Answer-key substrate** — `item_options.score_value` + `exclude_from_scoring`
   (`20260702100000`) with a keyed-scoring path (`src/lib/scoring/keyed-options.ts`) already
   consumed by the CTT scorer; `ItemForRunner` deliberately omits `score_value`.
4. **Section-level timing schema** — `assessment_sections.time_limit_seconds`,
   `allow_back_nav`, `item_ordering`, `items_per_page`;
   `participant_sessions.time_remaining_seconds` JSONB (per-section); a client `SectionTimer`
   countdown component (currently unwired).
5. **Per-item latency plumbing** — `participant_responses.response_time_ms` column,
   `p_response_time_ms` on the save RPCs, `responseTimeMs` through `saveResponseLite` and the
   offline-resilient save queue (`use-save-queue.ts`: idempotency keys, retry,
   pagehide/visibilitychange flush, BroadcastChannel).
6. **Hardened server-side write path** — `SECURITY DEFINER` RPCs validate token, in-progress
   status, item-to-assessment membership, and reject out-of-bounds response values
   (`20260810093000`) — tampering is rejected, not clamped.
7. **Random item selection at delivery** — session-seeded deterministic shuffle
   (`src/lib/item-ordering.ts`, mulberry32 seeded by `sessionId:sectionId`) plus
   difficulty-balanced per-construct selection (`src/lib/item-selection/distribution.ts`).
8. **Dormant psychometric schema** (migrations `00001` + `00010`) — `item_parameters` (IRT
   a/b/c, 1PL/2PL/3PL, calibration sample size), `calibration_runs`, `item_statistics`,
   `construct_reliability`, `norm_groups`, `norm_tables` (percentile_lookup JSONB,
   stanine/sten cutpoints), `factor_analysis_results`, `dif_results`;
   `participant_scores` already has percentile + CI columns; `assessments.scoring_method`
   already includes `irt`/`hybrid` and `item_selection_strategy` includes `cat`.
9. **Dormant scoring libraries** — IRT 1PL/2PL/3PL probability + information
   (`src/lib/scoring/irt/models.ts`), MLE/EAP theta estimation (`irt/estimation.ts`),
   stateless MFI CAT engine (`adaptive/cat-engine.ts`), CTT item statistics incl. distractor
   analysis (`item-statistics.ts`), POMP/z/percentile/stanine/sten transforms
   (`transforms.ts`).
10. **Server-side scoring at submit** — `scoreSessionCTT` runs inside `submitSession` with the
    admin client; the dispatch-scoring-on-submit pattern is directly reusable for an ability
    scorer.
11. **AI item generation pipeline** — `src/lib/ai/generation/pipeline.ts` (LLM batches,
    embeddings, EGA/bootEGA, walktrap, redundancy pruning), `construct-preflight.ts`
    (`pairCandidates` discrimination checks), `difficulty-targeting.ts`, `leakage-guard.ts`,
    `synthetic-validation.ts`; DB-managed prompts/models and `generation_runs` audit tables.
12. **Reporting stack** — report templates + block registry, `report_snapshots` with PDF
    status, react-pdf renderer, band schemes, AI narrative, confidentiality modes enforced in
    app code and RLS (`20260703120000`).
13. **Auth/anonymity patterns** — passwordless OTP for staff/clients, opaque rotating
    `access_token` for participants, `requireParticipantRuntime*` guards.
14. **Governance rails** — DAL conventions (`src/lib/dal/README.md`), architecture tests
    (no-db-in-components, passwordless-only, admin-actions-authz, integration-host-guard,
    rls-fixture-guard), local-Supabase integration harness, PR/migration flow per AGENTS.md.
15. **Enum groundwork** — `response_format_type` already contains `'cognitive'` (with a seeded
    "Pattern Recognition" format in migration `00005`); validity/effort item purposes
    (attention_check, infrequency, impression_management) exist for embedding checks.

## Gap list (the build list for timed cognitive testing)

Ordered roughly by how load-bearing they are:

1. **Server-authoritative timing — missing entirely.** `time_limit_seconds` is loaded into
   `SectionForRunner` but never rendered or enforced; `SectionTimer` is not imported by any
   runner component; `time_remaining_seconds` is client-supplied (COALESCE in the RPC — a
   client that never sends it never runs out); no server-stamped section start, no deadline
   check in `save_response*`/`submitSession`, no auto-submit on expiry. Need:
   `section_started_at` stamped server-side, deadline = start + limit (× accommodation
   multiplier), save/submit RPCs rejecting writes past deadline + grace, expiry-driven
   finalisation.
2. **Answer-key security.** Keys live in `item_options.score_value`, SELECT-able by every
   authenticated dashboard user (policies from `00001`, recreated `20260508214600`, are
   `USING(true)`-to-authenticated); `item_media`/`item_scoring_rubrics` are readable even by
   anon. Keys never reach participants today only because `getSessionState` omits the column.
   Need: move keys out of broadly-readable tables (separate key table or column-privilege/view
   split), harden rubric/media RLS, and an architecture test pinning that no runner DTO ever
   carries key fields.
3. **Fixed forms / versioning — no form entity.** The delivered item set is recomputed at read
   time and never persisted — editing an item mid-flight silently changes what a session
   "was". No version/lineage on items; `item_status` lacks pilot/operational/retired/
   compromised states; no parallel forms, no equating metadata. Need a frozen per-session form
   snapshot (delivered item IDs + version) and item-bank lifecycle states.
4. **Per-item response-latency capture — plumbed but dead.** `section-wrapper.tsx` never
   measures item-visible time; `enqueueSave()` is called without `responseTimeMs`. Client
   latency is also untrusted for a timed test — need server-side receipt timestamps and sanity
   bounds for rapid-guess/effort flags.
5. **IRT-based scoring — maths exists, nothing wired.** `submitSession` hardcodes
   `scoreSessionCTT` (mean-POMP — wrong primary path for ability items); no scoring dispatcher
   keyed on `scoring_method`/response format; no calibration job writes `item_parameters` or
   `item_statistics`; no per-item scored outcome persistence (correct/incorrect, timeout,
   rapid-guess). MVP needs `scoreSessionAbility` (dichotomous sum-correct) + dispatcher; theta
   scoring later.
6. **Norm tables / percentile lookup — schema and maths exist, unpopulated and unwired.**
   `participant_scores.percentile` is never set by the live path. Must implement the decisions
   in [`2026-06-13-norms-versioning-note.md`](../2026-06-13-norms-versioning-note.md)
   (norm-group versioning, per-score norm reference) before making percentile claims.
7. **Practice items — no support.** No `practice` purpose; no unscored practice section with
   feedback (feedback requires a check-answer server action — the safe design — never the key
   client-side).
8. **Accommodations (extra time) — zero support.** Need per-participant/session time
   multiplier or untimed flag with reason category, approver, audit timestamp, consumed by the
   server-side deadline computation.
9. **Anti-cheat & item-exposure control — partial hygiene only.** Token auth + rotation,
   hardened RPCs, bounds rejection, single-active-session index, completeness gate exist; but
   no exposure counters/caps, no retest policy, no rapid-guessing/aberrant-pattern flags, and
   `allow_back_nav` is not in `SectionForRunner` — back-navigation is unrestricted and
   unenforced.
10. **Proctoring signals — none.** No tab-switch counting, paste/copy detection, fullscreen
    enforcement, or a proctoring-events table for reviewer display.
11. **Runner/type-system gaps.** `'cognitive'` exists in the DB enum but not in app types
    (`src/lib/validations/response-formats.ts`); no `CognitiveResponse` component;
    `item-card.tsx` dispatches six formats, none cognitive; `ItemForRunner` carries no
    media/stimulus fields and `getSessionState` does not select `item_media` — visual items
    cannot be delivered at all today.
12. **Item authoring/generation for right/wrong items — net-new.** The AI-GENIE pipeline has
    no notion of correct answers, distractor generation/validation, solution-uniqueness
    checking, or figural/numerical stimulus generation; `difficulty-targeting.ts` is a
    semantic proxy, not calibrated difficulty. The run/log/prompt-management infrastructure is
    reusable; the cognitive item pipeline (stem + key + distractors, single-correct-answer
    verification, review workflow) is new work. See
    [`01-open-source-landscape.md`](./01-open-source-landscape.md) for the generator tooling
    this pipeline should adopt.

## Key file map

| Path | Why it matters |
|---|---|
| `docs/superpowers/specs/2026-05-05-cognitive-ability-assessment-design.md` | Prior full design analysis for this feature; starting point |
| `src/app/actions/assess.ts` | Entire participant delivery flow incl. `getSessionState`, `submitSession` |
| `src/lib/scoring/ctt-session.ts` | The only live scoring path; where a scoring dispatcher must be introduced |
| `src/lib/scoring/keyed-options.ts` | Existing answer-key scoring semantics to extend/replace |
| `supabase/migrations/20260702100000_item_option_scoring_keys.sql` | Where answer keys live today |
| `supabase/migrations/00010_psychometric_infrastructure.sql` | Dormant psychometric schema |
| `supabase/migrations/00001_initial_schema.sql` | Core DDL incl. the overly-broad authenticated SELECT policies on item tables |
| `supabase/migrations/00009_assessment_sections.sql` | Section-level timing schema |
| `supabase/migrations/20260424143500_harden_assessment_runner_rpc.sql` | Hardened save/progress RPCs — where deadline enforcement lands |
| `supabase/migrations/20260810093000_save_batch_response_bounds.sql` | Anti-tamper validation pattern to extend for timing |
| `src/components/assess/section-wrapper.tsx` | Runner state machine — timer integration, latency capture, back-nav, practice mode land here |
| `src/components/assess/section-timer.tsx` | Built-but-unwired client countdown |
| `src/components/assess/item-card.tsx` | Format dispatch — no cognitive renderer exists |
| `src/components/assess/use-save-queue.ts` | Offline-resilient save queue (responseTimeMs pass-through) |
| `src/lib/scoring/irt/models.ts`, `irt/estimation.ts`, `adaptive/cat-engine.ts` | Dormant IRT/CAT machinery |
| `src/lib/scoring/item-statistics.ts`, `transforms.ts` | CTT calibration + norm transforms awaiting a calibration job |
| `src/lib/item-ordering.ts`, `src/lib/item-selection/distribution.ts` | Read-time selection a frozen-form design must persist/replace |
| `src/lib/ai/generation/pipeline.ts`, `construct-preflight.ts` | Reusable generation orchestration; Likert-oriented validation to be replaced for keyed items |
| `src/lib/auth/participant-runtime.ts` | Token-based participant guards |
| `src/lib/validations/response-formats.ts` | App enum missing `cognitive` (and `ranking`) |
| `docs/superpowers/specs/2026-06-13-norms-versioning-note.md` | Norm-versioning decisions percentile reporting must implement |
| `supabase/migrations/00005_foundation_alignment.sql` | `item_media` + seeded cognitive response format; RLS needs hardening |
| `supabase/migrations/00016_validity_items.sql` | `item_purpose` enum — where `practice` would be added |
| `supabase/migrations/20260703120000_aggregate_only_enforcement.sql` | RLS enforcement pattern to follow for key security |
| `src/lib/dal/README.md`, `tests/architecture/*` | Conventions and CI constraints new code must satisfy |
