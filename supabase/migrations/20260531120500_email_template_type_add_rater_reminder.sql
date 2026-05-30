-- Leadership 360: add the rater-reminder email type. Its own migration because
-- Postgres forbids USING a new enum value in the transaction that adds it (the
-- seed in the next migration inserts a row with this value).

ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'rater_reminder';
