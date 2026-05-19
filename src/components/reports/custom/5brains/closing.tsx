import type { FiveBrainsReportData } from '@/lib/reports/custom/5brains'
import { A4Page, ClientLogoSlot, Eyebrow, FiveBrains, FootMeta, Wordmark } from './shared'

export function ClosingPage({ data }: { data: FiveBrainsReportData }) {
  const { brains, participant, generatedAt, primaryLogoUrl, secondaryLogoUrl } = data
  const dateLabel = new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <A4Page bg="var(--mk-bg)">
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

      <div
        style={{
          flex: 1,
          padding: '0 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          textAlign: 'center',
        }}
      >
        <Eyebrow color="var(--mk-primary)" size={11}>
          End of report
        </Eyebrow>

        <h1
          style={{
            fontSize: 56,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            margin: 0,
            color: 'var(--mk-text)',
            maxWidth: 560,
          }}
        >
          Thank&nbsp;you,
          <br />
          {participant.firstName}.
        </h1>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--mk-text-muted)',
            maxWidth: 460,
            margin: 0,
          }}
        >
          This report is a snapshot, not a verdict. Take it into your next conversation, set the
          focus areas that matter most, and use it as a baseline to measure growth against.
        </p>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 28,
            alignItems: 'center',
          }}
        >
          <FootMeta label="Participant" value={participant.name} />
          <div
            style={{
              width: 1,
              height: 28,
              background: 'rgba(20,15,10,0.10)',
            }}
          />
          <FootMeta label="Date" value={dateLabel} />
          <div
            style={{
              width: 1,
              height: 28,
              background: 'rgba(20,15,10,0.10)',
            }}
          />
          <FootMeta
            label="Assessment"
            value={
              <span>
                <FiveBrains tmSize={0.55} />
              </span>
            }
          />
        </div>
      </div>

      <div
        style={{
          padding: '0 56px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {brains.map((b) => (
            <div
              key={b.id}
              style={{
                flex: 1,
                height: 6,
                background: b.colour,
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: 'var(--mk-primary)', fontWeight: 500 }}>
            Confidential · Not for redistribution
          </span>
          <span style={{ color: 'rgba(20,15,10,0.45)' }}>trajectas.com</span>
          <span style={{ color: 'var(--mk-accent)', fontWeight: 600 }}>End</span>
        </div>
      </div>
    </A4Page>
  )
}
