-- 20260814090000_instrument_stage_run_single_flight.sql
-- Make the instrument engine's "is a run already in flight?" guard atomic.
--
-- The application guard read instrument_stage_runs for a `running` row and then
-- inserted one. Two requests arriving inside that window both saw no run and
-- both proceeded — observed in practice as a double-click on "Generate missing
-- items" filling every empty blueprint cell twice.
--
-- A partial unique index makes the claim itself the lock: the second concurrent
-- insert fails on the constraint rather than racing. Application code catches
-- the unique violation and reports "already running".
--
-- Partial, so completed runs (success/failure/paused) are unconstrained and any
-- number of historical rows may exist per (build, stage).

CREATE UNIQUE INDEX IF NOT EXISTS instrument_stage_runs_single_flight
  ON instrument_stage_runs (build_id, stage_key)
  WHERE status = 'running';

COMMENT ON INDEX instrument_stage_runs_single_flight IS
  'At most one in-flight run per (build, stage): makes the concurrency guard atomic instead of read-then-insert.';
