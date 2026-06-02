-- =============================================================================
-- RLS for library_categories — reference data, readable by all signed-in users.
--
-- The table is created with RLS enabled but no policy, which blocks the
-- authenticated reads in getLibraryCategories + the Architect (they'd return
-- zero rows). Categories are non-sensitive reference data; allow SELECT to
-- authenticated. Writes happen only via migrations (no write policy).
-- =============================================================================

ALTER TABLE library_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_categories_select ON library_categories;
CREATE POLICY library_categories_select ON library_categories
  FOR SELECT TO authenticated USING (true);
