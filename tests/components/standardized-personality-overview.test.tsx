// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StandardizedPersonalityOverview } from '@/components/assessments/standardized-personality-overview'
import { AssessmentEditShell } from '@/app/(dashboard)/assessments/[id]/edit/assessment-edit-shell'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'

const routing = vi.hoisted(() => ({ pathname: '/assessments/native/edit/overview' }))
vi.mock('next/navigation', () => ({ usePathname: () => routing.pathname }))
vi.mock('@/components/portal-context', () => ({ usePortal: () => ({ features: { reportTemplateLibrary: true } }) }))
vi.mock('@/components/route-tabs', () => ({ RouteTabs: () => <nav aria-label="Assessment tabs" /> }))

describe('standardized assessment authoring', () => {
  it('shows the complete read-only overview instead of hiding all assessment information', () => {
    render(<AssessmentEditShell assessment={{ id: 'native', title: 'Trajectas Personality Profile', status: 'active' }} customReportLockName={null} standardized standardizedContent={<StandardizedPersonalityOverview description="Self-reported personality tendencies." />}>
      <input aria-label="Generic mutable title" />
    </AssessmentEditShell>)
    expect(screen.getByText('About this profile')).toBeInTheDocument()
    expect(screen.getByText(/Based on IPIP-NEO-120/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Generic mutable title')).toBeNull()
    expect(screen.queryByText(/remains in draft/)).toBeNull()
    const statements = screen.getByRole('list', { name: 'Personality statements', hidden: true })
    expect(within(statements).getAllByRole('listitem', { hidden: true })).toHaveLength(120)
    for (const item of IPIP_ITEMS) expect(within(statements).getByText(item.stem)).toBeInTheDocument()
    expect(within(statements).queryByText(/never told a lie/)).toBeNull()
    expect(within(statements).queryByText(/Describe a situation/)).toBeNull()
    expect(screen.getByText(/Their displays reverse the original Self-Consciousness and Vulnerability/)).toBeInTheDocument()
  })

  it('keeps the compatible-report configuration accessible', () => {
    routing.pathname = '/assessments/native/edit/reports'
    render(<AssessmentEditShell assessment={{ id: 'native', title: 'Trajectas Personality Profile', status: 'active' }} customReportLockName={null} standardized standardizedContent={<p>Overview</p>}><p>Compatible report configuration</p></AssessmentEditShell>)
    expect(screen.getByText('Compatible report configuration')).toBeInTheDocument()
    expect(screen.queryByText('Overview')).toBeNull()
    routing.pathname = '/assessments/native/edit/overview'
  })
})
