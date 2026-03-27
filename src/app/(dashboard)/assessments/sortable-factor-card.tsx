"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import { GripVertical, X, Brain, Dna, FileQuestion } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { BuilderFactor } from "@/app/actions/assessments"

interface SortableFactorCardProps {
  factor: BuilderFactor
  index: number
  onRemove: (id: string) => void
}

export function SortableFactorCard({
  factor,
  index,
  onRemove,
}: SortableFactorCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: factor.id,
    index,
  })

  return (
    <Card
      ref={ref}
      className={`border-l-[3px] border-l-competency-accent transition-all duration-200 ${
        isDragging ? "opacity-50 scale-[0.98] ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <button
          ref={handleRef}
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-competency-bg">
          <Brain className="size-4 text-competency-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{factor.name}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {factor.dimensionName && (
              <Badge variant="dimension" className="text-[10px] px-1.5 py-0">
                {factor.dimensionName}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1">
              <Dna className="size-3" />
              {factor.constructCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="size-3" />
              {factor.itemCount}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(factor.id)}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Remove ${factor.name}`}
        >
          <X className="size-4" />
        </button>
      </CardContent>
    </Card>
  )
}
