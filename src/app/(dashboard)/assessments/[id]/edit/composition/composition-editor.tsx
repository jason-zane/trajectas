"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import Link from "next/link"
import { unstable_isUnrecognizedActionError } from "next/navigation"
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

/** Trailing debounce so a drag burst coalesces into one save. */
const SAVE_DEBOUNCE_MS = 400

type RuleInfo = {
  constructCount: number
  itemsPerConstruct: number | null
  shortfalls: ConstructShortfall[]
}

export function CompositionEditor({
  assessmentId,
  hasExistingSections,
  initialFactorIds,
  allFactors,
  showLibraryLinks = true,
}: CompositionEditorProps) {
  // Preserve the server-persisted canvas order (assessment_factors.display_order)
  // rather than re-sorting the selection into library order.
  const [selectedFactors, setSelectedFactors] = useState<BuilderFactor[]>(() => {
    const byId = new Map(allFactors.map((f) => [f.id, f]))
    return initialFactorIds
      .map((id) => byId.get(id))
      .filter((f): f is BuilderFactor => Boolean(f))
  })
  const [isPending, startTransition] = useTransition()

  const selectedIds = useMemo(
    () => new Set(selectedFactors.map((e) => e.id)),
    [selectedFactors],
  )

  const save = useCallback(
    (factors: BuilderFactor[]) => {
      startTransition(async () => {
        try {
          const result = await updateAssessmentComposition(assessmentId, {
            factors: factors.map((f) => ({ factorId: f.id })),
          })
          if (result && "error" in result) {
            toast.error(result.error)
          }
        } catch (error) {
          // A thrown action failure (deploy skew, rate limiting, network drop)
          // must surface as a toast — letting it bubble unwinds the whole
          // route into the error boundary and unmounts the editor.
          if (unstable_isUnrecognizedActionError(error)) {
            toast.error(
              "Trajectas was updated in the background. Refresh the page to keep editing.",
            )
          } else {
            toast.error(
              "Couldn't save your factor selection. Check your connection and try again.",
            )
          }
        }
      })
    },
    [assessmentId],
  )

  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestFactorsRef = useRef<BuilderFactor[] | null>(null)

  const persist = useCallback(
    (factors: BuilderFactor[]) => {
      latestFactorsRef.current = factors
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current)
      pendingSaveRef.current = setTimeout(() => {
        pendingSaveRef.current = null
        const latest = latestFactorsRef.current
        latestFactorsRef.current = null
        if (latest) save(latest)
      }, SAVE_DEBOUNCE_MS)
    },
    [save],
  )

  // Flush a still-debouncing save if the editor unmounts (tab switch,
  // navigation) so the last change isn't silently dropped.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current)
        const latest = latestFactorsRef.current
        if (latest) {
          void updateAssessmentComposition(assessmentId, {
            factors: latest.map((f) => ({ factorId: f.id })),
          }).catch(() => {})
        }
      }
    }
  }, [assessmentId])

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
  const [ruleInfo, setRuleInfo] = useState<RuleInfo | null>(null)

  // Rule info depends on the SET of factors, not their order — key the lookup
  // order-insensitively and cache it so reorders and re-adds don't fire extra
  // action POSTs (each counts against the per-user action rate budget).
  const ruleCacheRef = useRef(new Map<string, RuleInfo>())
  const ruleKey = useMemo(() => [...factorIds].sort().join(","), [factorIds])

  useEffect(() => {
    if (factorIds.length === 0) {
      setRuleInfo(null)
      return
    }
    const cached = ruleCacheRef.current.get(ruleKey)
    if (cached) {
      setRuleInfo(cached)
      return
    }
    let cancelled = false
    getItemsPerConstructLimit({ factorIds })
      .then((info) => {
        ruleCacheRef.current.set(ruleKey, info)
        if (!cancelled) setRuleInfo(info)
      })
      .catch(() => {
        // Advisory display only — a failed lookup must never crash the editor.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleKey])

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

              // Reorders persist too — display_order round-trips, so the
              // arrangement survives reloads instead of silently reverting.
              setSelectedFactors((prev) => {
                const next = move(prev, event)
                persist(next)
                return next
              })
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
