-- Add anchor definitions (low/high pole sentences) to taxonomy entity tables
alter table dimensions
  add column anchor_low text check (char_length(anchor_low) <= 150),
  add column anchor_high text check (char_length(anchor_high) <= 150);

alter table factors
  add column anchor_low text check (char_length(anchor_low) <= 150),
  add column anchor_high text check (char_length(anchor_high) <= 150);

alter table constructs
  add column anchor_low text check (char_length(anchor_low) <= 150),
  add column anchor_high text check (char_length(anchor_high) <= 150);
