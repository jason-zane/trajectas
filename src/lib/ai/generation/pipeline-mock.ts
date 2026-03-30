/**
 * Mock generation pipeline.
 *
 * Simulates all 7 AI-GENIE pipeline steps with deterministic (seeded) random
 * data. Used in place of real model calls until the full pipeline is wired up.
 * Results are reproducible given the same inputs.
 */

import type { GenerationRunConfig } from '@/types/database'
import type { ConstructForGeneration } from '@/types/generation'

// ---------------------------------------------------------------------------
// Mock item stem pools
// ---------------------------------------------------------------------------

const MOCK_STEMS_POSITIVE = [
  'I approach new challenges with enthusiasm and confidence.',
  'I remain calm and focused when facing difficult situations.',
  'I take initiative to solve problems before they escalate.',
  'I actively seek feedback to improve my performance.',
  'I collaborate effectively with others to achieve shared goals.',
  'I adapt quickly to changing circumstances and new information.',
  'I communicate my ideas clearly and persuasively.',
  'I take responsibility for my mistakes and learn from them.',
  'I set ambitious goals and work persistently to achieve them.',
  'I help others develop their skills and capabilities.',
  'I think carefully before making important decisions.',
  'I maintain high standards even under time pressure.',
  'I build strong relationships with colleagues and stakeholders.',
  'I bring creative solutions to complex problems.',
  'I manage my time and priorities effectively.',
  'I stay motivated even when tasks are repetitive or demanding.',
  'I lead by example and inspire others to do their best.',
  'I seek out opportunities to learn and grow professionally.',
  'I handle criticism constructively and without defensiveness.',
  'I persevere through setbacks and maintain a positive outlook.',
]

const MOCK_STEMS_NEGATIVE = [
  'I struggle to maintain focus when tasks become routine.',
  'I find it difficult to speak up in group settings.',
  'I often delay making decisions when the situation is uncertain.',
  'I tend to avoid confrontation even when it would be helpful.',
  'I find it hard to delegate tasks to others.',
  'I become stressed when multiple deadlines occur simultaneously.',
  'I am reluctant to change my approach once I have committed to it.',
  'I find it difficult to prioritise competing demands effectively.',
  'I am less comfortable when asked to lead new initiatives.',
  'I sometimes overlook details when working quickly.',
]

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface MockPipelineResult {
  itemsGenerated: number
  itemsAfterUva: number
  itemsAfterBoot: number
  nmiInitial: number
  nmiFinal: number
  modelUsed: string
  generatedItems: Array<{
    constructId: string
    stem: string
    reverseScored: boolean
    rationale: string
    wtoMax: number
    bootStability: number
    isRedundant: boolean
    isUnstable: boolean
    communityId: number
  }>
}

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

/** Returns a deterministic pseudo-random number generator seeded with `seed`. */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the mock pipeline synchronously and return the structured result.
 *
 * Results are deterministic: identical `config` and `constructs` inputs
 * always produce identical output.
 */
export function runMockPipeline(
  config: GenerationRunConfig,
  constructs: ConstructForGeneration[],
): MockPipelineResult {
  const rand = seededRandom(constructs.length * 7 + config.targetItemsPerConstruct)

  const allItems: MockPipelineResult['generatedItems'] = []

  constructs.forEach((construct, constructIndex) => {
    const target = config.targetItemsPerConstruct
    for (let i = 0; i < target; i++) {
      const isReverse = rand() < 0.4
      const stemPool = isReverse ? MOCK_STEMS_NEGATIVE : MOCK_STEMS_POSITIVE
      const stemBase = stemPool[i % stemPool.length]

      // Vary stems slightly for items beyond the first pool rotation
      const stem =
        i < stemPool.length
          ? stemBase
          : `${stemBase.replace(/\.$/, '')} — especially in ${construct.name.toLowerCase()} contexts.`

      const wtoMax = 0.05 + rand() * 0.3 // 0.05–0.35
      const bootStability = 0.6 + rand() * 0.39 // 0.60–0.99

      allItems.push({
        constructId: construct.id,
        stem,
        reverseScored: isReverse,
        rationale: `Generated to capture individual differences in ${construct.name}`,
        wtoMax,
        bootStability,
        isRedundant: wtoMax > 0.2,
        isUnstable: bootStability < 0.75,
        communityId: constructIndex + 1,
      })
    }
  })

  const total = allItems.length
  const afterUva = Math.floor(total * 0.75)
  const afterBoot = Math.floor(afterUva * 0.85)

  return {
    itemsGenerated: total,
    itemsAfterUva: afterUva,
    itemsAfterBoot: afterBoot,
    nmiInitial: 0.68 + rand() * 0.1,
    nmiFinal: 0.84 + rand() * 0.08,
    modelUsed: config.generationModel,
    generatedItems: allItems,
  }
}
