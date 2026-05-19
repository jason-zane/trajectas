import type { FiveBrainsBrain, FiveBrainsCapability, FiveBrainsReportData } from '@/lib/reports/custom/5brains'
import { A4Page, PageFooter, PageHeader } from './shared'
import { ContinuumBar } from './charts'

export function BrainPage({
  data,
  brain,
  pageNum,
}: {
  data: FiveBrainsReportData
  brain: FiveBrainsBrain
  pageNum: number
}) {
  return (
    <A4Page>
      <PageHeader
        pageNum={pageNum}
        sectionLabel={`${brain.name} · ${brain.shortLabel}`}
        primaryLogoUrl={data.primaryLogoUrl}
      />

      {/* Full-bleed hero band */}
      <div
        style={{
          padding: '18px 56px 14px',
          background: brain.colour,
          color: 'white',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.70)',
              fontWeight: 500,
            }}
          >
            {brain.name}
          </span>
          <h2
            style={{
              fontSize: 26,
              lineHeight: 1.08,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              margin: 0,
              color: 'white',
            }}
          >
            {brain.shortLabel}
          </h2>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.78)',
              margin: '3px 0 0',
              maxWidth: 480,
            }}
          >
            {brain.summary}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.70)',
            }}
          >
            Brain avg
          </span>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {brain.score}
          </span>
        </div>
      </div>

      {/* Capability rows */}
      <div
        style={{
          padding: '20px 56px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          flex: 1,
        }}
      >
        {brain.capabilities.map((c) => (
          <ContinuumRow
            key={c.id}
            capability={c}
            brainColour={brain.colour}
            typicalRange={data.typicalRange}
          />
        ))}
      </div>

      <PageFooter pageNum={pageNum} participantName={data.participant.name} />
    </A4Page>
  )
}

function ContinuumRow({
  capability,
  brainColour,
  typicalRange,
}: {
  capability: FiveBrainsCapability
  brainColour: string
  typicalRange: { low: number; high: number }
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 3,
              height: 16,
              background: brainColour,
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--mk-text)',
              letterSpacing: '-0.005em',
            }}
          >
            {capability.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: brainColour,
              fontWeight: 600,
            }}
          >
            {capability.bandLabel}
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--mk-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {capability.score}
          </span>
        </div>
      </div>

      <p
        style={{
          fontSize: 9.5,
          lineHeight: 1.45,
          color: 'rgba(20,15,10,0.72)',
          margin: 0,
          paddingLeft: 12,
        }}
      >
        {capability.definition}
      </p>

      <div style={{ marginTop: 1, paddingLeft: 12 }}>
        <ContinuumBar score={capability.score} colour={brainColour} typicalRange={typicalRange} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginTop: 3,
          paddingLeft: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(20,15,10,0.55)',
              fontWeight: 600,
            }}
          >
            ← Low end
          </span>
          <span style={{ fontSize: 9.5, lineHeight: 1.4, color: 'rgba(20,15,10,0.72)' }}>
            {capability.anchorLow}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            textAlign: 'right',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(20,15,10,0.55)',
              fontWeight: 600,
            }}
          >
            High end →
          </span>
          <span style={{ fontSize: 9.5, lineHeight: 1.4, color: 'rgba(20,15,10,0.72)' }}>
            {capability.anchorHigh}
          </span>
        </div>
      </div>
    </div>
  )
}
