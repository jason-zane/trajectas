'use client'

import type { CSSProperties } from 'react'
import type { CanvasPoint } from '@/lib/canvas/types'
import { referenceFor, score, signed, snapshotMeasures, snapshotPoint, snapshotSession, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { SERIES_COLORS } from './studio-chart'
import styles from './studio.module.css'

export function StudioSnapshot({ dataset, settings, onSession, anonymize = false }: {
  dataset: StudioDataset; settings: StudioSettings; onSession?: (point: CanvasPoint, person: string, measure: string) => void; anonymize?: boolean;
}) {
  const result = dataset.result
  const cards = snapshotMeasures(result, settings).map((measure) => ({
    measure, reference: referenceFor(dataset, settings, measure.id),
    rows: settings.people.map((key, index) => ({
      key, name: anonymize ? `Person ${index + 1}` : result.people.find((p) => p.personKey === key)?.displayName ?? 'Person',
      color: SERIES_COLORS[Math.max(0, result.people.findIndex((p) => p.personKey === key)) % SERIES_COLORS.length],
      point: snapshotPoint(result, key, measure.id, settings),
      session: snapshotSession(result, key, settings),
    })),
  }))
  const difference = settings.valueMode === 'difference' && settings.reference !== 'none'
  const deviations = cards.flatMap((card) => card.rows.flatMap((row) => row.point && card.reference.value !== null ? [Math.abs(row.point.value - card.reference.value)] : []))
  const extent = Math.max(10, Math.ceil(Math.max(0, ...deviations) / 10) * 10)
  return <div className={styles.comparisonCards} data-testid="snapshot-cards">
    {cards.map(({ measure, rows, reference }) => <section key={measure.id} className={styles.comparisonCard} aria-label={`${measure.name} comparison`}>
      <div className={styles.measureCardHeading}><h3>{measure.name}</h3>{settings.reference !== 'none' && <span>{settings.reference === 'group' ? 'Group mean' : 'Reference'} <strong>{score(reference.value)}</strong>{reference.n !== null && <small>n={reference.n}</small>}</span>}</div>
      <div className={styles.barAxis}><span>{difference ? `−${extent}` : '0'}</span><span>{difference ? '0 · reference' : '50'}</span><span>{difference ? `+${extent} pts` : '100'}</span></div>
      {rows.map(({ key, name, color, point, session }) => {
        const delta = point && reference.value !== null ? point.value - reference.value : null
        const hasBar = !!point && (!difference || delta !== null)
        const width = difference ? Math.abs(delta ?? 0) / (extent * 2) * 100 : point?.value ?? 0
        const left = difference ? Math.min(50, 50 + (delta ?? 0) / (extent * 2) * 100) : 0
        const content = <>
          <span className={styles.barLabel}><span><i style={{ background: color }} />{name}</span><span><strong>{difference ? signed(delta) : score(point?.value)}</strong>{!difference && settings.reference !== 'none' && <small>{signed(delta)}<span className="sr-only"> points from {reference.label}</span></small>}{difference && <small>{score(point?.value)}<span className="sr-only"> score</span></small>}</span></span>
          <span className={styles.barTrack} aria-hidden="true">{hasBar && <i className={styles.barFill} style={{ width: `${width}%`, left: `${left}%`, background: color }} />}{difference ? <i className={styles.barZero} /> : reference.value !== null && <i className={styles.barReference} style={{ left: `${reference.value}%` }} />}{!hasBar && <em>{point ? 'Reference unavailable' : session ? 'Not measured in this result' : 'No result selected'}</em>}</span>
        </>
        return onSession && point ? <button key={key} className={styles.namedBar} style={{ '--person-color': color } as CSSProperties} aria-label={`${name}, ${measure.name}, score ${score(point.value)}${delta !== null ? `, ${signed(delta)} points from ${reference.label}` : ''}. View result.`} onClick={() => onSession(point, name, measure.name)}>{content}</button> : <div key={key} className={styles.namedBar}>{content}</div>
      })}
      <p className={styles.cardReferenceNote}>{settings.reference === 'group' ? reference.value === null ? 'At least two measured results are needed for a group mean.' : `${reference.n} of ${settings.people.length} people measured · ${difference ? 'distance from their mean' : 'gold mark = mean; small number = difference'}` : settings.reference === 'none' ? 'Scaled scores · one selected campaign result per person' : reference.value === null ? 'No compatible reference for this measure.' : `${reference.n ? `Reference n=${reference.n} · ` : ''}${difference ? 'distance from reference' : 'gold mark = reference; small number = difference'}`}</p>
    </section>)}
  </div>
}
