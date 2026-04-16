"use client"

import { useDraggable } from "@dnd-kit/react"
import { Dna, FileQuestion, CheckCircle, Plus } from "lucide-react"
import type { BuilderConstruct } from "@/app/actions/assessments"

interface DraggableConstructCardProps {
  construct: BuilderConstruct
  isAdded: boolean
  onToggle: (construct: BuilderConstruct) => void
}

export function DraggableConstructCard({
  construct,
  isAdded,
  onToggle,
}: DraggableConstructCardProps) {
  const { ref, isDragging } = useDraggable({
    id: `source-${construct.id}`,
    data: { constructId: construct.id },
  })

  return (
    <div
      ref={ref}
      className={`group/construct relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
        isAdded
          ? "border-competency-accent/30 bg-competency-bg/30 ring-2 ring-competency-accent/20"
          : "border-border/50 bg-card hover:border-border hover:bg-muted/30"
      } ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-competency-bg">
        <Dna className="size-3.5 text-competency-accent" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-snug">
          {construct.name}
        </p>
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-0.5">
          <span className="inline-flex items-center gap-0.5">
            <FileQuestion className="size-3" />
            {construct.itemCount}
          </span>
        </div>
      </div>

      {isAdded ? (
        <CheckCircle className="size-4 shrink-0 text-competency-accent" />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(construct)
          }}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-0 group-hover/construct:opacity-100 hover:text-primary hover:bg-primary/10 transition-all"
          aria-label={`Add ${construct.name}`}
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  )
}
