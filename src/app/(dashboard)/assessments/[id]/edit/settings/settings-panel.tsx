"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Calculator, Info, Settings, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  deleteAssessment,
  restoreAssessment,
  updateAssessmentCustomisation,
  updateAssessmentScoringProfile,
} from "@/app/actions/assessments"
import type { ScoringProfile } from "@/types/database"

/**
 * What each scorer does, in the words of someone choosing between them.
 *
 * `ability_irt` is offered but described honestly: it falls back to
 * dichotomous scoring until calibrated item parameters exist, so choosing it
 * today behaves identically to `ability_dichotomous` and only starts to differ
 * once a bank has been calibrated.
 */
const SCORING_PROFILES: Array<{
  value: ScoringProfile
  label: string
  hint: string
}> = [
  {
    value: "pomp_factor",
    label: "Self-report (percentage of maximum)",
    hint: "Scores the option values a respondent picked. The default, and correct for every Likert assessment.",
  },
  {
    value: "ability_dichotomous",
    label: "Ability — right/wrong",
    hint: "Scores answers against the answer key and counts the correct ones. Required for a keyed test; anything else scores option positions as if they were ratings.",
  },
  {
    value: "ability_irt",
    label: "Ability — IRT (falls back until calibrated)",
    hint: "Behaves exactly like right/wrong until calibrated item parameters exist for the bank.",
  },
]

interface SettingsPanelProps {
  assessmentId: string
  selectedFactorCount: number
  initialMinCustomFactors: number | null
  initialScoringProfile: ScoringProfile
  /** Where to send the user after deleting (default: /assessments). */
  listPath?: string
}

export function SettingsPanel({
  assessmentId,
  selectedFactorCount,
  initialMinCustomFactors,
  initialScoringProfile,
  listPath = "/assessments",
}: SettingsPanelProps) {
  const router = useRouter()

  const [enabled, setEnabled] = useState(initialMinCustomFactors != null)
  const [minValue, setMinValue] = useState<number>(initialMinCustomFactors ?? 1)
  const [saving, setSaving] = useState(false)
  const [scoringProfile, setScoringProfile] =
    useState<ScoringProfile>(initialScoringProfile)
  const [savingProfile, setSavingProfile] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function persist(value: number | null) {
    setSaving(true)
    const result = await updateAssessmentCustomisation(assessmentId, value)
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return false
    }
    return true
  }

  async function handleToggle(next: boolean) {
    setEnabled(next)
    const initial = Math.max(1, Math.floor(selectedFactorCount / 2) || 1)
    const valueToSave = next ? initial : null
    if (next) setMinValue(initial)
    const ok = await persist(valueToSave)
    if (!ok) {
      setEnabled(!next)
    } else {
      toast.success(
        next ? "Factor customisation enabled" : "Factor customisation disabled",
      )
    }
  }

  async function handleMinBlur() {
    if (!enabled) return
    const ok = await persist(minValue)
    if (ok) toast.success("Minimum factors updated")
  }

  async function handleScoringProfile(next: ScoringProfile) {
    const previous = scoringProfile
    setScoringProfile(next)
    setSavingProfile(true)
    const result = await updateAssessmentScoringProfile(assessmentId, next)
    setSavingProfile(false)
    if ("error" in result) {
      // The action refuses once a respondent has answered, because changing the
      // scorer would silently re-interpret data already collected. There is no
      // client-side signal for that, so the revert happens here.
      setScoringProfile(previous)
      toast.error(result.error)
      return
    }
    toast.success(
      `Scoring set to ${SCORING_PROFILES.find((p) => p.value === next)?.label ?? next}`,
    )
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    setShowDeleteDialog(false)
    const result = await deleteAssessment(assessmentId)
    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to delete",
      )
      setDeleting(false)
      return
    }

    let undone = false
    const timer = setTimeout(() => {
      if (!undone) router.push(listPath)
    }, 5000)

    toast.success("Assessment deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true
          clearTimeout(timer)
          await restoreAssessment(assessmentId)
          toast.success("Assessment restored")
          setDeleting(false)
        },
      },
      duration: 5000,
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-muted-foreground" />
            <CardTitle>Partner customisation</CardTitle>
          </div>
          <CardDescription>
            Control whether the campaign administrators who use this assessment
            can pick a subset of factors instead of all of them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="customisation-toggle" className="text-sm font-medium">
                Allow partners to customise factors
              </Label>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "Partners can select a subset of factors for each campaign."
                  : "Partners must use all factors in this assessment."}
              </p>
            </div>
            <Switch
              id="customisation-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>

          {enabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="min-entities">Minimum factors</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="min-entities"
                    type="number"
                    min={1}
                    max={selectedFactorCount || 1}
                    value={minValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!Number.isNaN(val)) setMinValue(val)
                    }}
                    onBlur={handleMinBlur}
                    className="w-24"
                    disabled={saving}
                  />
                  <span className="text-sm text-muted-foreground">
                    of {selectedFactorCount} factor
                    {selectedFactorCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Partners must select at least this many factors when
                    customising the assessment for a campaign. Set to the total
                    factor count to prevent any removal.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="size-5 text-muted-foreground" />
            <CardTitle>Scoring</CardTitle>
          </div>
          <CardDescription>
            Which scorer a completed session is sent to. This is the difference
            between an assessment that reports how someone rated themselves and
            one that reports how many answers they got right.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scoring-profile">Scoring method</Label>
            <Select
              value={scoringProfile}
              onValueChange={(value) =>
                handleScoringProfile((value ?? scoringProfile) as ScoringProfile)
              }
              disabled={savingProfile}
            >
              <SelectTrigger id="scoring-profile" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORING_PROFILES.map((profile) => (
                  <SelectItem key={profile.value} value={profile.value}>
                    {profile.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
              <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {SCORING_PROFILES.find((p) => p.value === scoringProfile)?.hint}
              </p>
            </div>
            <p className="text-caption">
              Locked once a respondent has answered — changing the scorer after
              that would re-interpret data already collected.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            <CardTitle>Danger zone</CardTitle>
          </div>
          <CardDescription>
            Archived assessments can be restored. Sessions that have already
            been collected against this assessment are preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
            Delete assessment
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete assessment?"
        description="This will archive the assessment. You can undo for a few seconds after confirming."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
