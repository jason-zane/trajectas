import { monoPath } from '@/lib/canvas/chart-geometry'
import {
  NOISE_FLOOR,
  biggestChange,
  canvasTitle,
  comparisonLede,
  formatSigned,
  monthYear,
  rangeSentence,
  soloLede,
  spread,
  statsFor,
  type PersonStat,
} from '@/lib/canvas/summarize'
import {
  OVERALL_ID,
  type CanvasEntity,
  type CanvasResult,
} from '@/lib/canvas/types'

/**
 * The growth report: a print-ready, multi-page rendering of a frozen
 * trajectory canvas. Server component — all charts are static SVG. Page
 * structure follows the approved mockup: cover → executive summary →
 * dimension overview → one in-depth page per dimension (methodology on
 * the last one).
 */

const PRINT_PALETTE = [
  '#1D9E75',
  '#7F77DD',
  '#D85A30',
  '#D4537E',
  '#378ADD',
  '#0F6E56',
  '#BA7517',
  '#99355E',
] as const

const TYPICAL = { low: 30, high: 70 } as const
const INK = '#1a2421'
const MUTED = '#68716d'
const FAINT = '#9aa39e'
const GOLD = '#c9a962'
const GOLD_TEXT = '#a8854c'
const BORDER = '#e4e1d8'
const EMERALD_DARK = '#1e4a3e'

function deltaColour(d: number | null): string {
  if (d === null || Math.abs(d) < NOISE_FLOOR) return FAINT
  return d > 0 ? '#1D9E75' : '#D85A30'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Static charts
// ---------------------------------------------------------------------------

function PrintLineChart({
  result,
  entityId,
  height = 260,
}: {
  result: CanvasResult
  entityId: string
  height?: number
}) {
  const W = 680
  const H = height
  const pl = 36
  const pr = 150
  const pt = 16
  const pb = 28

  const seriesByPerson = result.people.map((person, i) => ({
    name: person.displayName,
    colour: PRINT_PALETTE[i % PRINT_PALETTE.length],
    points: (
      result.series.find(
        (s) => s.personKey === person.personKey && s.entityId === entityId,
      )?.points ?? []
    ).map((p) => ({ date: Date.parse(p.completedAt), value: p.value })),
  }))

  const allDates = seriesByPerson.flatMap((s) => s.points.map((p) => p.date))
  const allValues = seriesByPerson.flatMap((s) => s.points.map((p) => p.value))
  if (allValues.length === 0) {
    return <p style={{ fontSize: 11, color: FAINT }}>Not measured yet.</p>
  }
  const minDate = Math.min(...allDates)
  const maxDate = Math.max(...allDates)
  const span = Math.max(1, maxDate - minDate)
  const lo = Math.max(0, Math.floor((Math.min(...allValues) - 8) / 10) * 10)
  const hi = Math.min(100, Math.ceil((Math.max(...allValues) + 8) / 10) * 10)
  const xf = (d: number) => pl + 14 + ((d - minDate) / span) * (W - pl - pr - 28)
  const yf = (v: number) => pt + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pt - pb)

  const grid: number[] = []
  for (let v = lo; v <= hi; v += 10) grid.push(v)

  const bandLow = Math.max(lo, TYPICAL.low)
  const bandHigh = Math.min(hi, TYPICAL.high)

  const labels = seriesByPerson
    .filter((s) => s.points.length > 0)
    .map((s) => {
      const last = s.points[s.points.length - 1]
      const first = s.points[0]
      return {
        name: s.name,
        colour: s.colour,
        y: yf(last.value),
        latest: last.value,
        delta: s.points.length >= 2 ? last.value - first.value : null,
      }
    })
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y < labels[i - 1].y + 15) labels[i].y = labels[i - 1].y + 15
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Scores over time">
      {grid.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={yf(v)} y2={yf(v)} stroke="#eceadf" strokeWidth={1} />
          <text x={pl - 7} y={yf(v) + 3.5} textAnchor="end" fontSize={9.5} fill={FAINT}>
            {v}
          </text>
        </g>
      ))}
      {bandHigh > bandLow && (
        <>
          <rect
            x={pl}
            y={yf(bandHigh)}
            width={W - pl - pr}
            height={yf(bandLow) - yf(bandHigh)}
            fill={GOLD}
            opacity={0.1}
          />
          <text x={pl + 7} y={yf(bandHigh) + 12} fontSize={9.5} fill={GOLD_TEXT}>
            Typical range
          </text>
        </>
      )}
      <text x={pl} y={H - 8} fontSize={9.5} fill={FAINT}>
        {monthYear(new Date(minDate).toISOString())}
      </text>
      <text x={W - pr} y={H - 8} textAnchor="end" fontSize={9.5} fill={FAINT}>
        {monthYear(new Date(maxDate).toISOString())}
      </text>
      {seriesByPerson.map((s) => {
        if (s.points.length === 0) return null
        const pts = s.points.map((p) => ({ x: xf(p.date), y: yf(p.value) }))
        return (
          <g key={s.name}>
            {pts.length >= 2 && (
              <path
                d={monoPath(pts)}
                fill="none"
                stroke={s.colour}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.8} fill={s.colour} stroke="#fff" strokeWidth={1.2} />
            ))}
          </g>
        )
      })}
      {labels.map((l) => (
        <g key={l.name}>
          <text x={W - pr + 10} y={l.y + 3.5} fontSize={10} fontWeight={600} fill={l.colour}>
            {l.name.length > 18 ? `${l.name.slice(0, 17)}…` : l.name}
          </text>
          <text x={W - 8} y={l.y + 3.5} textAnchor="end" fontSize={10} fill={MUTED}>
            {l.latest}
            {l.delta !== null ? ' ' : ''}
            {l.delta !== null && (
              <tspan fill={deltaColour(l.delta)}>{formatSigned(l.delta)}</tspan>
            )}
          </text>
        </g>
      ))}
    </svg>
  )
}

