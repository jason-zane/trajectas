-- Option-level scoring keys.
--
-- score_value: the keyed score contribution when this option is chosen —
-- expert keying for SJT options, correct/incorrect for binary knowledge
-- items, scored categorical single-select. NULL means the option is not
-- keyed and the item continues to score by raw response_value.
--
-- exclude_from_scoring: options like "Don't know" / "Not applicable" whose
-- selection must drop the response from quantitative aggregates entirely
-- (reportable separately as a visibility metric) rather than score as 0.

alter table item_options
  add column score_value numeric,
  add column exclude_from_scoring boolean not null default false;

comment on column item_options.score_value is
  'Keyed score contribution when this option is selected; NULL = not keyed (item scores by raw response_value).';
comment on column item_options.exclude_from_scoring is
  'When true, selecting this option removes the response from quantitative scoring (e.g. "Don''t know").';
