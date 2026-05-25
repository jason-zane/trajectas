import type { FiveBrainsReportData } from '@/lib/reports/custom/5brains'
import {
  A4Page,
  ClientLogoSlot,
  Eyebrow,
  FiveBrains,
  FootMeta,
  Wordmark,
} from './shared'
import { WheelChart } from './charts'

export function CoverPage({ data }: { data: FiveBrainsReportData }) {
  const { participant, brains, compositeScore, generatedAt, primaryLogoUrl, secondaryLogoUrl } =
    data
  const dateLabel = new Date(generatedAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <A4Page bg="var(--mk-bg)">
      {/* Top bar */}
      <div
        style={{
          padding: '44px 56px 0',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Wordmark size={14} src={primaryLogoUrl} />
        <ClientLogoSlot src={secondaryLogoUrl} label={participant.company ?? ''} />
      </div>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          padding: '0 56px',
          display: 'flex',
          alignItems: 'center',
          gap: 36,
        }}
      >
        {/* Left column: copy */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Eyebrow color="var(--mk-primary)" size={11}>
            <FiveBrains tmSize={0.4} /> capability assessment
          </Eyebrow>
          <div
            style={{
              fontSize: 48,
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: '-0.035em',
              color: 'var(--mk-text)',
            }}
          >
            {participant.name}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--mk-text-muted)',
              maxWidth: 280,
            }}
          >
            {participant.jobTitle && (
              <>
                {participant.jobTitle}
                <br />
              </>
            )}
            {participant.company}
          </div>
          <div
            style={{
              height: 1,
              background: 'rgba(20,15,10,0.10)',
              width: 60,
              marginTop: 10,
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginTop: 4,
            }}
          >
            <FootMeta label="Date" value={dateLabel} />
          </div>
        </div>

        {/* Right column: wheel + composite */}
        <div style={{ position: 'relative', paddingRight: 24 }}>
          <WheelChart size={320} brains={brains} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              right: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(20,15,10,0.45)',
              }}
            >
              Composite
            </div>
            <div
              style={{
                fontSize: 46,
                fontWeight: 800,
                color: 'var(--mk-text)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              {compositeScore}
            </div>
          </div>
        </div>
      </div>

      {/* Brain legend */}
      <div
        style={{
          padding: '0 56px 36px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 14,
        }}
      >
        {brains.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 12,
              borderTop: `3px solid ${b.colour}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: b.colour,
                  flexShrink: 0,
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
            <span style={{ fontSize: 11, lineHeight: 1.3, color: 'rgba(20,15,10,0.65)' }}>
              {b.shortLabel}
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--mk-text)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {b.score}
            </span>
          </div>
        ))}
      </div>
    </A4Page>
  )
}
