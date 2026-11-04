-- Additive privacy lifecycle. No existing record is scheduled or erased.
-- All new persistence and RPCs are service-only; the server DAL owns authority.
CREATE TABLE public.privacy_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  version text NOT NULL UNIQUE CHECK (length(version) BETWEEN 1 AND 80),
  scope text NOT NULL DEFAULT 'assessment' CHECK (scope IN ('assessment','operations')),
  recovery_only boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  retention_months integer CHECK (retention_months BETWEEN 1 AND 120),
  abandoned_days integer CHECK (abandoned_days BETWEEN 1 AND 365),
  diagnostic_days integer CHECK (diagnostic_days BETWEEN 1 AND 365),
  audit_days integer CHECK (audit_days BETWEEN 1 AND 3650),
  backup_days integer CHECK (backup_days BETWEEN 1 AND 365),
  research_allowed boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'active' OR (approved_at IS NOT NULL AND backup_days IS NOT NULL
    AND ((scope='assessment' AND retention_months IS NOT NULL)
      OR (scope='operations' AND diagnostic_days IS NOT NULL AND audit_days IS NOT NULL))))
);

CREATE TABLE public.privacy_notice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE CHECK (length(version) BETWEEN 1 AND 80),
  audience text NOT NULL DEFAULT 'participant' CHECK (audience IN ('participant','website')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 40000),
  acknowledgement_label text NOT NULL DEFAULT 'I have read this information.' CHECK (length(acknowledgement_label) BETWEEN 1 AND 500),
  research_label text NOT NULL DEFAULT '' CHECK (length(research_label)<=1000),
  body_hash text NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  research_choice_enabled boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE public.campaign_privacy_settings (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  retention_policy_id uuid REFERENCES public.privacy_retention_policies(id),
  notice_version_id uuid REFERENCES public.privacy_notice_versions(id),
  notice_effective_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.participant_privacy_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.campaign_participants(id) ON DELETE CASCADE,
  notice_version_id uuid NOT NULL REFERENCES public.privacy_notice_versions(id),
  notice_hash text NOT NULL CHECK (notice_hash ~ '^[a-f0-9]{64}$'),
  purpose text NOT NULL CHECK (purpose IN ('assessment_notice','norm_research')),
  accepted boolean NOT NULL,
  channel text NOT NULL CHECK (channel IN ('online','client_attestation')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX privacy_assessment_receipt_once ON public.participant_privacy_receipts(participant_id,notice_version_id)
  WHERE purpose='assessment_notice';

CREATE TABLE public.privacy_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.campaign_participants(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  review_at timestamptz NOT NULL,
  released_at timestamptz,
  released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX privacy_active_holds ON public.privacy_legal_holds(campaign_id,participant_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX privacy_one_operations_policy ON public.privacy_retention_policies(scope) WHERE status='active' AND scope='operations';

CREATE TABLE public.privacy_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Replay identifiers intentionally survive active-data deletion, then expire.
  participant_id uuid UNIQUE,
  campaign_id uuid,
  client_id uuid,
  reason text NOT NULL CHECK (reason IN ('individual_request','retention_expiry','engagement_end')),
  policy_id uuid REFERENCES public.privacy_retention_policies(id),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN
    ('requested','approved','purging','review_required','backup_pending','processor_pending','completed','failed','cancelled')),
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  active_deleted_at timestamptz,
  backup_expires_at timestamptz,
  completed_at timestamptz,
  ledger_digest text CHECK (ledger_digest ~ '^[a-f0-9]{64}$'),
  ledger_expires_at timestamptz,
  lease_id uuid,
  lease_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text CHECK (length(last_error_code) <= 80),
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(manifest)='object'),
  provider_tasks jsonb NOT NULL DEFAULT '[{"processor":"email_and_recipient_copies","status":"pending"},{"processor":"migration_source_and_exports","status":"pending"},{"processor":"shared_processor_and_support_copies","status":"pending"}]'::jsonb CHECK (jsonb_typeof(provider_tasks)='array'),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (status IN ('requested','cancelled') OR approved_at IS NOT NULL),
  CHECK (status <> 'processor_pending' OR (participant_id IS NULL AND campaign_id IS NULL AND client_id IS NULL AND manifest='{}'::jsonb)),
  CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND participant_id IS NULL AND manifest='{}'::jsonb))
);
CREATE INDEX privacy_deletion_queue ON public.privacy_deletion_requests(status,next_attempt_at);

CREATE TABLE public.privacy_deletion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.privacy_deletion_requests(id),
  event_type text NOT NULL CHECK (event_type IN
    ('requested','approved','claimed','access_revoked','review_required','retry','active_deleted','provider_confirmed','processor_pending','completed','cancelled')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.privacy_account_deletion_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE,
  requested_at timestamptz NOT NULL,
  attempted_at timestamptz,
  deleted_at timestamptz,
  replay_until timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','failed','auth_deleted','completed')),
  attempts integer NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_expires_at timestamptz,
  error_code text CHECK (length(error_code) <= 80),
  CHECK (status <> 'completed' OR (profile_id IS NULL AND deleted_at IS NOT NULL))
);

ALTER TABLE public.campaign_participants ADD COLUMN privacy_pending_at timestamptz;
ALTER TABLE public.campaign_participants ADD COLUMN research_restricted_at timestamptz;
ALTER TABLE public.report_snapshots ADD COLUMN deleted_at timestamptz;
CREATE INDEX report_snapshots_active ON public.report_snapshots(id) WHERE deleted_at IS NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['privacy_retention_policies','privacy_notice_versions','campaign_privacy_settings',
    'participant_privacy_receipts','privacy_legal_holds','privacy_deletion_requests','privacy_deletion_events',
    'privacy_account_deletion_receipts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

CREATE FUNCTION public.privacy_activate_policy(p_policy uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE policy public.privacy_retention_policies;
BEGIN
  PERFORM pg_advisory_xact_lock(740492331);
  SELECT * INTO policy FROM public.privacy_retention_policies WHERE id=p_policy AND status='draft' AND NOT recovery_only FOR UPDATE;
  IF policy.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND is_active AND role='platform_admin') THEN
    RAISE EXCEPTION 'Draft policy and active platform approver required.' USING ERRCODE='23514';
  END IF;
  IF policy.scope='operations' THEN
    UPDATE public.privacy_retention_policies SET status='retired' WHERE status='active' AND scope='operations';
  END IF;
  UPDATE public.privacy_retention_policies SET status='active',approved_by=p_actor,approved_at=now() WHERE id=policy.id;
END $$;

CREATE FUNCTION public.privacy_claim_account_deletion(p_profile uuid DEFAULT NULL) RETURNS SETOF public.privacy_account_deletion_receipts
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target uuid; receipt public.privacy_account_deletion_receipts;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.privacy_retention_policies WHERE scope='operations' AND status='active') THEN RETURN; END IF;
  SELECT id INTO target FROM public.profiles WHERE scheduled_deletion_at<=now()
    AND (p_profile IS NULL OR id=p_profile)
    AND NOT EXISTS(SELECT 1 FROM public.privacy_account_deletion_receipts r WHERE r.profile_id=profiles.id AND r.lease_expires_at>now())
    ORDER BY scheduled_deletion_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF target IS NOT NULL THEN
    INSERT INTO public.privacy_account_deletion_receipts(profile_id,requested_at)
      SELECT id,coalesce(deletion_requested_at,scheduled_deletion_at) FROM public.profiles WHERE id=target ON CONFLICT DO NOTHING;
  END IF;
  SELECT * INTO receipt FROM public.privacy_account_deletion_receipts r WHERE r.status IN ('pending','failed')
    AND (p_profile IS NULL OR r.profile_id=p_profile)
    AND r.profile_id IS NOT NULL AND (r.lease_expires_at IS NULL OR r.lease_expires_at<now()) AND r.attempts<20
    ORDER BY r.requested_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF receipt.id IS NULL THEN RETURN; END IF;
  -- Existing sessions may outlive Auth deletion. Server authorisation uses is_active.
  UPDATE public.profiles SET is_active=false WHERE id=receipt.profile_id;
  UPDATE public.privacy_account_deletion_receipts SET status='pending',attempted_at=now(),attempts=attempts+1,
    lease_id=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',error_code=NULL WHERE id=receipt.id;
  RETURN QUERY SELECT * FROM public.privacy_account_deletion_receipts WHERE id=receipt.id;
