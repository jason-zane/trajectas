"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { RichTextEditor } from "@/components/rich-text-editor"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { useAutoSave, type AutoSaveStatus } from "@/hooks/use-auto-save"
import {
  toggleAssessmentIntro,
  updateAssessmentIntro,
} from "@/app/actions/assessment-intro"
import type { AssessmentIntroContent } from "@/types/database"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssessmentIntroEditorProps {
  assessmentId: string
  assessmentTitle: string
  initialContent: AssessmentIntroContent | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssessmentIntroEditor({
  assessmentId,
  assessmentTitle,
  initialContent,
}: AssessmentIntroEditorProps) {
  const [enabled, setEnabled] = useState(initialContent?.enabled ?? false)
  const [toggling, setToggling] = useState(false)

  // Derive initial values, falling back to sensible defaults
  const initialHeading = initialContent?.heading || assessmentTitle
  const initialBody = initialContent?.body ?? ""
  const initialButtonLabel = initialContent?.buttonLabel || "Begin Assessment"

  // -------------------------------------------------------------------------
  // Auto-save: heading
  // -------------------------------------------------------------------------

  const buildContent = useCallback(
    (patch: Partial<AssessmentIntroContent>): AssessmentIntroContent => ({
      enabled,
      heading: heading.current,
      body: body.current,
      buttonLabel: buttonLabel.current,
      ...patch,
    }),
    // We read refs inside, so only `enabled` is a true dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  )

  // Refs to always hold the latest value for building the full content object
  const heading = useRef(initialHeading)
  const body = useRef(initialBody)
  const buttonLabel = useRef(initialButtonLabel)

  const headingAutoSave = useAutoSave({
    initialValue: initialHeading,
    enabled,
    onSave: async (val) => {
      heading.current = val
      return updateAssessmentIntro(assessmentId, buildContent({ heading: val }))
    },
  })

  const buttonLabelAutoSave = useAutoSave({
    initialValue: initialButtonLabel,
    enabled,
    onSave: async (val) => {
      buttonLabel.current = val
      return updateAssessmentIntro(
        assessmentId,
        buildContent({ buttonLabel: val })
      )
    },
  })

  // -------------------------------------------------------------------------
  // Auto-save: body (rich text — needs custom debounce since Tiptap gives
  // us a string via onChange, not a native input event)
  // -------------------------------------------------------------------------

  const [bodyStatus, setBodyStatus] = useState<AutoSaveStatus>("idle")
  const bodyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const bodyFadeRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const lastSavedBody = useRef(initialBody)

  const saveBody = useCallback(
    async (html: string) => {
      if (!enabled || html === lastSavedBody.current) return
      setBodyStatus("saving")
      try {
        const result = await updateAssessmentIntro(
          assessmentId,
          buildContent({ body: html })
        )
        if (result && "error" in result && result.error) {
          setBodyStatus("error")
        } else {
          lastSavedBody.current = html
          setBodyStatus("saved")
          clearTimeout(bodyFadeRef.current)
          bodyFadeRef.current = setTimeout(() => setBodyStatus("idle"), 3000)
        }
      } catch {
        setBodyStatus("error")
      }
    },
    [assessmentId, buildContent, enabled]
  )

  const handleBodyChange = useCallback(
    (html: string) => {
      body.current = html
      if (!enabled) return
      clearTimeout(bodyTimerRef.current)
      bodyTimerRef.current = setTimeout(() => saveBody(html), 3000)
    },
    [enabled, saveBody]
  )

  // Cleanup body timers
  useEffect(() => {
    return () => {
      clearTimeout(bodyTimerRef.current)
      clearTimeout(bodyFadeRef.current)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Toggle handler (Zone 1 — immediate)
  // -------------------------------------------------------------------------

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setToggling(true)
      setEnabled(checked)
      const result = await toggleAssessmentIntro(assessmentId, checked)
      setToggling(false)
      if ("error" in result) {
        setEnabled(!checked) // revert
        toast.error(result.error)
      } else {
        toast.success(
          checked ? "Intro page enabled" : "Intro page disabled"
        )
      }
    },
    [assessmentId]
  )

  // Keep heading ref in sync with auto-save value
  useEffect(() => {
    heading.current = headingAutoSave.value
  }, [headingAutoSave.value])

  useEffect(() => {
    buttonLabel.current = buttonLabelAutoSave.value
  }, [buttonLabelAutoSave.value])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-foreground">
              Show intro page
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Display an intro screen before the assessment begins
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </CardContent>
      </Card>

      {/* Editor fields — only shown when enabled */}
      {enabled && (
        <Card>
          <CardContent className="space-y-6 py-6">
            {/* Heading */}
            <div className="space-y-2">
              <Label htmlFor="intro-heading">Heading</Label>
              <Input
                id="intro-heading"
                value={headingAutoSave.value}
                onChange={headingAutoSave.handleChange}
                onBlur={headingAutoSave.handleBlur}
                placeholder="Welcome to the assessment"
              />
              <AutoSaveIndicator
                status={headingAutoSave.status}
                onRetry={headingAutoSave.retry}
              />
            </div>

            {/* Rich text body */}
            <div className="space-y-2">
              <Label>Body</Label>
              <RichTextEditor
                content={initialBody}
                onChange={handleBodyChange}
                placeholder="Introduce the assessment to participants..."
              />
              <AutoSaveIndicator
                status={bodyStatus}
                onRetry={() => saveBody(body.current)}
              />
              {/* Template variable hints */}
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Template variables
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-foreground font-mono">
                    {"{{assessmentTitle}}"}
                  </span>
                  <span className="text-foreground font-mono">
                    {"{{questionCount}}"}
                  </span>
                  <span className="text-muted-foreground/60 font-mono">
                    {"{{estimatedMinutes}}"}{" "}
                    <span className="font-sans italic">Coming soon</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Button label */}
            <div className="space-y-2">
              <Label htmlFor="intro-button-label">Button label</Label>
              <Input
                id="intro-button-label"
                value={buttonLabelAutoSave.value}
                onChange={buttonLabelAutoSave.handleChange}
                onBlur={buttonLabelAutoSave.handleBlur}
                placeholder="Begin Assessment"
              />
              <AutoSaveIndicator
                status={buttonLabelAutoSave.status}
                onRetry={buttonLabelAutoSave.retry}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
