import {beforeEach,describe,expect,it,vi} from 'vitest'
import type {AuthorizedScope} from '@/lib/auth/authorization'
const state=vi.hoisted(()=>({resolve:vi.fn(),open:vi.fn()}))
vi.mock('@/lib/auth/authorization',async original=>({...await original<typeof import('@/lib/auth/authorization')>(),resolveAuthorizedScope:state.resolve}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:state.open}))
import {AuthorizationError} from '@/lib/auth/authorization'
import {createRetentionPolicyDraft,requirePrivacyAdmin} from '@/lib/dal/privacy'

function scope(overrides:Partial<AuthorizedScope>={}):AuthorizedScope {
  return {actor:{id:'11111111-1111-4111-8111-111111111111',email:'synthetic-admin@example.invalid',role:'platform_admin',isActive:true,partnerMemberships:[],clientMemberships:[],activeContext:null},activeContext:null,previewContext:null,requestSurface:'admin',isPlatformAdmin:true,isLocalDevelopmentBypass:false,partnerIds:[],partnerAdminIds:[],clientIds:[],clientAdminIds:[],managedClientIds:[],isLocalDevelopment:false,supportSession:null,...overrides}
}
beforeEach(()=>{vi.clearAllMocks()})
describe('privacy operator authority',()=>{
  it('admits an authenticated unconfined platform administrator',async()=>{
    const allowed=scope();state.resolve.mockResolvedValue(allowed)
    expect(await requirePrivacyAdmin()).toBe(allowed)
    expect(state.open).not.toHaveBeenCalled()
  })
  it.each([
    ['tenant member',()=>scope({isPlatformAdmin:false})],
    ['client workspace',()=>scope({activeContext:{surface:'admin',tenantType:'client',tenantId:'22222222-2222-4222-8222-222222222222'}})],
    ['role preview',()=>scope({previewContext:{surface:'client',tenantType:'client',tenantId:'22222222-2222-4222-8222-222222222222'}})],
    ['support session',()=>scope({supportSession:{targetTenantId:'22222222-2222-4222-8222-222222222222'} as AuthorizedScope['supportSession']})],
    ['anonymous local bypass',()=>scope({actor:null,isLocalDevelopment:true,isLocalDevelopmentBypass:true})],
  ] as const)('does not open a privileged client for %s',async(label,makeScope)=>{
    state.resolve.mockResolvedValue(makeScope())
    await expect(createRetentionPolicyDraft({})).rejects.toBeInstanceOf(AuthorizationError)
    expect(state.open,label).not.toHaveBeenCalled()
  })
})
