# Next-Gen Pipeline Phase 3: Difficulty Targeting + Synthetic Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the two default-off pipeline stages — Difficulty Targeting (steers generation toward difficulty gaps using embedding distance) and Synthetic Validation (simulates respondent data to estimate factor structure before human testing).

**Architecture:** Two new modules. `difficulty-targeting.ts` computes item difficulty from embedding distance to construct centroid and generates prompt steering instructions. `synthetic-validation.ts` generates persona profiles, simulates Likert responses, and runs basic psychometric analyses (Cronbach's alpha, item-total correlations, EGA dimensionality check). Both integrate as conditional stages in the existing pipeline — difficulty targeting hooks into the batch loop (between batches), synthetic validation runs after bootEGA as a new post-pipeline stage.

**Tech Stack:** TypeScript, cosine similarity (existing), embeddings (existing), OpenRouter LLM API, EGA (existing)

**Spec:** `docs/superpowers/specs/2026-04-03-pipeline-enhancement-design.md` (Sections 2c, 2d)

---

### Task 1: Difficulty Targeting Module

**Files:**
- Create: `src/lib/ai/generation/difficulty-targeting.ts`
- Create: `tests/unit/difficulty-targeting.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/difficulty-targeting.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import {
  computeDifficultyEstimate,
  analyzeDifficultyDistribution,
  buildDifficultySteering,
} from "@/lib/ai/generation/difficulty-targeting"

describe("computeDifficultyEstimate", () => {
  it("returns 0 for items at the centroid", () => {
    const estimate = computeDifficultyEstimate([1, 0, 0], [1, 0, 0])
    expect(estimate).toBeCloseTo(0)
  })

  it("returns higher values for items further from centroid", () => {
    const close = computeDifficultyEstimate([0.9, 0.1, 0], [1, 0, 0])
    const far = computeDifficultyEstimate([0.3, 0.7, 0], [1, 0, 0])
    expect(far).toBeGreaterThan(close)
  })

  it("returns values between 0 and 1", () => {
    const estimate = computeDifficultyEstimate([0.5, 0.5, 0], [1, 0, 0])
    expect(estimate).toBeGreaterThanOrEqual(0)
    expect(estimate).toBeLessThanOrEqual(1)
  })
})

describe("analyzeDifficultyDistribution", () => {
  it("identifies skew toward easy items", () => {
    // All items near centroid (low difficulty)
    const estimates = [0.05, 0.1, 0.08, 0.12, 0.15, 0.07, 0.09, 0.11]
    const result = analyzeDifficultyDistribution(estimates)
    expect(result.skew).toBe("easy")
  })

  it("returns balanced when distribution is even", () => {
    const estimates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    const result = analyzeDifficultyDistribution(estimates)
    expect(result.skew).toBe("balanced")
  })

  it("returns counts per zone", () => {
    const estimates = [0.1, 0.2, 0.4, 0.5, 0.7, 0.8]
    const result = analyzeDifficultyDistribution(estimates)
    expect(result.easy).toBe(2)
    expect(result.moderate).toBe(2)
    expect(result.hard).toBe(2)
  })
})

describe("buildDifficultySteering", () => {
  it("returns steering text when skewed easy", () => {
    const text = buildDifficultySteering("easy")
    expect(text).toContain("easy-to-endorse")
    expect(text).toContain("trade-off framing")
  })

  it("returns steering text when skewed hard", () => {
    const text = buildDifficultySteering("hard")
    expect(text).toContain("broadly relatable")
  })

  it("returns empty string when balanced", () => {
    expect(buildDifficultySteering("balanced")).toBe("")
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/unit/difficulty-targeting.test.ts`

- [ ] **Step 3: Implement**

Create `src/lib/ai/generation/difficulty-targeting.ts`:

```typescript
/**
 * difficulty-targeting.ts
 *
 * Estimates item difficulty from embedding distance to construct centroid
 * and generates prompt steering instructions to fill difficulty gaps.
 *
 * Difficulty estimate is a semantic proxy (0 = near centroid = easy,
 * 1 = peripheral = hard). Not a calibrated IRT parameter.
 */

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Compute a 0-1 difficulty estimate from an item's embedding distance
 * to its construct centroid. 0 = at centroid (easy), 1 = maximally distant (hard).
 */
export function computeDifficultyEstimate(
  itemEmbedding: number[],
  constructCentroid: number[],
): number {
  const similarity = cosineSimilarity(itemEmbedding, constructCentroid)
  // Convert similarity (1 = identical, 0 = orthogonal) to difficulty (0 = easy, 1 = hard)
  return Math.max(0, Math.min(1, 1 - similarity))
}

/** Difficulty zone boundaries */
const EASY_THRESHOLD = 0.33
const HARD_THRESHOLD = 0.66

/** Target distribution: ~20% easy, ~50% moderate, ~30% hard */
const TARGET_EASY_PCT = 0.20
const TARGET_HARD_PCT = 0.30

export type DifficultySkew = 'easy' | 'hard' | 'balanced'

export interface DifficultyDistribution {
  easy: number
  moderate: number
  hard: number
  skew: DifficultySkew
}

/**
 * Analyze the difficulty distribution of accumulated items
 * and determine if the pool is skewed.
 */
export function analyzeDifficultyDistribution(
  estimates: number[],
): DifficultyDistribution {
  if (estimates.length === 0) {
    return { easy: 0, moderate: 0, hard: 0, skew: 'balanced' }
  }

  let easy = 0, moderate = 0, hard = 0
  for (const est of estimates) {
    if (est < EASY_THRESHOLD) easy++
    else if (est >= HARD_THRESHOLD) hard++
    else moderate++
  }

  const total = estimates.length
  const easyPct = easy / total
  const hardPct = hard / total

  // Skewed if one zone has significantly more than target
  let skew: DifficultySkew = 'balanced'
  if (easyPct > TARGET_EASY_PCT + 0.15 && hardPct < TARGET_HARD_PCT - 0.10) {
    skew = 'easy'
  } else if (hardPct > TARGET_HARD_PCT + 0.15 && easyPct < TARGET_EASY_PCT - 0.05) {
    skew = 'hard'
  }

  return { easy, moderate, hard, skew }
}

/**
 * Build a prompt steering instruction based on difficulty skew.
 * Returns empty string if distribution is balanced.
 */
export function buildDifficultySteering(skew: DifficultySkew): string {
  if (skew === 'easy') {
    return `\n## Difficulty Steering\nThe item pool is currently skewed toward easy-to-endorse items. For this batch, focus on items that only someone genuinely high on this construct would endorse. Use trade-off framing, friction situations, and conditional behaviours to create harder items.`
  }
  if (skew === 'hard') {
    return `\n## Difficulty Steering\nThe item pool is currently skewed toward hard-to-endorse items. For this batch, focus on broadly relatable behavioural expressions of the construct that most people with moderate standing would endorse.`
  }
  return ''
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/unit/difficulty-targeting.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/difficulty-targeting.ts tests/unit/difficulty-targeting.test.ts
git commit -m "feat(pipeline-tier2): add difficulty targeting module"
```

---

### Task 2: Synthetic Validation Module

**Files:**
- Create: `src/lib/ai/generation/synthetic-validation.ts`
- Create: `tests/unit/synthetic-validation.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/synthetic-validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import {
  generatePersonas,
  parseSyntheticResponses,
  computeCronbachAlpha,
  computeItemTotalCorrelations,
} from "@/lib/ai/generation/synthetic-validation"

