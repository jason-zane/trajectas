-- Dichotomous ability scoring and the scoring dispatcher (LR-5 / #335).
--
-- Spec: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §1.4 (scoring artefacts) and §4 (scoring);
-- 05-scoring-and-interpretation.md §1 (pipeline) and §2 (scoring rules).
-- §9 sequencing: this is migration 5 of 5 (migrations 1-4 shipped in
-- LR-1/#331, LR-2/#332, LR-3/#333).
--
-- Deviations from the doc, found while implementing against the LIVE schema:
--
--   1. participant_scores gains an `items_used` column in addition to the
--      doc's `raw_correct`/`items_attempted`. The doc's own §4.2 step 8
--      pseudocode writes `items_used` to the row ("raw_score = raw_correct,
--      ... items_used, raw_correct, items_attempted, provisional = true")
--      but §1.4's DDL never adds the column — items_used (the scoring
--      denominator: count(counts_toward_score), which differs from
--      items_attempted = count(counts_toward_score AND outcome IN
--      (correct,incorrect)) by the omitted/expired_unseen items) is real,
--      distinct data the doc's own algorithm needs, so this migration adds
--      it.
--
--   2. The claims-ladder guardrail (issue's "Hard constraint") is NOT in the
--      doc's DDL at all — the doc adds percentile-adjacent columns
--      (norm_group_id, norm_version, percentile already existed) but no
--      constraint tying them together. "It must be structurally impossible
--      to write or display a percentile, norm-referenced score, or band
--      before a versioned norm group exists" is this issue's explicit hard
--      requirement, so two CHECK constraints are added below:
--      participant_scores_norm_group_requires_version (a norm_group_id
--      without a norm_version is a dangling, unversioned reference — not
--      what "a versioned norm group" means) and
--      participant_scores_norm_referenced_requires_group (percentile, the
--      confidence interval, and metric='t_score' — the three norm-referenced
--      surfaces on this table today — cannot be set without norm_group_id).
--      There is no persisted "band" column anywhere in the schema (bands are
--      computed at report-render time from scaled_score, out of scope here),
--      so there is nothing to constrain for that half of the requirement at
--      the DB layer; see the scorer's doc comment for the type-level half.
--
--   3. participant_session_flags (05-…-interpretation.md §2.5) is added in
--      SCOPED form: only the `rapid_guess_rate` flag this issue's scope item
--      5 asks for is populated (src/lib/scoring/ability-session.ts). The
--      full flag catalogue in that doc section (fast_correct_hard,
--      metronomic, stall_burst, position_streak, not_reached_excess,
--      focus_loss, person_misfit, technical) needs infrastructure this issue
--      doesn't build (client focus/paste telemetry, connection-loss logging,
--      IRT person-fit) — the table shape supports them later without a new
--      migration.
--
--   4. Table privileges follow the 20260813103000 lesson, not the doc's
--      bare REVOKE/GRANT: Supabase grants service_role a blanket
--      ALTER-DEFAULT-PRIVILEGES ALL on every table, and a GRANT is additive
--      — it cannot subtract from that blanket grant. Every new table below
--      REVOKEs ALL FROM service_role explicitly before granting back the
--      exact privileges it should have.

-- ===========================================================================
-- §1.4 — assessments.scoring_profile
-- ===========================================================================

ALTER TABLE assessments
  ADD COLUMN scoring_profile scoring_profile NOT NULL DEFAULT 'pomp_factor';

COMMENT ON COLUMN assessments.scoring_profile IS
  'Dispatches src/lib/scoring/dispatch.ts#scoreSession. Defaults to
   pomp_factor (today''s scoreSessionCTT behaviour) so every existing
   assessment is unaffected by this migration — a hard regression gate per
   the issue scope. ability_dichotomous routes to scoreSessionAbility
   (sum-correct against item_answer_keys); ability_irt is a documented
   extension point (scoreSessionAbilityIRT) that currently always falls back
   to ability_dichotomous scoring — see that function''s doc comment for the
   N-floor gate that must be met before it does anything else.';

-- ===========================================================================
-- §1.4 — per-item scored outcomes
-- ===========================================================================
-- One row per (session, item) in the session's FROZEN form — the delivered
-- set, not a re-derivation (participant_section_forms, 20260813103000).
-- correct/incorrect/omitted/expired_unseen/excluded are genuinely different
-- facts (issue scope item 4): omitted means the candidate saw the item and
-- moved on; expired_unseen means the section''s clock ran out before they
-- ever reached it. Collapsing them would corrupt both the scoring rule
-- (05-…-interpretation.md §2.1: both count as 0 operationally, but the
-- distinction still drives calibration treatment later) and the effort
-- flags (an expired_unseen item has no response, hence no rapid_guess
-- signal, and must not be treated as a skip).

CREATE TABLE participant_item_outcomes (
  session_id          UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  section_id          UUID REFERENCES assessment_sections(id) ON DELETE SET NULL,
  outcome             TEXT NOT NULL CHECK (outcome IN
                        ('correct','incorrect','omitted','expired_unseen','excluded')),
  chosen_option_id    UUID REFERENCES item_options(id) ON DELETE SET NULL,
  counts_toward_score BOOLEAN NOT NULL DEFAULT true,
  item_purpose        item_purpose NOT NULL,
  item_version        INT NOT NULL,
  content_hash        TEXT,
  response_time_ms    INT,
  latency_source       TEXT CHECK (latency_source IN ('server_gap','client_fallback','none')),
  rapid_guess         BOOLEAN NOT NULL DEFAULT false,
  scorer_version      TEXT NOT NULL,
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, item_id)
);

COMMENT ON COLUMN participant_item_outcomes.response_time_ms IS
  'Server-derived latency where computable (the gap between this item''s
   answered_at and the previous chronological event in its section — see
   src/lib/scoring/ability-session.ts), NOT the raw client-reported
   participant_responses.response_time_ms. Falls back to the client-reported
   value only for the first answered item in a section with no
   participant_section_states row (an untimed section has no server-stamped
   clock start to anchor the first gap). latency_source records which.';

