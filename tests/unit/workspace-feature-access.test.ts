import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
const config = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: config.load }))
import { requireAnyInsightFeature, requireInsightExperience, requireWorkspaceFeature } from '@/lib/features/access'
import { getComparisonMatrix, getEligibleAssessmentsForParticipants } from '@/app/actions/comparison'
import { getComparisonCanvas } from '@/app/actions/canvas'
import { listSavedComparisons } from '@/app/actions/saved-comparisons'
import { getTrajectoryLandingData } from '@/app/actions/trajectory'
beforeEach(() => {
  config.load.mockResolvedValue(defaultWorkspaceFeatures('partner'))
})
describe('insight server operation gates', () => {
  it('disables Compare without disabling individual or unified trajectory', async () => {
    config.load.mockResolvedValue({ ...defaultWorkspaceFeatures('partner'), compare: false })
    await expect(requireWorkspaceFeature('compare')).rejects.toThrow('not enabled')
    await expect(requireInsightExperience('individual')).resolves.toBe('individual')
    await expect(requireInsightExperience('unified')).resolves.toBe('unified')
    await expect(requireAnyInsightFeature()).resolves.toBeUndefined()
    await expect(listSavedComparisons()).rejects.toThrow('not enabled')
    await expect(getEligibleAssessmentsForParticipants([])).rejects.toThrow('not enabled')
    await expect(getComparisonMatrix({ entries: [], assessmentIds: [], visibleLevels: [] })).rejects.toThrow('not enabled')
  })
  it('permits Unified Trajectory when individual Trajectory is disabled', async () => {
    config.load.mockResolvedValue({ ...defaultWorkspaceFeatures('partner'), trajectory: false })
    await expect(requireInsightExperience('unified')).resolves.toBe('unified')
    await expect(getTrajectoryLandingData()).rejects.toThrow('not enabled')
    await expect(getComparisonCanvas([], 'individual')).rejects.toThrow('not enabled')
  })
  it('blocks direct canvas calls before participant or score queries', async () => {
    config.load.mockResolvedValue({ ...defaultWorkspaceFeatures('partner'), unifiedTrajectory: false })
    await expect(getComparisonCanvas([], 'unified')).rejects.toThrow('not enabled')
  })
  it('rejects forged experience input and fails closed on database errors', async () => {
    await expect(requireInsightExperience('admin' as never)).rejects.toThrow()
    config.load.mockRejectedValue(new Error('Unable to load workspace features.'))
    const failure = await requireWorkspaceFeature('compare').then(() => null, error => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure.message).toBe('Unable to load workspace features.')
  })
  it('blocks the shared picker when no insight is enabled', async () => {
    config.load.mockResolvedValue({ compare: false, trajectory: false, unifiedTrajectory: false, dashboardStyle: 'default' })
    await expect(requireAnyInsightFeature()).rejects.toThrow('not enabled')
  })
})
