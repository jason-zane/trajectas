import { beforeEach, describe, expect, it, vi } from 'vitest'
import { availabilityIssue, type ManagedCapability } from '@/lib/library/model-management'
const state = vi.hoisted(() => ({ admin: true, global: true, results: [] as unknown[], queries: [] as string[] }))
vi.mock('@/lib/auth/authorization', () => ({ requireAdminScope: async () => ({ isPlatformAdmin: state.admin }), isUnconfinedPlatformAdmin: () => state.global }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from(table: string) {
  state.queries.push(table)
  const result = state.results.shift()
  const chain = { select: () => chain, eq: () => chain, neq: () => chain, is: () => chain, in: () => chain, order: () => chain, then: (resolve: (value: unknown) => void) => resolve(result) }
  return chain
} }) }))
import { assessmentSelectionIssue, getManagedCapabilities } from '@/lib/dal/model-management'
const row: ManagedCapability = { id: 'a', slug: 'a', name: 'A', category: 'Thinking', definition: 'A definition', readiness: 'assessment_ready', active: true, matching: true, assessment: true, public: false }
beforeEach(() => { state.admin = true; state.global = true; state.results = []; state.queries = [] })
describe('independent availability', () => {
  it('allows public explanation of a draft, but not new assessment or matching use', () => {
    const draft = { ...row, readiness: 'draft' }
    expect(availabilityIssue(draft, 'public')).toBeNull()
    expect(availabilityIssue(draft, 'matching')).toContain('readiness')
    expect(availabilityIssue(draft, 'assessment')).toContain('readiness')
  })
  it('requires an active capability, public definition and grouping', () => {
    expect(availabilityIssue({ ...row, active: false }, 'public')).toContain('Activate')
    expect(availabilityIssue({ ...row, definition: '' }, 'public')).toContain('definition')
    expect(availabilityIssue({ ...row, category: 'Uncategorised' }, 'public')).toContain('category')
  })
  it('rejects tenant-confined administrators before reading the library', async () => {
    state.global = false
    await expect(getManagedCapabilities()).rejects.toThrow('platform workspace')
    expect(state.queries).toEqual([])
  })
  it('rejects nonadministrators', async () => {
    state.admin = false
    await expect(getManagedCapabilities()).rejects.toThrow('platform workspace')
  })
  it('preserves existing selections even when their channel is disabled', async () => {
    state.results = [{ data: [{ factor_id: 'existing' }], error: null }]
    expect(await assessmentSelectionIssue(['existing'], 'assessment')).toBeNull()
    expect(state.queries).toEqual(['assessment_factors'])
  })
  it('rejects newly selected unavailable capabilities', async () => {
    state.results = [{ data: [], error: null }]
    expect(await assessmentSelectionIssue(['disabled'])).toContain('unavailable')
  })
  it('allows newly selected available capabilities', async () => {
    state.results = [{ data: [{ id: 'enabled' }], error: null }]
    expect(await assessmentSelectionIssue(['enabled'])).toBeNull()
  })
  it('fails closed when existing selections cannot be checked', async () => {
    state.results = [{ data: null, error: new Error('offline') }]
    expect(await assessmentSelectionIssue(['a'], 'assessment')).toContain('Unable to check')
  })
})
