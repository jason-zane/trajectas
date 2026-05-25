"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { DragDropProvider } from "@dnd-kit/react"
import { move } from "@dnd-kit/helpers"
import { AlertTriangle } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FactorSource } from "../../../factor-source"
import { AssessmentCanvas } from "../../../assessment-canvas"
import { updateAssessmentComposition } from "@/app/actions/assessments"
import { getItemsPerConstructLimit } from "@/app/actions/item-selection-rules"
import type { BuilderFactor } from "@/app/actions/assessments"
import type { ConstructShortfall } from "@/app/actions/item-selection-rules"

interface CompositionEditorProps {
  assessmentId: string
  hasExistingSections: boolean
  initialFactorIds: string[]
  allFactors: BuilderFactor[]
  /** Set to false in portals that don't have access to the factors library. */
  showLibraryLinks?: boolean
}

export function CompositionEditor({
  assessmentId,
  hasExistingSections,
  initialFactorIds,
  allFactors,
  showLibraryLinks = true,
}: CompositionEditorProps) {
  const [selectedFactors, setSelectedFactors] = useState<BuilderFactor[]>(() =>
    allFactors.filter((f) => initialFactorIds.includes(f.id)),
  )
  const [isPending, startTransition] = useTransition()

  const selectedIds = useMemo(
    () => new Set(selectedFactors.map((e) => e.id)),
    [selectedFactors],
  )

  const persist = useCallback(
    (factors: BuilderFactor[]) => {
      startTransition(async () => {
        const result = await updateAssessmentComposition(assessmentId, {
          factors: factors.map((f) => ({ factorId: f.id })),
        })
        if (result && "error" in result) {
          toast.error(result.error)
        }
      })
    },
    [assessmentId],
  )

  const toggleFactor = useCallback(
    (factor: BuilderFactor) => {
      setSelectedFactors((prev) => {
        const exists = prev.some((f) => f.id === factor.id)
        const next = exists
          ? prev.filter((f) => f.id !== factor.id)
          : [...prev, factor]
        persist(next)
        return next
      })
    },
    [persist],
  )

  const handleCanvasRemove = useCallback(
    (id: string) => {
      setSelectedFactors((prev) => {
        const next = prev.filter((f) => f.id !== id)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const factorIds = useMemo(
    () => selectedFactors.map((f) => f.id),
    [selectedFactors],
  )
  const [ruleInfo, setRuleInfo] = useState<{
    constructCount: number
    itemsPerConstruct: number | null
    shortfalls: ConstructShortfall[]
  } | null>(null)

  useEffect(() => {
    if (factorIds.length === 0) {
      setRuleInfo(null)
      return
    }
    let cancelled = false
    getItemsPerConstructLimit({ factorIds }).then((info) => {
      if (!cancelled) setRuleInfo(info)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorIds.join(",")])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Factors</CardTitle>
          <CardDescription>
            Drag factors from the library on the left into this assessment.
            Changes save automatically.
            {showLibraryLinks && (
              <>
                {" "}
                Open the{" "}
                <Link
                  href="/factors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  Factors library
                </Link>
                {" "}
                to edit definitions.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasExistingSections && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-2.5">
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs text-foreground leading-relaxed">
                This assessment has presentation sections. Changing composition
                here may make sections stale — visit the Presentation tab
                afterwards to regenerate them.
              </p>
            </div>
          )}

          <DragDropProvider
            onDragEnd={(event) => {
              const { source, target } = event.operation
              if (!source || !target) return

              const sourceId = String(source.id)
              if (sourceId.startsWith("source-")) {
                const entityId = sourceId.replace("source-", "")
                const factor = allFactors.find((f) => f.id === entityId)
                if (factor && !selectedIds.has(entityId)) {
                  toggleFactor(factor)
                }
                return
              }

              setSelectedFactors((prev) => move(prev, event))
            }}
          >
            <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
              <div className="rounded-xl border bg-card p-4">
                <FactorSource
                  factors={allFactors}
                  selectedIds={selectedIds}
                  onToggle={toggleFactor}
                />
              </div>

              <div className="rounded-xl border bg-card p-4">
                <AssessmentCanvas
                  selectedFactors={selectedFactors}
                  onRemove={handleCanvasRemove}
                  ruleInfo={ruleInfo}
                  showLibraryLinks={showLibraryLinks}
                />
              </div>
            </div>
          </DragDropProvider>

          {isPending && (
            <p className="mt-3 text-xs text-muted-foreground">Saving…</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
