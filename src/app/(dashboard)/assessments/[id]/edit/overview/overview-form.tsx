"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Info, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SourcePicker } from "@/components/source-picker"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { useAutoSave } from "@/hooks/use-auto-save"
import { updateAssessmentMeta } from "@/app/actions/assessments"
import type { ContentSource, Assessment } from "@/types/database"

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const

export function OverviewForm({
  assessment,
  contentSources,
}: {
  assessment: Assessment
  contentSources: ContentSource[]
}) {
  const router = useRouter()
  const assessmentId = assessment.id
  const [status, setStatus] = useState(assessment.status)
  const [sourceId, setSourceId] = useState(assessment.sourceId ?? "")

  const titleAutoSave = useAutoSave({
    initialValue: assessment.title,
    onSave: async (val) => {
      const result = await updateAssessmentMeta(assessmentId, { title: val })
      // Page header in the shell layout is server-rendered; refresh so it
      // reflects the new title.
      if (!(result && "error" in result)) router.refresh()
      return result
    },
  })

  const descAutoSave = useAutoSave({
    initialValue: assessment.description ?? "",
    onSave: (val) => updateAssessmentMeta(assessmentId, { description: val }),
  })

  const handleStatusChange = useCallback(
    async (next: string | null) => {
      if (!next) return
      const previous = status
      const nextStatus = next as "draft" | "active" | "archived"
      setStatus(nextStatus)
      const result = await updateAssessmentMeta(assessmentId, {
        status: nextStatus,
      })
      if (result && "error" in result) {
        toast.error(result.error)
        setStatus(previous)
      } else {
        toast.success("Status updated")
        router.refresh()
      }
    },
    [assessmentId, status, router],
  )

  const handleSourceChange = useCallback(
    async (next: string) => {
      const previous = sourceId
      setSourceId(next)
      const result = await updateAssessmentMeta(assessmentId, {
        sourceId: next || null,
      })
      if (result && "error" in result) {
        toast.error(result.error)
        setSourceId(previous)
      }
    },
    [assessmentId, sourceId],
  )

  const scoringLevelLabel = assessment.scoringLevel === "construct"
    ? "Construct-level"
    : "Factor-level"

  const scoringLevelDescription = useMemo(() => {
    return assessment.scoringLevel === "construct"
      ? "Scores aggregate directly from constructs into dimensions. Factors are skipped."
      : "Standard hierarchy: items → constructs → factors → dimensions."
  }, [assessment.scoringLevel])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Identity and lifecycle. Changes save automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={titleAutoSave.value}
              onChange={titleAutoSave.handleChange}
              onBlur={titleAutoSave.handleBlur}
              placeholder="e.g. Leadership Potential Assessment"
              required
            />
            <AutoSaveIndicator
              status={titleAutoSave.status}
              onRetry={titleAutoSave.retry}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={descAutoSave.value}
              onChange={descAutoSave.handleChange}
              onBlur={descAutoSave.handleBlur}
              placeholder="Describe the purpose and scope of this assessment..."
              className="min-h-24"
            />
            <AutoSaveIndicator
              status={descAutoSave.status}
              onRetry={descAutoSave.retry}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SourcePicker
            sources={contentSources}
            value={sourceId}
            onChange={handleSourceChange}
            label="Source"
            helpText="Where this assessment came from. Independent of which client uses it."
            name="assessmentSourceIdPicker"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scoring</CardTitle>
          <CardDescription>
            How participants&apos; responses are turned into scores. Locked
            after creation to keep historical sessions comparable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">Scoring level</p>
                </div>
                <p className="text-sm text-foreground">{scoringLevelLabel}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {scoringLevelDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Scoring method: CTT (Classical Test Theory)
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Uses sum/mean scores with reliability estimates (Cronbach&apos;s alpha).
                  Simple, well-understood, and suitable for the platform&apos;s
                  current workflow. Other methods are not yet supported.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
