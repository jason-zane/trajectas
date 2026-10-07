import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
const state = vi.hoisted(()=>({features:{} as Record<string,unknown>,clientFeatures:{} as Record<string,unknown>,access:vi.fn(),rpc:vi.fn(),queries:[] as {table:string;select:unknown;filters:unknown[][];limit?:number}[],rows:[] as Record<string,unknown>[]}))
vi.mock('@/lib/dal/workspace-features',()=>({getEffectiveWorkspaceFeatures:async()=>state.features,getIntegrationClientFeatures:async()=>state.clientFeatures}))
vi.mock('@/lib/auth/authorization',async original=>({...await original<typeof import('@/lib/auth/authorization')>(),requireClientAccess:state.access}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:state.rpc,from:(table:string)=>{
 const query={table,select:null as unknown,filters:[] as unknown[][],limit:undefined as number|undefined};state.queries.push(query)
 const chain:Record<string,unknown>={};chain.select=(value:unknown)=>{query.select=value;return chain}
 for(const name of ['eq','is','lt'])chain[name]=(...values:unknown[])=>{query.filters.push([name,...values]);return chain}
 chain.order=()=>chain;chain.limit=(n:number)=>{query.limit=n;return chain};chain.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:state.rows,error:null}).then(resolve)
 return chain
}})}))
import { getWebhookBacklogReview, releaseReviewedWebhookBacklog } from '@/lib/dal/webhook-backlog'
const client='11111111-1111-4111-8111-111111111111', actor='22222222-2222-4222-8222-222222222222', event='33333333-3333-4333-8333-333333333333'
beforeEach(()=>{vi.clearAllMocks();state.features=defaultWorkspaceFeatures('partner');state.clientFeatures=defaultWorkspaceFeatures('client');state.queries=[];state.rows=[{id:event,event_type:'integration.launch.created',created_at:'2026-10-07',held_at:'2026-10-07',attempts:2,payload:{secret:'never expose'},signing_secret_ciphertext:'never expose'}];state.access.mockResolvedValue({clientId:client,scope:{isPlatformAdmin:false,managedClientIds:[client],actor:{id:actor}}});state.rpc.mockResolvedValue({data:1,error:null})})
describe('bounded client webhook backlog review',()=>{
 it('allows inspection while paused, returns metadata only and carries the tenant predicate',async()=>{
  state.clientFeatures.webhookDelivery=false
  const review=await getWebhookBacklogReview(client)
  expect(review.deliveryEnabled).toBe(false);expect(review.events).toEqual([{id:event,eventType:'integration.launch.created',createdAt:'2026-10-07',heldAt:'2026-10-07',attempts:2}])
  expect(state.queries[0]).toMatchObject({select:'id,event_type,created_at,held_at,attempts',limit:101})
  expect(state.queries[0].filters).toContainEqual(['eq','client_id',client])
  expect(state.rpc).not.toHaveBeenCalled()
 })
 it('releases only exact reviewed IDs through the atomic audited RPC',async()=>{
  expect(await releaseReviewedWebhookBacklog(client,[event])).toBe(1)
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith('release_reviewed_webhook_events',{p_client_id:client,p_actor:actor,p_ids:[event]})
 })
 it.each(['actor','client'] as const)('blocks release if %s delivery is disabled',async owner=>{
  if(owner==='actor')state.features.webhookDelivery=false;else state.clientFeatures.webhookDelivery=false
  await expect(releaseReviewedWebhookBacklog(client,[event])).rejects.toThrow(/enabled|Enable/)
  expect(state.rpc).not.toHaveBeenCalled()
 })
 it('rejects denied client access, forged batches and duplicate IDs before mutation',async()=>{
  state.access.mockRejectedValueOnce(new Error('Client not accessible'))
  await expect(getWebhookBacklogReview(client)).rejects.toThrow('Client not accessible')
  expect(state.queries).toEqual([])
  await expect(releaseReviewedWebhookBacklog(client,[event,event])).rejects.toThrow()
  await expect(releaseReviewedWebhookBacklog(client,[])).rejects.toThrow()
  expect(state.rpc).not.toHaveBeenCalled()
 })
 it('does not retry a changed or cross-client reviewed batch',async()=>{
  state.rpc.mockResolvedValue({data:null,error:{message:'Saved events changed. Refresh and review the new batch'}})
  await expect(releaseReviewedWebhookBacklog(client,[event])).rejects.toThrow('changed')
  expect(state.rpc).toHaveBeenCalledOnce()
 })
})
