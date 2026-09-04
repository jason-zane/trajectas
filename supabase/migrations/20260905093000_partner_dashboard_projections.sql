-- Partner dashboard projections.
--
-- The dashboard's timeline and recent-activity panels were built as unordered
-- PostgREST selects that were bucketed and sorted in Node. PostgREST caps a
-- result at `max_rows` (1000), so both were silently wrong once a portfolio
-- grew past that: the timeline undercounted completions, and "recent activity"
-- showed whichever 1000 rows came back rather than the newest five. Both also
-- transferred a whole portfolio of rows to render a handful.
--
-- Aggregating and ordering here fixes the correctness problem and the transfer.
-- Both functions are SECURITY INVOKER, so the caller's RLS policies apply
-- exactly as they did to the queries these replace — a partner still sees only
-- the clients they own.

create or replace function public.partner_dashboard_completion_timeline(
  p_client_ids uuid[],
  p_days integer default 14
)
returns table (day date, completions bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (ps.completed_at at time zone 'UTC')::date as day,
    count(*)::bigint as completions
  from participant_sessions ps
  join campaigns c on c.id = ps.campaign_id
  where c.client_id = any(p_client_ids)
    and c.status = 'active'
    and c.deleted_at is null
    and ps.status = 'completed'
    and ps.completed_at is not null
    and ps.completed_at >= (now() - make_interval(days => greatest(p_days, 0)))
  group by 1
  order by 1;
$$;

comment on function public.partner_dashboard_completion_timeline(uuid[], integer) is
  'Completions per UTC day across a partner''s active campaigns. SECURITY INVOKER: RLS decides which campaigns are visible.';

create or replace function public.partner_dashboard_recent_results(
  p_client_ids uuid[],
  p_limit integer default 5
)
returns table (
  participant_id uuid,
  participant_name text,
  participant_email text,
  campaign_id uuid,
  campaign_title text,
  client_name text,
  latest_session_id uuid,
  status text,
  last_activity timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
      p.email::text
    ),
    p.email::text,
    p.campaign_id,
    coalesce(c.title, 'Unknown'),
    coalesce(cl.name, 'Unknown client'),
    s.id,
    p.status::text,
    coalesce(
      s.completed_at, s.started_at,
      p.completed_at, p.started_at, p.created_at
    )
  from campaign_participants p
  join campaigns c on c.id = p.campaign_id
  left join clients cl on cl.id = c.client_id
  -- The activity clock is the participant's newest session, falling back to
  -- the participant row itself. A lateral keeps that to one row per
  -- participant instead of fanning out and de-duplicating afterwards.
  left join lateral (
    select ps.id, ps.completed_at, ps.started_at
    from participant_sessions ps
    where ps.campaign_participant_id = p.id
    order by coalesce(ps.completed_at, ps.started_at) desc nulls last
    limit 1
  ) s on true
  where c.client_id = any(p_client_ids)
    and c.deleted_at is null
    and p.deleted_at is null
    and p.status in ('in_progress', 'completed')
  order by coalesce(
    s.completed_at, s.started_at,
    p.completed_at, p.started_at, p.created_at
  ) desc nulls last
  limit greatest(p_limit, 0);
$$;

comment on function public.partner_dashboard_recent_results(uuid[], integer) is
  'Newest participant movement across a partner''s portfolio, ordered and limited in the database. SECURITY INVOKER: RLS decides which participants are visible.';

revoke execute on function public.partner_dashboard_completion_timeline(uuid[], integer) from anon;
revoke execute on function public.partner_dashboard_recent_results(uuid[], integer) from anon;
grant execute on function public.partner_dashboard_completion_timeline(uuid[], integer) to authenticated;
grant execute on function public.partner_dashboard_recent_results(uuid[], integer) to authenticated;
