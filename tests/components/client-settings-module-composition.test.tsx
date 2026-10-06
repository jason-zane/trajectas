// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClientSettingsPanel } from '@/app/(dashboard)/clients/[slug]/settings/client-settings-panel'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/actions/client-entitlements', () => ({ toggleClientBranding: vi.fn() }))
vi.mock('@/app/(dashboard)/clients/[slug]/settings/client-integrations-panel', () => ({ ClientIntegrationsPanel: () => <div>Existing integration controls</div> }))

const settings = { canManage: true, connectionId: null, credentials: [], webhookEndpoints: [] }
describe('actual settings panel separates client metadata and integration controls', () => {
  it('hides metadata/branding mutations while retaining authorised integrations', () => {
    render(<ClientSettingsPanel clientId="synthetic" clientSlug="synthetic" canCustomizeBranding canManageMetadata={false} integrationSettings={settings} />)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByText('Custom Branding')).not.toBeInTheDocument()
    expect(screen.getByText('Existing integration controls')).toBeInTheDocument()
  })
  it('preserves existing metadata controls with default props', () => {
    render(<ClientSettingsPanel clientId="synthetic" clientSlug="synthetic" canCustomizeBranding integrationSettings={null} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
    expect(screen.queryByText('Existing integration controls')).not.toBeInTheDocument()
  })
})
