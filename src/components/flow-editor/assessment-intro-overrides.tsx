"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  updateCampaignIntroOverride,
  type CampaignAssessmentIntro,
} from "@/app/actions/assessment-intro"
import type { IntroOverride } from "@/types/database"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OverrideMode = "default" | "custom" | "skip"

function getMode(override: IntroOverride): OverrideMode {
  if (override === null) return "default"
  if ("suppress" in override && override.suppress) return "skip"
  return "custom"
}

function getStatusLabel(override: IntroOverride): {
  label: string
  variant: "secondary" | "outline" | "default"
} {
  if (override === null) return { label: "Using default", variant: "secondary" }
  if ("suppress" in override && override.suppress) return { label: "Skipped", variant: "outline" }
  return { label: "Custom", variant: "default" }
}

// ---------------------------------------------------------------------------
// Single assessment card
// ---------------------------------------------------------------------------

function AssessmentIntroCard({
  campaignId,
  assessment,
}: {
  campaignId: string
  assessment: CampaignAssessmentIntro
}) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<OverrideMode>(() => getMode(assessment.introOverride))
  const [heading, setHeading] = useState(() =>
    assessment.introOverride && "heading" in assessment.introOverride
      ? assessment.introOverride.heading
      : assessment.introContent?.heading ?? ""
  )
  const [body, setBody] = useState(() =>
    assessment.introOverride && "body" in assessment.introOverride
      ? assessment.introOverride.body
      : assessment.introContent?.body ?? ""
  )
  const [buttonLabel, setButtonLabel] = useState(() =>
    assessment.introOverride && "buttonLabel" in assessment.introOverride
      ? assessment.introOverride.buttonLabel
      : assessment.introContent?.buttonLabel ?? "Begin assessment"
  )
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")

  function handleSave() {
    setSaveState("saving")
    startTransition(async () => {
      let override: IntroOverride
      if (mode === "default") {
        override = null
      } else if (mode === "skip") {
        override = { suppress: true }
      } else {
        override = { heading, body, buttonLabel }
      }

      const result = await updateCampaignIntroOverride(
        campaignId,
        assessment.assessmentId,
        override
      )

      if ("error" in result) {
        toast.error(result.error)
        setSaveState("idle")
        return
      }

      toast.success(`Intro override saved for "${assessment.assessmentTitle}"`)
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    })
  }

  const status = getStatusLabel(assessment.introOverride)

  return (
    <div className="rounded-lg border border-border">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 text-sm font-semibold truncate">
          {assessment.assessmentTitle}
        </span>
        <Badge variant={status.variant}>{status.label}</Badge>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Mode selector */}
          <div className="space-y-1.5">
            <Label>Intro behaviour</Label>
            <div className="flex gap-1">
              {(
                [
                  { value: "default", label: "Use default" },
                  { value: "custom", label: "Custom" },
                  { value: "skip", label: "Skip" },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={mode === option.value ? "default" : "outline"}
                  onClick={() => setMode(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "default" && "The assessment's own intro screen will be shown."}
              {mode === "custom" && "A campaign-specific intro will replace the default."}
              {mode === "skip" && "No intro screen will be shown for this assessment."}
            </p>
          </div>

          {/* Custom fields */}
          {mode === "custom" && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label>Heading</Label>
                <Input
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="Assessment intro heading"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Body</Label>
                <RichTextEditor
                  content={body}
                  onChange={setBody}
                  placeholder="Write the intro body content..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Button Label</Label>
                <Input
                  value={buttonLabel}
                  onChange={(e) => setButtonLabel(e.target.value)}
                  placeholder="Begin assessment"
                />
              </div>
            </div>
          )}

          {/* Save */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || saveState === "saved"}
            >
              {saveState === "saving"
                ? "Saving..."
                : saveState === "saved"
                  ? "Saved"
                  : "Save Override"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface AssessmentIntroOverridesProps {
  campaignId: string
  assessments: CampaignAssessmentIntro[]
}

export function AssessmentIntroOverrides({
  campaignId,
  assessments,
}: AssessmentIntroOverridesProps) {
  return (
    <div className="mt-6 space-y-4">
      <Separator />
      <div>
        <h3 className="text-sm font-semibold">Assessment Intro Overrides</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Customise or skip the intro screen for each linked assessment in this campaign.
        </p>
      </div>
      <div className="space-y-2">
        {assessments.map((assessment) => (
          <AssessmentIntroCard
            key={assessment.assessmentId}
            campaignId={campaignId}
            assessment={assessment}
          />
        ))}
      </div>
    </div>
  )
}
