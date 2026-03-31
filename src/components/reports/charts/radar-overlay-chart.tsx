'use client'

import { cn } from '@/lib/utils'

interface RadarOverlayChartProps {
  labels: string[]
  layers: { source: string; values: number[]; color: string; dashed?: boolean }[]
  size?: number
  variant?: 'light' | 'dark'
  className?: string
}

export function RadarOverlayChart({
  labels,
  layers,
  size = 240,
  variant = 'light',
  className,
}: RadarOverlayChartProps) {
  const isDark = variant === 'dark'
  const cx = size / 2
  const cy = size / 2
  const maxRadius = size / 2 - 30
  const n = labels.length

  const getPoint = (index: number, radius: number): [number, number] => {
    const angle = (2 * Math.PI / n) * index - Math.PI / 2
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  }

  const polygonPoints = (radiusFraction: number): string =>
    labels
      .map((_, i) => getPoint(i, maxRadius * radiusFraction).join(','))
      .join(' ')

  const gridColour = isDark ? 'rgba(255,255,255,0.08)' : 'var(--report-divider)'
  const axisColour = isDark ? 'rgba(255,255,255,0.06)' : 'var(--report-divider)'
  const labelColour = isDark ? 'rgba(255,255,255,0.7)' : 'var(--report-muted-colour)'

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {/* Grid rings at 33%, 66%, 100% */}
        {[0.33, 0.66, 1].map((fraction) => (
          <polygon
            key={fraction}
            points={polygonPoints(fraction)}
            fill="none"
            stroke={gridColour}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines from centre to each vertex */}
        {labels.map((_, i) => {
          const [px, py] = getPoint(i, maxRadius)
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={px}
              y2={py}
              stroke={axisColour}
              strokeWidth={1}
            />
          )
        })}

        {/* Layer polygons — rendered back to front */}
        {layers.map((layer) => {
          const dataPoints = layer.values.map((v, i) => getPoint(i, maxRadius * (v / 100)))
          const pointsStr = dataPoints.map((p) => p.join(',')).join(' ')

          return (
            <g key={layer.source}>
              <polygon
                points={pointsStr}
                fill={layer.color}
                fillOpacity={0.12}
                stroke={layer.color}
                strokeWidth={2}
                strokeDasharray={layer.dashed ? '6 4' : undefined}
              />
              {dataPoints.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={4} fill={layer.color} />
              ))}
            </g>
          )
        })}

        {/* Text labels outside each vertex */}
        {labels.map((label, i) => {
          const [px, py] = getPoint(i, maxRadius + 16)
          const angle = (2 * Math.PI / n) * i - Math.PI / 2
          const textAnchor =
            Math.cos(angle) < -0.1 ? 'end' : Math.cos(angle) > 0.1 ? 'start' : 'middle'
          return (
            <text
              key={i}
              x={px}
              y={py}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize={10}
              fill={labelColour}
            >
              {label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      {layers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
          {layers.map((layer) => (
            <div key={layer.source} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: layer.color }}
              />
              <span
                className="text-[10px]"
                style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--report-muted-colour)' }}
              >
                {layer.source}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
