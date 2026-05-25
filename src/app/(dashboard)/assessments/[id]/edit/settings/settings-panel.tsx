"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Info, Settings, Trash2 } from "lucide-react"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  deleteAssessment,
  restoreAssessment,
  updateAssessmentCustomisation,
} from "@/app/actions/assessments"

interface SettingsPanelProps {
  assessmentId: string
  selectedFactorCount: number
  initialMinCustomFactors: number | null
  /** Where to send the user after deleting (default: /assessments). */
  listPath?: string
}

export function SettingsPanel({
  assessmentId,
  selectedFactorCount,
  initialMinCustomFactors,
  listPath = "/assessments",
}: SettingsPanelProps) {
  const router = useRouter()

  const [enabled, setEnabled] = useState(initialMinCustomFactors != null)
  const [minValue, setMinValue] = useState<number>(initialMinCustomFactors ?? 1)
  const [saving, setSaving] = useState(false)
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
