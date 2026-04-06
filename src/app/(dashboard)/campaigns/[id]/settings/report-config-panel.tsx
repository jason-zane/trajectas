'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { upsertCampaignReportConfig, type UpsertCampaignReportConfigInput } from '@/app/actions/reports'
import type { CampaignReportConfig, ReportTemplate } from '@/types/database'

interface Props {
  campaignId: string
  config: CampaignReportConfig | null
  templates: ReportTemplate[]
}

interface TemplateSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  label: string
  description: string
  selfReportTemplates: ReportTemplate[]
  templates360: ReportTemplate[]
}

const NONE = '__none__'

function TemplateSelect({
  id,
  value,
  onChange,
  label,
  description,
  selfReportTemplates,
  templates360,
}: TemplateSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? NONE)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="No report" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No report</SelectItem>
          {selfReportTemplates.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Self-report</div>
              {selfReportTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </>
          )}
          {templates360.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">360</div>
              {templates360.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ReportConfigPanel({ campaignId, config, templates }: Props) {
  const [participantId, setParticipantId] = useState(config?.participantTemplateId ?? NONE)
  const [hrManagerId, setHrManagerId] = useState(config?.hrManagerTemplateId ?? NONE)
  const [consultantId, setConsultantId] = useState(config?.consultantTemplateId ?? NONE)
  const [brandMode, setBrandMode] = useState(config?.brandMode ?? 'platform')
  const [isPending, startTransition] = useTransition()

  const selfReportTemplates = templates.filter((t) => t.reportType === 'self_report')
  const templates360 = templates.filter((t) => t.reportType === '360')

  function handleSave() {
    startTransition(async () => {
      try {
        const input: UpsertCampaignReportConfigInput = {
          participantTemplateId: participantId === NONE ? null : participantId,
          hrManagerTemplateId: hrManagerId === NONE ? null : hrManagerId,
          consultantTemplateId: consultantId === NONE ? null : consultantId,
          brandMode,
        }
        await upsertCampaignReportConfig(campaignId, input)
        toast.success('Report config saved')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save report config')
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
          <p className="font-semibold text-sm">Report Configuration</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign a report template per audience. Reports are generated automatically when a
            participant completes the campaign.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <TemplateSelect
          id="participant-template"
          value={participantId}
          onChange={setParticipantId}
          label="Participant report"
          description="Shown to the participant after release."
          selfReportTemplates={selfReportTemplates}
          templates360={templates360}
        />
        <TemplateSelect
          id="hr-manager-template"
          value={hrManagerId}
          onChange={setHrManagerId}
          label="HR manager report"
          description="Shown to org members after release."
          selfReportTemplates={selfReportTemplates}
          templates360={templates360}
        />
        <TemplateSelect
          id="consultant-template"
          value={consultantId}
          onChange={setConsultantId}
          label="Consultant report"
          description="Available in admin for preview and release."
          selfReportTemplates={selfReportTemplates}
          templates360={templates360}
        />
      </div>

      {/* Brand mode */}
      <div className="space-y-1.5">
        <Label htmlFor="brand-mode">Report brand</Label>
        <p className="text-xs text-muted-foreground">
          Controls which brand colours and logos appear on generated reports.
        </p>
        <Select value={brandMode} onValueChange={(v) => { if (v) setBrandMode(v) }}>
          <SelectTrigger id="brand-mode" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="platform">Platform — your brand colours</SelectItem>
            <SelectItem value="client">Client — client brand colours</SelectItem>
            <SelectItem value="custom" disabled>Custom — coming soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Report Config'}
        </Button>
      </div>
    </div>
  )
}
