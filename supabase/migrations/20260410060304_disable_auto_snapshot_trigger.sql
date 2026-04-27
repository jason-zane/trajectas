-- Disable auto-generation of report snapshots on session completion.
-- Reports are now generated on demand via the UI.
-- The function is kept in place in case the trigger needs to be re-enabled
-- in the future (e.g., for a lead generation flow).

DROP TRIGGER IF EXISTS on_session_completed_create_snapshots ON participant_sessions;;
