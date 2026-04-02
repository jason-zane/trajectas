"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Zap, Loader2, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ModelPickerCombobox } from "@/app/(dashboard)/settings/models/model-picker-combobox"
import { applyModelToAllPurposes } from "@/app/actions/model-config"
import type { OpenRouterModel } from "@/types/generation"

interface ApplyToAllBarProps {
  models: OpenRouterModel[]
}

export function ApplyToAllBar({ models }: ApplyToAllBarProps) {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState("")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  )
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    if (!selectedModel) return
    startTransition(async () => {
      setSaveState("saving")
      const result = await applyModelToAllPurposes(selectedModel)
      if ("error" in result) {
        toast.error(result.error)
        setSaveState("idle")
      } else {
        toast.success("Model applied to all text tasks")
        setSaveState("saved")
        router.refresh()
        setTimeout(() => setSaveState("idle"), 2000)
      }
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:shrink-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="size-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">Apply to All</p>
            <p className="text-caption text-muted-foreground">
              Set one model for every text task (excludes embeddings)
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <div className="w-full sm:w-72">
            <ModelPickerCombobox
              value={selectedModel}
              onChange={setSelectedModel}
              models={models}
              disabled={isPending}
            />
          </div>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!selectedModel || isPending || saveState === "saved"}
          >
            {isPending || saveState === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin mr-1.5" />
                Applying...
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="size-3 mr-1.5" />
                Applied
              </>
            ) : (
              "Apply to All"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