END $$;

CREATE FUNCTION public.privacy_finish_account_deletion(p_receipt uuid,p_lease uuid,p_replay_until timestamptz,p_error text DEFAULT NULL) RETURNS void
-- Narrow elevated read of auth.users verifies absence; do not grant broad Auth
-- table access to service_role. Execute is revoked from public/browser roles.
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.privacy_account_deletion_receipts;
BEGIN
  SELECT * INTO r FROM public.privacy_account_deletion_receipts WHERE id=p_receipt FOR UPDATE;
  IF r.id IS NULL OR p_lease IS NULL OR r.lease_id IS DISTINCT FROM p_lease OR r.lease_expires_at IS NULL OR r.lease_expires_at<=now() THEN
    RAISE EXCEPTION 'Account deletion lease expired.' USING ERRCODE='55000';
  END IF;
  IF p_error IS NOT NULL THEN
    IF p_error !~ '^[a-z0-9_]{1,80}$' THEN RAISE EXCEPTION 'Use a fixed failure code.'; END IF;
    UPDATE public.privacy_account_deletion_receipts SET status='failed',error_code=p_error,lease_id=NULL,lease_expires_at=NULL WHERE id=r.id;
    RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=r.profile_id) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=r.profile_id)
    OR p_replay_until<now()+interval '1 day' THEN
    RAISE EXCEPTION 'Auth deletion is not verified.' USING ERRCODE='55000';
  END IF;
  UPDATE public.privacy_account_deletion_receipts SET status='auth_deleted',deleted_at=now(),replay_until=p_replay_until,
    lease_id=NULL,lease_expires_at=NULL,error_code=NULL WHERE id=r.id;
END $$;

CREATE FUNCTION private.privacy_has_hold(p_campaign uuid,p_participant uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.privacy_legal_holds h
    WHERE h.campaign_id=p_campaign AND (h.participant_id IS NULL OR h.participant_id=p_participant)
      AND h.released_at IS NULL)
$$;

