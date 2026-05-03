// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { ResolvedBlockData } from '@/lib/reports/types'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

function makeBlocks(theme: typeof DEFAULT_REPORT_THEME): ResolvedBlockData[] {
  return [
    {
      blockId: 'b1',
      type: 'custom_text',
      order: 0,
      data: { content: 'Hello world' },
      resolvedBrandTheme: theme,
    },
    {
      blockId: 'b2',
      type: 'custom_text',
      order: 1,
      data: { content: 'Second block' },
    },
  ]
}

describe('ReportRenderer brand theme', () => {
  it('applies the resolved brand theme as CSS custom properties on the wrapper', () => {
    const customTheme = {
      ...DEFAULT_REPORT_THEME,
      reportPageBg: '#101010',
      reportHeadingColour: '#ff00aa',
      reportCoverAccent: '#00ccff',
    }

    const { container } = render(<ReportRenderer blocks={makeBlocks(customTheme)} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()

    expect(wrapper.style.getPropertyValue('--report-page-bg')).toBe('#101010')
    expect(wrapper.style.getPropertyValue('--report-heading-colour')).toBe('#ff00aa')
    expect(wrapper.style.getPropertyValue('--report-cover-accent')).toBe('#00ccff')
    expect(wrapper.style.getPropertyValue('--report-high-band-fill')).toBe(
      DEFAULT_REPORT_THEME.reportHighBandFill,
    )
  })

  it('omits theme styles when no block carries a resolvedBrandTheme', () => {
    const blocks: ResolvedBlockData[] = [
      { blockId: 'b1', type: 'custom_text', order: 0, data: { content: 'X' } },
    ]
    const { container } = render(<ReportRenderer blocks={blocks} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--report-page-bg')).toBe('')
  })

  it('reads the theme from any block that carries it, not just the first', () => {
    const customTheme = { ...DEFAULT_REPORT_THEME, reportPageBg: '#abcdef' }
    const blocks: ResolvedBlockData[] = [
      { blockId: 'b1', type: 'custom_text', order: 0, data: { content: 'first' } },
      {
        blockId: 'b2',
        type: 'custom_text',
        order: 1,
        data: { content: 'second' },
        resolvedBrandTheme: customTheme,
      },
    ]
    const { container } = render(<ReportRenderer blocks={blocks} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--report-page-bg')).toBe('#abcdef')
  })
})
