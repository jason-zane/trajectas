"use client"

import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ComponentPropsWithoutRef } from "react"

export type SaveState = "idle" | "saving" | "saved" | "error"

interface SaveButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "onClick"> {
  state: SaveState
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const LABELS: Record<SaveState, string> = {
  idle: "Save Changes",
  saving: "Saving...",
  saved: "Saved",
  error: "Save Changes",
}

export function SaveButton({ state, onClick, disabled, className, ...rest }: SaveButtonProps) {
  const isDisabled = disabled || state === "saving" || state === "saved"

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={className}
      {...rest}
    >
      {state === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {state === "saved" && <Check className="mr-2 h-4 w-4" />}
      {LABELS[state]}
    </Button>
  )
}
