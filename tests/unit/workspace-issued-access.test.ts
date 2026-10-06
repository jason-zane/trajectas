import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DISABLED_WORKSPACE_FEATURES } from '@/lib/features/workspace-features'
const state=vi.hoisted(()=>({features:vi.fn(),insert:vi.fn(),rpc:vi.fn(),active:true,participantStatus:'in_progress'}))
vi.mock('@/lib/dal/workspace-features',()=>({getEffectiveWorkspaceFeatures:state.features}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:state.rpc,from:(table:string)=>{
 const query:Record<string,unknown>={}
 for(const method of ['select','eq','is','order'])query[method]=()=>query
 query.insert=(record:unknown)=>{state.insert(table,record);return query}
 const result=()=>({data:table==='campaign_access_links'?{id:'synthetic-link',campaign_id:'synthetic-campaign',is_active:true,max_uses:null,use_count:0,expires_at:null}:table==='campaigns'?{id:'synthetic-campaign',title:'Synthetic campaign',status:state.active?'active':'paused',client_id:null}:table==='campaign_participants'?{id:'synthetic-participant',access_token:'e'.repeat(64),campaign_id:'synthetic-campaign',email:'synthetic@test.local',status:state.participantStatus}:[],error:null})
 query.single=async()=>result();query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)
 return query
}})}))
import { registerViaLink, validateAccessToken } from '@/app/actions/assess'
const participant={email:'synthetic@test.local',firstName:'Synthetic',lastName:'Participant'}
beforeEach(()=>{vi.clearAllMocks();state.features.mockResolvedValue(DISABLED_WORKSPACE_FEATURES);state.rpc.mockResolvedValue({data:true,error:null});state.active=true;state.participantStatus='in_progress'})
describe('previously issued participant access continues independently of portal features',()=>{
 it('preserves valid issued self-enrollment links when new portal delivery is disabled',async()=>{
  expect(await registerViaLink('synthetic-link',participant)).toEqual({accessToken:'e'.repeat(64)})
  expect(state.features).not.toHaveBeenCalled()
  expect(state.insert).toHaveBeenCalledExactlyOnceWith('campaign_participants',expect.objectContaining({campaign_id:'synthetic-campaign',status:'registered'}))
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith('increment_access_link_usage',{p_link_id:'synthetic-link'})
 })
 it('preserves enrolled token validation without introducing a workspace actor or menu gate',async()=>{
  expect(await validateAccessToken('e'.repeat(64))).toMatchObject({data:{participant:{id:'synthetic-participant',status:'in_progress'},campaign:{id:'synthetic-campaign'}}})
  expect(state.features).not.toHaveBeenCalled();expect(state.insert).not.toHaveBeenCalled()
 })
 it('retains campaign pause and participant withdrawal checks',async()=>{
  state.active=false
  expect(await registerViaLink('synthetic-link',participant)).toHaveProperty('error')
  expect(state.insert).not.toHaveBeenCalled()
  state.active=true;state.participantStatus='withdrawn'
  expect(await validateAccessToken('e'.repeat(64))).toHaveProperty('error')
  expect(state.features).not.toHaveBeenCalled()
 })
})
