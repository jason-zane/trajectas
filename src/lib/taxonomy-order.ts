/**
 * Taxonomy display ordering — the one comparator every results surface uses to
 * put dimensions (and the factors under them) in the order the framework author
 * intended, rather than whatever fallback each surface happened to reach for.
 *
 * Before this existed, the 5Brains report was the only place the brains came
 * out red → orange → green → blue → pink; it hardcodes that sequence. Every
 * other surface invented its own tiebreak — score descending on the session
 * results panel and the consultant email, alphabetical in builder-driven
 * reports, raw Postgres row order on the comparison matrix — so the same five
 * brains appeared in four different orders depending on where you looked.
 *
 * The intended order lives in `dimensions.display_order` (and, for factors
 * within an assessment, `assessment_factors.display_order`, which the builder's
 * Composition canvas writes from drag position). Name is the tiebreak, so rows
 * that share the default 0 still sort deterministically instead of drifting
 * with the query plan.
 */

export interface DisplayOrdered {
  displayOrder?: number | null
  name?: string | null
}

/** Rows with no display_order sort as 0 — the column's own default. */
function order(entity: DisplayOrdered): number {
  return typeof entity.displayOrder === 'number' ? entity.displayOrder : 0
}

/**
 * Sort comparator: authored `display_order` ascending, then name, so ties are
 * stable rather than left to the database's row order.
 */
export function byDisplayOrder(a: DisplayOrdered, b: DisplayOrdered): number {
  const delta = order(a) - order(b)
  if (delta !== 0) return delta
  return (a.name ?? '').localeCompare(b.name ?? '')
}
