import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/reports/report-renderer', () => ({
  ReportRenderer: ({ blocks }: { blocks: unknown[] }) => <div>{JSON.stringify(blocks)}</div>,
}))
import { ReportScreen } from '@/components/assess/report-screen'

describe('participant report release boundary', () => {
  function render(status: string, mode = 'inline') {
    return renderToStaticMarkup(<ReportScreen content={{ reportMode: mode } as never}
      reportStatus={status} renderedData={[{ type: 'custom_text', text: 'PRIVATE_REPORT_CONTENT' }]} />)
  }
  it.each(['pending', 'generating', 'ready', 'failed'])('withholds %s report content even when data is present', status => {
    expect(render(status)).not.toContain('PRIVATE_REPORT_CONTENT')
  })
  it('withholds content in the holding experience', () => {
    expect(render('released', 'holding')).not.toContain('PRIVATE_REPORT_CONTENT')
  })
  it('renders a released inline report', () => {
    expect(render('released')).toContain('PRIVATE_REPORT_CONTENT')
  })
})
