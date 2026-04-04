# Next-Gen Pipeline Phase 2: Item Critique + Leakage Guard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the two default-on pipeline stages — Item Critique (multi-agent review) and Leakage Guard (real-time cross-construct checking) — so that generated items are quality-filtered before entering the expensive embedding/network analysis pipeline.

**Architecture:** Two new modules (`item-critique.ts` and `leakage-guard.ts`) with focused responsibilities. The critique module builds a prompt, calls a separate LLM model, and parses verdicts. The leakage guard module manages construct centroids and checks item embeddings for cross-construct drift. Both are integrated into the pipeline's per-batch loop following the spec's ordering: Generate → Critique → Embed → Leakage Guard → Dedup → Accumulate. An embedding cache avoids double-embedding items.

**Tech Stack:** TypeScript, OpenRouter LLM API, cosine similarity (existing), embeddings (existing)

**Spec:** `docs/superpowers/specs/2026-04-03-pipeline-enhancement-design.md` (Sections 2a, 2b, Intra-Batch Processing Order, Embedding Caching, Construct Centroid Management)

---

### Task 1: Item Critique — Prompt Builder and Parser

**Files:**
- Create: `src/lib/ai/generation/prompts/item-critique.ts`
- Create: `tests/unit/item-critique.test.ts`

- [ ] **Step 1: Write tests for the critique prompt builder and parser**

Create `tests/unit/item-critique.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { buildCritiquePrompt, parseCritiqueResponse } from "@/lib/ai/generation/prompts/item-critique"

describe("buildCritiquePrompt", () => {
  it("includes all items and construct context", () => {
    const prompt = buildCritiquePrompt({
      items: [
        { stem: "I bounce back quickly", reverseScored: false, rationale: "resilience" },
        { stem: "I give up easily", reverseScored: true, rationale: "lack of resilience" },
      ],
      constructName: "Resilience",
      constructDefinition: "Ability to recover from setbacks",
      contrastConstructs: [
        { name: "Adaptability", definition: "Adjusting to change" },
      ],
    })

    expect(prompt).toContain("I bounce back quickly")
    expect(prompt).toContain("I give up easily")
    expect(prompt).toContain("Resilience")
    expect(prompt).toContain("Ability to recover from setbacks")
    expect(prompt).toContain("Adaptability")
  })
})

describe("parseCritiqueResponse", () => {
  it("parses valid keep/revise/drop verdicts", () => {
    const result = parseCritiqueResponse(JSON.stringify([
      { originalStem: "item 1", verdict: "keep" },
      { originalStem: "item 2", verdict: "revise", revisedStem: "item 2 revised", reason: "too vague" },
      { originalStem: "item 3", verdict: "drop", reason: "cross-loads" },
    ]))

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ originalStem: "item 1", verdict: "keep" })
    expect(result[1]).toEqual({ originalStem: "item 2", verdict: "revise", revisedStem: "item 2 revised", reason: "too vague" })
    expect(result[2]).toEqual({ originalStem: "item 3", verdict: "drop", reason: "cross-loads" })
  })

  it("returns null for unparseable response", () => {
    expect(parseCritiqueResponse("not json")).toBeNull()
  })

  it("handles markdown-wrapped JSON", () => {
    const result = parseCritiqueResponse('```json\n[{"originalStem":"x","verdict":"keep"}]\n```')
    expect(result).toHaveLength(1)
    expect(result![0].verdict).toBe("keep")
  })

  it("filters invalid verdicts", () => {
    const result = parseCritiqueResponse(JSON.stringify([
      { originalStem: "item 1", verdict: "keep" },
      { originalStem: "item 2", verdict: "invalid" },
      { verdict: "keep" },  // missing originalStem
    ]))

    expect(result).toHaveLength(1)
    expect(result![0].originalStem).toBe("item 1")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/item-critique.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the critique prompt builder and parser**

Create `src/lib/ai/generation/prompts/item-critique.ts`:

```typescript
import type { GeneratedItemRaw } from './item-generation'

