/**
 * Psychometric soundness assessment for measurement models.
 *
 * Evaluates a model's construct definitions, exclusions, overlap, and reliability
 * feasibility BEFORE any items exist. Intended for advisory early feedback during
 * the STRUCTURE and QUALITY stages, never as a gate.
 *
 * Implements Clark & Watson (1995) construct validity principles and
 * reliability forecasting from the reliability module.
 *
 * @module
 */

import { forecastAlpha, requiredItemCount } from './reliability'

export type SoundnessSeverity = 'ok' | 'advisory' | 'warning' | 'critical'

/**
 * A single finding from the soundness assessment.
 */
export interface SoundnessFinding {
  code: string
  severity: SoundnessSeverity
  title: string
  detail: string
  constructNames: string[]
  guidance: string
}

/**
 * The complete soundness report for a model.
 */
export interface SoundnessReport {
  findings: SoundnessFinding[]
  score: number
  band: 'sound' | 'needs-work' | 'unsound'
  checkedAt: string | null
  summary: string
}

/**
 * Input to the soundness assessment function.
 * Caller supplies constructs, pairwise similarities, blueprints, and library overlaps.
 */
export interface SoundnessInput {
  constructs: Array<{ name: string; definition: string; exclusions: string[] }>
  similarityPairs?: Array<{ constructAName: string; constructBName: string; cosineSimilarity: number }>
  blueprints?: Array<{ constructName: string; facetCount: number; totalTargetItems: number; targetAlpha: number | null }>
  libraryOverlaps?: Array<{ constructName: string; libraryConstructName: string; similarity: number }>
}

// ---------------------------------------------------------------------------
// Check Functions (each yields zero or more findings)
// ---------------------------------------------------------------------------

/**
 * Check for missing or too-short construct definitions.
 * Under 15 words -> warning; 15-39 words -> advisory; 40+ -> ok.
 */
function checkDefinitions(constructs: SoundnessInput['constructs']): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  for (const construct of constructs) {
    const trimmed = construct.definition.trim()
    if (!trimmed) {
      findings.push({
        code: 'definition-missing',
        severity: 'warning',
        title: 'Missing definition',
        detail: `"${construct.name}" has no definition. Clark & Watson require a clear, behavioural definition.`,
        constructNames: [construct.name],
        guidance: 'Add a 40+ word behavioural definition that states what this construct measures.'
      })
      continue
    }

    const words = trimmed.split(/\s+/).filter((w) => w.length > 0)
    const wordCount = words.length

    if (wordCount < 15) {
      findings.push({
        code: 'definition-too-short',
        severity: 'warning',
        title: 'Definition too brief',
        detail: `"${construct.name}" definition is only ${wordCount} words. Behavioral specificity is at risk.`,
        constructNames: [construct.name],
        guidance: 'Expand to at least 15 words, ideally 40+, to clarify what behaviour(s) you are measuring.'
      })
    } else if (wordCount < 40) {
      findings.push({
        code: 'definition-too-short',
        severity: 'advisory',
        title: 'Definition could be more specific',
        detail: `"${construct.name}" definition is ${wordCount} words. Consider more detail for clarity.`,
        constructNames: [construct.name],
        guidance: 'Expand toward 40–100 words to add behavioural specificity and prevent scope creep.'
      })
    }
  }

  return findings
}

/**
 * Check for circular or self-referential definitions.
 * Conservative: name tokens dominate opening clause, or definition begins with 'The ability to be <name>'.
 */
