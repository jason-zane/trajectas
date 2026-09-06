'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { CanvasPoint } from '@/lib/canvas/types'
import { DataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { changeFor, displayDate, measures, score, signed, trajectorySeries, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { StudioChart, trajectoryChartLines } from './studio-chart'
import styles from './studio.module.css'

type TimelineRow = ReturnType<typeof trajectorySeries>[number] & { color: string }
export function StudioTimeline({ dataset, settings, onChange, onSession }: {
  dataset: StudioDataset; settings: StudioSettings; onChange: (patch: Partial<StudioSettings>) => void; onSession: (point: CanvasPoint, person: string, measure: string) => void;
}) {
  const single = settings.people.length === 1
  const all = measures(dataset.result, settings)
  const lines = trajectoryChartLines(dataset, settings)
  const difference = settings.valueMode === 'difference' && settings.reference !== 'none'
  const hasReference = settings.reference !== 'none'
  const intervalsAvailable = lines.some((line) => line.points.some((p) => p.ciLower !== null && p.ciUpper !== null))
  const visible = lines.filter((line) => line.points.length && (!difference || line.reference.value !== null))
  const columns: ColumnDef<TimelineRow>[] = [
    { id: 'label', header: single ? 'Measure' : 'Person', cell: ({ row }) => <span className={styles.seriesName}><i style={{ background: row.original.color }} />{row.original.label}</span> },
    { id: 'first', header: 'First', cell: ({ row }) => <div className={styles.tableScore}><strong>{score(row.original.points[0]?.value)}</strong><small>{displayDate(row.original.points[0]?.completedAt, true)}</small></div> },
    { id: 'latest', header: 'Latest', cell: ({ row }) => <div className={styles.tableScore}><strong>{score(row.original.points.at(-1)?.value)}</strong><small>{displayDate(row.original.points.at(-1)?.completedAt, true)}</small></div> },
    { id: 'change', header: 'Change', cell: ({ row }) => <span className={styles.changeNumber}>{signed(changeFor(row.original.points))}<small> pts</small></span> },
    ...(hasReference ? [{ id: 'reference', header: settings.reference === 'group' ? 'Fixed group mean' : 'Reference', cell: ({ row }: { row: { original: TimelineRow } }) => <div className={styles.tableReference}><strong>{score(row.original.reference.value)}</strong>{row.original.reference.n !== null && <small>n={row.original.reference.n}</small>}</div> }, { id: 'difference', header: 'Latest vs ref', cell: ({ row }: { row: { original: TimelineRow } }) => <span>{row.original.points.length && row.original.reference.value !== null ? signed(row.original.points.at(-1)!.value - row.original.reference.value) : '—'} pts</span> }] : []),
  ]
  return <>
    {single && <details className={styles.measurePicker}><summary>Measures on this chart <strong>{settings.timeMeasures.length} selected</strong></summary><div className={styles.measurePickerBody}>
      <div className={styles.measurePresets}><span>Choose up to 6 measures</span><button onClick={() => onChange({ timeMeasures: all.filter((m) => m.level === 'dimension').slice(0, 6).map((m) => m.id) })}>Dimensions</button>{all.some((m) => m.level === 'overall') && <button onClick={() => onChange({ timeMeasures: ['__overall'] })}>Overall only</button>}</div>
      <div className={styles.measureChoices}>{all.map((m) => <label key={m.id} className={m.level === 'factor' ? styles.factorChoice : ''}><input type="checkbox" aria-label={`Show ${m.name}`} checked={settings.timeMeasures.includes(m.id)} disabled={!settings.timeMeasures.includes(m.id) && settings.timeMeasures.length >= 6} onChange={(e) => onChange({ timeMeasures: e.target.checked ? [...settings.timeMeasures, m.id] : settings.timeMeasures.filter((id) => id !== m.id) })} />{m.name}</label>)}</div>
    </div></details>}
    {!lines.length ? <EmptyState size="sm" title="Choose measures to plot" description="Open Measures on this chart and select the dimensions or factors you want to follow." /> : !visible.length ? <EmptyState size="sm" title={difference ? 'No compatible reference for these measures' : 'No measured history in this scope'} description={difference ? 'Choose another reference, select a different measure, or switch back to scores.' : 'Try another assessment, campaign, or date range.'} /> : <>
      <div className={styles.timelineLegend}>{lines.map((line) => <span key={line.id}><i style={{ background: line.color }} />{line.label}{!line.points.length && <small> · no result</small>}{difference && line.reference.value === null && <small> · no reference</small>}</span>)}</div>
      <StudioChart lines={lines} showIntervals={settings.showIntervals} difference={difference} onSession={(point, id) => { const line = lines.find((l) => l.id === id)!; onSession(point, dataset.result.people.find((p) => p.personKey === line.personKey)?.displayName ?? 'Person', all.find((m) => m.id === line.entityId)?.name ?? 'Score') }} />
      {intervalsAvailable && <label className={styles.intervalToggle}><input type="checkbox" checked={settings.showIntervals} onChange={(e) => onChange({ showIntervals: e.target.checked })} />Show stored score intervals</label>}
      {lines.every((line) => line.points.length < 2) && <p className={styles.inlineNote}>Two measured attempts are needed to show change. A single result is shown as a point.</p>}
    </>}
    {!!lines.length && <div className={styles.timeSummary}><DataTable columns={columns} data={lines} hideClientPagination pageSize={8} /><p>Change is latest minus first, in score points. {single ? 'Each line follows one measure for this person.' : 'Each line follows one person on the same measure.'}</p></div>}
  </>
}
