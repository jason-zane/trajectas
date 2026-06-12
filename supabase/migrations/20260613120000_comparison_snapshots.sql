-- Trajectory growth-report snapshots
-- ----------------------------------
-- A `comparison_snapshots` row is a FROZEN copy of a trajectory canvas at
-- the moment a growth report was generated: the people, their score series
-- at both taxonomy layers, and the view state (charted competency, order,
-- show-change). Reports rendered from a snapshot never drift when new
-- results arrive or taxonomy is renamed — the point-in-time record is what
-- makes the PDF defensible for selection decisions.
--
-- Rows are immutable by design: no UPDATE policy and no UPDATE grant.
-- Visibility: the owner, plus members of the client the snapshot belongs
-- to (a report about a client's people is team-readable, like a shared
-- comparison).

CREATE TABLE IF NOT EXISTS comparison_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  title         text NOT NULL,
  -- Frozen CanvasResult (people + entities + series), exactly as charted.
  canvas        jsonb NOT NULL,
  -- Charted competency, order, show-change — reproduces the on-screen view.
  view_state    jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT comparison_snapshots_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS comparison_snapshots_owner_idx
  ON comparison_snapshots (owner_id);
CREATE INDEX IF NOT EXISTS comparison_snapshots_client_idx
  ON comparison_snapshots (client_id) WHERE client_id IS NOT NULL;

ALTER TABLE comparison_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY comparison_snapshots_owner_select ON comparison_snapshots
  FOR SELECT USING (owner_id = (select auth.uid()));
CREATE POLICY comparison_snapshots_owner_insert ON comparison_snapshots
  FOR INSERT WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY comparison_snapshots_owner_delete ON comparison_snapshots
  FOR DELETE USING (owner_id = (select auth.uid()));

CREATE POLICY comparison_snapshots_client_select ON comparison_snapshots
  FOR SELECT USING (
    client_id IS NOT NULL
    AND client_id = ANY (auth_user_client_ids())
  );

GRANT SELECT, INSERT, DELETE ON comparison_snapshots TO authenticated;
