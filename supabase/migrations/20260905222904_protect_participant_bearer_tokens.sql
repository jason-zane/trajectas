-- Rollout phase 2: apply only after the application selects explicit safe
-- participant columns (commercial launch readiness phase 1). Old SELECT *
-- clients fail closed after this change. Service-role invitation/runtime
-- operations retain access; RLS continues to scope every permitted column.
REVOKE SELECT ON public.campaign_participants FROM PUBLIC, anon, authenticated;
REVOKE SELECT (access_token) ON public.campaign_participants FROM PUBLIC, anon, authenticated;
DO $$
DECLARE safe_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO safe_columns
    FROM pg_attribute
   WHERE attrelid = 'public.campaign_participants'::regclass
     AND attnum > 0 AND NOT attisdropped AND attname <> 'access_token';
  EXECUTE format('GRANT SELECT (%s) ON public.campaign_participants TO authenticated', safe_columns);
END;
$$;
NOTIFY pgrst, 'reload schema';
