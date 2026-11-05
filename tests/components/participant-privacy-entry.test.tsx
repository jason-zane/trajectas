// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinForm } from '@/components/assess/join-form'
import { ConsentScreen } from '@/components/assess/consent-screen'
import { DEFAULT_PAGE_CONTENT } from '@/lib/experience/defaults'
import type { ParticipantPrivacyNotice } from '@/lib/privacy/notice'
const state = vi.hoisted(() => ({ register: vi.fn(), save: vi.fn(), push: vi.fn() }))
vi.mock('@/app/actions/assess', () => ({ registerViaLink: state.register }))
vi.mock('@/app/actions/experience', () => ({ saveConsent: state.save }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }))
const notice: ParticipantPrivacyNotice = { id: '11111111-1111-4111-8111-111111111111', title: 'How your assessment information is used', body: 'Exact versioned notice text.\n\nSecond notice paragraph.', acknowledgementLabel: 'I have read the assessment privacy information.', researchLabel: 'Optional research permission.', researchChoiceEnabled: false }
const showJoin = (research = false) => render(<JoinForm linkToken="synthetic-link" content={DEFAULT_PAGE_CONTENT.join} privacyNotice={{ ...notice, researchChoiceEnabled: research }} />)
function fillRegistration() {
  for (const [name, value] of [['email', 'synthetic@example.invalid'], ['first name', 'Synthetic'], ['last name', 'Participant']]) fireEvent.change(screen.getByRole('textbox', { name: new RegExp(name, 'i') }), { target: { value } })
}
const agree = () => fireEvent.click(screen.getByRole('checkbox', { name: notice.acknowledgementLabel }))
beforeEach(() => { state.register.mockResolvedValue({ accessToken: 'synthetic-token' }); state.save.mockResolvedValue({ error: 'retry' }) })
describe('registration privacy control', () => {
  it('opens the full notice in a popup without accepting it or submitting registration', async () => {
    showJoin()
    fillRegistration()
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.queryByText('Exact versioned notice text.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Read assessment privacy information' }))
    expect(await screen.findByRole('dialog', { name: notice.title })).toBeVisible()
    expect(screen.getByText('Exact versioned notice text.')).toBeVisible()
    expect(screen.getByText('Second notice paragraph.')).toBeVisible()
    expect(continueButton).toBeDisabled()
    expect(state.register).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: /work email/i })).toHaveValue('synthetic@example.invalid')
  })
  it('guards form submission even when a caller bypasses the disabled button', async () => {
    showJoin(); fillRegistration()
    fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form')!)
    expect(state.register).not.toHaveBeenCalled()
    expect(screen.getByText('Please acknowledge the assessment privacy information to continue.')).toBeVisible()
  })
  it('sends the exact acknowledged version from registration without requiring the text to be opened', async () => {
    showJoin(); fillRegistration(); agree(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/assess/synthetic-token'))
    expect(state.register).toHaveBeenCalledWith('synthetic-link', expect.objectContaining({ privacyNoticeVersionId: notice.id, privacyAcknowledged: true, researchConsent: undefined }))
    expect(screen.queryByText('Exact versioned notice text.')).toBeNull()
  })
  it('offers research separately, unticked, and permits registration without selecting it', async () => {
    showJoin(true); fillRegistration(); agree()
    expect(screen.getByRole('checkbox', { name: notice.researchLabel })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.register).toHaveBeenCalledWith('synthetic-link', expect.objectContaining({ researchConsent: false })))
  })
  it('takes an already-created participant to the short retry page when receipt saving fails', async () => {
    state.register.mockResolvedValue({ accessToken: 'existing-token', requiresPrivacyAcknowledgement: true })
    showJoin(); fillRegistration(); agree(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/assess/existing-token/consent'))
  })
  it('recovers from a failed registration request without exposing private errors', async () => {
    state.register.mockRejectedValue(new Error('private transport detail'))
    showJoin(); fillRegistration(); agree(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByText('We couldn’t complete your registration. Please try again.')).toBeVisible())
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled(); expect(state.push).not.toHaveBeenCalled()
  })
  it('leaves the legacy registration flow available when no new notice is assigned', async () => {
    render(<JoinForm linkToken="synthetic-link" content={DEFAULT_PAGE_CONTENT.join} />)
    expect(screen.queryByRole('checkbox')).toBeNull(); fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/assess/synthetic-token'))
  })
})
describe('pre-registered participant privacy page', () => {
  it('starts compact, keeps the full notice available and still requires a saved acknowledgement', async () => {
    render(<ConsentScreen token={'a'.repeat(64)} participantId="participant" content={{ ...DEFAULT_PAGE_CONTENT.consent, heading: 'Before you begin' }} privacyNotice={notice} nextUrl="/next" />)
    expect(screen.queryByText('Exact versioned notice text.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    agree(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.save).toHaveBeenCalledWith('a'.repeat(64), 'participant', notice.id, undefined))
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t save your consent. Please try again.')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})
