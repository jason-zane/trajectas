// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const calls = vi.hoisted(() => ({
  refresh: vi.fn(), reissue: vi.fn(), revoke: vi.fn(), resend: vi.fn(), create: vi.fn(), detail: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: calls.refresh }), notFound: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/app/actions/clients', () => ({ reissueClientInvite: calls.reissue, revokeClientInvite: calls.revoke }))
vi.mock('@/app/actions/partners', () => ({ reissuePartnerInvite: calls.reissue, revokePartnerInvite: calls.revoke }))
vi.mock('@/app/actions/staff-users', () => ({
  createStaffInviteAction: calls.create, revokeInviteById: calls.revoke,
  reissueInviteLinkById: calls.reissue, toggleUserActiveState: vi.fn(),
}))
vi.mock('@/app/actions/user-management', () => ({
  resendInvite: calls.resend, bulkDeleteUsers: vi.fn(), bulkUpdateUserStatus: vi.fn(), getInviteDetail: calls.detail,
}))
vi.mock('@/app/(dashboard)/users/invite/[inviteId]/invite-detail-client', () => ({
  InviteDetailClient: () => null,
}))
vi.mock('@/components/copy-invite-link-button', () => ({
  CopyInviteLinkButton: ({ getLink }: { getLink: () => void }) => <button onClick={getLink}>Copy invite link</button>,
}))

import { PendingInvitesSection } from '@/app/(dashboard)/clients/[slug]/users/pending-invites-section'
import { PartnerPendingInvitesSection } from '@/app/(dashboard)/partners/[slug]/users/partner-pending-invites-section'
import { ClientPortalPendingInvites } from '@/app/client/settings/users/pending-invites-section'
import { PartnerPortalPendingInvites } from '@/app/partner/settings/users/partner-pending-invites-section'
import { OutstandingInvitesHeader } from '@/components/workspace-users/outstanding-invites-header'
import { UsersTable } from '@/app/(dashboard)/users/users-table'
import { InviteDialog } from '@/app/(dashboard)/users/invite-dialog'
import InviteDetailPage from '@/app/(dashboard)/users/invite/[inviteId]/page'
import { EXISTING_INVITE_ERROR, OUTSTANDING_INVITE_LIMIT } from '@/lib/invite-status'

const now = new Date('2026-10-06T12:00:00Z').getTime()
const invites = [
  { id: 'expired-record', email: 'expired@example.com', role: 'client_admin', createdAt: '2026-09-20T12:00:00Z', expiresAt: '2026-09-27T12:00:00Z' },
  { id: 'pending-record', email: 'pending@example.com', role: 'client_member', createdAt: '2026-10-05T12:00:00Z', expiresAt: '2026-10-12T12:00:00Z' },
]
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

describe('workspace outstanding invitation visibility', () => {
  it.each(['admin client', 'client portal', 'admin partner', 'partner portal'])('shows and filters pending and expired records on %s without invoking invite actions', async surface => {
    const user = userEvent.setup()
    const partnerInvites = invites.map(invite => ({ ...invite, role: invite.role.replace('client_', 'partner_') }))
    if (surface === 'admin client') render(<PendingInvitesSection clientId="client-a" invites={invites} />)
    if (surface === 'client portal') render(<ClientPortalPendingInvites workspaceId="client-a" invites={invites} />)
    if (surface === 'admin partner') render(<PartnerPendingInvitesSection partnerId="partner-a" invites={partnerInvites} />)
    if (surface === 'partner portal') render(<PartnerPortalPendingInvites workspaceId="partner-a" invites={partnerInvites} />)

    expect(screen.getByRole('heading', { name: 'Outstanding invitations' })).toBeInTheDocument()
    const expiredRow = screen.getByText('expired@example.com').closest('tr')!
    expect(within(expiredRow).getByText('Expired')).toBeInTheDocument()
    expect(expiredRow).toHaveAttribute('id', 'invite-expired-record')
    expect(within(expiredRow).getAllByText(/Sep/)).toHaveLength(2)
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expired (1)' }))
    expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('expired@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pending (1)' }))
    expect(screen.queryByText('expired@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All (2)' }))
    expect(screen.getByText('expired@example.com')).toBeInTheDocument()
    expect(calls.reissue).not.toHaveBeenCalled()
    expect(calls.revoke).not.toHaveBeenCalled()
    expect(calls.resend).not.toHaveBeenCalled()
  })

  it('shows an empty filtered state when there are no expired records', async () => {
    render(<ClientPortalPendingInvites workspaceId="client-a" invites={[invites[1]]} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Expired (0)' }))
    expect(screen.getByText('No expired invitations')).toBeInTheDocument()
    expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument()
  })

  it('discloses the bounded list instead of implying it contains every outstanding record', () => {
    render(<OutstandingInvitesHeader invites={Array.from({ length: OUTSTANDING_INVITE_LIMIT }, () => invites[0])} filter="all" onFilterChange={vi.fn()} />)
    expect(screen.getByText('Showing the most recent 1,000 outstanding invitations.')).toBeInTheDocument()
  })
})

describe('global administrator invitation visibility', () => {
  it('shows expiry dates and distinct statuses, and filters expired rows', async () => {
    const users = invites.map(invite => ({
      ...invite, type: 'invite' as const, role: invite.role as 'client_admin' | 'client_member',
      tenantType: 'client' as const, tenantId: 'client-a', tenantName: 'Example Client',
    }))
    render(<UsersTable users={users} />)
    expect(screen.getByRole('columnheader', { name: /Invite expires/ })).toBeInTheDocument()
    expect(within(screen.getAllByText('expired@example.com')[0].closest('tr')!).getByText('Expired')).toBeInTheDocument()
    expect(within(screen.getAllByText('pending@example.com')[0].closest('tr')!).getByText('Pending')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Status', expanded: false }))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Expired/ }))
    expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument()
    expect(screen.getAllByText('expired@example.com')[0]).toBeInTheDocument()
    expect(calls.reissue).not.toHaveBeenCalled()
    expect(calls.revoke).not.toHaveBeenCalled()
    expect(calls.resend).not.toHaveBeenCalled()
  })

  it('links an existing collision to its read-only detail rather than automatically resolving it', async () => {
    calls.create.mockResolvedValue({ error: EXISTING_INVITE_ERROR, duplicate: { inviteId: 'expired-record' } })
    render(<InviteDialog clients={[]} partners={[]} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Invite User' }))
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))
    const link = await screen.findByRole('link', { name: 'View existing invitation' })
    expect(link).toHaveAttribute('href', '/users/invite/expired-record')
    expect(screen.getByText(/An expired invitation still remains outstanding/)).toBeInTheDocument()
    expect(calls.refresh).toHaveBeenCalledOnce()
    expect(calls.create).toHaveBeenCalledOnce()
    expect(calls.resend).not.toHaveBeenCalled()
    expect(calls.revoke).not.toHaveBeenCalled()
  })

  it.each([
    ['Expired', null, null],
    ['Accepted', '2026-09-21T12:00:00Z', null],
    ['Revoked', null, '2026-09-21T12:00:00Z'],
  ])('labels an existing detail record as %s', async (status, acceptedAt, revokedAt) => {
    calls.detail.mockResolvedValue({
      ...invites[0], role: 'client_admin', tenantType: 'client', tenantId: 'client-a',
      tenantName: 'Example Client', acceptedAt, revokedAt,
    })
    render(await InviteDetailPage({ params: Promise.resolve({ inviteId: 'expired-record' }) }))
    expect(screen.getByText(status)).toBeInTheDocument()
  })
})
