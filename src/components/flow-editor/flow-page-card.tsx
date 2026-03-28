"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import { GripVertical, LogIn, Hand, ShieldCheck, Users, ClipboardCheck, CheckCircle2, FileText, Clock, FileEdit } from "lucide-react"
import { cn } from "@/lib/utils"

export type FlowPageId = "join" | "welcome" | "consent" | "demographics" | "review" | "complete" | "report" | "expired" | string

interface FlowPageCardProps {
  id: FlowPageId
  index: number
  label: string
  icon?: FlowPageId
  enabled: boolean
  selected: boolean
  sortable: boolean
  onSelect: () => void
}

const PAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  join: LogIn,
  welcome: Hand,
  consent: ShieldCheck,
  demographics: Users,
  review: ClipboardCheck,
  complete: CheckCircle2,
  report: FileText,
  expired: Clock,
}

const PAGE_COLORS: Record<string, string> = {
  join: "var(--brand, oklch(0.55 0.15 160))",
  welcome: "var(--brand, oklch(0.55 0.15 160))",
  consent: "oklch(0.55 0.12 250)",
  demographics: "oklch(0.55 0.12 290)",
  review: "oklch(0.55 0.12 45)",
  complete: "oklch(0.55 0.15 145)",
  report: "oklch(0.55 0.12 200)",
  expired: "oklch(0.50 0.08 30)",
}

export function FlowPageCard({
  id,
  index,
  label,
  icon,
  enabled,
  selected,
  sortable,
  onSelect,
}: FlowPageCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    disabled: !sortable,
  })

  const iconKey = icon ?? id
  const Icon = PAGE_ICONS[iconKey] ?? FileEdit
  const color = PAGE_COLORS[iconKey] ?? "var(--primary)"

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={cn(
        "group/card flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-muted/50",
        !enabled && "opacity-50",
        isDragging && "opacity-50 scale-[0.98] shadow-lg",
      )}
    >
      {/* Drag handle */}
      {sortable ? (
        <button
          ref={handleRef}
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : (
        <div className="w-3.5 shrink-0" />
      )}

      {/* Icon */}
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-md transition-shadow duration-300"
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
          "--glow-color": color,
        } as React.CSSProperties}
      >
        <span style={{ color }}><Icon className="size-3.5" /></span>
      </div>

      {/* Label */}
      <span className="flex-1 text-sm font-medium truncate">{label}</span>

      {/* Enabled dot */}
      <div
        className={cn(
          "size-1.5 rounded-full shrink-0 transition-colors",
          enabled ? "bg-success" : "bg-muted-foreground/30"
        )}
      />
    </div>
  )
}

/** Static (non-sortable) version — used for fixed pages at top/bottom of list. */
export function StaticPageCard({
  id,
  label,
  enabled,
  selected,
  onSelect,
}: Omit<FlowPageCardProps, "index" | "sortable" | "icon"> & { icon?: FlowPageId }) {
  const Icon = PAGE_ICONS[id] ?? FileEdit
  const color = PAGE_COLORS[id] ?? "var(--primary)"

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group/card flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-muted/50",
        !enabled && "opacity-50",
      )}
    >
      <div className="w-3.5 shrink-0" />

      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
        }}
      >
        <span style={{ color }}><Icon className="size-3.5" /></span>
      </div>

      <span className="flex-1 text-sm font-medium truncate">{label}</span>

      <div
        className={cn(
          "size-1.5 rounded-full shrink-0",
          enabled ? "bg-success" : "bg-muted-foreground/30"
        )}
      />
    </div>
  )
}
