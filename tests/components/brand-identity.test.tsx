// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MarketingLoading from '@/app/(marketing)/loading'
import { BrandLogo, BrandFooter } from '@/components/brand/brand-logo'
import { CoverPageBlock } from '@/components/reports/blocks/cover-page'
import { Wordmark, PageHeader } from '@/components/reports/custom/5brains/shared'
import { EmailBrandFrame } from '@/lib/email/brand-frame'
import { generateRunnerTokens } from '@/lib/brand/runner-tokens'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import { trajectasSvg } from '@/lib/brand/svg'
import { WORDMARK_PATH } from '@/lib/brand/wordmark-path'

afterEach(cleanup)

describe('approved platform identity across brand slots', () => {
  it('uses font-independent artwork for a default brand and keeps one accessible name', () => {
    const { getAllByRole, container } = render(<BrandLogo />)
    expect(getAllByRole('img', { name: 'Trajectas' })).toHaveLength(1)
    expect(container.querySelector('svg path')).toHaveAttribute('d', WORDMARK_PATH)
    expect(container.querySelector('text, img')).toBeNull()
  })

  it('preserves an uploaded client logo and the name-only client fallback', () => {
    const { getByRole, rerender, container } = render(<BrandLogo name="Client A" logoUrl="https://client.example/brand/span-wordmark.svg" />)
    expect(getByRole('img', { name: 'Client A' })).toHaveAttribute('src', 'https://client.example/brand/span-wordmark.svg')
    rerender(<BrandLogo name="Client A" />)
    expect(container).toHaveTextContent('Client A')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('resolves an older 5Brains asset to the current inverse artwork on dark pages', () => {
    const { container } = render(<Wordmark dark src="/reports/5brains/assets/trajectas-lockup.svg" />)
    expect(container.querySelector('svg path')).toHaveAttribute('fill', '#ffffff')
    expect(container.querySelectorAll('rect')).toHaveLength(4)
    expect(container.querySelectorAll('rect')[3]).toHaveAttribute('fill', '#c9a962')
  })

  it('uses the wordmark alone in custom-report running headers', () => {
    const { container } = render(<PageHeader pageNum={2} sectionLabel="Overview" />)
    expect(container.querySelector('svg path')).toHaveAttribute('d', WORDMARK_PATH)
    expect(container.querySelector('svg rect')).toBeNull()
  })

  it('respects cover logo visibility and preserves the co-brand', () => {
    const { getByRole, rerender, queryByRole, container } = render(<CoverPageBlock data={{ secondaryLogoUrl: 'https://client.example/logo.png' }} />)
    expect(getByRole('img', { name: 'Logo' })).toHaveAttribute('src', 'https://client.example/logo.png')
    expect(getByRole('img', { name: 'Trajectas' })).toBeInTheDocument()
    rerender(<CoverPageBlock data={{ showLogo: false, showPoweredBy: false }} />)
    expect(queryByRole('img')).toBeNull()
    rerender(<CoverPageBlock data={{ showLogo: false, showPoweredBy: true, poweredByText: 'Prepared by our team' }} />)
    expect(container).toHaveTextContent('Prepared by our team')
  })

  it('adapts only the platform signature in runner themes and leaves custom footer copy intact', () => {
    const light = generateRunnerTokens({ ...TRAJECTAS_DEFAULTS, runnerTheme: 'light' }).tokens
    const dark = generateRunnerTokens({ ...TRAJECTAS_DEFAULTS, runnerTheme: 'dark' }).tokens
    expect(light['--runner-logo-wordmark']).toBe('#1a1a1a')
    expect(dark['--runner-logo-wordmark']).toBe('#ffffff')
    const { container, rerender } = render(<BrandFooter text="Powered by Trajectas" runner />)
    expect(container.querySelector('svg path')).toHaveAttribute('fill', 'var(--runner-logo-wordmark, #1a1a1a)')
    rerender(<BrandFooter text="Your responses are confidential" />)
    expect(container).toHaveTextContent('Your responses are confidential')
    expect(container.querySelector('svg')).toBeNull()
    rerender(<BrandFooter text="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('uses the matching PNG for email clients without SVG support', () => {
    const { getByRole } = render(<EmailBrandFrame brandName="Trajectas" primaryColor="#2d6a5a" textColor="#1a1a1a" footerTextColor="#737373" bodyHtml="<p>Hello</p>" />)
    expect(getByRole('img', { name: 'Trajectas' })).toHaveAttribute('src', 'https://trajectas.com/brand/span-lockup-horizontal.png')
  })

  it('uses the inverse identity on the dark marketing loading screen', () => {
    const { container } = render(<MarketingLoading />)
    expect(container.querySelector('svg path')).toHaveAttribute('fill', '#ffffff')
  })

  it('uses the same outlined wordmark in standalone PDF and social-image markup', () => {
    const svg = trajectasSvg()
    expect(svg).toContain(WORDMARK_PATH)
    expect(svg).not.toContain('<text')
    expect(svg).not.toContain('<img')
    expect(svg).not.toContain('trajectas.')
  })
})
