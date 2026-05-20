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
import { ConstructSource } from "../../../construct-source"
import { AssessmentCanvas } from "../../../assessment-canvas"
import { updateAssessmentComposition } from "@/app/actions/assessments"
import { getItemsPerConstructLimit } from "@/app/actions/item-selection-rules"
import type {
  BuilderFactor,
  BuilderConstruct,
} from "@/app/actions/assessments"
import type { ConstructShortfall } from "@/app/actions/item-selection-rules"

interface CompositionEditorProps {
  assessmentId: string
  scoringLevel: "factor" | "construct"
  hasExistingSections: boolean
  initialFactorIds: string[]
  initialConstructIds: string[]
  allFactors: BuilderFactor[]
  allConstructs: BuilderConstruct[]
  /** Set to false in portals that don't have access to the factors/constructs library. */
  showLibraryLinks?: boolean
}

export function CompositionEditor({
  assessmentId,
  scoringLevel,
  hasExistingSections,
  initialFactorIds,
  initialConstructIds,
  allFactors,
  allConstructs,
  showLibraryLinks = true,
}: CompositionEditorProps) {
  const [selectedFactors, setSelectedFactors] = useState<BuilderFactor[]>(() =>
    allFactors.filter((f) => initialFactorIds.includes(f.id)),
  )
  const [selectedConstructs, setSelectedConstructs] = useState<BuilderConstruct[]>(
    () => allConstructs.filter((c) => initialConstructIds.includes(c.id)),
  )
  const [isPending, startTransition] = useTransition()

  const selectedIds = useMemo(
    () =>
      new Set(
        (scoringLevel === "construct" ? selectedConstructs : selectedFactors).map(
          (e) => e.id,
        ),
      ),
    [selectedFactors, selectedConstructs, scoringLevel],
  )

  const persist = useCallback(
    (
      factors: BuilderFactor[],
      constructs: BuilderConstruct[],
    ) => {
      startTransition(async () => {
        const result =
          scoringLevel === "factor"
            ? await updateAssessmentComposition(assessmentId, {
                scoringLevel: "factor",
                factors: factors.map((f) => ({ factorId: f.id })),
              })
            : await updateAssessmentComposition(assessmentId, {
                scoringLevel: "construct",
                constructs: constructs.map((c) => ({
                  constructId: c.id,
                  dimensionId: c.dimensionId ?? null,
                })),
              })
        if (result && "error" in result) {
          toast.error(result.error)
        }
      })
    },
    [assessmentId, scoringLevel],
  )

  const toggleFactor = useCallback(
    (factor: BuilderFactor) => {
      setSelectedFactors((prev) => {
        const exists = prev.some((f) => f.id === factor.id)
        const next = exists
          ? prev.filter((f) => f.id !== factor.id)
          : [...prev, factor]
        persist(next, selectedConstructs)
        return next
      })
    },
    [persist, selectedConstructs],
  )

  const toggleConstruct = useCallback(
    (construct: BuilderConstruct) => {
      setSelectedConstructs((prev) => {
        const exists = prev.some((c) => c.id === construct.id)
        const next = exists
          ? prev.filter((c) => c.id !== construct.id)
          : [...prev, construct]
        persist(selectedFactors, next)
        return next
      })
    },
    [persist, selectedFactors],
  )

  const handleCanvasRemove = useCallback(
    (id: string) => {
      if (scoringLevel === "construct") {
        setSelectedConstructs((prev) => {
          const next = prev.filter((c) => c.id !== id)
          persist(selectedFactors, next)
          return next
        })
      } else {
        setSelectedFactors((prev) => {
          const next = prev.filter((f) => f.id !== id)
          persist(next, selectedConstructs)
          return next
        })
      }
    },
    [scoringLevel, persist, selectedFactors, selectedConstructs],
  )

  // Item selection rule info — shown as informational pill on the canvas.
  const factorIds = useMemo(
    () => selectedFactors.map((f) => f.id),
    [selectedFactors],
  )
  const constructIds = useMemo(
    () => selectedConstructs.map((c) => c.id),
    [selectedConstructs],
  )
  const [ruleInfo, setRuleInfo] = useState<{
    constructCount: number
    itemsPerConstruct: number | null
    shortfalls: ConstructShortfall[]
  } | null>(null)

  useEffect(() => {
    if (factorIds.length === 0 && constructIds.length === 0) {
      setRuleInfo(null)
      return
    }
    let cancelled = false
    getItemsPerConstructLimit({ factorIds, constructIds }).then((info) => {
      if (!cancelled) setRuleInfo(info)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorIds.join(","), constructIds.join(",")])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {scoringLevel === "construct" ? "Constructs" : "Factors"}
          </CardTitle>
          <CardDescription>
            Drag {scoringLevel === "construct" ? "constructs" : "factors"} from
            the library on the left into this assessment. Changes save
            automatically.
            {showLibraryLinks && (
              <>
                {" "}
                Open the{" "}
                <Link
                  href={scoringLevel === "construct" ? "/constructs" : "/factors"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  {scoringLevel === "construct" ? "Constructs" : "Factors"} library
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
                if (scoringLevel === "construct") {
                  const construct = allConstructs.find((c) => c.id === entityId)
                  if (construct && !selectedIds.has(entityId)) {
                    toggleConstruct(construct)
                  }
                } else {
                  const factor = allFactors.find((f) => f.id === entityId)
                  if (factor && !selectedIds.has(entityId)) {
                    toggleFactor(factor)
                  }
                }
                return
              }

              if (scoringLevel === "construct") {
                setSelectedConstructs((prev) => move(prev, event))
              } else {
                setSelectedFactors((prev) => move(prev, event))
              }
            }}
          >
            <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
              <div className="rounded-xl border bg-card p-4">
                {scoringLevel === "construct" ? (
                  <ConstructSource
                    constructs={allConstructs}
                    selectedIds={selectedIds}
                    onToggle={toggleConstruct}
                  />
                ) : (
                  <FactorSource
                    factors={allFactors}
                    selectedIds={selectedIds}
                    onToggle={toggleFactor}
                  />
                )}
              </div>

              <div className="rounded-xl border bg-card p-4">
                <AssessmentCanvas
                  mode={scoringLevel}
                  selectedFactors={selectedFactors}
                  selectedConstructs={selectedConstructs}
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
