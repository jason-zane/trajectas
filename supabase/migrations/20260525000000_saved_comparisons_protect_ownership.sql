-- Saved comparisons: protect ownership/scope fields from non-owner edits.
--
-- The team-update RLS policies allow any teammate in the same client /
-- partner / platform scope to UPDATE rows where share_scope='team'.
-- That's collaborative editing of the comparison content (entries,
-- assessments, levels, etc.) — but it should NOT let teammates change
-- structural fields (owner_id, client_id, partner_id, share_scope),
-- because that would let a teammate take ownership of the row or hide
-- it from the rest of the team.
--
-- RLS WITH CHECK can only see the post-update row, not the pre-update
-- one, so a BEFORE UPDATE trigger is the right shape. The trigger
-- re-raises the structural fields back to OLD if the editor is not the
-- owner.

CREATE OR REPLACE FUNCTION comparisons_protect_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.owner_id   IS DISTINCT FROM OLD.owner_id)
     OR (NEW.client_id  IS DISTINCT FROM OLD.client_id)
     OR (NEW.partner_id IS DISTINCT FROM OLD.partner_id)
     OR (NEW.share_scope IS DISTINCT FROM OLD.share_scope) THEN
    IF (select auth.uid()) IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'comparisons: only the owner can change ownership, scope, or share scope'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comparisons_protect_ownership ON comparisons;
CREATE TRIGGER comparisons_protect_ownership
  BEFORE UPDATE ON comparisons
  FOR EACH ROW EXECUTE FUNCTION comparisons_protect_ownership();
