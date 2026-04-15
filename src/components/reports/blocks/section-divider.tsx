import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

type DividerStyle = 'thin_rule' | 'thick_rule' | 'whitespace' | 'dot_break'

interface SectionDividerData {
  style?: DividerStyle
}

export function SectionDividerBlock({ data }: { data: Record<string, unknown>; mode?: PresentationMode; chartType?: ChartType }) {
  const d = data as unknown as SectionDividerData
  const style = d.style ?? 'thin_rule'

  switch (style) {
    case 'thick_rule':
      return (
        <div className="mx-10 my-2">
          <div
            className="w-full border-t-[3px] rounded-full"
            style={{ borderColor: 'var(--report-divider)' }}
          />
        </div>
      )
    case 'whitespace':
      return <div className="h-12" />
    case 'dot_break':
      return (
        <div className="mx-10 my-2 text-center tracking-[0.5em]" style={{ color: 'var(--report-muted-colour)' }}>
          &bull;&bull;&bull;
        </div>
      )
    case 'thin_rule':
    default:
      return (
        <div className="mx-10 my-2">
          <div style={{ borderTop: '1px solid var(--report-divider)' }} />
        </div>
      )
  }
}
