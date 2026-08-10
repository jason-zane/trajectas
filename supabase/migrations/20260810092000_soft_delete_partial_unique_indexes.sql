-- Removal was a one-way door: the unique constraints on campaign_assessments
-- and the client/partner assessment-assignment tables counted soft-deleted /
-- deactivated rows, so re-adding a removed assessment or reassigning a
-- removed entitlement failed on the ghost row ("duplicate key value").
--
-- Replace each full unique constraint with a partial unique index over live
-- rows only: one LIVE row per pair, any number of historical rows.

ALTER TABLE campaign_assessments
  DROP CONSTRAINT IF EXISTS campaign_assessments_unique;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_assessments_live_unique
  ON campaign_assessments (campaign_id, assessment_id)
  WHERE deleted_at IS NULL;

ALTER TABLE client_assessment_assignments
  DROP CONSTRAINT IF EXISTS uq_client_assessment_assignment;
CREATE UNIQUE INDEX IF NOT EXISTS client_assessment_assignments_active_unique
  ON client_assessment_assignments (client_id, assessment_id)
  WHERE is_active;

ALTER TABLE partner_assessment_assignments
  DROP CONSTRAINT IF EXISTS uq_partner_assessment;
CREATE UNIQUE INDEX IF NOT EXISTS partner_assessment_assignments_active_unique
  ON partner_assessment_assignments (partner_id, assessment_id)
  WHERE is_active;
