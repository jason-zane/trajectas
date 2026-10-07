// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PortalProvider } from '@/components/portal-context'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
import { ProvisioningFeatureSelection } from '@/components/provisioning-feature-selection'
import { WorkspaceFeatureVisibility } from '@/components/workspace-feature-visibility'
import { WorkspaceFeatureHistory } from '@/components/workspace-feature-history'
import { ClientDashboard } from '@/app/client/dashboard/client-dashboard'
import { PartnerDashboard } from '@/app/partner/dashboard/partner-dashboard'
vi.mock('@/components/refresh-on-focus', () => ({ RefreshOnFocus: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
const props = { partnerName: 'Synthetic partner', clients: [], campaigns: [], allocation: [], launchAssessments: [], recentResults: [] }
describe('module-aware workspace presentation', () => {
  it('hides independent widgets/actions without removing enabled historical activity', () => {
    render(<PortalProvider initialPortal="partner" features={{ ...defaultWorkspaceFeatures('partner'), assessmentDelivery:false, assessmentLibrary:false, clientDirectory:false, clientProvisioning:false }}>
      <PartnerDashboard {...props} dashboardStyle="portfolio" />
      <WorkspaceFeatureVisibility features={['reportGeneration']}><button>Generate report</button></WorkspaceFeatureVisibility>
      <WorkspaceFeatureVisibility features={['assessmentDelivery']}><button>New delivery</button></WorkspaceFeatureVisibility>
    </PortalProvider>)
    expect(screen.queryByRole('button',{name:'Launch campaign'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'New delivery'})).not.toBeInTheDocument()
    expect(screen.queryByText('Your allocation')).not.toBeInTheDocument()
    expect(screen.queryByRole('link',{name:'New client'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Generate report'})).toBeInTheDocument()
    expect(screen.getByRole('link',{name:'View results'})).toBeInTheDocument()
  })
  it('removes activity sections when campaign viewing is disabled', () => {
    render(<PortalProvider initialPortal="partner" features={{ ...defaultWorkspaceFeatures('partner'), campaignViewing:false }}><PartnerDashboard {...props} dashboardStyle="portfolio" /></PortalProvider>)
    expect(screen.queryByRole('link',{name:'View results'})).not.toBeInTheDocument()
    expect(screen.queryByText('Participants')).not.toBeInTheDocument()
    expect(screen.getByText('Your allocation')).toBeInTheDocument()
  })
  it('keeps client historical shortcuts when delivery is off and removes them when viewing is off', () => {
    const clientProps = { clientId:'synthetic-client', campaigns:[], operationalCampaigns:[], recentResults:[], launchAssessments:[] }
    const initial = { ...defaultWorkspaceFeatures('client'), assessmentDelivery:false }
    const { rerender } = render(<PortalProvider initialPortal="client" features={initial}><ClientDashboard {...clientProps} /></PortalProvider>)
    expect(screen.queryByRole('button',{name:'Create campaign'})).not.toBeInTheDocument()
    expect(screen.getByRole('link',{name:'View recent results'})).toBeInTheDocument()
    rerender(<PortalProvider initialPortal="client" features={{ ...initial,campaignViewing:false }}><ClientDashboard {...clientProps} /></PortalProvider>)
    expect(screen.queryByRole('link',{name:'View recent results'})).not.toBeInTheDocument()
    expect(screen.queryByText('Participants')).not.toBeInTheDocument()
  })
  it('shows preset audit provenance and named before/after values', () => {
    render(<WorkspaceFeatureHistory history={[{id:'synthetic',actorId:'synthetic-admin',createdAt:'2026-10-07T00:00:00Z',origin:'preset:fullPartner:v1',changes:[{key:'compare',before:false,after:true}]}]} />)
    expect(screen.getByText('Compare: false → true')).toBeInTheDocument()
    expect(screen.getByText(/preset:fullPartner:v1/)).toBeInTheDocument()
  })
})
describe('unsaved provisioning choices', () => {
  it('keeps Client v1 insights off, exposes explicit Unified and omits partner-only controls', async () => {
    render(<form><ProvisioningFeatureSelection type="client" /></form>)
    expect(screen.getByRole('checkbox',{name:'Unified Trajectory'})).not.toBeChecked()
    expect(screen.queryByRole('checkbox',{name:'Client provisioning'})).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox',{name:'Unified Trajectory'}))
    const form = document.querySelector('form')!
    const data = new FormData(form)
    expect(JSON.parse(String(data.get('featureConfiguration')))).toMatchObject({ unifiedTrajectory:true, compare:false, trajectory:false, clientProvisioning:false })
    expect(screen.getByText(/Unified Trajectory: true/)).toBeInTheDocument()
  })
  it('rejects a publishing override before authoring and cascades prerequisite disables in the unsaved form', async () => {
    render(<form><ProvisioningFeatureSelection type="partner" /></form>)
    await userEvent.click(screen.getByRole('checkbox',{name:'Assessment publishing'}))
    expect(screen.getByText('Enable Assessment authoring first.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox',{name:'Assessment publishing'})).not.toBeChecked()
    await userEvent.selectOptions(screen.getByRole('combobox',{name:'Preset (version 1)'}),'fullPartner')
    expect(screen.getByRole('checkbox',{name:'Assessment publishing'})).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox',{name:'Assessment authoring'}))
    expect(screen.getByRole('checkbox',{name:'Assessment publishing'})).not.toBeChecked()
    expect(JSON.parse(String(new FormData(document.querySelector('form')!).get('featureConfiguration')))).toMatchObject({ assessmentAuthoring:false, assessmentPublishing:false, clientProvisioning:true })
  })
})