COMMENT ON COLUMN participant_item_outcomes.latency_source IS
  'server_gap = trusted, derived from answered_at (a SECURITY DEFINER RPC
   timestamp the client cannot spoof). client_fallback = the client-reported
   response_time_ms, used only when no server anchor was available. none =
   no response, so no latency at all (omitted/expired_unseen/excluded).';

CREATE INDEX idx_item_outcomes_item ON participant_item_outcomes(item_id);

ALTER TABLE participant_item_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON participant_item_outcomes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE participant_item_outcomes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_item_outcomes TO service_role;

-- ===========================================================================
-- §2.5 (05-…-interpretation.md) — session-level effort/validity flags
-- ===========================================================================
-- Scoped to what issue scope item 5 asks for (rapid-guessing detection); see
-- file-header note 3. service_role only — no client or candidate read path,
-- matching the precedent for every other scoring-internals table in this
-- programme.

CREATE TABLE participant_session_flags (
  session_id       UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  flag_code        TEXT NOT NULL,
  tier             TEXT NOT NULL CHECK (tier IN ('informational','advisory','blocking')),
  detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
  detector_version TEXT NOT NULL,
  raised_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  resolution       TEXT,
  PRIMARY KEY (session_id, flag_code)
);

COMMENT ON TABLE participant_session_flags IS
  'Effort/validity flags raised during scoring. Informational/advisory flags
   are logged only; no flag combination automatically withholds or adjusts a
   score in this slice (05-…-interpretation.md §2.4''s "blocking" tier
   product behaviour — score withheld, candidate offered a retake — is NOT
   wired up here; this migration and src/lib/scoring/ability-session.ts only
   compute and persist the tier so a future ticket can act on it). See that
   file for the rapid_guess_rate detector this issue implements.';

CREATE INDEX idx_session_flags_tier ON participant_session_flags(tier);

ALTER TABLE participant_session_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON participant_session_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE participant_session_flags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_session_flags TO service_role;

-- ===========================================================================
-- §1.4 — participant_scores additions
-- ===========================================================================

