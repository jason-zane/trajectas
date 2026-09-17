-- Public Role Builder: add the two new email types.
--
-- Adding the enum value must be its own migration — Postgres forbids USING a
-- new enum value in the same transaction it is added (see
-- 20260530150000_email_template_type_add_rater_invite.sql for the same
-- pattern). The platform default rows follow in the next migration.

ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'public_build_code';
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'public_build_report';
