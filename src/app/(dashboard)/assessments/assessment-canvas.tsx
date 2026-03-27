"use client"

import { useDroppable } from "@dnd-kit/react"
import { Layers, FileQuestion, Inbox } from "lucide-react"
import { SortableFactorCard } from "./sortable-factor-card"
import type { BuilderFactor } from "@/app/actions/assessments"

interface AssessmentCanvasProps {
  selectedFactors: BuilderFactor[]
  onRemove: (id: string) => void
}

export function AssessmentCanvas({
  selectedFactors,
  onRemove,
}: AssessmentCanvasProps) {
  const { ref, isDropTarget } = useDroppable({ id: "assessment-canvas" })

  const totalItems = selectedFactors.reduce((sum, f) => sum + f.itemCount, 0)
  const totalConstructs = selectedFactors.reduce((sum, f) => sum + f.constructCount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Selected Factors
        </h3>
        {selectedFactors.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" />
              {selectedFactors.length} {selectedFactors.length === 1 ? "factor" : "factors"}
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
            : selectedFactors.length === 0
              ? "border-border/50 bg-muted/20"
              : "border-border/30 bg-transparent"
        }`}
      >
        {selectedFactors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No factors selected
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs">
              Drag factors from the library or click the + button to add them to your assessment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedFactors.map((factor, index) => (
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

      {selectedFactors.length > 0 && (
        <div className="rounded-lg bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          {selectedFactors.length} factors covering {totalConstructs} constructs and {totalItems} items
        </div>
      )}
    </div>
  )
}
