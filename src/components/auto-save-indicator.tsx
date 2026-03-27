"use client"

import { Loader2 } from "lucide-react"
import type { AutoSaveStatus } from "@/hooks/use-auto-save"

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  onRetry?: () => void
}

export function AutoSaveIndicator({ status, onRetry }: AutoSaveIndicatorProps) {
  if (status === "idle") return null

  return (
    <div className="flex items-center gap-1.5 mt-1 h-5">
      {status === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <span className="text-xs text-muted-foreground animate-in fade-in duration-300">
          Saved just now
        </span>
      )}
      {status === "error" && (
        <span className="text-xs text-destructive">
          Failed to save
          {onRetry && (
            <>
              {" "}
              &middot;{" "}
              <button
                type="button"
                onClick={onRetry}
                className="underline underline-offset-2 hover:text-destructive/80"
              >
                Retry
              </button>
            </>
          )}
        </span>
      )}
    </div>
  )
}
