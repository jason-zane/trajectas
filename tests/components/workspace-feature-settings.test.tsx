// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
const calls = vi.hoisted(() => ({ apply: vi.fn(), update: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/app/actions/workspace-features', () => ({ applyWorkspaceFeatureChange: calls.apply, updateWorkspaceFeature: calls.update }))
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
  it('offers client Unified explicitly, omits partner controls and portfolio style', () => {
    render(<WorkspaceFeatureSettings tenant={{ ...tenant, type: 'client' }} initial={defaultWorkspaceFeatures('client')} />)
    expect(screen.getByRole('switch', { name: 'Unified Trajectory' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('option', { name: /Partner —/ })).not.toBeInTheDocument()
  })
})

describe('reviewed preset and dependency operations', () => {
  it('reviews a dependency cascade and performs no write until explicitly applied', async () => {
    const initial = defaultWorkspaceFeatures('partner')
    calls.apply.mockResolvedValue({ features: { ...initial, assessmentAuthoring: false, assessmentPublishing: false } })
    render(<WorkspaceFeatureSettings tenant={tenant} initial={initial} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Assessment authoring' }))
    expect(screen.getByText('Assessment publishing: true → false')).toBeInTheDocument()
    expect(calls.update).not.toHaveBeenCalled(); expect(calls.apply).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Assessment publishing' })).toHaveAttribute('aria-checked','true')
    await userEvent.click(screen.getByRole('button', { name: 'Apply reviewed changes' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Assessment publishing' })).toHaveAttribute('aria-checked','false'))
    expect(calls.apply).toHaveBeenCalledWith(tenant, initial, { key: 'assessmentAuthoring', value: false })
  })
  it('cancels a preset diff without modifying the existing configuration', async () => {
    render(<WorkspaceFeatureSettings tenant={tenant} initial={defaultWorkspaceFeatures('partner')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review Partner starter' }))
    expect(screen.getByText('Compare: true → false')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.apply).not.toHaveBeenCalled(); expect(calls.update).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Compare' })).toHaveAttribute('aria-checked','true')
  })
  it('retains the previous values and reviewed diff when a concurrent edit rejects application', async () => {
    calls.apply.mockResolvedValue({ error: 'Workspace features changed. Refresh and review the new diff.' })
    render(<WorkspaceFeatureSettings tenant={tenant} initial={defaultWorkspaceFeatures('partner')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review Partner starter' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apply reviewed changes' }))
    await screen.findByText('Workspace features changed. Refresh and review the new diff.')
    expect(screen.getByRole('switch', { name: 'Compare' })).toHaveAttribute('aria-checked','true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
  it('proposes missing authoring and library prerequisites without applying them silently', async () => {
    const initial = { ...defaultWorkspaceFeatures('partner'), assessmentLibrary: false, assessmentDelivery: false, assessmentAuthoring: false, assessmentPublishing: false, feedback360: false, integrationLaunches: false }
    const { previewFeatureChange } = await import('@/lib/features/workspace-features')
    calls.apply.mockResolvedValue({ features: previewFeatureChange(initial, 'assessmentPublishing', true, true) })
    render(<WorkspaceFeatureSettings tenant={tenant} initial={initial} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Assessment publishing' }))
    expect(screen.getByText('Assigned assessment library: false → true')).toBeInTheDocument()
    expect(screen.getByText('Assessment authoring: false → true')).toBeInTheDocument()
    expect(calls.update).not.toHaveBeenCalled(); expect(calls.apply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Apply reviewed changes' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Assessment publishing' })).toHaveAttribute('aria-checked', 'true'))
    expect(calls.apply).toHaveBeenCalledWith(tenant, initial, { key: 'assessmentPublishing', value: true })
    expect(screen.getByRole('switch', { name: 'Assessment delivery' })).toHaveAttribute('aria-checked', 'false')
  })
  it('reviews all library-disable consequences and cancellation preserves issued and historical features', async () => {
    render(<WorkspaceFeatureSettings tenant={tenant} initial={defaultWorkspaceFeatures('partner')} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Assigned assessment library' }))
    for (const label of ['Assessment authoring', 'Assessment publishing', 'Assessment delivery', '360 feedback delivery', 'External assessment launches']) expect(screen.getByText(`${label}: true → false`)).toBeInTheDocument()
    expect(screen.queryByText('Existing reports: true → false')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.update).not.toHaveBeenCalled(); expect(calls.apply).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Assigned assessment library' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Assessment delivery' })).toHaveAttribute('aria-checked', 'true')
  })
})
