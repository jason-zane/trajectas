import type { ColumnGroup, ComparisonResult } from './types'

const IDENTITY_HEADERS = [
  'Participant',
  'Email',
  'Date',
  'Attempt #',
  'Assessment',
  'Session Status',
] as const

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let str = String(value)
  // Neutralise spreadsheet formula injection: participant names are
  // user-controlled, and Excel/Sheets execute cells starting with = + - @ as
  // formulas. Plain numbers are exempt — they're data.
  if (/^[=+\-@\t\r]/.test(str) && !/^-?\d+(\.\d+)?$/.test(str)) {
    str = `'${str}`
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function isoDate(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function flattenColumns(groups: ColumnGroup[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const g of groups) {
    out.push({ id: g.rollup.id, name: g.rollup.name })
    for (const c of g.children) out.push({ id: c.id, name: c.name })
  }
  return out
}

export function buildComparisonCsv(result: ComparisonResult): string {
  const columns = flattenColumns(result.columns)
  const headerRow = [...IDENTITY_HEADERS, ...columns.map((c) => c.name)]
    .map(escapeCell)
    .join(',')

  const dataRows: string[] = []
  for (const row of result.rows) {
    for (const a of row.perAssessment) {
      const group = result.columns.find((g) => g.assessmentId === a.assessmentId)
      const groupColumnIds = new Set<string>([
        group?.rollup.id ?? '',
        ...(group?.children.map((c) => c.id) ?? []),
      ])
      const cells = columns.map((c) =>
        groupColumnIds.has(c.id) ? a.cells[c.id] ?? null : null,
      )
      const line = [
        row.participantName,
        row.participantEmail,
        isoDate(a.sessionStartedAt),
        a.attemptNumber ?? '',
        group?.assessmentName ?? '',
        a.sessionStatus ?? '',
        ...cells,
      ]
        .map(escapeCell)
        .join(',')
      dataRows.push(line)
    }
  }
  return [headerRow, ...dataRows].join('\n')
}
