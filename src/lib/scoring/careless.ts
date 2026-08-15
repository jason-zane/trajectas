/**
 * Careless responding detection indices (pure functions).
 *
 * These indices identify respondents who may have completed surveys inattentively.
 * All functions are pure (no I/O), return null when not computable, and handle
 * edge cases (small n, identical responses, etc.) explicitly.
 *
 * Four indices:
 * 1. LONG-STRING: longest run of identical consecutive responses
 * 2. EVEN-ODD CONSISTENCY: split scale, correlate half-scores within-person
 * 3. PSYCHOMETRIC ANTONYMS: reverse-keyed item agreement
 * 4. RESPONSE-TIME FLOOR: latency floor (only if timing data exists)
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LongStringResult {
  /** Maximum run length (number of consecutive identical values). */
  maxRunLength: number;
  /** Indices (0-based) of items in the longest run. */
  itemIndices: number[];
  /** Starting value of the longest run. */
  value: number;
}

export interface EvenOddConsistencyResult {
  /** Sum of even-indexed item responses. */
  evenTotal: number;
  /** Sum of odd-indexed item responses. */
  oddTotal: number;
  /** Pearson correlation between even and odd halves (adjusted for length). */
  correlation: number;
  /** Spearman-Brown corrected consistency estimate. */
  spearmanBrown: number;
}

export interface PsychometricAntonymPair {
  /** ID of the forward-scored item. */
  itemIdForward: string;
  /** ID of the reverse-scored item. */
  itemIdReverse: string;
  /**
   * Consistency after reverse-scoring (0–1). HIGH means the respondent answered
   * the forward and reverse items compatibly, which is what a CAREFUL
   * respondent does. LOW is the careless signal.
   */
  consistencyRate: number;
}

export interface PsychometricAntonymsResult {
  /** Number of reverse-scored item pairs identified. */
  pairsFound: number;
  /**
   * Mean consistency across pairs (0–1). LOW values indicate careless
   * responding: a straight-liner who answers 5 to both a forward and a
   * reverse-keyed item is contradicting themselves once the reverse item is
   * scored, so their consistency collapses.
   */
  meanConsistencyRate: number;
  /** Detailed results per pair. */
  pairs: PsychometricAntonymPair[];
}

export interface ResponseTimeFloorResult {
  /** Whether timing data was present. */
  hasTimingData: boolean;
  /** Median response time (milliseconds). */
  medianMs: number;
  /** Minimum response time (milliseconds). */
  minMs: number;
  /** Maximum response time (milliseconds). */
  maxMs: number;
  /** Whether a floor effect was detected (many responses < 1000ms). */
  floorDetected: boolean;
  /** Proportion of responses < 1000ms. */
  fastResponseProportion: number;
}

// ---------------------------------------------------------------------------
// Index 1: LONG-STRING
// ---------------------------------------------------------------------------

/**
 * Detect longest run of identical consecutive responses.
 *
 * Careless respondents often give the same response to many consecutive items
 * (e.g., all 5s, all 1s). This index returns the longest such run.
 *
 * Returns null if:
 * - Fewer than 3 items
 * - All responses are identical (trivial run)
 *
 * @param responses - Response values in item order (length = number of items).
 * @returns Longest run details, or null if not computable.
 */
export function detectLongString(responses: number[]): LongStringResult | null {
  if (responses.length < 3) {
    return null;
  }

  // If all responses are identical, the run is trivial
  const allSame = responses.every((v) => v === responses[0]);
  if (allSame) {
    return null;
  }

  let maxRunLength = 1;
  let maxRunStart = 0;
  let maxRunValue = responses[0];
  let currentRunLength = 1;
  let currentRunStart = 0;
  let currentRunValue = responses[0];

  for (let i = 1; i < responses.length; i++) {
    if (responses[i] === currentRunValue) {
      currentRunLength++;
    } else {
      if (currentRunLength > maxRunLength) {
        maxRunLength = currentRunLength;
        maxRunStart = currentRunStart;
        maxRunValue = currentRunValue;
      }
      currentRunValue = responses[i];
      currentRunStart = i;
      currentRunLength = 1;
    }
  }

  // Check the last run
  if (currentRunLength > maxRunLength) {
    maxRunLength = currentRunLength;
    maxRunStart = currentRunStart;
    maxRunValue = currentRunValue;
  }

  return {
    maxRunLength,
    itemIndices: Array.from({ length: maxRunLength }, (_, j) => maxRunStart + j),
    value: maxRunValue,
  };
}

// ---------------------------------------------------------------------------
// Index 2: EVEN-ODD CONSISTENCY
// ---------------------------------------------------------------------------

