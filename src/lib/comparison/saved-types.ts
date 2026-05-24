import type { ColumnLevel, EntryRequest } from './types'

export type ShareScope = 'private' | 'team'

export type SavedComparison = {
  id: string
  ownerId: string
  name: string
  entries: EntryRequest[]
  assessmentIds: string[]
  visibleLevels: ColumnLevel[]
  deltaMode: boolean
  shareScope: ShareScope
  clientId: string | null
  partnerId: string | null
  createdAt: string
  updatedAt: string
}

export type SavedComparisonSummary = Pick<
  SavedComparison,
  'id' | 'name' | 'shareScope' | 'updatedAt' | 'createdAt' | 'ownerId'
> & {
  entryCount: number
  assessmentCount: number
  isOwn: boolean
}
