-- Rollout phase 2: after application confidentiality gates are deployed.
-- These operational tables can retain historical bearer URLs in launch,
-- idempotency, event, or echoed delivery-response payloads. They are accessed
-- by service-role integration workers only; authenticated tenant members use
-- the scoped API, which re-evaluates the current campaign confidentiality.
REVOKE SELECT ON public.integration_launches,
  public.integration_idempotency_keys,
  public.integration_events_outbox,
  public.integration_webhook_deliveries
FROM PUBLIC, anon, authenticated;
-- Table-level revocation does not clear earlier column-level grants.
DO $$
DECLARE
  target_table text;
  columns_sql text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'integration_launches', 'integration_idempotency_keys',
    'integration_events_outbox', 'integration_webhook_deliveries'
  ] LOOP
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
      INTO columns_sql FROM pg_attribute
     WHERE attrelid = format('public.%I', target_table)::regclass
       AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s) ON public.%I FROM PUBLIC, anon, authenticated', columns_sql, target_table);
  END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