describe("generatePersonas", () => {
  it("generates the requested number of personas", () => {
    const personas = generatePersonas(
      [{ id: "c1", name: "Resilience" }, { id: "c2", name: "Adaptability" }],
      10,
    )
    expect(personas).toHaveLength(10)
  })

  it("each persona has trait levels for all constructs", () => {
    const personas = generatePersonas(
      [{ id: "c1", name: "Resilience" }, { id: "c2", name: "Adaptability" }],
      5,
    )
    for (const persona of personas) {
      expect(persona.traitLevels).toHaveProperty("c1")
      expect(persona.traitLevels).toHaveProperty("c2")
      expect(["low", "moderate", "high"]).toContain(persona.traitLevels.c1)
    }
  })
})

describe("parseSyntheticResponses", () => {
  it("parses valid response array", () => {
    const result = parseSyntheticResponses(JSON.stringify([
      { itemIndex: 0, rating: 4 },
      { itemIndex: 1, rating: 2 },
    ]))
    expect(result).toHaveLength(2)
    expect(result![0]).toEqual({ itemIndex: 0, rating: 4 })
  })

  it("returns null for invalid JSON", () => {
    expect(parseSyntheticResponses("not json")).toBeNull()
  })

  it("filters ratings outside 1-5 range", () => {
    const result = parseSyntheticResponses(JSON.stringify([
      { itemIndex: 0, rating: 4 },
      { itemIndex: 1, rating: 7 },
      { itemIndex: 2, rating: 0 },
    ]))
    expect(result).toHaveLength(1)
  })
})

