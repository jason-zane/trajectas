-- Per-profile campaign favorites/pins
create table if not exists campaign_favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, campaign_id)
);

-- Index for fast lookups by profile
create index if not exists idx_campaign_favorites_profile
  on campaign_favorites (profile_id);

-- RLS
alter table campaign_favorites enable row level security;

create policy "Users can manage their own favorites"
  on campaign_favorites
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