export interface CritiqueInput {
  items: GeneratedItemRaw[]
  constructName: string
  constructDefinition?: string
  constructDescription?: string
  constructIndicatorsLow?: string
  constructIndicatorsMid?: string
  constructIndicatorsHigh?: string
  contrastConstructs?: Array<{ name: string; definition?: string }>
}

export interface CritiqueVerdict {
  originalStem: string
  verdict: 'keep' | 'revise' | 'drop'
  revisedStem?: string
  reason?: string
}

export function buildCritiquePrompt(input: CritiqueInput): string {
  const constructSection = [
    `## Target Construct: ${input.constructName}`,
    input.constructDefinition ? `Definition: ${input.constructDefinition}` : null,
    input.constructDescription ? `Description: ${input.constructDescription}` : null,
    input.constructIndicatorsLow ? `Low scorers: ${input.constructIndicatorsLow}` : null,
    input.constructIndicatorsMid ? `Mid scorers: ${input.constructIndicatorsMid}` : null,
    input.constructIndicatorsHigh ? `High scorers: ${input.constructIndicatorsHigh}` : null,
  ].filter(Boolean).join('\n')

  const contrastSection = input.contrastConstructs?.length
    ? `\n## Contrast Constructs (items should NOT fit these):\n${input.contrastConstructs.map((c) => `- ${c.name}${c.definition ? `: ${c.definition}` : ''}`).join('\n')}`
    : ''

  const itemsSection = input.items
    .map((item, i) => `${i + 1}. "${item.stem}" (${item.reverseScored ? 'reverse-scored' : 'positively-scored'})`)
    .join('\n')

  return `Review the following ${input.items.length} items for the construct described below. For each item, decide whether to keep, revise, or drop it.

${constructSection}
${contrastSection}

## Items to Review

${itemsSection}

Return a JSON array with one entry per item, in the same order:
[{ "originalStem": "...", "verdict": "keep|revise|drop", "revisedStem": "...(only if revise)", "reason": "one sentence (required for revise and drop)" }]`
}

const VALID_VERDICTS = new Set(['keep', 'revise', 'drop'])

export function parseCritiqueResponse(jsonContent: string): CritiqueVerdict[] | null {
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
      (item): item is CritiqueVerdict =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).originalStem === 'string' &&
        typeof (item as Record<string, unknown>).verdict === 'string' &&
        VALID_VERDICTS.has((item as Record<string, unknown>).verdict as string),
    ).map((item) => ({
      originalStem: item.originalStem,
      verdict: item.verdict,
      ...(item.verdict === 'revise' && typeof item.revisedStem === 'string' ? { revisedStem: item.revisedStem } : {}),
      ...(item.reason && typeof item.reason === 'string' ? { reason: item.reason } : {}),
    }))
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/item-critique.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/prompts/item-critique.ts tests/unit/item-critique.test.ts
git commit -m "feat(pipeline-tier2): add item critique prompt builder and parser"
```

---

### Task 2: Leakage Guard Module

**Files:**
- Create: `src/lib/ai/generation/leakage-guard.ts`
- Create: `tests/unit/leakage-guard.test.ts`

- [ ] **Step 1: Write tests for leakage guard**

Create `tests/unit/leakage-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { ConstructCentroidCache, checkItemLeakage } from "@/lib/ai/generation/leakage-guard"

describe("ConstructCentroidCache", () => {
  it("seeds centroids from definitions", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.seed("c2", [0, 1, 0])

    expect(cache.getCentroid("c1")).toEqual([1, 0, 0])
    expect(cache.getCentroid("c2")).toEqual([0, 1, 0])
  })

  it("updates centroid incrementally", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.addItem("c1", [0, 1, 0])

    const centroid = cache.getCentroid("c1")!
    // Average of [1,0,0] and [0,1,0] = [0.5, 0.5, 0]
    expect(centroid[0]).toBeCloseTo(0.5)
    expect(centroid[1]).toBeCloseTo(0.5)
    expect(centroid[2]).toBeCloseTo(0)
  })

  it("returns all construct IDs", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0])
    cache.seed("c2", [0, 1])

    expect(cache.getConstructIds()).toEqual(["c1", "c2"])
  })
})

