-- Business conflicts are terminal for this request. PostgREST 14 retries
-- SQLSTATE 40001 indefinitely, so use HTTP 409 rather than pretending the
-- unchanged input is a transient database serialization failure.
-- Deploy the app that accepts PT409 and legacy 40001 before this migration.
-- No delivered forms, responses or stored report snapshots are rewritten.
BEGIN;

CREATE OR REPLACE FUNCTION private.validate_form_authoring_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_revision bigint;
BEGIN
  -- A competing freeze already won. ON CONFLICT DO NOTHING preserves it;
  -- the caller reselects that durable form instead of using its own payload.
  IF EXISTS (SELECT 1 FROM participant_section_forms
    WHERE session_id=NEW.session_id AND section_id=NEW.section_id) THEN RETURN NEW; END IF;
  SELECT public.get_delivery_authoring_revision(s.assessment_id) INTO current_revision
  FROM assessment_sections s WHERE s.id=NEW.section_id;
  IF NEW.assembler_version='form-assembler@2' AND NEW.authoring_revision IS NULL THEN
    RAISE EXCEPTION 'A form authoring revision is required.' USING ERRCODE='23514';
  END IF;
  IF NEW.authoring_revision IS NOT NULL AND NEW.authoring_revision<>current_revision THEN
    RAISE EXCEPTION 'Assessment authoring changed while assembling the form; reload and retry.' USING ERRCODE='PT409';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_form_authoring_revision() FROM PUBLIC, anon, authenticated;

create or replace function public.commit_instrument_likert_step(
  p_job_id uuid, p_step_id uuid, p_revision integer, p_expected_spec jsonb,
  p_state jsonb, p_cells jsonb default null, p_candidates jsonb default '[]',
  p_build_status text default null, p_output jsonb default '{}'
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  job public.instrument_stage_runs%rowtype;
  step public.instrument_stage_runs%rowtype;
  cell jsonb;
  item jsonb;
  target_bp uuid;
  existing public.instrument_candidate_items%rowtype;
begin
  select * into step from public.instrument_stage_runs where id=p_step_id for update;
  if not found or step.stage_key <> 'autonomous_likert_step' or step.status <> 'running' or step.started_at < clock_timestamp() - interval '3 minutes' then
    raise exception 'Likert step lease expired; result was not committed' using errcode='PT409';
  end if;
  select * into job from public.instrument_stage_runs where id=p_job_id for update;
  if not found or job.build_id <> step.build_id or job.stage_key <> 'autonomous_likert' or (job.output_snapshot->>'revision')::integer <> p_revision then
    raise exception 'Likert job changed; reload its saved state' using errcode='PT409';
  end if;
  if (p_state->>'revision')::integer <> p_revision+1 then raise exception 'Invalid checkpoint revision'; end if;
  perform 1 from public.instrument_builds where id=job.build_id and deleted_at is null for update;
  if not found then raise exception 'Build no longer exists'; end if;
  if exists(select 1 from public.instrument_builds where id=job.build_id and status='published') then raise exception 'Published instruments cannot be regenerated'; end if;
  if exists(select 1 from public.instrument_stage_runs where build_id=job.build_id and stage_key='publish_readiness' and status='running') then raise exception 'Publication is in progress; automatic generation cannot overwrite it' using errcode='PT409'; end if;
  perform 1 from public.instrument_blueprints where build_id=job.build_id for update;
  perform 1 from public.instrument_blueprint_cells where blueprint_id in (select id from public.instrument_blueprints where build_id=job.build_id) for update;
  if public.instrument_likert_spec_snapshot(job.build_id) is distinct from p_expected_spec then
    raise exception 'Specification changed during the step; resume to review the current version' using errcode='PT409';
  end if;
  if p_cells is not null then
    target_bp := (p_cells->>'blueprintId')::uuid;
    if not exists(select 1 from public.instrument_blueprints where id=target_bp and build_id=job.build_id and deleted_at is null) then raise exception 'Blueprint does not belong to this build'; end if;
    -- Preserve referenced old cells for history, exclude them from current coverage.
    update public.instrument_blueprint_cells set retired_at=clock_timestamp() where blueprint_id=target_bp and retired_at is null;
    for cell in select value from jsonb_array_elements(p_cells->'cells') loop
      insert into public.instrument_blueprint_cells(id,blueprint_id,facet_label,facet_definition,intensity,target_item_count,display_order,retired_at)
      values((cell->>'id')::uuid,target_bp,cell->>'facetLabel',cell->>'facetDefinition',cell->>'intensity',(cell->>'targetItemCount')::integer,(cell->>'displayOrder')::integer,null)
      on conflict(blueprint_id,facet_label,intensity) do update set facet_definition=excluded.facet_definition,target_item_count=excluded.target_item_count,display_order=excluded.display_order,retired_at=null;
    end loop;
  end if;
  for item in select value from jsonb_array_elements(p_candidates) loop
    if not exists(select 1 from public.instrument_blueprint_cells c join public.instrument_blueprints b on b.id=c.blueprint_id where c.id=(item->>'blueprintCellId')::uuid and b.build_id=job.build_id and b.deleted_at is null and c.retired_at is null) then raise exception 'Item cell does not belong to the current build'; end if;
    select * into existing from public.instrument_candidate_items where id=(item->>'id')::uuid for update;
    if found then
      if existing.build_id <> job.build_id or existing.deleted_at is not null or existing.updated_at is distinct from (item->>'updatedAt')::timestamptz then
        raise exception 'Item changed during review; result was not committed' using errcode='PT409';
      end if;
      if existing.published_item_id is not null and (existing.stem is distinct from item->>'stem' or existing.reverse_scored is distinct from (item->>'reverseScored')::boolean) then raise exception 'Published items cannot be rewritten by automatic generation'; end if;
      update public.instrument_candidate_items set stem=item->>'stem',reverse_scored=(item->>'reverseScored')::boolean,status=item->>'status',payload=item->'payload',reading_grade=(item->>'readingGrade')::numeric,critique_verdict=item->>'critiqueVerdict',critique_reason=item->>'critiqueReason' where id=existing.id;
    else
      if item ? 'updatedAt' then raise exception 'Reviewed item was removed'; end if;
      insert into public.instrument_candidate_items(id,build_id,blueprint_cell_id,stem,reverse_scored,status,payload,facet,difficulty_tier,rationale)
      values((item->>'id')::uuid,job.build_id,(item->>'blueprintCellId')::uuid,item->>'stem',(item->>'reverseScored')::boolean,item->>'status',item->'payload',item->>'facet',item->>'difficultyTier',item->>'rationale');
    end if;
  end loop;
  if p_build_status is not null then update public.instrument_builds set status=p_build_status where id=job.build_id; end if;
  update public.instrument_stage_runs set output_snapshot=p_state,status=case p_state->>'phase' when 'complete' then 'success' when 'incomplete' then 'failure' else 'pending' end,detail=p_state->>'detail',completed_at=case when p_state->>'phase' in ('complete','incomplete') then clock_timestamp() else null end where id=p_job_id;
  update public.instrument_stage_runs set status='success',completed_at=clock_timestamp(),progress_pct=100,output_snapshot=p_output,detail=p_state->>'detail' where id=p_step_id;
end;
$$;
revoke all on function public.commit_instrument_likert_step(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_instrument_likert_step(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,text,jsonb) to service_role;

COMMIT;