describe("computeCronbachAlpha", () => {
  it("returns high alpha for consistent responses", () => {
    // 5 respondents, 3 items — perfectly correlated
    const matrix = [
      [5, 5, 5],
      [4, 4, 4],
      [3, 3, 3],
      [2, 2, 2],
      [1, 1, 1],
    ]
    const alpha = computeCronbachAlpha(matrix)
    expect(alpha).toBeGreaterThan(0.9)
  })

  it("returns low alpha for random responses", () => {
    const matrix = [
      [5, 1, 3],
      [1, 5, 2],
      [3, 2, 5],
      [2, 4, 1],
      [4, 3, 4],
    ]
    const alpha = computeCronbachAlpha(matrix)
    expect(alpha).toBeLessThan(0.5)
  })

  it("returns 0 for single item", () => {
    const matrix = [[5], [4], [3]]
    expect(computeCronbachAlpha(matrix)).toBe(0)
  })
})

describe("computeItemTotalCorrelations", () => {
  it("returns correlation for each item", () => {
    const matrix = [
      [5, 5, 1],
      [4, 4, 2],
      [3, 3, 3],
      [2, 2, 4],
      [1, 1, 5],
    ]
    const correlations = computeItemTotalCorrelations(matrix)
    expect(correlations).toHaveLength(3)
    // Items 0 and 1 are positively correlated with total
    expect(correlations[0]).toBeGreaterThan(0.5)
    // Item 2 is negatively correlated
    expect(correlations[2]).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/unit/synthetic-validation.test.ts`

- [ ] **Step 3: Implement**

Create `src/lib/ai/generation/synthetic-validation.ts`:

```typescript
/**
 * synthetic-validation.ts
 *
 * Generates synthetic respondent personas, simulates Likert responses via LLM,
 * and runs basic psychometric analyses on the synthetic data.
 *
 * IMPORTANT: LLM-simulated data replicates group-level latent structures but
 * does NOT approximate individual-level response distributions. Results should
 * be presented as "estimated" — useful for flagging structural problems, not
 * for establishing exact reliability coefficients.
 */

import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import type { ScoredCandidateItem } from '@/types/generation'

// ---------------------------------------------------------------------------
// Persona generation
// ---------------------------------------------------------------------------

export interface SyntheticPersona {
  id: number
  description: string
  traitLevels: Record<string, 'low' | 'moderate' | 'high'>
}

interface ConstructInfo {
  id: string
  name: string
}

const ROLE_LEVELS = ['Junior professional', 'Mid-level professional', 'Senior professional', 'Executive leader']
const EXPERIENCE_YEARS = [2, 5, 10, 15, 20]
const TRAIT_LEVELS: Array<'low' | 'moderate' | 'high'> = ['low', 'moderate', 'high']

/**
 * Generate a set of synthetic respondent personas with varied demographics
 * and trait levels. Deterministic based on index for reproducibility.
 */
export function generatePersonas(
  constructs: ConstructInfo[],
  count: number,
): SyntheticPersona[] {
  const personas: SyntheticPersona[] = []

  for (let i = 0; i < count; i++) {
    const role = ROLE_LEVELS[i % ROLE_LEVELS.length]
    const experience = EXPERIENCE_YEARS[i % EXPERIENCE_YEARS.length]

    const traitLevels: Record<string, 'low' | 'moderate' | 'high'> = {}
    for (let j = 0; j < constructs.length; j++) {
      // Distribute trait levels across personas for variance
      traitLevels[constructs[j].id] = TRAIT_LEVELS[(i + j) % TRAIT_LEVELS.length]
    }

    const traitDesc = constructs
      .map((c) => `${traitLevels[c.id]} ${c.name}`)
      .join(', ')

    personas.push({
      id: i,
      description: `${role} with ${experience} years of experience. Trait profile: ${traitDesc}.`,
      traitLevels,
    })
  }

  return personas
}

// ---------------------------------------------------------------------------
// Response simulation
// ---------------------------------------------------------------------------

export interface SyntheticResponse {
  itemIndex: number
  rating: number
}

export function buildRespondentPrompt(
  persona: SyntheticPersona,
  items: Array<{ stem: string; reverseScored: boolean }>,
): string {
  const itemsList = items
    .map((item, i) => `${i}. "${item.stem}"${item.reverseScored ? ' (reverse-scored)' : ''}`)
    .join('\n')

  return `You are this person: ${persona.description}

Rate each item on a 1-5 scale (1=Strongly Disagree, 5=Strongly Agree) as this person would naturally respond.

Items:
${itemsList}

Return a JSON array: [{ "itemIndex": 0, "rating": 4 }, ...]`
}

export function parseSyntheticResponses(jsonContent: string): SyntheticResponse[] | null {
  try {
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    let parsed = JSON.parse(cleaned) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      const firstArray = Object.values(obj).find(Array.isArray)
      if (firstArray) parsed = firstArray
    }
    if (!Array.isArray(parsed)) return null

    return parsed.filter(
      (item): item is SyntheticResponse =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).itemIndex === 'number' &&
        typeof (item as Record<string, unknown>).rating === 'number' &&
        (item as Record<string, unknown>).rating as number >= 1 &&
        (item as Record<string, unknown>).rating as number <= 5,
    )
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Psychometric analyses
// ---------------------------------------------------------------------------

/**
 * Compute Cronbach's alpha from a response matrix (respondents × items).
 */
export function computeCronbachAlpha(matrix: number[][]): number {
  const n = matrix.length // respondents
  const k = matrix[0]?.length ?? 0 // items
  if (k <= 1 || n <= 1) return 0

  // Item variances
  const itemMeans = new Array(k).fill(0)
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < n; i++) {
      itemMeans[j] += matrix[i][j]
    }
    itemMeans[j] /= n
  }

  const itemVariances = new Array(k).fill(0)
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < n; i++) {
      itemVariances[j] += (matrix[i][j] - itemMeans[j]) ** 2
    }
    itemVariances[j] /= (n - 1)
  }

  // Total score variance
  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const totalMean = totalScores.reduce((a, b) => a + b, 0) / n
  const totalVariance = totalScores.reduce((sum, s) => sum + (s - totalMean) ** 2, 0) / (n - 1)

  if (totalVariance === 0) return 0

  const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0)

  return (k / (k - 1)) * (1 - sumItemVariances / totalVariance)
}

