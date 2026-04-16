'use client'

import { getBandColour, type BandScheme } from '@/lib/reports/band-scheme'

export function SchemePreview({ scheme }: { scheme: BandScheme }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
      <div className="flex h-4 w-full rounded-full overflow-hidden border">
        {scheme.bands.map((band, i) => {
          const width = Math.max(0, band.max - band.min + 1)
          const colour = getBandColour(scheme.palette, i, scheme.bands.length)
          return (
            <div
              key={`${band.key}-${i}`}
              style={{ width: `${width}%`, background: colour }}
              title={`${band.label} (${band.min}–${band.max})`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  )
}
