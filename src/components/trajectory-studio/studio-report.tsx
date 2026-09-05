'use client'

import { useState } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { assessmentOptions, buildStudioCsv, displayDate, exportRows, measures, scopedPoints, score, snapshotPoint, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { StudioChart, SERIES_COLORS } from './studio-chart'
import styles from './studio.module.css'

export function StudioExport({ dataset, settings, title, open, onOpenChange }: { dataset: StudioDataset; settings: StudioSettings; title: string; open: boolean; onOpenChange: (value: boolean) => void }) {
  const [anonymize, setAnonymize] = useState(false)
  const rows = exportRows(dataset, settings, anonymize)
  const assessment = assessmentOptions(dataset.result).find((a) => a.id === settings.assessment)?.name ?? 'Assessment'
  const multi = settings.representation === 'table' && settings.includeAllAssessments
  const scopeName = multi ? `${assessmentOptions(dataset.result).length} separate assessments` : assessment
  const metricName = measures(dataset.result, settings).find((m) => m.id === settings.metric)?.name ?? 'Selected score'
  const chartLines = settings.people.map((key, index) => ({
    id: key,
    label: anonymize ? `Person ${index + 1}` : dataset.result.people.find((p) => p.personKey === key)?.displayName ?? 'Person',
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: scopedPoints(dataset.result, key, settings.metric, settings),
  }))
  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([buildStudioCsv(dataset, settings, anonymize)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url; link.download = `trajectas-${settings.lens}-${settings.to || 'results'}${dataset.demo ? '-demo' : ''}.csv`
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('CSV exported', { description: `${rows.length} result rows with assessment dates and scope.` })
  }
  function printReport() {
    // The print-only report is always mounted. Closing the modal restores body focus.
    onOpenChange(false)
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>Export this view</DialogTitle><DialogDescription>The report uses your selected people, assessment, campaigns, and dates.</DialogDescription></DialogHeader>
      <div className={styles.exportSummary}><FileText size={28} /><div><strong>{title}</strong><p>{settings.people.length} people · {scopeName}</p><p>{displayDate(settings.from)} – {displayDate(settings.to)}</p><p>{settings.lens === 'time' ? 'All completed attempts in this window' : 'Latest completed attempt in this window per person'}</p></div></div>
      {dataset.demo && <p className={styles.demoNotice}>Illustrative demo data is labelled throughout the export.</p>}
      <label className={styles.checkLabel}><input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} /><span><strong>Use anonymous labels</strong><small>Replace names with Person 1, Person 2… and omit session IDs.</small></span></label>
      <div className={styles.exportActions}><button className={styles.secondaryButton} disabled={!rows.length} onClick={downloadCsv}><Download size={16} />Download CSV</button><button className={styles.primaryButton} disabled={!rows.length} onClick={printReport}><Printer size={16} />Print / save PDF</button></div>
      <p className={styles.finePrint}>CSV includes all measured dimensions and factors. The PDF layout includes the same dated results. Missing results are omitted, never treated as zero. PDF opens your browser’s print dialog.</p>
    </DialogContent></Dialog>
    <article className={styles.printReport}>
      <header><span>TRAJECTAS · {dataset.workspaceName}</span><h1>{title}</h1><p>{scopeName} · {settings.lens === 'time' ? 'Over time' : 'Snapshot'}</p><p>{displayDate(settings.from)} – {displayDate(settings.to)} · {settings.people.length} selected people</p></header>
      {dataset.demo && <p><strong>ILLUSTRATIVE DEMO DATA — fictional people and results.</strong></p>}
      <p>Scaled scores, 0–100. Scores stay attached to their assessment basis; no averages across instruments. {settings.lens === 'time' ? 'Change is in score points from each person’s first measured result in this window. Different measures may have different baseline dates.' : 'Each person uses their latest completed attempt in this window. Actual dates may differ.'} Values describe observed results; differences do not establish statistically reliable or meaningful change.</p>
      <p>Generated {new Intl.DateTimeFormat('en-AU', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date())}. This export is fixed at generation. Confidential.</p>
      <section className={styles.reportOverview}><h2>{assessment} / {metricName} · {settings.lens === 'time' ? 'Progress over time' : 'Comparison snapshot'}</h2>
        <div className={styles.chartLegend}>{chartLines.map((line) => <span key={line.id}><i style={{ background: line.color }} /><strong>{line.label}</strong></span>)}</div>
        {settings.lens === 'time' ? <StudioChart lines={chartLines} showIntervals={settings.showIntervals} onSession={() => {}} /> : <svg viewBox={`0 0 700 ${chartLines.length * 42 + 48}`} role="img" aria-label={`${metricName}, snapshot scores`}>
          {[0, 25, 50, 75, 100].map((value) => <g key={value}><line x1={180 + value * 4.5} x2={180 + value * 4.5} y1="8" y2={chartLines.length * 42 + 10} stroke="var(--border)" strokeDasharray="3 4" /><text x={180 + value * 4.5} y={chartLines.length * 42 + 34} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{value}</text></g>)}
          {chartLines.map((line, index) => { const point = snapshotPoint(dataset.result, line.id, settings.metric, settings); return <g key={line.id}><text x="0" y={index * 42 + 27} fontSize="12" fill="var(--foreground)">{line.label}</text>{point && <><line x1="180" x2={180 + point.value * 4.5} y1={index * 42 + 23} y2={index * 42 + 23} stroke={line.color} strokeWidth="3" /><circle cx={180 + point.value * 4.5} cy={index * 42 + 23} r="5" fill={line.color} /></>}<text x="660" y={index * 42 + 27} fontSize="12" fill="var(--foreground)">{score(point?.value)}</text></g> })}
        </svg>}
      </section>
      {settings.people.map((key, index) => {
        const name = anonymize ? `Person ${index + 1}` : dataset.result.people.find((p) => p.personKey === key)?.displayName
        const ownRows = rows.filter((r) => r.personKey === key)
        return <section key={key}>{!ownRows.length ? <><h2>{name}</h2><p>No completed results in the selected scope.</p></> : <table><thead><tr><th colSpan={(multi ? 5 : 4) + (settings.lens === "time" ? 2 : 0)} className={styles.reportPersonHeader}>{name}</th></tr><tr>{multi && <th>Assessment</th>}<th>Measure</th><th>Score</th><th>Date (UTC)</th>{settings.lens === 'time' && <><th>Baseline</th><th>Change</th></>}<th>Campaign / attempt</th></tr></thead><tbody>{ownRows.map((r, rowIndex) => <tr key={rowIndex}>{multi && <td>{r.assessment}</td>}<td>{r.measure}</td><td>{r.score}</td><td>{displayDate(r.completed)}</td>{settings.lens === 'time' && <><td>{displayDate(r.baseline)}</td><td>{r.change || '—'}</td></>}<td>{r.campaign} / {r.attempt}</td></tr>)}</tbody></table>}</section>
      })}
      <footer>Trajectas · {dataset.demo ? 'Design review / illustrative data' : 'Confidential assessment results'}</footer>
    </article>
  </>
}
