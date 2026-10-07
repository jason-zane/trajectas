BEGIN;
-- Retain paused events in the existing terminal status: older dispatchers and
-- compatible rollback builds select pending rows, so they cannot drain this backlog.
ALTER TABLE public.integration_events_outbox
  ADD COLUMN requires_review boolean NOT NULL DEFAULT false,
  ADD COLUMN held_at timestamptz;
ALTER TABLE public.integration_events_outbox ADD CONSTRAINT webhook_review_is_held
  CHECK (NOT requires_review OR (status='failed' AND dispatched_at IS NULL));
CREATE INDEX idx_integration_outbox_review ON public.integration_events_outbox(client_id,created_at,id)
  WHERE requires_review;

CREATE FUNCTION private.hold_paused_webhook_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('client:'||NEW.client_id::text,0));
  IF NOT COALESCE((SELECT (module_flags->>'webhookDelivery')::boolean FROM public.workspace_feature_settings WHERE client_id=NEW.client_id),true) THEN
    NEW.status:='failed'; NEW.requires_review:=true; NEW.held_at:=now(); NEW.dispatched_at:=NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.hold_paused_webhook_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.hold_paused_webhook_event() TO service_role;
CREATE TRIGGER hold_paused_webhook_event BEFORE INSERT ON public.integration_events_outbox
  FOR EACH ROW EXECUTE FUNCTION private.hold_paused_webhook_event();

CREATE FUNCTION private.hold_existing_webhooks_on_pause()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('client:'||NEW.client_id::text,0));
  IF NOT COALESCE((NEW.module_flags->>'webhookDelivery')::boolean,true) THEN
    UPDATE public.integration_events_outbox SET status='failed', requires_review=true, held_at=now()
      WHERE client_id=NEW.client_id AND status IN ('pending','dispatched') AND dispatched_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.hold_existing_webhooks_on_pause() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.hold_existing_webhooks_on_pause() TO service_role;
CREATE TRIGGER hold_existing_webhooks_on_pause AFTER INSERT OR UPDATE ON public.workspace_feature_settings
  FOR EACH ROW EXECUTE FUNCTION private.hold_existing_webhooks_on_pause();

CREATE FUNCTION public.release_reviewed_webhook_events(p_client_id uuid,p_actor uuid,p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE selected_count integer;
BEGIN
  IF p_client_id IS NULL OR p_actor IS NULL OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 100
    OR (SELECT count(DISTINCT id) FROM unnest(p_ids) id)<>cardinality(p_ids) THEN RAISE EXCEPTION 'Invalid reviewed webhook batch'; END IF;
  -- Same lock as feature patches: pause/re-enable cannot race this release.
  PERFORM pg_advisory_xact_lock(hashtextextended('client:'||p_client_id::text,0));
  IF NOT COALESCE((SELECT (module_flags->>'webhookDelivery')::boolean FROM public.workspace_feature_settings WHERE client_id=p_client_id),true) THEN
    RAISE EXCEPTION 'Enable client webhook delivery before releasing saved events';
  END IF;
  SELECT count(*) INTO selected_count FROM (SELECT id FROM public.integration_events_outbox
    WHERE client_id=p_client_id AND id=ANY(p_ids) AND requires_review AND status='failed'
      AND dispatched_at IS NULL AND attempts<5 ORDER BY id FOR UPDATE) reviewed;
  IF selected_count<>cardinality(p_ids) THEN RAISE EXCEPTION 'Saved events changed. Refresh and review the new batch'; END IF;
  UPDATE public.integration_events_outbox SET status='pending',requires_review=false,available_at=now(),last_error=NULL
    WHERE client_id=p_client_id AND id=ANY(p_ids);
  -- Preserve attempts and event IDs; receivers keep their existing deduplication key.
  INSERT INTO public.audit_events(actor_profile_id,event_type,target_table,target_id,client_id,metadata)
    VALUES(p_actor,'integration.webhook_backlog_released','clients',p_client_id,p_client_id,
      jsonb_build_object('eventIds',to_jsonb(p_ids),'count',selected_count));
  RETURN selected_count;
END $$;
REVOKE ALL ON FUNCTION public.release_reviewed_webhook_events(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_reviewed_webhook_events(uuid,uuid,uuid[]) TO service_role;
COMMIT;
