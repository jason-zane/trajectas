BEGIN;
-- =========================================================================
-- Move hardcoded Likert anchor presets to a database table
-- =========================================================================

CREATE TABLE anchor_presets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type           TEXT    NOT NULL,
    label          TEXT    NOT NULL,
    points         INT     NOT NULL,
    anchors        JSONB   NOT NULL,
    display_order  INT     NOT NULL DEFAULT 0,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT anchor_presets_unique UNIQUE (type, points),
    CONSTRAINT anchor_presets_points_valid CHECK (points >= 2)
);
COMMENT ON TABLE anchor_presets IS
    'Likert scale anchor label presets. Users pick a type + point count to auto-populate labels.';
ALTER TABLE anchor_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY anchor_presets_select ON anchor_presets
    FOR SELECT USING (true);
CREATE POLICY anchor_presets_all_platform_admin ON anchor_presets
    FOR ALL USING (is_platform_admin());
-- =========================================================================
-- Seed: Agreement presets
-- =========================================================================
INSERT INTO anchor_presets (type, label, points, anchors, display_order) VALUES
('agreement', 'Agreement', 3,  '["Disagree","Neutral","Agree"]', 0),
('agreement', 'Agreement', 4,  '["Strongly Disagree","Disagree","Agree","Strongly Agree"]', 0),
('agreement', 'Agreement', 5,  '["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"]', 0),
('agreement', 'Agreement', 6,  '["Strongly Disagree","Disagree","Slightly Disagree","Slightly Agree","Agree","Strongly Agree"]', 0),
('agreement', 'Agreement', 7,  '["Strongly Disagree","Disagree","Somewhat Disagree","Neutral","Somewhat Agree","Agree","Strongly Agree"]', 0),
('agreement', 'Agreement', 8,  '["Strongly Disagree","Disagree","Somewhat Disagree","Slightly Disagree","Slightly Agree","Somewhat Agree","Agree","Strongly Agree"]', 0),
('agreement', 'Agreement', 9,  '["Strongly Disagree","Disagree","Somewhat Disagree","Slightly Disagree","Neutral","Slightly Agree","Somewhat Agree","Agree","Strongly Agree"]', 0),
('agreement', 'Agreement', 10, '["Strongly Disagree","Disagree","Somewhat Disagree","Slightly Disagree","Mildly Disagree","Mildly Agree","Slightly Agree","Somewhat Agree","Agree","Strongly Agree"]', 0);
-- =========================================================================
-- Seed: Frequency presets
-- =========================================================================
INSERT INTO anchor_presets (type, label, points, anchors, display_order) VALUES
('frequency', 'Frequency', 3,  '["Never","Sometimes","Always"]', 1),
('frequency', 'Frequency', 4,  '["Never","Rarely","Often","Always"]', 1),
('frequency', 'Frequency', 5,  '["Never","Rarely","Sometimes","Often","Always"]', 1),
('frequency', 'Frequency', 6,  '["Never","Rarely","Occasionally","Sometimes","Often","Always"]', 1),
('frequency', 'Frequency', 7,  '["Never","Very Rarely","Rarely","Sometimes","Often","Very Often","Always"]', 1),
('frequency', 'Frequency', 8,  '["Never","Very Rarely","Rarely","Occasionally","Sometimes","Often","Very Often","Always"]', 1),
('frequency', 'Frequency', 9,  '["Never","Very Rarely","Rarely","Occasionally","Sometimes","Frequently","Often","Very Often","Always"]', 1),
('frequency', 'Frequency', 10, '["Never","Almost Never","Very Rarely","Rarely","Occasionally","Sometimes","Frequently","Often","Very Often","Always"]', 1);
-- =========================================================================
-- Seed: Capability presets
-- =========================================================================
INSERT INTO anchor_presets (type, label, points, anchors, display_order) VALUES
('capability', 'Capability', 3,  '["Cannot Do","Can Partially Do","Can Fully Do"]', 2),
('capability', 'Capability', 4,  '["Cannot Do","Struggling","Competent","Expert"]', 2),
('capability', 'Capability', 5,  '["Cannot Do","Novice","Developing","Competent","Expert"]', 2),
('capability', 'Capability', 6,  '["Cannot Do","Beginner","Developing","Competent","Proficient","Expert"]', 2),
('capability', 'Capability', 7,  '["Cannot Do","Beginner","Novice","Developing","Competent","Proficient","Expert"]', 2),
('capability', 'Capability', 8,  '["Cannot Do","Beginner","Novice","Developing","Competent","Proficient","Advanced","Expert"]', 2),
('capability', 'Capability', 9,  '["Cannot Do","Beginner","Novice","Developing","Intermediate","Competent","Proficient","Advanced","Expert"]', 2),
('capability', 'Capability', 10, '["Cannot Do","Beginner","Novice","Elementary","Developing","Intermediate","Competent","Proficient","Advanced","Expert"]', 2);
COMMIT;
