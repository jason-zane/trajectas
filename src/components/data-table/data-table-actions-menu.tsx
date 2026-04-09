"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function DataTableActionsMenu({
  label,
  children,
  contentClassName,
}: {
  label: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <DataTableRowActions>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              title={label}
              aria-label={label}
              className="text-muted-foreground"
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">{label}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className={cn("w-48", contentClassName)}>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </DataTableRowActions>
  );
}
