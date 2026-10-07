import { describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({features:vi.fn(),database:vi.fn()}))
vi.mock('@/lib/dal/workspace-features',()=>({getEffectiveWorkspaceFeatures:state.features}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:state.database}))
import { createCampaign } from '@/app/actions/campaigns'
import { createAssessment } from '@/app/actions/assessments'
import { PUBLIC_BUILDS_SYSTEM_SCOPE } from '@/lib/public-builds/constants'
import { DISABLED_WORKSPACE_FEATURES } from '@/lib/features/workspace-features'
describe('the existing public Role Builder is independent of portal feature switches',()=>{
 it.each([createCampaign,createAssessment])('retains fixed internal system validation without portal licensing',async operation=>{
  state.features.mockResolvedValue(DISABLED_WORKSPACE_FEATURES)
  // Invalid content is still rejected. This test verifies the licensing boundary before the existing validation path.
  expect(await operation({}, {systemScope:PUBLIC_BUILDS_SYSTEM_SCOPE})).toHaveProperty('error')
  expect(state.features).not.toHaveBeenCalled();expect(state.database).not.toHaveBeenCalled()
 })
 it.each([createCampaign,createAssessment])('does not treat a request-derived scope copy as the internal public workflow',async operation=>{
  state.features.mockResolvedValue(DISABLED_WORKSPACE_FEATURES)
  await expect(operation({}, {systemScope:{...PUBLIC_BUILDS_SYSTEM_SCOPE}})).rejects.toThrow('not enabled')
  expect(state.database).not.toHaveBeenCalled()
 })
})