function checkCircularDefinitions(constructs: SoundnessInput['constructs']): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  for (const construct of constructs) {
    const name = construct.name.toLowerCase()
    const nameParts = name.split(/\s+/).filter((w) => w.length > 0)
    const def = construct.definition.toLowerCase()

    // Check for "The ability to be <name>" or "The capacity to be <name>" patterns
    const patterns = [
      `the ability to be ${name}`,
      `the capacity to be ${name}`,
      `the ability to ${name}`,
      `the capacity to ${name}`,
    ]
    for (const pattern of patterns) {
      if (def.includes(pattern)) {
        findings.push({
          code: 'definition-circular',
          severity: 'warning',
          title: 'Circular or tautological definition',
          detail: `"${construct.name}" definition appears to restate the name rather than define the construct.`,
          constructNames: [construct.name],
          guidance: 'Rewrite to describe observable behaviour or measurable attributes, not the construct name itself.'
        })
        continue
      }
    }

    // Check if name tokens dominate the opening clause (first 50 chars / first sentence)
    const firstClauseMatch = def.match(/^([^.!?:]+)/)
    if (firstClauseMatch) {
      const firstClause = firstClauseMatch[1].split(/\s+/).filter((w) => w.length > 0)
      let matchCount = 0
      for (const part of nameParts) {
        if (firstClause.some((word) => word.includes(part) || part.includes(word))) {
          matchCount++
        }
      }
      const density = nameParts.length > 0 ? matchCount / nameParts.length : 0
      if (density >= 0.66) {
        findings.push({
          code: 'definition-circular',
          severity: 'advisory',
          title: 'Definition may be circular',
          detail: `"${construct.name}" definition relies heavily on the construct name in its opening. Check for circularity.`,
          constructNames: [construct.name],
          guidance: 'Review whether the definition adds new meaning or just restates the name.'
        })
      }
    }
  }

  return findings
}

/**
 * Check for missing exclusions (most common cause of construct drift).
 */
function checkExclusions(constructs: SoundnessInput['constructs']): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  for (const construct of constructs) {
    if (!construct.exclusions || construct.exclusions.length === 0) {
      findings.push({
        code: 'exclusions-missing',
        severity: 'advisory',
        title: 'No exclusions listed',
        detail: `"${construct.name}" has no exclusions. This is the most common cause of construct drift.`,
        constructNames: [construct.name],
        guidance: 'Add explicit exclusions: what this construct does NOT measure, and what belongs to adjacent territory.'
      })
    }
  }

  return findings
}

/**
 * Check for overlapping constructs via similarity pairs.
 */
function checkConstructOverlap(
  input: SoundnessInput
): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (!input.similarityPairs || input.similarityPairs.length === 0) {
    return findings
  }

  for (const pair of input.similarityPairs) {
    const sim = pair.cosineSimilarity

    if (sim >= 0.8) {
      findings.push({
        code: 'constructs-overlap',
        severity: 'critical',
        title: 'Constructs highly overlapped',
        detail: `"${pair.constructAName}" and "${pair.constructBName}" show high similarity (${sim.toFixed(3)}). Distinctness is at risk.`,
        constructNames: [pair.constructAName, pair.constructBName],
        guidance: 'Review definitions and exclusions. Consider merging, renaming, or clarifying boundaries.'
      })
    } else if (sim >= 0.7) {
      findings.push({
        code: 'constructs-overlap',
        severity: 'warning',
        title: 'Constructs moderately overlapped',
        detail: `"${pair.constructAName}" and "${pair.constructBName}" show moderate similarity (${sim.toFixed(3)}).`,
        constructNames: [pair.constructAName, pair.constructBName],
        guidance: 'Review whether these are truly distinct or if exclusions need strengthening.'
      })
    } else if (sim >= 0.6) {
      findings.push({
        code: 'constructs-overlap',
        severity: 'advisory',
        title: 'Constructs show some overlap',
        detail: `"${pair.constructAName}" and "${pair.constructBName}" share some content (${sim.toFixed(3)}).`,
        constructNames: [pair.constructAName, pair.constructBName],
        guidance: 'Monitor during item development; consider whether items can be written to pull the constructs apart.'
      })
    }
  }

  return findings
}

/**
 * Check for single-construct models (no discriminability evidence possible).
 */
function checkSingleConstruct(constructs: SoundnessInput['constructs']): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (constructs.length === 1) {
    findings.push({
      code: 'single-construct',
      severity: 'advisory',
      title: 'Single-construct model',
      detail: 'This model contains only one construct. Discriminability cannot be assessed.',
      constructNames: [],
      guidance: 'Ensure this is intentional. Single-construct instruments are narrower in scope; ensure it meets your measurement goal.'
    })
  }

  return findings
}

/**
 * Check for infeasible or marginal alpha targets.
 * Uses forecastAlpha to estimate whether the blueprint can achieve the target.
 */
