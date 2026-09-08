-- Activate only the complete, unchanged form checked by the server. The normal
-- item lifecycle/sign-off ledger is separate; no human sign-offs are fabricated.
create or replace function public.activate_autonomous_likert_items(
  p_build_id uuid, p_publish_step_id uuid, p_job_id uuid, p_revision integer,
  p_expected_spec jsonb, p_expected_items jsonb
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  job public.instrument_stage_runs%rowtype;
  expected_count integer;
  format_id uuid;
begin
  perform 1 from public.instrument_stage_runs where id=p_publish_step_id and build_id=p_build_id and stage_key='publish_readiness' and status='running' and started_at > clock_timestamp() - interval '3 minutes' for update;
  if not found then raise exception 'Publication lease expired'; end if;
  select * into job from public.instrument_stage_runs where id=p_job_id for update;
  if not found or job.build_id<>p_build_id or job.stage_key<>'autonomous_likert' or job.output_snapshot->>'phase' is distinct from 'complete' or (job.output_snapshot->>'revision')::integer is distinct from p_revision then raise exception 'The reviewed Likert form changed'; end if;
  if jsonb_typeof(p_expected_items) is distinct from 'array' or jsonb_typeof(job.output_snapshot->'selectedIds') is distinct from 'array' then raise exception 'An explicit complete item set is required'; end if;
  select (config->'likert'->>'responseFormatId')::uuid into format_id from public.instrument_builds where id=p_build_id and deleted_at is null for update;
  if not found or format_id is null then raise exception 'A reviewed Likert specification is required'; end if;
  perform 1 from public.instrument_blueprints where build_id=p_build_id for update;
  perform 1 from public.instrument_blueprint_cells where blueprint_id in (select id from public.instrument_blueprints where build_id=p_build_id) for update;
  perform 1 from public.response_formats where id=format_id and type='likert' and is_active for update;
  if not found or public.instrument_likert_spec_snapshot(p_build_id) is distinct from p_expected_spec then raise exception 'The Likert specification or format changed'; end if;
  perform 1 from public.instrument_candidate_items where build_id=p_build_id for update;
  expected_count := jsonb_array_length(p_expected_items);
  if expected_count=0 or expected_count<>jsonb_array_length(job.output_snapshot->'selectedIds')
    or expected_count<>(select count(distinct value->>'id') from jsonb_array_elements(p_expected_items))
    or expected_count<>(select count(distinct value->>'publishedItemId') from jsonb_array_elements(p_expected_items))
    or expected_count<>(select count(*) from public.instrument_candidate_items where build_id=p_build_id and status='accepted' and deleted_at is null)
    or exists (
      select 1 from jsonb_array_elements(p_expected_items) e
      left join public.instrument_candidate_items c on c.id=(e->>'id')::uuid
      where c.id is null or c.build_id<>p_build_id or c.status<>'accepted' or c.deleted_at is not null
        or c.updated_at is distinct from (e->>'updatedAt')::timestamptz
        or c.published_item_id is null or c.published_item_id is distinct from (e->>'publishedItemId')::uuid
        or not (job.output_snapshot->'selectedIds' ? c.id::text)
    ) then raise exception 'The accepted item set changed or publication is incomplete'; end if;
  perform 1 from public.items where id in (select published_item_id from public.instrument_candidate_items where build_id=p_build_id and status='accepted' and deleted_at is null) for update;
  if exists (
    select 1 from public.instrument_candidate_items c
    join public.instrument_blueprint_cells cell on cell.id=c.blueprint_cell_id
    join public.instrument_blueprints bp on bp.id=cell.blueprint_id
    left join public.items i on i.id=c.published_item_id
    where c.build_id=p_build_id and c.status='accepted' and c.deleted_at is null
      and (i.id is null or i.deleted_at is not null or i.status not in ('draft','active')
        or i.stem is distinct from c.stem or i.reverse_scored is distinct from c.reverse_scored
        or i.response_format_id is distinct from format_id or i.construct_id is distinct from bp.construct_id
        or exists(select 1 from public.cognitive_item_specs s where s.item_id=i.id))
  ) then raise exception 'Published library items differ from the reviewed Likert form or are not eligible for activation'; end if;
  update public.items set status='active' where id in (select published_item_id from public.instrument_candidate_items where build_id=p_build_id and status='accepted' and deleted_at is null) and status='draft';
  update public.instrument_builds set status='published' where id=p_build_id;
  return expected_count;
end;
$$;
revoke all on function public.activate_autonomous_likert_items(uuid,uuid,uuid,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.activate_autonomous_likert_items(uuid,uuid,uuid,integer,jsonb,jsonb) to service_role;
