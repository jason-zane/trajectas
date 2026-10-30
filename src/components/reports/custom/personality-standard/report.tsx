import type { ReactNode } from 'react'
import { TrajectasLogo } from '@/components/brand/trajectas-logo'
import type { CustomReportRenderContext } from '@/lib/reports/custom'
import type { PersonalityDimension, PersonalityReportData } from '@/lib/reports/custom/personality-standard/data'
import { DEFAULT_PERSONALITY_HEADLINE } from '@/lib/reports/custom/personality-standard/presentation-config'
import { referenceWeightingLabel } from '@/lib/norms/types'
import { PERSONALITY_REPORT_CSS } from './styles'

const title = 'TRAJECTAS PERSONALITY PROFILE'

function Header() {
  return <header className="page-header"><span className="report-header-label">{title}</span><div className="brand"><TrajectasLogo variant="horizontal" height={32} /></div></header>
}

function Footer({ data, number }: { data: PersonalityReportData; number: number }) {
  return <footer className="page-footer"><span>{data.participantName}</span><span className="page-number">{String(number).padStart(2, '0')}</span></footer>
}

function Page({ data, number, className, children }: { data: PersonalityReportData; number: number; className: string; children: ReactNode }) {
  return <article className={`report-page ${className}`} data-page={number}><Header />{children}<Footer data={data} number={number} /></article>
}

function Axis() {
  return <div className="axis" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
}

function Track({ percentile, compact = false, role = 'trait' }: { percentile: number; compact?: boolean; role?: 'trait' | 'dimension' | 'population-example' }) {
  const size = compact ? 11 : 14
  return <div className={`track${compact ? ' compact' : ''}`} data-score={percentile} data-chart-role={role} role="img" aria-label={`Percentile ${percentile}`}>
    <span className="reference-band" aria-hidden="true" /><span className="rail" aria-hidden="true" />
    <span className="dot" style={{ left: `calc(${percentile}% - ${size / 2}px)` }} aria-hidden="true" />
  </div>
}

function Cover({ data }: { data: PersonalityReportData }) {
  const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(data.assessedAt))
  return <article className="report-page cover" data-page={1}>
    <header className="page-header"><div className="brand"><TrajectasLogo variant="horizontal" light height={32} /></div></header>
    <div className="cover-body"><p className="cover-profile-title">{title}</p><h1>{(data.coverHeadline ?? DEFAULT_PERSONALITY_HEADLINE).split(/\n/).map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</h1></div>
    <div className="cover-art" aria-hidden="true"><svg viewBox="0 0 794 402"><g transform="translate(0 44)"><circle cx="608" cy="355" r="372" fill="var(--motif-deep)" /><circle cx="665" cy="335" r="309" fill="var(--motif-mid)" /><circle cx="722" cy="315" r="246" fill="var(--motif-soft)" /><circle cx="779" cy="295" r="183" fill="var(--motif-gold)" /></g></svg></div>
    <div className="cover-person"><p className="cover-format">Results report</p><div><p className="eyebrow">PREPARED FOR</p><h2>{data.participantName}</h2></div><div className="cover-date"><p className="eyebrow">REPORT DATE</p><h3>{date}</h3></div></div>
  </article>
}

function Overview({ data }: { data: PersonalityReportData }) {
  return <Page data={data} number={2} className="overview">
    <div className="overview-heading"><h1>Personality<br />dimensions</h1></div>
    <div className="overview-key"><span>Result</span><span>Dimension</span><Axis /></div>
    <div className="dimension-list">{data.dimensions.map(d => <section className="dimension-row" data-domain={d.code} key={d.code}>
      <div className="dimension-result"><strong>{d.percentile}</strong></div>
      <div className="dimension-copy"><h2>{d.name}</h2><p>{d.definition}</p></div>
      <div className="dimension-chart"><Track percentile={d.percentile} role="dimension" /><div className="anchors"><span>{d.lowAnchor}</span><span>{d.highAnchor}</span></div></div>
    </section>)}</div>
  </Page>
}

function FullProfile({ data }: { data: PersonalityReportData }) {
  return <Page data={data} number={3} className="full-profile">
    <div className="profile-title"><h1>Your full profile</h1></div>
    <div className="profile-key profile-row"><span>Dimension / trait</span><span /><Axis /><span /><span className="score-key">Result</span></div>
    <div className="profile-table">{data.dimensions.map(d => <section className="profile-group" key={d.code}>
      {[d, ...d.facets].map((s, i) => <div className={`profile-row ${i === 0 ? 'dimension-profile-row' : 'trait-profile-row'}`} data-name={s.name} key={s.code}>
        {i === 0 ? <h2 className="name">{s.name}</h2> : <span className="name">{s.name}</span>}
        <span className="lower-end">{s.lowAnchor}</span><Track percentile={s.percentile} compact role={i === 0 ? 'dimension' : 'trait'} />
        <span className="higher-end">{s.highAnchor}</span><strong className="score">{s.percentile}</strong>
      </div>)}
    </section>)}</div>
  </Page>
}