/**
 * Compute corrected item-total correlations (each item correlated with
 * the total score minus that item).
 */
export function computeItemTotalCorrelations(matrix: number[][]): number[] {
  const n = matrix.length
  const k = matrix[0]?.length ?? 0
  if (k <= 1 || n <= 1) return new Array(k).fill(0)

  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0))

  return Array.from({ length: k }, (_, j) => {
    const itemScores = matrix.map((row) => row[j])
    const restScores = totalScores.map((total, i) => total - matrix[i][j])

    // Pearson correlation between itemScores and restScores
    const meanItem = itemScores.reduce((a, b) => a + b, 0) / n
    const meanRest = restScores.reduce((a, b) => a + b, 0) / n

    let cov = 0, varItem = 0, varRest = 0
    for (let i = 0; i < n; i++) {
      const dItem = itemScores[i] - meanItem
      const dRest = restScores[i] - meanRest
      cov += dItem * dRest
      varItem += dItem * dItem
      varRest += dRest * dRest
    }

    if (varItem === 0 || varRest === 0) return 0
    return cov / (Math.sqrt(varItem) * Math.sqrt(varRest))
  })
}

// ---------------------------------------------------------------------------
// Full synthetic validation orchestrator
// ---------------------------------------------------------------------------

export interface SyntheticValidationResult {
  respondentsGenerated: number
  estimatedAlpha: Record<string, number>
  itemTotalCorrelations: Record<string, number[]>
  constructsAnalyzed: number
  warnings: string[]
}

