-- Leadership 360 — exclude rater taking-rows from campaign participant counts.
--
-- 360 rater observer-survey rows live in campaign_participants (linked via
-- campaign_rater_id). They must NOT be counted as normal participants, or a
-- subject + 10 raters would report 11 participants and completed raters would
-- inflate completed_count. Both counts now require campaign_rater_id IS NULL.
--
-- Also surfaces campaigns.kind through the view (it was previously omitted, so
-- consumers reading the view couldn't tell self from 360 campaigns).

-- CREATE OR REPLACE VIEW only allows appending columns at the END (not
-- reordering), so kind is added last while existing columns keep their order.
CREATE OR REPLACE VIEW campaigns_with_counts AS
  SELECT c.id,
     c.title,
     c.slug,
     c.description,
     c.status,
     c.client_id,
     c.partner_id,
     c.created_by,
     c.opens_at,
     c.closes_at,
     c.branding,
     c.allow_resume,
     c.show_progress,
     c.randomize_assessment_order,
     c.created_at,
     c.updated_at,
     c.deleted_at,
     COALESCE((SELECT count(*)::integer
            FROM campaign_participants cp
           WHERE cp.campaign_id = c.id
             AND cp.deleted_at IS NULL
             AND cp.campaign_rater_id IS NULL), 0) AS participant_count,
     COALESCE((SELECT count(*)::integer
            FROM campaign_participants cp
           WHERE cp.campaign_id = c.id
             AND cp.deleted_at IS NULL
             AND cp.campaign_rater_id IS NULL
             AND cp.status = 'completed'::campaign_participant_status), 0) AS completed_count,
     COALESCE((SELECT count(*)::integer
            FROM campaign_assessments ca
           WHERE ca.campaign_id = c.id
             AND ca.deleted_at IS NULL), 0) AS assessment_count,
     c.kind
    FROM campaigns c;
