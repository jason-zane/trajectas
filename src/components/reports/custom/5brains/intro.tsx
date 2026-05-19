import type { ReactNode } from 'react'
import type { FiveBrainsReportData } from '@/lib/reports/custom/5brains'
import { A4Page, Eyebrow, FiveBrains, PageFooter, PageHeader } from './shared'
import { BrainBarsVertical } from './charts'

export function IntroPage({
  data,
  pageNum,
}: {
  data: FiveBrainsReportData
  pageNum: number
}) {
  return (
    <A4Page>
      <PageHeader pageNum={pageNum} sectionLabel="Welcome" primaryLogoUrl={data.primaryLogoUrl} />

      <div
        style={{
          padding: '34px 56px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Eyebrow color="rgba(20,15,10,0.45)" size={10}>
          About this report
        </Eyebrow>
        <h2
          style={{
            fontSize: 30,
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            margin: 0,
            color: 'var(--mk-text)',
            maxWidth: 600,
          }}
        >
          A read on your <FiveBrains tmSize={0.4} />,<br />
          and the twenty-five capabilities within them.
        </h2>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'var(--mk-text-muted)',
            maxWidth: 620,
            margin: 0,
          }}
        >
          The <FiveBrains tmSize={0.45} /> capability assessment measures how you operate across
          five distinct modes of work. This report shows where each of those modes currently sits
          for you, and which underlying capabilities are driving the score. Use it as a snapshot
          to focus development, a conversation starter for coaching, or a baseline to measure
          growth against.
        </p>

        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 22,
          }}
        >
          <HowToCol
            n="01"
            title="Five brains"
            body="Capabilities are grouped into five brains — distinct modes you use across your work. Each brain has its own colour throughout this report."
          />
          <HowToCol
            n="02"
            title="Twenty-five capabilities"
            body={
              <span>
                Five capabilities sit within each brain. Together they make up the full{' '}
                <FiveBrains tmSize={0.5} /> framework and describe how the mode shows up in
                behaviour.
              </span>
            }
          />
          <HowToCol
            n="03"
            title="0–100 percentile"
            body="Scores compare you to a relevant peer group. Higher means more consistently demonstrated; lower means more development room."
          />
          <HowToCol
            n="04"
            title="How to use it"
            body="Read the bar chart below for the headline. Step through each brain page for capability-level detail and the behaviours behind each score."
          />
        </div>
      </div>

      <div style={{ padding: '28px 56px 0' }}>
        <div style={{ height: 1, background: 'rgba(20,15,10,0.10)' }} />
      </div>

      <div
        style={{
          padding: '26px 56px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Eyebrow color="rgba(20,15,10,0.45)" size={10}>
            <FiveBrains tmSize={0.55} /> averages
          </Eyebrow>
          <h3
            style={{
              fontSize: 22,
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--mk-text)',
            }}
          >
            At a glance.
          </h3>
        </div>
        <div style={{ marginTop: 16, flex: 1 }}>
          <BrainBarsVertical brains={data.brains} height={250} showTypical={false} />
        </div>
      </div>

      <PageFooter pageNum={pageNum} participantName={data.participant.name} />
    </A4Page>
  )
}

function HowToCol({ n, title, body }: { n: string; title: string; body: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'var(--mk-accent)',
          fontWeight: 600,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: 'var(--mk-text)',
          letterSpacing: '-0.005em',
        }}
      >
        {title}
      </span>
      <p
        style={{
          fontSize: 11,
          lineHeight: 1.55,
          color: 'rgba(20,15,10,0.72)',
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  )
}
