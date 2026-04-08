"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DataTableRowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-stop-row-click
      className={cn("flex items-center justify-end gap-1.5", className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
