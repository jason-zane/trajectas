# Virtual Scrolling Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add row virtualization to large data tables so the platform remains performant when partner client lists, participant lists, and item banks grow to 500–1000+ rows.

**Architecture:** Install `@tanstack/react-virtual`. Identify the three highest-risk tables (participant list, item bank, users directory). Add a `useVirtualizer` hook to each, replacing the current full-render `tbody` with a fixed-height scrollable container and only rendering visible rows. TanStack Table integration is documented — virtualizer provides `getVirtualItems()`, table provides row models; they compose cleanly.

**Tech stack:** `@tanstack/react-virtual` (same org as TanStack Table already in use)

**Key reference files:**
- Existing data table wrapper: `src/components/data-table/` (check for a shared table component)
- Participant list: search for `participants` table usages in `src/app/`
- Item bank: `src/app/(dashboard)/items/` or similar
- Users directory: `src/app/(dashboard)/users/`

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install @tanstack/react-virtual`
- [ ] Read `node_modules/@tanstack/react-virtual/` README or docs before writing code — confirm API shape (`useVirtualizer`, `getVirtualItems`, `getTotalSize`)

### Phase 2 — Identify target tables

- [ ] Grep for `DataTable` or `useReactTable` usage across `src/` — list all tables with potentially unbounded row counts
- [ ] Tag each as: Low risk (paginated, <50 rows max), Medium (50–200), High (200+ possible)
- [ ] Prioritise: participant list per campaign, item bank list, users directory

### Phase 3 — Create virtualizer hook utility

- [ ] Create `src/hooks/use-virtual-table.ts` — wraps `useVirtualizer` with the project's standard table row height (read existing tables to determine current row height)
- [ ] Export: `useVirtualTable({ rows, estimateSize })` → `{ virtualRows, totalSize, parentRef }`

### Phase 4 — Migrate participant list

- [ ] Read the participant list component fully before editing
- [ ] Replace `tbody` full-render with virtual rows: fixed-height scroll container on the `tbody` wrapper, render only `virtualRows.map(vr => rows[vr.index])`
- [ ] Add `paddingTop` and `paddingBottom` spacer rows to maintain correct scroll height
- [ ] Test with mock data at 500 rows — scroll should be smooth, no layout jank

### Phase 5 — Migrate item bank

- [ ] Same virtualizer migration pattern as participant list
- [ ] Confirm filter/sort still works (TanStack Table filters apply before virtualizer, so this should be free)

### Phase 6 — Migrate users directory

- [ ] Same pattern; confirm row click navigation still works

### Phase 7 — Optional: virtual infinite scroll

- [ ] If Supabase queries are paginated (check `limit`/`offset` patterns in server actions), wire `fetchNextPage` to a scroll-to-bottom trigger using `virtualizer.scrollToIndex`

---

## Acceptance criteria

- Participant list renders 500 rows without visible lag
- Sorting and filtering still work correctly in virtualised tables
- Scroll position is maintained on tab refocus
- Row height is consistent (no layout shift)
