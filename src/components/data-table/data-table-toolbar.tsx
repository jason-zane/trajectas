"use client";

import type { Table as TanStackTable } from "@tanstack/react-table";
import { Download, FileSpreadsheet, X } from "lucide-react";

import {
  DataTableFacetedFilter,
  type DataTableFilterConfig,
} from "@/components/data-table/data-table-faceted-filter";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableToolbarProps<TData> {
  table: TanStackTable<TData>;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterableColumns: DataTableFilterConfig[];
  onExportCsv?: () => void;
  onExportXlsx?: () => void;
}

export function DataTableToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  filterableColumns,
  onExportCsv,
  onExportXlsx,
}: DataTableToolbarProps<TData>) {
  const hasFilters = table.getState().columnFilters.length > 0 || search.trim().length > 0;
  const hasExport = Boolean(onExportCsv || onExportXlsx);

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DataTableSearch
          value={search}
          onValueChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        <div className="flex flex-wrap items-center gap-2">
          {filterableColumns.map((filter) => (
            <DataTableFacetedFilter
              key={filter.id}
              column={table.getColumn(filter.id)}
              title={filter.title}
              options={filter.options}
            />
          ))}
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange("");
                table.resetColumnFilters();
              }}
            >
              <X className="size-3.5" />
              Reset
            </Button>
          ) : null}
          {hasExport ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="outline" size="sm">
                    <Download className="size-3.5" />
                    Export
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {onExportCsv && (
                  <DropdownMenuItem onClick={onExportCsv}>
                    <Download className="size-4" />
                    Export CSV
                  </DropdownMenuItem>
                )}
                {onExportXlsx && (
                  <DropdownMenuItem onClick={onExportXlsx}>
                    <FileSpreadsheet className="size-4" />
                    Export Excel
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
}
