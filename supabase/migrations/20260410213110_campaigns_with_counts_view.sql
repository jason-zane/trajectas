-- View that joins campaigns with their participant, completed, and assessment
-- counts in a single query. Used by getCampaigns() to eliminate a prior
-- sequential completed-count round-trip. security_invoker=true preserves
-- the underlying campaigns table's RLS so the view does not become a
-- backdoor for cross-tenant reads.

CREATE OR REPLACE VIEW campaigns_with_counts
WITH (security_invoker = true)
AS
SELECT
  c.*,
  COALESCE(
    (SELECT COUNT(*)::int
     FROM campaign_participants cp
     WHERE cp.campaign_id = c.id AND cp.deleted_at IS NULL),
    0
  ) AS participant_count,
  COALESCE(
    (SELECT COUNT(*)::int
     FROM campaign_participants cp
     WHERE cp.campaign_id = c.id
       AND cp.deleted_at IS NULL
       AND cp.status = 'completed'),
    0
  ) AS completed_count,
  COALESCE(
    (SELECT COUNT(*)::int
     FROM campaign_assessments ca
     WHERE ca.campaign_id = c.id AND ca.deleted_at IS NULL),
    0
  ) AS assessment_count
FROM campaigns c;

GRANT SELECT ON campaigns_with_counts TO authenticated, anon, service_role;

COMMENT ON VIEW campaigns_with_counts IS
  'Campaigns with participant_count, completed_count, and assessment_count inlined. Used by getCampaigns() to eliminate a sequential completed-count query. security_invoker=true so the view inherits RLS from the campaigns table.';;
