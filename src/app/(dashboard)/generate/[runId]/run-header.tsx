"use client"

import React from "react"
import { BookOpen, Clock, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GenerationRun } from "@/types/database"

/**
 * Run header shared by all run-detail states (in-progress, reviewing, failed).
 *
 * Surfaces the playbook + steering used so an admin can read at a glance
 * what kind of items this run produced.
 */
export function RunHeader({
  run,
  title,
  description,
  onOpenExplainer,
}: {
  run: GenerationRun
  title: string
  description: string
  onOpenExplainer?: () => void
}) {
  const status = run.status
  const config = run.config

  const startedAt = run.startedAt ?? run.created_at
  const completedAt = run.completedAt
  const elapsed = formatElapsed(startedAt, completedAt)

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <p className="text-overline text-gold">Item Generator</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {onOpenExplainer && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenExplainer}
            className="shrink-0"
          >
            <BookOpen className="size-3.5" /> How it works
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={status} />
        {config.playbookSnapshot?.sourcePresetName && (
          <Badge variant="outline" className="gap-1">
            <Wand2 className="size-3" />
            {config.playbookSnapshot.sourcePresetName}
            {config.playbookSnapshot.modifiedFromPreset && (
              <span className="ml-1 text-muted-foreground">(edited)</span>
            )}
          </Badge>
        )}
        {config.measurementMode && (
          <Badge variant="secondary" className="capitalize">
            {config.measurementMode}
          </Badge>
        )}
        {config.useContext && (
          <Badge variant="outline" className="capitalize">
            {config.useContext}
          </Badge>
        )}
        {config.audience?.level && (
          <Badge variant="outline" className="capitalize">
            audience: {config.audience.level}
          </Badge>
        )}
        {config.responseFormatId && (
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide">
            scale set
          </Badge>
        )}
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 tabular-nums ml-auto">
          <Clock className="size-3" /> {elapsed}
        </span>
      </div>
    </header>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    configuring: { variant: "secondary", label: "Configuring" },
    pending: { variant: "secondary", label: "Pending" },
    running: { variant: "default", label: "Running" },
    reviewing: { variant: "default", label: "Reviewing" },
    completed: { variant: "default", label: "Completed" },
    failed: { variant: "destructive", label: "Failed" },
    cancelled: { variant: "outline", label: "Cancelled" },
  }
  const s = styles[status] ?? { variant: "outline" as const, label: status }
  return <Badge variant={s.variant}>{s.label}</Badge>
}

function formatElapsed(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return ""
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const ms = Math.max(0, end - start)
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rs = seconds % 60
  if (minutes < 60) return `${minutes}m ${rs}s`
  const hours = Math.floor(minutes / 60)
  const rm = minutes % 60
  return `${hours}h ${rm}m`
}
