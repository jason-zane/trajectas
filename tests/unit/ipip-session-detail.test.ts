import { beforeEach, expect, it, vi } from 'vitest'
import { IPIP_DATABASE } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { scoreIpipNeo120 } from '@/lib/scoring/ipip-neo-120'
const mocks=vi.hoisted(()=>({result:vi.fn(),scope:vi.fn(),access:vi.fn(),admin:vi.fn(),viewer:vi.fn()}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/dal/ipip-neo-120',()=>({getAuthorizedIpipNeo120Result:mocks.result}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.admin}))
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.viewer}))
vi.mock('@/lib/auth/authorization',()=>({resolveAuthorizedScope:mocks.scope,requireSessionAccess:mocks.access,
  isUnconfinedPlatformAdmin:()=>false,canManageCampaign:()=>false,AuthorizationError:class extends Error{}}))
import { getSessionDetail } from '@/app/actions/sessions'
const sessionId='11111111-1111-4111-a111-111111111111'
function client() {
  return {from:(table:string)=>{
    const single=table==='participant_sessions'?{id:sessionId,assessment_id:IPIP_DATABASE.assessmentId,status:'completed',processing_status:'ready',composite_score:88,campaign_participant_id:'participant'}
      :table==='assessments'?{id:IPIP_DATABASE.assessmentId,title:'IPIP-NEO-120'}:null
    const query={select:()=>query,eq:()=>query,in:()=>query,order:()=>query,is:()=>query,
      maybeSingle:async()=>({data:single,error:null}),
      then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:[],error:null,count:120}).then(resolve)}
    return query
  }}
}
beforeEach(()=>{
  const scope={isPlatformAdmin:false,isLocalDevelopmentBypass:false}
  mocks.scope.mockResolvedValue(scope)
  mocks.access.mockResolvedValue({scope,confidentialityMode:'individual',partnerId:null,clientId:'client'})
  mocks.admin.mockReturnValue(client());mocks.viewer.mockResolvedValue(client())
  mocks.result.mockResolvedValue(scoreIpipNeo120(IPIP_ITEMS.map(item=>({itemId:item.itemId,value:1}))))
})
it('uses authorized score access even when report-preview access is absent, and preserves native domain aggregation',async()=>{
  const result=await getSessionDetail(sessionId)
  expect(mocks.result.mock.calls[0][0]).toBe(mocks.admin.mock.results[0].value)
  expect(result?.scores).toHaveLength(30)
  expect(result?.dimensionScores).toHaveLength(5)
  const native=mocks.result.mock.results[0].value
  const envelope=await native
  expect(result?.dimensionScores[0].scaledScore).toBe(envelope.dimensions.N.display.pomp)
  expect(result?.compositeScore).toBeUndefined()
})
it('does not fetch or return the native envelope when individual results are withheld',async()=>{
  mocks.access.mockResolvedValue({scope:{isPlatformAdmin:false},confidentialityMode:'aggregate_only'})
  const result=await getSessionDetail(sessionId)
  expect(mocks.result).not.toHaveBeenCalled()
  expect(result?.personalityResult).toBeNull()
  expect(result?.scores).toEqual([])
  expect(result?.dimensionScores).toEqual([])
  expect(result?.compositeScore).toBeUndefined()
})
