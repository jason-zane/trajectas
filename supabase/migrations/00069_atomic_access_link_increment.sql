-- Atomic increment of campaign_access_links.use_count with built-in guard.
-- Returns TRUE if the row was updated (link is valid, active, and has capacity).
-- Returns FALSE if the link is full, inactive, or expired — caller should roll
-- back any participant insert made in the same request.

CREATE OR REPLACE FUNCTION increment_access_link_usage(p_link_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INT;
BEGIN
  UPDATE campaign_access_links
  SET use_count = use_count + 1
  WHERE id = p_link_id
    AND is_active = true
    AND (max_uses IS NULL OR use_count < max_uses)
    AND (expires_at IS NULL OR expires_at > now());

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;