describe("checkItemLeakage", () => {
  it("returns no leakage when item is closest to its own construct", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.seed("c2", [0, 1, 0])
    cache.seed("c3", [0, 0, 1])

    const result = checkItemLeakage([0.9, 0.1, 0], "c1", cache)
    expect(result.isLeaking).toBe(false)
  })

  it("detects leakage when item is closer to another construct", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.seed("c2", [0, 1, 0])

    // Item embedding is much closer to c2 than c1
    const result = checkItemLeakage([0.1, 0.9, 0], "c1", cache)
    expect(result.isLeaking).toBe(true)
    expect(result.leakageTarget).toBe("c2")
    expect(result.leakageScore).toBeGreaterThan(0)
  })

  it("returns no leakage when only one construct exists", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])

    const result = checkItemLeakage([0.5, 0.5, 0], "c1", cache)
    expect(result.isLeaking).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/leakage-guard.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the leakage guard module**

Create `src/lib/ai/generation/leakage-guard.ts`:

```typescript
/**
 * leakage-guard.ts
 *
 * Manages construct centroids and checks items for cross-construct leakage
 * during generation. Uses cosine similarity to detect items that are
 * semantically closer to a different construct than their intended one.
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

export class ConstructCentroidCache {
  private centroids = new Map<string, { sum: number[]; count: number }>()

  /** Seed a construct centroid from its definition embedding. */
  seed(constructId: string, embedding: number[]): void {
    this.centroids.set(constructId, { sum: [...embedding], count: 1 })
  }

  /** Incrementally update a construct's centroid with a new item embedding. */
  addItem(constructId: string, embedding: number[]): void {
    const entry = this.centroids.get(constructId)
    if (!entry) return
    for (let i = 0; i < embedding.length; i++) {
      entry.sum[i] += embedding[i]
    }
    entry.count += 1
  }

  /** Get the current centroid (average) for a construct. */
  getCentroid(constructId: string): number[] | undefined {
    const entry = this.centroids.get(constructId)
    if (!entry) return undefined
    return entry.sum.map((v) => v / entry.count)
  }

  /** Get all construct IDs in the cache. */
  getConstructIds(): string[] {
    return [...this.centroids.keys()]
  }
}

export interface LeakageResult {
  isLeaking: boolean
  /** Cosine similarity to the nearest non-target construct centroid. */
  leakageScore: number
  /** Name/ID of the construct the item leaked toward, if any. */
  leakageTarget?: string
}

/**
 * Check if an item's embedding is closer to another construct's centroid
 * than to its own construct's centroid.
 */
export function checkItemLeakage(
  itemEmbedding: number[],
  targetConstructId: string,
  centroidCache: ConstructCentroidCache,
): LeakageResult {
  const targetCentroid = centroidCache.getCentroid(targetConstructId)
  if (!targetCentroid) {
    return { isLeaking: false, leakageScore: 0 }
  }

  const targetSimilarity = cosineSimilarity(itemEmbedding, targetCentroid)
  let maxOtherSimilarity = -1
  let maxOtherConstructId: string | undefined

  for (const constructId of centroidCache.getConstructIds()) {
    if (constructId === targetConstructId) continue
    const centroid = centroidCache.getCentroid(constructId)
    if (!centroid) continue
    const similarity = cosineSimilarity(itemEmbedding, centroid)
    if (similarity > maxOtherSimilarity) {
      maxOtherSimilarity = similarity
      maxOtherConstructId = constructId
    }
  }

  if (maxOtherSimilarity < 0) {
    // Only one construct — no leakage possible
    return { isLeaking: false, leakageScore: 0 }
  }

  return {
    isLeaking: maxOtherSimilarity >= targetSimilarity,
    leakageScore: maxOtherSimilarity,
    leakageTarget: maxOtherSimilarity >= targetSimilarity ? maxOtherConstructId : undefined,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/leakage-guard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generation/leakage-guard.ts tests/unit/leakage-guard.test.ts
git commit -m "feat(pipeline-tier2): add leakage guard module with centroid cache"
```

