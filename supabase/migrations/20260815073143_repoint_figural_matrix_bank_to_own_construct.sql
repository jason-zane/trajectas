-- Repair: move the figural-matrix bank off the Likert self-report construct.
--
-- The pilot bank was loaded against 'Analytical Thinking'
-- (286a8eac-88b0-4a61-90ca-123678a39e00), which measures self-reported
-- handling of numerical data on a 5-point Likert scale and already holds 12
-- statement items. The figural matrices are keyed, dichotomous, maximal
-- performance. Sharing a construct id would let a construct-level rollup
-- average the two together.
--
-- Scoped by item_families.kind = 'figural_matrix' so the self-report items
-- on that construct are untouched. A no-op in any environment that never
-- carried the mislabelled rows.

UPDATE item_families
   SET construct_id = 'a2000000-0000-0000-0000-000000000006'
 WHERE construct_id = '286a8eac-88b0-4a61-90ca-123678a39e00'
   AND kind = 'figural_matrix';

UPDATE items
   SET construct_id = 'a2000000-0000-0000-0000-000000000006'
 WHERE construct_id = '286a8eac-88b0-4a61-90ca-123678a39e00'
   AND family_id IN (
     SELECT id FROM item_families WHERE kind = 'figural_matrix'
   );
