// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PartnerDashboard } from '@/app/partner/dashboard/partner-dashboard'
vi.mock('@/components/refresh-on-focus', () => ({ RefreshOnFocus: () => null }))
vi.mock('@/components/campaigns/launch-campaign-button', () => ({ LaunchCampaignButton: () => <button>Create campaign</button> }))
const props = { partnerName: 'Example partner', clients: [], campaigns: [], allocation: [], launchAssessments: [], recentResults: [] }
describe('workspace dashboard presentation', () => {
  it('keeps campaign work and result access while hiding portfolio sections in operational style', () => {
    render(<PartnerDashboard {...props} dashboardStyle="operational" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('in your workspace')
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View results' })).toBeInTheDocument()
    expect(screen.getByText('Participants')).toBeInTheDocument()
    expect(screen.queryByText('Your allocation')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New client' })).not.toBeInTheDocument()
    expect(screen.queryByText('Clients')).not.toBeInTheDocument()
  })
  it('restores client and allocation sections in portfolio style', () => {
    render(<PartnerDashboard {...props} dashboardStyle="portfolio" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('across your portfolio')
    expect(screen.getByText('Your allocation')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'New client' }).length).toBeGreaterThan(0)
  })
})
