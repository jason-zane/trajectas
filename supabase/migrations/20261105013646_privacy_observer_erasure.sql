-- Follow-up to PR 443. Preserve the applied lifecycle migration.
-- No disposal runs here; keep plan mode through schema-first/app-second rollout.

CREATE FUNCTION private.privacy_check_rater_scope(p_campaign uuid,p_raters uuid[],p_participants uuid[],p_sessions uuid[]) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- Rater deletion cascades to its taking participant. Never expand an approved
  -- manifest silently into another campaign, participant or session.
  PERFORM 1 FROM public.campaign_raters WHERE id=ANY(p_raters) FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.campaign_raters r
    JOIN public.campaign_participants subject ON subject.id=r.subject_participant_id
    WHERE r.id=ANY(p_raters) AND (r.campaign_id IS DISTINCT FROM p_campaign
      OR subject.campaign_id IS DISTINCT FROM p_campaign
      OR (r.session_id IS NOT NULL AND NOT r.session_id=ANY(p_sessions))))
    OR EXISTS(SELECT 1 FROM public.campaign_participants p WHERE p.campaign_rater_id=ANY(p_raters)
      AND (p.campaign_id IS DISTINCT FROM p_campaign OR NOT p.id=ANY(p_participants)))
    OR EXISTS(SELECT 1 FROM public.participant_sessions s JOIN public.campaign_participants p ON p.id=s.campaign_participant_id
      WHERE p.campaign_rater_id=ANY(p_raters) AND NOT s.id=ANY(p_sessions))
    OR EXISTS(SELECT 1 FROM public.participant_sessions s WHERE s.id=ANY(p_sessions)
      AND (s.campaign_id IS DISTINCT FROM p_campaign
        OR (s.campaign_participant_id IS NOT NULL AND NOT s.campaign_participant_id=ANY(p_participants)))) THEN
    RAISE EXCEPTION 'Rater ownership differs from the approved deletion manifest.' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM public.campaign_raters r WHERE r.id=ANY(p_raters)
      AND private.privacy_has_hold(p_campaign,r.subject_participant_id))
    OR EXISTS(SELECT 1 FROM unnest(p_participants) p WHERE private.privacy_has_hold(p_campaign,p)) THEN
    RAISE EXCEPTION 'Related rater records are on hold.' USING ERRCODE='55000';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.privacy_check_rater_scope(uuid,uuid[],uuid[],uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.privacy_check_rater_scope(uuid,uuid[],uuid[],uuid[]) TO service_role;


CREATE OR REPLACE FUNCTION private.privacy_build_manifest(p_participant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE
  person public.campaign_participants; ids uuid[]; raters uuid[]; sessions uuid[]; snapshots uuid[];
  markers text[]; imports uuid[]; runs uuid[]; result jsonb;
BEGIN
  SELECT * INTO person FROM public.campaign_participants WHERE id=p_participant;
  IF person.id IS NULL THEN RAISE EXCEPTION 'Participant not found.' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(array_agg(r.id),'{}') INTO raters FROM public.campaign_raters r
    WHERE r.subject_participant_id=person.id OR r.id=person.campaign_rater_id;
  SELECT array_agg(p.id) INTO ids FROM public.campaign_participants p
    WHERE p.id=person.id OR p.campaign_rater_id=ANY(raters);
  SELECT coalesce(array_agg(s.id),'{}') INTO sessions FROM public.participant_sessions s
    WHERE s.campaign_participant_id=ANY(ids) OR s.id IN
      (SELECT r.session_id FROM public.campaign_raters r WHERE r.id=ANY(raters));
  SELECT coalesce(array_agg(id),'{}') INTO snapshots FROM public.report_snapshots WHERE participant_session_id=ANY(sessions);
  IF cardinality(raters)>5000 OR cardinality(ids)>5000 OR cardinality(sessions)>5000 OR cardinality(snapshots)>5000 THEN
    RAISE EXCEPTION 'Deletion scope needs manual review.' USING ERRCODE='54000';
  END IF;
  markers := ids::text[] || raters::text[] || sessions::text[] || snapshots::text[]
    || ARRAY(SELECT lower(email::text) FROM public.campaign_participants WHERE id=ANY(ids))
    || ARRAY(SELECT person_key::text FROM public.campaign_participants WHERE id=ANY(ids))
    || ARRAY(SELECT access_token FROM public.campaign_participants WHERE id=ANY(ids))
    || ARRAY(SELECT lower(email::text) FROM public.campaign_raters WHERE id=ANY(raters))
    || ARRAY(SELECT access_token FROM public.campaign_raters WHERE id=ANY(raters));
  SELECT coalesce(array_agg(i.id),'{}') INTO imports FROM public.outcome_imports i
    JOIN public.campaigns c ON c.id=person.campaign_id AND c.client_id=i.client_id
    WHERE private.privacy_json_matches(i.rows,markers);
  SELECT coalesce(array_agg(r.id),'{}') INTO runs FROM public.outcome_runs r
    JOIN public.campaigns c ON c.id=person.campaign_id AND c.client_id=r.client_id
    WHERE r.import_id=ANY(imports) OR private.privacy_json_matches(r.input,markers)
      OR private.privacy_json_matches(coalesce(r.result,'{}'),markers);
  SELECT jsonb_build_object(
    'version',1,'participantIds',to_jsonb(ids),'raterIds',to_jsonb(raters),
    -- Governing subjects belong only to hold scope, never to erasure scope.
    'holdParticipantIds',to_jsonb(ARRAY(SELECT x FROM unnest(ids) x UNION
      SELECT subject_participant_id FROM public.campaign_raters WHERE id=ANY(raters))),
    'sessionIds',to_jsonb(sessions),'snapshotIds',to_jsonb(snapshots),
    'objects',coalesce((SELECT jsonb_agg(jsonb_build_object('bucket','reports','path',o.name))
      FROM storage.objects o WHERE o.bucket_id='reports' AND EXISTS
        (SELECT 1 FROM unnest(snapshots) s WHERE starts_with(o.name,'reports/'||s::text||'/'))),'[]'::jsonb)
      || coalesce((SELECT jsonb_agg(jsonb_build_object('bucket','outcome-sources','path',i.storage_path))
        FROM public.outcome_imports i WHERE i.id=ANY(imports)),'[]'::jsonb),
    'blockers',coalesce((SELECT jsonb_agg(x) FROM (
      SELECT jsonb_build_object('kind','shared_outcome_import','id',i) x FROM unnest(imports) i
      UNION ALL SELECT jsonb_build_object('kind','frozen_outcome_run','id',r) FROM unnest(runs) r
      UNION ALL SELECT jsonb_build_object('kind','legacy_pdf_location','id',r.id) FROM public.report_snapshots r
        WHERE r.id=ANY(snapshots) AND r.pdf_url IS NOT NULL AND NOT starts_with(r.pdf_url,'reports/'||r.id::text||'/')
    ) q),'[]'::jsonb),
    'counts',jsonb_build_object('participants',cardinality(ids),'raters',cardinality(raters),'sessions',cardinality(sessions),'snapshots',cardinality(snapshots),
      'responses',(SELECT count(*) FROM public.participant_responses WHERE session_id=ANY(sessions)),
      'scores',(SELECT count(*) FROM public.participant_scores WHERE session_id=ANY(sessions)))
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.privacy_prepare_deletion(p_request uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests; m jsonb; ids uuid[]; raters uuid[]; sessions uuid[]; current_client uuid; manifest_key text;
BEGIN
  r := private.privacy_assert_lease(p_request,p_lease);
  PERFORM 1 FROM public.campaign_participants WHERE id=r.participant_id FOR UPDATE;
  SELECT client_id INTO current_client FROM public.campaigns WHERE id=r.campaign_id FOR UPDATE;
  IF current_client IS DISTINCT FROM r.client_id OR NOT EXISTS(SELECT 1 FROM public.campaign_participants
      WHERE id=r.participant_id AND campaign_id=r.campaign_id) THEN
    RAISE EXCEPTION 'Deletion authority no longer matches ownership.' USING ERRCODE='23514';
  END IF;
  m := private.privacy_build_manifest(r.participant_id);
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(m->'participantIds');
  SELECT coalesce(array_agg(value::uuid),'{}') INTO raters FROM jsonb_array_elements_text(m->'raterIds');
  SELECT coalesce(array_agg(value::uuid),'{}') INTO sessions FROM jsonb_array_elements_text(m->'sessionIds');
  PERFORM private.privacy_check_rater_scope(r.campaign_id,raters,ids,sessions);
  IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE private.privacy_has_hold(r.campaign_id,i)) THEN
    RAISE EXCEPTION 'Related records are on legal hold.' USING ERRCODE='55000';
  END IF;
  UPDATE public.report_snapshots SET deleted_at=coalesce(deleted_at,now())
    WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(m->'snapshotIds')) AND deleted_at IS NULL;
  UPDATE public.campaign_raters SET status='withdrawn' WHERE id=ANY(raters) AND status<>'withdrawn';
  UPDATE public.campaign_participants SET deleted_at=coalesce(deleted_at,now()),privacy_pending_at=coalesce(privacy_pending_at,now()) WHERE id=ANY(ids);
  -- Keep object paths already discovered across partial failures and review.
  m := jsonb_set(m,'{objects}',coalesce((SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
    (m->'objects')||coalesce(r.manifest->'objects','[]')) x),'[]'));
  FOREACH manifest_key IN ARRAY ARRAY['participantIds','raterIds','holdParticipantIds','sessionIds','snapshotIds'] LOOP
    m := jsonb_set(m,ARRAY[manifest_key],coalesce((SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
      (m->manifest_key)||coalesce(r.manifest->manifest_key,'[]')) x),'[]'));
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(m->'holdParticipantIds') p
    WHERE private.privacy_has_hold(r.campaign_id,p.value::uuid)) THEN
    RAISE EXCEPTION 'Related rater records are on hold.' USING ERRCODE='55000';
  END IF;
  UPDATE public.privacy_deletion_requests SET manifest=m,
    status=CASE WHEN jsonb_array_length(m->'blockers')>0 THEN 'review_required' ELSE 'purging' END,
    lease_id=CASE WHEN jsonb_array_length(m->'blockers')>0 THEN NULL ELSE lease_id END,
    lease_expires_at=CASE WHEN jsonb_array_length(m->'blockers')>0 THEN NULL ELSE lease_expires_at END
    WHERE id=r.id;
  INSERT INTO public.privacy_deletion_events(request_id,event_type,counts)
    VALUES(r.id,CASE WHEN jsonb_array_length(m->'blockers')>0 THEN 'review_required' ELSE 'access_revoked' END,m->'counts');
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.privacy_finish_active_deletion(p_request uuid,p_lease uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  r public.privacy_deletion_requests; m jsonb; ids uuid[]; raters uuid[]; sessions uuid[]; snapshots uuid[];
  markers text[]; all_ids uuid[]; outbox uuid[]; context_id uuid; backup_days integer;
BEGIN
  r := private.privacy_assert_lease(p_request,p_lease);
  m := private.privacy_build_manifest(r.participant_id);
  IF jsonb_array_length(m->'blockers')>0 THEN
    RAISE EXCEPTION 'Shared copies require review before completion.' USING ERRCODE='55000';
  END IF;
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(r.manifest->'participantIds');
  SELECT coalesce(array_agg(value::uuid),'{}') INTO sessions FROM jsonb_array_elements_text(r.manifest->'sessionIds');
  SELECT coalesce(array_agg(value::uuid),'{}') INTO snapshots FROM jsonb_array_elements_text(r.manifest->'snapshotIds');
  SELECT coalesce(array_agg(value::uuid),'{}') INTO raters FROM jsonb_array_elements_text(r.manifest->'raterIds');
  IF NOT r.manifest ? 'raterIds' OR NOT r.manifest ? 'holdParticipantIds'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(m->'raterIds') x WHERE NOT x.value::uuid=ANY(raters))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(m->'holdParticipantIds') x
      WHERE NOT (r.manifest->'holdParticipantIds') ? x.value) THEN
    RAISE EXCEPTION 'Rater manifest must be prepared and confirmed before erasure.' USING ERRCODE='55000';
  END IF;
  PERFORM private.privacy_check_rater_scope(r.campaign_id,raters,ids,sessions);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.manifest->'holdParticipantIds') p
    WHERE private.privacy_has_hold(r.campaign_id,p.value::uuid)) THEN
    RAISE EXCEPTION 'Related rater records are on hold.' USING ERRCODE='55000';
  END IF;
  IF ids IS NULL OR NOT (r.participant_id=ANY(ids)) THEN
    RAISE EXCEPTION 'Deletion manifest is not prepared.' USING ERRCODE='55000';
  END IF;
  IF r.ledger_digest IS NULL OR r.ledger_expires_at IS NULL OR r.ledger_expires_at<=now() THEN
    RAISE EXCEPTION 'External replay ledger is not confirmed.' USING ERRCODE='55000';
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE private.privacy_has_hold(r.campaign_id,i)) THEN
    RAISE EXCEPTION 'Related records are on hold.' USING ERRCODE='55000';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.manifest->'objects') o JOIN storage.objects s
    ON s.bucket_id=o->>'bucket' AND s.name=o->>'path') THEN
    RAISE EXCEPTION 'Storage deletion has not been verified.' USING ERRCODE='55000';
  END IF;
  all_ids := ids||raters||sessions||snapshots;
  SELECT all_ids::text[]||array_agg(lower(email::text))||array_agg(person_key::text)||array_agg(access_token)
    INTO markers FROM public.campaign_participants WHERE id=ANY(ids);
  markers := markers || ARRAY(SELECT lower(email::text) FROM public.campaign_raters WHERE id=ANY(raters))
    || ARRAY(SELECT access_token FROM public.campaign_raters WHERE id=ANY(raters));
  SELECT coalesce(array_agg(e.id),'{}') INTO outbox FROM public.integration_events_outbox e
    WHERE e.aggregate_id=ANY(all_ids) OR (e.client_id=r.client_id AND private.privacy_json_matches(e.payload,markers));
  INSERT INTO private.privacy_action_contexts(audit_ids,error_ids)
    SELECT
      coalesce((SELECT array_agg(a.id) FROM public.audit_events a WHERE a.target_id=ANY(all_ids)
        OR (a.client_id=r.client_id AND private.privacy_json_matches(a.metadata,markers))),'{}'),
      coalesce((SELECT array_agg(e.id) FROM public.error_events e
        WHERE private.privacy_json_matches(to_jsonb(e),markers)),'{}')
    RETURNING id INTO context_id;
  PERFORM set_config('privacy.action_context',context_id::text,true);
  DELETE FROM public.audit_events WHERE id IN (SELECT unnest(audit_ids) FROM private.privacy_action_contexts WHERE id=context_id);
  DELETE FROM public.error_events WHERE id IN (SELECT unnest(error_ids) FROM private.privacy_action_contexts WHERE id=context_id);
  DELETE FROM private.privacy_action_contexts WHERE id=context_id;
  DELETE FROM public.integration_webhook_deliveries WHERE integration_event_outbox_id=ANY(outbox);
  DELETE FROM public.integration_events_outbox WHERE id=ANY(outbox);
  DELETE FROM public.integration_external_refs WHERE local_id=ANY(all_ids);
  DELETE FROM public.integration_idempotency_keys WHERE resource_id=ANY(all_ids)
    OR (client_id=r.client_id AND private.privacy_json_matches(coalesce(response_body,'{}'),markers));
  DELETE FROM public.public_builds WHERE participant_id=ANY(ids);
  DELETE FROM public.person_link_audit WHERE affected_participant_ids&&ids;
  DELETE FROM public.campaign_360_snapshots WHERE subject_participant_id=ANY(ids);
  DELETE FROM public.participant_sessions WHERE id=ANY(sessions);
  DELETE FROM public.campaign_raters WHERE id=ANY(raters);
  DELETE FROM public.campaign_participants WHERE id=ANY(ids);
  IF EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=ANY(sessions))
    OR EXISTS(SELECT 1 FROM public.report_snapshots WHERE id=ANY(snapshots))
    OR EXISTS(SELECT 1 FROM public.campaign_participants WHERE id=ANY(ids))
    OR EXISTS(SELECT 1 FROM public.campaign_raters WHERE id=ANY(raters)) THEN
    RAISE EXCEPTION 'Active deletion verification failed.' USING ERRCODE='55000';
  END IF;
  SELECT p.backup_days INTO backup_days FROM public.privacy_retention_policies p WHERE p.id=r.policy_id;
  UPDATE public.privacy_deletion_requests SET status='backup_pending',active_deleted_at=now(),
    backup_expires_at=greatest(now()+make_interval(days=>backup_days),r.ledger_expires_at),summary=r.manifest->'counts',
    lease_id=NULL,lease_expires_at=NULL,last_error_code=NULL WHERE id=r.id;
  INSERT INTO public.privacy_deletion_events(request_id,event_type,counts) VALUES(r.id,'active_deleted',r.manifest->'counts');
