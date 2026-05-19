"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { SectionConfigurator } from "../../../section-configurator"
import { updateAssessmentPresentation } from "@/app/actions/assessments"
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
  constructIds: string[]
  scoringLevel: "factor" | "construct"
  initialFormatMode: FormatMode
  initialFcBlockSize: 3 | 4
  existingSections: ExistingSection[]
  existingBlocks: ExistingFCBlock[]
  noFactors: boolean
}

const SAVE_DEBOUNCE_MS = 1500

export function PresentationEditor({
  assessmentId,
  factorIds,
  constructIds,
  initialFormatMode,
  initialFcBlockSize,
  existingSections,
  existingBlocks,
  noFactors,
}: PresentationEditorProps) {
  const [formatMode, setFormatMode] = useState<FormatMode>(initialFormatMode)
  const [fcBlockSize, setFcBlockSize] = useState<3 | 4>(initialFcBlockSize)
  const [sections, setSections] = useState<SectionDraft[]>([])
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

  if (noFactors) {
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
        factorIds={factorIds}
        constructIds={constructIds}
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
      />
    </div>
  )
}
