/**
 * IRT ability estimation procedures.
 *
 * Two complementary methods are provided:
 *
 * 1. **Maximum Likelihood Estimation (MLE)** — finds the theta that
 *    maximises the likelihood of the observed response pattern.
 *    Uses Newton-Raphson iteration.  MLE is undefined when the
 *    response pattern is all-correct or all-incorrect (the likelihood
 *    is monotone), so a boundary check is included.
 *
 * 2. **Expected A Posteriori (EAP)** — a Bayesian estimator that
 *    computes the posterior mean of theta under a normal prior.
 *    Uses Gauss-Hermite quadrature for numerical integration.
 *    EAP is always defined and tends to "shrink" extreme estimates
 *    toward the prior mean.
 *
 * @module
 */

import type { IRTParameters, IRTResponse, IRTEstimate } from '@/types/scoring'
import { probability, itemInformation, testInformation } from './models'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum iterations for Newton-Raphson. */
const DEFAULT_MAX_ITERATIONS = 100

/** Convergence criterion — stop when |delta-theta| < this value. */
const DEFAULT_CONVERGENCE = 1e-6

/** Theta bounds to prevent divergence during MLE. */
const THETA_MIN = -6
const THETA_MAX = 6

/** Default number of Gauss-Hermite quadrature points for EAP. */
const DEFAULT_QUADRATURE_POINTS = 49

// ---------------------------------------------------------------------------
// MLE
// ---------------------------------------------------------------------------

/**
 * Estimate examinee ability via Maximum Likelihood Estimation (MLE).
 *
 * The log-likelihood for a set of dichotomous responses is:
 *
 * ```
 * l(theta) = sum [ u_i * ln P_i(theta) + (1 - u_i) * ln(1 - P_i(theta)) ]
 * ```
 *
 * Newton-Raphson iteratively refines theta using:
 *
 * ```
 * theta_{t+1} = theta_t - l'(theta_t) / l''(theta_t)
 * ```
 *
 * where l' is the first derivative (score function) and l'' is the
 * second derivative of the log-likelihood.
 *
 * **Boundary condition**: MLE does not exist when the examinee
 * answered all items correctly or all items incorrectly.  In this
 * case the function falls back to EAP estimation.
 *
 * @param responses  - Observed response pattern.
 * @param itemParams - Map from item ID to its IRT parameters.
 * @param options    - Optional tuning parameters.
 * @returns The ability estimate with standard error and confidence interval.
 */
export function estimateMLE(
  responses: IRTResponse[],
  itemParams: Map<string, IRTParameters>,
  options?: {
    /** Starting value for theta (default 0). */
    initialTheta?: number
    /** Maximum Newton-Raphson iterations (default 100). */
    maxIterations?: number
    /** Convergence tolerance (default 1e-6). */
    convergence?: number
  },
): IRTEstimate {
  const maxIter = options?.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const tol = options?.convergence ?? DEFAULT_CONVERGENCE

  // ---- Validate responses against the parameter map ----
  const validResponses = responses.filter((r) => itemParams.has(r.itemId))
  if (validResponses.length === 0) {
    throw new Error('No valid responses matched to item parameters.')
  }

  const allCorrect = validResponses.every((r) => r.responseValue === 1)
  const allIncorrect = validResponses.every((r) => r.responseValue === 0)

  if (allCorrect || allIncorrect) {
    // MLE is undefined for perfect / zero scores — fall back to EAP.
    return estimateEAP(responses, itemParams)
  }

  // ---- Newton-Raphson iteration ----
  let theta = options?.initialTheta ?? 0

  for (let i = 0; i < maxIter; i++) {
    let firstDerivative = 0
    let secondDerivative = 0

    for (const resp of validResponses) {
      const params = itemParams.get(resp.itemId)!
      const a = params.discrimination
      const c = params.guessing
      const p = probability(theta, params)
      const u = resp.responseValue

      // First derivative of the log-likelihood.
      //
      // For 1PL / 2PL (c = 0) this simplifies to a * (u - P).
      // For 3PL we use the general weight factor P* / P where
      // P* = (P - c) / (1 - c).
      if (c === 0) {
        firstDerivative += a * (u - p)
      } else {
        if (p > 1e-15) {
          const pStar = (p - c) / (1 - c)
          const w = pStar / p
          firstDerivative += a * w * (u - p)
        }
      }

      // Expected (Fisher) information for the second derivative.
      // Using the expected information approximation ensures numerical stability.
      secondDerivative -= itemInformation(theta, params)
    }

    // Prevent division by zero in degenerate cases.
    if (Math.abs(secondDerivative) < 1e-15) {
      break
    }

    const delta = firstDerivative / secondDerivative
    theta -= delta

    // Clamp theta to prevent divergence.
    theta = Math.max(THETA_MIN, Math.min(THETA_MAX, theta))

    if (Math.abs(delta) < tol) {
      break
    }
  }

  // ---- Standard error & confidence interval ----
  const items = validResponses
    .map((r) => itemParams.get(r.itemId)!)
    .filter(Boolean)
  const info = testInformation(theta, items)
  const se = info > 0 ? 1 / Math.sqrt(info) : Infinity

  return {
    theta,
    standardError: se,
    confidence: {
      lower: theta - 1.96 * se,
      upper: theta + 1.96 * se,
    },
  }
}

