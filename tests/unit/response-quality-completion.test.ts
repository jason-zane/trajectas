import { beforeEach, expect, it, vi } from 'vitest'
import { PERSONALITY_PROFILE_ASSESSMENT_ID } from '@/lib/instrument/ipip-neo-120/catalogue'
import { QUALITY_MODULE_VERSION, QUALITY_QUESTIONS } from '@/lib/instrument/ipip-neo-120/response-quality'
const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn(), complete: vi.fn(), update: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn() }))
vi.mock('@/lib/auth/participant-runtime', () => ({ requireParticipantRuntimeSessionAccess: mocks.access, ParticipantRuntimeAccessError: class extends Error {} }))
vi.mock('@/lib/dal/session-completeness', () => ({ getSessionCompleteness: mocks.complete }))
vi.mock('@/lib/dal/response-quality', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/dal/response-quality')>(), readResponseQualityModule: mocks.read }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
import { submitSession } from '@/app/actions/assess'
beforeEach(() => {
  mocks.access.mockResolvedValue({ participantId: 'participant' })
  mocks.complete.mockResolvedValue({ expected: 120, answered: 120 })
  mocks.read.mockResolvedValue({ version: QUALITY_MODULE_VERSION, questions: QUALITY_QUESTIONS, answers: {}, revision: 0 })
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { assessment_id: PERSONALITY_PROFILE_ASSESSMENT_ID, campaign_participant_id: 'participant', status: 'in_progress' }, error: null }), update: mocks.update }
  mocks.from.mockReturnValue(query)
})
const sessionId = '11111111-1111-4111-8111-111111111111'
it('server-side completion refuses to skip assigned supplementary questions', async () => {
  expect(await submitSession('synthetic-token', sessionId)).toMatchObject({ ok: false, error: 'response_quality_incomplete' })
  expect(mocks.update).not.toHaveBeenCalled()
})
it('does not mistake a failed supplementary read for a legacy form without checks', async () => {
  mocks.read.mockRejectedValue(new Error('Synthetic storage unavailable'))
  expect(await submitSession('synthetic-token', sessionId)).toMatchObject({ ok: false, error: 'submit_failed' })
  expect(mocks.update).not.toHaveBeenCalled()
})
it('the original 120-item completeness check still applies before the supplement', async () => {
  mocks.complete.mockResolvedValue({ expected: 120, answered: 119 })
  expect(await submitSession('synthetic-token', sessionId)).toMatchObject({ ok: false, error: 'incomplete_submission' })
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})
