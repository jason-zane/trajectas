"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Info } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SourcePicker } from "@/components/source-picker"
import { createAssessmentDraft } from "@/app/actions/assessments"
import type { ContentSource } from "@/types/database"

export function AssessmentCreateForm({
  contentSources,
}: {
  contentSources: ContentSource[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [scoringLevel, setScoringLevel] = useState<"factor" | "construct">(
    "factor",
  )
  const [sourceId, setSourceId] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Title is required.")
      return
    }
    startTransition(async () => {
      const result = await createAssessmentDraft({
        title,
        description: description || undefined,
        scoringLevel,
        sourceId: sourceId || undefined,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Draft created — continue setup")
      router.push(`/assessments/${result.id}/edit/composition`)
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Assessments"
        title="New assessment"
        description="Start a draft with the essentials. You'll add factors, sections, and reports on the next screen."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>
              Required to create a draft. Everything else can be configured
              after the draft exists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Leadership Potential Assessment"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this assessment..."
                className="min-h-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scoring-level">Scoring level</Label>
              <Select
                value={scoringLevel}
                onValueChange={(v) =>
                  v !== null && setScoringLevel(v as "factor" | "construct")
                }
              >
                <SelectTrigger id="scoring-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="factor">Factor level</SelectItem>
                  <SelectItem value="construct">Construct level</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {scoringLevel === "construct"
                    ? "Scores aggregate directly from constructs into dimensions."
                    : "Standard hierarchy: items → constructs → factors → dimensions."}
                  {" "}
                  Locked after creation.
                </p>
              </div>
            </div>

            <SourcePicker
              sources={contentSources}
              value={sourceId}
              onChange={setSourceId}
              label="Source"
              helpText="Where this assessment came from. Optional."
              name="assessmentSourceIdPicker"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Link href="/assessments">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!title.trim() || isPending}
          >
            {isPending ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </form>
    </div>
  )
}
