-- Leadership 360: add the rater-invitation email type.
--
-- Adding the enum value must be its own migration — Postgres forbids USING a new
-- enum value in the same transaction it is added, and the platform default row
-- (next migration) inserts a row with this value.

ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'rater_invite';
