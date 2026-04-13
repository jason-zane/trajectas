// src/components/data-table/data-table-bulk-bar.tsx
"use client";

import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkAction<TData> {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive";
  action: (ids: string[], rows: TData[]) => Promise<void> | void;
}

interface DataTableBulkBarProps<TData> {
  selectedCount: number;
  selectedIds: string[];
  selectedRows: TData[];
  actions: BulkAction<TData>[];
  onClear: () => void;
}

export function DataTableBulkBar<TData>({
  selectedCount,
  selectedIds,
  selectedRows,
  actions,
  onClear,
}: DataTableBulkBarProps<TData>) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(bulkAction: BulkAction<TData>) {
    setActiveAction(bulkAction.label);
    startTransition(async () => {
      try {
        await bulkAction.action(selectedIds, selectedRows);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Action failed. Please try again."
        );
      } finally {
        setActiveAction(null);
        onClear();
      }
    });
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} {selectedCount === 1 ? "row" : "rows"} selected
      </span>
      <div className="flex items-center gap-2 ml-2">
        {actions.map((bulkAction) => (
          <Button
            key={bulkAction.label}
            size="sm"
            variant={bulkAction.variant === "destructive" ? "destructive" : "outline"}
            disabled={isPending}
            onClick={() => handleAction(bulkAction)}
            className={cn(isPending && activeAction === bulkAction.label && "opacity-70")}
          >
            {bulkAction.icon}
            {bulkAction.label}
          </Button>
        ))}
      </div>
      <button
        onClick={onClear}
        disabled={isPending}
        className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}
