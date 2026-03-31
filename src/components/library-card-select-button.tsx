"use client"

import { Check, Circle } from "lucide-react"

interface LibraryCardSelectButtonProps {
  label: string
  selected: boolean
  onToggle: () => void
}

export function LibraryCardSelectButton({
  label,
  selected,
  onToggle,
}: LibraryCardSelectButtonProps) {
  return (
    <button
      type="button"
      aria-label={`${selected ? "Deselect" : "Select"} ${label}`}
      aria-pressed={selected}
      className={`flex size-8 items-center justify-center rounded-full border backdrop-blur transition-all ${
        selected
          ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
          : "border-border/70 bg-background/88 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      {selected ? <Check className="size-4" /> : <Circle className="size-4" />}
    </button>
  )
}
