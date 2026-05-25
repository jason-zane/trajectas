-- =============================================================================
-- Archive legacy non-brain library content.
--
-- Live customer-facing content sits under five "brain" dimensions:
-- BlueBrain, GreenBrain, OrangeBrain, PinkBrain, RedBrain — used by the
-- 5Brains Capability Assessment. Everything else (Composure, Connection,
-- Curiosity, Drive, Influence, Integrity, AI Capability, Cognitive Ability,
-- Emotional Intelligence, Interpersonal Skills, Leadership) is legacy from
-- prior assessments (Trajectas Personality Index, AI Capability Index) or
-- empty placeholders that were never used.
--
-- This migration:
--   1) Snapshots every affected row (dimensions, factors, factor_constructs,
--      participant_scores referencing those factors) into _legacy_library_backup.
--   2) Soft-deletes the legacy dimensions and their factors.
--
-- We do NOT touch constructs: all 25 are also wrapped under a brain dimension
-- so none are orphaned. Participant scores under archived factors are
-- preserved as-is — they're historical record for past respondents.
-- =============================================================================

CREATE TABLE IF NOT EXISTS _legacy_library_backup (
  id SERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_table TEXT NOT NULL,
  row_data JSONB NOT NULL
);

INSERT INTO _legacy_library_backup (source_table, row_data)
SELECT 'dimensions', to_jsonb(d) FROM dimensions d
WHERE d.name IN (
  'Composure','Connection','Curiosity','Drive','Influence','Integrity',
  'AI Capability','Cognitive Ability','Emotional Intelligence',
  'Interpersonal Skills','Leadership'
);

INSERT INTO _legacy_library_backup (source_table, row_data)
SELECT 'factors', to_jsonb(f) FROM factors f
WHERE f.dimension_id IN (
  SELECT id FROM dimensions
  WHERE name IN (
    'Composure','Connection','Curiosity','Drive','Influence','Integrity',
    'AI Capability','Cognitive Ability','Emotional Intelligence',
    'Interpersonal Skills','Leadership'
  )
);

INSERT INTO _legacy_library_backup (source_table, row_data)
SELECT 'factor_constructs', to_jsonb(fc) FROM factor_constructs fc
WHERE fc.factor_id IN (
  SELECT id FROM factors WHERE dimension_id IN (
    SELECT id FROM dimensions
    WHERE name IN (
    'Composure','Connection','Curiosity','Drive','Influence','Integrity',
    'AI Capability','Cognitive Ability','Emotional Intelligence',
    'Interpersonal Skills','Leadership'
  )
  )
);

INSERT INTO _legacy_library_backup (source_table, row_data)
SELECT 'participant_scores', to_jsonb(ps) FROM participant_scores ps
WHERE ps.factor_id IN (
  SELECT id FROM factors WHERE dimension_id IN (
    SELECT id FROM dimensions
    WHERE name IN (
    'Composure','Connection','Curiosity','Drive','Influence','Integrity',
    'AI Capability','Cognitive Ability','Emotional Intelligence',
    'Interpersonal Skills','Leadership'
  )
  )
);

UPDATE factors
SET deleted_at = COALESCE(deleted_at, now()),
    is_active = false
WHERE dimension_id IN (
  SELECT id FROM dimensions
  WHERE name IN (
    'Composure','Connection','Curiosity','Drive','Influence','Integrity',
    'AI Capability','Cognitive Ability','Emotional Intelligence',
    'Interpersonal Skills','Leadership'
  )
)
AND deleted_at IS NULL;

UPDATE dimensions
SET deleted_at = COALESCE(deleted_at, now()),
    is_active = false
WHERE name IN (
    'Composure','Connection','Curiosity','Drive','Influence','Integrity',
    'AI Capability','Cognitive Ability','Emotional Intelligence',
    'Interpersonal Skills','Leadership'
  )
  AND deleted_at IS NULL;
