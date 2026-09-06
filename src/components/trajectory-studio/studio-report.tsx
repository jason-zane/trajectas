'use client'

import { useState } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { assessmentOptions, buildStudioCsv, displayDate, exportRows, referenceOptions, snapshotCaption, snapshotSession, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { StudioChart, trajectoryChartLines } from './studio-chart'
import { StudioSnapshot } from './studio-snapshot'
import styles from './studio.module.css'

export function StudioExport({ dataset, settings, title, open, onOpenChange }: { dataset: StudioDataset; settings: StudioSettings; title: string; open: boolean; onOpenChange: (value: boolean) => void }) {
  const [anonymize, setAnonymize] = useState(false)
  const rows = exportRows(dataset, settings, anonymize)
  const time = settings.lens === 'time'
  const multi = settings.representation === 'table' && settings.includeAllAssessments
  const assessments = assessmentOptions(dataset.result)
  const assessment = assessments.find((a) => a.id === settings.assessment)?.name ?? 'Assessment'
  const scopeName = multi ? `${assessments.length} separate assessments` : assessment
  const reference = referenceOptions(dataset, settings).find((r) => r.id === settings.reference)
  const hasReference = settings.reference !== 'none'
  const displayTitle = anonymize ? `Trajectory · ${time ? 'Progress' : 'Comparison'} report` : title
  const nameFor = (key: string, index: number) => anonymize ? `Person ${index + 1}` : dataset.result.people.find((p) => p.personKey === key)?.displayName ?? 'Person'
  const chartLines = trajectoryChartLines(dataset, settings).map((line) => ({ ...line,
    label: settings.people.length === 1 ? line.label : nameFor(line.personKey, settings.people.indexOf(line.personKey)),
  }))
  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([buildStudioCsv(dataset, settings, anonymize)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url
    link.download = `trajectas-${settings.lens}${dataset.demo ? '-demo' : ''}.csv`
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('CSV exported', { description: `${rows.length} result rows, including reference values and source details.` })
  }
  function printReport() {
    onOpenChange(false)
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>Export this view</DialogTitle><DialogDescription>Your result selections and reference are carried into the export.</DialogDescription></DialogHeader>
      <div className={styles.exportSummary}><FileText size={28} /><div><strong>{displayTitle}</strong><p>{settings.people.length} {settings.people.length === 1 ? 'person' : 'people'} · {scopeName}</p><p>{time ? `${displayDate(settings.from)} – ${displayDate(settings.to)}` : snapshotCaption(dataset.result, settings)}</p><p>Reference: {settings.reference === 'group' ? 'Selected group mean' : reference?.name ?? 'None'}</p></div></div>
      {dataset.demo && <p className={styles.demoNotice}>All demo results and reference values are labelled illustrative.</p>}
      <label className={styles.checkLabel}><input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} /><span><strong>Use anonymous labels</strong><small>Replace names with Person 1, Person 2… and omit session IDs.</small></span></label>
      <div className={styles.exportActions}><button className={styles.secondaryButton} disabled={!rows.length} onClick={downloadCsv}><Download size={16} />Download CSV</button><button className={styles.primaryButton} disabled={!rows.length} onClick={printReport}><Printer size={16} />Print / save PDF</button></div>
      <p className={styles.finePrint}>The PDF includes the current chart and a full results appendix. CSV includes all measured dimensions and factors, scores, reference values, sample sizes, differences and campaign provenance. Missing results are omitted. PDF opens your browser’s print dialog.</p>
    </DialogContent></Dialog>
    <article className={styles.printReport}>
      <header><span>TRAJECTAS · {dataset.workspaceName}</span><h1>{displayTitle}</h1><p>{scopeName} · {time ? 'Over time' : 'Snapshot'} · {settings.people.length} selected {settings.people.length === 1 ? 'person' : 'people'}</p><p>{time ? `${displayDate(settings.from)} – ${displayDate(settings.to)}` : snapshotCaption(dataset.result, settings)}</p></header>
      {dataset.demo && <p><strong>ILLUSTRATIVE DEMO DATA — fictional people, results and reference values.</strong></p>}
      <p>Scaled scores, 0–100. Each assessment retains its own measures and reference basis. {time ? 'Change is latest minus first for each measure, in the selected history range.' : 'Each person contributes one selected completed campaign result per assessment. Missing measures are not filled from earlier attempts.'}</p>
      {settings.reference === 'group' ? <><p><strong>Reference: selected group mean.</strong> The arithmetic mean of available scores in the selected snapshot results, calculated separately for each measure. Includes the person being compared; n varies with missing scores. At least two results are required. This is a descriptive average, not a population norm.{time && ' This reference is fixed for the full history; it is not a changing cohort average.'}</p><div className={styles.reportSources}>{settings.people.map((key, index) => { const session = snapshotSession(dataset.result, key, settings); return <p key={key}>{nameFor(key, index)}: {session ? `${session.campaignTitle} · ${displayDate(session.completedAt)} · attempt ${session.attemptNumber}` : 'No reference result selected'}</p> })}</div></> : reference && <p><strong>Reference: {reference.name}.</strong> {reference.description} Version: {reference.version}.</p>}
      <p>Differences describe observed scores; they do not establish statistically reliable change. Generated {new Intl.DateTimeFormat('en-AU', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date())}. Confidential.</p>
      <section className={styles.reportOverview}><h2>{assessment} · {time ? 'Progress over time' : 'Comparison snapshot'}</h2><p>{settings.valueMode === 'difference' && hasReference ? 'Difference from reference, in score points.' : 'Scaled scores, 0–100.'}</p>
        {time ? <><div className={styles.chartLegend}>{chartLines.map((line) => <span key={line.id}><i style={{ background: line.color }} /><strong>{line.label}</strong></span>)}</div><StudioChart lines={chartLines} showIntervals={settings.showIntervals} difference={settings.valueMode === 'difference' && hasReference} onSession={() => {}} /></> : <StudioSnapshot dataset={dataset} settings={settings} anonymize={anonymize} />}
      </section>
      <h2>Results appendix</h2>
      {settings.people.map((key, index) => (multi ? assessments : assessments.filter((a) => a.id === settings.assessment)).map((a) => {
        const ownRows = rows.filter((r) => r.personKey === key && r.assessmentId === a.id)
        const source = snapshotSession(dataset.result, key, { ...settings, assessment: a.id })
        const columnCount = 2 + (time ? 3 : 0) + (hasReference ? 2 : 0)
        return <section key={`${key}-${a.id}`}>{!ownRows.length ? <><h2>{nameFor(key, index)} · {a.name}</h2><p>No completed result in this scope.</p></> : <table><thead><tr><th colSpan={columnCount} className={styles.reportPersonHeader}>{nameFor(key, index)} · {a.name}</th></tr>{!time && <tr><th colSpan={columnCount}>{source?.campaignTitle} · {displayDate(source?.completedAt)} · attempt {source?.attemptNumber}</th></tr>}<tr><th>Measure</th><th>Score</th>{time && <><th>Date / campaign / attempt</th><th>Baseline</th><th>Change</th></>}{hasReference && <><th>Reference / n</th><th>Difference</th></>}</tr></thead><tbody>{ownRows.map((r, rowIndex) => <tr key={rowIndex}><td>{r.measure}</td><td>{r.score}</td>{time && <><td>{displayDate(r.completed)}<br />{r.campaign} / {r.attempt}</td><td>{displayDate(r.baseline)}</td><td>{r.change || '—'}</td></>}{hasReference && <><td>{r.referenceValue || '—'}{r.referenceN && ` / n=${r.referenceN}`}</td><td>{r.difference || '—'}</td></>}</tr>)}</tbody></table>}</section>
      }))}
      <footer>Trajectas · {dataset.demo ? 'Design review / illustrative data' : 'Confidential assessment results'}</footer>
    </article>
  </>
}
