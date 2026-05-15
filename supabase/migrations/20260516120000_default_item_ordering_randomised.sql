-- Migration: default assessment_sections.item_ordering to 'randomised'.
--
-- Until now item_ordering was a configurable enum (fixed | randomised |
-- interleaved_by_construct) but the runtime never actually applied it — items
-- were always delivered in display_order. The accompanying code change adds
-- runtime ordering. Randomised is now the desired default so a fresh shuffle
-- happens for every session.
--
-- Backfill: existing rows still set to the historical default
-- ('interleaved_by_construct') are flipped to 'randomised'. Sections that an
-- admin has explicitly set to 'fixed' (notably SJT sections) are left alone.

ALTER TABLE public.assessment_sections
  ALTER COLUMN item_ordering SET DEFAULT 'randomised'::public.item_ordering;

UPDATE public.assessment_sections
   SET item_ordering = 'randomised'::public.item_ordering
 WHERE item_ordering = 'interleaved_by_construct'::public.item_ordering;
