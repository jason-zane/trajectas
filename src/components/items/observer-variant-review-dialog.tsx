"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Sparkles, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  generateObserverDrafts,
  commitObserverVariants,
} from "@/app/actions/observer-variants"

interface ObserverVariantReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Construct item ids to draft observer variants for. */
  itemIds: string[]
  /** Called after at least one variant is saved. */
  onCommitted?: () => void
}

interface Row {
  itemId: string
  constructName: string
  selfStem: string
  currentObserver: string | null
  text: string
  include: boolean
}

type Phase = "idle" | "loading" | "ready" | "error"

export function ObserverVariantReviewDialog({
  open,
  onOpenChange,
  itemIds,
  onCommitted,
}: ObserverVariantReviewDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [rows, setRows] = useState<Row[]>([])
  const [failedCount, setFailedCount] = useState(0)
  const [omittedCount, setOmittedCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  // Draft whenever the dialog opens with a fresh selection.
  useEffect(() => {
    if (!open || itemIds.length === 0) return
    let cancelled = false
    setPhase("loading")
    setErrorMsg(null)
    setRows([])
    setFailedCount(0)
    generateObserverDrafts(itemIds)
      .then((res) => {
        if (cancelled) return
        if (res.error && res.drafts.length === 0) {
          setErrorMsg(res.error)
          setPhase("error")
          return
        }
        setRows(
          res.drafts.map((d) => ({
            itemId: d.itemId,
            constructName: d.constructName,
            selfStem: d.selfStem,
            currentObserver: d.currentObserver,
            text: d.draft,
            include: true,
          })),
        )
        setFailedCount(res.failedIds.length)
        setOmittedCount(res.omittedForLimit)
        setPhase("ready")
      })
      .catch(() => {
        if (cancelled) return
        setErrorMsg("Something went wrong generating variants.")
        setPhase("error")
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemIds.join(",")])

  function updateRow(itemId: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)),
    )
  }

  const includedValid = rows.filter(
    (r) => r.include && r.text.trim().length > 0,
  )

  function handleSave() {
    if (includedValid.length === 0) return
    startSaving(async () => {
      const res = await commitObserverVariants(
        includedValid.map((r) => ({
          itemId: r.itemId,
          stemObserver: r.text,
        })),
      )
      if (res.error && res.updated === 0) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Saved ${res.updated} observer ${res.updated === 1 ? "variant" : "variants"}`,
      )
      onCommitted?.()
      onOpenChange(false)
    })
  }

  function handleRegenerate() {
    // Re-trigger the effect by toggling phase; itemIds unchanged so we call directly.
    setPhase("loading")
    setErrorMsg(null)
    generateObserverDrafts(itemIds)
      .then((res) => {
        if (res.error && res.drafts.length === 0) {
          setErrorMsg(res.error)
          setPhase("error")
          return
        }
        setRows(
          res.drafts.map((d) => ({
            itemId: d.itemId,
            constructName: d.constructName,
            selfStem: d.selfStem,
            currentObserver: d.currentObserver,
            text: d.draft,
            include: true,
          })),
        )
        setFailedCount(res.failedIds.length)
        setOmittedCount(res.omittedForLimit)
        setPhase("ready")
      })
      .catch(() => {
        setErrorMsg("Something went wrong generating variants.")
        setPhase("error")
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" />
            Observer wording for 360
          </DialogTitle>
          <DialogDescription>
            Review the third-person observer phrasing for each item. Edit
            anything that drifts, untick any you don&apos;t want, then save.
            Self wording is unchanged — this only fills the observer variant.
          </DialogDescription>
        </DialogHeader>

        {phase === "loading" && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Drafting observer wording…
          </div>
        )}

        {phase === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {phase === "ready" && (
          <>
            {omittedCount > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  Your selection exceeded the per-run limit — {omittedCount}{" "}
                  {omittedCount === 1 ? "item was" : "items were"} not included
                  here. Save these, then run the action again on the rest.
                </AlertDescription>
              </Alert>
            )}
            {failedCount > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  Couldn&apos;t draft {failedCount}{" "}
                  {failedCount === 1 ? "item" : "items"} — they were skipped.
                  You can try Regenerate.
                </AlertDescription>
              </Alert>
            )}
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {rows.map((r) => (
                <div
                  key={r.itemId}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[11px]">
                      {r.constructName || "Unassigned"}
                    </Badge>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={r.include}
                        onCheckedChange={(v) =>
                          updateRow(r.itemId, { include: v === true })
                        }
                      />
                      Include
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Self:</span> {r.selfStem}
                  </p>
                  {r.currentObserver && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Will overwrite existing observer wording.
                    </p>
                  )}
                  <Textarea
                    value={r.text}
                    onChange={(e) =>
                      updateRow(r.itemId, { text: e.target.value })
                    }
                    rows={2}
                    disabled={!r.include}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={phase === "loading" || isSaving}
          >
            <RefreshCw className="size-4" />
            Regenerate
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                phase !== "ready" || includedValid.length === 0 || isSaving
              }
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save {includedValid.length > 0 ? includedValid.length : ""}{" "}
              {includedValid.length === 1 ? "variant" : "variants"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
