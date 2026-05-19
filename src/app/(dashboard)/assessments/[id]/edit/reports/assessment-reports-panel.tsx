'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  addAssessmentTemplate,
  removeAssessmentTemplate,
  setAssessmentTemplateDefault,
  type AssessmentTemplateRow,
} from '@/app/actions/reports'
import type { ReportTemplate } from '@/types/database'

interface Props {
  assessmentId: string
  initialAttached: AssessmentTemplateRow[]
  allTemplates: ReportTemplate[]
}

export function AssessmentReportsPanel({ assessmentId, initialAttached, allTemplates }: Props) {
  const [attached, setAttached] = useState(initialAttached)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isPending, startTransition] = useTransition()

  const attachedIds = new Set(attached.map((a) => a.templateId))
  const available = allTemplates.filter((t) => !attachedIds.has(t.id) && t.isActive)

  function handleAdd() {
    if (!selectedTemplateId) return
    const tpl = allTemplates.find((t) => t.id === selectedTemplateId)
    if (!tpl) return
    startTransition(async () => {
      try {
        await addAssessmentTemplate(assessmentId, selectedTemplateId)
        setAttached((prev) => [
          ...prev,
          {
            id: selectedTemplateId,
            templateId: selectedTemplateId,
            templateName: tpl.name,
            templateDescription: tpl.description ?? null,
            isDefault: true,
            sortOrder: prev.length,
          },
        ])
        setSelectedTemplateId('')
        toast.success('Report added')
      } catch {
        toast.error('Failed to add report')
      }
    })
  }

  function handleRemove(templateId: string) {
    startTransition(async () => {
      try {
        await removeAssessmentTemplate(assessmentId, templateId)
        setAttached((prev) => prev.filter((a) => a.templateId !== templateId))
        toast.success('Report removed')
      } catch {
        toast.error('Failed to remove report')
      }
    })
  }

  function handleToggleDefault(templateId: string, nextValue: boolean) {
    setAttached((prev) =>
      prev.map((a) => (a.templateId === templateId ? { ...a, isDefault: nextValue } : a)),
    )
    startTransition(async () => {
      try {
        await setAssessmentTemplateDefault(assessmentId, templateId, nextValue)
      } catch {
        toast.error('Failed to update default')
        setAttached((prev) =>
          prev.map((a) =>
            a.templateId === templateId ? { ...a, isDefault: !nextValue } : a,
          ),
        )
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" />
        </div>
        <div>
          <p className="font-semibold text-sm">Default reports for this assessment</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reports listed here run automatically when a participant completes this assessment —
            unless the campaign explicitly attaches its own report templates, in which case those
            win.
          </p>
        </div>
      </div>

      {attached.length > 0 ? (
        <div className="space-y-2">
          {attached.map((entry) => (
            <div
              key={entry.templateId}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.templateName}</p>
                {entry.templateDescription && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {entry.templateDescription}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                  <span>Default</span>
                  <Switch
                    checked={entry.isDefault}
                    disabled={isPending}
                    onCheckedChange={(v) => handleToggleDefault(entry.templateId, v)}
                  />
                </label>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(entry.templateId)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove report"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No default reports attached. Add one below to auto-generate it whenever a participant
          completes this assessment.
        </p>
      )}

      {available.length > 0 && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select
              value={selectedTemplateId}
              onValueChange={(v) => {
                if (v) setSelectedTemplateId(v)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a report template…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={isPending || !selectedTemplateId} size="sm">
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
