/**
 * CTT (Classical Test Theory) scoring module.
 *
 * Re-exports the public API for raw/weighted scoring, reliability
 * estimation, and standard error of measurement.
 *
 * @example
 * ```ts
 * import {
 *   calculateRawScore,
 *   calculateWeightedScore,
 *   calculateReliability,
 *   calculateStandardError,
 * } from '@/lib/scoring/ctt';
 * ```
 *
 * @module
 */

export {
  calculateRawScore,
  calculateWeightedScore,
  calculateReliability,
  calculateStandardError,
} from './scoring';

export type { CTTResponseItem, CTTWeightedResponseItem } from './scoring';
