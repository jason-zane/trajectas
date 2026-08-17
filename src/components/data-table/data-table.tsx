"use client";

import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { DataTableFilterConfig } from "@/components/data-table/data-table-faceted-filter";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableBulkBar, type BulkAction } from "@/components/data-table/data-table-bulk-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function getColumnId<TData, TValue>(column: ColumnDef<TData, TValue>) {
  if ("id" in column && typeof column.id === "string") {
    return column.id;
  }

  if ("accessorKey" in column && typeof column.accessorKey === "string") {
    return column.accessorKey;
  }

  return null;
}

function getSearchValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }

  if (Array.isArray(value)) {
    return value.map(getSearchValue).join(" ");
  }

  return "";
}

const multiValueFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) {
    return true;
  }

  const value = row.getValue(columnId);

  if (Array.isArray(value)) {
    return value.some((item) => filterValue.includes(String(item)));
  }

  return filterValue.includes(String(value));
};

multiValueFilter.autoRemove = (value) => !Array.isArray(value) || value.length === 0;

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchableColumns?: (keyof TData)[];
  filterableColumns?: DataTableFilterConfig[];
  onRowClick?: (row: TData) => void;
  rowHref?: (row: TData) => string | undefined;
  emptyState?: ReactNode;
  defaultSort?: { id: string; desc: boolean };
  pageSize?: number;
  enableRowSelection?: boolean;
  getRowId?: (row: TData) => string;
  bulkActions?: BulkAction<TData>[];
  hiddenColumns?: string[];
  hideClientPagination?: boolean;
  serverPaginationControls?: ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchableColumns = [],
  filterableColumns = [],
  onRowClick,
  rowHref,
  emptyState,
  defaultSort,
  pageSize = 20,
  enableRowSelection = false,
  getRowId,
  bulkActions = [],
  hiddenColumns = [],
  hideClientPagination = false,
  serverPaginationControls,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>(() =>
    defaultSort ? [{ id: defaultSort.id, desc: defaultSort.desc }] : []
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(hiddenColumns.map((id) => [id, false]))
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    );
    setRowSelection({});
  }, [debouncedSearch, columnFilters]);

  const searchedData =
    searchableColumns.length === 0 || debouncedSearch.length === 0
      ? data
      : data.filter((row) =>
          searchableColumns.some((columnKey) =>
            getSearchValue((row as Record<string, unknown>)[String(columnKey)]).includes(
              debouncedSearch
            )
          )
        );

  const filterableIds = new Set(filterableColumns.map((filter) => filter.id));
  const resolvedColumns = columns.map((column) => {
    const columnId = getColumnId(column);

    if (!columnId || !filterableIds.has(columnId) || "columns" in column || column.filterFn) {
      return column;
    }

    return {
      ...column,
      filterFn: multiValueFilter as FilterFn<TData>,
    } as ColumnDef<TData, TValue>;
  }) as ColumnDef<TData, TValue>[];

  const allColumns: ColumnDef<TData, TValue>[] = enableRowSelection
    ? [
        {
          id: "_select",
          enableSorting: false,
          header: ({ table }) => (
            <div data-stop-row-click className="flex items-center">
              <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={table.getIsSomePageRowsSelected()}
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(Boolean(value))
                }
                aria-label="Select all"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div data-stop-row-click className="flex items-center">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
                aria-label="Select row"
              />
            </div>
          ),
        } as ColumnDef<TData, TValue>,
        ...resolvedColumns,
      ]
    : resolvedColumns;

  // TanStack Table is the intended engine for this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: searchedData,
    columns: allColumns,
    getRowId,
    filterFns: {
      multiValue: multiValueFilter,
    },
    state: {
      sorting,
      columnFilters,
      pagination,
      rowSelection,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedIds = Object.keys(rowSelection);

  const hasToolbar = searchableColumns.length > 0 || filterableColumns.length > 0;
  const rows = table.getRowModel().rows;
  const defaultEmptyState =
    data.length === 0 ? (
      <EmptyState
        title="Nothing here yet"
        description="New records will appear here when they are available."
        className="border-0 py-16"
      />
    ) : (
      <EmptyState
        title="No matching results"
        description="Try changing the search or filters."
        className="border-0 py-16"
      />
    );

  /**
   * True when the event started on a real control nested inside the row — a
   * row-actions button, a select checkbox, a link in a cell — which owns the
   * click and must not also trigger the row's navigation.
   *
   * `rowElement` is the `<tr>` and has to be passed in. An interactive row
   * carries `role="link"` or `role="button"` itself, and those are two of the
   * selectors below, so a bare `target.closest(...)` matches the row for
   * EVERY click — including clicks on plain text — and swallows the lot. That
   * was the behaviour from #281 until this comment was written: every
   * clickable row in the app rendered with `cursor-pointer`, hover feedback
   * and `role="link"`, and did nothing at all when clicked. `closest` returns
   * the nearest ancestor-or-self, so comparing the match against the row
   * itself separates "clicked a control in a cell" from "clicked the row".
   */
  function shouldIgnoreRowEvent(
    target: EventTarget | null,
    rowElement: HTMLElement
  ) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const match = target.closest(
      'a,button,input,select,textarea,[role="button"],[role="link"],[data-stop-row-click]'
    );

    return Boolean(match) && match !== rowElement;
  }

  function activateRow(row: TData) {
    const href = rowHref?.(row);
    if (href) {
      router.push(href);
    }
    onRowClick?.(row);
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: TData) {
    if (shouldIgnoreRowEvent(event.target, event.currentTarget)) {
      return;
    }

    activateRow(row);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: TData) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (shouldIgnoreRowEvent(event.target, event.currentTarget)) {
      return;
    }

    event.preventDefault();
    activateRow(row);
  }

  return (
    <ScrollReveal>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/[0.06]">
        {hasToolbar ? (
          <DataTableToolbar
            table={table}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={searchPlaceholder}
            filterableColumns={filterableColumns}
          />
        ) : null}

        {selectedRows.length > 0 ? (
          <DataTableBulkBar
            selectedCount={selectedRows.length}
            selectedRows={selectedRows}
            selectedIds={selectedIds}
            actions={bulkActions}
            onClear={() => setRowSelection({})}
          />
        ) : null}

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => {
                const resolvedHref = rowHref?.(row.original);
                const rowIsInteractive = Boolean(resolvedHref) || Boolean(onRowClick);
                return (
                  <TableRow
                    key={row.id}
                    tabIndex={rowIsInteractive ? 0 : undefined}
                    role={resolvedHref ? "link" : onRowClick ? "button" : undefined}
                    onClick={
                      rowIsInteractive
                        ? (event) => handleRowClick(event, row.original)
                        : undefined
                    }
                    onKeyDown={
                      rowIsInteractive
                        ? (event) => handleRowKeyDown(event, row.original)
                        : undefined
                    }
                    className={cn(
                      rowIsInteractive
                        ? "cursor-pointer hover:bg-[var(--cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        : undefined
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getAllLeafColumns().length || 1}
                  className="p-0"
                >
                  {emptyState ?? defaultEmptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {hideClientPagination ? (
          serverPaginationControls
        ) : (
          <DataTablePagination table={table} totalCount={data.length} />
        )}
      </div>
    </ScrollReveal>
  );
}
