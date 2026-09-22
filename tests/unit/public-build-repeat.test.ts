import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ bot: vi.fn(), rate: vi.fn(), decode: vi.fn(), count: vi.fn(), total: vi.fn(), creating: vi.fn(), cache: vi.fn(), insert: vi.fn(), extract: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'signed' }) }), headers: async () => new Headers() }))
vi.mock('botid/server', () => ({ checkBotId: m.bot }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/security/rate-limit', () => ({ checkKeyedRateLimit: m.rate }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn() }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn() }))
vi.mock('@/app/actions/assessments', () => ({ createAssessment: vi.fn() }))
vi.mock('@/app/actions/campaigns', () => ({ createCampaign: vi.fn(), addAssessmentToCampaign: vi.fn(), sendParticipantInviteEmail: vi.fn() }))
vi.mock('@/lib/dal/assessment-sections', () => ({ getFormatBreakdownForScope: vi.fn(), buildDefaultSectionDrafts: vi.fn() }))
vi.mock('@/lib/ai/brief-extraction', () => ({ runBriefExtraction: m.extract }))
vi.mock('@/lib/ai/role-text-extraction', () => ({ extractTextFromUpload: vi.fn() }))
vi.mock('@/lib/ai/architect-match', () => ({ runArchitectMatchPipeline: vi.fn() }))
vi.mock('@/lib/ai/architect-overview', () => ({ runArchitectOverview: vi.fn() }))
vi.mock('@/lib/public-builds/cookie', () => ({ PUBLIC_BUILD_COOKIE: 'public', decodePublicBuildCookie: m.decode }))
vi.mock('@/lib/dal/public-builds', () => ({
  countPublicBuildsSince: m.total, countBuildsForEmailSince: m.count, hasCreatingBuildForEmail: m.creating,
  findCachedRankedBuild: m.cache, insertPublicBuild: m.insert,
}))
import { startBuild } from '@/app/actions/public-builds'
const input = { roleTitle: 'Another role', pdText: 'Lead a team.', tier: 'core' as const }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('PUBLIC_BUILDS_MODE', 'closed'); vi.stubEnv('PUBLIC_BUILDS_DAILY_CAP', '100')
  m.decode.mockReturnValue({ email: 'person@example.com' }); m.bot.mockResolvedValue({ isBot: false }); m.rate.mockResolvedValue({ allowed: true })
  m.total.mockResolvedValue(5); m.count.mockResolvedValue(3); m.creating.mockResolvedValue(false)
  m.cache.mockResolvedValue(null); m.insert.mockResolvedValue({ id: 'new-build' }); m.extract.mockResolvedValue({ roleTitle: 'Another role', usage: { inputTokens: 1, outputTokens: 1 } })
})
it('allows a verified person beyond the former three-build limit', async () => {
  expect(await startBuild(input)).toMatchObject({ buildId: 'new-build' })
  expect(m.rate).toHaveBeenCalledWith('public-build-start:person@example.com', 10, 86_400_000, true)
  expect(m.extract).toHaveBeenCalledTimes(1)
})
it('refuses the eleventh build before calling AI', async () => {
  m.count.mockResolvedValue(10)
  expect(await startBuild(input)).toHaveProperty('error')
  expect(m.extract).not.toHaveBeenCalled()
})
it('retains the global daily cap', async () => {
  m.total.mockResolvedValue(100)
  expect(await startBuild(input)).toHaveProperty('error')
  expect(m.extract).not.toHaveBeenCalled()
})
it('does not start a new role while assessment creation is unresolved', async () => {
  m.creating.mockResolvedValue(true)
  expect(await startBuild(input)).toHaveProperty('error')
  expect(m.extract).not.toHaveBeenCalled()
})
it('blocks bots and rate-limited attempts before AI work', async () => {
  m.bot.mockResolvedValueOnce({ isBot: true })
  expect(await startBuild(input)).toHaveProperty('error')
  m.rate.mockResolvedValueOnce({ allowed: false })
  expect(await startBuild(input)).toHaveProperty('error')
  expect(m.extract).not.toHaveBeenCalled()
})
it('still requires a verified signed session', async () => {
  m.decode.mockReturnValue(null)
  expect(await startBuild(input)).toEqual({ error: 'Verify your email first.' })
  expect(m.extract).not.toHaveBeenCalled()
})
