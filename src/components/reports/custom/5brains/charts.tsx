// Chart components for the 5Brains report — pure SVG, no animation libs.

import type { FiveBrainsBrain } from '@/lib/reports/custom/5brains'

// ---------------------------------------------------------------------------
// WheelChart — 25 radial bars, color-coded by brain. One sector per brain,
// 5 bars per sector. Each bar's radial length encodes the capability score.
// ---------------------------------------------------------------------------

export function WheelChart({
  size = 320,
  brains,
  gap = 6,
}: {
  size?: number
  brains: FiveBrainsBrain[]
  gap?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const rInner = size * 0.18
  const rOuter = size * 0.42
  const rLabel = size * 0.475

  const sectorAngle = (2 * Math.PI) / 5
  const gapAngle = (gap * Math.PI) / 180
  const capAngle = (sectorAngle - gapAngle) / 5

  const arc = (a1: number, a2: number, r1: number, r2: number) => {
    const x1 = cx + Math.cos(a1) * r2
    const y1 = cy + Math.sin(a1) * r2
    const x2 = cx + Math.cos(a2) * r2
    const y2 = cy + Math.sin(a2) * r2
    const x3 = cx + Math.cos(a2) * r1
    const y3 = cy + Math.sin(a2) * r1
    const x4 = cx + Math.cos(a1) * r1
    const y4 = cy + Math.sin(a1) * r1
    return `M ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 0 0 ${x4} ${y4} Z`
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
    >
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(20,15,10,0.08)" strokeWidth={1} />
      <circle
        cx={cx}
        cy={cy}
        r={rInner + (rOuter - rInner) * 0.5}
        fill="none"
        stroke="rgba(20,15,10,0.06)"
        strokeDasharray="2 3"
        strokeWidth={0.75}
      />
      <circle
        cx={cx}
        cy={cy}
        r={rInner}
        fill="none"
        stroke="rgba(20,15,10,0.10)"
        strokeWidth={0.75}
      />
      {brains.map((b, bi) => {
        const sectorStart = -Math.PI / 2 + bi * sectorAngle + gapAngle / 2
        const aMid = sectorStart + (sectorAngle - gapAngle) / 2
        const lx = cx + Math.cos(aMid) * rLabel
        const ly = cy + Math.sin(aMid) * rLabel
        const anchor =
          Math.abs(Math.cos(aMid)) < 0.2 ? 'middle' : Math.cos(aMid) > 0 ? 'start' : 'end'
        const isTop = Math.sin(aMid) < -0.4
        const isBottom = Math.sin(aMid) > 0.4
        const baseDy = isTop ? '-0.6em' : isBottom ? '0.7em' : '-0.1em'
        return (
          <g key={b.id}>
            {b.capabilities.map((c, ci) => {
              const a1 = sectorStart + ci * capAngle
              const a2 = a1 + capAngle * 0.88
              const r2 = rInner + (rOuter - rInner) * (c.score / 100)
              return (
                <g key={c.id}>
                  <path d={arc(a1, a2, rInner, rOuter)} fill={b.colour} fillOpacity={0.1} />
                  <path d={arc(a1, a2, rInner, r2)} fill={b.colour} />
                </g>
              )
            })}
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              fontSize={10}
              fontWeight={600}
              letterSpacing="0.10em"
              fontFamily="var(--font-mono)"
              fill={b.colour}
              style={{ textTransform: 'uppercase' }}
            >
              <tspan x={lx} dy={baseDy}>
                {b.name}
              </tspan>
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ContinuumBar — score dot with optional typical-range band overlay.
// ---------------------------------------------------------------------------

export function ContinuumBar({
  score,
  colour,
  typicalRange,
}: {
  score: number
  colour: string
  typicalRange?: { low: number; high: number }
}) {
  const hasRange =
    typicalRange &&
    Number.isFinite(typicalRange.low) &&
    Number.isFinite(typicalRange.high) &&
    typicalRange.high > typicalRange.low
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: 'rgba(20,15,10,0.08)',
          borderRadius: 3,
          overflow: 'visible',
        }}
      >
        {hasRange && typicalRange && (
          <div
            style={{
              position: 'absolute',
              left: `${typicalRange.low}%`,
              width: `${typicalRange.high - typicalRange.low}%`,
              top: 0,
              bottom: 0,
              background: 'rgba(20,15,10,0.20)',
              borderRadius: 3,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            left: `${score}%`,
            top: -4,
            transform: 'translate(-50%, 0)',
            width: 14,
            height: 14,
            borderRadius: 999,
            background: colour,
            boxShadow: '0 0 0 3px white, 0 1px 3px rgba(0,0,0,.15)',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BrainBarsVertical — 5-column histogram, bars rise from baseline.
// ---------------------------------------------------------------------------

export function BrainBarsVertical({
  brains,
  height = 220,
  typicalRange,
  showSubtitle = true,
  showTypical = false,
}: {
  brains: FiveBrainsBrain[]
  height?: number
  typicalRange?: { low: number; high: number }
  showSubtitle?: boolean
  showTypical?: boolean
}) {
  const tLow = typicalRange?.low ?? 30
  const tHigh = typicalRange?.high ?? 70
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 18,
          alignItems: 'end',
          height,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            pointerEvents: 'none',
          }}
        >
          {[0, 25, 50, 75, 100].map((g) => (
            <div
              key={g}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${g}%`,
                height: 1,
                background: g === 0 ? 'rgba(20,15,10,0.20)' : 'rgba(20,15,10,0.06)',
              }}
            />
          ))}
        </div>

        {brains.map((b) => (
          <div
            key={b.id}
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '22%',
                right: '22%',
                top: 0,
                bottom: 0,
                background: 'rgba(20,15,10,0.05)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {showTypical && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${tLow}%`,
                    height: `${tHigh - tLow}%`,
                    background: 'rgba(20,15,10,0.10)',
                  }}
                />
              )}
            </div>
            <div
              style={{
                position: 'relative',
                width: '56%',
                height: `${b.score}%`,
                background: b.colour,
                borderRadius: '6px 6px 0 0',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -22,
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--mk-text)',
                  letterSpacing: '-0.02em',
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {b.score}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
        {brains.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              paddingTop: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: b.colour,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: b.colour,
                  fontWeight: 600,
                }}
              >
                {b.name}
              </span>
            </div>
            {showSubtitle && (
              <span
                style={{
                  fontSize: 10.5,
                  color: 'rgba(20,15,10,0.65)',
                  textAlign: 'center',
                }}
              >
                {b.shortLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
