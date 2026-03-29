"use client"

import { DragDropProvider } from "@dnd-kit/react"
import { move } from "@dnd-kit/helpers"
import { useState, useEffect } from "react"
import { Plus, AlertTriangle, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { FlowPageCard, StaticPageCard } from "./flow-page-card"
import type { FlowConfig } from "@/lib/experience/types"

/** Sentinel order — pages below this are pre-assessment, at/above are post-assessment. */
const SENTINEL_ORDER = 100

/** Describes a page in the sidebar list. */
export interface FlowPageEntry {
  id: string
  label: string
  enabled: boolean
  /** Whether this page can be reordered. */
  sortable: boolean
  /** Zone: "pre" | "assessment" | "post" | "terminal" */
  zone: "pre" | "assessment" | "post" | "terminal"
}

interface FlowSidebarProps {
  flowConfig: Partial<FlowConfig>
  selectedPageId: string
  onSelectPage: (id: string) => void
  onReorder: (preIds: string[], postIds: string[]) => void
  onAddPage: () => void
}

/** Labels for built-in pages. */
const PAGE_LABELS: Record<string, string> = {
  join: "Join",
  welcome: "Welcome",
  consent: "Consent",
  demographics: "Demographics",
  section_intro: "Section Intro",
  runner: "Assessment Runner",
  review: "Review",
  complete: "Complete",
  report: "Report",
  expired: "Expired",
}

/** Pages that appear in the flow config and can be sorted. */
const SORTABLE_BUILT_IN = [
  "join", "welcome", "consent", "demographics",
  "review", "complete", "report",
] as const

/** Build the full page list from flow config. */
export function buildPageList(flowConfig: Partial<FlowConfig>): FlowPageEntry[] {
  const pages: FlowPageEntry[] = []

  // Collect all sortable pages with their order values
  const sortableEntries: { id: string; label: string; enabled: boolean; order: number }[] = []

  for (const id of SORTABLE_BUILT_IN) {
    const cfg = flowConfig[id]
    if (!cfg) continue
    sortableEntries.push({
      id,
      label: PAGE_LABELS[id],
      enabled: cfg.enabled,
      order: (cfg as { order: number }).order,
    })
  }

  // Custom pages
  const customPages = flowConfig.customPages ?? []
  for (const cp of customPages) {
    sortableEntries.push({
      id: cp.id,
      label: cp.label,
      enabled: cp.enabled,
      order: cp.order,
    })
  }

  // Split into pre-assessment (order < 100) and post-assessment (order >= 100)
  const preEntries = sortableEntries
    .filter((e) => e.order < SENTINEL_ORDER)
    .sort((a, b) => a.order - b.order)

  const postEntries = sortableEntries
    .filter((e) => e.order >= SENTINEL_ORDER)
    .sort((a, b) => a.order - b.order)

  for (const entry of preEntries) {
    pages.push({
      id: entry.id,
      label: entry.label,
      enabled: entry.enabled,
      sortable: true,
      zone: "pre",
    })
  }

  // Assessment zone: section_intro + runner (non-sortable, always enabled)
  for (const id of ["section_intro", "runner"] as const) {
    pages.push({
      id,
      label: PAGE_LABELS[id],
      enabled: true,
      sortable: false,
      zone: "assessment",
    })
  }

  for (const entry of postEntries) {
    pages.push({
      id: entry.id,
      label: entry.label,
      enabled: entry.enabled,
      sortable: true,
      zone: "post",
    })
  }

  // Terminal: expired only
  const expiredCfg = flowConfig.expired
  pages.push({
    id: "expired",
    label: PAGE_LABELS.expired,
    enabled: expiredCfg?.enabled ?? true,
    sortable: false,
    zone: "terminal",
  })

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
  const prePages = allPages.filter((p) => p.zone === "pre")
  const assessmentPages = allPages.filter((p) => p.zone === "assessment")
  const postPages = allPages.filter((p) => p.zone === "post")
  const terminalPages = allPages.filter((p) => p.zone === "terminal")

  const [preIds, setPreIds] = useState(prePages.map((p) => p.id))
  const [postIds, setPostIds] = useState(postPages.map((p) => p.id))

  // Sync when flowConfig changes (e.g. custom page added/removed)
  useEffect(() => {
    setPreIds(prePages.map((p) => p.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(prePages.map((p) => p.id))])

  useEffect(() => {
    setPostIds(postPages.map((p) => p.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(postPages.map((p) => p.id))])

  // Pre-assessment drag handlers
  function handlePreDragOver(event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0]) {
    setPreIds((items) => move(items, event))
  }
  function handlePreDragEnd() {
    onReorder(preIds, postIds)
  }

  // Post-assessment drag handlers
  function handlePostDragOver(event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0]) {
    setPostIds((items) => move(items, event))
  }
  function handlePostDragEnd() {
    onReorder(preIds, postIds)
  }

  const preMap = new Map(prePages.map((p) => [p.id, p]))
  const postMap = new Map(postPages.map((p) => [p.id, p]))

  // Check if Join is not in first position
  const joinNotFirst = preIds.length > 0 && preIds[0] !== "join"

  return (
    <div className="flex flex-col h-full gap-1">
      {/* Global settings button */}
      <div className="pb-2 border-b border-border">
        <button
          type="button"
          onClick={() => onSelectPage("__settings__")}
          className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors ${
            selectedPageId === "__settings__"
              ? "bg-primary/10 text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Settings className="size-3.5" />
          Global Settings
        </button>
      </div>

      {/* Pre-assessment sortable pages */}
      <div className="py-2 space-y-1">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Pre-assessment
        </p>
        <DragDropProvider onDragOver={handlePreDragOver} onDragEnd={handlePreDragEnd}>
          {preIds.map((id, index) => {
            const page = preMap.get(id)
            if (!page) return null
            return (
              <div key={id} className="flex items-center gap-1">
                <FlowPageCard
                  id={id}
                  index={index}
                  label={page.label}
                  enabled={page.enabled}
                  selected={selectedPageId === id}
                  sortable
                  onSelect={() => onSelectPage(id)}
                />
                {id === "join" && joinNotFirst && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <p className="text-xs">
                          Anonymous mode required — Join must be first until anonymous sessions are supported.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )
          })}
        </DragDropProvider>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-1"
          onClick={onAddPage}
        >
          <Plus className="size-3.5" />
          Add Page
        </Button>
      </div>

      {/* Assessment zone (fixed) */}
      <div className="space-y-1 py-2 border-y border-border">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Assessment
        </p>
        {assessmentPages.map((page) => (
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

      {/* Post-assessment sortable pages */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Post-assessment
        </p>
        <DragDropProvider onDragOver={handlePostDragOver} onDragEnd={handlePostDragEnd}>
          {postIds.map((id, index) => {
            const page = postMap.get(id)
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
      </div>

      {/* Terminal (Expired — non-sortable) */}
      <div className="space-y-1 pt-2 border-t border-border">
        {terminalPages.map((page) => (
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
