-- Quota readers remain SECURITY INVOKER and obey caller RLS.
ALTER FUNCTION public.get_client_assessment_quota_usage_bulk(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_partner_assessment_quota_usage_bulk(uuid) SET search_path = public, pg_catalog;
