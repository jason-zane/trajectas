import { describe, expect, it } from 'vitest'
import { defaultWorkspaceFeatures, intersectWorkspaceFeatures, featureForInsightPath, EXPERIENCE_FEATURE } from '@/lib/features/workspace-features'
import { featureSettingSchema, insightExperienceSchema } from '@/lib/validations/workspace-features'
describe('independent workspace capabilities', () => {
  it.each(Array.from({ length: 8 }, (_, mask) => mask))('preserves all three independent choices in combination %i', mask => {
    const config = { ...defaultWorkspaceFeatures('partner'), compare: !!(mask & 1), trajectory: !!(mask & 2), unifiedTrajectory: !!(mask & 4) }
    expect(intersectWorkspaceFeatures([config])).toEqual(config)
    expect(EXPERIENCE_FEATURE).toEqual({ compare: 'compare', individual: 'trajectory', unified: 'unifiedTrajectory' })
  })
  it('keeps existing portal defaults and denies an empty aggregate', () => {
    expect(defaultWorkspaceFeatures('partner').unifiedTrajectory).toBe(true)
    expect(defaultWorkspaceFeatures('client').unifiedTrajectory).toBe(false)
    expect(intersectWorkspaceFeatures([])).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: false })
  })
  it('does not let a second organisation unlock a disabled feature', () => {
    const a = { ...defaultWorkspaceFeatures('partner'), compare: false }
    const b = { ...defaultWorkspaceFeatures('partner'), trajectory: false }
    expect(intersectWorkspaceFeatures([a, b])).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: true })
  })
  it.each([
    ['/participants/compare', 'compare'], ['/partner/participants/trajectory', 'trajectory'],
    ['/participants/unified', 'unifiedTrajectory'], ['/client/campaigns/123/compare', 'compare'],
    ['/participants', null], ['/assessments', null],
  ])('maps only the intended navigation path %s', (path, expected) => expect(featureForInsightPath(path)).toBe(expected))
  it('rejects unknown switches, non-boolean values and invalid experience names', () => {
    expect(featureSettingSchema.safeParse({ key: 'isPlatformAdmin', value: true }).success).toBe(false)
    expect(featureSettingSchema.safeParse({ key: 'compare', value: 'true' }).success).toBe(false)
    expect(featureSettingSchema.safeParse({ key: 'compare', value: true, clientId: 'other' }).success).toBe(false)
    expect(insightExperienceSchema.safeParse('admin').success).toBe(false)
  })
})
