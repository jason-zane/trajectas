/**
 * IRT (Item Response Theory) scoring module.
 *
 * Re-exports the public API for probability models, information
 * functions, and ability estimation procedures.
 *
 * @example
 * ```ts
 * import {
 *   probability2PL,
 *   itemInformation,
 *   estimateMLE,
 *   estimateEAP,
 * } from '@/lib/scoring/irt';
 * ```
 *
 * @module
 */

export {
  probability1PL,
  probability2PL,
  probability3PL,
  probability,
  itemInformation,
  testInformation,
  standardError,
} from './models';

export { estimateMLE, estimateEAP } from './estimation';