/**
 * Compute even-odd consistency within a respondent's answers.
 *
 * Splits items by index (even: 0, 2, 4, ...; odd: 1, 3, 5, ...)
 * and correlates half-scores. A careless respondent shows low or negative
 * correlation. Spearman-Brown corrects for the split-half length difference.
 *
 * Returns null if:
 * - Fewer than 4 items (need at least 2 per half)
 * - All responses identical
 * - Variance is zero in either half
 *
 * @param responses - Response values in item order.
 * @param maxValuesPerItem - Optional: max value per item (for normalized scores). If omitted, raw sums used.
 * @returns Consistency metrics, or null if not computable.
 */
export function detectEvenOddInconsistency(
  responses: number[],
  maxValuesPerItem?: number[]
): EvenOddConsistencyResult | null {
  if (responses.length < 4) {
    return null;
  }

  // Check if all responses are identical
  const allSame = responses.every((v) => v === responses[0]);
  if (allSame) {
    return null;
  }

  // Split by index
  const evenResponses: number[] = [];
  const oddResponses: number[] = [];
  const evenMaxes: number[] = [];
  const oddMaxes: number[] = [];

  for (let i = 0; i < responses.length; i++) {
    if (i % 2 === 0) {
      evenResponses.push(responses[i]);
      if (maxValuesPerItem) evenMaxes.push(maxValuesPerItem[i]);
    } else {
      oddResponses.push(responses[i]);
      if (maxValuesPerItem) oddMaxes.push(maxValuesPerItem[i]);
    }
  }

  // Compute totals
  const evenTotal = evenResponses.reduce((s, v) => s + v, 0);
  const oddTotal = oddResponses.reduce((s, v) => s + v, 0);

  // Normalize if max values provided
  let evenNormalized = evenResponses;
  let oddNormalized = oddResponses;
  if (maxValuesPerItem) {
    evenNormalized = evenResponses.map((v, i) => evenMaxes[i] > 0 ? v / evenMaxes[i] : 0);
    oddNormalized = oddResponses.map((v, i) => oddMaxes[i] > 0 ? v / oddMaxes[i] : 0);
  }

  // Compute Pearson r between the two halves
  const r = pearsonR(evenNormalized, oddNormalized);

  // Check for NaN (e.g., zero variance)
  if (!Number.isFinite(r)) {
    return null;
  }

  // Spearman-Brown split-half reliability: 2r / (1 + r)
  // If r is very negative, this can be undefined; cap at 0
  const spearmanBrown = r >= -1 ? (2 * r) / (1 + r) : 0;

  return {
    evenTotal,
    oddTotal,
    correlation: r,
    spearmanBrown: Math.max(0, spearmanBrown), // reliability cannot be negative
  };
}

// ---------------------------------------------------------------------------
// Index 3: PSYCHOMETRIC ANTONYMS
// ---------------------------------------------------------------------------

/**
 * Detect careless responding via reverse-scored item pairs.
 *
 * Within a construct, items may appear in both forward and reverse-scored versions
 * (e.g., "I am confident" forward, "I am uncertain" reverse). A careless respondent
 * agrees with both (gives same numerical answer), indicating they are not reading.
 *
 * This function identifies pairs of items with opposite reverse-scoring flags
 * and measures their agreement after appropriate reverse-scoring correction.
 *
 * Returns null if:
 * - Fewer than 2 items
 * - No reverse-scored items found
 * - No pairs can be formed
 *
 * @param responses - Response values indexed by item (length = number of items).
 * @param itemMetadata - Array of { itemId, reverseScored, maxValue } for each response index.
 * @returns Antonym pair details, or null if not computable.
 */
