import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isLocalSupabase = /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)
const canRun = isLocalSupabase && !!process.env.SUPABASE_SERVICE_ROLE_KEY
const ids = [randomUUID(), randomUUID()]
describe.skipIf(!canRun)('capability channel controls against local Supabase', () => {
  const db = () => createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}})
  beforeAll(async () => {
    const {error} = await db().from('factors').insert(ids.map((id,i) => ({id,slug:`test-channel-${id}`,name:`Channel fixture ${i}`,readiness:i?'draft':'assessment_ready',is_active:true,is_match_eligible:true,definition:'Test only'})))
    if(error) throw error
  })
  afterAll(async () => { await db().from('factors').delete().in('id',ids) })
  it('preserves independent channels', async () => {
    const {error} = await db().rpc('set_capability_channel',{p_ids:[ids[0]],p_channel:'assessment',p_enabled:false})
    expect(error).toBeNull()
    const {data} = await db().from('factors').select('is_match_eligible,is_assessment_eligible,is_public_visible').eq('id',ids[0]).single()
    expect(data).toEqual({is_match_eligible:true,is_assessment_eligible:false,is_public_visible:false})
  })
  it('rejects a mixed-readiness batch atomically', async () => {
    const {error} = await db().rpc('set_capability_channel',{p_ids:ids,p_channel:'assessment',p_enabled:true})
    expect(error).not.toBeNull()
    const {data} = await db().from('factors').select('is_assessment_eligible').eq('id',ids[0]).single()
    expect(data?.is_assessment_eligible).toBe(false)
  })
  it('requires category and definition for public publication', async () => {
    expect((await db().rpc('set_capability_channel',{p_ids:[ids[0]],p_channel:'public',p_enabled:true})).error).not.toBeNull()
  })
  it('denies anonymous RPC execution', async () => {
    const anon = createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}})
    expect((await anon.rpc('set_capability_channel',{p_ids:[ids[0]],p_channel:'matching',p_enabled:false})).error).not.toBeNull()
  })
})
