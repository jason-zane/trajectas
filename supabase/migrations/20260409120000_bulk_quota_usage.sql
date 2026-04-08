-- Bulk quota usage for client and partner assessment assignments.
-- Returns one row per assessment with the live quota usage count.

CREATE OR REPLACE FUNCTION get_client_assessment_quota_usage_bulk(
  p_client_id UUID
)
RETURNS TABLE (assessment_id UUID, quota_used INT) AS $$
  SELECT
    ca.assessment_id,
    COALESCE(COUNT(cp.id)::INT, 0) AS quota_used
  FROM campaign_assessments ca
  JOIN campaigns c ON c.id = ca.campaign_id
  LEFT JOIN campaign_participants cp
    ON cp.campaign_id = c.id
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
  WHERE c.client_id = p_client_id
    AND c.deleted_at IS NULL
  GROUP BY ca.assessment_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_client_assessment_quota_usage_bulk IS
  'Returns quota usage counts for all assessments belonging to a client in a single query.';

CREATE OR REPLACE FUNCTION get_partner_assessment_quota_usage_bulk(
  p_partner_id UUID
)
RETURNS TABLE (assessment_id UUID, quota_used INT) AS $$
  SELECT
    ca.assessment_id,
    COALESCE(COUNT(cp.id)::INT, 0) AS quota_used
  FROM campaign_assessments ca
  JOIN campaigns c ON c.id = ca.campaign_id
  LEFT JOIN campaign_participants cp
    ON cp.campaign_id = c.id
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
  WHERE c.partner_id = p_partner_id
    AND c.deleted_at IS NULL
  GROUP BY ca.assessment_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_partner_assessment_quota_usage_bulk IS
  'Returns quota usage counts for all assessments under a partner in a single query.';
