import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defaultWorkspaceFeatures, FEATURE_DEPENDENCIES, WORKSPACE_FEATURE_KEYS } from '@/lib/features/workspace-features'
const sql = readFileSync('supabase/migrations/20261007074000_workspace_delivery_features.sql', 'utf8')
const json = [...sql.matchAll(/'([^']+)'::jsonb/g)].map(match => JSON.parse(match[1]) as unknown)
describe('SQL and application feature contracts (source consistency, not database replay)', () => {
  it('keeps every SQL legacy default aligned with the application catalogue', () => {
    const defaults = json.filter(value => value && typeof value === 'object' && 'dashboardStyle' in value)
    expect(defaults).toHaveLength(3)
    for (const config of defaults) expect(config).toEqual(defaultWorkspaceFeatures('partner'))
    expect(json).toContainEqual(WORKSPACE_FEATURE_KEYS)
    expect(sql).toContain(`<> ${WORKSPACE_FEATURE_KEYS.length + 1}`)
  })
  it('keeps dependency validation aligned, including library consequences and transitive publishing', () => {
    expect(json.find(value => value && typeof value === 'object' && 'assessmentPublishing' in value && Array.isArray(value.assessmentPublishing))).toEqual(FEATURE_DEPENDENCIES)
  })
})
