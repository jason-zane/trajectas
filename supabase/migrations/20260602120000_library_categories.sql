-- =============================================================================
-- Library categories — the high-level grouping above dimensions
--
-- Five action-named categories that classify every factor by the kind of
-- capability it measures, giving coverage + matching a "whole-person" frame.
-- Stored as a table (not an enum) so the definitions and the categorisation
-- decision-rules are first-class, editable data — and so the AI categoriser
-- and human reviewers reference one source of truth.
--
-- See docs/superpowers/specs/2026-06-02-library-data-quality-and-ingestion-design.md
-- =============================================================================

CREATE TABLE IF NOT EXISTS library_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  definition    TEXT NOT NULL,
  decision_rule TEXT NOT NULL,
  display_order INT  NOT NULL,
  colour        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);

COMMENT ON TABLE library_categories IS
  'High-level competency categories (above dimensions). Classify each factor by the kind of capability it measures.';

INSERT INTO library_categories (key, name, definition, decision_rule, display_order, colour) VALUES
  ('thinking', 'Thinking',
   'How a person makes sense of information and problems — reasoning, analysis, judgement, conceptual and creative thinking.',
   'Tag here when the construct measures the quality of cognition applied to problems or information, independent of social context. Strategic capability is Thinking even when leaders use it.',
   1, '#7C6CF0'),
  ('executing', 'Executing',
   'How a person turns intent into delivered results — planning, organisation, process, prioritisation, drive to results.',
   'Tag here when the construct is about delivery, organisation, follow-through, and achieving outcomes through one''s own work.',
   2, '#2DD4BF'),
  ('relating', 'Relating',
   'How a person engages and works through other people — communication, influence, collaboration, interpersonal sensitivity.',
   'Tag here when expressing the construct fundamentally requires other people — but is not about moving a group (that is Leading).',
   3, '#38BDF8'),
  ('adapting', 'Adapting',
   'How a person manages and develops themselves — resilience, emotional regulation, self-insight, learning agility, flexibility, drive.',
   'Tag here when the construct is intrapersonal: about the person''s relationship with themselves, their emotions, and their own growth.',
   4, '#FBBF24'),
  ('leading', 'Leading',
   'How a person takes a group somewhere — directing, deciding, setting direction, developing others, leading change.',
   'Tag here when the construct is the enacted leadership behaviour of moving a group, vs the underlying capacity (which may be Thinking or Relating). Setting strategic direction that aligns others is Leading; strategic thinking as a cognitive skill is Thinking.',
   5, '#FB7185')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS primary_category_id   UUID REFERENCES library_categories(id),
  ADD COLUMN IF NOT EXISTS secondary_category_id UUID REFERENCES library_categories(id);

COMMENT ON COLUMN factors.primary_category_id IS
  'The factor''s primary high-level category. Drives coverage and the whole-person frame.';
COMMENT ON COLUMN factors.secondary_category_id IS
  'Optional secondary category for genuine cross-category factors (display-only in coverage maths for v1).';

CREATE INDEX IF NOT EXISTS idx_factors_primary_category   ON factors(primary_category_id);
CREATE INDEX IF NOT EXISTS idx_factors_secondary_category ON factors(secondary_category_id);
