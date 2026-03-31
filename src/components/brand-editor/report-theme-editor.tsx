'use client'

import { ColorPicker } from './color-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReportTheme } from '@/lib/reports/presentation'

interface ReportThemeEditorProps {
  value: ReportTheme
  onChange: (theme: ReportTheme) => void
}

export function ReportThemeEditor({ value, onChange }: ReportThemeEditorProps) {
  const update = (key: keyof ReportTheme, v: string) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="space-y-6">
      {/* Live preview panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportThemePreview theme={value} />
        </CardContent>
      </Card>

      {/* Score Colours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Score Band Colours</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">High Band</p>
            <ColorPicker label="Fill" value={value.reportHighBandFill} onChange={(v) => update('reportHighBandFill', v)} />
            <ColorPicker label="Badge BG" value={value.reportHighBadgeBg} onChange={(v) => update('reportHighBadgeBg', v)} />
            <ColorPicker label="Badge Text" value={value.reportHighBadgeText} onChange={(v) => update('reportHighBadgeText', v)} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Mid Band</p>
            <ColorPicker label="Fill" value={value.reportMidBandFill} onChange={(v) => update('reportMidBandFill', v)} />
            <ColorPicker label="Badge BG" value={value.reportMidBadgeBg} onChange={(v) => update('reportMidBadgeBg', v)} />
            <ColorPicker label="Badge Text" value={value.reportMidBadgeText} onChange={(v) => update('reportMidBadgeText', v)} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Low Band</p>
            <ColorPicker label="Fill" value={value.reportLowBandFill} onChange={(v) => update('reportLowBandFill', v)} />
            <ColorPicker label="Badge BG" value={value.reportLowBadgeBg} onChange={(v) => update('reportLowBadgeBg', v)} />
            <ColorPicker label="Badge Text" value={value.reportLowBadgeText} onChange={(v) => update('reportLowBadgeText', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Surfaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Report Surfaces</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <ColorPicker label="Page Background" value={value.reportPageBg} onChange={(v) => update('reportPageBg', v)} />
          <ColorPicker label="Card Background" value={value.reportCardBg} onChange={(v) => update('reportCardBg', v)} />
          <ColorPicker label="Card Border" value={value.reportCardBorder} onChange={(v) => update('reportCardBorder', v)} />
          <ColorPicker label="Divider" value={value.reportDivider} onChange={(v) => update('reportDivider', v)} />
          <ColorPicker label="Featured Background" value={value.reportFeaturedBg} onChange={(v) => update('reportFeaturedBg', v)} />
          <ColorPicker label="Featured Text" value={value.reportFeaturedText} onChange={(v) => update('reportFeaturedText', v)} />
          <ColorPicker label="Featured Accent" value={value.reportFeaturedAccent} onChange={(v) => update('reportFeaturedAccent', v)} />
          <ColorPicker label="Inset Background" value={value.reportInsetBg} onChange={(v) => update('reportInsetBg', v)} />
          <ColorPicker label="Inset Border" value={value.reportInsetBorder} onChange={(v) => update('reportInsetBorder', v)} />
          <ColorPicker label="CTA Background" value={value.reportCtaBg} onChange={(v) => update('reportCtaBg', v)} />
          <ColorPicker label="CTA Text" value={value.reportCtaText} onChange={(v) => update('reportCtaText', v)} />
          <ColorPicker label="Cover Accent" value={value.reportCoverAccent} onChange={(v) => update('reportCoverAccent', v)} />
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Typography Colours</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <ColorPicker label="Headings" value={value.reportHeadingColour} onChange={(v) => update('reportHeadingColour', v)} />
          <ColorPicker label="Body Text" value={value.reportBodyColour} onChange={(v) => update('reportBodyColour', v)} />
          <ColorPicker label="Muted Text" value={value.reportMutedColour} onChange={(v) => update('reportMutedColour', v)} />
          <ColorPicker label="Labels" value={value.reportLabelColour} onChange={(v) => update('reportLabelColour', v)} />
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Chart Colours</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <ColorPicker label="Radar Fill" value={value.reportRadarFill} onChange={(v) => update('reportRadarFill', v)} />
          <ColorPicker label="Radar Stroke" value={value.reportRadarStroke} onChange={(v) => update('reportRadarStroke', v)} />
          <ColorPicker label="Radar Points" value={value.reportRadarPoint} onChange={(v) => update('reportRadarPoint', v)} />
          <ColorPicker label="Bar Dot" value={value.reportBarDot} onChange={(v) => update('reportBarDot', v)} />
        </CardContent>
      </Card>

      {/* 360 Rater Colours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">360 Rater Colours</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <ColorPicker label="Self" value={value.reportRaterSelf} onChange={(v) => update('reportRaterSelf', v)} />
          <ColorPicker label="Manager" value={value.reportRaterManager} onChange={(v) => update('reportRaterManager', v)} />
          <ColorPicker label="Peers" value={value.reportRaterPeers} onChange={(v) => update('reportRaterPeers', v)} />
          <ColorPicker label="Direct Reports" value={value.reportRaterDirects} onChange={(v) => update('reportRaterDirects', v)} />
          <ColorPicker label="Overall" value={value.reportRaterOverall} onChange={(v) => update('reportRaterOverall', v)} />
        </CardContent>
      </Card>
    </div>
  )
}

function ReportThemePreview({ theme }: { theme: ReportTheme }) {
  return (
    <div className="space-y-3 text-xs">
      {/* Featured section preview */}
      <div className="rounded-lg p-4" style={{ background: theme.reportFeaturedBg, color: theme.reportFeaturedText }}>
        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: theme.reportFeaturedAccent }}>Score Overview</p>
        <p className="font-semibold">Featured Block Preview</p>
      </div>

      {/* Bar chart preview */}
      <div className="space-y-2 px-2" style={{ color: theme.reportBodyColour }}>
        {[
          { name: 'High Score', value: 80, fill: theme.reportHighBandFill },
          { name: 'Mid Score', value: 55, fill: theme.reportMidBandFill },
          { name: 'Low Score', value: 30, fill: theme.reportLowBandFill },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="w-16 text-right text-[10px]">{item.name}</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: theme.reportDivider }}>
              <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: item.fill }} />
            </div>
          </div>
        ))}
      </div>

      {/* Band badges */}
      <div className="flex gap-2 px-2">
        {[
          { band: 'high' as const, label: 'High', bg: theme.reportHighBadgeBg, text: theme.reportHighBadgeText },
          { band: 'mid' as const, label: 'Mid', bg: theme.reportMidBadgeBg, text: theme.reportMidBadgeText },
          { band: 'low' as const, label: 'Low', bg: theme.reportLowBadgeBg, text: theme.reportLowBadgeText },
        ].map((b) => (
          <span key={b.band} className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: b.bg, color: b.text }}>
            {b.label}
          </span>
        ))}
      </div>

      {/* Card preview */}
      <div className="rounded-lg border p-3" style={{ background: theme.reportCardBg, borderColor: theme.reportCardBorder }}>
        <p className="font-semibold" style={{ color: theme.reportHeadingColour }}>Card Preview</p>
        <p className="mt-1" style={{ color: theme.reportMutedColour }}>Muted description text</p>
      </div>

      {/* Inset preview */}
      <div className="rounded-lg p-3" style={{ background: theme.reportInsetBg, borderLeft: `3px solid ${theme.reportInsetBorder}` }}>
        <p style={{ color: theme.reportHeadingColour }}>Inset callout preview</p>
      </div>
    </div>
  )
}
