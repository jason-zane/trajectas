/**
 * redundancy.ts — Within-construct redundancy detection using wTO (weighted topological overlap).
 *
 * Redundancy is WITHIN a single construct's item pool (within-scale property).
 * Comparing embeddings across constructs is meaningless — we operate on one
 * blueprint/construct at a time.
 *
 * Call chain (from survey brief):
 * 1. embedTexts() → embeddings (n items × d dimensions)
 * 2. itemCorrelationMatrix(embeddings) → correlation matrix (n × n)
 * 3. buildNetwork(corrMatrix, 'ebicglasso') → adjacency matrix
 * 4. computeWTO(adjacency) → wTO overlap scores (n × n)
 * 5. findRedundantItems(adjacency, cutoff) → { redundantIndices, wtoScores }
 *
 * Why wTO and not EGA/NMI community detection?
 * - Embeddings are reliable for near-duplicate detection (high cosine ≈ paraphrase)
 * - EGA/NMI fails to recover construct communities at item granularity (measured NMI 0.34-0.38)
 * - wTO is proven on network redundancy; it keeps the most-unique item per group
 *
 * Result: redundancy_peer_id (if item is redundant, points to the kept item),
 *         redundancy_score (wTO max for that item across the matrix)
 */

'use server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  embedTexts,
} from '@/lib/ai/generation/embeddings'
import {
  itemCorrelationMatrix,
} from '@/lib/ai/generation/network/correlation'
import {
  buildNetwork,
} from '@/lib/ai/generation/network/network-builder'
import {
  computeWTO,
  findRedundantItems,
} from '@/lib/ai/generation/network/wto'
import { mapWithConcurrency, DEFAULT_CONCURRENCY } from '@/lib/instrument/concurrency'
import { listCandidateItemsByBlueprint, updateCandidateItem } from '@/lib/dal/instrument'

/**
 * Result of a redundancy pass: maps item index to (peer index, wTO score).
 * Only includes items marked as redundant; keepers are absent.
 */
export interface RedundancyPassResult {
  /** Map of redundant item ID → { peerId: ID of the kept item, score: wTO max } */
  redundantPairs: Map<string, { peerId: string; score: number }>;
  /** Overall stats for audit trail */
  stats: {
    totalItems: number;
    redundantCount: number;
    keptCount: number;
    cutoff: number;
    embeddingModel?: string;
    networkEstimator: 'ebicglasso' | 'tmfg';
  };
}

/**
 * Default wTO cutoff for within-construct redundancy.
 *
 * The pipeline uses ~0.20. This is aggressive (catches paraphrases),
 * but within-construct checks are fast and selective — we remove items
 * ONLY when they share >20% topological overlap.
 */
export const DEFAULT_WTO_CUTOFF = 0.20

/**
 * Run within-construct redundancy detection on a blueprint's candidate items.
 *
 * For each item flagged as redundant:
 * - redundancy_peer_id = ID of the kept item (most unique in group)
 * - redundancy_score = wTO max for that item
 *
 * Failures on individual items (embed errors, etc.) are logged but do not
 * fail the pass — partial progress is preserved.
 */