function checkAlphaFeasibility(
  input: SoundnessInput
): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (!input.blueprints || input.blueprints.length === 0) {
    return findings
  }

  for (const blueprint of input.blueprints) {
    if (blueprint.targetAlpha === null) continue

    const forecast = forecastAlpha({
      itemCount: blueprint.totalTargetItems,
      facetCount: blueprint.facetCount,
    })

    // If forecast is NaN or invalid, skip
    if (!isFinite(forecast.predictedAlpha)) continue

    if (forecast.predictedAlpha < blueprint.targetAlpha) {
      // Find how many items would be needed
      // Use a reasonable assumed rBar from the forecast
      const rBar = forecast.meanInterItemR
      const requiredK = requiredItemCount(rBar, blueprint.targetAlpha)

      const itemsNeeded = isFinite(requiredK) ? requiredK : blueprint.totalTargetItems + 5

      findings.push({
        code: 'alpha-infeasible',
        severity: 'warning',
        title: 'Target alpha not achievable',
        detail: `"${blueprint.constructName}" with ${blueprint.totalTargetItems} items forecasts α ≈ ${forecast.predictedAlpha.toFixed(3)}, below target of ${blueprint.targetAlpha.toFixed(3)}.`,
        constructNames: [blueprint.constructName],
        guidance: `Increase to ~${itemsNeeded} items to reach the target, or lower the target. (Assumes mean inter-item r ≈ ${rBar.toFixed(3)}.)`
      })
    }
  }

  return findings
}

/**
 * Check for attenuation paradox (mean inter-item r > 0.50 for target alpha).
 */
function checkAlphaRedundancy(
  input: SoundnessInput
): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (!input.blueprints || input.blueprints.length === 0) {
    return findings
  }

  for (const blueprint of input.blueprints) {
    if (blueprint.targetAlpha === null) continue

    const forecast = forecastAlpha({
      itemCount: blueprint.totalTargetItems,
      facetCount: blueprint.facetCount,
    })

    if (!isFinite(forecast.predictedAlpha)) continue

    const rBar = forecast.meanInterItemR
    if (rBar > 0.5) {
      findings.push({
        code: 'alpha-redundant',
        severity: 'warning',
        title: 'High inter-item correlation (attenuation paradox)',
        detail: `"${blueprint.constructName}" forecasts mean r = ${rBar.toFixed(3)}, above the 0.50 threshold. Items may be near-paraphrases.`,
        constructNames: [blueprint.constructName],
        guidance: 'Items are likely redundant. Alpha will be inflated by lack of breadth. Revise items or broaden the construct definition.'
      })
    }
  }

  return findings
}

/**
 * Check for too-few items in a construct.
 */
function checkTooFewItems(
  input: SoundnessInput
): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (!input.blueprints || input.blueprints.length === 0) {
    return findings
  }

  for (const blueprint of input.blueprints) {
    if (blueprint.totalTargetItems < 4) {
      findings.push({
        code: 'too-few-items',
        severity: 'warning',
        title: 'Too few items',
        detail: `"${blueprint.constructName}" targets only ${blueprint.totalTargetItems} items. Reliability is unstable below 4 items.`,
        constructNames: [blueprint.constructName],
        guidance: 'Increase to at least 4 items; 6–8 is typical for reliable measurement.'
      })
    }
  }

  return findings
}

/**
 * Check for lopsided facet counts across constructs.
 */
function checkFacetLopsidedness(
  input: SoundnessInput
): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (!input.blueprints || input.blueprints.length < 2) {
    return findings
  }

  const facetCounts = input.blueprints.map((b) => b.facetCount)
  const minFacets = Math.min(...facetCounts)
  const maxFacets = Math.max(...facetCounts)

  if (maxFacets > 0 && minFacets > 0 && maxFacets / minFacets > 3) {
    // Find which constructs are lopsided
    for (const blueprint of input.blueprints) {
      if (blueprint.facetCount >= maxFacets) {
        const other = input.blueprints.find((b) => b.facetCount === minFacets)
        if (other) {
          findings.push({
            code: 'facet-lopsided',
            severity: 'advisory',
            title: 'Facet counts uneven',
            detail: `"${blueprint.constructName}" has ${blueprint.facetCount} facets vs. "${other.constructName}" with ${other.facetCount}. Ratio is ${(blueprint.facetCount / other.facetCount).toFixed(1)}:1.`,
            constructNames: [blueprint.constructName, other.constructName],
            guidance: 'Ensure facet distribution reflects your measurement model. Large imbalances suggest uneven construct treatment.'
          })
          break
        }
      }
    }
  }

  return findings
}