function Dimension({ data, dimension: d, number }: { data: PersonalityReportData; dimension: PersonalityDimension; number: number }) {
  return <Page data={data} number={number} className="domain-detail">
    <div className="detail-heading"><div className="detail-hero"><div><h1>{d.name}</h1><p>{d.definition}</p></div><div className="detail-result"><strong>{d.percentile}</strong></div></div>
      <div className="dimension-scale"><Axis /><Track percentile={d.percentile} role="dimension" /></div>
    </div>
    <div className="domain-poles"><div><h2>{d.lowAnchor}</h2><p>{d.lower}</p></div><div><h2>{d.highAnchor}</h2><p>{d.higher}</p></div></div>
    <div className="trait-key"><h2>Traits</h2></div>
    <div className="trait-stack">{d.facets.map(f => <section className="trait-strip" data-name={f.name} data-reversed={f.reversed} key={f.code}>
      <header className="strip-heading"><h2>{f.name}</h2><div className="strip-result"><strong>{f.percentile}</strong></div></header>
      <div className="strip-description"><p>{f.definition}</p></div><Track percentile={f.percentile} compact />
      <div className="strip-poles"><p><span>{f.lower}</span></p><p><span>{f.higher}</span></p></div>
    </section>)}</div>
  </Page>
}

function Information({ data }: { data: PersonalityReportData }) {
  return <Page data={data} number={9} className="information">
    <div className="info-heading"><h1>Assessment<br />information</h1></div>
    <div className="information-grid"><main className="reading-guide">
      <section><h2>Understanding percentiles</h2><p>Your results show where your scores sit within a comparison group of peers. A percentile of 75 means your score is higher than those of approximately 75% of that group.</p>
        <div className="example-chart"><Axis /><Track percentile={75} role="population-example" /><div className="example-labels"><strong>75</strong></div></div>
        <div className="population-reference"><p className="population-note">The 50th percentile is the midpoint of the comparison group, with approximately half of people scoring on either side.</p><p className="reference-note">Shading marks the central 40% of the comparison group, between the 30th and 70th percentiles.</p></div>
      </section>
      <section><h2>Dimensions and traits</h2><p>Dimensions describe broad areas of personality. Each dimension contains six traits. The descriptions at either end of each chart show how that trait can be expressed.</p></section>
      <section><h2>Score direction</h2><p>Moving to the right indicates more of the trait named in the report. For Emotional Reactivity, this means greater sensitivity to difficult emotions. For Social Confidence and Stress Tolerance, it means greater confidence and composure.</p></section>
    <section className="reference"><h2>Reference</h2><p>Johnson, J. A. (2014). Measuring thirty facets of the Five Factor Model with a 120-item public domain inventory: Development of the IPIP-NEO-120. <i>Journal of Research in Personality, 51</i>, 78-89.</p><p>doi.org/10.1016/j.jrp.2014.05.003 <span>·</span> ipip.ori.org</p>
      {data.reference.attribution && <p>{data.reference.attribution}</p>}
      {data.reference.sourceUrl && <p>{data.reference.sourceUrl}</p>}
      {data.reference.intendedUse && <p>{data.reference.intendedUse}</p>}
      <p className="design-credit">Report design and presentation by Trajectas.</p></section>
    </main><aside className="assessment-details"><dl>
      <div><dt>Report format</dt><dd>Results report</dd></div><div><dt>Assessment</dt><dd className="assessment-name">TRAJECTAS<br />PERSONALITY PROFILE</dd></div>
      <div><dt>Format</dt><dd>120-item self-report questionnaire</dd></div><div><dt>Profile</dt><dd>Five dimensions<br />30 traits</dd></div>
      <div><dt>Primary results</dt><dd>Percentile ranks</dd></div><div><dt>Comparison group</dt><dd>{data.reference.label}</dd></div>
      <div><dt>Reference version</dt><dd>{data.reference.version}</dd></div>
      {data.reference.rawN != null && <div><dt>Reference sample</dt><dd>{data.reference.rawN.toLocaleString('en-AU')} responses{data.reference.effectiveN != null && Math.round(data.reference.effectiveN) !== data.reference.rawN && <><br />Effective N {Math.round(data.reference.effectiveN).toLocaleString('en-AU')}</>}</dd></div>}
      <div><dt>Report edition</dt><dd>{data.editionNumber ?? 1}</dd></div>
      {data.reference.ageBoundsInclusive && <div><dt>Reference ages</dt><dd>{data.reference.ageBoundsInclusive.join("–")}</dd></div>}
      {data.reference.weighting && <div><dt>Weighting</dt><dd>{referenceWeightingLabel(data.reference.weighting)}</dd></div>}
    </dl><section><h2>Assessment basis</h2><p>Based on the IPIP-NEO-120 (Johnson, 2014), a public-domain personality inventory.</p></section></aside></div>

  </Page>
}

export function PersonalityStandardReport({ data }: { data: PersonalityReportData; ctx: CustomReportRenderContext }) {
  return <div className="tpp-report" data-template-version="1"><style>{PERSONALITY_REPORT_CSS}</style><div className="report-shell"><div className="report-grid">
    <Cover data={data} /><Overview data={data} /><FullProfile data={data} />{data.dimensions.map((d, i) => <Dimension data={data} dimension={d} number={4 + i} key={d.code} />)}<Information data={data} />
  </div></div></div>
}
