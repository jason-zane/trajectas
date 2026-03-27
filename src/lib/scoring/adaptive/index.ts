/**
 * Adaptive testing module.
 *
 * Re-exports the CAT engine and rule-based item selection utilities.
 *
 * @example
 * ```ts
 * import {
 *   CATEngine,
 *   calculateItemsPerFactor,
 *   selectItems,
 * } from '@/lib/scoring/adaptive'
 * ```
 *
 * @module
 */

export { CATEngine } from './cat-engine'
export {
  calculateItemsPerFactor,
  selectItems,
  parseFactorCountRule,
} from './rule-based'

export type { SelectionStrategy, FactorCountRule } from './rule-based'
