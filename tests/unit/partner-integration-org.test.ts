import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'

const state = vi.hoisted(() => ({ scope:{} as AuthorizedScope, partner:vi.fn(), fallback:vi.fn(), feature:vi.fn(), owner:'' as string|null, error:false, filters:[] as unknown[][] }))
vi.mock('@/lib/auth/authorization', async original => ({ ...await original<typeof import('@/lib/auth/authorization')>(), resolveAuthorizedScope:async()=>state.scope, requirePartnerAccess:state.partner }))
vi.mock('@/lib/auth/resolve-partner-org', () => ({ resolvePartnerOrg:state.fallback }))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature:state.feature }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient:()=>({ from:()=>{
  const q={select:()=>q,eq:(...v:unknown[])=>{state.filters.push(['eq',...v]);return q},in:(...v:unknown[])=>{state.filters.push(['in',...v]);return q},is:(...v:unknown[])=>{state.filters.push(['is',...v]);return q},maybeSingle:async()=>({data:state.owner?{partner_id:state.owner}:null,error:state.error?{message:'synthetic unavailable'}:null})};return q
} }) }))
import { resolvePartnerIntegrationOrg } from '@/lib/dal/partner-integration-clients'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',client='33333333-3333-4333-8333-333333333333'
beforeEach(()=>{
  vi.resetAllMocks();state.filters=[];state.error=false;state.owner=b
  state.scope={partnerIds:[a,b],clientIds:[client],managedClientIds:[client],activeContext:{surface:'partner',tenantType:'client',tenantId:client},previewContext:null} as AuthorizedScope
  state.fallback.mockResolvedValue({partnerId:a})
})
describe('selected-client integration owner resolution',()=>{
  it('uses selected manageable client C’s current owner B for memberships [A,B]',async()=>{
    await expect(resolvePartnerIntegrationOrg('/partner/integrations')).resolves.toEqual({partnerId:b})
    expect(state.filters).toEqual([['eq','id',client],['in','id',[client]],['in','partner_id',[a,b]],['is','deleted_at',null]])
    expect(state.partner).toHaveBeenCalledExactlyOnceWith(b)
    expect(state.fallback).not.toHaveBeenCalled()
  })
  it.each([null,'foreign-partner'])('denies absent or foreign owner %s without unrelated partner fallback',async owner=>{
    state.owner=owner
    await expect(resolvePartnerIntegrationOrg('/partner/integrations/client')).rejects.toThrow('inaccessible')
    expect(state.partner).not.toHaveBeenCalled();expect(state.fallback).not.toHaveBeenCalled()
  })
  it.each(['clientIds','managedClientIds','partnerIds'] as const)('denies missing %s before ownership lookup',async key=>{
    state.scope[key]=[]
    await expect(resolvePartnerIntegrationOrg('/partner/integrations')).rejects.toThrow('inaccessible')
    expect(state.filters).toEqual([]);expect(state.fallback).not.toHaveBeenCalled()
  })
  it('fails closed on a DB error and on a disabled independent module',async()=>{
    state.error=true
    await expect(resolvePartnerIntegrationOrg('/partner/integrations')).rejects.toThrow('Unable to resolve')
    state.filters=[];state.feature.mockRejectedValue(new Error('Feature disabled'))
    await expect(resolvePartnerIntegrationOrg('/partner/integrations')).rejects.toThrow('Feature disabled')
    expect(state.filters).toEqual([]);expect(state.fallback).not.toHaveBeenCalled()
  })
  it('retains explicit partner selection through the existing resolver',async()=>{
    state.scope.activeContext={surface:'partner',tenantType:'partner',tenantId:b}
    state.fallback.mockResolvedValue({partnerId:b})
    await expect(resolvePartnerIntegrationOrg('/partner/integrations')).resolves.toEqual({partnerId:b})
    expect(state.fallback).toHaveBeenCalledWith('/partner/integrations')
    expect(state.filters).toEqual([])
  })
})
