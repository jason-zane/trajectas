'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { changeFor, displayDate, measures, scopedPoints, score, signed, snapshotPoint, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import styles from './studio.module.css'

type ScoreRow = { id: string; measure: string; values: Record<string, { value: string; date: string; change: string }> }

export function StudioTable({ dataset, settings, onMeasure }: { dataset: StudioDataset; settings: StudioSettings; onMeasure: (id: string) => void }) {
  const rows: ScoreRow[] = measures(dataset.result, settings).map((entity) => ({ id: entity.id, measure: entity.name, values: Object.fromEntries(settings.people.map((key) => {
    const point = snapshotPoint(dataset.result, key, entity.id, settings)
    return [key, { value: score(point?.value), date: point ? displayDate(point.completedAt, true) : 'No result', change: point ? signed(changeFor(scopedPoints(dataset.result, key, entity.id, settings))) : '—' }]
  })) }))
  const columns = useMemo<ColumnDef<ScoreRow>[]>(() => [
    { id: 'measure', accessorKey: 'measure', header: 'Measure', cell: ({ row }) => <button className={styles.tableMeasure} onClick={() => onMeasure(row.original.id)}>{row.original.measure}</button> },
    ...settings.people.map((key) => ({ id: key, header: dataset.result.people.find((p) => p.personKey === key)?.displayName ?? 'Person', cell: ({ row }: { row: { original: ScoreRow } }) => <div className={styles.tableScore}><strong>{row.original.values[key].value}</strong>{settings.lens === 'time' && <span>{row.original.values[key].change} pts</span>}<small>{row.original.values[key].date}</small></div> })),
  ], [settings.people, settings.lens, dataset.result.people, onMeasure])
  return <div className={styles.scoreTable}><DataTable columns={columns} data={rows} searchableColumns={['measure']} searchPlaceholder="Find a dimension or factor…" pageSize={30} /></div>
}
