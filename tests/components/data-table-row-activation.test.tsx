// @vitest-environment jsdom
/**
 * Clicking a table row has to navigate. It did not, anywhere in the app,
 * between #281 and the fix these tests pin.
 *
 * Reported as "I click on any of the rows in the item bank and nothing
 * happens". The Vercel logs agreed and narrowed it: `/item-bank/review` was
 * requested six times in 24h and `/item-bank/review/<itemId>` zero times, so
 * no navigation was ever attempted and the destination page was never at
 * fault. The cause was in `DataTable` and therefore applied to all 23 tables
 * that pass `rowHref` or `onRowClick` — `shouldIgnoreRowEvent` matched the
 * row's own `role="link"`, so every click looked like a click on a nested
 * control and was discarded.
 *
 * Two halves, and a fix for one that breaks the other is not a fix:
 *   - a click anywhere on the row navigates;
 *   - a click on a real control INSIDE the row does not.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { ItemsTable, type ItemRow } from '@/app/(dashboard)/item-bank/items-table'

// jsdom has no IntersectionObserver, and `ScrollReveal` wraps every DataTable.
// Stubbed as "immediately intersecting" so the table is in its revealed state,
// which is what a real browser shows by the time anyone clicks.
class ImmediateIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/item-bank/review',
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => {
  // Re-stubbed per test: the suite runs with `unstubGlobals: true`, which
  // restores globals between tests and would otherwise wipe this.
  vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver)
  push.mockClear()
})

// ---------------------------------------------------------------------------
// The reported case, through the real item bank table.
// ---------------------------------------------------------------------------

function itemRow(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    stem: 'Which figure completes the matrix?',
    familyId: '22222222-2222-2222-2222-222222222222',
    familyCode: 'FM-XOR-01',
    lifecycleState: 'draft',
    difficultyPriorB: 0.4,
    difficultyPriorBand: 'medium',
    exposureCount: 0,
    generatorSeed: 'test/xor/0',
    contentSignOff: null,
    fairnessSignOff: null,
    formPlacements: [],
    ...overrides,
  }
}

const REVIEW_HREF = '/item-bank/review/11111111-1111-1111-1111-111111111111'

describe('item bank review queue', () => {
  it('opens the item when its row is clicked', () => {
    render(<ItemsTable items={[itemRow()]} showFamily />)

    fireEvent.click(screen.getByText('Which figure completes the matrix?'))

    expect(push).toHaveBeenCalledWith(REVIEW_HREF)
  })

  it('opens the item on Enter, so the queue is keyboard-reachable', () => {
    render(<ItemsTable items={[itemRow()]} showFamily />)

    fireEvent.keyDown(screen.getByRole('link'), { key: 'Enter' })

    expect(push).toHaveBeenCalledWith(REVIEW_HREF)
  })

  it('opens the item from any cell, not just the stem', () => {
    render(<ItemsTable items={[itemRow()]} showFamily />)

    fireEvent.click(screen.getByText('FM-XOR-01'))

    expect(push).toHaveBeenCalledWith(REVIEW_HREF)
  })

  it('presents the row as an activatable link for assistive tech', () => {
    render(<ItemsTable items={[itemRow()]} showFamily />)

    const row = screen.getByRole('link')
    expect(row.tagName).toBe('TR')
    expect(row.getAttribute('tabindex')).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// The shared behaviour, which is what actually broke.
// ---------------------------------------------------------------------------

type Widget = { id: string; name: string }

const WIDGETS: Widget[] = [{ id: 'w1', name: 'First widget' }]

function widgetColumns(extraCell?: ColumnDef<Widget>): ColumnDef<Widget>[] {
  const columns: ColumnDef<Widget>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => row.original.name },
  ]
  if (extraCell) columns.push(extraCell)
  return columns
}

describe('DataTable row activation', () => {
  it('navigates on a plain cell click when rowHref is supplied', () => {
    render(
      <DataTable
        columns={widgetColumns()}
        data={WIDGETS}
        rowHref={(row) => `/widgets/${row.id}`}
      />,
    )

    fireEvent.click(screen.getByText('First widget'))

    expect(push).toHaveBeenCalledWith('/widgets/w1')
  })

  it('calls onRowClick when there is no href', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable columns={widgetColumns()} data={WIDGETS} onRowClick={onRowClick} />,
    )

    fireEvent.click(screen.getByText('First widget'))

    expect(onRowClick).toHaveBeenCalledWith(WIDGETS[0])
    expect(push).not.toHaveBeenCalled()
  })

  it('lets a button inside a cell own its own click', () => {
    const onAction = vi.fn()
    render(
      <DataTable
        columns={widgetColumns({
          id: 'actions',
          header: 'Actions',
          cell: () => <button onClick={onAction}>Archive</button>,
        })}
        data={WIDGETS}
        rowHref={(row) => `/widgets/${row.id}`}
      />,
    )

    fireEvent.click(screen.getByText('Archive'))

    expect(onAction).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('lets a link inside a cell own its own click', () => {
    render(
      <DataTable
        columns={widgetColumns({
          id: 'owner',
          header: 'Owner',
          cell: () => <a href="/people/1">Jane</a>,
        })}
        data={WIDGETS}
        rowHref={(row) => `/widgets/${row.id}`}
      />,
    )

    fireEvent.click(screen.getByText('Jane'))

    expect(push).not.toHaveBeenCalled()
  })

  it('honours an explicit [data-stop-row-click] opt-out', () => {
    render(
      <DataTable
        columns={widgetColumns({
          id: 'note',
          header: 'Note',
          cell: () => <span data-stop-row-click>do not open</span>,
        })}
        data={WIDGETS}
        rowHref={(row) => `/widgets/${row.id}`}
      />,
    )

    fireEvent.click(screen.getByText('do not open'))

    expect(push).not.toHaveBeenCalled()
  })

  it('leaves a row inert when neither rowHref nor onRowClick is supplied', () => {
    render(<DataTable columns={widgetColumns()} data={WIDGETS} />)

    fireEvent.click(screen.getByText('First widget'))

    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