export function detectPsychometricAntonyms(
  responses: number[],
  itemMetadata: Array<{
    itemId: string;
    reverseScored: boolean;
    maxValue: number;
    /** Scale floor. Defaults to 0 only when genuinely absent. */
    minValue?: number;
  }>
): PsychometricAntonymsResult | null {
  if (responses.length < 2 || itemMetadata.length !== responses.length) {
    return null;
  }

  // Separate forward and reverse-scored items
  const forwardItems: Array<{ index: number; itemId: string; minValue: number; maxValue: number }> = [];
  const reverseItems: Array<{ index: number; itemId: string; minValue: number; maxValue: number }> = [];

  for (let i = 0; i < itemMetadata.length; i++) {
    if (itemMetadata[i].reverseScored) {
      reverseItems.push({
        index: i,
        itemId: itemMetadata[i].itemId,
        minValue: itemMetadata[i].minValue ?? 0,
        maxValue: itemMetadata[i].maxValue,
      });
    } else {
      forwardItems.push({
        index: i,
        itemId: itemMetadata[i].itemId,
        minValue: itemMetadata[i].minValue ?? 0,
        maxValue: itemMetadata[i].maxValue,
      });
    }
  }

  if (forwardItems.length === 0 || reverseItems.length === 0) {
    return null;
  }

  // Pair each forward item with each reverse item (in practice, this is 1:1, but we're robust to n:m)
  const pairs: PsychometricAntonymPair[] = [];

  for (const fwd of forwardItems) {
    for (const rev of reverseItems) {
      // Once the reverse-keyed item is scored in the same direction as the
      // forward item, a CONSISTENT respondent's two answers should land close
      // together. A straight-liner's do not: answering 5 to both "I am
      // organised" and "I leave things messy" reverses to 5 and 1 on a 1-5
      // scale, so their consistency collapses. Low consistency is the careless
      // signal, not high.
      const fwdValue = responses[fwd.index];
      const revValueRaw = responses[rev.index];

      // Reverse about the scale's own midpoint: min + max - raw. Using
      // (max - raw) is only correct for a scale whose floor is 0. These scales
      // are 1-5 and 1-6, where it pushes a top response off the bottom of the
      // scale and biases every pair.
      const revValueReversed = rev.minValue + rev.maxValue - revValueRaw;

      // Normalise each onto 0-1 using its own span, so items on different
      // scale widths are comparable.
      const fwdSpan = fwd.maxValue - fwd.minValue;
      const revSpan = rev.maxValue - rev.minValue;
      if (fwdSpan <= 0 || revSpan <= 0) continue;

      const fwdNorm = (fwdValue - fwd.minValue) / fwdSpan;
      const revNorm = (revValueReversed - rev.minValue) / revSpan;

      const diff = Math.abs(fwdNorm - revNorm);
      const consistencyRate = Math.max(0, 1 - diff);

      pairs.push({
        itemIdForward: fwd.itemId,
        itemIdReverse: rev.itemId,
        consistencyRate,
      });
    }
  }

  if (pairs.length === 0) {
    return null;
  }

  const meanConsistencyRate =
    pairs.reduce((s, p) => s + p.consistencyRate, 0) / pairs.length;

  return {
    pairsFound: pairs.length,
    meanConsistencyRate,
    pairs,
  };
}

// ---------------------------------------------------------------------------
// Index 4: RESPONSE-TIME FLOOR
// ---------------------------------------------------------------------------

/**
 * Detect response-time floor effect.
 *
 * Careless respondents often complete surveys very quickly, showing a floor
 * effect in response latency. This index returns timing statistics.
 *
 * Returns null if:
 * - No response timing data available (all times are null/undefined)
 * - Fewer than 3 items
 *
 * @param responses - Response objects with optional timing { value, responseTimeMs? }.
 * @returns Timing statistics, or null if not computable.
 */
export function detectResponseTimeFloor(
  responses: Array<{ value: number; responseTimeMs?: number }>
): ResponseTimeFloorResult | null {
  if (responses.length < 3) {
    return null;
  }

  const timings = responses
    .map((r) => r.responseTimeMs)
    .filter((t): t is number => t !== null && t !== undefined && t > 0);

  if (timings.length < 3) {
    return null; // Need at least 3 valid timing measurements
  }

  // Sort for median and percentiles
  timings.sort((a, b) => a - b);

  const medianMs = timings[Math.floor(timings.length / 2)];
  const minMs = timings[0];
  const maxMs = timings[timings.length - 1];

  // Floor effect: proportion responding < 1 second
  const fastCount = timings.filter((t) => t < 1000).length;
  const fastResponseProportion = fastCount / timings.length;

  // Flag if > 50% of responses are sub-1-second (indicates rushing)
  const floorDetected = fastResponseProportion > 0.5;

  return {
    hasTimingData: true,
    medianMs,
    minMs,
    maxMs,
    floorDetected,
    fastResponseProportion,
  };
}

// ---------------------------------------------------------------------------
// Utility: Pearson correlation
// ---------------------------------------------------------------------------

/**
 * Compute Pearson correlation coefficient between two vectors.
 *
 * Returns NaN if either vector has zero variance.
 *
 * @param x - First vector
 * @param y - Second vector (must be same length as x)
 * @returns Correlation coefficient (-1 to 1), or NaN if not computable
 */
export function pearsonR(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    return NaN;
  }

  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  if (sumX2 === 0 || sumY2 === 0) {
    return NaN; // Zero variance
  }

  return sumXY / Math.sqrt(sumX2 * sumY2);
}
