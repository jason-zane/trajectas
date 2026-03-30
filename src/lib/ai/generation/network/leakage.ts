/**
 * leakage.ts — Cross-construct item leakage detection
 *
 * An item "leaks" when its assigned communityId consistently differs from
 * the modal community of its intended construct. These items may be
 * well-written but semantically closer to another construct.
 */
import type { CommunityAssignment } from '@/types/generation'

export interface LeakageResult {
  /** Set of item indices that consistently cluster with a different construct. */
  leakingIndices: Set<number>
  /** Map from item index to the construct whose community it leaked into. */
  suggestedConstructByIndex: Map<number, number>
}

export function detectLeakage(
  communities:      CommunityAssignment[],
  constructLabels:  number[],   // true construct label per item (0-indexed)
): LeakageResult {
  const n = communities.length

  // Find modal communityId for each construct
  const constructCommunityMap = new Map<number, number>()
  const byConstruct = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const c = constructLabels[i]
    const arr = byConstruct.get(c) ?? []
    arr.push(communities[i]?.communityId ?? 0)
    byConstruct.set(c, arr)
  }
  byConstruct.forEach((communityIds, constructLabel) => {
    const counts = new Map<number, number>()
    for (const cId of communityIds) counts.set(cId, (counts.get(cId) ?? 0) + 1)
    const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (modal) constructCommunityMap.set(constructLabel, modal[0])
  })

  // Build reverse map: communityId → construct label (which construct owns this community)
  const communityToConstruct = new Map<number, number>()
  constructCommunityMap.forEach((communityId, constructLabel) => {
    communityToConstruct.set(communityId, constructLabel)
  })

  const leakingIndices = new Set<number>()
  const suggestedConstructByIndex = new Map<number, number>()

  for (let i = 0; i < n; i++) {
    const expectedCommunity = constructCommunityMap.get(constructLabels[i])
    const actualCommunity   = communities[i]?.communityId
    if (
      expectedCommunity !== undefined &&
      actualCommunity   !== undefined &&
      actualCommunity   !== expectedCommunity
    ) {
      leakingIndices.add(i)
      const suggestedConstruct = communityToConstruct.get(actualCommunity)
      if (suggestedConstruct !== undefined) {
        suggestedConstructByIndex.set(i, suggestedConstruct)
      }
    }
  }

  return { leakingIndices, suggestedConstructByIndex }
}
