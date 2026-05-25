-- =============================================================================
-- 20260525120000 — factors.composition_locked
-- Adds a composition lock to factors. When locked, constructs cannot be added,
-- removed, or reweighted on this factor. Protects psychometric meaning over
-- time so that scores from past respondents remain comparable to future scores.
--
-- Phase 1 of taxonomy unification (see
-- docs/superpowers/specs/2026-05-25-taxonomy-unification-design.md).
-- Lock enforcement happens in the application layer (server actions) — this
-- migration only introduces the column.
-- =============================================================================

ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS composition_locked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN factors.composition_locked IS
  'When true, the set of constructs linked to this factor is frozen — no adds, removes, or weight changes. Protects score comparability over time. Auto-set to true when a factor is created via the "duplicate from construct" mechanism. Admin can toggle off but is warned about score continuity implications.';
