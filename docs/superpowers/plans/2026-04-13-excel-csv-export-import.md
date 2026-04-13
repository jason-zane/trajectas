# Excel / CSV Export & Import Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export for results/participants and Excel export for reports, plus CSV import for participant lists, so enterprise clients can move data in and out of Trajectas without manual data entry.

**Architecture:** `papaparse` handles CSV (browser + Node, zero deps). `xlsx` (SheetJS) handles Excel. Both run client-side for export (no server round-trip needed — data is already in the client from the table). Import uses a `<input type="file">` + `papaparse.parse()` on the client, then a server action to validate and upsert rows. Export buttons live in the DataTable toolbar.

**Tech stack:** `papaparse`, `xlsx`

**Key reference files:**
- Data table toolbar: `src/components/data-table/` — find the toolbar component
- Participant list: search for participant table component
- Results table: `src/app/(dashboard)/results/` or similar
- Server actions for participant upsert: search for `createParticipant` or `upsertParticipant`

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install papaparse xlsx`
- [ ] Install types: `npm install -D @types/papaparse`
- [ ] Note: xlsx Community Edition is Apache-licensed; confirm this is acceptable for the project

### Phase 2 — CSV export utility

- [ ] Create `src/lib/export.ts`:
  ```ts
  export function exportToCsv(filename: string, data: Record<string, unknown>[]) {
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    triggerDownload(blob, `${filename}.csv`)
  }
  ```
- [ ] Add `triggerDownload(blob, filename)` helper that creates a temporary `<a>` element and clicks it

### Phase 3 — Excel export utility

- [ ] Add to `src/lib/export.ts`:
  ```ts
  export function exportToExcel(filename: string, sheets: Record<string, unknown[][]>) {
    const wb = XLSX.utils.book_new()
    Object.entries(sheets).forEach(([name, data]) => {
      const ws = XLSX.utils.aoa_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, name)
    })
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }
  ```

### Phase 4 — DataTable toolbar export button

- [ ] Read the data table toolbar component before editing
- [ ] Add an `exportable` prop to the DataTable (optional, defaults off)
- [ ] When `exportable` is true, render a dropdown in the toolbar: "Export CSV" and "Export Excel"
- [ ] Pass a `getExportData()` callback prop that maps row data to export-friendly column names (no internal IDs as column headers)

### Phase 5 — Wire export to participant list

- [ ] Add `exportable` to participant list DataTable
- [ ] Define `getExportData` mapping: name, email, status, campaign name, completion date, score (if available)
- [ ] Add toast on export: `toast.success("Exported 47 participants")`

### Phase 6 — Wire export to results list

- [ ] Add `exportable` to results/sessions DataTable
- [ ] Define `getExportData` mapping: participant name, assessment name, completion date, dimension scores, overall score

### Phase 7 — CSV import for participants

- [ ] Create `src/components/participant-import-dialog.tsx`:
  - `<input type="file" accept=".csv">` trigger
  - On file select: `Papa.parse(file, { header: true, skipEmptyLines: true })`
  - Show a preview table of the first 5 rows with column mapping UI
  - "Import N participants" button calls a server action
- [ ] Create server action `importParticipants(rows: ParticipantImportRow[], campaignId: string)`:
  - Validate each row with Zod (required: email; optional: name, external_id)
  - Upsert into participants table (conflict on email + campaign_id)
  - Return `{ imported: number, skipped: number, errors: string[] }`
- [ ] Show result toast: `toast.success("Imported 42 participants, 3 skipped")`
- [ ] Download import template button: generates a CSV with the expected headers and one example row

### Phase 8 — Download import template

- [ ] Add a "Download template" link in the import dialog that calls `exportToCsv('participant-import-template', [{ email: 'example@company.com', name: 'Jane Doe', external_id: 'EMP-001' }])`

---

## Acceptance criteria

- Participant list exports to CSV with human-readable column names
- Results export to Excel with correct sheet name and formatted columns
- CSV import parses a file, previews rows, and upserts participants correctly
- Import with duplicate emails updates existing rows rather than creating duplicates
- Empty or malformed CSV rows are skipped with an error count in the toast
