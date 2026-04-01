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
      return <div className="w-20 border-t-[3px] border-primary rounded-full" />
    case 'whitespace':
      return <div className="h-12" />
    case 'dot_break':
      return <div className="text-center text-muted-foreground tracking-[0.5em]">&bull;&bull;&bull;</div>
    case 'thin_rule':
    default:
      return <div className="border-t border-border" />
  }
}
