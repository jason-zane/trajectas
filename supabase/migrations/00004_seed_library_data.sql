-- =============================================================================
-- Migration 00004: Seed Library Data
-- =============================================================================
-- Populates the taxonomy hierarchy with starter content:
--   4 dimensions, 8 competencies, 5 traits, competency-trait links,
--   4 response formats, 6 items with options.
--
-- All dimensions are is_scored = true (all scored by default).
-- Uses ON CONFLICT DO NOTHING for idempotency.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------
INSERT INTO dimensions (id, name, slug, description, is_scored, display_order, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Cognitive Ability', 'cognitive-ability',
   'Measures the mental capabilities that influence how effectively a person processes information, solves problems, and adapts to new situations.',
   true, 1, true),
  ('a1000000-0000-0000-0000-000000000002', 'Interpersonal Skills', 'interpersonal-skills',
   'Evaluates how well a person communicates, collaborates, and builds relationships in professional settings.',
   true, 2, true),
  ('a1000000-0000-0000-0000-000000000003', 'Leadership', 'leadership',
   'Assesses the ability to guide teams, make strategic decisions, and inspire others toward shared goals.',
   true, 3, true),
  ('a1000000-0000-0000-0000-000000000004', 'Emotional Intelligence', 'emotional-intelligence',
   'Gauges self-awareness, empathy, and the ability to manage emotions under pressure.',
   true, 4, true)
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Traits
-- ---------------------------------------------------------------------------
INSERT INTO traits (id, name, slug, description, is_active) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'Analytical Reasoning', 'analytical-reasoning',
   'The ability to break down complex problems into component parts and evaluate them systematically.',
   true),
  ('a2000000-0000-0000-0000-000000000002', 'Verbal Fluency', 'verbal-fluency',
   'Capacity to articulate ideas clearly and persuasively in written and spoken communication.',
   true),
  ('a2000000-0000-0000-0000-000000000003', 'Adaptability', 'adaptability',
   'Willingness and ability to adjust behaviour and approach in response to changing circumstances.',
   true),
  ('a2000000-0000-0000-0000-000000000004', 'Attention to Detail', 'attention-to-detail',
   'Thoroughness and precision in completing tasks, with a focus on accuracy and quality.',
   true),
  ('a2000000-0000-0000-0000-000000000005', 'Stress Tolerance', 'stress-tolerance',
   'The capacity to maintain composure and effectiveness under pressure or in ambiguous situations.',
   true)
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Competencies
-- ---------------------------------------------------------------------------
INSERT INTO competencies (id, name, slug, description, definition, dimension_id, is_active) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'Strategic Thinking', 'strategic-thinking',
   'The ability to analyse complex situations, anticipate future trends, and develop long-term plans that align with organisational goals.',
   'A cognitive competency involving pattern recognition across complex data sets, scenario planning, and the translation of insights into actionable strategies.',
   'a1000000-0000-0000-0000-000000000001', true),
  ('a3000000-0000-0000-0000-000000000002', 'Problem Solving', 'problem-solving',
   'Capacity to identify root causes of issues, generate creative solutions, and implement effective remedies in a timely manner.',
   NULL,
   'a1000000-0000-0000-0000-000000000001', true),
  ('a3000000-0000-0000-0000-000000000003', 'Critical Analysis', 'critical-analysis',
   'The ability to evaluate information objectively, identify biases, and draw sound conclusions from available evidence.',
   NULL,
   'a1000000-0000-0000-0000-000000000001', true),
  ('a3000000-0000-0000-0000-000000000004', 'Active Listening', 'active-listening',
   'Fully concentrating on, understanding, and responding thoughtfully to what others are saying in conversations and meetings.',
   NULL,
   'a1000000-0000-0000-0000-000000000002', true),
  ('a3000000-0000-0000-0000-000000000005', 'Empathy', 'empathy',
   'Understanding and sharing the feelings of others, enabling stronger relationships and more effective collaboration.',
   NULL,
   'a1000000-0000-0000-0000-000000000002', true),
  ('a3000000-0000-0000-0000-000000000006', 'Change Management', 'change-management',
   'Leading and managing organisational transitions effectively, helping teams adapt to new processes, systems, or structures.',
   NULL,
   'a1000000-0000-0000-0000-000000000003', true),
  ('a3000000-0000-0000-0000-000000000007', 'Resilience', 'resilience',
   'Maintaining effectiveness and composure during setbacks, pressure, or ambiguity, and recovering quickly from difficulties.',
   NULL,
   'a1000000-0000-0000-0000-000000000004', true),
  ('a3000000-0000-0000-0000-000000000008', 'Cultural Awareness', 'cultural-awareness',
   'Sensitivity to and understanding of diverse cultural norms, values, and perspectives in a global working environment.',
   NULL,
   NULL, true)
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Competency ↔ Trait links
-- ---------------------------------------------------------------------------
INSERT INTO competency_traits (id, competency_id, trait_id, weight, display_order) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 1.5, 1),
  ('a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 1.0, 2),
  ('a4000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 1.0, 1),
  ('a4000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000003', 0.8, 2),
  ('a4000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 1.2, 1),
  ('a4000000-0000-0000-0000-000000000006', 'a3000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004', 1.0, 2),
  ('a4000000-0000-0000-0000-000000000007', 'a3000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 1.0, 1),
  ('a4000000-0000-0000-0000-000000000008', 'a3000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000003', 1.0, 1),
  ('a4000000-0000-0000-0000-000000000009', 'a3000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000003', 1.2, 1),
  ('a4000000-0000-0000-0000-000000000010', 'a3000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000005', 1.0, 2),
  ('a4000000-0000-0000-0000-000000000011', 'a3000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000005', 1.5, 1)
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Response formats
-- ---------------------------------------------------------------------------
INSERT INTO response_formats (id, name, type, config) VALUES
  ('a5000000-0000-0000-0000-000000000001', '5-point Likert', 'likert',
   '{"points": 5, "anchors": {"1": "Strongly Disagree", "2": "Disagree", "3": "Neutral", "4": "Agree", "5": "Strongly Agree"}}'),
  ('a5000000-0000-0000-0000-000000000002', 'Forced Choice (A/B)', 'forced_choice',
   '{"options": 2}'),
  ('a5000000-0000-0000-0000-000000000003', 'Binary (Yes/No)', 'binary',
   '{"options": 2, "labels": {"0": "No", "1": "Yes"}}'),
  ('a5000000-0000-0000-0000-000000000004', 'Free Text', 'free_text',
   '{"maxLength": 2000}')
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
INSERT INTO items (id, competency_id, trait_id, response_format_id, stem, reverse_scored, display_order, status) VALUES
  ('a6000000-0000-0000-0000-000000000001',
   'a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'a5000000-0000-0000-0000-000000000001',
   'When faced with a complex problem, I prefer to break it down into smaller, manageable parts before attempting a solution.',
   false, 1, 'active'),
  ('a6000000-0000-0000-0000-000000000002',
   'a3000000-0000-0000-0000-000000000005', NULL,
   'a5000000-0000-0000-0000-000000000001',
   'I find it easy to see situations from other people''s perspectives, even when I disagree with them.',
   false, 2, 'active'),
  ('a6000000-0000-0000-0000-000000000003',
   'a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002',
   'a5000000-0000-0000-0000-000000000002',
   'Which best describes your approach: (A) I rely on data and evidence (B) I trust my intuition and experience.',
   false, 3, 'draft'),
  ('a6000000-0000-0000-0000-000000000004',
   'a3000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000003',
   'a5000000-0000-0000-0000-000000000003',
   'I can quickly adjust my plans when unexpected changes occur in a project.',
   false, 4, 'active'),
  ('a6000000-0000-0000-0000-000000000005',
   'a3000000-0000-0000-0000-000000000005', NULL,
   'a5000000-0000-0000-0000-000000000001',
   'In group settings, I tend to make sure everyone has had a chance to express their opinion before a decision is made.',
   true, 5, 'active'),
  ('a6000000-0000-0000-0000-000000000006',
   'a3000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000004',
   'a5000000-0000-0000-0000-000000000004',
   'Describe a situation where you had to lead a team through a significant change. What was your approach and what was the outcome?',
   false, 6, 'draft')
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- Item options (for Likert items)
-- ---------------------------------------------------------------------------
INSERT INTO item_options (id, item_id, label, value, display_order) VALUES
  -- Item 1 options (5-point Likert)
  ('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Strongly Disagree', 1, 1),
  ('a7000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000001', 'Disagree', 2, 2),
  ('a7000000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000001', 'Neutral', 3, 3),
  ('a7000000-0000-0000-0000-000000000004', 'a6000000-0000-0000-0000-000000000001', 'Agree', 4, 4),
  ('a7000000-0000-0000-0000-000000000005', 'a6000000-0000-0000-0000-000000000001', 'Strongly Agree', 5, 5),
  -- Item 2 options (5-point Likert)
  ('a7000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000002', 'Strongly Disagree', 1, 1),
  ('a7000000-0000-0000-0000-000000000007', 'a6000000-0000-0000-0000-000000000002', 'Disagree', 2, 2),
  ('a7000000-0000-0000-0000-000000000008', 'a6000000-0000-0000-0000-000000000002', 'Neutral', 3, 3),
  ('a7000000-0000-0000-0000-000000000009', 'a6000000-0000-0000-0000-000000000002', 'Agree', 4, 4),
  ('a7000000-0000-0000-0000-000000000010', 'a6000000-0000-0000-0000-000000000002', 'Strongly Agree', 5, 5),
  -- Item 3 options (Forced Choice)
  ('a7000000-0000-0000-0000-000000000011', 'a6000000-0000-0000-0000-000000000003', 'I rely on data and evidence', 1, 1),
  ('a7000000-0000-0000-0000-000000000012', 'a6000000-0000-0000-0000-000000000003', 'I trust my intuition and experience', 2, 2),
  -- Item 4 options (Binary)
  ('a7000000-0000-0000-0000-000000000013', 'a6000000-0000-0000-0000-000000000004', 'Yes', 1, 1),
  ('a7000000-0000-0000-0000-000000000014', 'a6000000-0000-0000-0000-000000000004', 'No', 0, 2),
  -- Item 5 options (5-point Likert)
  ('a7000000-0000-0000-0000-000000000015', 'a6000000-0000-0000-0000-000000000005', 'Strongly Disagree', 1, 1),
  ('a7000000-0000-0000-0000-000000000016', 'a6000000-0000-0000-0000-000000000005', 'Disagree', 2, 2),
  ('a7000000-0000-0000-0000-000000000017', 'a6000000-0000-0000-0000-000000000005', 'Neutral', 3, 3),
  ('a7000000-0000-0000-0000-000000000018', 'a6000000-0000-0000-0000-000000000005', 'Agree', 4, 4),
  ('a7000000-0000-0000-0000-000000000019', 'a6000000-0000-0000-0000-000000000005', 'Strongly Agree', 5, 5)
ON CONFLICT DO NOTHING;
