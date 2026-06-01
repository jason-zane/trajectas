-- =============================================================================
-- Backfill the 25 live factors with high-level categories
--
-- Primary (+ optional secondary) category per factor, per the worked mapping in
-- the design spec (2026-06-02). Matches by slug → category key, so no hardcoded
-- UUIDs. Idempotent.
-- =============================================================================

-- Primary categories
UPDATE factors f SET primary_category_id = c.id
FROM library_categories c,
  (VALUES
    ('achievement-drive',        'adapting'),
    ('analytical-thinking',      'thinking'),
    ('building-relationships',   'relating'),
    ('collaboration',            'relating'),
    ('commercial-acumen',        'thinking'),
    ('communication',            'relating'),
    ('critical-analysis-2',      'thinking'),
    ('decision-prioritisation',  'executing'),
    ('decisive-leadership',      'leading'),
    ('emotional-regulation',     'adapting'),
    ('execution',                'executing'),
    ('flexibility-2',            'adapting'),
    ('influence-2',              'relating'),
    ('ingenuity',                'thinking'),
    ('interpersonal-sensitivity','relating'),
    ('judgement',                'thinking'),
    ('learning-agility',         'adapting'),
    ('organisation-2',           'executing'),
    ('people-development',       'leading'),
    ('performance-tenacity',     'executing'),
    ('process-discipline',       'executing'),
    ('resilience-2',             'adapting'),
    ('self-insight',             'adapting'),
    ('strategic-vision',         'thinking'),
    ('visible-self-development', 'adapting')
  ) AS m(slug, cat_key)
WHERE f.slug = m.slug AND c.key = m.cat_key;

-- Secondary categories (genuine cross-category factors)
UPDATE factors f SET secondary_category_id = c.id
FROM library_categories c,
  (VALUES
    ('achievement-drive',       'executing'),
    ('decision-prioritisation', 'thinking'),
    ('influence-2',             'leading'),
    ('learning-agility',        'thinking'),
    ('performance-tenacity',    'adapting'),
    ('strategic-vision',        'leading')
  ) AS m(slug, cat_key)
WHERE f.slug = m.slug AND c.key = m.cat_key;
