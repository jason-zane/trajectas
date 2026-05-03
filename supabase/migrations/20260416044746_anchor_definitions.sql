-- Add anchor definitions (low/high pole sentences) to taxonomy entity tables.
-- Idempotent: columns may already exist from a manual application.
alter table dimensions
  add column if not exists anchor_low text,
  add column if not exists anchor_high text;

alter table factors
  add column if not exists anchor_low text,
  add column if not exists anchor_high text;

alter table constructs
  add column if not exists anchor_low text,
  add column if not exists anchor_high text;

-- Ensure constraints exist (wrap in DO blocks for idempotency)
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'dimensions_anchor_low_check'
  ) then
    alter table dimensions add constraint dimensions_anchor_low_check check (char_length(anchor_low) <= 150);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'dimensions_anchor_high_check'
  ) then
    alter table dimensions add constraint dimensions_anchor_high_check check (char_length(anchor_high) <= 150);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'factors_anchor_low_check'
  ) then
    alter table factors add constraint factors_anchor_low_check check (char_length(anchor_low) <= 150);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'factors_anchor_high_check'
  ) then
    alter table factors add constraint factors_anchor_high_check check (char_length(anchor_high) <= 150);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'constructs_anchor_low_check'
  ) then
    alter table constructs add constraint constructs_anchor_low_check check (char_length(anchor_low) <= 150);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'constructs_anchor_high_check'
  ) then
    alter table constructs add constraint constructs_anchor_high_check check (char_length(anchor_high) <= 150);
  end if;
end $$;
;
