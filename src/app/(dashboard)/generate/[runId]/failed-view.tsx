"use client"

import React, { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { rerunGenerationRun } from "@/app/actions/generation"
import type { GenerationRun } from "@/types/database"

export function FailedView({ run }: { run: GenerationRun }) {
  const router = useRouter()
  const [isRerunning, startRerun] = useTransition()

  function handleRerun() {
    startRerun(async () => {
      const result = await rerunGenerationRun(run.id)
      if (result.success && result.newRunId) {
        fetch("/api/generation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: result.newRunId }),
        })
        toast.success("New generation run started")
        router.push(`/generate/${result.newRunId}`)
      } else {
        toast.error(result.error ?? "Failed to start new run")
      }
    })
  }

  return (
    <Card className="max-w-2xl border-destructive/40 bg-destructive/[0.03]">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Generation failed</p>
            <p className="text-sm text-muted-foreground">
              {run.errorMessage ??
                "An unknown error occurred during the generation pipeline."}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRerun}
            disabled={isRerunning}
            className="gap-1.5"
          >
            {isRerunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Re-run with the same config
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
