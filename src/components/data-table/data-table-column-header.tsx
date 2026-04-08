"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn("font-medium", className)}>{title}</span>;
  }

  const sortDirection = column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-8 px-2 text-overline text-muted-foreground", className)}
      onClick={() => column.toggleSorting(sortDirection === "asc")}
    >
      <span>{title}</span>
      {sortDirection === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sortDirection === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5" />
      )}
    </Button>
  );
}
