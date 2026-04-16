"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import { GripVertical, X, Dna, FileQuestion } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { BuilderConstruct } from "@/app/actions/assessments"

interface SortableConstructCardProps {
  construct: BuilderConstruct
  index: number
  onRemove: (id: string) => void
}

export function SortableConstructCard({
  construct,
  index,
  onRemove,
}: SortableConstructCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: construct.id,
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
          <Dna className="size-4 text-competency-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{construct.name}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {construct.dimensionName && (
              <Badge variant="dimension" className="text-[10px] px-1.5 py-0">
                {construct.dimensionName}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="size-3" />
              {construct.itemCount}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(construct.id)}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Remove ${construct.name}`}
        >
          <X className="size-4" />
        </button>
      </CardContent>
    </Card>
  )
}
