import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createStudioDemo } from '@/lib/trajectory-studio/demo'

const calls = vi.hoisted(() => ({
  canvas: vi.fn(), admin: vi.fn(), partner: vi.fn(), client: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`) }),
  notFound: vi.fn(() => { throw new Error('not-found') }),
}))
vi.mock('@/app/actions/canvas', () => ({ getComparisonCanvas: calls.canvas }))
vi.mock('@/lib/auth/authorization', () => ({ requireAdminScope: calls.admin }))
vi.mock('@/lib/auth/resolve-partner-org', () => ({ resolvePartnerOrg: calls.partner }))
vi.mock('@/lib/auth/resolve-client-org', () => ({ resolveClientOrg: calls.client }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-nonce': 'test-nonce' }) }))
vi.mock('next/navigation', () => ({ redirect: calls.redirect, notFound: calls.notFound, useRouter: () => ({ push: vi.fn() }), usePathname: () => '/participants/trajectory' }))
vi.mock('@/components/trajectory-studio/studio-live', () => ({ LiveTrajectoryStudio: () => null }))
import TrajectoryPage from '@/app/(dashboard)/participants/trajectory/page'
import UnifiedPage from '@/app/(dashboard)/participants/unified/page'
import PartnerTrajectory from '@/app/partner/participants/trajectory/page'
import PartnerUnified from '@/app/partner/participants/unified/page'
import ClientTrajectory from '@/app/client/participants/trajectory/page'
import StudioPage from '@/app/(dashboard)/participants/studio/page'
import PreviewPage from '@/app/preview/trajectory/page'
import { renderTrajectoryPage } from '@/lib/trajectory-studio/page'
import { TrajectoryStudio } from '@/components/trajectory-studio/trajectory-studio'

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })

describe('Production Trajectory entry points', () => {
  it.each([
    ['admin trajectory', TrajectoryPage, 'individual', 'time', calls.admin],
    ['admin unified', UnifiedPage, 'unified', 'snapshot', calls.admin],
    ['partner trajectory', PartnerTrajectory, 'individual', 'time', calls.partner],
    ['partner unified', PartnerUnified, 'unified', 'snapshot', calls.partner],
    ['client trajectory', ClientTrajectory, 'individual', 'time', calls.client],
  ] as const)('opens %s after its portal access check', async (_name, route, experience, initialLens, guard) => {
    const page = await route({ searchParams: Promise.resolve({}) })
    expect(guard).toHaveBeenCalledOnce()
    expect(page.props).toMatchObject({ experience, initialLens, nonce: 'test-nonce', initial: { people: [] } })
    expect(calls.canvas).not.toHaveBeenCalled()
  })
  it.each(['admin', 'partner', 'client'] as const)('opens a fixed Compare experience in %s', async (portal) => {
    const page = await renderTrajectoryPage({ lens: 'time' }, 'compare', portal)
    expect(page.props).toMatchObject({ experience: 'compare', initialLens: 'snapshot' })
    expect(calls[portal]).toHaveBeenCalledOnce()
  })
  it('never permits unified in the client portal', async () => {
    await expect(renderTrajectoryPage({}, 'unified', 'client')).rejects.toThrow('not-found')
    expect(calls.canvas).not.toHaveBeenCalled()
  })
  it('denies direct unified URLs before loading participant data', async () => {
    calls.admin.mockRejectedValueOnce(new Error('Admin required'))
    await expect(UnifiedPage({ searchParams: Promise.resolve({ ids: 'one' }) })).rejects.toThrow('Admin required')
    calls.partner.mockRejectedValueOnce(new Error('Partner required'))
    await expect(PartnerUnified({ searchParams: Promise.resolve({ ids: 'one' }) })).rejects.toThrow('Partner required')
    expect(calls.canvas).not.toHaveBeenCalled()
  })
  it('keeps individual history fixed despite mode query parameters', async () => {
    calls.canvas.mockResolvedValueOnce(createStudioDemo().result)
    const params = { id: 'participant-one', lens: 'snapshot', experience: 'unified' }
    const page = await ClientTrajectory({ searchParams: Promise.resolve(params) })
    expect(calls.canvas).toHaveBeenCalledWith(['participant-one'])
    expect(page.props).toMatchObject({ experience: 'individual', initialLens: 'time' })
  })
  it('deduplicates IDs and honors unified history links', async () => {
    calls.canvas.mockResolvedValueOnce(createStudioDemo().result)
    const page = await UnifiedPage({ searchParams: Promise.resolve({ ids: 'one,one,two', lens: 'time' }) })
    expect(calls.canvas).toHaveBeenCalledWith(['one', 'two'])
    expect(page.props.initialLens).toBe('time')
  })
  it('propagates participant authorization failures and rejects excessive selections', async () => {
    calls.canvas.mockRejectedValueOnce(new Error('Not authorized'))
    await expect(TrajectoryPage({ searchParams: Promise.resolve({ ids: 'one' }) })).rejects.toThrow('Not authorized')
    await expect(TrajectoryPage({ searchParams: Promise.resolve({ ids: Array.from({ length: 9 }, (_, i) => String(i)).join(',') }) })).rejects.toThrow('Choose up to 8')
  })
  it('redirects old studio links through the admin gate with the selection intact', async () => {
    await expect(StudioPage({ searchParams: Promise.resolve({ ids: 'one,two', experience: 'individual' }) })).rejects.toThrow('redirect:/participants/unified?ids=one%2Ctwo&lens=time')
    expect(calls.admin).toHaveBeenCalledOnce()
  })
  it('does not serve fictional design previews in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(PreviewPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('not-found')
  })
  it.each(['compare', 'individual', 'unified'] as const)('keeps live %s in its authorized experience without demo controls', (experience) => {
    const html = renderToStaticMarkup(<TrajectoryStudio dataset={{ ...createStudioDemo(), demo: false }} initialExperience={experience} />)
    expect(html.includes('aria-label="Analysis view"')).toBe(experience === 'unified')
    expect(html).not.toContain('Design experiences')
    expect(html).not.toContain('INTERACTIVE DESIGN REVIEW')
    expect(html).not.toContain('example norm')
    expect(html).not.toContain('THREE WAYS TO SEE MORE')
  })
})
