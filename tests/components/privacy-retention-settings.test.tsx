// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ assign: vi.fn(), publish: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/actions/privacy', () => ({ setCampaignPrivacyAction: state.assign, publishPrivacyNoticeAction: state.publish }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))
vi.mock('@/components/data-table', () => ({ DataTable: () => null }))
vi.mock('@/hooks/use-unsaved-changes', () => ({ useUnsavedChanges: () => ({ showDialog: false, cancelNavigation: vi.fn(), confirmNavigation: vi.fn() }) }))
import { PrivacySettings } from '@/app/(dashboard)/settings/privacy/privacy-settings'
const campaignId = '11111111-1111-4111-8111-111111111111', policyId = '22222222-2222-4222-8222-222222222222'
const props: ComponentProps<typeof PrivacySettings> = {
  mode: 'plan', campaigns: [{ id: campaignId, title: 'Synthetic engagement', status: 'completed' }], research: { cases: [], releases: [] },
  dashboard: { notices: [], requests: [], holds: [], policies: [{ id: policyId, name: 'Synthetic retention', version: 'fixture-v1', status: 'active', scope: 'assessment', recoveryOnly: false, retentionMonths: 12, backupDays: 7, diagnosticDays: null, auditDays: null, researchAllowed: false }] },
}
it('saves a reviewed retention assignment without requiring or publishing a notice', async () => {
  state.assign.mockResolvedValue({ ok: true, data: undefined })
  render(<PrivacySettings {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'campaigns' }))
  const campaign = screen.getByRole('combobox', { name: 'Campaign' })
  const policy = screen.getByRole('combobox', { name: 'Approved assessment policy' })
  const notice = screen.getByRole('combobox', { name: 'Published participant notice (optional)' })
  expect(notice).not.toBeRequired()
  expect(notice).toHaveValue('')
  fireEvent.change(campaign, { target: { value: campaignId } })
  fireEvent.change(policy, { target: { value: policyId } })
  expect((notice.closest('form') as HTMLFormElement).checkValidity()).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }))
  expect(await screen.findByText(/The participant notice stays unchanged/)).toBeVisible()
  expect(state.assign).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm reviewed action' }))
  await waitFor(() => expect(state.assign).toHaveBeenCalledWith({ campaignId, policyId, noticeId: undefined, closedAt: null }))
  expect(state.publish).not.toHaveBeenCalled()
  expect(state.refresh).toHaveBeenCalled()
})
