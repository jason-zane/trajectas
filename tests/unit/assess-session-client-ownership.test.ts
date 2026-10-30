import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clientId: '50000000-0000-4000-8000-000000000001' as string | null,
  inserted: vi.fn(), updated: vi.fn(),
  existingClientId: undefined as string | null | undefined,
  ownerUpdateError: false, insertRace: false, sessionLookups: 0,
  events: [] as string[],
  filters: [] as [string, unknown][],
  signals: [] as AbortSignal[],
  participant: '10000000-0000-4000-8000-000000000001',
  campaign: '20000000-0000-4000-8000-000000000001',
  assessment: '30000000-0000-4000-8000-000000000001',
  session: '40000000-0000-4000-8000-000000000001',
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from(table: string) {
    let isInsert = false
    let hasSignal = false
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => { if (table === 'participant_sessions') mocks.filters.push([column, value]); return chain },
      is: (column: string, value: unknown) => { if (table === 'participant_sessions') mocks.filters.push([column, value]); return chain },
      update: (value: unknown) => {
        if (table === 'participant_sessions') { mocks.updated(value); mocks.events.push('owner-update') }
        return chain
      },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: mocks.ownerUpdateError ? { code: 'XX000' } : null }).then(resolve),
      in: (column: string, value: unknown) => { if (table === 'participant_sessions') mocks.filters.push([column, value]); return chain },
      abortSignal: (signal: AbortSignal) => { hasSignal = true; mocks.signals.push(signal); return chain },
      maybeSingle: () => chain.single(),
      insert: (value: unknown) => { isInsert = true; mocks.inserted(value); return chain },
      single: async () => {
        if (table === 'campaigns') mocks.events.push('owner-read')
        if (table === 'participant_sessions' && !isInsert) mocks.sessionLookups++
        const rows: Record<string, unknown> = {
          campaign_participants: { id: mocks.participant, campaign_id: mocks.campaign, status: 'invited' },
          campaigns: { id: mocks.campaign, client_id: mocks.clientId, status: 'active' },
          campaign_assessments: { id: 'attachment' },
          participant_sessions: isInsert ? { id: mocks.session } : mocks.insertRace && mocks.sessionLookups > 1 && hasSignal ? { id: mocks.session, client_id: null } : mocks.existingClientId === undefined ? null : { id: mocks.session, client_id: mocks.existingClientId },
        }
        return { data: isInsert && mocks.insertRace ? null : rows[table], error: isInsert && mocks.insertRace ? { code: '23505' } : null }
      },
    }
    return chain
  },
}) }))
vi.mock('@/lib/dal/public-builds', () => ({ markPublicBuildStarted: vi.fn() }))

import { startSession } from '@/app/actions/assess'

const token = 'a'.repeat(64)

beforeEach(() => { mocks.clientId = '50000000-0000-4000-8000-000000000001'; mocks.existingClientId = undefined; mocks.ownerUpdateError = false; mocks.insertRace = false; mocks.sessionLookups = 0; mocks.events = []; mocks.filters = []; mocks.signals = [] })

describe('token assessment session ownership', () => {
  it('inherits the verified campaign client so tenant members can read its results', async () => {
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ id: mocks.session })
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({
      campaign_participant_id: mocks.participant, campaign_id: mocks.campaign,
      client_id: mocks.clientId, assessment_id: mocks.assessment,
    }))
  })

  it('preserves clientless campaign sessions', async () => {
    mocks.clientId = null
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ id: mocks.session })
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ client_id: null }))
  })

  it('refuses a different campaign before creating a session', async () => {
    const result = await startSession(token, mocks.participant, mocks.assessment, '60000000-0000-4000-8000-000000000001')
    expect(result).toEqual({ error: 'This assessment does not belong to the active campaign.' })
    expect(mocks.inserted).not.toHaveBeenCalled()
  })
  it('restores a missing owner when resuming after reading the authorized campaign', async () => {
    mocks.existingClientId = null
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ id: mocks.session })
    expect(mocks.updated).toHaveBeenCalledWith({ client_id: mocks.clientId })
    expect(mocks.events).toEqual(['owner-read', 'owner-update'])
    expect(mocks.filters).toEqual(expect.arrayContaining([
      ['id', mocks.session], ['campaign_id', mocks.campaign], ['campaign_participant_id', mocks.participant], ['client_id', null],
    ]))
    expect(mocks.inserted).not.toHaveBeenCalled()
  })

  it('does not assign an owner to a resumed clientless session', async () => {
    mocks.clientId = null; mocks.existingClientId = null
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ id: mocks.session })
    expect(mocks.updated).not.toHaveBeenCalled()
  })

  it('never overwrites a non-null session owner on resume', async () => {
    mocks.existingClientId = '60000000-0000-4000-8000-000000000001'
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ id: mocks.session })
    expect(mocks.updated).not.toHaveBeenCalled()
  })

  it('reports a failed ownership repair instead of claiming the session resumed', async () => {
    mocks.existingClientId = null; mocks.ownerUpdateError = true
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ error: 'Unable to resume this assessment right now' })
  })

  it('heals a legacy session returned after a concurrent insert wins', async () => {
    mocks.insertRace = true
    expect(await startSession(token, mocks.participant, mocks.assessment, mocks.campaign)).toEqual({ id: mocks.session })
    expect(mocks.updated).toHaveBeenCalledWith({ client_id: mocks.clientId })
    expect(mocks.sessionLookups).toBe(2)
    expect(mocks.signals).toHaveLength(2)
    expect(mocks.signals[0]).not.toBe(mocks.signals[1])
    expect(mocks.filters).toEqual(expect.arrayContaining([['campaign_id', mocks.campaign], ['campaign_participant_id', mocks.participant], ['assessment_id', mocks.assessment], ['status', ['not_started', 'in_progress', 'completed']]]))
  })

})
