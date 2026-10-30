import type { ReferenceOption } from '@/lib/norms/types'

export function referenceOption(overrides: Partial<ReferenceOption> = {}): ReferenceOption {
  return {
    id: 'australia-active', name: 'Australia, ages 18–64', version: 'preview-v2', groupKey: 'country-australia',
    instrumentId: 'ipip-neo-120-johnson-2014', formVersion: 'form-v1', scoringVersion: 'raw-v1',
    methodVersion: 'weighted-empirical-midrank-v1', family: 'country-adult', status: 'active',
    rawN: 1200, effectiveN: 1200, ageBoundsInclusive: [18, 64], countryLabels: ['Australia'], weighting: 'pooled',
    isDefault: false, scopeClientId: null, reviewEvidence: {}, assessments: [{ id: 'assessment', title: 'Trajectas Personality Profile', isDefault: false }], ...overrides,
  }
}
