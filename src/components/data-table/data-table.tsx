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
  type SortingState,
} from "@tanstack/react-table";

import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { DataTableFilterConfig } from "@/components/data-table/data-table-faceted-filter";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
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
  rowHref?: (row: TData) => string;
  emptyState?: ReactNode;
  defaultSort?: { id: string; desc: boolean };
  pageSize?: number;
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

  // TanStack Table is the intended engine for this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: searchedData,
    columns: resolvedColumns,
    filterFns: {
      multiValue: multiValueFilter,
    },
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const isInteractive = Boolean(onRowClick || rowHref);
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

  function shouldIgnoreRowEvent(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest(
        'a,button,input,select,textarea,[role="button"],[role="link"],[data-stop-row-click]'
      )
    );
  }

  function activateRow(row: TData) {
    const href = rowHref?.(row);
    if (href) {
      router.push(href);
    }
    onRowClick?.(row);
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: TData) {
    if (shouldIgnoreRowEvent(event.target)) {
      return;
    }

    activateRow(row);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: TData) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (shouldIgnoreRowEvent(event.target)) {
      return;
    }

    event.preventDefault();
    activateRow(row);
  }

  return (
    <ScrollReveal>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/[0.06] dark:shadow-none">
        {hasToolbar ? (
          <DataTableToolbar
            table={table}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={searchPlaceholder}
            filterableColumns={filterableColumns}
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
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={isInteractive ? 0 : undefined}
                  role={rowHref ? "link" : onRowClick ? "button" : undefined}
                  onClick={
                    isInteractive
                      ? (event) => handleRowClick(event, row.original)
                      : undefined
                  }
                  onKeyDown={
                    isInteractive
                      ? (event) => handleRowKeyDown(event, row.original)
                      : undefined
                  }
                  className={cn(
                    isInteractive
                      ? "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                      : undefined
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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

        <DataTablePagination table={table} totalCount={data.length} />
      </div>
    </ScrollReveal>
  );
}
