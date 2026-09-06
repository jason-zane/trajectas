import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { SectionForRunner } from '@/app/actions/assess'

const mocks = vi.hoisted(() => {
  type Row = {
    id: string; title: string; display_order: number; section_role: string;
    time_limit_seconds: number; response_format_id: string; item_ordering: string;
    response_formats: { type: string; config: Record<string, unknown> };
    assessment_section_items: { id: string; item_id: string; display_order: number;
      items: { id: string; stem: string; item_options: { id: string; label: string; value: number; display_order: number }[] } }[];
  }
  const state = {
    sections: [] as Row[], responses: [] as { item_id: string; response_value: number; response_data: Record<string, unknown> }[],
    opened: new Set<string>(), now: 100, loadDelay: 0, rpcDelay: 0,
    status: 'in_progress', rpcError: false,
  }
  const ids = {
    session: '10000000-0000-4000-8000-000000000001',
    assessment: '20000000-0000-4000-8000-000000000001',
    participant: '30000000-0000-4000-8000-000000000001',
    campaign: '40000000-0000-4000-8000-000000000001',
    sections: [1, 2, 3].map(n => `50000000-0000-4000-8000-00000000000${n}`),
    items: [1, 2, 3].map(n => `60000000-0000-4000-8000-00000000000${n}`),
    token: 'a'.repeat(64),
  }
  const timing = { startedAt: '2026-09-06T10:00:00.000Z', deadlineAt: '2026-09-06T10:00:10.000Z',
    serverNow: '2026-09-06T10:00:00.000Z', expired: false, finalised: false, graceSeconds: 2 }
  const rpc = vi.fn(async (_name: string, args: { p_section_id: string }) => {
    state.now += state.rpcDelay
    if (state.rpcError) return { data: null, error: { code: 'XX000' } }
    const section = state.sections.find(s => s.id === args.p_section_id)!
    if (section.section_role === 'scored' && state.sections.some(s => s.section_role === 'practice'
      && s.assessment_section_items.some(item => !state.responses.some(r => r.item_id === item.item_id)))) {
      return { data: { blocked: 'practice_incomplete' }, error: null }
    }
    state.opened.add(section.id)
    return { data: { ...timing, deadlineAt: section.section_role === 'practice' ? null : timing.deadlineAt }, error: null }
  })
  const from = vi.fn((table: string) => {
    const result = () => {
      switch (table) {
        case 'participant_sessions': return { id: ids.session, assessment_id: ids.assessment,
          campaign_id: ids.campaign, campaign_participant_id: ids.participant, status: state.status }
        case 'assessment_sections': return state.sections
        case 'participant_responses': return state.responses
        case 'campaign_participants': return { campaign_rater_id: null }
        case 'participant_section_states':
          state.now += state.loadDelay
          return [...state.opened].map(section_id => ({ section_id }))
        default: throw new Error(`Unexpected table ${table}`)
      }
    }
    const builder: Record<string, unknown> = {}
    for (const key of ['select', 'eq', 'single', 'maybeSingle', 'order']) builder[key] = () => builder
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: result(), error: null }).then(resolve)
    return builder
  })
  return { state, ids, timing, rpc, from, authorize: vi.fn(), validate: vi.fn(), forms: vi.fn(), log: vi.fn() }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }))
vi.mock('@/lib/auth/participant-runtime', async original => ({
  ...await original<typeof import('@/lib/auth/participant-runtime')>(),
  requireParticipantRuntimeSessionAccess: mocks.authorize,
}))
vi.mock('@/lib/dal/session-forms', () => ({ getOrCreateSectionForms: mocks.forms }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: mocks.log }))
vi.mock('@/lib/assess/session-proof', () => ({ createAssessSessionProof: () => 'issued-proof' }))
// Real getSessionState/startSectionTiming + page, with only external I/O mocked.
vi.mock('@/app/actions/assess', async original => ({
  ...await original<typeof import('@/app/actions/assess')>(), validateAccessToken: mocks.validate,
}))
vi.mock('@/app/actions/brand', () => ({ getCachedEffectiveBrand: async () => ({ name: 'Trajectas' }) }))
vi.mock('@/app/actions/experience', () => ({ getCachedEffectiveExperience: async () => ({}) }))
vi.mock('@/lib/experience/resolve', () => ({ getPageContent: () => ({}) }))
vi.mock('@/lib/experience/flow-router', () => ({ getPostSectionsUrl: () => '/complete' }))
vi.mock('@/components/assess/section-wrapper', () => ({ SectionWrapper: () => null }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } }))

