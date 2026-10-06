// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  invite: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: calls.refresh }) }))
vi.mock('sonner', () => ({
  toast: { success: calls.success, error: calls.error, warning: calls.warning },
}))
import { InviteMemberDialog } from '@/components/invite-member-dialog'

async function submitInvite(scope = 'client workspace') {
  const user = userEvent.setup()
  render(<InviteMemberDialog scope={scope} onInvite={calls.invite} />)
  await user.click(screen.getByRole('button', { name: 'Invite user' }))
  await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'person@example.com')
  await user.click(screen.getByRole('button', { name: 'Send invite' }))
}

describe('pending workspace invitation visibility', () => {
  it.each(['client workspace', 'partner workspace'])('refreshes existing pending invites after a duplicate in a %s', async scope => {
    const error = 'An invite is already pending for this email address'
    calls.invite.mockResolvedValue({ error })
    await submitInvite(scope)

    await screen.findByText(error)
    expect(screen.getByText(/This person has an unexpired invitation in this workspace/))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View outstanding invitations' })).toHaveAttribute('href', '#outstanding-invites')
    expect(calls.refresh).toHaveBeenCalledOnce()
    expect(calls.invite).toHaveBeenCalledOnce()
    expect(calls.invite).toHaveBeenCalledWith({ email: 'person@example.com', role: 'member' })
    expect(calls.error).toHaveBeenCalledWith(error)
    expect(calls.success).not.toHaveBeenCalled()
  })

  it('retains other errors without refreshing or suggesting an existing invite', async () => {
    calls.invite.mockResolvedValue({ error: 'You do not have permission to invite users to this client' })
    await submitInvite()

    await screen.findByText('You do not have permission to invite users to this client')
    expect(calls.refresh).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'View outstanding invitations' })).not.toBeInTheDocument()
    expect(calls.invite).toHaveBeenCalledOnce()
  })

  it('retains the ordinary successful invitation refresh', async () => {
    calls.invite.mockResolvedValue({ emailDelivered: true })
    await submitInvite()

    await waitFor(() => expect(calls.success).toHaveBeenCalledWith('Invite sent to person@example.com'))
    expect(calls.refresh).toHaveBeenCalledOnce()
    expect(calls.invite).toHaveBeenCalledOnce()
    expect(calls.error).not.toHaveBeenCalled()
  })

  it('refreshes and explains an outstanding collision without claiming it is unexpired', async () => {
    const error = 'An active invite already exists for this person with this role. Resend it or revoke it before sending a new one.'
    calls.invite.mockResolvedValue({ error, duplicate: { inviteId: 'expired-invite' } })
    await submitInvite()

    await screen.findByText(error)
    expect(screen.getByText(/even if it has expired/)).toBeInTheDocument()
    expect(screen.queryByText(/This person has an unexpired/)).not.toBeInTheDocument()
    expect(calls.refresh).toHaveBeenCalledOnce()
    expect(calls.invite).toHaveBeenCalledOnce()
    await userEvent.setup().click(screen.getByRole('link', { name: 'View outstanding invitations' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.invite).toHaveBeenCalledOnce()
  })
})
