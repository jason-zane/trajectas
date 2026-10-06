// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
const calls = vi.hoisted(() => ({ update: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/app/actions/workspace-features', () => ({ updateWorkspaceFeature: calls.update }))
vi.mock('sonner', () => ({ toast: { success: calls.success, error: calls.error } }))
import { WorkspaceFeatureSettings } from '@/components/workspace-feature-settings'
const tenant = { type: 'partner' as const, id: '11111111-1111-4111-8111-111111111111' }
beforeEach(() => vi.clearAllMocks())
describe('Trajectas feature controls', () => {
  it('saves one switch immediately without changing the other insights', async () => {
    calls.update.mockResolvedValue({ features: { ...defaultWorkspaceFeatures('partner'), compare: false } })
    render(<WorkspaceFeatureSettings tenant={tenant} initial={defaultWorkspaceFeatures('partner')} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Compare' }))
    await waitFor(() => expect(calls.success).toHaveBeenCalled())
    expect(calls.update).toHaveBeenCalledWith(tenant, { key: 'compare', value: false })
    expect(screen.getByRole('switch', { name: 'Compare' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Trajectory' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Unified Trajectory' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })
  it('keeps prior settings and displays both an inline error and toast after a failed update', async () => {
    calls.update.mockResolvedValue({ error: 'Unable to update workspace features.' })
    render(<WorkspaceFeatureSettings tenant={tenant} initial={defaultWorkspaceFeatures('partner')} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Trajectory' }))
    await screen.findByText('Unable to update workspace features.')
    expect(screen.getByRole('switch', { name: 'Trajectory' })).toHaveAttribute('aria-checked', 'true')
    expect(calls.error).toHaveBeenCalledWith('Unable to update workspace features.')
  })
  it('handles a failed server connection without changing the switch', async () => {
    calls.update.mockRejectedValue(new Error('Network unavailable'))
    render(<WorkspaceFeatureSettings tenant={tenant} initial={defaultWorkspaceFeatures('partner')} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Compare' }))
    await screen.findByText('Unable to update workspace features. Please try again.')
    expect(screen.getByRole('switch', { name: 'Compare' })).toHaveAttribute('aria-checked', 'true')
    expect(calls.error).toHaveBeenCalled()
  })
  it('shows unsupported client capabilities as unavailable and omits portfolio style', () => {
    render(<WorkspaceFeatureSettings tenant={{ ...tenant, type: 'client' }} initial={defaultWorkspaceFeatures('client')} />)
    expect(screen.getByRole('switch', { name: 'Unified Trajectory' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('option', { name: /Partner —/ })).not.toBeInTheDocument()
  })
})
