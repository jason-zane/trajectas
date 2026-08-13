-- Cognitive item bank (LR-1 / #331) — Migration A: enum values only.
--
-- Postgres forbids USING an enum value in the transaction that ADDs it
-- (SQLSTATE 55P04). This hazard is documented at
-- supabase/migrations/00001_initial_schema.sql lines 45-51 and has
-- previously broken `supabase db reset`. Nothing below may be referenced —
-- in a CHECK constraint, a cast, a comparison, anything — until the next
-- migration (20260813100500_cognitive_item_bank.sql), which runs in its own
-- transaction.
--
-- See docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §1.1 for the design rationale.

ALTER TYPE item_purpose ADD VALUE IF NOT EXISTS 'practice';
ALTER TYPE item_purpose ADD VALUE IF NOT EXISTS 'seed';

-- Parallel lifecycle state machine for items. Deliberately NOT folded into
-- item_status ('draft'|'active'|'archived'), which is filtered on across the
-- admin UI, assessment composition, and DAL — adding piloting/calibrated/
-- operational/suspended/retired to it would silently change the meaning of
-- every `status = 'active'` query. items.lifecycle_state (added in the next
-- migration) carries this state machine instead; a trigger enforces
-- lifecycle_state='operational' ⇒ status='active' and
-- lifecycle_state='retired' ⇒ status='archived'.
CREATE TYPE item_lifecycle_state AS ENUM (
  'draft',
  'content_reviewed',
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
  'suspended',
  'retired',
  'killed'
);

-- Used by assessment_sections.section_role, added in the delivery/timing
-- migration (#332, out of scope here). Declared now so every enum lands in
-- this enums-only migration.
CREATE TYPE assessment_section_role AS ENUM ('scored', 'practice', 'instructions');

-- Used by assessments.scoring_profile, added in the scoring migration
-- (#333, out of scope here).
CREATE TYPE scoring_profile AS ENUM (
  'pomp_factor',          -- today's behaviour: scoreSessionCTT
  'ability_dichotomous',  -- sum-correct against keys
  'ability_irt'           -- EAP theta from item_parameters
);

-- Kind discriminator for cognitive_item_specs / cognitive_option_specs
-- (added in the next migration). Only figural matrices exist today;
-- deductive-reasoning and other cognitive item kinds add their own value
-- via a future enums-only migration.
CREATE TYPE cognitive_spec_kind AS ENUM ('figural_matrix');
