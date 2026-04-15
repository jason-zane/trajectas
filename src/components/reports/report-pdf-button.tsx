"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ReportPdfStatus } from "@/types/database"

type ButtonStatus = "idle" | ReportPdfStatus

type ReportPdfStatusPayload = {
  status: ButtonStatus
  pdfUrl?: string
  error?: string
}

type ButtonVariant = React.ComponentProps<typeof Button>["variant"]
type ButtonSize = React.ComponentProps<typeof Button>["size"]

function isStatusPayload(
  payload: ReportPdfStatusPayload | { error?: string },
): payload is ReportPdfStatusPayload {
  return typeof (payload as ReportPdfStatusPayload).status === "string"
}

interface ReportPdfButtonProps {
  snapshotId: string
  initialPdfUrl?: string
  initialPdfStatus?: ReportPdfStatus
  reportToken?: string
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

function buildDownloadUrl(snapshotId: string) {
  return `/api/reports/${snapshotId}/pdf`
}

function buildStatusUrl(snapshotId: string) {
  return `/api/reports/${snapshotId}/status`
}

export function ReportPdfButton({
  snapshotId,
  initialPdfUrl,
  initialPdfStatus,
  reportToken,
  label: buttonLabel = "Download PDF",
  variant = "outline",
  size = "default",
  className,
}: ReportPdfButtonProps) {
  const query = reportToken
    ? `?reportToken=${encodeURIComponent(reportToken)}`
    : ""
  const downloadUrl = useMemo(
    () => `${buildDownloadUrl(snapshotId)}${query}`,
    [query, snapshotId],
  )
  const statusUrl = useMemo(
    () => `${buildStatusUrl(snapshotId)}${query}`,
    [query, snapshotId],
  )
  const [status, setStatus] = useState<ButtonStatus>(
    initialPdfUrl ? "ready" : (initialPdfStatus ?? "idle"),
  )
  const [error, setError] = useState<string | null>(null)
  const [autoDownload, setAutoDownload] = useState(false)
  const isPolling = status === "queued" || status === "generating"

  useEffect(() => {
    if (!isPolling) {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let delay = 2000
    const startedAt = Date.now()

    const poll = async () => {
      try {
        const response = await fetch(statusUrl, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => ({}))) as
          | ReportPdfStatusPayload
          | { error?: string }

        if (cancelled) {
          return
        }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to refresh PDF status")
        }

        if (!isStatusPayload(payload)) {
          throw new Error(payload.error ?? "Failed to refresh PDF status")
        }

        if (payload.status === "ready") {
          setStatus("ready")
          setError(null)
          setAutoDownload(true)
          return
        }

        if (payload.status === "failed") {
          setStatus("failed")
          setError(payload.error ?? "PDF generation failed")
          toast.error(payload.error ?? "PDF generation failed")
          return
        }

        if (Date.now() - startedAt >= 60000) {
          setStatus("idle")
          toast.error(
            "PDF generation is taking longer than expected. Try again in a moment.",
          )
          return
        }

        setStatus(payload.status)
        delay = Math.min(Math.round(delay * 1.5), 8000)
        timeoutId = setTimeout(poll, delay)
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setStatus("idle")
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to refresh PDF status",
        )
        toast.error(
          nextError instanceof Error
            ? nextError.message
            : "Failed to refresh PDF status",
        )
      }
    }

    timeoutId = setTimeout(poll, delay)
    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isPolling, statusUrl])

  // Auto-download when generation completes
  useEffect(() => {
    if (!autoDownload) return
    setAutoDownload(false)
    window.location.assign(downloadUrl)
  }, [autoDownload, downloadUrl])

  async function handleClick() {
    // If the PDF is already generated, download it immediately
    if (status === "ready") {
      window.location.assign(downloadUrl)
      return
    }

    // Otherwise kick off generation — auto-download will trigger when ready
    try {
      setError(null)
      const response = await fetch(downloadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
      const payload = (await response.json().catch(() => ({}))) as
        | ReportPdfStatusPayload
        | { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to start PDF generation")
      }

      if (!isStatusPayload(payload)) {
        throw new Error(payload.error ?? "Failed to start PDF generation")
      }

      setStatus(payload.status)
      if (payload.status === "failed" && payload.error) {
        setError(payload.error)
        toast.error(payload.error)
      }
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Failed to start PDF generation"
      setStatus("failed")
      setError(message)
      toast.error(message)
    }
  }

  const displayLabel = isPolling
    ? "Preparing report\u2026"
    : status === "failed"
      ? "Retry"
      : buttonLabel

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isPolling}
      title={error ?? undefined}
    >
      {isPolling ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {displayLabel}
    </Button>
  )
}
