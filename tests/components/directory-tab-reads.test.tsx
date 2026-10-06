// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reads = vi.hoisted(() => ({
  clients: vi.fn(), partners: vi.fn(), commercial: vi.fn(), scope: vi.fn(),
}))
vi.mock('@/app/actions/clients', () => ({ getClientDirectoryEntries: reads.clients }))
vi.mock('@/app/actions/partners', () => ({ getPartners: reads.partners }))
vi.mock('@/lib/dal/business-centre', () => ({ getClientCommercialSummaries: reads.commercial }))
vi.mock('@/lib/auth/authorization', () => ({
  resolveAuthorizedScope: reads.scope,
  canManageClientDirectory: () => true,
  canManagePartnerDirectory: (scope: { isPlatformAdmin: boolean }) => scope.isPlatformAdmin,
}))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(url) } }))
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/app/(dashboard)/directory/client-directory-table', () => ({
  ClientDirectoryTable: () => <div>Client table</div>,
}))
vi.mock('@/app/(dashboard)/directory/partner-directory-table', () => ({
  PartnerDirectoryTable: () => <div>Partner table</div>,
}))
import DirectoryPage from '@/app/(dashboard)/directory/page'

beforeEach(() => {
  reads.scope.mockResolvedValue({ isPlatformAdmin: true, clientIds: [], partnerIds: [] })
  reads.clients.mockResolvedValue([])
  reads.partners.mockResolvedValue([])
  reads.commercial.mockResolvedValue(new Map())
})

describe('directory tab data dependencies', () => {
  it('renders clients without reading the unrelated partner list', async () => {
    render(await DirectoryPage({ searchParams: Promise.resolve({ tab: 'clients' }) }))
    expect(screen.getByText('Client table')).toBeInTheDocument()
    expect(reads.clients).toHaveBeenCalledOnce()
    expect(reads.commercial).toHaveBeenCalledOnce()
    expect(reads.partners).not.toHaveBeenCalled()
  })

  it('renders partners without waiting for client or commercial data', async () => {
    reads.clients.mockImplementation(() => new Promise(() => {}))
    reads.commercial.mockImplementation(() => new Promise(() => {}))
    render(await DirectoryPage({ searchParams: Promise.resolve({ tab: 'partners' }) }))
    expect(screen.getByText('Partner table')).toBeInTheDocument()
    expect(reads.partners).toHaveBeenCalledOnce()
    expect(reads.clients).not.toHaveBeenCalled()
    expect(reads.commercial).not.toHaveBeenCalled()
  })

  it('retains the client-only tab for actors who cannot manage partners', async () => {
    reads.scope.mockResolvedValue({ isPlatformAdmin: false, clientIds: ['client-a'], partnerIds: [] })
    render(await DirectoryPage({ searchParams: Promise.resolve({ tab: 'partners' }) }))
    expect(screen.getByText('Client table')).toBeInTheDocument()
    expect(reads.clients).toHaveBeenCalledOnce()
    expect(reads.partners).not.toHaveBeenCalled()
    expect(reads.commercial).not.toHaveBeenCalled()
  })

  it('retains the unavailable-directory redirect before all table reads', async () => {
    reads.scope.mockResolvedValue({ isPlatformAdmin: false, clientIds: [], partnerIds: [] })
    await expect(DirectoryPage({ searchParams: Promise.resolve({ tab: 'clients' }) }))
      .rejects.toThrow('/unauthorized?reason=directory')
    expect(reads.clients).not.toHaveBeenCalled()
    expect(reads.partners).not.toHaveBeenCalled()
    expect(reads.commercial).not.toHaveBeenCalled()
  })
})
