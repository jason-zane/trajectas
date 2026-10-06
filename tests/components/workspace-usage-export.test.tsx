// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalProvider } from '@/components/portal-context'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
import { aggregateUsageReport } from '@/lib/usage/report'
import { resolveUsagePeriod } from '@/lib/usage/period'
const calls = vi.hoisted(() => ({ authorise: vi.fn(), error: vi.fn() }))
vi.mock('@/app/actions/workspace-features', () => ({ authorizeWorkspaceUsageExport: calls.authorise }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/client/usage' }))
vi.mock('sonner', () => ({ toast: { error: calls.error } }))
import { UsageReportPanel } from '@/components/usage/usage-report-panel'
const report = aggregateUsageReport(resolveUsagePeriod({ period: 'all' }, new Date('2026-10-06')), [], [], [], [], new Date('2026-10-06'))
beforeEach(() => { vi.clearAllMocks() })
describe('usage CSV availability on an already rendered report', () => {
  it.each(['partner', 'client'] as const)('hides new CSV exports in disabled %s workspaces', portal => {
    render(<PortalProvider initialPortal={portal} features={{ ...defaultWorkspaceFeatures(portal), usageVisibility: false }}><UsageReportPanel report={report} scopeName="Synthetic" /></PortalProvider>)
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(calls.authorise).not.toHaveBeenCalled()
  })
  it('checks fresh availability before creating a download from stale rendered data', async () => {
    calls.authorise.mockResolvedValue({ error: 'Usage reporting is not enabled.' })
    const blob = vi.spyOn(globalThis, 'Blob')
    render(<PortalProvider initialPortal="client"><UsageReportPanel report={report} scopeName="Synthetic" /></PortalProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(calls.error).toHaveBeenCalledWith('Usage reporting is not enabled.'))
    expect(calls.authorise).toHaveBeenCalledOnce()
    expect(blob).not.toHaveBeenCalled()
    blob.mockRestore()
  })
})
