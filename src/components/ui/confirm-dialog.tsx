"use client"

import type { ReactNode } from "react"
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  details?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  loading?: boolean
  loadingLabel?: string
  eyebrow?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading,
  loadingLabel = "Please wait…",
  eyebrow,
}: ConfirmDialogProps) {
  const resolvedEyebrow = eyebrow ?? (variant === "destructive" ? "Confirm" : "Confirm")

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      eyebrow={resolvedEyebrow}
      title={title}
      description={description}
    >
      {details ? (
        <ActionDialogBody>{details}</ActionDialogBody>
      ) : (
        <div className="h-2 shrink-0" aria-hidden />
      )}
      <ActionDialogFooter>
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? loadingLabel : confirmLabel}
        </Button>
      </ActionDialogFooter>
    </ActionDialog>
  )
}
