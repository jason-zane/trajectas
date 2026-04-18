"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-[var(--cream)]/40 [&_tr]:border-b [&_tr]:border-border",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        // Subtle zebra — even rows get a cream wash on top of the card surface.
        "[&_tr:nth-child(even)]:bg-[var(--cream)]/25 [&_tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "relative border-b border-border/60 transition-colors",
        "hover:bg-[var(--cream)]/70",
        // Selected rows get a cream wash and a gold accent stripe on the left edge.
        "data-[state=selected]:bg-[var(--cream)]",
        "data-[state=selected]:shadow-[inset_2px_0_0_0_var(--gold)]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-left align-middle font-mono text-[0.65625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pl-4",
        "first:max-sm:sticky first:max-sm:left-0 first:max-sm:z-10 first:max-sm:bg-card",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3.5 align-middle text-sm",
        // Primary identity column (first non-checkbox cell) gets a touch more weight.
        // Consumers can override via className on their cell renderer.
        "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pl-4",
        "first:max-sm:sticky first:max-sm:left-0 first:max-sm:z-10 first:max-sm:bg-card first:max-sm:shadow-[2px_0_4px_-2px_rgb(0_0_0/0.1)]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
