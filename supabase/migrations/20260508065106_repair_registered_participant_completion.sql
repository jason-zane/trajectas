-- Repair campaign participants whose session rows prove they moved past the
-- registration state. This fixes public-link registrations created before the
-- runner promoted `registered` participants through the normal lifecycle.

WITH completed_participants AS (
  SELECT
    cp.id AS participant_id,
    min(ps.started_at) FILTER (
      WHERE ps.status = 'completed'
    ) AS first_started_at,
    max(ps.completed_at) FILTER (
      WHERE ps.status = 'completed'
    ) AS last_completed_at
  FROM campaign_participants cp
  JOIN campaign_assessments ca
    ON ca.campaign_id = cp.campaign_id
   AND ca.is_required = true
   AND ca.deleted_at IS NULL
  LEFT JOIN participant_sessions ps
    ON ps.campaign_participant_id = cp.id
   AND ps.assessment_id = ca.assessment_id
   AND ps.status = 'completed'
  WHERE cp.deleted_at IS NULL
    AND cp.status IN ('invited', 'registered', 'in_progress')
  GROUP BY cp.id
  HAVING count(DISTINCT ca.assessment_id) > 0
     AND count(DISTINCT ca.assessment_id) = count(DISTINCT ps.assessment_id)
)
UPDATE campaign_participants cp
SET
  status = 'completed',
  started_at = COALESCE(
    cp.started_at,
    completed_participants.first_started_at,
    completed_participants.last_completed_at
  ),
  completed_at = COALESCE(
    cp.completed_at,
    completed_participants.last_completed_at,
    now()
  )
FROM completed_participants
WHERE cp.id = completed_participants.participant_id;

WITH started_participants AS (
  SELECT
    cp.id AS participant_id,
    min(ps.started_at) FILTER (
      WHERE ps.status IN ('in_progress', 'completed')
    ) AS first_started_at
  FROM campaign_participants cp
  JOIN participant_sessions ps
    ON ps.campaign_participant_id = cp.id
   AND ps.status IN ('in_progress', 'completed')
  WHERE cp.deleted_at IS NULL
    AND cp.status IN ('invited', 'registered')
  GROUP BY cp.id
)
UPDATE campaign_participants cp
SET
  status = 'in_progress',
  started_at = COALESCE(cp.started_at, started_participants.first_started_at, now())
FROM started_participants
WHERE cp.id = started_participants.participant_id;
