import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PersonalityStandardReport } from '@/components/reports/custom/personality-standard/report'
import { buildPersonalityPreviewData, PERSONALITY_REPORT_SLUG } from '@/lib/reports/custom/personality-standard/data'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('standard personality report rendering', () => {
  it('renders nine pages, all 30 traits and the continuous profile without narrative or ratings', () => {
    const data = buildPersonalityPreviewData()
    const html = renderToStaticMarkup(<PersonalityStandardReport data={data} ctx={{ brandTheme: DEFAULT_REPORT_THEME, participantName: data.participantName, generatedAt: data.assessedAt }} />)
    expect(html.match(/<article /g)).toHaveLength(9)
    expect(html.match(/class="trait-strip"/g)).toHaveLength(30)
    expect(html.match(/profile-row (?:trait|dimension)-profile-row/g)).toHaveLength(35)
    expect(html.replace(/<style>[\s\S]*?<\/style>/g, '')).not.toMatch(/range-label|data-range=|Your pattern|<b>Lower|<b>Higher/)
    expect(html).toContain('data-reversed="true"')
    expect(html).toContain('30th and 70th percentiles')
    expect(html).toContain('>02</span>')
    expect(html).toContain('>09</span>')
  })
  it('escapes participant data and freezes the cover date from the payload', () => {
    const data = { ...buildPersonalityPreviewData(), participantName: '<img src=x onerror=alert(1)>' }
    const html = renderToStaticMarkup(<PersonalityStandardReport data={data} ctx={{ brandTheme: DEFAULT_REPORT_THEME, participantName: data.participantName, generatedAt: '2030-01-01' }} />)
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('30 October 2026')
  })
  it('uses the isolated custom preview only when the registered template opts in', () => {
    const custom = buildTemplatePreviewBlocks([], [], 'Standard', undefined, PERSONALITY_REPORT_SLUG)
    expect(custom).toHaveLength(1)
    expect(custom[0].type).toBe('custom')
    expect((custom[0].data.payload as ReturnType<typeof buildPersonalityPreviewData>).reference.id).toBe('design-preview')
    expect(buildTemplatePreviewBlocks([]).some(b => b.type === 'custom')).toBe(false)
  })
})
