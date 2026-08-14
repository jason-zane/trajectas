/**
 * Reliability forecasting for instrument design (pre-empirical stage).
 *
 * Predicts Cronbach's alpha and related reliability metrics at design time,
 * before respondent data exists. Uses shrinkage estimation on synthetic
 * inter-item correlations and facet-count priors to provide realistic forecasts
 * with confidence intervals.
 *
 * Implements Clark & Watson (1995) coherence bands and Spearman-Brown prophecy.
 * All calculations are pure functions; no database or network access.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoherenceBand = 'incoherent' | 'broad' | 'optimal' | 'narrow' | 'redundant'

export interface ShrinkageConfig {
  /** Shrinkage factor for point estimate (default 0.60, range 0..1) */
  point: number
  /** Shrinkage factor for lower confidence bound (default 0.45) */
  low: number
  /** Shrinkage factor for upper confidence bound (default 0.75) */
  high: number
}

export interface AlphaForecastInput {
  /** Number of items in the instrument */
  itemCount: number
  /** Number of underlying facets or subscales (affects prior) */
  facetCount: number
  /** Optional: mean inter-item correlation from synthetic respondents (biased HIGH by variance collapse) */
  syntheticMeanInterItemR?: number
  /**
   * Shrinkage configuration; defaults to DEFAULT_SHRINKAGE.
   *
   * NOTE: within-construct embedding homogeneity was considered as a third
   * forecast input and deliberately rejected. Measured on this platform's own
   * production item pools, same-construct vs different-construct embedding
   * separation is only Cohen's d ~= 0.63-1.03 — too weak to carry a numeric
   * forecast. Cosine is retained elsewhere for near-duplicate detection
   * (> 0.85), where it is reliable. Do not reintroduce it here without
   * empirical justification.
   */
  shrinkage?: ShrinkageConfig
}

export interface AlphaForecast {
  /** Point estimate of Cronbach's alpha */
  predictedAlpha: number
  /** Confidence interval [low, high] for alpha */
  interval: [number, number]
  /** Point estimate of mean inter-item correlation */
  meanInterItemR: number
  /** Confidence interval [low, high] for rBar */
  meanInterItemRInterval: [number, number]
  /** Coherence band classification of the point estimate */
  coherence: CoherenceBand
  /** Source of the rBar estimate: 'synthetic' | 'facet_prior' */
  basis: 'synthetic' | 'facet_prior'
  /** Structured warnings; empty if all checks pass */
  warnings: Array<{ level: 'warn' | 'caution'; message: string }>
}

export interface CoherenceBandDefinition {
  /** Lower bound (inclusive) */
  lo: number
  /** Upper bound (exclusive, except for the topmost band) */
  hi: number
  /** Band name */
  band: CoherenceBand
  /** Interpretation */
  description: string
}

