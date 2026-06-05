-- Assessment resume reminders
-- ----------------------------------------------------------------------------
-- Supports a two-tier "pick up where you left off" nudge for participants who
-- start an assessment (status = 'in_progress') but do not finish:
--
--   Tier 1 — sent after ~5 minutes of inactivity since their last answer.
--   Tier 2 — sent ~24 hours after Tier 1 if the session is still in_progress.
--
-- A cron sweep (/api/cron/assessment-resume-reminders) selects due sessions
-- using the columns below; the send logic lives in
-- src/lib/assess/resume-reminders.ts.
--
-- "Activity" is captured by a trigger on participant_responses, so any write
-- path (the save-batch RPC, the single-save RPC, or a direct admin write)
-- keeps last_activity_at fresh without each call site having to remember to.

-- 1. Tracking columns -------------------------------------------------------

alter table public.participant_sessions
  add column if not exists last_activity_at timestamptz,
  add column if not exists resume_reminder_count smallint not null default 0,
  add column if not exists resume_reminder_last_sent_at timestamptz;

-- Backfill existing rows so the NOT NULL constraint below holds and the sweep
-- has a sensible baseline (treat session start, else creation, as last touch).
update public.participant_sessions
   set last_activity_at = coalesce(started_at, created_at)
 where last_activity_at is null;

alter table public.participant_sessions
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null;

-- 2. Activity trigger -------------------------------------------------------
-- Statement-level so a batched upsert of N responses bumps the parent session
-- exactly once per statement rather than once per row.

create or replace function public.bump_session_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.participant_sessions s
     set last_activity_at = now()
    from new_rows nr
   where s.id = nr.session_id;
  return null;
end;
$$;

-- Functions are granted EXECUTE to PUBLIC by default, which PostgREST exposes
-- as an RPC. Revoke from PUBLIC (and the API roles explicitly) so this
-- SECURITY DEFINER helper cannot be invoked from the API — it is only ever
-- meant to fire as a trigger.
revoke execute on function public.bump_session_activity() from public, anon, authenticated;

-- Two triggers (one per event): a transition table cannot be attached to a
-- trigger declared for more than one event.
drop trigger if exists participant_responses_bump_activity_ins on public.participant_responses;
create trigger participant_responses_bump_activity_ins
  after insert on public.participant_responses
  referencing new table as new_rows
  for each statement
  execute function public.bump_session_activity();

drop trigger if exists participant_responses_bump_activity_upd on public.participant_responses;
create trigger participant_responses_bump_activity_upd
  after update on public.participant_responses
  referencing new table as new_rows
  for each statement
  execute function public.bump_session_activity();

-- 3. Sweep index ------------------------------------------------------------
-- Partial index covering the tier-1 selection (in_progress sessions ordered by
-- inactivity). Tier 2 reuses it for the in_progress filter; its volume is tiny.

create index if not exists idx_participant_sessions_resume_due
  on public.participant_sessions (last_activity_at)
  where status = 'in_progress';