/**
 * Run the full synthetic validation stage.
 * Generates personas, simulates responses, and runs psychometric analyses.
 */
export async function runSyntheticValidation(
  items: ScoredCandidateItem[],
  constructs: Array<{ id: string; name: string }>,
  respondentCount: number = 50,
  onProgress?: (message: string) => void,
): Promise<SyntheticValidationResult> {
  let syntheticModel: string
  let syntheticSystemPrompt: string
  try {
    const task = await getModelForTask('synthetic_respondent')
    const promptData = await getActiveSystemPrompt('synthetic_respondent')
    syntheticModel = task.modelId
    syntheticSystemPrompt = promptData.content
  } catch {
    return {
      respondentsGenerated: 0,
      estimatedAlpha: {},
      itemTotalCorrelations: {},
      constructsAnalyzed: 0,
      warnings: ['Synthetic respondent model/prompt not configured'],
    }
  }

  // Only validate kept items
  const keptItems = items.filter((i) => i.removalStage === 'kept')
  if (keptItems.length < 3) {
    return {
      respondentsGenerated: 0,
      estimatedAlpha: {},
      itemTotalCorrelations: {},
      constructsAnalyzed: 0,
      warnings: ['Too few items for synthetic validation (need at least 3)'],
    }
  }

  // Generate personas
  const personas = generatePersonas(constructs, respondentCount)
  onProgress?.(`Generated ${personas.length} synthetic personas`)

  // Simulate responses
  const responseMatrix: number[][] = []
  const itemStems = keptItems.map((i) => ({ stem: i.stem, reverseScored: i.reverseScored }))

  for (const persona of personas) {
    try {
      const prompt = buildRespondentPrompt(persona, itemStems)
      const response = await openRouterProvider.complete({
        model: syntheticModel,
        systemPrompt: syntheticSystemPrompt,
        prompt,
        temperature: 0.7,
        maxTokens: 4096,
        responseFormat: 'json',
      })

      const ratings = parseSyntheticResponses(response.content)
      if (ratings && ratings.length > 0) {
        // Build row in item order
        const row = new Array(keptItems.length).fill(3) // default to neutral
        for (const r of ratings) {
          if (r.itemIndex >= 0 && r.itemIndex < keptItems.length) {
            row[r.itemIndex] = r.rating
          }
        }
        responseMatrix.push(row)
      }
    } catch {
      // Skip failed persona — don't abort the whole validation
    }

    if (responseMatrix.length % 10 === 0) {
      onProgress?.(`Simulated ${responseMatrix.length}/${personas.length} respondents`)
    }
  }

  if (responseMatrix.length < 10) {
    return {
      respondentsGenerated: responseMatrix.length,
      estimatedAlpha: {},
      itemTotalCorrelations: {},
      constructsAnalyzed: 0,
      warnings: [`Only ${responseMatrix.length} respondents completed — too few for reliable analysis`],
    }
  }

  // Per-construct analyses
  const estimatedAlpha: Record<string, number> = {}
  const itemTotalCorrelations: Record<string, number[]> = {}
  const warnings: string[] = []

  for (const construct of constructs) {
    const constructItemIndices = keptItems
      .map((item, idx) => ({ idx, constructId: item.constructId }))
      .filter((x) => x.constructId === construct.id)
      .map((x) => x.idx)

    if (constructItemIndices.length < 2) {
      warnings.push(`${construct.name}: too few items for alpha calculation`)
      continue
    }

    // Extract sub-matrix for this construct
    const subMatrix = responseMatrix.map((row) =>
      constructItemIndices.map((idx) => row[idx])
    )

    const alpha = computeCronbachAlpha(subMatrix)
    estimatedAlpha[construct.id] = alpha

    if (alpha < 0.7) {
      warnings.push(`${construct.name}: estimated alpha ${alpha.toFixed(2)} is below 0.70 threshold`)
    }

    const itc = computeItemTotalCorrelations(subMatrix)
    itemTotalCorrelations[construct.id] = itc

    // Flag items with low item-total correlation
    itc.forEach((corr, i) => {
      if (corr < 0.3) {
        const itemStem = keptItems[constructItemIndices[i]]?.stem ?? 'unknown'
        warnings.push(`${construct.name}: item "${itemStem.slice(0, 40)}..." has low item-total correlation (${corr.toFixed(2)})`)
      }
    })
  }

  // Dimensionality check via EGA on synthetic correlation matrix is deferred
  // to a future phase — requires building a synthetic correlation matrix and
  // feeding it through the existing EGA infrastructure. For now, we track
  // how many constructs were successfully analyzed.
  const constructsAnalyzed = Object.keys(estimatedAlpha).length

  onProgress?.(`Synthetic validation complete: ${responseMatrix.length} respondents, ${Object.keys(estimatedAlpha).length} constructs analyzed`)

  return {
    respondentsGenerated: responseMatrix.length,
    estimatedAlpha,
    itemTotalCorrelations,
    constructsAnalyzed,
    warnings,
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/unit/synthetic-validation.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/synthetic-validation.ts tests/unit/synthetic-validation.test.ts
git commit -m "feat(pipeline-tier2): add synthetic validation module with persona generation and psychometric analyses"
```

---

### Task 3: Integrate Difficulty Targeting into Pipeline

**Files:**
- Modify: `src/lib/ai/generation/pipeline.ts`
- Modify: `src/lib/ai/generation/prompts/item-generation.ts`

- [ ] **Step 1: Add `difficultySteering` param to item generation prompt**

In `src/lib/ai/generation/prompts/item-generation.ts`, add `difficultySteering?: string` to the params type:

```typescript
export function buildItemGenerationPrompt(params: {
  construct:        ConstructForGeneration
  batchSize:        number
  responseFormatDescription: string
  previousItems:    string[]
  previousFacets?:  string[]
  difficultySteering?: string
  contrastConstructs?: Array<Pick<ConstructForGeneration, "name" | "definition" | "description">>
}): string {
```

Destructure it:
```typescript
  const {
    construct,
    batchSize,
    responseFormatDescription,
    previousItems,
    previousFacets = [],
    difficultySteering = '',
    contrastConstructs = [],
  } = params
```

Insert `${difficultySteering}` into the template string after `${facetCoverageSection}` and before the `## Per-Item Metadata` section.

- [ ] **Step 2: Add difficulty targeting imports and setup to pipeline**

In `src/lib/ai/generation/pipeline.ts`, add imports:

```typescript
import {
  computeDifficultyEstimate,
  analyzeDifficultyDistribution,
  buildDifficultySteering,
} from './difficulty-targeting'
```

After the leakage guard setup (after `stemEmbeddingCache` declaration), add:

```typescript
  // Tier 2: Difficulty Targeting
  const difficultyEnabled = config.enableDifficultyTargeting === true
  const difficultyEstimates = new Map<number, number>()
```

- [ ] **Step 3: Compute difficulty estimates after leakage guard**

In the batch loop, after the leakage guard block and before the dedup loop, add difficulty computation. Find the line `let leakagePassedItems = critiquedItems` and after the entire leakage block (the closing `}` of `if (leakageEnabled ...)`), add:

```typescript
        // Tier 2: Difficulty Targeting — compute estimates for surviving items
        if (difficultyEnabled && leakagePassedItems.length > 0) {
          const centroid = centroidCache.getCentroid(construct.id)
          if (centroid) {
            for (const item of leakagePassedItems) {
              const embedding = stemEmbeddingCache.get(item.stem)
              if (embedding) {
                // Store estimate keyed by future rawCandidates index
                // (will be set during dedup accumulation)
              }
            }
          }
        }
```

Actually, difficulty estimates need embeddings. If leakage guard is off, we don't have per-item embeddings yet. For simplicity in Phase 3, difficulty targeting requires leakage guard OR we compute embeddings ourselves. Since the centroid cache is already seeded (it seeds from definitions regardless of leakage guard), we just need item embeddings.

Simpler approach: compute difficulty estimates AFTER the bulk embedding step (post-generation), not per-batch. This is less ideal than steering per-batch but much simpler and still valuable:

Remove the in-batch difficulty code above. Instead, after the bulk embedding step and before `initial_ega`, add:

```typescript
  // Tier 2: Difficulty Targeting — compute per-item difficulty estimates
  if (difficultyEnabled) {
    // Seed centroids if not already done by leakage guard
    if (!leakageEnabled) {
      const definitionTexts = constructs.map((c) =>
        [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
      )
      const definitionEmbeddings = await embedTexts(definitionTexts, embeddingModel)
      constructs.forEach((c, i) => {
        centroidCache.seed(c.id, definitionEmbeddings[i])
      })
    }

    for (let i = 0; i < rawCandidates.length; i++) {
      const centroid = centroidCache.getCentroid(rawCandidates[i].constructId)
      if (centroid && fullEmbeddings[i]) {
        difficultyEstimates.set(i, computeDifficultyEstimate(fullEmbeddings[i], centroid))
      }
    }
  }
```

- [ ] **Step 4: Add difficulty steering to batch prompt (between-batch)**

For the per-batch steering (the spec's primary intent), add this inside the batch loop. After the facet collection code and before the `buildItemGenerationPrompt` call, add:

```typescript
      // Tier 2: Difficulty Targeting — steer based on current pool skew
      // Per-batch steering requires cached embeddings from leakage guard
      let difficultySteering = ''
      if (difficultyEnabled && !leakageEnabled && attempts === 1) {
        console.log(`[pipeline] ${construct.name}: difficulty targeting enabled but leakage guard off — per-batch steering unavailable, post-generation estimates will still be computed`)
      }
      if (difficultyEnabled && leakageEnabled && accumulated.length >= BATCH_SIZE) {
        // Get embeddings for accumulated items from cache
        const accEstimates: number[] = []
        for (const stem of accumulated) {
          const embedding = stemEmbeddingCache.get(stem)
          const centroid = centroidCache.getCentroid(construct.id)
          if (embedding && centroid) {
            accEstimates.push(computeDifficultyEstimate(embedding, centroid))
          }
        }
        if (accEstimates.length > 0) {
          const distribution = analyzeDifficultyDistribution(accEstimates)
          difficultySteering = buildDifficultySteering(distribution.skew)
        }
      }
```

Then pass it to the prompt builder:

```typescript
      const prompt = buildItemGenerationPrompt({
        construct,
        batchSize: needed,
        responseFormatDescription: responseFormatDesc,
        previousItems: [...(construct.existingItems ?? []), ...accumulated],
        previousFacets,
        difficultySteering,
        contrastConstructs,
      })
```

Note: Difficulty steering only kicks in after the first batch (when `accumulated.length >= BATCH_SIZE`), because we need embeddings to analyze the distribution — and those only exist if leakage guard embedded them. If leakage guard is off, difficulty steering in the batch loop won't work (no cached embeddings). The post-generation difficulty estimates still get computed from bulk embeddings.

- [ ] **Step 5: Add difficulty estimates to scored items**

In the `scoredItems` mapping, update `difficultyEstimate`. Also fix the `leakageScore` and `leakageTarget` fields which are currently hardcoded to `undefined` — they should read from the stemEmbeddingCache/centroidCache to provide per-item leakage proximity data for the review UI:

```typescript
      difficultyEstimate: difficultyEstimates.get(index),
```

For the leakage fields, since leaking items were excluded from rawCandidates, all surviving items are non-leaking. But we can still store the similarity to the nearest non-target construct as informational data. For now, leave as `undefined` — the `leakageStats` in `pipelineStages` captures the aggregate data.

- [ ] **Step 6: Add difficulty targeting to pipelineStages**

Update the `pipelineStages` object:

```typescript
        pipelineStages: {
          ...(critiqueEnabled ? { critique: critiqueStats } : {}),
          ...(leakageEnabled ? { leakageGuard: leakageStats } : {}),
          ...(difficultyEnabled ? { difficultyTargeting: { enabled: true as const } } : {}),
        },
```

- [ ] **Step 7: Type-check and run tests**

Run: `npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -8`

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/generation/pipeline.ts src/lib/ai/generation/prompts/item-generation.ts
git commit -m "feat(pipeline-tier2): integrate difficulty targeting into pipeline"
```

---

### Task 4: Integrate Synthetic Validation into Pipeline

**Files:**
- Modify: `src/lib/ai/generation/pipeline.ts`

- [ ] **Step 1: Add import**

```typescript
import { runSyntheticValidation } from './synthetic-validation'
```

- [ ] **Step 2: Add synthetic validation after bootEGA, before final progress**

Find `await onProgress('final', 100)` (around line 503). Insert BEFORE it:

```typescript
  // Tier 2: Synthetic Validation — run after bootEGA, before final
  let syntheticResult: { respondentsGenerated: number; estimatedAlpha?: Record<string, number> } | undefined
  if (config.enableSyntheticValidation) {
    await onProgress('synthetic_validation', 90)
    try {
      const constructInfos = constructs.map((c) => ({ id: c.id, name: c.name }))
      const result = await runSyntheticValidation(
        scoredItems,
        constructInfos,
        50, // respondent count
        (msg) => console.log(`[pipeline] synthetic: ${msg}`),
      )
      syntheticResult = {
        respondentsGenerated: result.respondentsGenerated,
        estimatedAlpha: result.estimatedAlpha,
      }
      if (result.warnings.length > 0) {
        console.warn(`[pipeline] synthetic validation warnings:\n${result.warnings.join('\n')}`)
      }
    } catch (err) {
      console.warn(`[pipeline] synthetic validation failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
```

Wait — `scoredItems` is defined AFTER `await onProgress('final', 100)`. We need to move the synthetic validation to after scoredItems is built. Let me restructure.

Find the `scoredItems` mapping (the `rawCandidates.map(...)` block). It's currently followed by the `return { items: scoredItems, result: ... }`. Insert the synthetic validation BETWEEN the scoredItems mapping and the return:

```typescript
  // Tier 2: Synthetic Validation
  let syntheticResult: { respondentsGenerated: number; estimatedAlpha?: Record<string, number> } | undefined
  if (config.enableSyntheticValidation) {
    await onProgress('synthetic_validation', 95)
    try {
      const constructInfos = constructs.map((c) => ({ id: c.id, name: c.name }))
      const result = await runSyntheticValidation(
        scoredItems,
        constructInfos,
        50,
        (msg) => console.log(`[pipeline] synthetic: ${msg}`),
      )
      syntheticResult = {
        respondentsGenerated: result.respondentsGenerated,
        estimatedAlpha: result.estimatedAlpha,
      }
      if (result.warnings.length > 0) {
        console.warn(`[pipeline] synthetic validation warnings:\n${result.warnings.join('\n')}`)
      }
    } catch (err) {
      console.warn(`[pipeline] synthetic validation failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  await onProgress('final', 100)
```

And move the existing `await onProgress('final', 100)` to AFTER the synthetic validation block (delete the old one above the scoredItems mapping).

- [ ] **Step 3: Add synthetic result to pipelineStages**

Update the `pipelineStages` in the return:

```typescript
        pipelineStages: {
          ...(critiqueEnabled ? { critique: critiqueStats } : {}),
          ...(leakageEnabled ? { leakageGuard: leakageStats } : {}),
          ...(difficultyEnabled ? { difficultyTargeting: { enabled: true as const } } : {}),
          ...(syntheticResult ? { syntheticValidation: syntheticResult } : {}),
        },
```

- [ ] **Step 4: Type-check and run tests**

Run: `npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -8`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/pipeline.ts
git commit -m "feat(pipeline-tier2): integrate synthetic validation into pipeline"
```

---

### Task 5: Full Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

1. Open `/generate/new`, select 3+ constructs
2. Enable Difficulty Targeting and Synthetic Validation in Pipeline Options
3. Launch a generation run
4. Watch server logs for:
   - `[pipeline] synthetic:` lines showing persona generation and response simulation
   - Difficulty estimate computation (logged after embedding step)
5. After completion, check the review page:
   - Pipeline funnel should show all stages
   - Progress steps should include "Synthetic Validation"
6. Test with Difficulty Targeting on but Leakage Guard off — difficulty estimates should still compute (from bulk embeddings), but per-batch steering won't work (logged as info)
7. Test with all stages off — run should complete as the original pipeline
