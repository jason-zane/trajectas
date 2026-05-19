-- Fix processing failure on construct-level assessments (e.g. 5Brains).
--
-- The Supabase JS client's
--   .upsert(rows, { onConflict: 'session_id,construct_id' })
-- translates to Postgres
--   INSERT ... ON CONFLICT (session_id, construct_id) DO UPDATE ...
-- with no WHERE clause. Postgres requires an exact-match unique index for
-- ON CONFLICT inference, and the existing partial index
--   participant_scores_unique_construct
--     ON (session_id, construct_id) WHERE scoring_level = 'construct'
-- could only be matched by ON CONFLICT (cols) WHERE scoring_level = 'construct'.
-- So scoring of construct-level assessments was failing with
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- and the session ended in processing_status = 'failed' even though every
-- response had been saved.
--
-- Replace the partial unique index with a full unique index on
-- (session_id, construct_id). NULLs are distinct in Postgres unique indexes by
-- default, so factor-level rows (construct_id IS NULL) remain unconstrained
-- and the existing participant_scores_unique on (session_id, factor_id) still
-- handles factor-level uniqueness.

DROP INDEX IF EXISTS participant_scores_unique_construct;

CREATE UNIQUE INDEX participant_scores_unique_construct
  ON participant_scores (session_id, construct_id);
