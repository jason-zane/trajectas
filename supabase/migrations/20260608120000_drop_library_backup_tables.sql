-- Drop one-off backup tables left behind by the taxonomy-unification and
-- legacy-library-archive migrations (2026-05-25). They were point-in-time
-- snapshots taken before destructive data migrations and are no longer needed.
--
-- They also tripped the security advisor (RLS enabled, no policy) and showed up
-- as noise in the schema. Nothing references them (no inbound FKs).
--
-- `_legacy_library_backup`        — snapshot from 20260525170000_archive_legacy_non_brain_library_content.sql
-- `_taxonomy_unification_backup`  — snapshot from 20260525130000_taxonomy_unification_data_migration.sql

drop table if exists public._legacy_library_backup;
drop table if exists public._taxonomy_unification_backup;
