'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { changeFor, currentPoint, measures, referenceFor, scopedPoints, score, signed, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import styles from './studio.module.css'

type ScoreRow = { id: string; measure: string; level: string; reference: string; n: number | null; values: Record<string, { value: string; change: string; difference: string }> }

export function StudioTable({ dataset, settings }: { dataset: StudioDataset; settings: StudioSettings }) {
  const hasReference = settings.reference !== 'none'
  const rows: ScoreRow[] = measures(dataset.result, settings).map((entity) => {
    const reference = referenceFor(dataset, settings, entity.id)
    return { id: entity.id, measure: entity.name, level: entity.level, reference: score(reference.value), n: reference.n, values: Object.fromEntries(settings.people.map((key) => {
      const point = currentPoint(dataset.result, key, entity.id, settings)
      return [key, { value: score(point?.value), change: signed(changeFor(scopedPoints(dataset.result, key, entity.id, settings))), difference: point && reference.value !== null ? signed(point.value - reference.value) : '—' }]
    })) }
  })
  const columns = useMemo<ColumnDef<ScoreRow>[]>(() => [
    { id: 'measure', accessorKey: 'measure', header: 'Measure', cell: ({ row }) => <span className={`${styles.tableMeasure} ${row.original.level === 'factor' ? styles.tableFactor : ''}`}>{row.original.measure}</span> },
    ...(hasReference ? [{ id: 'reference', header: settings.reference === 'group' ? 'Group mean' : 'Reference', cell: ({ row }: { row: { original: ScoreRow } }) => <div className={styles.tableReference}><strong>{row.original.reference}</strong>{row.original.n !== null && <small>n={row.original.n}</small>}</div> }] : []),
    ...settings.people.map((key) => ({ id: key, header: dataset.result.people.find((p) => p.personKey === key)?.displayName ?? 'Person', cell: ({ row }: { row: { original: ScoreRow } }) => <div className={styles.tableScore}><strong>{settings.valueMode === 'difference' && hasReference ? row.original.values[key].difference : row.original.values[key].value}</strong>{hasReference && <span>{settings.valueMode === 'difference' ? `${row.original.values[key].value} score` : `${row.original.values[key].difference} vs ref`}</span>}{settings.lens === 'time' && <small>{row.original.values[key].change} change</small>}</div> })),
  ], [settings.people, settings.lens, settings.reference, settings.valueMode, hasReference, dataset.result.people])
  return <div className={styles.scoreTable}><p className={styles.inlineNote}>{settings.lens === 'time' ? 'Latest measured score · change from each measure’s first result in the date range.' : 'Selected campaign results · one attempt per person across every measure.'}{hasReference && ' Differences are in score points. Missing scores are excluded from reference calculations.'}</p><DataTable columns={columns} data={rows} searchableColumns={['measure']} searchPlaceholder="Find a dimension or factor…" pageSize={30} /></div>
}
