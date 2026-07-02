"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { SectionConfigurator } from "../../../section-configurator"
import {
  getAssessmentFactorIds,
  updateAssessmentPresentation,
} from "@/app/actions/assessments"
import type {
  SectionDraft,
  ExistingSection,
  ExistingFCBlock,
} from "@/app/actions/assessments"
import type { FormatMode } from "@/types/database"
import type { ForcedChoiceBlockDraft } from "@/lib/forced-choice-generator"

interface PresentationEditorProps {
  assessmentId: string
  factorIds: string[]
  initialFormatMode: FormatMode
  initialFcBlockSize: 3 | 4
  existingSections: ExistingSection[]
  existingBlocks: ExistingFCBlock[]
  noFactors: boolean
  /** Set false in portals without access to the response-formats library. */
  showFormatLink?: boolean
}

const SAVE_DEBOUNCE_MS = 1500

export function PresentationEditor({
  assessmentId,
  factorIds,
  initialFormatMode,
  initialFcBlockSize,
  existingSections,
  existingBlocks,
  noFactors,
  showFormatLink = true,
}: PresentationEditorProps) {
  const [formatMode, setFormatMode] = useState<FormatMode>(initialFormatMode)
  const [fcBlockSize, setFcBlockSize] = useState<3 | 4>(initialFcBlockSize)
  const [sections, setSections] = useState<SectionDraft[]>([])

  // The factorIds prop comes from an RSC payload the router may cache for up
  // to 30s, and composition auto-saves deliberately don't purge that cache.
  // Reconcile with server truth on mount so the section builder never drafts
  // against a factor set the user just changed on the Composition tab.
  const [liveFactorIds, setLiveFactorIds] = useState<string[]>(factorIds)
  const [factorIdsReconciled, setFactorIdsReconciled] = useState(false)
  useEffect(() => {
    let cancelled = false
    getAssessmentFactorIds(assessmentId)
      .then((ids) => {
        if (cancelled) return
        if (ids !== null) setLiveFactorIds(ids)
        setFactorIdsReconciled(true)
      })
      .catch(() => {
        if (!cancelled) setFactorIdsReconciled(true)
      })
    return () => {
      cancelled = true
    }
  }, [assessmentId])
  const [fcBlocks, setFcBlocks] = useState<ForcedChoiceBlockDraft[]>(
    existingBlocks.map((b) => ({
      items: b.items.map((item) => ({
        itemId: item.itemId,
        constructId: item.constructId,
        position: item.position,
      })),
    })),
  )
  const [, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  )
  // Compared-against snapshot: captured the first time the editor has real data
  // and updated after each successful save. Suppresses no-op saves caused by
  // SectionConfigurator's mount-time hydration when existing sections are present.
  const lastSavedSnapshotRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const snapshot = JSON.stringify({ formatMode, fcBlockSize, sections, fcBlocks })

    // Initial-snapshot capture: wait until SectionConfigurator hydrates with
    // its first non-empty state before locking the baseline.
    if (lastSavedSnapshotRef.current === null) {
      const hasContent =
        sections.length > 0 ||
        fcBlocks.length > 0 ||
        formatMode === "forced_choice"
      if (hasContent) {
        lastSavedSnapshotRef.current = snapshot
      }
      return
    }

    if (snapshot === lastSavedSnapshotRef.current) return

    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus("saving")
      startTransition(async () => {
        const result = await updateAssessmentPresentation(assessmentId, {
          formatMode,
          fcBlockSize: formatMode === "forced_choice" ? fcBlockSize : null,
          sections: formatMode === "traditional" ? sections : [],
          forcedChoiceBlocks: formatMode === "forced_choice" ? fcBlocks : [],
        })
        if (result && "error" in result) {
          setSaveStatus("error")
          toast.error(result.error)
        } else {
          setSaveStatus("saved")
          lastSavedSnapshotRef.current = snapshot
          setTimeout(() => setSaveStatus("idle"), 2000)
        }
      })
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(saveTimerRef.current)
  }, [assessmentId, formatMode, fcBlockSize, sections, fcBlocks])

  // Trust the live (reconciled) factor set over the possibly-stale prop; fall
  // back to the prop until reconciliation resolves to avoid a banner flash.
  const effectiveNoFactors = factorIdsReconciled
    ? liveFactorIds.length === 0
    : noFactors

  if (effectiveNoFactors) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Composition is empty
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add factors or constructs on the Composition tab before configuring
            presentation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end h-5">
        {saveStatus === "saving" && (
          <span className="text-xs text-muted-foreground">Saving…</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-xs text-muted-foreground animate-in fade-in duration-300">
            Saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-destructive">Save failed</span>
        )}
      </div>
      <SectionConfigurator
        factorIds={liveFactorIds}
        sections={sections}
        onSectionsChange={setSections}
        existingSections={existingSections}
        formatMode={formatMode}
        onFormatModeChange={setFormatMode}
        fcBlockSize={fcBlockSize}
        onFcBlockSizeChange={setFcBlockSize}
        fcBlocks={fcBlocks}
        onFcBlocksChange={setFcBlocks}
        existingBlocks={existingBlocks}
        showFormatLink={showFormatLink}
      />
    </div>
  )
}
