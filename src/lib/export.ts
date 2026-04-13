/**
 * Client-side export utilities for CSV and Excel.
 * Both functions accept column definitions and row data, triggering a browser download.
 */

export interface ExportColumn<T> {
  /** Column header label */
  header: string
  /** Key of the row object or accessor function */
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined)
}

type Primitive = string | number | boolean | null | undefined

function getValue<T>(row: T, col: ExportColumn<T>): Primitive {
  if (typeof col.accessor === "function") {
    return col.accessor(row)
  }
  return row[col.accessor] as Primitive
}

function toDisplayString(value: Primitive): string {
  if (value === null || value === undefined) return ""
  return String(value)
}

/** Trigger a browser file download */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export async function exportToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename = "export.csv"
) {
  const { unparse } = await import("papaparse")

  const data = rows.map((row) =>
    Object.fromEntries(
      columns.map((col) => [col.header, toDisplayString(getValue(row, col))])
    )
  )

  const csv = unparse(data, { columns: columns.map((c) => c.header) })
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  download(blob, filename)
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

export async function exportToXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename = "export.xlsx",
  sheetName = "Sheet1"
) {
  const XLSX = await import("xlsx")

  const header = columns.map((c) => c.header)
  const data = rows.map((row) => columns.map((col) => getValue(row, col) ?? ""))

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...data])

  // Auto-width columns
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...rows.map((row) => toDisplayString(getValue(row, col)).length)
    )
    return { wch: Math.min(maxLen + 2, 60) }
  })
  worksheet["!cols"] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  download(blob, filename)
}
