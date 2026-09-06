'use client'

import { useEffect, useRef, useState } from 'react'
import type { CanvasPoint } from '@/lib/canvas/types'
import { displayDate, measures, score, signed, trajectorySeries, type StudioDataset, type StudioSettings, type ReferenceValue } from '@/lib/trajectory-studio/model'
import styles from './studio.module.css'

export const SERIES_COLORS = ['var(--primary)', 'var(--info)', 'var(--chart-5)', 'var(--studio-purple)', 'var(--studio-olive)', 'var(--studio-rose)', 'var(--chart-3)', 'var(--studio-slate)']
export type ChartLine = { id: string; label: string; color: string; points: CanvasPoint[]; reference?: ReferenceValue }

/** Stable identities keep their colours when another measure is removed. */
export function trajectoryChartLines(dataset: StudioDataset, settings: StudioSettings) {
  const all = measures(dataset.result, settings)
  const order = [...all.filter((m) => m.level === 'dimension'), ...all.filter((m) => m.level === 'overall'), ...all.filter((m) => m.level === 'factor')]
  const used = new Set<number>()
  return trajectorySeries(dataset, settings).map((line) => {
    let index = Math.max(0, settings.people.length === 1 ? order.findIndex((m) => m.id === line.entityId) : dataset.result.people.findIndex((p) => p.personKey === line.personKey)) % SERIES_COLORS.length
    while (used.has(index) && used.size < SERIES_COLORS.length) index = (index + 1) % SERIES_COLORS.length
    used.add(index)
    return { ...line, color: SERIES_COLORS[index] }
  })
}

