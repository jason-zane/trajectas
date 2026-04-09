"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function DataTableRowLink({
  href,
  children,
  className,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-stop-row-click
      className={cn(
        "block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        className
      )}
    >
      {children}
    </Link>
  );
}
