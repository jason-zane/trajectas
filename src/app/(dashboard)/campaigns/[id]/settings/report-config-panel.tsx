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
import { addCampaignTemplate, removeCampaignTemplate } from '@/app/actions/reports'
import type { ReportTemplate } from '@/types/database'

interface AssignedTemplate {
  id: string
  templateId: string
  templateName: string
  sortOrder: number
}

interface Props {
  campaignId: string
  assignedTemplates: AssignedTemplate[]
  allTemplates: ReportTemplate[]
}

export function ReportConfigPanel({ campaignId, assignedTemplates: initial, allTemplates }: Props) {
  const [assigned, setAssigned] = useState(initial)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isPending, startTransition] = useTransition()

  const assignedIds = new Set(assigned.map((a) => a.templateId))
  const available = allTemplates.filter((t) => !assignedIds.has(t.id) && t.isActive)

  function handleAdd() {
    if (!selectedTemplateId) return
    startTransition(async () => {
      try {
        await addCampaignTemplate(campaignId, selectedTemplateId)
        const tpl = allTemplates.find((t) => t.id === selectedTemplateId)
        setAssigned((prev) => [
          ...prev,
          {
            id: selectedTemplateId,
            templateId: selectedTemplateId,
            templateName: tpl?.name ?? 'Template',
            sortOrder: prev.length,
          },
        ])
        setSelectedTemplateId('')
        toast.success('Template added')
      } catch {
        toast.error('Failed to add template')
      }
    })
  }

  function handleRemove(templateId: string) {
    startTransition(async () => {
      try {
        await removeCampaignTemplate(campaignId, templateId)
        setAssigned((prev) => prev.filter((a) => a.templateId !== templateId))
        toast.success('Template removed')
      } catch {
        toast.error('Failed to remove template')
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
          <p className="font-semibold text-sm">Report templates</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reports are generated automatically when a participant completes the campaign.
          </p>
        </div>
      </div>

      {assigned.length > 0 ? (
        <div className="space-y-2">
          {assigned.map((entry) => (
            <div
              key={entry.templateId}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <span className="text-sm font-medium">{entry.templateName}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(entry.templateId)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No report templates assigned. Add one below to auto-generate reports on completion.
        </p>
      )}

      {available.length > 0 && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select value={selectedTemplateId} onValueChange={(v) => { if (v) setSelectedTemplateId(v) }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a template…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
