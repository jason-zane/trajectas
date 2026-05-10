import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const auth = vi.hoisted(() => ({
  requireCampaignAccess: vi.fn(),
}))

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}))

// Chain-able Supabase query builder mock
const queryBuilder = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const chainMethods = [
    'select',
    'insert',
    'delete',
    'update',
    'eq',
    'in',
    'is',
    'or',
    'lte',
    'gte',
    'order',
    'limit',
    'single',
    'maybeSingle',
  ]
  for (const m of chainMethods) {
    builder[m] = vi.fn()
  }
  // Default: each chain method returns the builder itself
  for (const m of chainMethods) {
    builder[m].mockReturnValue(builder)
  }
  return builder
})

const supabase = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
  })),
  createClient: vi.fn(async () => ({
    from: vi.fn(() => queryBuilder),
  })),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/authorization', () => ({
  requireCampaignAccess: auth.requireCampaignAccess,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: supabase.createAdminClient,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: supabase.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: cache.revalidatePath,
}))

vi.mock('@/app/actions/item-selection-rules', () => ({
  getItemsPerConstructForCount: vi.fn(async (count: number) => {
    if (count <= 0) return null
    if (count <= 5) return 6
    return 4
  }),
}))

// ---------------------------------------------------------------------------
// Import actions under test (AFTER mocks)
// ---------------------------------------------------------------------------

import {
  getFactorSelectionForCampaignAssessment,
  saveFactorSelection,
  clearFactorSelection,
  getFactorSelectionEstimate,
} from '@/app/actions/factor-selection'

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  // Reset chain methods to return builder
  const chainMethods = [
    'select',
    'insert',
    'delete',
    'update',
    'eq',
    'in',
    'is',
    'or',
    'lte',
    'gte',
    'order',
    'limit',
    'single',
    'maybeSingle',
  ]
  for (const m of chainMethods) {
    queryBuilder[m].mockReturnValue(queryBuilder)
  }

  auth.requireCampaignAccess.mockResolvedValue({
    scope: { isPlatformAdmin: true },
    campaignId: 'cccc1111-1111-1111-1111-111111111111',
    clientId: null,
    partnerId: null,
  })
})

// =============================================================================
// getFactorSelectionForCampaignAssessment
// =============================================================================

describe('getFactorSelectionForCampaignAssessment', () => {
  it('returns isCustom: false when no rows exist', async () => {
    queryBuilder.eq.mockResolvedValueOnce({ data: [], error: null })

    const result = await getFactorSelectionForCampaignAssessment('aaaa1111-1111-1111-1111-111111111111')

    expect(result).toEqual({ isCustom: false, selectedFactorIds: [] })
  })

  it('returns isCustom: true with factor IDs when rows exist', async () => {
    queryBuilder.eq.mockResolvedValueOnce({
      data: [{ factor_id: 'ffff1111-1111-1111-1111-111111111111' }, { factor_id: 'ffff2222-2222-2222-2222-222222222222' }],
      error: null,
    })

    const result = await getFactorSelectionForCampaignAssessment('aaaa1111-1111-1111-1111-111111111111')

    expect(result).toEqual({
      isCustom: true,
      selectedFactorIds: ['ffff1111-1111-1111-1111-111111111111', 'ffff2222-2222-2222-2222-222222222222'],
    })
  })
})

// =============================================================================
// saveFactorSelection
// =============================================================================

describe('saveFactorSelection', () => {
  it('rejects when below minimum factor count', async () => {
    // campaign_assessments lookup
    queryBuilder.single.mockResolvedValueOnce({
      data: { campaign_id: 'cccc1111-1111-1111-1111-111111111111', assessment_id: 'aaab1111-1111-1111-1111-111111111111' },
      error: null,
    })

    // assessment lookup for min_custom_factors
    queryBuilder.single.mockResolvedValueOnce({
      data: { min_custom_factors: 3 },
      error: null,
    })

    await expect(saveFactorSelection('aaaa1111-1111-1111-1111-111111111111', ['ffff1111-1111-1111-1111-111111111111', 'ffff2222-2222-2222-2222-222222222222'])).rejects.toThrow(
      'At least 3 factors must be selected.',
    )
  })

  it('rejects when assessment does not support customisation', async () => {
    // campaign_assessments lookup
    queryBuilder.single.mockResolvedValueOnce({
      data: { campaign_id: 'cccc1111-1111-1111-1111-111111111111', assessment_id: 'aaab1111-1111-1111-1111-111111111111' },
      error: null,
    })

    // assessment lookup — no min_custom_factors
    queryBuilder.single.mockResolvedValueOnce({
      data: { min_custom_factors: null },
      error: null,
    })

    await expect(saveFactorSelection('aaaa1111-1111-1111-1111-111111111111', ['ffff1111-1111-1111-1111-111111111111'])).rejects.toThrow(
      'This assessment does not support factor customisation.',
    )
  })
})

// =============================================================================
// clearFactorSelection
// =============================================================================

describe('clearFactorSelection', () => {
  it('succeeds and returns success: true', async () => {
    // campaign_assessments lookup: .select().eq().single()
    queryBuilder.single.mockResolvedValueOnce({
      data: { campaign_id: 'cccc1111-1111-1111-1111-111111111111' },
      error: null,
    })

    // delete operation: .delete().eq() — need to skip the first eq (from select chain)
    // First eq call (select chain) returns builder (default), single resolves above.
    // Second eq call (delete chain) should resolve the delete result.
    queryBuilder.eq
      .mockReturnValueOnce(queryBuilder) // first .eq('id', ...) in select chain
      .mockResolvedValueOnce({ data: null, error: null }) // second .eq(...) in delete chain

    const result = await clearFactorSelection('aaaa1111-1111-1111-1111-111111111111')

    expect(result).toEqual({ success: true })
    expect(auth.requireCampaignAccess).toHaveBeenCalledWith('cccc1111-1111-1111-1111-111111111111')
    expect(cache.revalidatePath).toHaveBeenCalledWith('/campaigns')
  })
})

// =============================================================================
// getFactorSelectionEstimate
// =============================================================================

describe('getFactorSelectionEstimate', () => {
  it('computes estimate correctly for small construct count', async () => {
    const result = await getFactorSelectionEstimate(4)

    // 4 constructs -> itemsPerConstruct=6, estimatedItems=24, minutes=ceil(24*8/60)=ceil(3.2)=4
    expect(result).toEqual({
      itemsPerConstruct: 6,
      estimatedItems: 24,
      estimatedMinutes: 4,
    })
  })

  it('computes estimate correctly for large construct count', async () => {
    const result = await getFactorSelectionEstimate(10)

    // 10 constructs -> itemsPerConstruct=4, estimatedItems=40, minutes=ceil(40*8/60)=ceil(5.33)=6
    expect(result).toEqual({
      itemsPerConstruct: 4,
      estimatedItems: 40,
      estimatedMinutes: 6,
    })
  })
})
