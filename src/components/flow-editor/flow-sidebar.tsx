"use client"

import { DragDropProvider } from "@dnd-kit/react"
import { move } from "@dnd-kit/helpers"
import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FlowPageCard, StaticPageCard } from "./flow-page-card"
import type { FlowConfig, CustomPageConfig } from "@/lib/experience/types"

/** Describes a page in the sidebar list. */
export interface FlowPageEntry {
  id: string
  label: string
  enabled: boolean
  /** Whether this page can be reordered (middle zone). */
  sortable: boolean
  /** Zone: "top" | "middle" | "bottom" */
  zone: "top" | "middle" | "bottom"
}

interface FlowSidebarProps {
  flowConfig: Partial<FlowConfig>
  selectedPageId: string
  onSelectPage: (id: string) => void
  onReorder: (orderedMiddleIds: string[]) => void
  onAddPage: () => void
}

/** Labels for built-in pages. */
const PAGE_LABELS: Record<string, string> = {
  join: "Join",
  welcome: "Welcome",
  consent: "Consent",
  demographics: "Demographics",
  review: "Review",
  complete: "Complete",
  report: "Report",
  expired: "Expired",
}

/** Build the full page list from flow config. */
export function buildPageList(flowConfig: Partial<FlowConfig>): FlowPageEntry[] {
  const pages: FlowPageEntry[] = []

  // Fixed top: join, welcome
  for (const id of ["join", "welcome"] as const) {
    const cfg = flowConfig[id]
    pages.push({
      id,
      label: PAGE_LABELS[id],
      enabled: cfg?.enabled ?? true,
      sortable: false,
      zone: "top",
    })
  }

  // Middle: sortable pages — consent, demographics, custom pages, review, report
  const middleBuiltIn = ["consent", "demographics", "review", "report"] as const
  const middleEntries: { id: string; label: string; enabled: boolean; order: number }[] = []

  for (const id of middleBuiltIn) {
    const cfg = flowConfig[id]
    middleEntries.push({
      id,
      label: PAGE_LABELS[id],
      enabled: cfg?.enabled ?? false,
      order: cfg?.order ?? 0,
    })
  }

  // Custom pages
  const customPages = flowConfig.customPages ?? []
  for (const cp of customPages) {
    middleEntries.push({
      id: cp.id,
      label: cp.label,
      enabled: cp.enabled,
      order: cp.order,
    })
  }

  middleEntries.sort((a, b) => a.order - b.order)
  for (const entry of middleEntries) {
    pages.push({
      id: entry.id,
      label: entry.label,
      enabled: entry.enabled,
      sortable: true,
      zone: "middle",
    })
  }

  // Fixed bottom: complete, expired
  for (const id of ["complete", "expired"] as const) {
    const cfg = flowConfig[id]
    pages.push({
      id,
      label: PAGE_LABELS[id],
      enabled: cfg?.enabled ?? true,
      sortable: false,
      zone: "bottom",
    })
  }

  return pages
}

export function FlowSidebar({
  flowConfig,
  selectedPageId,
  onSelectPage,
  onReorder,
  onAddPage,
}: FlowSidebarProps) {
  const allPages = buildPageList(flowConfig)
  const topPages = allPages.filter((p) => p.zone === "top")
  const middlePages = allPages.filter((p) => p.zone === "middle")
  const bottomPages = allPages.filter((p) => p.zone === "bottom")

  const [middleIds, setMiddleIds] = useState(middlePages.map((p) => p.id))

  // Sync when flowConfig changes (e.g. custom page added/removed)
  useEffect(() => {
    const newIds = middlePages.map((p) => p.id)
    setMiddleIds(newIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(middlePages.map((p) => p.id))])

  function handleDragOver(event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0]) {
    setMiddleIds((items) => move(items, event))
  }

  function handleDragEnd() {
    onReorder(middleIds)
  }

  // Build a lookup for middle page data
  const middleMap = new Map(middlePages.map((p) => [p.id, p]))

  return (
    <div className="flex flex-col h-full gap-1">
      {/* Top fixed pages */}
      <div className="space-y-1 pb-2 border-b border-border">
        {topPages.map((page) => (
          <StaticPageCard
            key={page.id}
            id={page.id}
            label={page.label}
            enabled={page.enabled}
            selected={selectedPageId === page.id}
            onSelect={() => onSelectPage(page.id)}
          />
        ))}
      </div>

      {/* Middle sortable pages */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        <DragDropProvider onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          {middleIds.map((id, index) => {
            const page = middleMap.get(id)
            if (!page) return null
            return (
              <FlowPageCard
                key={id}
                id={id}
                index={index}
                label={page.label}
                enabled={page.enabled}
                selected={selectedPageId === id}
                sortable
                onSelect={() => onSelectPage(id)}
              />
            )
          })}
        </DragDropProvider>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-2"
          onClick={onAddPage}
        >
          <Plus className="size-3.5" />
          Add Page
        </Button>
      </div>

      {/* Bottom fixed pages */}
      <div className="space-y-1 pt-2 border-t border-border">
        {bottomPages.map((page) => (
          <StaticPageCard
            key={page.id}
            id={page.id}
            label={page.label}
            enabled={page.enabled}
            selected={selectedPageId === page.id}
            onSelect={() => onSelectPage(page.id)}
          />
        ))}
      </div>
    </div>
  )
}