export function StudioChart({ lines, showIntervals, difference = false, onSession }: { lines: ChartLine[]; showIntervals: boolean; difference?: boolean; onSession: (point: CanvasPoint, lineId: string) => void }) {
  const [active, setActive] = useState<{ point: CanvasPoint; line: ChartLine } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const visible = lines.filter((line) => !difference || line.reference?.value != null)
  const all = visible.flatMap((line) => line.points)
  const hasPoints = all.length > 0
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setWidth(Math.max(280, Math.min(900, entry.contentRect.width))) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasPoints])
  if (!hasPoints) return null
  const times = all.map((point) => new Date(point.completedAt).getTime())
  const first = Math.min(...times), last = Math.max(...times), span = Math.max(last - first, 86400000)
  const right = width - 28, plotSpan = right - 52
  const x = (point: CanvasPoint) => first === last ? (right + 52) / 2 : 52 + (new Date(point.completedAt).getTime() - first) / span * plotSpan
  const valueFor = (point: CanvasPoint, line: ChartLine) => point.value - (difference ? line.reference?.value ?? 0 : 0)
  const extent = Math.max(10, Math.ceil(Math.max(0, ...visible.flatMap((line) => line.points.map((p) => Math.abs(valueFor(p, line)) + (showIntervals && p.ciLower !== null && p.ciUpper !== null ? Math.max(Math.abs(p.value - p.ciLower), Math.abs(p.value - p.ciUpper)) : 0)))) / 10) * 10)
  const lower = difference ? -extent : 0, upper = difference ? extent : 100
  const y = (value: number) => 256 - (Math.max(lower, Math.min(upper, value)) - lower) / (upper - lower) * 232
  const tickCount = width < 500 ? 3 : 5
  const ticks = first === last ? [first] : Array.from({ length: tickCount }, (_, i) => first + span * i / (tickCount - 1))
  const references = [...new Map(visible.filter((line) => line.reference?.value != null).map((line) => [line.reference!.value, line])).values()]
  return <div className={styles.timeChart}>
    <div className={styles.chartScroll} ref={viewport}>
      <svg viewBox={`0 0 ${width} 305`} role="img" aria-label={difference ? 'Score differences from the selected reference over calendar time' : 'Assessment scores over calendar time, on a fixed scale from zero to one hundred'}>
        <title>{difference ? 'Difference from reference, in score points' : 'Assessment scores over calendar time'}</title>
        <desc>Each line is labelled below the chart. Dots are completed assessments on their actual dates. Lines join observations; they do not predict intermediate results. Dashed horizontal lines mark the selected reference.</desc>
        {(difference ? [-extent, -extent / 2, 0, extent / 2, extent] : [0, 25, 50, 75, 100]).map((value) => <g key={value}>
          <line x1="52" x2={right} y1={y(value)} y2={y(value)} stroke={difference && value === 0 ? 'var(--gold)' : 'var(--border)'} strokeWidth={difference && value === 0 ? 1.5 : 1} strokeDasharray={value === 0 ? undefined : '3 5'} />
          <text x="37" y={y(value) + 4} textAnchor="end" className={styles.axis}>{difference ? signed(value) : value}</text>
        </g>)}
        {!difference && references.map((line) => <line key={line.reference!.value} data-reference-line="true" x1="52" x2={right} y1={y(line.reference!.value!)} y2={y(line.reference!.value!)} stroke={references.length === 1 ? 'var(--gold)' : line.color} strokeOpacity="0.6" strokeWidth="1.3" strokeDasharray="5 5"><title>{line.label}: {line.reference!.label} {score(line.reference!.value)}</title></line>)}
        {ticks.map((time, i) => <text key={time} x={first === last ? (right + 52) / 2 : 52 + plotSpan * i / (tickCount - 1)} y="288" textAnchor={i === 0 && first !== last ? 'start' : i === tickCount - 1 ? 'end' : 'middle'} className={styles.axis}>{displayDate(new Date(time).toISOString(), true)}</text>)}
        {visible.map((line, index) => <g key={line.id} opacity={active && active.line.id !== line.id ? 0.25 : 1}>
          {showIntervals && line.points.filter((p) => p.ciLower !== null && p.ciUpper !== null).map((point) => {
            const offset = difference ? line.reference?.value ?? 0 : 0
            return <g key={`ci-${point.sessionId}`} stroke={line.color} opacity="0.4"><line x1={x(point)} x2={x(point)} y1={y(point.ciLower! - offset)} y2={y(point.ciUpper! - offset)} strokeWidth="2" /><line x1={x(point) - 4} x2={x(point) + 4} y1={y(point.ciLower! - offset)} y2={y(point.ciLower! - offset)} /><line x1={x(point) - 4} x2={x(point) + 4} y1={y(point.ciUpper! - offset)} y2={y(point.ciUpper! - offset)} /></g>
          })}
          <polyline points={line.points.map((p) => `${x(p)},${y(valueFor(p, line))}`).join(' ')} fill="none" stroke={line.color} strokeWidth="2.7" strokeLinejoin="round" strokeDasharray={index > 3 ? '8 3' : undefined} />
          {line.points.map((point) => <g key={point.sessionId}>
            <circle cx={x(point)} cy={y(valueFor(point, line))} r="4.5" fill="var(--card)" stroke={line.color} strokeWidth="2.3" />
            <circle cx={x(point)} cy={y(valueFor(point, line))} r="11" fill="transparent" tabIndex={0} role="button" aria-label={`${line.label}, score ${score(point.value)}${difference ? `, ${signed(valueFor(point, line))} points from reference` : ''}, ${displayDate(point.completedAt)}. View assessment.`}
              className={styles.chartPoint} onMouseEnter={() => setActive({ point, line })} onMouseLeave={() => setActive(null)} onFocus={() => setActive({ point, line })} onBlur={() => setActive(null)}
              onClick={() => onSession(point, line.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSession(point, line.id) } }} />
          </g>)}
        </g>)}
      </svg>
    </div>
    <div className={styles.chartReadout} aria-live="polite">{active ? <><strong>{active.line.label} · {score(active.point.value)}{active.line.reference?.value != null && ` · ${signed(active.point.value - active.line.reference.value)} vs reference`}</strong><span>{displayDate(active.point.completedAt)} · {active.point.campaignTitle}</span></> : <><span>{difference ? 'Difference in points · zero is the selected reference' : 'Scaled score · 0–100'}{references.length > 0 && !difference && ' · dashed line = reference'}</span><span>Hover or select a point for its result</span></>}</div>
  </div>
}