export interface DesignAdvice {
  /** Whether the target is achievable */
  achievable: boolean
  /** If achievable, items to add (negative if reduce) */
  itemsToAdd?: number
  /** Reasoning or caution */
  message: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default shrinkage factors: literature-informed priors, NOT fitted. */
export const DEFAULT_SHRINKAGE: ShrinkageConfig = {
  point: 0.60,
  low: 0.45,
  high: 0.75
}

/**
 * Clark & Watson (1995) coherence bands.
 * Describes healthy inter-item correlation ranges for construct validity.
 */
export const COHERENCE_BANDS: CoherenceBandDefinition[] = [
  {
    lo: 0,
    hi: 0.15,
    band: 'incoherent',
    description: 'Items do not cohere; construct too broad or items flawed'
  },
  {
    lo: 0.15,
    hi: 0.25,
    band: 'broad',
    description: 'Healthy for broad constructs; captures multiple facets'
  },
  {
    lo: 0.25,
    hi: 0.40,
    band: 'optimal',
    description: 'Optimal balance of coherence and construct breadth'
  },
  {
    lo: 0.40,
    hi: 0.50,
    band: 'narrow',
    description: 'Healthy only for genuinely narrow constructs; high item redundancy'
  },
  {
    lo: 0.50,
    hi: Infinity,
    band: 'redundant',
    description: 'Items are near-paraphrases; attenuation paradox (alpha inflated by redundancy)'
  }
]

/**
 * Facet-count prior for mean inter-item correlation.
 * Coarse heuristic based on literature; must be refit once real data exists.
 * Maps facetCount -> (rBarPoint, bandwidth).
 */
export const FACET_RBAR_PRIOR: Record<number, { point: number; bandwidth: number }> = {
  1: { point: 0.42, bandwidth: 0.07 },
  2: { point: 0.35, bandwidth: 0.07 },
  3: { point: 0.30, bandwidth: 0.07 },
  4: { point: 0.25, bandwidth: 0.07 },
  5: { point: 0.22, bandwidth: 0.07 }
}

// ---------------------------------------------------------------------------
// Reliability Forecasting
// ---------------------------------------------------------------------------

/**
 * Predict Cronbach's alpha from item count and mean inter-item correlation.
 * Formula: alpha = (k * rBar) / (1 + (k - 1) * rBar)
 * @returns Cronbach's alpha (0..1), clamped to avoid NaN
 */
export function alphaFromMeanInterItem(itemCount: number, meanInterItemR: number): number {
  if (!isFinite(itemCount) || !isFinite(meanInterItemR)) return NaN
  if (itemCount < 1 || meanInterItemR <= 0 || meanInterItemR >= 1) return NaN
  const numerator = itemCount * meanInterItemR
  const denominator = 1 + (itemCount - 1) * meanInterItemR
  if (denominator === 0) return NaN
  return numerator / denominator
}

/**
 * Invert alpha formula to find required mean inter-item correlation.
 * Given target alpha and item count, compute the rBar needed.
 * Formula: rBar = targetAlpha / (k - targetAlpha * (k - 1))
 * @returns Required rBar (0..1), or NaN if impossible
 */
export function requiredMeanInterItem(itemCount: number, targetAlpha: number): number {
  if (!isFinite(itemCount) || !isFinite(targetAlpha)) return NaN
  if (itemCount < 1 || targetAlpha <= 0 || targetAlpha >= 1) return NaN
  const denominator = itemCount - targetAlpha * (itemCount - 1)
  if (denominator <= 0) return NaN // Target alpha impossible
  const rBar = targetAlpha / denominator
  // Clamp to (0, 0.95) to stay in reasonable range
  if (rBar <= 0 || rBar >= 0.95) return NaN
  return rBar
}

/**
 * Compute required item count (float) to achieve target alpha at given rBar.
 * Formula: k = (targetAlpha * (1 - rBar)) / (rBar * (1 - targetAlpha))
 * @returns Required item count as a float; round up to get integer
 */
export function requiredItemCountFloat(meanInterItemR: number, targetAlpha: number): number {
  if (!isFinite(meanInterItemR) || !isFinite(targetAlpha)) return NaN
  if (meanInterItemR <= 0 || meanInterItemR >= 1) return NaN
  if (targetAlpha <= 0 || targetAlpha >= 1) return NaN
  const numerator = targetAlpha * (1 - meanInterItemR)
  const denominator = meanInterItemR * (1 - targetAlpha)
  if (denominator === 0 || denominator < 0) return NaN
  return numerator / denominator
}

/**
 * Compute required item count (rounded UP to integer).
 * @returns Required item count as integer, or NaN if impossible
 */
export function requiredItemCount(meanInterItemR: number, targetAlpha: number): number {
  const floatCount = requiredItemCountFloat(meanInterItemR, targetAlpha)
  if (!isFinite(floatCount)) return NaN
  return Math.ceil(floatCount)
}

/**
 * Apply Spearman-Brown prophecy formula to predict alpha after length change.
 * Used to forecast effect of adding/removing items (assumes homogeneous item quality).
 * Formula: alpha_new = (n * r) / (1 + (n - 1) * r), where n = lengthFactor
 * @param baseReliability Current reliability estimate (0..1)
 * @param lengthFactor Multiplier of current length (e.g., 1.5 = 50% more items)
 * @returns Predicted reliability after length change
 */
export function spearmanBrown(baseReliability: number, lengthFactor: number): number {
  if (!isFinite(baseReliability) || !isFinite(lengthFactor)) return NaN
  if (baseReliability <= 0 || baseReliability >= 1) return NaN
  if (lengthFactor <= 0) return NaN
  const numerator = lengthFactor * baseReliability
  const denominator = 1 + (lengthFactor - 1) * baseReliability
  if (denominator === 0) return NaN
  return numerator / denominator
}

/**
 * Classify mean inter-item correlation into coherence bands.
 * @returns CoherenceBand label
 */
export function classifyMeanInterItem(rBar: number): CoherenceBand {
  if (!isFinite(rBar)) return 'incoherent'
  for (const band of COHERENCE_BANDS) {
    if (rBar >= band.lo && (rBar < band.hi || band.hi === Infinity)) {
      return band.band
    }
  }
  return 'incoherent' // Fallback
}

/**
 * Retrieve coherence band definition by name.
 */
export function getBandDefinition(band: CoherenceBand): CoherenceBandDefinition | undefined {
  return COHERENCE_BANDS.find((b) => b.band === band)
}

/**
 * Forecast Cronbach's alpha at design time, with shrinkage and priors.
 *
 * Logic:
 * 1. Estimate rBar:
 *    - If syntheticMeanInterItemR: apply shrinkage to get point + interval
 *    - Else use facet-count prior with band
 * 2. Compute predictedAlpha and interval
 * 3. Emit warnings for incoherent, redundant, too-few-items, facet-prior basis
 *
 * @param input AlphaForecastInput
 * @returns AlphaForecast with point, interval, basis, and warnings
 */
export function forecastAlpha(input: AlphaForecastInput): AlphaForecast {
  const { itemCount } = input
  let facetCount = input.facetCount
  const { syntheticMeanInterItemR } = input
  const shrinkage = input.shrinkage ?? DEFAULT_SHRINKAGE

  const warnings: Array<{ level: 'warn' | 'caution'; message: string }> = []

  // Validate inputs
  if (!isFinite(itemCount) || itemCount < 2) {
    return {
      predictedAlpha: NaN,
      interval: [NaN, NaN],
      meanInterItemR: NaN,
      meanInterItemRInterval: [NaN, NaN],
      coherence: 'incoherent',
      basis: 'facet_prior',
      warnings: [{ level: 'warn', message: 'Invalid or too few items' }]
    }
  }

  if (!isFinite(facetCount) || facetCount < 1) facetCount = 1

  let rBarPoint: number
  let rBarLow: number
  let rBarHigh: number
  let basis: 'synthetic' | 'facet_prior'

  // Step 1: Estimate rBar
  if (syntheticMeanInterItemR !== undefined && isFinite(syntheticMeanInterItemR)) {
    // Use synthetic correlation with shrinkage
    basis = 'synthetic'
    rBarPoint = shrinkage.point * syntheticMeanInterItemR
    rBarLow = shrinkage.low * syntheticMeanInterItemR
    rBarHigh = shrinkage.high * syntheticMeanInterItemR
  } else {
    // Fall back to facet-count prior
    basis = 'facet_prior'
    const priorKey = Math.min(facetCount, 5) // Clamp to 5+ category
    const prior = FACET_RBAR_PRIOR[priorKey] ?? FACET_RBAR_PRIOR[5]
    rBarPoint = prior.point
    rBarLow = rBarPoint - prior.bandwidth / 2
    rBarHigh = rBarPoint + prior.bandwidth / 2
    warnings.push({
      level: 'caution',
      message: 'Using facet-count prior; forecast confidence is lower. Provide syntheticMeanInterItemR for better accuracy.'
    })
  }

  // Clamp rBar to (0, 0.95)
  rBarPoint = Math.max(0.01, Math.min(0.94, rBarPoint))
  rBarLow = Math.max(0.01, Math.min(0.94, rBarLow))
  rBarHigh = Math.max(0.01, Math.min(0.94, rBarHigh))

  // Step 2: Compute alpha
  const predictedAlpha = alphaFromMeanInterItem(itemCount, rBarPoint)
  const alphaLow = alphaFromMeanInterItem(itemCount, rBarLow)
  const alphaHigh = alphaFromMeanInterItem(itemCount, rBarHigh)

  // Step 3: Classify coherence and emit warnings
  const coherence = classifyMeanInterItem(rBarPoint)
  if (coherence === 'redundant') {
    warnings.push({
      level: 'warn',
      message: 'Mean inter-item correlation indicates redundancy (r > 0.50); items may be near-paraphrases. Alpha inflated by lack of construct breadth.'
    })
  } else if (coherence === 'incoherent') {
    warnings.push({
      level: 'warn',
      message: 'Mean inter-item correlation indicates incoherence (r < 0.15); items do not measure a unified construct.'
    })
  }

  if (itemCount < 4) {
    warnings.push({
      level: 'caution',
      message: 'Instrument has fewer than 4 items; alpha is unstable and not meaningful. Minimum recommended: 4 items.'
    })
  }

  return {
    predictedAlpha: isFinite(predictedAlpha) ? predictedAlpha : NaN,
    interval: [isFinite(alphaLow) ? alphaLow : NaN, isFinite(alphaHigh) ? alphaHigh : NaN],
    meanInterItemR: rBarPoint,
    meanInterItemRInterval: [rBarLow, rBarHigh],
    coherence,
    basis,
    warnings
  }
}

/**
 * Provide design advice for achieving a target reliability.
 *
 * Given current itemCount/facetCount and a target alpha, compute how many
 * items to add (or advise against an impossible target).
 *
 * @param input { itemCount, facetCount, targetAlpha, currentAlpha?, forceRBar? }
 * @returns DesignAdvice with achievability, item count adjustment, and rationale
 */
export interface DesignAdviceInput {
  itemCount: number
  facetCount: number
  targetAlpha: number
  currentAlpha?: number // Optional: if provided, use to infer current rBar
  forceRBar?: number // Optional: override rBar estimate
}

export function designAdvice(input: DesignAdviceInput): DesignAdvice {
  const { itemCount, facetCount, targetAlpha, currentAlpha, forceRBar } = input

  if (!isFinite(itemCount) || itemCount < 2) {
    return {
      achievable: false,
      message: 'Invalid item count'
    }
  }

  if (!isFinite(targetAlpha) || targetAlpha <= 0 || targetAlpha >= 1) {
    return {
      achievable: false,
      message: 'Invalid target alpha (must be 0 < alpha < 1)'
    }
  }

  // Estimate current rBar
  let rBar: number
  if (forceRBar !== undefined && isFinite(forceRBar)) {
    rBar = forceRBar
  } else if (currentAlpha !== undefined && isFinite(currentAlpha)) {
    // Invert: rBar = currentAlpha / (itemCount - currentAlpha * (itemCount - 1))
    const denom = itemCount - currentAlpha * (itemCount - 1)
    if (denom <= 0 || currentAlpha <= 0 || currentAlpha >= 1) {
      return {
        achievable: false,
        message: 'Cannot infer item correlation from current alpha'
      }
    }
    rBar = currentAlpha / denom
  } else {
    // Use prior
    const priorKey = Math.min(facetCount, 5)
    const prior = FACET_RBAR_PRIOR[priorKey] ?? FACET_RBAR_PRIOR[5]
    rBar = prior.point
  }

  // Clamp rBar
  if (rBar <= 0 || rBar > 0.94) {
    return {
      achievable: false,
      message: `Item correlation out of range (${rBar.toFixed(3)}); cannot forecast reliably`
    }
  }

  // Warn if current rBar is already redundant
  if (rBar > 0.50) {
    return {
      achievable: false,
      message: `Current mean inter-item correlation (${rBar.toFixed(3)}) exceeds healthy threshold (0.50); items are redundant. Consider item revision or construct broadening.`
    }
  }

  // Compute required item count at the given rBar
  const requiredK = requiredItemCountFloat(rBar, targetAlpha)
  if (!isFinite(requiredK)) {
    return {
      achievable: false,
      message: 'Target alpha is impossible at current item correlation'
    }
  }

  const itemsToAdd = Math.ceil(requiredK) - itemCount

  if (itemsToAdd <= 0) {
    return {
      achievable: true,
      itemsToAdd: 0,
      message: `Target alpha (${targetAlpha.toFixed(3)}) is already achieved or exceeded with ${itemCount} items.`
    }
  }

  return {
    achievable: true,
    itemsToAdd,
    message: `Add ${itemsToAdd} item${itemsToAdd === 1 ? '' : 's'} to achieve alpha >= ${targetAlpha.toFixed(3)} (assuming mean inter-item r = ${rBar.toFixed(3)}).`
  }
}
