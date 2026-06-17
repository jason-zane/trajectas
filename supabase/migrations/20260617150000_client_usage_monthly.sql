-- 20260617150000_client_usage_monthly.sql
-- Per-client monthly usage (completed assessments) for the Business Centre's
-- usage-over-time views. Counts completed campaign participants (360 raters and
-- soft-deleted excluded), bucketed by completed_at month.
--
-- security_invoker so the querying role's RLS applies; the admin DAL reads it
-- via the service-role client (which bypasses RLS), and there is no client/
-- partner grant — this is platform-admin reporting only.

CREATE OR REPLACE VIEW client_usage_monthly
WITH (security_invoker = on) AS
SELECT
  c.client_id,
  date_trunc('month', cp.completed_at) AS month,
  count(*)::int AS completed_count
FROM campaign_participants cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.deleted_at IS NULL
  AND cp.campaign_rater_id IS NULL
  AND cp.status = 'completed'
  AND cp.completed_at IS NOT NULL
  AND c.deleted_at IS NULL
  AND c.client_id IS NOT NULL
GROUP BY c.client_id, date_trunc('month', cp.completed_at);

COMMENT ON VIEW client_usage_monthly IS
  'Per-client count of completed assessments bucketed by completed_at month. Powers usage-over-time in the Business Centre. Raters and soft-deleted participants excluded.';