-- Contact form submissions from the marketing website
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  message text not null,
  created_at timestamptz not null default now()
);

-- RLS: no public access, only service role can insert/read
alter table public.contact_submissions enable row level security;
