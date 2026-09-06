// Safe for authenticated Data API reads. Participant bearer tokens are only
// selected by server-side operations with an explicit management gate.
export const PARTICIPANT_COLUMNS = 'id,campaign_id,email,first_name,last_name,job_title,company,status,invited_at,started_at,completed_at,consent_given_at,created_at,updated_at'
