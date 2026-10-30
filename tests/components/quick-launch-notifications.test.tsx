// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ create: vi.fn(), settings: vi.fn(), activate: vi.fn(), remove: vi.fn(), error: vi.fn(), push: vi.fn(), reference: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: calls.push, refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { error: calls.error, success: vi.fn() } }))
vi.mock('@/app/actions/campaigns', () => ({
  createCampaign: calls.create, updateCampaignConsultantSettings: calls.settings,
  activateCampaign: calls.activate, deleteCampaign: calls.remove,
  getCampaignAssessmentId: async () => 'campaign-assessment',
  addAssessmentToCampaign: async () => ({ success: true }),
  createAccessLink: async () => ({ token: 'access-token' }),
  duplicateCampaignForReuse: vi.fn(), bulkInviteParticipants: vi.fn(), inviteParticipant: vi.fn(), sendParticipantInviteEmails: vi.fn(),
}))
vi.mock('@/app/actions/norm-references', () => ({ getCampaignSetupReferenceChoices: async () => ({ references: [], defaultId: null }), setCampaignAssessmentReference: calls.reference }))
vi.mock('@/app/actions/factor-selection', () => ({ getFactorsForAssessment: async () => [], saveFactorSelection: vi.fn() }))
vi.mock('@/app/actions/item-selection-rules', () => ({ getItemSelectionRulesForEstimate: async () => [] }))
vi.mock('@/app/actions/raters', () => ({ addRater: vi.fn(), markApprovedRatersInvited: vi.fn() }))
vi.mock('@/components/action-dialog', () => ({
  ActionDialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  ActionDialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ActionChoice: ({ title, onClick, disabled }: { title: string; onClick: () => void; disabled: boolean }) => <button disabled={disabled} onClick={onClick}>{title}</button>,
  ActionWizard: ({ children, onNext, onComplete, canAdvance, currentStepIndex, steps }: { children: ReactNode; onNext: () => void; onComplete: () => void; canAdvance: boolean; currentStepIndex: number; steps: { id: string }[] }) => <div>
    {children}
    {currentStepIndex < steps.length - 1 ? <button disabled={!canAdvance} onClick={onNext}>Next</button> : <button disabled={!canAdvance} onClick={onComplete}>Launch</button>}
  </div>,
}))

import { LaunchCampaignButton } from '@/components/campaigns/launch-campaign-button'
import { QuickLaunchModal } from '@/components/campaigns/quick-launch-modal'
import type { CampaignAssessmentOption } from '@/app/actions/campaigns'
const assessment: CampaignAssessmentOption = {
  id: 'assessment', title: 'Leadership', status: 'active', factorCount: 25, constructCount: 25,
  sectionCount: 1, totalItemCount: 150, estimatedDurationMinutes: 10, minCustomFactors: null,
}
const props = { assessments: [assessment], clients: [{ id: 'client', name: 'Client' }], forcedClientId: 'client' }
beforeEach(() => {
  calls.create.mockResolvedValue({ id: 'campaign' })
  calls.settings.mockResolvedValue({ success: true })
  calls.activate.mockResolvedValue({ success: true })
  calls.remove.mockResolvedValue({ success: true })
})
async function reachNotifications() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('e.g. Q2 Leadership Assessment'), 'CEO demo')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('button', { name: /Leadership/ }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('radio', { name: /Scale scores only/ })).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  return user
}

describe('quick launch completion notifications', () => {
  it('carries the consultant email from the client launch entry point through to persisted settings', async () => {
    const user = userEvent.setup()
    render(<LaunchCampaignButton {...props} recentCampaigns={[]} creatorEmail="consultant@example.com" />)
    await user.click(screen.getByRole('button', { name: 'Launch campaign' }))
    await user.click(screen.getByRole('button', { name: 'New campaign' }))
    await reachNotifications()
    expect(screen.getByText('consultant@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Launch' }))
    await waitFor(() => expect(calls.activate).toHaveBeenCalledOnce())
    expect(calls.reference).toHaveBeenCalledWith({ campaignId: 'campaign', campaignAssessmentId: 'campaign-assessment', referenceId: null })
    expect(calls.reference.mock.invocationCallOrder[0]).toBeLessThan(calls.activate.mock.invocationCallOrder[0])
    expect(calls.settings).toHaveBeenCalledWith('campaign', expect.objectContaining({ emails: ['consultant@example.com'], enabled: true }))
  })
  it('requires a recipient when completion notifications are enabled', async () => {
    render(<QuickLaunchModal {...props} open onOpenChange={vi.fn()} />)
    await reachNotifications()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByText(/Add a recipient to continue/)).toBeInTheDocument()
    expect(calls.create).not.toHaveBeenCalled()
  })
  it('stops and rolls back the draft when notification settings cannot be saved', async () => {
    calls.settings.mockResolvedValue({ error: 'Unable to update consultant settings.' })
    render(<QuickLaunchModal {...props} creatorEmail="consultant@example.com" open onOpenChange={vi.fn()} />)
    const user = await reachNotifications()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Launch' }))
    await waitFor(() => expect(calls.remove).toHaveBeenCalledWith('campaign'))
    expect(calls.activate).not.toHaveBeenCalled()
    expect(calls.push).not.toHaveBeenCalled()
    expect(calls.error).toHaveBeenCalledWith('Quick launch failed', expect.objectContaining({ description: 'Unable to update consultant settings.' }))
  })
})