import SectionPage from '@/app/assess/[token]/section/[sectionIndex]/page'
import { getSessionState } from '@/app/actions/assess'

const page = (index: number | string) => SectionPage({ params: Promise.resolve({ token: mocks.ids.token, sectionIndex: String(index) }) })
function runnerSection(tree: Awaited<ReturnType<typeof SectionPage>>) {
  return (tree as ReactElement<{ children: ReactElement<{ section: SectionForRunner }> }>).props.children.props.section
}

describe('selected section opening and page timing reuse', () => {
  beforeEach(() => {
    mocks.state.opened.clear(); mocks.state.responses = []; mocks.state.now = 100
    mocks.state.loadDelay = 0; mocks.state.rpcDelay = 0; mocks.state.status = 'in_progress'; mocks.state.rpcError = false
    mocks.state.sections = mocks.ids.sections.map((id, index) => ({
      id, title: `Section ${index}`, display_order: index, section_role: 'scored', time_limit_seconds: 10,
      response_format_id: 'format', item_ordering: 'fixed', response_formats: { type: 'likert', config: {} },
      assessment_section_items: [{ id: `link-${index}`, item_id: mocks.ids.items[index], display_order: 0,
        items: { id: mocks.ids.items[index], stem: `Question ${index}`,
          item_options: [{ id: `option-${index}`, label: 'Yes', value: 1, display_order: 0 }] } }],
    }))
    mocks.authorize.mockResolvedValue(undefined)
    mocks.forms.mockImplementation(async () => new Map(mocks.state.sections.map(section => [section.id,
      { entries: section.assessment_section_items.map(item => ({ itemId: item.item_id })) }])))
    mocks.validate.mockResolvedValue({ data: { campaign: { id: mocks.ids.campaign }, participant: { id: mocks.ids.participant },
      assessments: [{ assessmentId: mocks.ids.assessment, title: 'Assessment' }],
      sessions: [{ id: mocks.ids.session, assessmentId: mocks.ids.assessment, status: 'in_progress' }] } })
    vi.spyOn(performance, 'now').mockImplementation(() => mocks.state.now)
  })

  it('renders from a single timing RPC and opens only the selected section', async () => {
    const section = runnerSection(await page(1))
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('start_section_for_session', {
      p_access_token: mocks.ids.token, p_session_id: mocks.ids.session, p_section_id: mocks.ids.sections[1],
    })
    expect([...mocks.state.opened]).toEqual([mocks.ids.sections[1]])
    expect(section).toMatchObject({ id: mocks.ids.sections[1], timing: mocks.timing })
    expect(mocks.authorize).toHaveBeenCalledWith(mocks.ids.token, mocks.ids.session)
  })

  it('keeps untouched timed sections hidden and makes a state-only read start no clocks', async () => {
    const before = await getSessionState(mocks.ids.token, mocks.ids.session)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(before.data?.sections.every(section => section.items[0].stem === '')).toBe(true)
    const selected = await getSessionState(mocks.ids.token, mocks.ids.session, 2)
    expect(selected.data?.sections.map(section => section.items[0].stem)).toEqual(['', '', 'Question 2'])
    expect(selected.data?.sectionStart).toMatchObject({ sectionId: mocks.ids.sections[2], timing: mocks.timing })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('returns a structured practice block and redirects without starting the scored section', async () => {
    mocks.state.sections[0].section_role = 'practice'
    const blocked = await getSessionState(mocks.ids.token, mocks.ids.session, 1)
    expect(blocked.data?.sectionStart).toEqual({ sectionId: mocks.ids.sections[1], blocked: 'practice_incomplete' })
    expect(blocked.data?.sections[0].items[0].stem).toBe('Question 0')
    expect(blocked.data?.sections[1].items[0].stem).toBe('')
    expect(mocks.state.opened.size).toBe(0)
    mocks.rpc.mockClear()
    await expect(page(1)).rejects.toThrow(`REDIRECT:/assess/${mocks.ids.token}/section/0`)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.state.opened.size).toBe(0)
  })

  it('opens practice without a deadline, then permits scored opening after practice is answered', async () => {
    mocks.state.sections[0].section_role = 'practice'
    expect(runnerSection(await page(0)).timing?.deadlineAt).toBeNull()
    expect([...mocks.state.opened]).toEqual([mocks.ids.sections[0]])
    mocks.state.responses.push({ item_id: mocks.ids.items[0], response_value: 1, response_data: {} })
    mocks.rpc.mockClear()
    expect(runnerSection(await page(1)).timing?.deadlineAt).toBe(mocks.timing.deadlineAt)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect([...mocks.state.opened]).toEqual([mocks.ids.sections[0], mocks.ids.sections[1]])
  })

  it('advances only the clock hint by post-RPC work and never extends a passed deadline', async () => {
    mocks.state.rpcDelay = 7000
    mocks.state.loadDelay = 12_000
    const result = await getSessionState(mocks.ids.token, mocks.ids.session, 0)
    expect(result.data?.sectionStart).toEqual({ sectionId: mocks.ids.sections[0], timing: {
      ...mocks.timing, serverNow: '2026-09-06T10:00:12.000Z', expired: true,
    } })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it.each([99, -1, 'not-a-number'])('renders the same clamped section it opened for index %s', async index => {
    const section = runnerSection(await page(index))
    expect([...mocks.state.opened]).toEqual([section.id])
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('does not start a clock on a completed session state read', async () => {
    mocks.state.status = 'completed'
    const result = await getSessionState(mocks.ids.token, mocks.ids.session, 0)
    expect(result.data?.status).toBe('completed')
    expect(result.data?.sectionStart).toBeUndefined()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('surfaces a failed start without trying a second RPC or rendering a runner', async () => {
    mocks.state.rpcError = true
    const result = await page(1)
    expect(result.type).toBe('div')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.state.opened.size).toBe(0)
    expect(mocks.log).toHaveBeenCalledWith('startSectionTiming.rpc', expect.objectContaining({ code: 'XX000' }))
  })

  it('uses delivered indices after skipping an empty section', async () => {
    mocks.state.sections[0].assessment_section_items = []
    const section = runnerSection(await page(0))
    expect(section.id).toBe(mocks.ids.sections[1])
    expect([...mocks.state.opened]).toEqual([section.id])
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('opens the rendered section when an earlier frozen form has no resolving join rows', async () => {
    mocks.forms.mockResolvedValue(new Map(mocks.ids.sections.map((id, index) => [id,
      { entries: [{ itemId: mocks.ids.items[index] }] }])))
    mocks.state.sections[0].assessment_section_items = []
    const section = runnerSection(await page(0))
    expect(section.id).toBe(mocks.ids.sections[1])
    expect([...mocks.state.opened]).toEqual([section.id])
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('starts no clock when all frozen entries have lost their join rows', async () => {
    mocks.forms.mockResolvedValue(new Map(mocks.ids.sections.map((id, index) => [id,
      { entries: [{ itemId: mocks.ids.items[index] }] }])))
    for (const section of mocks.state.sections) section.assessment_section_items = []
    await expect(page(0)).rejects.toThrow(`REDIRECT:/assess/${mocks.ids.token}/complete`)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.state.opened.size).toBe(0)
  })

  it('does not query or open a session when participant authorization rejects it', async () => {
    mocks.authorize.mockRejectedValueOnce(new Error('denied'))
    await expect(getSessionState(mocks.ids.token, mocks.ids.session, 0)).rejects.toThrow('denied')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

})