/**
 * Check for near-duplicates with library constructs.
 */
function checkLibraryDuplicates(
  input: SoundnessInput
): SoundnessFinding[] {
  const findings: SoundnessFinding[] = []

  if (!input.libraryOverlaps || input.libraryOverlaps.length === 0) {
    return findings
  }

  for (const overlap of input.libraryOverlaps) {
    if (overlap.similarity >= 0.8) {
      findings.push({
        code: 'library-duplicate',
        severity: 'warning',
        title: 'Near-duplicate of library construct',
        detail: `"${overlap.constructName}" is highly similar (${overlap.similarity.toFixed(3)}) to existing library construct "${overlap.libraryConstructName}".`,
        constructNames: [overlap.constructName],
        guidance: `Consider reusing "${overlap.libraryConstructName}" instead of creating a near-duplicate. If creating a variant is intentional, clarify the distinction.`
      })
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Main Assessment Function
// ---------------------------------------------------------------------------

/**
 * Assess the psychometric soundness of a measurement model.
 *
 * Runs all checks and produces a report with findings, a composite score (0–100),
 * a band classification, and a summary sentence.
 *
 * Scoring: start at 100; subtract per finding (critical −25, warning −10, advisory −3), floor at 0.
 * Bands: >= 80 'sound', 50–79 'needs-work', < 50 'unsound'.
 *
 * @param input SoundnessInput describing the model
 * @returns SoundnessReport with findings, score, band, and summary
 */
export function assessModelSoundness(input: SoundnessInput): SoundnessReport {
  const findings: SoundnessFinding[] = []

  // Handle empty input gracefully
  if (!input.constructs || input.constructs.length === 0) {
    return {
      findings: [
        {
          code: 'no-constructs',
          severity: 'advisory',
          title: 'No constructs to assess',
          detail: 'The model has no constructs yet.',
          constructNames: [],
          guidance: 'Proceed to the STRUCTURE step to define your construct set.'
        }
      ],
      score: 100,
      band: 'sound',
      checkedAt: null,
      summary: 'No constructs defined yet; nothing to assess.'
    }
  }

  // Run all checks
  findings.push(...checkDefinitions(input.constructs))
  findings.push(...checkCircularDefinitions(input.constructs))
  findings.push(...checkExclusions(input.constructs))
  findings.push(...checkConstructOverlap(input))
  findings.push(...checkSingleConstruct(input.constructs))
  findings.push(...checkAlphaFeasibility(input))
  findings.push(...checkAlphaRedundancy(input))
  findings.push(...checkTooFewItems(input))
  findings.push(...checkFacetLopsidedness(input))
  findings.push(...checkLibraryDuplicates(input))

  // Compute score
  let score = 100
  for (const finding of findings) {
    if (finding.severity === 'critical') {
      score -= 25
    } else if (finding.severity === 'warning') {
      score -= 10
    } else if (finding.severity === 'advisory') {
      score -= 3
    }
  }
  score = Math.max(0, score)

  // Determine band
  let band: 'sound' | 'needs-work' | 'unsound'
  if (score >= 80) {
    band = 'sound'
  } else if (score >= 50) {
    band = 'needs-work'
  } else {
    band = 'unsound'
  }

  // Generate summary
  let summary: string
  if (findings.length === 0) {
    summary = 'Model appears sound: no issues detected.'
  } else {
    const criticalCount = findings.filter((f) => f.severity === 'critical').length
    const warningCount = findings.filter((f) => f.severity === 'warning').length
    const advisoryCount = findings.filter((f) => f.severity === 'advisory').length

    // Each part pluralises on its own count. A single trailing "issue(s)" cannot:
    // it rendered "Found 4 warning, 3 advisory issue." — wrong at both ends.
    const plural = (n: number, singular: string, pluralForm: string) =>
      `${n} ${n === 1 ? singular : pluralForm}`

    const parts: string[] = []
    if (criticalCount > 0) parts.push(plural(criticalCount, 'critical issue', 'critical issues'))
    if (warningCount > 0) parts.push(plural(warningCount, 'warning', 'warnings'))
    if (advisoryCount > 0) parts.push(plural(advisoryCount, 'advisory note', 'advisory notes'))

    const listed =
      parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]

    summary = `Found ${listed}.`
  }

  return {
    findings,
    score,
    band,
    checkedAt: null,
    summary
  }
}
