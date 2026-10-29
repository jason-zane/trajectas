import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IPIP_DATABASE, assertIpipDatabaseEntries, assertIpipDatabaseForms } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_FORM_VERSION, IPIP_ITEMS, IPIP_ITEMSET_SHA256 } from '@/lib/instrument/ipip-neo-120/definition'
import { scoreIpipNeo120Session } from '@/lib/dal/ipip-neo-120'
import type { SectionFormDTO } from '@/lib/dal/session-forms'

const { getForms } = vi.hoisted(() => ({ getForms: vi.fn() }))
vi.mock('@/lib/dal/session-forms', () => ({ getOrCreateSectionForms: getForms }))

function canonicalForms(): Map<string, SectionFormDTO> {
  return new Map([[IPIP_DATABASE.sectionId, {
    sessionId: 'session', sectionId: IPIP_DATABASE.sectionId, assembledAt: '', assemblySeed: '', assemblerVersion: '',
    formCode: IPIP_FORM_VERSION,
    entries: IPIP_ITEMS.map((item,index) => ({ position: index + 1, itemId: IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items],
      itemVersion: 1, contentHash: IPIP_ITEMSET_SHA256, purpose: 'construct', countsTowardScore: true })),
  }]])
}
function database(options: { assessmentId?: string; status?: string; missing?: boolean; invalid?: boolean; persistenceError?: string } = {}) {
  const responses = IPIP_ITEMS.map(item => ({ item_id: IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items],
    section_id: IPIP_DATABASE.sectionId, response_value: options.invalid ? 6 : 3 }))
  if (options.missing) responses.pop()
  const rpc = vi.fn(async () => ({ error: options.persistenceError ? { message: options.persistenceError } : null }))
  const from = vi.fn((table: string) => {
    const value = { data: table === 'participant_sessions'
      ? { assessment_id: options.assessmentId ?? IPIP_DATABASE.assessmentId, campaign_id: null, status: options.status ?? 'completed' }
      : responses, error: null }
    const query = { select: () => query, eq: () => query, single: async () => value,
      then: (resolve: (result: typeof value) => unknown) => Promise.resolve(value).then(resolve) }
    return query
  })
  return { db: { from, rpc } as unknown as SupabaseClient, rpc }
}

beforeEach(() => { getForms.mockReset(); getForms.mockResolvedValue(canonicalForms()) })

describe('native IPIP frozen delivery and scoring adapter', () => {
  it('accepts only the exact complete ordered frozen form', () => {
    expect(() => assertIpipDatabaseForms(canonicalForms())).not.toThrow()
    const entries = canonicalForms().get(IPIP_DATABASE.sectionId)!.entries
    expect(() => assertIpipDatabaseEntries(entries.slice(1))).toThrow('120')
    expect(() => assertIpipDatabaseEntries([...entries].reverse())).toThrow('canonical')
    expect(() => assertIpipDatabaseEntries(entries.map((e,i) => i === 0 ? { ...e, itemVersion: 2 } : e))).toThrow('canonical')
    expect(() => assertIpipDatabaseEntries(entries.map((e,i) => i === 0 ? { ...e, countsTowardScore: false } : e))).toThrow('canonical')
  })
  it('persists native totals, reversed presentation and no overall or norm claims atomically', async () => {
    const { db, rpc } = database()
    expect(await scoreIpipNeo120Session(db, 'session')).toEqual({ success: true, scoreCount: 30 })
    const call = rpc.mock.calls[0] as unknown as [string, { p_result: { facets: Record<string, { native: {rawSum:number}; display:{pomp:number} }>; dimensions:Record<string, {native:{rawSum:number}}>;overallScore:null;normReference:null } }]
    expect(call[0]).toBe('persist_ipip_neo_120_result')
    expect(call[1].p_result.facets.N4.native.rawSum).toBe(12)
    expect(call[1].p_result.facets.N4.display.pomp).toBe(50)
    expect(call[1].p_result.dimensions.N.native.rawSum).toBe(72)
    expect(call[1].p_result.overallScore).toBeNull()
    expect(call[1].p_result.normReference).toBeNull()
  })
  it.each([{ assessmentId: 'another-assessment' }, { status: 'in_progress' }, { missing: true }, { invalid: true }])('rejects invalid state or incomplete answers before persistence: %j', async options => {
    const { db, rpc } = database(options)
    expect(await scoreIpipNeo120Session(db, 'session')).toHaveProperty('error')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('fails closed on frozen drift', async () => {
    const forms = canonicalForms(); forms.get(IPIP_DATABASE.sectionId)!.entries[0].contentHash = 'changed'
    getForms.mockResolvedValue(forms)
    const { db, rpc } = database()
    expect(await scoreIpipNeo120Session(db,'session')).toHaveProperty('error')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('returns a persistence failure rather than reporting successful scoring', async () => {
    const { db } = database({ persistenceError: 'write refused' })
    expect(await scoreIpipNeo120Session(db,'session')).toEqual({ error: 'write refused' })
  })
})