CREATE FUNCTION private.privacy_json_matches(p_value jsonb,p_values text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM jsonb_path_query(p_value,'$.** ? (@.type() == "string")') v,
    unnest(p_values) marker WHERE length(marker)>5 AND strpos(lower(v #>> '{}'),marker)>0)
$$;

CREATE FUNCTION private.privacy_freeze_version() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_TABLE_NAME='privacy_retention_policies' AND OLD.status <> 'draft'
    AND (to_jsonb(NEW)-'status'-'approved_by') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'approved_by') THEN
    RAISE EXCEPTION 'An approved retention policy requires a new version.' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='privacy_notice_versions' AND OLD.status <> 'draft'
    AND (to_jsonb(NEW)-'status'-'published_by') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'published_by') THEN
    RAISE EXCEPTION 'A published notice requires a new version.' USING ERRCODE='23514';
  END IF;
  IF OLD.status <> 'draft' AND NEW.status='draft' THEN
    RAISE EXCEPTION 'An approved version cannot become a draft.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_policy_freeze BEFORE UPDATE ON public.privacy_retention_policies FOR EACH ROW EXECUTE FUNCTION private.privacy_freeze_version();
CREATE TRIGGER privacy_notice_freeze BEFORE UPDATE ON public.privacy_notice_versions FOR EACH ROW EXECUTE FUNCTION private.privacy_freeze_version();

CREATE FUNCTION private.privacy_notice_hash() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.body_hash := encode(sha256(convert_to(NEW.title||E'\n'||NEW.body||E'\n'||NEW.acknowledgement_label||E'\n'||NEW.research_label,'UTF8')),'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_notice_a_content_hash BEFORE INSERT OR UPDATE ON public.privacy_notice_versions
  FOR EACH ROW EXECUTE FUNCTION private.privacy_notice_hash();

CREATE FUNCTION private.privacy_guard_pending_participant() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.privacy_pending_at IS NOT NULL AND
    (NEW.privacy_pending_at IS NULL OR NEW.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'A participant in permanent deletion cannot be restored.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_pending_participant_guard BEFORE UPDATE ON public.campaign_participants
  FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_pending_participant();

CREATE FUNCTION private.privacy_guard_session_write() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE session_id uuid;
BEGIN
  IF TG_TABLE_NAME='report_snapshots' THEN session_id := NEW.participant_session_id;
  ELSE session_id := NEW.session_id; END IF;
  IF EXISTS(SELECT 1 FROM public.participant_sessions s JOIN public.campaign_participants p ON p.id=s.campaign_participant_id
      WHERE s.id=session_id AND p.privacy_pending_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Participant processing has been revoked.' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='participant_responses' AND EXISTS(
    SELECT 1 FROM public.participant_sessions s
      JOIN public.campaign_participants p ON p.id=s.campaign_participant_id
      JOIN public.campaign_privacy_settings settings ON settings.campaign_id=p.campaign_id
    WHERE s.id=session_id AND settings.notice_version_id IS NOT NULL AND p.created_at>=settings.notice_effective_at
      AND NOT EXISTS(SELECT 1 FROM public.participant_privacy_receipts r
        WHERE r.participant_id=p.id AND r.notice_version_id=settings.notice_version_id
          AND r.purpose='assessment_notice' AND r.accepted)) THEN
    RAISE EXCEPTION 'PRIVACY_NOTICE_REQUIRED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_response_write_guard BEFORE INSERT OR UPDATE ON public.participant_responses FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_session_write();
CREATE TRIGGER privacy_score_write_guard BEFORE INSERT OR UPDATE ON public.participant_scores FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_session_write();
CREATE TRIGGER privacy_snapshot_write_guard BEFORE INSERT OR UPDATE ON public.report_snapshots FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_session_write();

CREATE FUNCTION public.privacy_claim_deletion(p_request uuid DEFAULT NULL) RETURNS SETOF public.privacy_deletion_requests
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE selected_id uuid;
BEGIN
  SELECT r.id INTO selected_id FROM public.privacy_deletion_requests r
  JOIN public.privacy_retention_policies p ON p.id=r.policy_id AND p.status='active' AND p.scope='assessment'
  WHERE r.status IN ('approved','purging') AND (p_request IS NULL OR r.id=p_request) AND r.attempts<20 AND r.next_attempt_at<=now()
    AND (r.lease_expires_at IS NULL OR r.lease_expires_at<now())
    AND NOT private.privacy_has_hold(r.campaign_id,r.participant_id)
  ORDER BY r.requested_at FOR UPDATE OF r SKIP LOCKED LIMIT 1;
  IF selected_id IS NULL THEN RETURN; END IF;
  UPDATE public.privacy_deletion_requests SET status='purging',lease_id=gen_random_uuid(),
    lease_expires_at=now()+interval '2 minutes',attempts=attempts+1,last_error_code=NULL WHERE id=selected_id;
  INSERT INTO public.privacy_deletion_events(request_id,event_type) VALUES(selected_id,'claimed');
  RETURN QUERY SELECT * FROM public.privacy_deletion_requests WHERE id=selected_id;
END $$;

CREATE FUNCTION private.privacy_assert_lease(p_request uuid,p_lease uuid) RETURNS public.privacy_deletion_requests
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests;
BEGIN
  SELECT * INTO r FROM public.privacy_deletion_requests WHERE id=p_request FOR UPDATE;
  IF r.id IS NULL OR r.status<>'purging' OR p_lease IS NULL OR r.lease_id IS DISTINCT FROM p_lease OR r.lease_expires_at IS NULL OR r.lease_expires_at<=now() THEN
    RAISE EXCEPTION 'Deletion lease is not active.' USING ERRCODE='55000';
  END IF;
  IF private.privacy_has_hold(r.campaign_id,r.participant_id) THEN
    RAISE EXCEPTION 'Deletion is on legal hold.' USING ERRCODE='55000';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.privacy_retention_policies p WHERE p.id=r.policy_id AND p.status='active') THEN
    RAISE EXCEPTION 'Retention policy is not active.' USING ERRCODE='55000';
  END IF;
  RETURN r;
END $$;

-- Explicit grants also protect projects that no longer auto-expose new objects.
CREATE FUNCTION private.privacy_build_manifest(p_participant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE
  person public.campaign_participants; ids uuid[]; sessions uuid[]; snapshots uuid[];
  markers text[]; imports uuid[]; runs uuid[]; result jsonb;
BEGIN
  SELECT * INTO person FROM public.campaign_participants WHERE id=p_participant;
  IF person.id IS NULL THEN RAISE EXCEPTION 'Participant not found.' USING ERRCODE='P0002'; END IF;
  SELECT array_agg(p.id) INTO ids FROM public.campaign_participants p
    WHERE p.id=person.id OR p.campaign_rater_id IN
      (SELECT r.id FROM public.campaign_raters r WHERE r.subject_participant_id=person.id);
  SELECT coalesce(array_agg(s.id),'{}') INTO sessions FROM public.participant_sessions s
    WHERE s.campaign_participant_id=ANY(ids) OR s.id IN
      (SELECT r.session_id FROM public.campaign_raters r WHERE r.subject_participant_id=person.id);
  SELECT coalesce(array_agg(id),'{}') INTO snapshots FROM public.report_snapshots WHERE participant_session_id=ANY(sessions);
  IF cardinality(ids)>5000 OR cardinality(sessions)>5000 OR cardinality(snapshots)>5000 THEN
    RAISE EXCEPTION 'Deletion scope needs manual review.' USING ERRCODE='54000';
  END IF;
  markers := ARRAY[lower(person.email::text),person.person_key::text,person.access_token]
    || ids::text[] || sessions::text[] || snapshots::text[];
  SELECT coalesce(array_agg(i.id),'{}') INTO imports FROM public.outcome_imports i
    JOIN public.campaigns c ON c.id=person.campaign_id AND c.client_id=i.client_id
    WHERE private.privacy_json_matches(i.rows,markers);
  SELECT coalesce(array_agg(r.id),'{}') INTO runs FROM public.outcome_runs r
    JOIN public.campaigns c ON c.id=person.campaign_id AND c.client_id=r.client_id
    WHERE r.import_id=ANY(imports) OR private.privacy_json_matches(r.input,markers)
      OR private.privacy_json_matches(coalesce(r.result,'{}'),markers);
  SELECT jsonb_build_object(
    'version',1,'participantIds',to_jsonb(ids),'sessionIds',to_jsonb(sessions),'snapshotIds',to_jsonb(snapshots),
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
    'counts',jsonb_build_object('participants',cardinality(ids),'sessions',cardinality(sessions),'snapshots',cardinality(snapshots),
      'responses',(SELECT count(*) FROM public.participant_responses WHERE session_id=ANY(sessions)),
      'scores',(SELECT count(*) FROM public.participant_scores WHERE session_id=ANY(sessions)))
  ) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.privacy_plan_deletion(p_participant uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$ SELECT private.privacy_build_manifest(p_participant) $$;

CREATE FUNCTION public.privacy_prepare_deletion(p_request uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests; m jsonb; ids uuid[]; current_client uuid; manifest_key text;
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
  IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE private.privacy_has_hold(r.campaign_id,i)) THEN
    RAISE EXCEPTION 'Related records are on legal hold.' USING ERRCODE='55000';
  END IF;
  UPDATE public.report_snapshots SET deleted_at=coalesce(deleted_at,now())
    WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(m->'snapshotIds')) AND deleted_at IS NULL;
  UPDATE public.campaign_participants SET deleted_at=coalesce(deleted_at,now()),privacy_pending_at=coalesce(privacy_pending_at,now()) WHERE id=ANY(ids);
  -- Keep object paths already discovered across partial failures and review.
  m := jsonb_set(m,'{objects}',coalesce((SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
    (m->'objects')||coalesce(r.manifest->'objects','[]')) x),'[]'));
  FOREACH manifest_key IN ARRAY ARRAY['participantIds','sessionIds','snapshotIds'] LOOP
    m := jsonb_set(m,ARRAY[manifest_key],coalesce((SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
      (m->manifest_key)||coalesce(r.manifest->manifest_key,'[]')) x),'[]'));
  END LOOP;
  UPDATE public.privacy_deletion_requests SET manifest=m,
    status=CASE WHEN jsonb_array_length(m->'blockers')>0 THEN 'review_required' ELSE 'purging' END,
    lease_id=CASE WHEN jsonb_array_length(m->'blockers')>0 THEN NULL ELSE lease_id END,
    lease_expires_at=CASE WHEN jsonb_array_length(m->'blockers')>0 THEN NULL ELSE lease_expires_at END
    WHERE id=r.id;
  INSERT INTO public.privacy_deletion_events(request_id,event_type,counts)
    VALUES(r.id,CASE WHEN jsonb_array_length(m->'blockers')>0 THEN 'review_required' ELSE 'access_revoked' END,m->'counts');
  RETURN m;
END $$;

CREATE FUNCTION public.privacy_check_deletion_lease(p_request uuid,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM private.privacy_assert_lease(p_request,p_lease); RETURN true; END $$;

CREATE FUNCTION public.privacy_record_receipt(p_participant uuid,p_notice uuid,p_research boolean DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n public.privacy_notice_versions;
BEGIN
  PERFORM 1 FROM public.campaign_participants WHERE id=p_participant AND deleted_at IS NULL AND privacy_pending_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant unavailable.' USING ERRCODE='P0002'; END IF;
  SELECT n1.* INTO n FROM public.privacy_notice_versions n1
    JOIN public.campaign_privacy_settings s ON s.notice_version_id=n1.id
    JOIN public.campaign_participants p ON p.campaign_id=s.campaign_id
    WHERE p.id=p_participant AND n1.id=p_notice AND n1.status='published';
  IF n.id IS NULL THEN RAISE EXCEPTION 'Notice changed. Refresh before accepting.' USING ERRCODE='23514'; END IF;
  INSERT INTO public.participant_privacy_receipts(participant_id,notice_version_id,notice_hash,purpose,accepted,channel)
    VALUES(p_participant,n.id,n.body_hash,'assessment_notice',true,'online') ON CONFLICT DO NOTHING;
  IF n.research_choice_enabled AND p_research IS NOT NULL THEN
    INSERT INTO public.participant_privacy_receipts(participant_id,notice_version_id,notice_hash,purpose,accepted,channel)
      VALUES(p_participant,n.id,n.body_hash,'norm_research',p_research,'online')
      ;
  END IF;
  UPDATE public.campaign_participants SET consent_given_at=now(),consent_ip=NULL WHERE id=p_participant;
END $$;


-- A finite transaction-bound exception for privacy disposal, never a general
-- disable-auditing switch. Ordinary service-role UPDATE/DELETE remain blocked.
CREATE TABLE private.privacy_action_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL DEFAULT pg_current_xact_id()::text,
  audit_ids uuid[] NOT NULL DEFAULT '{}',
  error_ids uuid[] NOT NULL DEFAULT '{}',
  account_audit_ids uuid[] NOT NULL DEFAULT '{}'
  ,privacy_event_ids uuid[] NOT NULL DEFAULT '{}'
);
ALTER TABLE private.privacy_action_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.privacy_action_contexts FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.privacy_action_contexts TO service_role;

CREATE FUNCTION private.privacy_audit_delete_allowed(p_table text,p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT current_user IN ('postgres','service_role','supabase_admin') AND EXISTS(
    SELECT 1 FROM private.privacy_action_contexts c
    WHERE c.id::text=current_setting('privacy.action_context',true)
      AND c.transaction_id=pg_current_xact_id()::text
      AND p_id=ANY(CASE p_table WHEN 'audit_events' THEN c.audit_ids
        WHEN 'error_events' THEN c.error_ids WHEN 'account_deletion_audit' THEN c.account_audit_ids
        WHEN 'privacy_deletion_events' THEN c.privacy_event_ids ELSE '{}'::uuid[] END))
$$;

CREATE OR REPLACE FUNCTION public.audit_events_prevent_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND pg_trigger_depth()>1 THEN RETURN NEW; END IF;
  IF TG_OP='DELETE' AND private.privacy_audit_delete_allowed(TG_TABLE_NAME,OLD.id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'audit_events is append-only outside approved privacy disposal.' USING ERRCODE='42501';
END $$;
CREATE OR REPLACE FUNCTION public.error_events_prevent_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND pg_trigger_depth()>1 THEN RETURN NEW; END IF;
  IF TG_OP='DELETE' AND private.privacy_audit_delete_allowed(TG_TABLE_NAME,OLD.id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'error_events is append-only outside approved privacy disposal.' USING ERRCODE='42501';
END $$;
CREATE OR REPLACE FUNCTION public.account_deletion_audit_prevent_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' AND private.privacy_audit_delete_allowed(TG_TABLE_NAME,OLD.id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'account_deletion_audit is append-only outside approved privacy disposal.' USING ERRCODE='42501';
END $$;

CREATE FUNCTION public.privacy_finish_active_deletion(p_request uuid,p_lease uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  r public.privacy_deletion_requests; m jsonb; ids uuid[]; sessions uuid[]; snapshots uuid[];
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
  all_ids := ids||sessions||snapshots;
  SELECT all_ids::text[]||array_agg(lower(email::text))||array_agg(person_key::text)||array_agg(access_token)
    INTO markers FROM public.campaign_participants WHERE id=ANY(ids);
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
  DELETE FROM public.campaign_participants WHERE id=ANY(ids);
  IF EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=ANY(sessions))
    OR EXISTS(SELECT 1 FROM public.report_snapshots WHERE id=ANY(snapshots))
    OR EXISTS(SELECT 1 FROM public.campaign_participants WHERE id=ANY(ids)) THEN
    RAISE EXCEPTION 'Active deletion verification failed.' USING ERRCODE='55000';
  END IF;
  SELECT p.backup_days INTO backup_days FROM public.privacy_retention_policies p WHERE p.id=r.policy_id;
  UPDATE public.privacy_deletion_requests SET status='backup_pending',active_deleted_at=now(),
    backup_expires_at=greatest(now()+make_interval(days=>backup_days),r.ledger_expires_at),summary=r.manifest->'counts',
    lease_id=NULL,lease_expires_at=NULL,last_error_code=NULL WHERE id=r.id;
  INSERT INTO public.privacy_deletion_events(request_id,event_type,counts) VALUES(r.id,'active_deleted',r.manifest->'counts');
END $$;

CREATE FUNCTION public.privacy_complete_expired_deletions() RETURNS integer
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r record; done integer:=0;
BEGIN
  FOR r IN SELECT * FROM public.privacy_deletion_requests
    WHERE backup_expires_at<=now() AND (status='backup_pending' OR (status='processor_pending'
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(provider_tasks) t WHERE t->>'status' IS DISTINCT FROM 'confirmed')))
    FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
    IF private.privacy_has_hold(r.campaign_id,r.participant_id) THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.provider_tasks) t WHERE t->>'status' IS DISTINCT FROM 'confirmed') THEN
      -- External uncertainty does not justify keeping replay identifiers after
      -- the last recoverable copy is beyond its approved window.
      UPDATE public.privacy_deletion_requests SET status='processor_pending',manifest='{}',
        participant_id=NULL,campaign_id=NULL,client_id=NULL,requested_by=NULL,approved_by=NULL WHERE id=r.id;
      INSERT INTO public.privacy_deletion_events(request_id,event_type,counts) VALUES(r.id,'processor_pending',r.summary);
      CONTINUE;
    END IF;
    UPDATE public.privacy_deletion_requests SET status='completed',completed_at=now(),manifest='{}',
      participant_id=NULL,campaign_id=NULL,client_id=NULL,requested_by=NULL,approved_by=NULL,provider_tasks='[]'
      WHERE id=r.id;
    INSERT INTO public.privacy_deletion_events(request_id,event_type,counts) VALUES(r.id,'completed',r.summary);
    done:=done+1;
  END LOOP;
  RETURN done;
END $$;

CREATE FUNCTION public.privacy_expire_diagnostics(p_policy uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p public.privacy_retention_policies; context_id uuid; errors_count integer; audits_count integer; account_count integer;
BEGIN
  SELECT * INTO p FROM public.privacy_retention_policies WHERE id=p_policy AND status='active' AND scope='operations';
  IF p.id IS NULL THEN RAISE EXCEPTION 'Approved policy required.' USING ERRCODE='55000'; END IF;
  -- Conservative hold semantics for unstructured diagnostic records.
  IF EXISTS(SELECT 1 FROM public.privacy_legal_holds WHERE released_at IS NULL) THEN
    RETURN jsonb_build_object('held',true,'errors',0,'audits',0);
  END IF;
  INSERT INTO private.privacy_action_contexts(audit_ids,error_ids,account_audit_ids)
    SELECT
      coalesce((SELECT array_agg(id) FROM (SELECT id FROM public.audit_events
        WHERE p.audit_days IS NOT NULL AND created_at<now()-make_interval(days=>p.audit_days) ORDER BY created_at LIMIT 500) q),'{}'),
      coalesce((SELECT array_agg(id) FROM (SELECT id FROM public.error_events
        WHERE p.diagnostic_days IS NOT NULL AND occurred_at<now()-make_interval(days=>p.diagnostic_days) ORDER BY occurred_at LIMIT 500) q),'{}'),
      coalesce((SELECT array_agg(id) FROM (SELECT id FROM public.account_deletion_audit
        WHERE p.audit_days IS NOT NULL AND deleted_at<now()-make_interval(days=>p.audit_days) ORDER BY deleted_at LIMIT 500) q),'{}')
    RETURNING id INTO context_id;
  PERFORM set_config('privacy.action_context',context_id::text,true);
  DELETE FROM public.error_events WHERE id IN (SELECT unnest(error_ids) FROM private.privacy_action_contexts WHERE id=context_id);
  GET DIAGNOSTICS errors_count=ROW_COUNT;
  DELETE FROM public.audit_events WHERE id IN (SELECT unnest(audit_ids) FROM private.privacy_action_contexts WHERE id=context_id);
  GET DIAGNOSTICS audits_count=ROW_COUNT;
  DELETE FROM public.account_deletion_audit WHERE id IN (SELECT unnest(account_audit_ids) FROM private.privacy_action_contexts WHERE id=context_id);
  GET DIAGNOSTICS account_count=ROW_COUNT;
  DELETE FROM private.privacy_action_contexts WHERE id=context_id;
  RETURN jsonb_build_object('held',false,'errors',errors_count,'audits',audits_count,'legacyAccountAudits',account_count);
END $$;


CREATE FUNCTION public.privacy_pending_storage_objects(p_request uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests;
BEGIN
  r := private.privacy_assert_lease(p_request,p_lease);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('bucket',s.bucket_id,'path',s.name))
    FROM storage.objects s JOIN jsonb_array_elements(r.manifest->'objects') o
      ON s.bucket_id=o->>'bucket' AND s.name=o->>'path'),'[]');
END $$;

CREATE FUNCTION public.privacy_release_deletion(p_request uuid,p_lease uuid,p_error_code text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests;
BEGIN
  IF p_error_code IS NOT NULL AND p_error_code !~ '^[a-z0-9_]{1,80}$' THEN
    RAISE EXCEPTION 'Use a non-identifying failure code.' USING ERRCODE='23514';
  END IF;
  SELECT * INTO r FROM public.privacy_deletion_requests WHERE id=p_request AND lease_id=p_lease
    AND status='purging' FOR UPDATE;
  IF r.id IS NULL THEN RETURN; END IF;
  UPDATE public.privacy_deletion_requests SET lease_id=NULL,lease_expires_at=NULL,
    status=CASE WHEN attempts>=5 AND p_error_code IS NOT NULL THEN 'failed' ELSE 'approved' END,
    next_attempt_at=now()+make_interval(secs=>CASE WHEN p_error_code IS NULL THEN 0 ELSE least(3600,30*(2^least(attempts,6))::integer) END),
    last_error_code=p_error_code WHERE id=r.id;
  IF p_error_code IS NOT NULL THEN
    INSERT INTO public.privacy_deletion_events(request_id,event_type) VALUES(r.id,'retry');
  END IF;
END $$;

CREATE FUNCTION public.privacy_enqueue_expired_participants() RETURNS integer
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE inserted_count integer;
BEGIN
  WITH expired AS (
    SELECT p.id,p.campaign_id,c.client_id,pol.id policy_id,pol.approved_by
    FROM public.campaign_participants p JOIN public.campaigns c ON c.id=p.campaign_id
    JOIN public.campaign_privacy_settings s ON s.campaign_id=c.id
    JOIN public.privacy_retention_policies pol ON pol.id=s.retention_policy_id AND pol.status='active' AND pol.scope='assessment'
    WHERE s.closed_at IS NOT NULL AND pol.retention_months IS NOT NULL
      AND s.closed_at+make_interval(months=>pol.retention_months)<=now()
      AND NOT private.privacy_has_hold(c.id,p.id)
      AND NOT EXISTS(SELECT 1 FROM public.privacy_deletion_requests r WHERE r.participant_id=p.id)
    ORDER BY s.closed_at,p.id LIMIT 100
  ), added AS (
    INSERT INTO public.privacy_deletion_requests(participant_id,campaign_id,client_id,reason,policy_id,
      status,approved_by,approved_at,provider_tasks)
    SELECT id,campaign_id,client_id,'retention_expiry',policy_id,'approved',approved_by,now(),
      '[{"processor":"email_and_recipient_copies","status":"pending"},{"processor":"migration_source_and_exports","status":"pending"},{"processor":"shared_processor_and_support_copies","status":"pending"}]'::jsonb FROM expired
    ON CONFLICT(participant_id) DO NOTHING RETURNING id
  )
  INSERT INTO public.privacy_deletion_events(request_id,event_type) SELECT id,'approved' FROM added;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN inserted_count;
END $$;


CREATE FUNCTION public.privacy_confirm_provider_task(p_request uuid,p_processor text,p_evidence text,p_actor uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests;
BEGIN
  IF p_processor !~ '^[a-z_]{1,80}$' OR p_evidence !~ '^[a-zA-Z0-9_.:-]{1,120}$' THEN
    RAISE EXCEPTION 'Non-identifying evidence reference required.' USING ERRCODE='23514';
  END IF;
  SELECT * INTO r FROM public.privacy_deletion_requests WHERE id=p_request AND status IN ('backup_pending','processor_pending','review_required') FOR UPDATE;
  IF r.id IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.provider_tasks) t WHERE t->>'processor'=p_processor) THEN
    RAISE EXCEPTION 'Provider task unavailable.' USING ERRCODE='55000';
  END IF;
  UPDATE public.privacy_deletion_requests SET provider_tasks=(SELECT jsonb_agg(
    CASE WHEN t->>'processor'=p_processor THEN t||jsonb_build_object('status','confirmed','evidenceRef',p_evidence,'confirmedAt',now(),'confirmedBy',p_actor)
      ELSE t END) FROM jsonb_array_elements(r.provider_tasks) t) WHERE id=r.id;
  INSERT INTO public.privacy_deletion_events(request_id,event_type) VALUES(r.id,'provider_confirmed');
END $$;

CREATE POLICY report_snapshots_active_privacy ON public.report_snapshots AS RESTRICTIVE
  FOR SELECT TO anon,authenticated USING (deleted_at IS NULL);

CREATE FUNCTION private.privacy_guard_archived_report() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL
    AND (to_jsonb(NEW)-ARRAY['deleted_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['deleted_at','updated_at']) THEN
    RAISE EXCEPTION 'Archived reports cannot be regenerated.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_archived_report_guard BEFORE UPDATE ON public.report_snapshots
  FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_archived_report();

CREATE OR REPLACE FUNCTION public.claim_report_snapshot_for_generation(p_snapshot_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Serialize count+claim, rather than letting simultaneous completions all
  -- observe free capacity. Same lock is shared by every server/cron request.
  PERFORM pg_advisory_xact_lock(hashtextextended('trajectas:report-generation', 0));
  IF (SELECT count(*) FROM public.report_snapshots WHERE (deleted_at IS NULL OR deleted_at > now() - interval '15 minutes') AND status = 'generating') >= 6 THEN
    RETURN false;
  END IF;
  UPDATE public.report_snapshots
  SET status = 'generating', pdf_url = NULL, pdf_status = NULL,
      pdf_error_message = NULL, pdf_claim_token = NULL,
      pdf_started_at = NULL, pdf_next_attempt_at = NULL, pdf_attempt_count = 0
  WHERE deleted_at IS NULL AND id = p_snapshot_id AND status = 'pending'
    -- Regeneration must not release a PDF slot while its old browser is live.
    AND pdf_status IS DISTINCT FROM 'generating';
  RETURN FOUND;
END;
$$;
CREATE OR REPLACE FUNCTION public.claim_report_pdf_generation(p_snapshot_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  claim_token uuid := gen_random_uuid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('trajectas:report-pdf', 0));
  IF (SELECT count(*) FROM public.report_snapshots WHERE (deleted_at IS NULL OR deleted_at > now() - interval '15 minutes') AND pdf_status = 'generating') >= 2 THEN
    RETURN NULL;
  END IF;
  UPDATE public.report_snapshots
  SET pdf_status = 'generating', pdf_claim_token = claim_token,
      pdf_started_at = now(), pdf_attempt_count = pdf_attempt_count + 1,
      pdf_error_message = NULL
  WHERE deleted_at IS NULL AND id = p_snapshot_id
    AND status IN ('ready', 'released') AND pdf_url IS NULL
    AND pdf_status = 'queued' AND pdf_attempt_count < 3
    AND (pdf_next_attempt_at IS NULL OR pdf_next_attempt_at <= now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN claim_token;
END;
$$;
CREATE OR REPLACE FUNCTION public.recover_report_pdf_jobs(p_snapshot_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE recovered integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('trajectas:report-pdf', 0));
  UPDATE public.report_snapshots
  SET pdf_status = CASE WHEN pdf_attempt_count >= 3 THEN 'failed' ELSE 'queued' END,
      pdf_error_message = CASE WHEN pdf_attempt_count >= 3
        THEN 'PDF worker timed out after three attempts'
        ELSE 'PDF worker timed out; queued for retry' END,
      pdf_claim_token = NULL, pdf_started_at = NULL, pdf_next_attempt_at = NULL
  WHERE deleted_at IS NULL AND pdf_status = 'generating'
    AND (p_snapshot_id IS NULL OR id = p_snapshot_id)
    AND COALESCE(pdf_started_at, updated_at) < now() - interval '15 minutes';
  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;
CREATE OR REPLACE FUNCTION public.fail_report_pdf_generation(p_snapshot_id uuid, p_claim_token uuid, p_error text)
RETURNS text LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE next_status text;
BEGIN
  -- Decide retries from the authoritative attempt count, never a pre-claim
  -- client read that could predate recovery or an explicit manual retry.
  UPDATE public.report_snapshots
  SET pdf_status = CASE WHEN pdf_attempt_count >= 3 THEN 'failed' ELSE 'queued' END,
      pdf_error_message = left(p_error, 2000),
      pdf_claim_token = NULL, pdf_started_at = NULL,
      pdf_next_attempt_at = now() + interval '30 seconds'
  WHERE deleted_at IS NULL AND id = p_snapshot_id AND pdf_claim_token = p_claim_token
    AND pdf_status = 'generating'
  RETURNING pdf_status INTO next_status;
  RETURN next_status;
END;
$$;


CREATE FUNCTION public.privacy_confirm_external_ledger(p_request uuid,p_lease uuid,p_digest text,p_expires timestamptz) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.privacy_deletion_requests; days integer;
BEGIN
  r := private.privacy_assert_lease(p_request,p_lease);
  SELECT backup_days INTO days FROM public.privacy_retention_policies WHERE id=r.policy_id;
  IF p_digest !~ '^[a-f0-9]{64}$' OR p_expires<now()+make_interval(days=>days) OR p_expires>now()+interval '367 days' THEN
    RAISE EXCEPTION 'External replay ledger confirmation is insufficient.' USING ERRCODE='23514';
  END IF;
  UPDATE public.privacy_deletion_requests SET ledger_digest=p_digest,ledger_expires_at=p_expires WHERE id=r.id;
END $$;


CREATE TABLE public.privacy_research_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_participant_id uuid NOT NULL REFERENCES public.campaign_participants(id) ON DELETE CASCADE,
  source_session_id uuid NOT NULL UNIQUE REFERENCES public.participant_sessions(id) ON DELETE CASCADE,
  source_person_key uuid NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  form_fingerprint text NOT NULL CHECK (form_fingerprint ~ '^[a-f0-9]{64}$'),
  scoring_version text NOT NULL,
  permission_basis text NOT NULL CHECK (permission_basis IN ('participant_consent','customer_permission','related_expected_purpose')),
  permission_ref text NOT NULL CHECK (permission_ref ~ '^[a-zA-Z0-9_.:-]{1,120}$'),
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responses jsonb NOT NULL CHECK (jsonb_typeof(responses)='array'),
  scores jsonb NOT NULL CHECK (jsonb_typeof(scores)='array'),
  eligible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(source_person_key,form_fingerprint)
);
CREATE TABLE public.privacy_norm_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE CHECK (length(version) BETWEEN 1 AND 80),
  instrument_key text NOT NULL CHECK (instrument_key ~ '^[a-zA-Z0-9_.-]{1,80}$'),
  form_fingerprint text NOT NULL,
  sample_count integer NOT NULL CHECK (sample_count>=20),
  payload jsonb NOT NULL,
  risk_decision_ref text NOT NULL CHECK (risk_decision_ref ~ '^[a-zA-Z0-9_.:-]{1,120}$'),
  quality_decision_ref text NOT NULL CHECK (quality_decision_ref ~ '^[a-zA-Z0-9_.:-]{1,120}$'),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.privacy_research_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_norm_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_research_cases,public.privacy_norm_releases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.privacy_research_cases,public.privacy_norm_releases TO service_role;

CREATE FUNCTION public.privacy_restrict_research(p_participant uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  UPDATE public.campaign_participants SET research_restricted_at=now() WHERE id=p_participant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant unavailable.'; END IF;
  UPDATE public.privacy_research_cases SET eligible=false WHERE source_participant_id=p_participant;
  DELETE FROM public.privacy_research_cases r USING public.campaign_participants p
    WHERE r.source_participant_id=p_participant AND p.id=p_participant AND NOT private.privacy_has_hold(p.campaign_id,p.id);
END $$;

CREATE FUNCTION private.privacy_research_withdrawal() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.purpose='norm_research' AND NOT NEW.accepted THEN
    UPDATE public.privacy_research_cases SET eligible=false WHERE source_participant_id=NEW.participant_id;
    DELETE FROM public.privacy_research_cases r USING public.campaign_participants p
      WHERE r.source_participant_id=NEW.participant_id AND p.id=NEW.participant_id AND NOT private.privacy_has_hold(p.campaign_id,p.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_research_withdrawal AFTER INSERT OR UPDATE ON public.participant_privacy_receipts
  FOR EACH ROW EXECUTE FUNCTION private.privacy_research_withdrawal();

CREATE FUNCTION public.privacy_expire_research_cases() RETURNS integer
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.privacy_research_cases r USING public.campaign_participants p
    WHERE p.id=r.source_participant_id AND (r.expires_at<now() OR NOT r.eligible OR p.research_restricted_at IS NOT NULL OR EXISTS(
      SELECT 1 FROM public.campaign_privacy_settings s JOIN public.privacy_retention_policies policy ON policy.id=s.retention_policy_id
      WHERE s.campaign_id=p.campaign_id AND s.closed_at+make_interval(months=>policy.retention_months)<=now()))
      AND NOT private.privacy_has_hold(p.campaign_id,p.id);
  GET DIAGNOSTICS deleted_count=ROW_COUNT; RETURN deleted_count;
END $$;

CREATE FUNCTION public.privacy_publish_norm(
  p_cases uuid[],p_version text,p_instrument text,p_risk_ref text,p_quality_ref text,p_actor uuid
) RETURNS uuid
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n integer; distinct_forms integer; fingerprint text; payload jsonb; release_id uuid;
BEGIN
  IF cardinality(p_cases)<20 OR cardinality(p_cases)>5000 OR
    p_risk_ref !~ '^[a-zA-Z0-9_.:-]{1,120}$' OR p_quality_ref !~ '^[a-zA-Z0-9_.:-]{1,120}$' THEN
    RAISE EXCEPTION 'Reviewed research cohort and evidence references required.' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM public.privacy_research_cases r JOIN public.campaign_participants p ON p.id=r.source_participant_id
    WHERE r.id=ANY(p_cases) FOR UPDATE OF r,p;
  SELECT count(*),count(DISTINCT r.form_fingerprint),min(r.form_fingerprint) INTO n,distinct_forms,fingerprint
    FROM public.privacy_research_cases r JOIN public.campaign_participants p ON p.id=r.source_participant_id
    WHERE r.id=ANY(p_cases) AND r.eligible AND r.expires_at>now() AND p.privacy_pending_at IS NULL AND p.deleted_at IS NULL AND p.research_restricted_at IS NULL
      AND EXISTS(SELECT 1 FROM public.campaign_privacy_settings s JOIN public.privacy_retention_policies policy ON policy.id=s.retention_policy_id
        WHERE s.campaign_id=p.campaign_id AND policy.status='active' AND policy.research_allowed
          AND (s.closed_at IS NULL OR s.closed_at+make_interval(months=>policy.retention_months)>now()))
      AND NOT EXISTS(SELECT 1 FROM public.participant_session_flags f WHERE f.session_id=r.source_session_id)
      AND NOT EXISTS(SELECT 1 FROM public.session_quality_flags f WHERE f.session_id=r.source_session_id)
      AND NOT private.privacy_has_hold(p.campaign_id,p.id);
  IF n<>cardinality(p_cases) OR distinct_forms<>1 THEN
    RAISE EXCEPTION 'Cohort is incomplete, mixed or ineligible.' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT score->>'constructId' FROM public.privacy_research_cases r,
      LATERAL jsonb_array_elements(r.scores) score WHERE r.id=ANY(p_cases)
      GROUP BY score->>'constructId' HAVING count(*)<>n) THEN
    RAISE EXCEPTION 'Every construct requires a complete cohort.' USING ERRCODE='23514';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('constructId',construct_id,'sampleSize',sample_size,
    'mean',mean,'standardDeviation',sd,'scoreType','pomp',
    'percentiles',jsonb_build_object('5',p5,'10',p10,'25',p25,'50',p50,'75',p75,'90',p90,'95',p95)))
    INTO payload FROM (
    SELECT score->>'constructId' construct_id,count(*) sample_size,avg((score->>'pomp')::numeric) mean,
      stddev_samp((score->>'pomp')::numeric) sd,
      percentile_cont(0.05) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p5,
      percentile_cont(0.10) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p10,
      percentile_cont(0.25) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p25,
      percentile_cont(0.50) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p50,
      percentile_cont(0.75) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p75,
      percentile_cont(0.90) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p90,
      percentile_cont(0.95) WITHIN GROUP(ORDER BY (score->>'pomp')::double precision) p95
    FROM public.privacy_research_cases r CROSS JOIN LATERAL jsonb_array_elements(r.scores) score
    WHERE r.id=ANY(p_cases) GROUP BY score->>'constructId'
  ) stats WHERE sample_size=n;
  IF payload IS NULL THEN RAISE EXCEPTION 'Complete construct scores required.' USING ERRCODE='23514'; END IF;
  -- No source membership, session IDs, client IDs, dates or individual rows are
  -- written to the approved aggregate. N=20 is a floor, not anonymity proof.
  INSERT INTO public.privacy_norm_releases(version,instrument_key,form_fingerprint,sample_count,payload,
    risk_decision_ref,quality_decision_ref,reviewed_by)
    VALUES(p_version,p_instrument,fingerprint,n,payload,p_risk_ref,p_quality_ref,p_actor) RETURNING id INTO release_id;
  RETURN release_id;
END $$;


CREATE FUNCTION private.privacy_guard_research_case() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE participant public.campaign_participants; consent boolean; policy public.privacy_retention_policies; closure timestamptz;
BEGIN
  IF TG_OP='UPDATE' AND NOT NEW.eligible AND (to_jsonb(NEW)-'eligible')=(to_jsonb(OLD)-'eligible') THEN RETURN NEW; END IF;
  IF jsonb_array_length(NEW.scores)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.scores) score
      WHERE jsonb_typeof(score->'pomp') IS DISTINCT FROM 'number' OR (score->>'pomp')::numeric NOT BETWEEN 0 AND 100
        OR coalesce(score->>'constructId','') !~ '^[a-fA-F0-9]{8}-([a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.scores) score GROUP BY score->>'constructId' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Complete distinct in-range construct scores required.' USING ERRCODE='23514';
  END IF;
  SELECT * INTO participant FROM public.campaign_participants WHERE id=NEW.source_participant_id FOR UPDATE;
  IF participant.id IS NULL OR participant.deleted_at IS NOT NULL OR participant.privacy_pending_at IS NOT NULL OR participant.research_restricted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Research source is unavailable.' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.participant_sessions s JOIN public.campaigns c ON c.id=s.campaign_id
    WHERE s.id=NEW.source_session_id AND s.campaign_participant_id=participant.id AND s.assessment_id=NEW.assessment_id
      AND participant.person_key=NEW.source_person_key AND s.status='completed'
      AND NOT s.is_internal AND NOT c.is_internal) THEN
    RAISE EXCEPTION 'Research source must be a completed non-internal session.' USING ERRCODE='23514';
  END IF;
  SELECT p.* INTO policy FROM public.privacy_retention_policies p
    JOIN public.campaign_privacy_settings s ON s.retention_policy_id=p.id WHERE s.campaign_id=participant.campaign_id;
  SELECT closed_at INTO closure FROM public.campaign_privacy_settings WHERE campaign_id=participant.campaign_id;
  IF policy.status IS DISTINCT FROM 'active' OR NOT policy.research_allowed OR policy.scope<>'assessment'
    OR private.privacy_has_hold(participant.campaign_id,participant.id) THEN
    RAISE EXCEPTION 'Approved research use is unavailable.' USING ERRCODE='23514';
  END IF;
  SELECT accepted INTO consent FROM public.participant_privacy_receipts
    WHERE participant_id=participant.id AND purpose='norm_research' ORDER BY recorded_at DESC,id DESC LIMIT 1;
  IF consent=false OR (NEW.permission_basis='participant_consent' AND consent IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Research permission is absent or withdrawn.' USING ERRCODE='23514';
  END IF;
  IF NEW.expires_at>now()+interval '90 days 1 minute' OR NEW.expires_at<=now()
    OR (closure IS NOT NULL AND NEW.expires_at>closure+make_interval(months=>policy.retention_months)) THEN
    RAISE EXCEPTION 'Research expiry exceeds the permitted source period.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_research_case_guard BEFORE INSERT OR UPDATE ON public.privacy_research_cases
  FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_research_case();

CREATE FUNCTION private.privacy_guard_campaign_settings() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.retention_policy_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.privacy_retention_policies
    WHERE id=NEW.retention_policy_id AND status='active' AND scope='assessment' AND NOT recovery_only) THEN
    RAISE EXCEPTION 'An approved assessment policy is required.' USING ERRCODE='23514';
  END IF;
  IF NEW.notice_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.privacy_notice_versions
    WHERE id=NEW.notice_version_id AND status='published' AND audience='participant') THEN
    RAISE EXCEPTION 'A published participant notice is required.' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
    RAISE EXCEPTION 'Recorded closure dates cannot be reset.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_campaign_settings_guard BEFORE INSERT OR UPDATE ON public.campaign_privacy_settings
  FOR EACH ROW EXECUTE FUNCTION private.privacy_guard_campaign_settings();

CREATE FUNCTION private.privacy_capture_campaign_closure() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user IN ('postgres','service_role','supabase_admin') AND NEW.status::text IN ('closed','completed')
    AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.campaign_privacy_settings SET closed_at=coalesce(closed_at,now()),updated_at=now() WHERE campaign_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_campaign_closure AFTER UPDATE OF status ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION private.privacy_capture_campaign_closure();

CREATE FUNCTION private.privacy_event_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' AND private.privacy_audit_delete_allowed(TG_TABLE_NAME,OLD.id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Disposal events are append-only outside approved expiry.' USING ERRCODE='42501';
END $$;
CREATE TRIGGER privacy_event_immutable BEFORE UPDATE OR DELETE ON public.privacy_deletion_events
  FOR EACH ROW EXECUTE FUNCTION private.privacy_event_immutable();

CREATE FUNCTION public.privacy_expire_lifecycle_receipts(p_policy uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE policy public.privacy_retention_policies; context_id uuid; requests uuid[];
BEGIN
  SELECT * INTO policy FROM public.privacy_retention_policies WHERE id=p_policy AND status='active' AND scope='operations';
  IF policy.id IS NULL THEN RAISE EXCEPTION 'Approved operations policy required.'; END IF;
  IF EXISTS(SELECT 1 FROM public.privacy_legal_holds WHERE released_at IS NULL) THEN RETURN; END IF;
  UPDATE public.privacy_account_deletion_receipts SET profile_id=NULL,status='completed'
    WHERE status='auth_deleted' AND replay_until<=now();
  DELETE FROM public.privacy_account_deletion_receipts WHERE id IN
    (SELECT id FROM public.privacy_account_deletion_receipts WHERE status='completed'
      AND deleted_at<now()-make_interval(days=>policy.audit_days) LIMIT 100);
  SELECT coalesce(array_agg(id),'{}') INTO requests FROM (SELECT id FROM public.privacy_deletion_requests
    WHERE status='completed' AND completed_at<now()-make_interval(days=>policy.audit_days) LIMIT 100) q;
  INSERT INTO private.privacy_action_contexts(privacy_event_ids)
    SELECT coalesce(array_agg(id),'{}') FROM public.privacy_deletion_events WHERE request_id=ANY(requests) RETURNING id INTO context_id;
  PERFORM set_config('privacy.action_context',context_id::text,true);
  DELETE FROM public.privacy_deletion_events WHERE request_id=ANY(requests);
  DELETE FROM private.privacy_action_contexts WHERE id=context_id;
  DELETE FROM public.privacy_deletion_requests WHERE id=ANY(requests);
END $$;

CREATE FUNCTION public.privacy_replay_remaining(p_entry jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object(
    'participants',(SELECT count(*) FROM public.campaign_participants WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_entry->'participantIds'))),
    'sessions',(SELECT count(*) FROM public.participant_sessions WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_entry->'sessionIds'))),
    'snapshots',(SELECT count(*) FROM public.report_snapshots WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_entry->'snapshotIds'))),
    'objects',(SELECT count(*) FROM storage.objects o JOIN jsonb_array_elements(p_entry->'objects') r ON o.bucket_id=r->>'bucket' AND o.name=r->>'path'))
