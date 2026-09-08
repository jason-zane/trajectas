-- Service-only transactional checkpoint for autonomous Likert generation.
-- AI/network work occurs outside the transaction. A fenced step lease, job
-- revision, specification snapshot and item versions must still match at commit.
create or replace function public.instrument_likert_spec_snapshot(p_build_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'build', (select jsonb_build_object('measure_type',b.measure_type,'brief',b.brief,'audience',b.audience,'use_context',b.use_context,'config',b.config,'target',b.target_items_per_construct) from public.instrument_builds b where b.id=p_build_id and b.deleted_at is null),
    'blueprints', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.draft_construct_name,'definition',b.draft_construct_definition,'exclusions',b.exclusions,'measure_type',b.measure_type) order by b.id) from public.instrument_blueprints b where b.build_id=p_build_id and b.deleted_at is null),'[]'::jsonb),
    'cells', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'blueprint_id',c.blueprint_id,'facet_label',c.facet_label,'facet_definition',c.facet_definition,'intensity',c.intensity,'target_item_count',c.target_item_count,'display_order',c.display_order) order by c.id) from public.instrument_blueprint_cells c join public.instrument_blueprints b on b.id=c.blueprint_id where b.build_id=p_build_id and b.deleted_at is null and c.retired_at is null),'[]'::jsonb),
    'format', (select to_jsonb(f) - 'updated_at' - 'created_at' from public.response_formats f join public.instrument_builds b on f.id::text=b.config->'likert'->>'responseFormatId' where b.id=p_build_id)
  );
$$;
revoke all on function public.instrument_likert_spec_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.instrument_likert_spec_snapshot(uuid) to service_role;

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
    raise exception 'Likert step lease expired; result was not committed' using errcode='40001';
  end if;
  select * into job from public.instrument_stage_runs where id=p_job_id for update;
  if not found or job.build_id <> step.build_id or job.stage_key <> 'autonomous_likert' or (job.output_snapshot->>'revision')::integer <> p_revision then
    raise exception 'Likert job changed; reload its saved state' using errcode='40001';
  end if;
  if (p_state->>'revision')::integer <> p_revision+1 then raise exception 'Invalid checkpoint revision'; end if;
  perform 1 from public.instrument_builds where id=job.build_id and deleted_at is null for update;
  if not found then raise exception 'Build no longer exists'; end if;
  if exists(select 1 from public.instrument_builds where id=job.build_id and status='published') then raise exception 'Published instruments cannot be regenerated'; end if;
  if exists(select 1 from public.instrument_stage_runs where build_id=job.build_id and stage_key='publish_readiness' and status='running') then raise exception 'Publication is in progress; automatic generation cannot overwrite it' using errcode='40001'; end if;
  perform 1 from public.instrument_blueprints where build_id=job.build_id for update;
  perform 1 from public.instrument_blueprint_cells where blueprint_id in (select id from public.instrument_blueprints where build_id=job.build_id) for update;
  if public.instrument_likert_spec_snapshot(job.build_id) is distinct from p_expected_spec then
    raise exception 'Specification changed during the step; resume to review the current version' using errcode='40001';
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
        raise exception 'Item changed during review; result was not committed' using errcode='40001';
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
