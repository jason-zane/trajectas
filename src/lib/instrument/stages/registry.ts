/**
 * Stage registry with dependency resolution and validation.
 *
 * Provides topological sorting of stages by their 'requires' dependencies,
 * cycle detection, and validation. Pure module (no I/O or side effects).
 *
 * @module
 */

import type { StageDefinition, StageKey, StageRegistry } from './types'

/**
 * Create a registry from an array of stage definitions.
 *
 * @param defs Array of stage definitions to register
 * @returns A StageRegistry that can resolve execution order
 * @throws If definitions are invalid (duplicate keys, circular dependencies, etc.)
 */
export function createRegistry(defs: StageDefinition[]): StageRegistry {
  // Validate before creating the registry
  const validation = validateRegistry(defs)
  if (!validation.valid) {
    const errors = validation.errors.join('; ')
    throw new Error(`Invalid stage registry: ${errors}`)
  }

  // Build a map for fast lookup
  const map = new Map<StageKey, StageDefinition>()
  for (const def of defs) {
    map.set(def.key, def)
  }

  return {
    get: (key: StageKey) => map.get(key),
    all: () => [...defs],
    resolveOrder: (requested: StageKey[]) => resolveOrder(defs, requested),
  }
}

/**
 * Validate a set of stage definitions for common errors.
 *
 * Checks for:
 * - Duplicate keys
 * - References to unregistered stages in 'requires'
 * - Circular dependencies
 *
 * @param defs Array of stage definitions
 * @returns { valid: boolean, errors: string[] }
 */
export function validateRegistry(defs: StageDefinition[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const keys = new Set<StageKey>()

  // Check for duplicate keys
  for (const def of defs) {
    if (keys.has(def.key)) {
      errors.push(`Duplicate stage key: ${def.key}`)
    }
    keys.add(def.key)
  }

  // Check for unknown dependencies
  for (const def of defs) {
    for (const dep of def.requires) {
      if (!keys.has(dep)) {
        errors.push(`Stage "${def.key}" requires unknown stage "${dep}"`)
      }
    }
  }

  // Check for circular dependencies
  const cycles = detectCycles(defs)
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      errors.push(`Circular dependency: ${cycle.join(' -> ')}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Resolve the execution order for a set of requested stages.
 *
 * Performs topological sort with transitive closure:
 * - Includes all transitive dependencies of requested stages
 * - Returns stages in dependency order (dependencies before dependents)
 * - Tie-breaks (stages with no ordering constraint) by registration order
 * - Throws descriptive error on cycle or unknown stage
 *
 * @param defs All stage definitions
 * @param requested The stages the caller wants to execute
 * @returns Array of stage keys in execution order
 * @throws If a cycle is detected or an unknown stage is requested
 */
export function resolveOrder(
  defs: StageDefinition[],
  requested: StageKey[],
): StageKey[] {
  // Build a map for fast lookup
  const map = new Map<StageKey, StageDefinition>()
  const regOrder = new Map<StageKey, number>()  // Registration order for tie-breaking
  for (let i = 0; i < defs.length; i++) {
    map.set(defs[i].key, defs[i])
    regOrder.set(defs[i].key, i)
  }

  // Check that all requested stages exist
  for (const key of requested) {
    if (!map.has(key)) {
      throw new Error(`Requested unknown stage: ${key}`)
    }
  }

  // Compute transitive closure: requested + all their (recursive) dependencies
  const closure = new Set<StageKey>()
  const stack = [...requested]
  const visited = new Set<StageKey>()

  while (stack.length > 0) {
    const key = stack.pop()!
    if (visited.has(key)) continue
    visited.add(key)

    closure.add(key)
    const def = map.get(key)!
    for (const dep of def.requires) {
      if (!visited.has(dep)) {
        stack.push(dep)
      }
    }
  }

  // Topological sort using Kahn's algorithm (iterative)
  const inDegree = new Map<StageKey, number>()
  const adjList = new Map<StageKey, StageKey[]>()

  // Initialize in-degree and adjacency for all closure stages
  for (const key of closure) {
    inDegree.set(key, 0)
    adjList.set(key, [])
  }

  // Build the graph (edges go from 'requires' to the stage)
  for (const key of closure) {
    const def = map.get(key)!
    for (const dep of def.requires) {
      if (closure.has(dep)) {
        // dep must run before key
        adjList.get(dep)!.push(key)
        inDegree.set(key, (inDegree.get(key) ?? 0) + 1)
      }
    }
  }

  // Start with stages that have no dependencies
  const queue: StageKey[] = []
  for (const key of closure) {
    if (inDegree.get(key) === 0) {
      queue.push(key)
    }
  }

  // Sort the initial queue by registration order for deterministic tie-breaking
  queue.sort((a, b) => (regOrder.get(a) ?? 0) - (regOrder.get(b) ?? 0))

  const result: StageKey[] = []

  while (queue.length > 0) {
    // Pick the stage with the lowest registration order (deterministic tie-breaking)
    const nextIdx = queue.reduce((minIdx, current, idx, arr) => {
      const curReg = regOrder.get(current) ?? 0
      const minReg = regOrder.get(arr[minIdx]) ?? 0
      return curReg < minReg ? idx : minIdx
    }, 0)

    const key = queue.splice(nextIdx, 1)[0]
    result.push(key)

    // Process neighbors
    for (const neighbor of adjList.get(key) ?? []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1)
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor)
      }
    }
  }

  // If result doesn't include all closure stages, there's a cycle
  // (should not happen if validateRegistry passed, but good defensive check)
  if (result.length !== closure.size) {
    const unvisited: StageKey[] = []
    for (const key of closure) {
      if (!result.includes(key)) {
        unvisited.push(key)
      }
    }
    throw new Error(`Unresolvable circular dependency among: ${unvisited.join(', ')}`)
  }

  return result
}

/**
 * Detect cycles in the stage dependency graph.
 *
 * Uses DFS with a recursion stack to find back edges.
 *
 * @param defs All stage definitions
 * @returns Array of cycles, each cycle represented as an array of stage keys
 */
function detectCycles(defs: StageDefinition[]): StageKey[][] {
  const map = new Map<StageKey, StageDefinition>()
  for (const def of defs) {
    map.set(def.key, def)
  }

  const visited = new Set<StageKey>()
  const recStack = new Set<StageKey>()
  const cycles: StageKey[][] = []

  function dfs(key: StageKey, path: StageKey[]): void {
    visited.add(key)
    recStack.add(key)
    path.push(key)

    const def = map.get(key)
    if (def) {
      for (const dep of def.requires) {
        if (!visited.has(dep)) {
          dfs(dep, [...path])
        } else if (recStack.has(dep)) {
          // Found a back edge: cycle detected
          const idx = path.indexOf(dep)
          if (idx >= 0) {
            cycles.push([...path.slice(idx), dep])
          }
        }
      }
    }

    recStack.delete(key)
  }

  for (const def of defs) {
    if (!visited.has(def.key)) {
      dfs(def.key, [])
    }
  }

  return cycles
}
