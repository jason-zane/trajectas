"use client"

import { useDroppable } from "@dnd-kit/react"
import { Layers, FileQuestion, Inbox, AlertTriangle } from "lucide-react"
import { SortableFactorCard } from "./sortable-factor-card"
import { SortableConstructCard } from "./sortable-construct-card"
import type { BuilderFactor, BuilderConstruct } from "@/app/actions/assessments"
import type { ConstructShortfall } from "@/app/actions/item-selection-rules"

interface AssessmentCanvasProps {
  mode?: "factor" | "construct"
  selectedFactors?: BuilderFactor[]
  selectedConstructs?: BuilderConstruct[]
  onRemove: (id: string) => void
  ruleInfo?: {
    constructCount: number
    itemsPerConstruct: number | null
    shortfalls: ConstructShortfall[]
  } | null
}

export function AssessmentCanvas({
  mode = "factor",
  selectedFactors = [],
  selectedConstructs = [],
  onRemove,
  ruleInfo,
}: AssessmentCanvasProps) {
  const { ref, isDropTarget } = useDroppable({ id: "assessment-canvas" })

  const isConstructMode = mode === "construct"
  const count = isConstructMode ? selectedConstructs.length : selectedFactors.length
  const unitLabel = isConstructMode ? "construct" : "factor"
  const unitLabelPlural = isConstructMode ? "constructs" : "factors"

  const totalItems = isConstructMode
    ? selectedConstructs.reduce((sum, c) => sum + c.itemCount, 0)
    : selectedFactors.reduce((sum, f) => sum + f.itemCount, 0)
  const totalConstructs = isConstructMode
    ? selectedConstructs.length
    : selectedFactors.reduce((sum, f) => sum + f.constructCount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Selected {isConstructMode ? "Constructs" : "Factors"}
        </h3>
        {count > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" />
              {count} {count === 1 ? unitLabel : unitLabelPlural}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="size-3.5" />
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>
          </div>
        )}
      </div>

      <div
        ref={ref}
        className={`min-h-[240px] rounded-xl border-2 border-dashed p-3 transition-all duration-200 ${
          isDropTarget
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : count === 0
              ? "border-border/50 bg-muted/20"
              : "border-border/30 bg-transparent"
        }`}
      >
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No {unitLabelPlural} selected
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs">
              Drag {unitLabelPlural} from the library or click the + button to
              add them to your assessment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {isConstructMode
              ? selectedConstructs.map((construct, index) => (
                  <SortableConstructCard
                    key={construct.id}
                    construct={construct}
                    index={index}
                    onRemove={onRemove}
                  />
                ))
              : selectedFactors.map((factor, index) => (
                  <SortableFactorCard
                    key={factor.id}
                    factor={factor}
                    index={index}
                    onRemove={onRemove}
                  />
                ))}
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="space-y-2">
          <div className="rounded-lg bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            {isConstructMode
              ? `${count} constructs`
              : `${count} factors covering ${totalConstructs} constructs`}
            {ruleInfo?.itemsPerConstruct != null ? (
              <>
                {" "}
                &mdash; {ruleInfo.itemsPerConstruct} items/construct (
                {totalConstructs * ruleInfo.itemsPerConstruct} items target)
              </>
            ) : (
              <> and {totalItems} items</>
            )}
          </div>

          {ruleInfo && ruleInfo.shortfalls.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
              <div className="text-xs text-amber-800 dark:text-amber-400">
                <p className="font-medium">
                  {ruleInfo.shortfalls.length}{" "}
                  {ruleInfo.shortfalls.length === 1
                    ? "construct has"
                    : "constructs have"}{" "}
                  fewer items than the target ({ruleInfo.itemsPerConstruct})
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {ruleInfo.shortfalls.slice(0, 5).map((s) => (
                    <li key={s.constructId}>
                      {s.constructName}: {s.available} of {s.target} items
                      available
                    </li>
                  ))}
                  {ruleInfo.shortfalls.length > 5 && (
                    <li>...and {ruleInfo.shortfalls.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
