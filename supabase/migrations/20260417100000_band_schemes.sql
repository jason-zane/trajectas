-- Platform-level settings table for global configuration
create table if not exists platform_settings (
  id uuid primary key default gen_random_uuid(),
  band_scheme jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed the platform default with the current 3-band scheme
insert into platform_settings (band_scheme) values (
  '{
    "palette": "red-amber-green",
    "bands": [
      {"key": "developing", "label": "Developing", "min": 0, "max": 40, "indicatorTier": "low"},
      {"key": "effective", "label": "Effective", "min": 41, "max": 69, "indicatorTier": "mid"},
      {"key": "highly_effective", "label": "Highly Effective", "min": 70, "max": 100, "indicatorTier": "high"}
    ]
  }'::jsonb
);

-- Partner-level override (null = inherit from platform)
alter table partners add column if not exists band_scheme jsonb;

-- Template-level override (null = inherit from partner)
alter table report_templates add column if not exists band_scheme jsonb;
