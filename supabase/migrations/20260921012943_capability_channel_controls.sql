-- Independent distribution choices. Existing assessment eligibility is preserved;
-- public publication requires an explicit administrator choice after rollout.
alter table public.factors
  add column is_assessment_eligible boolean not null default true,
  add column is_public_visible boolean not null default false;
comment on column public.factors.is_assessment_eligible is 'Available for new manual assessment composition; existing assessments are retained.';
comment on column public.factors.is_public_visible is 'Published in the public capability reference; active, platform-owned factors only.';

-- Lock and validate the entire selection before changing any row.
create or replace function public.set_capability_channel(p_ids uuid[], p_channel text, p_enabled boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare eligible_count integer;
begin
  if p_channel not in ('matching', 'assessment', 'public') or p_channel is null or p_enabled is null
     or cardinality(p_ids) is null or cardinality(p_ids) < 1 or cardinality(p_ids) > 200 then
    raise exception 'Invalid availability change';
  end if;
  perform id from public.factors where id = any(p_ids) order by id for update;
  select count(*) into eligible_count from public.factors
    where id = any(p_ids) and client_id is null and deleted_at is null
    and (not p_enabled or (is_active and case when p_channel = 'public'
      then primary_category_id is not null and length(trim(coalesce(definition, ''))) > 0
      else readiness <> 'draft' end));
  if eligible_count <> cardinality(p_ids) then
    raise exception 'Some selected capabilities are unavailable or not ready. Refresh and review the selection.';
  end if;
  update public.factors set
    is_match_eligible = case when p_channel = 'matching' then p_enabled else is_match_eligible end,
    is_assessment_eligible = case when p_channel = 'assessment' then p_enabled else is_assessment_eligible end,
    is_public_visible = case when p_channel = 'public' then p_enabled else is_public_visible end
    where id = any(p_ids);
end;
$$;
revoke all on function public.set_capability_channel(uuid[], text, boolean) from public, anon, authenticated;
grant execute on function public.set_capability_channel(uuid[], text, boolean) to service_role;

-- Launch the reviewed, established reference library. Future additions default private.
update public.factors set is_public_visible = true
where client_id is null and deleted_at is null and is_active
  and readiness <> 'draft' and primary_category_id is not null
  and length(trim(coalesce(definition, ''))) > 0;
