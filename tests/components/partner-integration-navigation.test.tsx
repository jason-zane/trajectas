// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppSidebar } from '@/components/app-sidebar'
import { PortalProvider } from '@/components/portal-context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'

vi.mock('next/navigation', () => ({ usePathname: () => '/partner/integrations' }))

describe('independent partner integration navigation', () => {
  it('exposes integrations with client directory disabled and removes it under its own flag', () => {
    const features = { ...defaultWorkspaceFeatures('partner'), clientDirectory: false, clientManagement: false }
    const sidebar = (enabled: boolean) => <SidebarProvider><PortalProvider initialPortal="partner" routePrefix="/partner" features={{ ...features, integrationManagement: enabled }}><AppSidebar /></PortalProvider></SidebarProvider>
    const { rerender } = render(sidebar(true))
    expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute('href', '/partner/integrations')
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument()
    rerender(sidebar(false))
    expect(screen.queryByRole('link', { name: 'Integrations' })).not.toBeInTheDocument()
  })
})
