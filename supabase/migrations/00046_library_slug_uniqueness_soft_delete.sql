BEGIN;

ALTER TABLE dimensions DROP CONSTRAINT IF EXISTS dimensions_slug_unique;
ALTER TABLE factors DROP CONSTRAINT IF EXISTS factors_slug_unique;
ALTER TABLE constructs DROP CONSTRAINT IF EXISTS constructs_slug_unique;

DROP INDEX IF EXISTS dimensions_slug_unique;
DROP INDEX IF EXISTS factors_slug_unique;
DROP INDEX IF EXISTS constructs_slug_unique;

CREATE UNIQUE INDEX dimensions_slug_unique
  ON dimensions (slug)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX factors_slug_unique
  ON factors (slug)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX constructs_slug_unique
  ON constructs (slug)
  WHERE deleted_at IS NULL;

COMMIT;
