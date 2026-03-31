'use client'

import { cn } from '@/lib/utils'

interface RadarChartProps {
  items: { name: string; value: number }[] // value 0-100
  size?: number // default 240
  variant?: 'light' | 'dark'
  className?: string
}

export function RadarChart({ items, size = 240, variant = 'light', className }: RadarChartProps) {
  const isDark = variant === 'dark'
  const cx = size / 2
  const cy = size / 2
  const maxRadius = size / 2 - 30
  const n = items.length

  const getPoint = (index: number, radius: number): [number, number] => {
    const angle = (2 * Math.PI / n) * index - Math.PI / 2
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  }

  const polygonPoints = (radiusFraction: number): string =>
    items
      .map((_, i) => getPoint(i, maxRadius * radiusFraction).join(','))
      .join(' ')

  const dataPoints = items.map((item, i) => getPoint(i, maxRadius * (item.value / 100)))
  const dataPolygon = dataPoints.map((p) => p.join(',')).join(' ')

  const gridColour = isDark ? 'rgba(255,255,255,0.08)' : 'var(--report-divider)'
  const axisColour = isDark ? 'rgba(255,255,255,0.06)' : 'var(--report-divider)'
  const labelColour = isDark ? 'rgba(255,255,255,0.7)' : 'var(--report-muted-colour)'

  return (
    <div className={cn('flex justify-center items-center py-2', className)}>
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
        {items.map((_, i) => {
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

        {/* Data polygon */}
        <polygon
          points={dataPolygon}
          fill="var(--report-radar-fill)"
          stroke="var(--report-radar-stroke)"
          strokeWidth={2}
        />

        {/* Data point circles */}
        {dataPoints.map(([px, py], i) => (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={4}
            fill="var(--report-radar-point)"
          />
        ))}

        {/* Text labels outside each vertex */}
        {items.map((item, i) => {
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
              {item.name}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
