// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PortalProvider } from '@/components/portal-context'
import { CampaignSessionsTable } from '@/app/(dashboard)/campaigns/[id]/participants/campaign-sessions-table'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

class ImmediateIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  unobserve() {}
  disconnect() {}
}
beforeEach(() => { vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver) })

const session = {
  id: 'session-1', campaignParticipantId: 'participant-1', participantName: 'Alex Example',
  participantEmail: 'alex@example.test', assessmentId: 'assessment-1', assessmentTitle: 'Leadership',
  status: 'completed', startedAt: '2026-10-13T05:11:20Z', completedAt: '2026-10-13T05:12:14Z', attemptNumber: 1,
}

describe('campaign Sessions table navigation', () => {
  it.each([
    ['admin', ''], ['client', '/client'], ['partner', '/partner'],
  ] as const)('opens the same session from the participant name and row on %s', (portal, routePrefix) => {
    render(<PortalProvider initialPortal={portal} routePrefix={routePrefix}>
      <CampaignSessionsTable campaignId="campaign-1" sessions={[session]} />
    </PortalProvider>)
    const destination = `${routePrefix}/campaigns/campaign-1/sessions/session-1`
    expect(screen.getByRole('link', { name: 'Open session for Alex Example' })).toHaveAttribute('href', destination)
    fireEvent.click(screen.getByText('Leadership'))
    expect(push).toHaveBeenCalledWith(destination)
  })
})