export async function runRedundancyPass(
  db: SupabaseClient,
  blueprintId: string,
  cutoff: number = DEFAULT_WTO_CUTOFF,
): Promise<RedundancyPassResult> {
  const items = await listCandidateItemsByBlueprint(db, blueprintId)
  if (items.length < 2) {
    return {
      redundantPairs: new Map(),
      stats: {
        totalItems: items.length,
        redundantCount: 0,
        keptCount: items.length,
        cutoff,
        networkEstimator: 'ebicglasso',
      },
    }
  }

  // Step 1: Embed item stems
  const stems = items.map((item) => item.stem)
  let embeddings: number[][] = []
  try {
    embeddings = await embedTexts(stems)
  } catch (error) {
    console.error('Redundancy: embedding failed', error)
    throw new Error(`Failed to embed item stems: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (embeddings.length !== items.length) {
    throw new Error(`Embedding mismatch: got ${embeddings.length} embeddings for ${items.length} items`)
  }

  // Step 2: Correlation → network → wTO
  const corrMatrix = itemCorrelationMatrix(embeddings)
  const netResult = buildNetwork(corrMatrix, 'ebicglasso')
  const wtoScores: number[] = []

  // For each item, record its max wTO score
  const wtoMatrix = computeWTO(netResult.adjacency)
  for (let i = 0; i < items.length; i++) {
    let max = 0
    for (let j = 0; j < wtoMatrix[i]!.length; j++) {
      max = Math.max(max, wtoMatrix[i]![j]!)
    }
    wtoScores.push(max)
  }

  // Step 3: Find redundant items
  const redundancyResult = findRedundantItems(netResult.adjacency, cutoff)

  // Map indices back to item IDs
  const redundantPairs = new Map<string, { peerId: string; score: number }>()
  for (const redundantIndex of redundancyResult.redundantIndices) {
    const redundantItem = items[redundantIndex]!
    const score = redundancyResult.wtoScores[redundantIndex]!

    // Find the peer (the item in this group that was kept).
    // For now, we scan all items to find which one is NOT redundant but has high wTO overlap.
    // In practice, the wTO algorithm keeps the most-unique, so we mark this item as
    // redundant with the entire redundant group as its source; we'll refine the peer ID
    // in the persistence step by finding the best keeper.
    let bestPeerId: string | null = null
    let bestPeerScore = -Infinity

    for (let j = 0; j < items.length; j++) {
      if (j === redundantIndex) continue
      if (redundancyResult.redundantIndices.has(j)) continue // peer must not be redundant
      const score_ij = wtoMatrix[redundantIndex]![j]!
      if (score_ij > bestPeerScore) {
        bestPeerScore = score_ij
        bestPeerId = items[j]!.id
      }
    }

    if (bestPeerId) {
      redundantPairs.set(redundantItem.id, { peerId: bestPeerId, score })
    }
  }

  // Step 4: Persist results (with error isolation)
  const updateResults = await mapWithConcurrency(
    Array.from(redundantPairs.entries()),
    DEFAULT_CONCURRENCY,
    async ([redundantId, { peerId, score }]) => {
      try {
        await updateCandidateItem(db, redundantId, {
          redundancyPeerId: peerId,
          redundancyScore: score,
        })
      } catch (error) {
        console.error(`Redundancy: failed to persist ${redundantId}:`, error)
        throw error
      }
    },
  )

  const failedUpdates = updateResults.filter((r) => !r.ok).length
  if (failedUpdates > 0) {
    console.warn(
      `Redundancy: ${failedUpdates} of ${redundantPairs.size} items failed to persist`,
    )
  }

  return {
    redundantPairs,
    stats: {
      totalItems: items.length,
      redundantCount: redundancyResult.redundantIndices.size,
      keptCount: items.length - redundancyResult.redundantIndices.size,
      cutoff,
      networkEstimator: 'ebicglasso',
    },
  }
}

/**
 * Mark all candidate items in a blueprint as non-redundant (for rollback).
 */
export async function clearRedundancyMarks(
  db: SupabaseClient,
  blueprintId: string,
): Promise<void> {
  const items = await listCandidateItemsByBlueprint(db, blueprintId)
  const clearResults = await mapWithConcurrency(
    items,
    DEFAULT_CONCURRENCY,
    async (item) => {
      try {
        await updateCandidateItem(db, item.id, {
          redundancyPeerId: null,
          redundancyScore: null,
        })
      } catch (error) {
        console.error(`Redundancy clear: failed for ${item.id}:`, error)
        throw error
      }
    },
  )

  const failedClears = clearResults.filter((r) => !r.ok).length
  if (failedClears > 0) {
    console.warn(`Redundancy clear: ${failedClears} of ${items.length} items failed to clear`)
  }
}
