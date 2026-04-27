import { ALL_LEVELS, type ColumnLevel, type EntryRequest } from './types'

const LEVEL_SET = new Set<ColumnLevel>(ALL_LEVELS)

/**
 * The level set we show when no `levels` query param is provided. Constructs
 * are off by default — they're a granular sub-level that's usually too noisy
 * for the first look. The user can toggle them on from the selection bar.
 */
export const DEFAULT_VISIBLE_LEVELS: readonly ColumnLevel[] = ['dimension', 'factor'] as const

export function decodeEntriesParam(s: string | null | undefined): EntryRequest[] {
  if (!s) return []
  try {
    return JSON.parse(decodeURIComponent(s)) as EntryRequest[]
  } catch {
    return []
  }
}

export function decodeLevelsParam(s: string | null | undefined): ColumnLevel[] {
  if (!s) return [...DEFAULT_VISIBLE_LEVELS]
  const parsed = s
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is ColumnLevel => (LEVEL_SET as Set<string>).has(p))
  return parsed.length > 0 ? parsed : [...DEFAULT_VISIBLE_LEVELS]
}