END $$;

CREATE OR REPLACE FUNCTION public.privacy_replay_remaining(p_entry jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object(
    'unverifiedRaterScope',CASE WHEN p_entry ? 'raterIds' AND p_entry ? 'holdParticipantIds' THEN 0 ELSE 1 END,
    'raters',(SELECT count(*) FROM public.campaign_raters WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(coalesce(p_entry->'raterIds','[]'::jsonb)))),
    'participants',(SELECT count(*) FROM public.campaign_participants WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_entry->'participantIds'))),
    'sessions',(SELECT count(*) FROM public.participant_sessions WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_entry->'sessionIds'))),
    'snapshots',(SELECT count(*) FROM public.report_snapshots WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_entry->'snapshotIds'))),
    'objects',(SELECT count(*) FROM storage.objects o JOIN jsonb_array_elements(p_entry->'objects') r ON o.bucket_id=r->>'bucket' AND o.name=r->>'path'))
$$;

CREATE OR REPLACE FUNCTION public.privacy_replay_deletion(p_entry jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person public.campaign_participants; policy_id uuid; owner_id uuid; recovery_version text; raters uuid[]; participants uuid[]; sessions uuid[];
BEGIN
  IF NOT p_entry ? 'raterIds' OR NOT p_entry ? 'holdParticipantIds' THEN RAISE EXCEPTION 'Legacy rater scope requires review.' USING ERRCODE='55000'; END IF;
  IF p_entry->>'kind'<>'deletion' OR (p_entry->>'expiresAt')::timestamptz<=now() THEN
    RAISE EXCEPTION 'A current deletion entry is required.';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_entry->'holdParticipantIds') p
    WHERE private.privacy_has_hold((p_entry->>'campaignId')::uuid,p.value::uuid)) THEN
    RAISE EXCEPTION 'Related rater records are on hold.' USING ERRCODE='55000';
  END IF;
  SELECT * INTO person FROM public.campaign_participants WHERE id=(p_entry->>'participantId')::uuid FOR UPDATE;
  IF person.id IS NULL THEN
    SELECT coalesce(array_agg(value::uuid),'{}') INTO raters FROM jsonb_array_elements_text(p_entry->'raterIds');
    SELECT coalesce(array_agg(value::uuid),'{}') INTO participants FROM jsonb_array_elements_text(p_entry->'participantIds');
    SELECT coalesce(array_agg(value::uuid),'{}') INTO sessions FROM jsonb_array_elements_text(p_entry->'sessionIds');
    PERFORM private.privacy_check_rater_scope((p_entry->>'campaignId')::uuid,raters,participants,sessions);
    DELETE FROM public.campaign_raters WHERE id=ANY(raters);
    RETURN false;
  END IF;
  IF person.campaign_id<>(p_entry->>'campaignId')::uuid OR NOT (p_entry->'participantIds' ? person.id::text) THEN
    RAISE EXCEPTION 'Restored ownership differs from the recovery ledger.';
  END IF;
  SELECT client_id INTO owner_id FROM public.campaigns WHERE id=person.campaign_id;
  recovery_version:='recovery-only-'||(p_entry->>'backupDays');
  INSERT INTO public.privacy_retention_policies(name,version,status,scope,recovery_only,retention_months,backup_days,approved_at)
    VALUES('Recovery replay only; do not assign to campaigns',recovery_version,'active','assessment',true,1,
      (p_entry->>'backupDays')::integer,(p_entry->>'approvedAt')::timestamptz) ON CONFLICT(version) DO NOTHING;
  SELECT id INTO policy_id FROM public.privacy_retention_policies WHERE version=recovery_version;
  INSERT INTO public.privacy_deletion_requests(id,participant_id,campaign_id,client_id,reason,policy_id,status,approved_at,manifest)
    VALUES((p_entry->>'id')::uuid,person.id,person.campaign_id,owner_id,'individual_request',policy_id,'approved',
      (p_entry->>'approvedAt')::timestamptz,jsonb_build_object('participantIds',p_entry->'participantIds','raterIds',p_entry->'raterIds','holdParticipantIds',p_entry->'holdParticipantIds',
        'sessionIds',p_entry->'sessionIds','snapshotIds',p_entry->'snapshotIds','objects',p_entry->'objects'))
    ON CONFLICT(id) DO UPDATE SET status='approved',participant_id=EXCLUDED.participant_id,campaign_id=EXCLUDED.campaign_id,
      client_id=EXCLUDED.client_id,policy_id=EXCLUDED.policy_id,approved_at=EXCLUDED.approved_at,manifest=EXCLUDED.manifest,
      active_deleted_at=NULL,completed_at=NULL,backup_expires_at=NULL,lease_id=NULL,lease_expires_at=NULL,
      attempts=0,next_attempt_at=now();
  RETURN true;
END $$;