ALTER TABLE participant_scores
  ADD COLUMN metric               TEXT NOT NULL DEFAULT 'pomp'
    CHECK (metric IN ('pomp','percent_correct','t_score')),
  ADD COLUMN scoring_variant      TEXT,          -- 'mean_pomp' | 'sum_correct' | 'sum_correct_fallback' | 'eap_2pl'
  ADD COLUMN raw_correct          INT,
  ADD COLUMN items_used           INT,           -- see file-header note 1
  ADD COLUMN items_attempted      INT,
  ADD COLUMN theta                NUMERIC,
  ADD COLUMN theta_se             NUMERIC,
  ADD COLUMN parameter_scale_code TEXT,
  ADD COLUMN norm_group_id        UUID REFERENCES norm_groups(id) ON DELETE SET NULL,
  ADD COLUMN norm_version         TEXT,
  ADD COLUMN provisional          BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN participant_scores.provisional IS
  'True while the instrument is pre-validation. Every score
   scoreSessionAbility writes is provisional = true (the instrument has no
   norm group yet — see the claims-ladder constraints below). Report
   surfaces must render a "pilot — not for selection decisions" label when
   set; that rendering is out of scope for this migration/scorer (no report
   block work in this issue) and is flagged as a residual risk in the
   implementation report.';

-- ---------------------------------------------------------------------------
-- The claims ladder, enforced (issue''s "Hard constraint"): it must be
-- structurally impossible to write a percentile, a confidence interval, or a
-- t_score-metric row before a NAMED, VERSIONED norm group exists.
-- ---------------------------------------------------------------------------

-- "A versioned norm group" means norm_group_id is never set without a
-- norm_version alongside it — an unversioned norm_group_id reference isn't
-- what the instrument's claims ladder calls a norm group.
ALTER TABLE participant_scores
  ADD CONSTRAINT participant_scores_norm_group_requires_version CHECK (
    norm_group_id IS NULL OR norm_version IS NOT NULL
  );

-- The three norm-referenced surfaces on this table today (no persisted
-- "band" column exists anywhere in the schema — bands are computed at
-- report-render time from scaled_score, see the migration header) cannot be
-- populated without a norm group backing them.
ALTER TABLE participant_scores
  ADD CONSTRAINT participant_scores_norm_referenced_requires_group CHECK (
    norm_group_id IS NOT NULL
    OR (
      percentile IS NULL
      AND confidence_interval_lower IS NULL
      AND confidence_interval_upper IS NULL
      AND metric <> 't_score'
    )
  );

-- ===========================================================================
-- §4.2 step 9 — composite weighting as data, not a constant in code
-- ===========================================================================

ALTER TABLE assessment_factors
  ADD COLUMN composite_weight NUMERIC CHECK (composite_weight IS NULL OR composite_weight > 0);

COMMENT ON COLUMN assessment_factors.composite_weight IS
  'Optional weight for participant_sessions.composite_score when
   scoreSessionAbility computes it (e.g. 0.70/0.30 for LR-M/LR-D). NULL
   (the default, and the value for every existing factor) means equal
   weighting — a no-op for every assessment configured before this column
   existed. Distinct from factor_constructs.weight, which rolls constructs
   into a factor one level below this.';

-- ===========================================================================
-- §1.4 — item_parameters: versioned, run-linked, immutable-per-version
-- ===========================================================================
-- The table is empty in every environment (doc-verified, re-confirmed here:
-- no code path writes to it yet), so this ALTER is free.

ALTER TABLE item_parameters
  ADD COLUMN calibration_run_id UUID REFERENCES calibration_runs(id) ON DELETE RESTRICT,
  ADD COLUMN scale_code         TEXT,            -- e.g. 'LR-M-v1'
  ADD COLUMN is_current         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN se_a               NUMERIC,
  ADD COLUMN se_b               NUMERIC,
  ADD COLUMN se_c               NUMERIC,
  ADD COLUMN n_responses        INT;

ALTER TABLE item_parameters DROP CONSTRAINT item_parameters_item_unique;

CREATE UNIQUE INDEX item_parameters_current_unique
  ON item_parameters (item_id, scale_code) WHERE is_current;
CREATE INDEX idx_item_parameters_run ON item_parameters (calibration_run_id);

COMMENT ON COLUMN item_parameters.n_responses IS
  'Calibration sample size backing this parameter set. The IRT extension
   point (src/lib/scoring/ability-irt-session.ts#scoreSessionAbilityIRT)
   gates real theta scoring on is_current parameters with n_responses at or
   above the model''s N floor (2PL: ~500 responses/item, per
   docs/superpowers/specs/2026-08-12-cognitive-assessments/
   06-battery-and-psychometric-programme.md §4.3/§8.3) — below that floor it
   falls back to sum-correct scoring rather than publish an unstable theta.';