function PrintTrackRow({
  stats,
  height = 40,
}: {
  stats: PersonStat[]
  height?: number
}) {
  const x = (v: number) => `${(2 + Math.max(0, Math.min(100, v)) * 0.96).toFixed(2)}%`
  const spacing = stats.length > 1 ? Math.min(7, (height - 12) / (stats.length - 1)) : 0
  const yFor = (i: number) => height / 2 + (i - (stats.length - 1) / 2) * spacing
  return (
    <svg width="100%" height={height} aria-hidden="true" style={{ display: 'block' }}>
      <rect
        x={x(TYPICAL.low)}
        y={2}
        width={`${(TYPICAL.high - TYPICAL.low) * 0.96}%`}
        height={height - 4}
        fill={GOLD}
        opacity={0.1}
      />
      {[0, 50, 100].map((v) => (
        <line key={v} x1={x(v)} x2={x(v)} y1={2} y2={height - 2} stroke="#eceadf" strokeWidth={1} />
      ))}
      {stats.map((s, i) => {
        if (s.latest === null) return null
        const y = yFor(i)
        const colour = PRINT_PALETTE[i % PRINT_PALETTE.length]
        return (
          <g key={s.personKey}>
            {s.delta !== null && s.first !== null && (
              <>
                <line
                  x1={x(s.first)}
                  x2={x(s.latest)}
                  y1={y}
                  y2={y}
                  stroke={colour}
                  strokeWidth={1.6}
                  opacity={0.4}
                />
                <circle cx={x(s.first)} cy={y} r={2.2} fill="#fff" stroke={colour} strokeWidth={1.2} opacity={0.7} />
              </>
            )}
            <circle cx={x(s.latest)} cy={y} r={3.6} fill={colour} stroke="#fff" strokeWidth={1.2} />
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function RunningHeader({ title, period }: { title: string; period: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '18px 56px 0',
        fontSize: 9,
        color: FAINT,
        letterSpacing: '0.06em',
      }}
    >
      <span>Growth report · {title}</span>
      <span>{period}</span>
    </div>
  )
}

function RunningFooter({ note, page, total }: { note: string; page: number; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 56px 20px',
        fontSize: 9,
        color: FAINT,
      }}
    >
      <span>{note}</span>
      <span>
        Page {page} of {total}
      </span>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: GOLD,
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

export function GrowthReportPrint({
  result,
  clientName,
  generatedAt,
}: {
  result: CanvasResult
  clientName: string | null
  generatedAt: string
}) {
  const people = result.people
  const personKeys = people.map((p) => p.personKey)
  const nameByPerson = new Map(people.map((p) => [p.personKey, p.displayName]))
  const title = canvasTitle(people)
  const solo = people.length === 1

  const firstAt = people.reduce<string | null>(
    (acc, p) => (p.firstCompletedAt && (!acc || p.firstCompletedAt < acc) ? p.firstCompletedAt : acc),
    null,
  )
  const lastAt = people.reduce<string | null>(
    (acc, p) => (p.lastCompletedAt && (!acc || p.lastCompletedAt > acc) ? p.lastCompletedAt : acc),
    null,
  )
  const period = `${monthYear(firstAt) ?? '—'} – ${monthYear(lastAt) ?? '—'}`
  const totalSessions = people.reduce((acc, p) => acc + p.completedSessionCount, 0)

  const dimensions = result.entities
    .filter((e) => e.level === 'dimension')
    .sort((a, b) => a.name.localeCompare(b.name))
  const factorsOf = (dim: CanvasEntity) =>
    result.entities
      .filter((e) => e.level === 'factor' && e.parentId === dim.id)
      .sort((a, b) => a.name.localeCompare(b.name))

  const overallStats = statsFor(result.series, OVERALL_ID, personKeys)
  const overallLede = solo
    ? soloLede({
        childStats: dimensions.map((d) => ({
          name: d.name,
          delta: statsFor(result.series, d.id, personKeys)[0]?.delta ?? null,
        })),
        sessionCount: people[0]?.completedSessionCount ?? 0,
        sinceLabel: monthYear(firstAt),
      })
    : comparisonLede({
        entityName: 'the overall composite',
        stats: overallStats,
        nameByPerson,
        sinceLabel: monthYear(firstAt),
      })

  const findings = buildFindings(result, dimensions, personKeys, nameByPerson)
  const totalPages = 3 + dimensions.length

  return (
    <div data-print="true" className="growth-report">
      <style>{`
        .growth-report { background: #fff; color: ${INK}; font-size: 12px; line-height: 1.55; }
        .gr-page { width: 794px; height: 1123px; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; background: #fff; margin: 0 auto; }
        .gr-page:last-child { page-break-after: auto; break-after: auto; }
        .gr-body { padding: 26px 56px 0; flex: 1; min-height: 0; }
        .gr-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .gr-table th { text-align: left; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: ${FAINT}; padding: 6px 8px; border-bottom: 1.5px solid ${BORDER}; }
        .gr-table td { padding: 6px 8px; border-bottom: 1px solid #f0ede4; }
        .gr-table th.num, .gr-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        @page { size: A4; margin: 0; }
        @media print { .growth-report { margin: 0; } }
      `}</style>

      {/* Cover */}
      <div className="gr-page">
        <div style={{ background: EMERALD_DARK, color: '#fff', padding: '60px 56px 44px' }}>
          <p style={{ fontWeight: 800, fontSize: 15, margin: 0 }}>
            Trajec<span style={{ color: GOLD }}>tas</span>
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '72px 0 0' }}>
            Growth report
          </h1>
          <p style={{ color: '#bccfc4', fontSize: 13, margin: '8px 0 0' }}>
            {title} · {period}
          </p>
          <div style={{ height: 3, width: 64, background: GOLD, marginTop: 20 }} />
        </div>
        <div style={{ padding: '38px 56px', flex: 1 }}>
          {[
            ['Prepared for', clientName ?? '—'],
            ['Period', `${totalSessions} completed assessment${totalSessions === 1 ? '' : 's'} · ${fmtDate(firstAt)} – ${fmtDate(lastAt)}`],
            ['Compared against', 'Typical range (30–70) on the 0–100 reporting scale'],
            ['Generated', `${fmtDate(generatedAt)} · frozen snapshot — figures will not change as new results arrive`],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, padding: '11px 0', fontSize: 11.5 }}
            >
              <span style={{ width: 170, flex: 'none', color: FAINT }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, padding: '11px 0', fontSize: 11.5 }}>
            <span style={{ width: 170, flex: 'none', color: FAINT }}>
              {solo ? 'Person' : 'Candidates'}
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {people.map((p, i) => (
                <span key={p.personKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: PRINT_PALETTE[i % PRINT_PALETTE.length],
                      display: 'inline-block',
                    }}
                  />
                  {p.displayName}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 56px 28px',
            fontSize: 9,
            color: FAINT,
          }}
        >
          <span>Confidential — for selection and development use only</span>
          <span>trajectas.com</span>
        </div>
      </div>

      {/* Executive summary */}
      <div className="gr-page">
        <RunningHeader title={title} period={period} />
        <div className="gr-body">
          <Eyebrow>Executive summary</Eyebrow>
          <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 10px' }}>
            What changed across {totalSessions} assessment{totalSessions === 1 ? '' : 's'}
          </h2>
          <p style={{ color: MUTED, fontSize: 11.5, margin: '0 0 14px' }}>{overallLede}</p>
          {findings.length > 0 && (
            <div style={{ margin: '0 0 14px' }}>
              {findings.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 11.5 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      flex: 'none',
                      borderRadius: '50%',
                      border: `1px solid ${GOLD}`,
                      color: GOLD_TEXT,
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
          <PrintLineChart result={result} entityId={OVERALL_ID} height={250} />
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 6px' }}>Overall scores</h3>
          <table className="gr-table">
            <thead>
              <tr>
                <th>{solo ? 'Person' : 'Candidate'}</th>
                <th className="num">First</th>
                <th className="num">Latest</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {people
                .map((p, i) => ({ p, i, s: overallStats[i] }))
                .sort((a, b) => (b.s.latest ?? -1) - (a.s.latest ?? -1))
                .map(({ p, i, s }) => (
                  <tr key={p.personKey}>
                    <td style={{ fontWeight: 600, color: PRINT_PALETTE[i % PRINT_PALETTE.length] }}>
                      {p.displayName}
                    </td>
                    <td className="num">{s.first ?? '—'}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {s.latest ?? '—'}
                    </td>
                    <td className="num" style={{ color: deltaColour(s.delta), fontWeight: 700 }}>
                      {s.delta === null ? '—' : formatSigned(s.delta)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <RunningFooter
          note="Scores run 0–100 · the shaded band is the typical range"
          page={2}
          total={totalPages}
        />
      </div>

      {/* Dimension overview */}
      <div className="gr-page">
        <RunningHeader title={title} period={period} />
        <div className="gr-body">
          <Eyebrow>The dimensions</Eyebrow>
          <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 10px' }}>
            Where {solo ? `${people[0]?.displayName} sits` : 'each candidate sits'}, and how they moved
          </h2>
          <p style={{ color: MUTED, fontSize: 11.5, margin: '0 0 10px' }}>
            Each dot is a {solo ? 'score' : 'candidate'} today; the trailing line is the path since the
            first assessment. The shaded band is the typical range.
          </p>
          {dimensions.map((dim) => {
            const stats = statsFor(result.series, dim.id, personKeys)
            const best = biggestChange(stats)
            const range = rangeSentence(stats)
            return (
              <div key={dim.id} style={{ borderBottom: `1px solid ${BORDER}`, padding: '9px 0 7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 150, flex: 'none', fontSize: 11.5, fontWeight: 700 }}>
                    {dim.name}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <PrintTrackRow stats={stats} />
                  </span>
                </div>
                <p style={{ fontSize: 10, color: MUTED, margin: '3px 0 0 162px' }}>
                  {best && Math.abs(best.delta) >= NOISE_FLOOR
                    ? `Biggest change: ${(nameByPerson.get(best.personKey) ?? '').split(' ')[0]} ${formatSigned(best.delta)}`
                    : 'Within measurement noise'}
                  {range ? ` · ${range.charAt(0).toLowerCase()}${range.slice(1)}` : ''}
                </p>
              </div>
            )
          })}
        </div>
        <RunningFooter
          note="Dimension scores are the average of their factors"
          page={3}
          total={totalPages}
        />
      </div>

      {/* One in-depth page per dimension */}
      {dimensions.map((dim, di) => {
        const factors = factorsOf(dim)
        const isLast = di === dimensions.length - 1
        return (
          <div className="gr-page" key={dim.id}>
            <RunningHeader title={title} period={period} />
            <div className="gr-body">
              <Eyebrow>In depth · {dim.name}</Eyebrow>
              <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 12px' }}>
                {dim.name}, factor by factor
              </h2>
              <PrintLineChart result={result} entityId={dim.id} height={230} />
              <table className="gr-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Factor</th>
                    {people.map((p, i) => (
                      <th key={p.personKey} className="num" style={{ color: PRINT_PALETTE[i % PRINT_PALETTE.length] }}>
                        {p.displayName.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factors.map((f) => {
                    const stats = statsFor(result.series, f.id, personKeys)
                    return (
                      <tr key={f.id}>
                        <td>{f.name}</td>
                        {stats.map((s) => (
                          <td key={s.personKey} className="num">
                            <span style={{ fontWeight: 700 }}>{s.latest ?? '—'}</span>{' '}
                            {s.delta !== null && (
                              <span style={{ color: deltaColour(s.delta) }}>{formatSigned(s.delta)}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {isLast && (
                <div
                  style={{
                    background: '#f8f6f1',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: '13px 15px',
                    fontSize: 9.5,
                    color: MUTED,
                    lineHeight: 1.6,
                    marginTop: 16,
                  }}
                >
                  <strong style={{ color: INK }}>How to read this report.</strong> Scores are scaled
                  0–100; the shaded band (30–70) is the typical range on this scale.{' '}
                  <strong style={{ color: INK }}>Change</strong> compares each person&apos;s first
                  assessment with their most recent — assessment dates differ per person. Changes
                  smaller than ±{NOISE_FLOOR} are within measurement noise and shown in grey.
                  Identity is matched across campaigns by verified email and reviewed links. This
                  report is a frozen snapshot generated on {fmtDate(generatedAt)}.
                </div>
              )}
            </div>
            <RunningFooter
              note={`In depth · ${dim.name}`}
              page={4 + di}
              total={totalPages}
            />
          </div>
        )
      })}
    </div>
  )
}

function buildFindings(
  result: CanvasResult,
  dimensions: CanvasEntity[],
  personKeys: string[],
  nameByPerson: Map<string, string>,
): string[] {
  const findings: string[] = []
  const overall = statsFor(result.series, OVERALL_ID, personKeys)
  const riser = biggestChange(overall)
  if (riser && Math.abs(riser.delta) >= NOISE_FLOOR) {
    const risingDims = dimensions.filter((d) => {
      const s = statsFor(result.series, d.id, personKeys).find(
        (x) => x.personKey === riser.personKey,
      )
      return s?.delta !== null && s !== undefined && (s.delta as number) >= NOISE_FLOOR
    })
    findings.push(
      `${nameByPerson.get(riser.personKey)} shows the strongest overall movement (${formatSigned(riser.delta)})` +
        (risingDims.length > 0
          ? ` — rising in ${risingDims.length} of ${dimensions.length} dimensions.`
          : '.'),
    )
  }
  const leader = overall
    .filter((s) => s.latest !== null)
    .sort((a, b) => (b.latest as number) - (a.latest as number))[0]
  if (leader && personKeys.length > 1) {
    const flat = leader.delta !== null && Math.abs(leader.delta) < NOISE_FLOOR
    findings.push(
      `${nameByPerson.get(leader.personKey)} holds the highest overall score today (${leader.latest})${flat ? ', though it has been flat across the period' : ''}.`,
    )
  }
  if (personKeys.length > 1 && dimensions.length > 0) {
    const mostSpread = dimensions
      .map((d) => ({ d, s: spread(statsFor(result.series, d.id, personKeys)) }))
      .sort((a, b) => b.s - a.s)[0]
    if (mostSpread && mostSpread.s > 0) {
      findings.push(
        `The group differs most on ${mostSpread.d.name} (${mostSpread.s} points between highest and lowest) — the deciding dimension if selecting on it.`,
      )
    }
  }
  return findings.slice(0, 3)
}
