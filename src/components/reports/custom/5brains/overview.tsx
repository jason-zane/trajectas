import type { FiveBrainsBrain, FiveBrainsReportData } from '@/lib/reports/custom/5brains'
import { A4Page, Eyebrow, FiveBrains, PageFooter, PageHeader } from './shared'
import { BrainBarsVertical } from './charts'

export function OverviewPage({
  data,
  pageNum,
}: {
  data: FiveBrainsReportData
  pageNum: number
}) {
  return (
    <A4Page>
      <PageHeader pageNum={pageNum} sectionLabel="Overview" primaryLogoUrl={data.primaryLogoUrl} />

      <div
        style={{
          padding: '30px 56px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <Eyebrow color="rgba(20,15,10,0.45)" size={10}>
          Capability overview
        </Eyebrow>
        <h2
          style={{
            fontSize: 28,
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            margin: 0,
            color: 'var(--mk-text)',
          }}
        >
          Twenty-five capabilities, grouped by <FiveBrains tmSize={0.4} />.
        </h2>
      </div>

      <div style={{ padding: '30px 56px 0' }}>
        <BrainBarsVertical brains={data.brains} height={210} showTypical={false} />
      </div>

      <div
        style={{
          padding: '40px 56px 0',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Eyebrow color="rgba(20,15,10,0.45)" size={10}>
          The detail
        </Eyebrow>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(20,15,10,0.40)',
          }}
        >
          Capability scores by brain
        </span>
      </div>
      <div style={{ padding: '6px 56px 0' }}>
        <div style={{ height: 1, background: 'rgba(20,15,10,0.12)' }} />
      </div>

      <div
        style={{
          padding: '20px 56px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1,
        }}
      >
        {data.brains.map((b, i) => (
          <OverviewRow key={b.id} brain={b} divider={i > 0} />
        ))}
      </div>

      <PageFooter pageNum={pageNum} participantName={data.participant.name} />
    </A4Page>
  )
}

function OverviewRow({ brain, divider }: { brain: FiveBrainsBrain; divider: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingTop: divider ? 14 : 0,
        borderTop: divider ? '1px solid rgba(20,15,10,0.08)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: brain.colour,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: brain.colour,
              fontWeight: 600,
            }}
          >
            {brain.name}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(20,15,10,0.55)',
              lineHeight: 1.3,
              marginLeft: 4,
            }}
          >
            {brain.shortLabel}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          alignItems: 'flex-end',
        }}
      >
        {brain.capabilities.map((c) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span
              style={{
                fontSize: 10,
                lineHeight: 1.3,
                color: 'rgba(20,15,10,0.80)',
                fontWeight: 500,
                minHeight: 26,
              }}
            >
              {c.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div
                style={{
                  flex: 1,
                  height: 5,
                  background: 'rgba(20,15,10,0.08)',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${c.score}%`,
                    background: brain.colour,
                    borderRadius: 2.5,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--mk-text)',
                  width: 20,
                  textAlign: 'right',
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {c.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
