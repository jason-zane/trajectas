-- Participant lifecycle/identity/token writes and integration worker payloads
-- are owned by authorized server operations. Ordinary Data API credentials,
-- including a platform-admin JWT, must not mint a known participant bearer or
-- rewrite its campaign/email ownership outside those application gates.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON public.campaign_participants,
   public.integration_launches,
   public.integration_idempotency_keys,
   public.integration_events_outbox,
   public.integration_webhook_deliveries
FROM PUBLIC, anon, authenticated;

-- Earlier column ACLs survive a table-level revoke. Clear every writable
-- column grant too; SELECT column grants from the prior migration stay intact.
DO $$
DECLARE
  target_table text;
  columns_sql text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'campaign_participants', 'integration_launches',
    'integration_idempotency_keys', 'integration_events_outbox',
    'integration_webhook_deliveries'
  ] LOOP
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
      INTO columns_sql FROM pg_attribute
     WHERE attrelid = format('public.%I', target_table)::regclass
       AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE INSERT (%s), UPDATE (%s) ON public.%I FROM PUBLIC, anon, authenticated',
      columns_sql, columns_sql, target_table);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
