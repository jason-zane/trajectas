'use client'

import { useEffect, useRef, useState } from 'react'
import type { CanvasPoint } from '@/lib/canvas/types'
import { displayDate, score } from '@/lib/trajectory-studio/model'
import styles from './studio.module.css'

export const SERIES_COLORS = ['var(--primary)', 'var(--info)', 'var(--chart-5)', 'var(--studio-purple)', 'var(--studio-olive)', 'var(--studio-rose)', 'var(--chart-3)', 'var(--studio-slate)']
export type ChartLine = { id: string; label: string; color: string; points: CanvasPoint[] }

export function StudioChart({ lines, showIntervals, onSession }: { lines: ChartLine[]; showIntervals: boolean; onSession: (point: CanvasPoint, person: string) => void }) {
  const [active, setActive] = useState<{ point: CanvasPoint; label: string } | null>(null)
  const all = lines.flatMap((line) => line.points)
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const hasPoints = all.length > 0
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(280, Math.min(900, entry.contentRect.width)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasPoints])
  if (!hasPoints) return null
  const times = all.map((point) => new Date(point.completedAt).getTime())
  const first = Math.min(...times)
  const last = Math.max(...times)
  const span = Math.max(last - first, 86400000)
  const right = width - 30
  const plotSpan = right - 52
  const x = (point: CanvasPoint) => first === last ? (right + 52) / 2 : 52 + (new Date(point.completedAt).getTime() - first) / span * plotSpan
  const y = (value: number) => 241 - Math.max(0, Math.min(100, value)) / 100 * 211
  const tickCount = width < 500 ? 3 : 5
  const ticks = first === last ? [first] : Array.from({ length: tickCount }, (_, i) => first + span * i / (tickCount - 1))
  return (
    <div className={styles.timeChart}>
      <div className={styles.chartScroll} ref={viewport}>
        <svg viewBox={`0 0 ${width} 290`} role="img" aria-label="Assessment scores over calendar time, on a fixed scale from zero to one hundred">
          <title>Assessment scores over calendar time</title>
          <desc>Dots are completed assessments. Lines join observed results, with no prediction between them. Use the results table for every value.</desc>
          {[0, 25, 50, 75, 100].map((value) => <g key={value}>
            <line x1="52" x2={right} y1={y(value)} y2={y(value)} stroke="var(--border)" strokeDasharray={value === 0 ? undefined : '3 5'} />
            <text x="32" y={y(value) + 4} textAnchor="end" className={styles.axis}>{value}</text>
          </g>)}
          {ticks.map((time, i) => <text key={time} x={first === last ? (right + 52) / 2 : 52 + plotSpan * i / (tickCount - 1)} y="275" textAnchor={i === 0 && first !== last ? 'start' : i === tickCount - 1 ? 'end' : 'middle'} className={styles.axis}>{displayDate(new Date(time).toISOString(), true)}</text>)}
          {lines.map((line, index) => <g key={line.id}>
            {showIntervals && line.points.filter((p) => p.ciLower !== null && p.ciUpper !== null).map((point) => <g key={`ci-${point.sessionId}`} stroke={line.color} opacity="0.4">
              <line x1={x(point)} x2={x(point)} y1={y(point.ciLower!)} y2={y(point.ciUpper!)} strokeWidth="2" />
              <line x1={x(point) - 4} x2={x(point) + 4} y1={y(point.ciLower!)} y2={y(point.ciLower!)} />
              <line x1={x(point) - 4} x2={x(point) + 4} y1={y(point.ciUpper!)} y2={y(point.ciUpper!)} />
            </g>)}
            <polyline points={line.points.map((p) => `${x(p)},${y(p.value)}`).join(' ')} fill="none" stroke={line.color} strokeWidth="2.7" strokeLinejoin="round" strokeDasharray={index > 3 ? '6 4' : undefined} />
            {line.points.map((point) => <g key={point.sessionId}>
              <circle cx={x(point)} cy={y(point.value)} r="5" fill="var(--card)" stroke={line.color} strokeWidth="2.5" />
              <circle cx={x(point)} cy={y(point.value)} r="13" fill="transparent" tabIndex={0} role="button" aria-label={`${line.label}, ${score(point.value)}, ${displayDate(point.completedAt)}. View assessment.`}
                className={styles.chartPoint} onMouseEnter={() => setActive({ point, label: line.label })} onMouseLeave={() => setActive(null)} onFocus={() => setActive({ point, label: line.label })} onBlur={() => setActive(null)}
                onClick={() => onSession(point, line.label)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSession(point, line.label) } }} />
            </g>)}
          </g>)}
        </svg>
      </div>
      <div className={styles.chartReadout} aria-live="polite">{active ? <><strong>{active.label} · {score(active.point.value)}</strong><span>{displayDate(active.point.completedAt)} · {active.point.campaignTitle} · Attempt {active.point.attemptNumber}</span></> : <><span>Scaled score · 0–100</span><span>Actual assessment dates · select a point for details</span></>}</div>
    </div>
  )
}
