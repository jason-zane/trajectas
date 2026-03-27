-- ==========================================================================
-- 00020_candidate_session_campaign_link.sql
-- Extend candidate_sessions to support campaign-driven assessment flows.
-- ==========================================================================

-- Relax NOT NULL on candidate_profile_id (candidates don't need accounts)
ALTER TABLE candidate_sessions
    ALTER COLUMN candidate_profile_id DROP NOT NULL;

-- Relax NOT NULL on organization_id (campaign provides org context)
ALTER TABLE candidate_sessions
    ALTER COLUMN organization_id DROP NOT NULL;

-- Add campaign linkage columns
ALTER TABLE candidate_sessions
    ADD COLUMN campaign_id            UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    ADD COLUMN campaign_candidate_id  UUID REFERENCES campaign_candidates(id) ON DELETE SET NULL,
    ADD COLUMN current_section_id     UUID REFERENCES assessment_sections(id) ON DELETE SET NULL,
    ADD COLUMN current_item_index     INT DEFAULT 0,
    ADD COLUMN time_remaining_seconds JSONB DEFAULT '{}'::jsonb;

-- Add section_id to candidate_responses for section-level tracking
ALTER TABLE candidate_responses
    ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES assessment_sections(id) ON DELETE SET NULL;

-- Indexes for new columns
CREATE INDEX idx_candidate_sessions_campaign           ON candidate_sessions(campaign_id);
CREATE INDEX idx_candidate_sessions_campaign_candidate ON candidate_sessions(campaign_candidate_id);

COMMENT ON COLUMN candidate_sessions.campaign_id IS
    'Campaign this session belongs to (NULL for non-campaign sessions).';
COMMENT ON COLUMN candidate_sessions.campaign_candidate_id IS
    'The campaign candidate record that initiated this session.';
COMMENT ON COLUMN candidate_sessions.current_section_id IS
    'Resume tracking: the section the candidate is currently on.';
COMMENT ON COLUMN candidate_sessions.current_item_index IS
    'Resume tracking: the item index within the current section.';
COMMENT ON COLUMN candidate_sessions.time_remaining_seconds IS
    'Per-section timer state as JSON: { sectionId: secondsRemaining }.';
