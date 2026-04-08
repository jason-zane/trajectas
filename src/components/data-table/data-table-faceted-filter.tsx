"use client";

import type { Column } from "@tanstack/react-table";
import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DataTableFilterOption = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export interface DataTableFilterConfig {
  id: string;
  title: string;
  options: DataTableFilterOption[];
}

interface DataTableFacetedFilterProps<TData> {
  column?: Column<TData, unknown>;
  title: string;
  options: DataTableFilterOption[];
}

export function DataTableFacetedFilter<TData>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData>) {
  const selectedValues = new Set((column?.getFilterValue() as string[] | undefined) ?? []);

  if (!column) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="h-9 gap-2" />
        }
      >
        <Filter className="size-3.5" />
        <span>{title}</span>
        {selectedValues.size > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5">
            {selectedValues.size}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const Icon = option.icon;
          const count = column.getFacetedUniqueValues().get(option.value) ?? 0;

          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedValues.has(option.value)}
              onCheckedChange={(checked) => {
                const nextValues = new Set(selectedValues);

                if (checked) {
                  nextValues.add(option.value);
                } else {
                  nextValues.delete(option.value);
                }

                const value = Array.from(nextValues);
                column.setFilterValue(value.length > 0 ? value : undefined);
              }}
            >
              {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
              <span>{option.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{count}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