$$;

CREATE FUNCTION public.privacy_replay_hold(p_entry jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF p_entry->>'kind'<>'hold' THEN RAISE EXCEPTION 'Hold entry required.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.campaigns WHERE id=(p_entry->>'campaignId')::uuid) THEN RETURN; END IF;
  INSERT INTO public.privacy_legal_holds(id,campaign_id,participant_id,reason,review_at,released_at)
    VALUES((p_entry->>'id')::uuid,(p_entry->>'campaignId')::uuid,
      CASE WHEN EXISTS(SELECT 1 FROM public.campaign_participants WHERE id=(p_entry->>'participantId')::uuid)
        THEN (p_entry->>'participantId')::uuid ELSE NULL END,
      'Hold replayed from protected recovery ledger',(p_entry->>'reviewAt')::timestamptz,
      CASE WHEN p_entry->>'status'='released' THEN now() ELSE NULL END)
    ON CONFLICT(id) DO UPDATE SET released_at=EXCLUDED.released_at,review_at=EXCLUDED.review_at;
END $$;

CREATE FUNCTION public.privacy_replay_deletion(p_entry jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person public.campaign_participants; policy_id uuid; owner_id uuid; recovery_version text;
BEGIN
  IF p_entry->>'kind'<>'deletion' OR (p_entry->>'expiresAt')::timestamptz<=now() THEN
    RAISE EXCEPTION 'A current deletion entry is required.';
  END IF;
  SELECT * INTO person FROM public.campaign_participants WHERE id=(p_entry->>'participantId')::uuid FOR UPDATE;
  IF person.id IS NULL THEN RETURN false; END IF;
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
      (p_entry->>'approvedAt')::timestamptz,jsonb_build_object('participantIds',p_entry->'participantIds',
        'sessionIds',p_entry->'sessionIds','snapshotIds',p_entry->'snapshotIds','objects',p_entry->'objects'))
    ON CONFLICT(id) DO UPDATE SET status='approved',participant_id=EXCLUDED.participant_id,campaign_id=EXCLUDED.campaign_id,
      client_id=EXCLUDED.client_id,policy_id=EXCLUDED.policy_id,approved_at=EXCLUDED.approved_at,manifest=EXCLUDED.manifest,
      active_deleted_at=NULL,completed_at=NULL,backup_expires_at=NULL,lease_id=NULL,lease_expires_at=NULL,
      attempts=0,next_attempt_at=now();
  RETURN true;
END $$;

-- Proposed defaults selected by the owner. Still drafts: the backup inventory,
-- customer terms, legal review and activation are separate rollout evidence.
INSERT INTO public.privacy_retention_policies(name,version,scope,retention_months,research_allowed) VALUES
  ('Recruitment — 12 months after engagement closure','2026-11-05-recruitment-v1','assessment',12,true),
  ('Development — 24 months after engagement closure','2026-11-05-development-v1','assessment',24,true);

CREATE FUNCTION private.privacy_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Privacy acknowledgements and choices are append-only.' USING ERRCODE='42501';
END $$;
CREATE TRIGGER privacy_receipt_immutable BEFORE UPDATE OR DELETE ON public.participant_privacy_receipts
  FOR EACH ROW EXECUTE FUNCTION private.privacy_receipt_immutable();

CREATE FUNCTION private.privacy_norm_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND pg_trigger_depth()>1 AND NEW.reviewed_by IS NULL
    AND (to_jsonb(NEW)-'reviewed_by')=(to_jsonb(OLD)-'reviewed_by') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'An aggregate release requires a new version.' USING ERRCODE='42501';
END $$;
CREATE TRIGGER privacy_norm_immutable BEFORE UPDATE OR DELETE ON public.privacy_norm_releases
  FOR EACH ROW EXECUTE FUNCTION private.privacy_norm_immutable();

CREATE FUNCTION private.privacy_configuration_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE row_data jsonb:=to_jsonb(NEW); previous jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  actor uuid; target uuid;
BEGIN
  IF TG_TABLE_NAME IN ('privacy_retention_policies','privacy_notice_versions') THEN
    IF TG_OP='INSERT' AND row_data->>'status'='draft' THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND row_data->>'status' IS NOT DISTINCT FROM previous->>'status' THEN RETURN NEW; END IF;
    IF row_data->>'status' IN ('active','published') THEN actor:=coalesce((row_data->>'approved_by')::uuid,(row_data->>'published_by')::uuid); END IF;
  ELSIF TG_TABLE_NAME='privacy_deletion_requests' THEN
    IF TG_OP='UPDATE' AND row_data->>'approved_at' IS NOT DISTINCT FROM previous->>'approved_at' THEN RETURN NEW; END IF;
    actor:=CASE WHEN TG_OP='INSERT' THEN (row_data->>'requested_by')::uuid ELSE (row_data->>'approved_by')::uuid END;
  ELSIF TG_TABLE_NAME='privacy_legal_holds' THEN
    IF TG_OP='UPDATE' AND row_data->>'released_at' IS NOT DISTINCT FROM previous->>'released_at' THEN RETURN NEW; END IF;
    actor:=CASE WHEN TG_OP='INSERT' THEN (row_data->>'created_by')::uuid
      WHEN row_data->>'released_at' IS NOT NULL THEN (row_data->>'released_by')::uuid ELSE NULL END;
  ELSIF TG_TABLE_NAME='campaign_privacy_settings' THEN
    IF TG_OP='UPDATE' AND (row_data-'updated_at'-'updated_by')=(previous-'updated_at'-'updated_by') THEN RETURN NEW; END IF;
    actor:=(row_data->>'updated_by')::uuid;
    IF TG_OP='UPDATE' AND row_data->>'retention_policy_id' IS NOT DISTINCT FROM previous->>'retention_policy_id'
      AND row_data->>'notice_version_id' IS NOT DISTINCT FROM previous->>'notice_version_id'
      AND row_data->>'closed_at' IS DISTINCT FROM previous->>'closed_at' THEN actor:=NULL; END IF;
  ELSE actor:=coalesce((row_data->>'reviewed_by')::uuid,(row_data->>'decided_by')::uuid); END IF;
  target:=coalesce((row_data->>'id')::uuid,(row_data->>'campaign_id')::uuid);
  INSERT INTO public.audit_events(actor_profile_id,event_type,target_table,target_id,metadata)
    VALUES(actor,'privacy.'||TG_TABLE_NAME||'.'||lower(TG_OP),TG_TABLE_NAME,target,
      jsonb_strip_nulls(jsonb_build_object('status',row_data->>'status','version',row_data->>'version',
        'scope',row_data->>'scope','reason',CASE WHEN TG_TABLE_NAME='privacy_deletion_requests' THEN row_data->>'reason' END,
        'retentionPolicyId',row_data->>'retention_policy_id','noticeVersionId',row_data->>'notice_version_id')));
  RETURN NEW;
END $$;
CREATE TRIGGER privacy_policy_audit AFTER INSERT OR UPDATE ON public.privacy_retention_policies FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();
CREATE TRIGGER privacy_notice_audit AFTER INSERT OR UPDATE ON public.privacy_notice_versions FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();
CREATE TRIGGER privacy_settings_audit AFTER INSERT OR UPDATE ON public.campaign_privacy_settings FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();
CREATE TRIGGER privacy_hold_audit AFTER INSERT OR UPDATE ON public.privacy_legal_holds FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();
CREATE TRIGGER privacy_request_audit AFTER INSERT OR UPDATE ON public.privacy_deletion_requests FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();
CREATE TRIGGER privacy_research_audit AFTER INSERT ON public.privacy_research_cases FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();
CREATE TRIGGER privacy_norm_audit AFTER INSERT ON public.privacy_norm_releases FOR EACH ROW EXECUTE FUNCTION private.privacy_configuration_audit();

-- Keep lifecycle lookups and FK cascades bounded as the evidence tables grow.
CREATE INDEX privacy_policy_approver ON public.privacy_retention_policies(approved_by);
CREATE INDEX privacy_notice_publisher ON public.privacy_notice_versions(published_by);
CREATE INDEX privacy_campaign_policy ON public.campaign_privacy_settings(retention_policy_id);
CREATE INDEX privacy_campaign_notice ON public.campaign_privacy_settings(notice_version_id);
CREATE INDEX privacy_campaign_editor ON public.campaign_privacy_settings(updated_by);
CREATE INDEX privacy_receipt_notice ON public.participant_privacy_receipts(notice_version_id);
CREATE INDEX privacy_receipt_participant ON public.participant_privacy_receipts(participant_id);
CREATE INDEX privacy_hold_campaign ON public.privacy_legal_holds(campaign_id);
CREATE INDEX privacy_hold_participant ON public.privacy_legal_holds(participant_id);
CREATE INDEX privacy_hold_creator ON public.privacy_legal_holds(created_by);
CREATE INDEX privacy_hold_releaser ON public.privacy_legal_holds(released_by);
CREATE INDEX privacy_request_policy ON public.privacy_deletion_requests(policy_id);
CREATE INDEX privacy_request_creator ON public.privacy_deletion_requests(requested_by);
CREATE INDEX privacy_request_approver ON public.privacy_deletion_requests(approved_by);
CREATE INDEX privacy_event_request ON public.privacy_deletion_events(request_id);
CREATE INDEX privacy_research_source ON public.privacy_research_cases(source_participant_id);
CREATE INDEX privacy_research_assessment ON public.privacy_research_cases(assessment_id);
CREATE INDEX privacy_research_reviewer ON public.privacy_research_cases(decided_by);
CREATE INDEX privacy_research_expiry ON public.privacy_research_cases(expires_at);
CREATE INDEX privacy_norm_reviewer ON public.privacy_norm_releases(reviewed_by);

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.proname LIKE 'privacy\_%' ESCAPE '\' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',f.nspname,f.proname,f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',f.nspname,f.proname,f.args);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA private TO service_role;
