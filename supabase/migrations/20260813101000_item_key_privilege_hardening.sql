-- Cognitive item bank (LR-1 / #331) — Migration C: legacy key hardening.
--
-- Spec: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §1.2.6. Kept as its own file, separate from
-- 20260813100500_cognitive_item_bank.sql, so it can be reverted
-- independently if an unnoticed RLS-scoped reader of these columns/tables
-- surfaces (per the doc's §9 migration-ordering rationale).
--
-- Deviation from the doc, found by checking the live policies before
-- writing this file: item_parameters currently carries TWO select
-- policies — item_parameters_select_authenticated (the one the doc names)
-- *and* item_parameters_select_anon, added in the same
-- 20260612080000_rls_cross_role_normalization.sql sweep that split every
-- policy into one-per-role. Both use
-- `is_platform_admin() OR (select auth.uid()) IS NOT NULL`, so any
-- authenticated user — not just platform_admin — can currently read
-- item_parameters. Dropping only the _authenticated policy (as the doc's
-- literal SQL does) would leave the _anon one in place. This migration
-- drops both and adds a single platform_admin-gated policy, using the
-- existing is_platform_admin() helper (the repo's established pattern —
-- see item_options/item_parameters INSERT/UPDATE/DELETE policies) rather
-- than the doc's inlined `EXISTS (SELECT ... FROM profiles ...)`, which is
-- equivalent but duplicates a helper that already exists precisely for
-- this. item_statistics carried only the one policy the doc describes.

-- ===========================================================================
-- Column-level privilege split on item_options.score_value
-- ===========================================================================
-- items/item_options are readable by every authenticated user (RLS policy
-- `is_platform_admin() OR auth.uid() IS NOT NULL`) — score_value rides
-- along today. Every read of item_options in the codebase goes through the
-- service-role admin client (verified: src/app/actions/assess.ts,
-- src/app/actions/items.ts and src/lib/scoring/ctt-session.ts all use
-- createAdminClient(), and none issues `SELECT *` on this table), so
-- removing the column from the anon/authenticated grant is zero-risk to
-- existing behaviour and closes the leak for any future RLS-scoped reader.
--
-- IMPORTANT — why this is a table-level REVOKE followed by a column-level
-- GRANT, and not simply `REVOKE SELECT (score_value)`:
--
--   In PostgreSQL a column-level REVOKE cannot subtract from a table-level
--   grant. Supabase's platform bootstrap issues a blanket
--   `GRANT ALL ON ALL TABLES IN SCHEMA public` (plus ALTER DEFAULT
--   PRIVILEGES) to anon/authenticated/service_role, so item_options carries
--   `authenticated=arwdDxt/postgres` at the table level. Against that,
--   `REVOKE SELECT (score_value) ...` is a silent no-op: it writes no column
--   ACL entry and has_column_privilege() still returns true. Verified
--   empirically via scripts/pg-migrate-check.sh.
--
--   The only way to withhold one column is to drop the table-level SELECT
--   and grant back the columns that should remain readable. Any column added
--   to item_options in future must be added to the GRANT below, or it will
--   be unreadable by anon/authenticated — an intentional fail-closed
--   default for a table that holds answer keys.

REVOKE SELECT ON TABLE item_options FROM anon, authenticated;
GRANT SELECT (id, item_id, label, value, display_order, exclude_from_scoring)
  ON TABLE item_options TO anon, authenticated;

-- ===========================================================================
-- Forbid keys on cognitive item options
-- ===========================================================================
-- Cognitive items must never carry keys on options — keys live in
-- item_answer_keys and nowhere else. cognitive_item_specs (created in the
-- prior migration) is the signal that an item is a cognitive item.

CREATE OR REPLACE FUNCTION public.forbid_option_keys_on_cognitive_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.score_value IS NOT NULL
     AND EXISTS (SELECT 1 FROM cognitive_item_specs s WHERE s.item_id = NEW.item_id) THEN
    RAISE EXCEPTION
      'cognitive item % must not carry item_options.score_value; use item_answer_keys',
      NEW.item_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER forbid_option_keys_on_cognitive_items_trg
  BEFORE INSERT OR UPDATE ON item_options
  FOR EACH ROW EXECUTE FUNCTION public.forbid_option_keys_on_cognitive_items();

-- ===========================================================================
-- Tighten the anon-readable item tables
-- ===========================================================================
-- item_media / item_scoring_rubrics currently SELECT USING (true) with no
-- TO clause, which PostgreSQL applies to every role including anon
-- (verified: 00005_foundation_alignment.sql, untouched since). Restrict to
-- authenticated, matching item_options' existing policy shape.

DROP POLICY item_media_select ON item_media;
CREATE POLICY item_media_select ON item_media
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
DROP POLICY item_scoring_rubrics_select ON item_scoring_rubrics;
CREATE POLICY item_scoring_rubrics_select ON item_scoring_rubrics
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ===========================================================================
-- Item parameters / statistics are commercial IP, not general dashboard data
-- ===========================================================================
-- See file-header note: item_parameters has two current SELECT policies
-- (anon + authenticated), both effectively "any logged-in user"; both are
-- dropped here. item_statistics has one ("authenticated USING (true)").

DROP POLICY item_parameters_select_anon ON item_parameters;
DROP POLICY item_parameters_select_authenticated ON item_parameters;
CREATE POLICY item_parameters_select_platform_admin ON item_parameters
  FOR SELECT TO authenticated USING (is_platform_admin());

DROP POLICY item_statistics_select ON item_statistics;
CREATE POLICY item_statistics_select_platform_admin ON item_statistics
  FOR SELECT TO authenticated USING (is_platform_admin());
