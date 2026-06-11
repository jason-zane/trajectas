"use client"

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  cancelGenerationRun,
  getConstructsForGeneration,
  getGenerationRun,
  getResponseFormatsForGeneration,
} from "@/app/actions/generation"
import type { GenerationRun, GeneratedItem } from "@/types/database"

import { FailedView } from "./failed-view"
import { PipelineExplainerSheet } from "./pipeline-explainer-sheet"
import { ProgressView } from "./progress-view"
import { ReviewView } from "./review-view"
import { RunHeader } from "./run-header"

const TERMINAL_STATUSES = new Set(["reviewing", "completed", "failed"])

// Poll fast while the run is producing output, back off when nothing
// changes between polls (long generations spend minutes per batch), and
// stop entirely on terminal status.
const POLL_MIN_MS = 2000
const POLL_MAX_MS = 30_000
const POLL_BACKOFF_FACTOR = 1.5

export default function GenerationRunPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)

  const [run, setRun] = useState<GenerationRun | null>(null)
  const [items, setItems] = useState<GeneratedItem[]>([])
  const [constructNameMap, setConstructNameMap] = useState<Map<string, string>>(
    new Map(),
  )
  const [responseFormats, setResponseFormats] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [loading, setLoading] = useState(true)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollDelayRef = useRef(POLL_MIN_MS)
  const lastPollSignatureRef = useRef("")

  const fetchData = useCallback(async (): Promise<boolean> => {
    const result = await getGenerationRun(runId)
    if (!result) return true

    setRun(result.run)
    setItems(result.items)
    setLoading(false)

    if (TERMINAL_STATUSES.has(result.run.status)) {
      return false
    }

    const signature = `${result.run.status}:${result.items.length}`
    if (signature !== lastPollSignatureRef.current) {
      lastPollSignatureRef.current = signature
      pollDelayRef.current = POLL_MIN_MS
    } else {
      pollDelayRef.current = Math.min(
        Math.round(pollDelayRef.current * POLL_BACKOFF_FACTOR),
        POLL_MAX_MS,
      )
    }
    return true
  }, [runId])

  useEffect(() => {
    getConstructsForGeneration().then((constructs) => {
      const map = new Map<string, string>()
      for (const c of constructs) {
        map.set(c.id, c.name)
      }
      setConstructNameMap(map)
    })
    getResponseFormatsForGeneration()
      .then(setResponseFormats)
      .catch(() => {})
  }, [])

  const responseFormatLabel = useMemo(() => {
    const id = run?.config.responseFormatId
    if (!id) return undefined
    return responseFormats.find((rf) => rf.id === id)?.name
  }, [run, responseFormats])

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      const keepPolling = await fetchData()
      if (cancelled || !keepPolling) return
      pollingRef.current = setTimeout(tick, pollDelayRef.current)
    }

    void tick()

    return () => {
      cancelled = true
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [fetchData])

  if (loading || !run) {
    return (
      <div className="space-y-8 max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto py-8">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading run data…
        </div>
      </div>
    )
  }

  const isReviewing = run.status === "reviewing" || run.status === "completed"
  const isFailed = run.status === "failed"

  const constructNames = run.config.constructIds.map(
    (id) => constructNameMap.get(id) ?? id,
  )
  const pageTitle =
    constructNames.length === 0
      ? "Generation run"
      : constructNames.length <= 3
        ? constructNames.join(", ")
        : `${constructNames.length} constructs`

  const description = isReviewing
    ? "Review and accept generated items into your library."
    : isFailed
      ? "The generation pipeline encountered an error."
      : "Generation pipeline is running…"

  return (
    <div className="space-y-8 max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto py-8">
      <RunHeader
        run={run}
        title={pageTitle}
        description={description}
        onOpenExplainer={() => setExplainerOpen(true)}
      />

      <PipelineExplainerSheet open={explainerOpen} onOpenChange={setExplainerOpen} />

      {isFailed && <FailedView run={run} />}
      {!isFailed && isReviewing && (
        <ReviewView
          run={run}
          items={items}
          constructNameMap={constructNameMap}
          responseFormatLabel={responseFormatLabel}
        />
      )}
      {!isFailed && !isReviewing && (
        <ProgressView
          run={run}
          onCancel={async () => {
            const result = await cancelGenerationRun(runId)
            if (result.success) {
              toast.error("Run cancelled")
              fetchData()
            } else {
              toast.error(result.error ?? "Failed to cancel run")
            }
          }}
        />
      )}
    </div>
  )
}