// ---------------------------------------------------------------------------
// EAP (Expected A Posteriori)
// ---------------------------------------------------------------------------

/**
 * Gauss-Hermite quadrature nodes and weights.
 *
 * We generate evenly-spaced points over a wide range and weight them
 * by the standard normal density.  This approach (rectangular quadrature
 * with Gaussian weights) is standard practice in IRT EAP estimation
 * (see Bock & Mislevy, 1982) and converges well for smooth likelihoods.
 *
 * @param n - Number of quadrature points (should be odd for symmetry).
 * @returns Arrays of nodes and weights.
 */
function gaussHermiteQuadrature(n: number): { nodes: number[]; weights: number[] } {
  const nodes: number[] = []
  const weights: number[] = []

  // Span +/-4 standard deviations (covers 99.99 % of a normal).
  const lo = -4
  const hi = 4
  const step = (hi - lo) / (n - 1)

  let weightSum = 0
  for (let i = 0; i < n; i++) {
    const x = lo + i * step
    nodes.push(x)
    // Standard normal density as quadrature weight.
    const w = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
    weights.push(w)
    weightSum += w
  }

  // Normalise weights so they sum to 1 (accounts for discretisation error).
  for (let i = 0; i < n; i++) {
    weights[i] /= weightSum
  }

  return { nodes, weights }
}

/**
 * Estimate examinee ability via Expected A Posteriori (EAP).
 *
 * EAP computes the posterior mean of theta:
 *
 * ```
 * theta_EAP = integral[ theta * L(theta|u) * g(theta) dtheta ]
 *           / integral[ L(theta|u) * g(theta) dtheta ]
 * ```
 *
 * where L is the likelihood, g is the normal prior density, and the
 * integrals are approximated via quadrature.
 *
 * The posterior standard deviation (PSD) serves as the standard error:
 *
 * ```
 * PSD = sqrt[ integral[ (theta - theta_EAP)^2 * L * g dtheta ]
 *           / integral[ L * g dtheta ] ]
 * ```
 *
 * EAP is always defined (even for perfect / zero scores) because the
 * prior regularises the posterior.
 *
 * @param responses       - Observed response pattern.
 * @param itemParams      - Map from item ID to its IRT parameters.
 * @param priorMean       - Mean of the normal prior (default 0).
 * @param priorSD         - Standard deviation of the normal prior (default 1).
 * @param quadraturePoints - Number of quadrature points (default 49).
 * @returns The ability estimate with standard error and confidence interval.
 */
export function estimateEAP(
  responses: IRTResponse[],
  itemParams: Map<string, IRTParameters>,
  priorMean: number = 0,
  priorSD: number = 1,
  quadraturePoints: number = DEFAULT_QUADRATURE_POINTS,
): IRTEstimate {
  const validResponses = responses.filter((r) => itemParams.has(r.itemId))
  if (validResponses.length === 0) {
    throw new Error('No valid responses matched to item parameters.')
  }

  const { nodes, weights } = gaussHermiteQuadrature(quadraturePoints)

  // Map standard-normal nodes to the prior distribution.
  const thetas = nodes.map((x) => priorMean + priorSD * x)

  // Compute the log-likelihood at each quadrature point.
  const logLikelihoods = thetas.map((theta) => {
    let ll = 0
    for (const resp of validResponses) {
      const params = itemParams.get(resp.itemId)!
      const p = probability(theta, params)
      // Clamp to avoid log(0).
      const pClamped = Math.max(1e-15, Math.min(1 - 1e-15, p))
      ll +=
        resp.responseValue === 1
          ? Math.log(pClamped)
          : Math.log(1 - pClamped)
    }
    return ll
  })

  // To avoid numerical overflow, subtract the maximum log-likelihood
  // before exponentiating (the constant cancels in the ratio).
  const maxLL = Math.max(...logLikelihoods)

  const posteriors = logLikelihoods.map((ll, i) => {
    return Math.exp(ll - maxLL) * weights[i]
  })

  const denominator = posteriors.reduce((s, v) => s + v, 0)

  // Posterior mean (EAP estimate).
  const thetaEAP =
    posteriors.reduce((s, w, i) => s + w * thetas[i], 0) / denominator

  // Posterior variance (for the standard error).
  const variance =
    posteriors.reduce(
      (s, w, i) => s + w * Math.pow(thetas[i] - thetaEAP, 2),
      0,
    ) / denominator

  const se = Math.sqrt(variance)

  return {
    theta: thetaEAP,
    standardError: se,
    confidence: {
      lower: thetaEAP - 1.96 * se,
      upper: thetaEAP + 1.96 * se,
    },
  }
}
