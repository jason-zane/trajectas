import { ALL_LEVELS, type ColumnLevel, type EntryRequest } from './types'

const LEVEL_SET = new Set<ColumnLevel>(ALL_LEVELS)

export function decodeEntriesParam(s: string | null | undefined): EntryRequest[] {
  if (!s) return []
  try {
    return JSON.parse(decodeURIComponent(s)) as EntryRequest[]
  } catch {
    return []
  }
}

export function decodeLevelsParam(s: string | null | undefined): ColumnLevel[] {
  if (!s) return [...ALL_LEVELS]
  const parsed = s
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is ColumnLevel => (LEVEL_SET as Set<string>).has(p))
  // Default to all three when nothing valid is present, so the UI never
  // collapses to an empty matrix purely because of a malformed URL.
  return parsed.length > 0 ? parsed : [...ALL_LEVELS]
}