---

### Task 3: Integrate Item Critique into Pipeline

**Files:**
- Modify: `src/lib/ai/generation/pipeline.ts`

This is the most complex task — it wires the critique stage into the per-batch loop.

- [ ] **Step 1: Add imports**

At the top of `src/lib/ai/generation/pipeline.ts`, add:

```typescript
import { buildCritiquePrompt, parseCritiqueResponse } from './prompts/item-critique'
import type { CritiqueVerdict } from './prompts/item-critique'
```

- [ ] **Step 2: Add critique model resolution at pipeline start**

After the existing `const model = ...` and `const embeddingModel = ...` lines (around line 68-69), add:

```typescript
  // Tier 2: Item Critique model (separate from generation)
  const critiqueEnabled = config.enableItemCritique !== false
  let critiqueModel: string | undefined
  let critiqueSystemPrompt: string | undefined
  if (critiqueEnabled) {
    try {
      const critiqueTask = await getModelForTask('item_critique')
      const critiquePromptData = await getActiveSystemPrompt('item_critique')
      critiqueModel = critiqueTask.modelId
      critiqueSystemPrompt = critiquePromptData.content
    } catch {
      console.warn('[pipeline] Item critique model/prompt not configured, skipping critique stage')
    }
  }
```

- [ ] **Step 3: Add critique tracking counters**

After `const MAX_CONSECUTIVE_FAILURES = 5` (around line 90), add:

```typescript
  // Tier 2: Critique stage tracking
  const critiqueStats = { itemsReviewed: 0, kept: 0, revised: 0, dropped: 0, critiqueFailed: false }
  const critiqueVerdicts = new Map<string, { verdict: 'kept' | 'revised' | 'dropped'; reason?: string; originalStem?: string }>()
```

- [ ] **Step 4: Insert critique call after parsing, before deduplication**

Inside the batch loop, after the `parseGeneratedItems` call succeeds and `consecutiveFailures = 0` is set (around line 145), but BEFORE the deduplication loop, insert the critique call.

Find this code block:

```typescript
        consecutiveFailures = 0
        const constructSeen = seenByConstruct.get(construct.id) ?? new Set<string>(existingNormalized)
        let duplicatesInBatch = 0
```

Replace it with:

```typescript
        consecutiveFailures = 0

        // Tier 2: Item Critique — review batch before deduplication
        let critiquedItems = parsed
        if (critiqueEnabled && critiqueModel && critiqueSystemPrompt) {
          try {
            const contrastConstructs = constructs
              .filter(other => other.id !== construct.id)
              .slice(0, 6)

            const critiquePrompt = buildCritiquePrompt({
              items: parsed,
              constructName: construct.name,
              constructDefinition: construct.definition,
              constructDescription: construct.description,
              constructIndicatorsLow: construct.indicatorsLow,
              constructIndicatorsMid: construct.indicatorsMid,
              constructIndicatorsHigh: construct.indicatorsHigh,
              contrastConstructs: contrastConstructs.map((c) => ({
                name: c.name,
                definition: c.definition,
              })),
            })

            const critiqueResponse = await openRouterProvider.complete({
              model: critiqueModel,
              systemPrompt: critiqueSystemPrompt,
              prompt: critiquePrompt,
              temperature: 0.3, // Low temperature for consistent critique
              maxTokens: 4096,
              responseFormat: 'json',
            })

            totalInputTokens += critiqueResponse.usage.inputTokens
            totalOutputTokens += critiqueResponse.usage.outputTokens

            const verdicts = parseCritiqueResponse(critiqueResponse.content)
            if (verdicts) {
              critiqueStats.itemsReviewed += parsed.length
              const survivingItems: typeof parsed = []

              for (const item of parsed) {
                const verdict = verdicts.find((v) => v.originalStem === item.stem)
                if (!verdict || verdict.verdict === 'keep') {
                  critiqueStats.kept++
                  critiqueVerdicts.set(item.stem, { verdict: 'kept' })
                  survivingItems.push(item)
                } else if (verdict.verdict === 'revise' && verdict.revisedStem) {
                  critiqueStats.revised++
                  critiqueVerdicts.set(verdict.revisedStem, {
                    verdict: 'revised',
                    reason: verdict.reason,
                    originalStem: item.stem,
                  })
                  survivingItems.push({ ...item, stem: verdict.revisedStem })
                } else {
                  critiqueStats.dropped++
                  critiqueVerdicts.set(item.stem, { verdict: 'dropped', reason: verdict.reason })
                }
              }

              critiquedItems = survivingItems
              console.log(`[pipeline] ${construct.name} batch ${attempts} critique: ${parsed.length} reviewed, ${critiqueStats.dropped} dropped, ${critiqueStats.revised} revised`)
            } else {
              console.warn(`[pipeline] ${construct.name} batch ${attempts}: critique response unparseable, keeping all items`)
              critiqueStats.critiqueFailed = true
            }
          } catch (err) {
            console.warn(`[pipeline] ${construct.name} batch ${attempts}: critique failed (${err instanceof Error ? err.message : 'unknown'}), keeping all items`)
            critiqueStats.critiqueFailed = true
          }
        }

        const constructSeen = seenByConstruct.get(construct.id) ?? new Set<string>(existingNormalized)
        let duplicatesInBatch = 0
```

Then update the deduplication loop to iterate `critiquedItems` instead of `parsed`:

Change:
```typescript
        for (const item of parsed) {
```
to:
```typescript
        for (const item of critiquedItems) {
```

- [ ] **Step 5: Add critique data to scored items**

Find the `scoredItems` mapping at the end of the pipeline (around line 343). In the returned object, after `isUnstable`, add:

```typescript
      // Tier 2: Critique metadata
      critiqueVerdict: critiqueVerdicts.get(candidate.stem)?.verdict,
      critiqueReason: critiqueVerdicts.get(candidate.stem)?.reason,
      critiqueOriginalStem: critiqueVerdicts.get(candidate.stem)?.originalStem,
```

- [ ] **Step 6: Add critique stats to aiSnapshot**

Find the `aiSnapshot` object in the return value (around line 385). After `bootSweeps`, add:

```typescript
        pipelineStages: {
          ...(critiqueEnabled ? { critique: critiqueStats } : {}),
        },
```

- [ ] **Step 7: Add critique progress step**

After the `await onProgress('item_generation', 10)` line (around line 78), the critique runs inline with generation (per-batch), so no separate progress step is needed. But add a progress report after all generation completes, before the embedding step. Find `await onProgress('embedding', 30, ...)` and add before it:

```typescript
  if (critiqueEnabled) {
    await onProgress('item_critique', 25, { itemsGenerated: rawCandidates.length })
  }
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/generation/pipeline.ts
git commit -m "feat(pipeline-tier2): integrate item critique into generation batch loop"
```

---

### Task 4: Integrate Leakage Guard into Pipeline

**Files:**
- Modify: `src/lib/ai/generation/pipeline.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/ai/generation/pipeline.ts`, add:

```typescript
import { ConstructCentroidCache, checkItemLeakage } from './leakage-guard'
```

- [ ] **Step 2: Seed construct centroids before generation loop**

After the critique model resolution code (added in Task 3), before the `for (const construct of constructs)` loop, add:

