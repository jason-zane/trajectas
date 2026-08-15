-- The figural-matrix item bank needs a construct of its own.
--
-- It was initially hung off 'Analytical Thinking' (286a8eac-…), which is a
-- Likert SELF-REPORT construct already carrying 12 statement items ("Before
-- accepting a claim, I check the data behind it."). That conflates two
-- different kinds of measurement: typical behaviour that a respondent reports
-- about themselves, and maximal performance scored against a key. Anything
-- that aggregates by construct — CTT session scoring, factor rollups — would
-- have averaged 1–5 Likert responses together with 0/1 correctness.
--
-- Id continues the a2000000-… seed block from 00004_seed_library_data.sql so
-- it is stable across environments and the ingest can reference it directly.

INSERT INTO constructs (id, name, slug, description, definition, is_active)
VALUES (
  'a2000000-0000-0000-0000-000000000006',
  'Figural Matrix Reasoning',
  'figural-matrix-reasoning',
  'Non-verbal inductive reasoning, measured by 3x3 figural matrices with a single keyed answer.',
  'The ability to infer the rules governing a set of abstract figures and apply them to identify the missing element. Deliberately non-verbal and non-numerical, so performance does not depend on vocabulary, reading, or prior domain knowledge. This is a maximal-performance construct: it is scored against an answer key, not self-reported.',
  true
)
ON CONFLICT (id) DO NOTHING;
