/**
 * Forced-choice block auto-generation algorithm.
 *
 * Assembles items into balanced blocks that maximise construct diversity.
 * Pure function — no DB dependency.
 */

export type GeneratorItem = {
  itemId: string
  constructId: string
}

export type ForcedChoiceBlockDraft = {
  items: { itemId: string; constructId: string; position: number }[]
}

/**
 * Generate forced-choice blocks from a list of items.
 *
 * Algorithm (greedy with balancing):
 * 1. Group items by constructId
 * 2. For each block, pick items from the constructs with the most remaining items
 * 3. Prefer construct diversity — each block draws from different constructs
 * 4. Every item appears exactly once
 */
export function generateForcedChoiceBlocks(
  items: GeneratorItem[],
  blockSize: 3 | 4,
): { blocks: ForcedChoiceBlockDraft[] } {
  if (items.length === 0) return { blocks: [] }

  // Group items by construct
  const pools = new Map<string, string[]>()
  for (const item of items) {
    const list = pools.get(item.constructId) ?? []
    list.push(item.itemId)
    pools.set(item.constructId, list)
  }

  // Shuffle each pool for randomness
  for (const list of pools.values()) {
    shuffleInPlace(list)
  }

  const blocks: ForcedChoiceBlockDraft[] = []
  let totalRemaining = items.length

  while (totalRemaining >= blockSize) {
    const block = pickBlock(pools, blockSize)
    if (!block) break
    blocks.push(block)
    totalRemaining -= block.items.length
  }

  // Handle remainder items
  if (totalRemaining > 0) {
    const remainingItems: { itemId: string; constructId: string }[] = []
    for (const [constructId, itemIds] of pools) {
      for (const itemId of itemIds) {
        remainingItems.push({ itemId, constructId })
      }
    }

    if (remainingItems.length >= 2) {
      // Create a smaller final block
      const finalBlock: ForcedChoiceBlockDraft = {
        items: remainingItems.map((item, i) => ({
          itemId: item.itemId,
          constructId: item.constructId,
          position: i,
        })),
      }
      blocks.push(finalBlock)
      // Clear pools
      pools.clear()
    } else if (remainingItems.length === 1 && blocks.length > 0) {
      // Append to last block
      const lastBlock = blocks[blocks.length - 1]
      lastBlock.items.push({
        itemId: remainingItems[0].itemId,
        constructId: remainingItems[0].constructId,
        position: lastBlock.items.length,
      })
      pools.clear()
    }
  }

  return { blocks }
}

function pickBlock(
  pools: Map<string, string[]>,
  blockSize: number,
): ForcedChoiceBlockDraft | null {
  // Sort constructs by remaining item count (descending)
  const sorted = [...pools.entries()]
    .filter(([, items]) => items.length > 0)
    .sort((a, b) => b[1].length - a[1].length)

  if (sorted.length === 0) return null

  const picked: { itemId: string; constructId: string }[] = []
  const usedConstructs = new Set<string>()

  // First pass: pick one item from each of the top constructs (for diversity)
  for (const [constructId, itemIds] of sorted) {
    if (picked.length >= blockSize) break
    if (usedConstructs.has(constructId)) continue
    if (itemIds.length === 0) continue

    const itemId = itemIds.pop()!
    picked.push({ itemId, constructId })
    usedConstructs.add(constructId)

    if (itemIds.length === 0) pools.delete(constructId)
  }

  // Second pass: if not enough distinct constructs, fill from largest pools
  if (picked.length < blockSize) {
    const remaining = [...pools.entries()]
      .filter(([, items]) => items.length > 0)
      .sort((a, b) => b[1].length - a[1].length)

    for (const [constructId, itemIds] of remaining) {
      if (picked.length >= blockSize) break
      while (picked.length < blockSize && itemIds.length > 0) {
        const itemId = itemIds.pop()!
        picked.push({ itemId, constructId })
        if (itemIds.length === 0) pools.delete(constructId)
      }
    }
  }

  if (picked.length < 2) return null

  // Shuffle positions within block
  shuffleInPlace(picked)

  return {
    items: picked.map((p, i) => ({
      itemId: p.itemId,
      constructId: p.constructId,
      position: i,
    })),
  }
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