```typescript
  // Tier 2: Leakage Guard — seed construct centroids from definitions
  const leakageEnabled = config.enableLeakageGuard !== false && constructs.length >= 2
  const centroidCache = new ConstructCentroidCache()
  const leakageStats = { itemsChecked: 0, flagged: 0 }
  const itemEmbeddingCache = new Map<number, number[]>()

  if (leakageEnabled) {
    // Embed construct definitions to seed centroids
    const definitionTexts = constructs.map((c) =>
      [c.name, c.definition ?? '', c.description ?? ''].filter(Boolean).join('. ')
    )
    const definitionEmbeddings = await embedTexts(definitionTexts, embeddingModel)
    constructs.forEach((c, i) => {
      centroidCache.seed(c.id, definitionEmbeddings[i])
    })
  }
```

- [ ] **Step 3: Add leakage check after deduplication in the batch loop**

After the deduplication loop (the `for (const item of critiquedItems)` loop), and after `seenByConstruct.set(...)`, add leakage checking. The items have already been accumulated into `rawCandidates` at this point.

Find the line `seenByConstruct.set(construct.id, constructSeen)` and add after it:

```typescript
        // Tier 2: Leakage Guard — check new items against other construct centroids
        if (leakageEnabled) {
          const newItemIndices = []
          for (let idx = rawCandidates.length - (accumulated.length - accLengthBefore); idx < rawCandidates.length; idx++) {
            newItemIndices.push(idx)
          }

          if (newItemIndices.length > 0) {
            // Embed new items for leakage checking
            const newStems = newItemIndices.map((idx) => rawCandidates[idx].stem)
            const newEmbeddings = await embedTexts(newStems, embeddingModel)

            for (let i = 0; i < newItemIndices.length; i++) {
              const globalIdx = newItemIndices[i]
              const embedding = newEmbeddings[i]
              itemEmbeddingCache.set(globalIdx, embedding) // Cache for bulk embedding reuse

              leakageStats.itemsChecked++
              const result = checkItemLeakage(embedding, construct.id, centroidCache)

              if (result.isLeaking) {
                leakageStats.flagged++
                // Mark item as leaking — will be reflected in removalStage during scoring
                rawCandidates[globalIdx] = {
                  ...rawCandidates[globalIdx],
                  _leakageScore: result.leakageScore,
                  _leakageTarget: result.leakageTarget,
                  _isLeaking: true,
                } as typeof rawCandidates[number] & { _leakageScore: number; _leakageTarget?: string; _isLeaking: boolean }
                console.log(`[pipeline] ${construct.name}: item "${rawCandidates[globalIdx].stem.slice(0, 50)}..." leaked toward ${result.leakageTarget}`)
              } else {
                // Update centroid with non-leaking item
                centroidCache.addItem(construct.id, embedding)
              }
            }
          }
        }
```

Wait — this approach of mutating rawCandidates with underscore-prefixed fields is messy. Let me use a cleaner approach with a separate Set to track leaking indices.

Actually, let me restructure. We need to track `accLengthBefore` to know which items were added in this batch. Add this before the deduplication loop:

Find `const constructSeen = ...` and add before it:

```typescript
        const accLengthBefore = accumulated.length
```

Then after `seenByConstruct.set(construct.id, constructSeen)`, add:

```typescript
        // Tier 2: Leakage Guard — check new items against other construct centroids
        if (leakageEnabled && accumulated.length > accLengthBefore) {
          const batchStartIdx = rawCandidates.length - (accumulated.length - accLengthBefore)
          const newStems = rawCandidates.slice(batchStartIdx).map((c) => c.stem)
          const newEmbeddings = await embedTexts(newStems, embeddingModel)

          for (let i = 0; i < newEmbeddings.length; i++) {
            const globalIdx = batchStartIdx + i
            itemEmbeddingCache.set(globalIdx, newEmbeddings[i])
            leakageStats.itemsChecked++

            const result = checkItemLeakage(newEmbeddings[i], construct.id, centroidCache)
            if (result.isLeaking) {
              leakageStats.flagged++
              leakingIndices.add(globalIdx)
              leakingMeta.set(globalIdx, { score: result.leakageScore, target: result.leakageTarget })
              console.log(`[pipeline] ${construct.name}: item leaked toward ${result.leakageTarget}`)
            } else {
              centroidCache.addItem(construct.id, newEmbeddings[i])
            }
          }
        }
```

