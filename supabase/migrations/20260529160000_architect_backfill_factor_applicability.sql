-- =============================================================================
-- Architect: backfill applicability tags on the 25 live factors
--
-- Makes the Architect eligibility filter active (previously every factor had
-- empty tags = "applies to all", so the filter was inert). Tags are I-O
-- judgement calls and fully editable in the factor form afterwards:
--   outcomes — selection | development | team_composition
--   levels   — ic | first_line_manager | mid_manager | senior_leader | executive
--   functions left empty (= applies to all functions) to avoid over-filtering.
--
-- Conventions applied:
--   - team_composition added to interpersonal/collaborative factors.
--   - strategic/commercial/directing factors skew mid+ / senior.
--   - execution/organisation/process-discipline skew IC -> mid.
--   - people-development is manager+ (no IC).
-- Idempotent: re-running sets the same values. Matches by slug.
-- =============================================================================

UPDATE factors AS f SET
  applicable_outcomes  = v.outcomes,
  applicable_levels    = v.levels
FROM (VALUES
  ('achievement-drive',        ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('analytical-thinking',      ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('building-relationships',   ARRAY['selection','development','team_composition']::text[], ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('collaboration',            ARRAY['selection','development','team_composition']::text[], ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('commercial-acumen',        ARRAY['selection','development']::text[],                    ARRAY['mid_manager','senior_leader','executive']::text[]),
  ('communication',            ARRAY['selection','development','team_composition']::text[], ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('critical-analysis-2',      ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('decision-prioritisation',  ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('decisive-leadership',      ARRAY['selection','development']::text[],                    ARRAY['first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('emotional-regulation',     ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('execution',                ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager']::text[]),
  ('flexibility-2',            ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('influence-2',              ARRAY['selection','development','team_composition']::text[], ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('ingenuity',                ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('interpersonal-sensitivity',ARRAY['selection','development','team_composition']::text[], ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('judgement',                ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('learning-agility',         ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('organisation-2',           ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager']::text[]),
  ('people-development',       ARRAY['selection','development']::text[],                    ARRAY['first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('performance-tenacity',     ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('process-discipline',       ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager']::text[]),
  ('resilience-2',             ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('self-insight',             ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[]),
  ('strategic-vision',         ARRAY['selection','development']::text[],                    ARRAY['mid_manager','senior_leader','executive']::text[]),
  ('visible-self-development', ARRAY['selection','development']::text[],                    ARRAY['ic','first_line_manager','mid_manager','senior_leader','executive']::text[])
) AS v(slug, outcomes, levels)
WHERE f.slug = v.slug;