Add the tracking sets near the `leakageStats` declaration:

```typescript
  const leakingIndices = new Set<number>()
  const leakingMeta = new Map<number, { score: number; target?: string }>()
```

- [ ] **Step 4: Use cached embeddings in the bulk embedding step**

Find the bulk embedding call after the generation loop (around line 189):

```typescript
  const stems = rawCandidates.map(candidate => candidate.stem)
  const fullEmbeddings = await embedTexts(stems, embeddingModel)
```

Replace with:

```typescript
  // Use cached embeddings from leakage guard where available
  const stems = rawCandidates.map(candidate => candidate.stem)
  let fullEmbeddings: number[][]
  if (itemEmbeddingCache.size > 0) {
    const uncachedIndices: number[] = []
    const uncachedTexts: string[] = []
    for (let i = 0; i < stems.length; i++) {
      if (!itemEmbeddingCache.has(i)) {
        uncachedIndices.push(i)
        uncachedTexts.push(stems[i])
      }
    }
    const newEmbeddings = uncachedTexts.length > 0 ? await embedTexts(uncachedTexts, embeddingModel) : []
    fullEmbeddings = stems.map((_, i) => {
      const cached = itemEmbeddingCache.get(i)
      if (cached) return cached
      const uncachedPos = uncachedIndices.indexOf(i)
      return newEmbeddings[uncachedPos]
    })
  } else {
    fullEmbeddings = await embedTexts(stems, embeddingModel)
  }
```

- [ ] **Step 5: Add leakage data to scored items**

In the `scoredItems` mapping, update the `removalStage` logic to include leakage:

```typescript
    const removalStage = leakingIndices.has(index)
      ? 'leakage'
      : redundantIndices.has(index)
        ? 'uva'
        : unstableIndices.has(index)
          ? 'boot_ega'
          : 'kept'
```

And add leakage metadata:

```typescript
      leakageScore: leakingMeta.get(index)?.score,
      leakageTarget: leakingMeta.get(index)?.target,
```

Also exclude leaking items from UVA/bootEGA processing. In the `keptAfterUvaIndices` calculation (around line 192), filter out leaking items:

```typescript
  const keptAfterUvaIndices = rawCandidates
    .map((_, index) => index)
    .filter(index => !redundantIndices.has(index) && !leakingIndices.has(index))
```

- [ ] **Step 6: Add leakage stats to aiSnapshot.pipelineStages**

In the `pipelineStages` object (added in Task 3), add:

```typescript
        pipelineStages: {
          ...(critiqueEnabled ? { critique: critiqueStats } : {}),
          ...(leakageEnabled ? { leakageGuard: leakageStats } : {}),
        },
```

- [ ] **Step 7: Add leakage progress step**

After the embedding progress step (around line 187), add:

```typescript
  if (leakageEnabled) {
    await onProgress('leakage_check', 35)
  }
```

- [ ] **Step 8: Type-check and run tests**

Run: `npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -8`
Expected: No type errors, all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/generation/pipeline.ts
git commit -m "feat(pipeline-tier2): integrate leakage guard into pipeline with embedding cache"
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

1. Open the generation wizard (`/generate/new`)
2. Select 3+ constructs with Item Critique and Leakage Guard enabled (defaults)
3. Launch a generation run
4. Watch server logs for:
   - `[pipeline] ... critique:` lines showing batch reviews
   - `[pipeline] ... leaked toward ...` lines for leakage detection
5. After completion, check the review page:
   - Pipeline funnel should show critique and leakage drop counts
   - Progress steps should include "Item Critique" and "Leakage Guard"
6. Test with both stages disabled — run should complete without critique/leakage output
