'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Bell, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  updateCampaignConsultantSettings,
  type CampaignConsultantSettings,
} from '@/app/actions/campaigns'

interface Props {
  campaignId: string
  initial: CampaignConsultantSettings
}

export function ConsultantNotificationsPanel({ campaignId, initial }: Props) {
  const [emails, setEmails] = useState<string[]>(initial.emails)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [includeSummary, setIncludeSummary] = useState(initial.includeSummary)
  const [attachPdf, setAttachPdf] = useState(initial.attachPdf)
  const [draftEmail, setDraftEmail] = useState('')
  const [isPending, startTransition] = useTransition()

  function patch(update: Partial<CampaignConsultantSettings>) {
    startTransition(async () => {
      const result = await updateCampaignConsultantSettings(campaignId, update)
      if ('error' in result) {
        toast.error(result.error)
      }
    })
  }

  function handleToggle(
    key: 'enabled' | 'includeSummary' | 'attachPdf',
    next: boolean,
  ) {
    if (key === 'enabled') setEnabled(next)
    if (key === 'includeSummary') setIncludeSummary(next)
    if (key === 'attachPdf') setAttachPdf(next)
    patch({ [key]: next })
  }

  function handleAddEmail() {
    const trimmed = draftEmail.trim().toLowerCase()
    if (!trimmed) return
    if (emails.includes(trimmed)) {
      toast.info('Already in the list')
      setDraftEmail('')
      return
    }
    const next = [...emails, trimmed]
    setEmails(next)
    setDraftEmail('')
    startTransition(async () => {
      const result = await updateCampaignConsultantSettings(campaignId, { emails: next })
      if ('error' in result) {
        toast.error(result.error)
        setEmails((prev) => prev.filter((e) => e !== trimmed))
      }
    })
  }

  function handleRemoveEmail(email: string) {
    const next = emails.filter((e) => e !== email)
    setEmails(next)
    startTransition(async () => {
      const result = await updateCampaignConsultantSettings(campaignId, { emails: next })
      if ('error' in result) {
        toast.error(result.error)
        setEmails((prev) => [...prev, email])
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="size-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">Consultant notifications</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Email a chosen list of consultants when a session in this campaign produces a
              released report. Optionally include a score summary in the body and/or attach
              the rendered PDF.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={isPending}
          onCheckedChange={(v) => handleToggle('enabled', v)}
        />
      </div>

      <div className={enabled ? 'space-y-6' : 'space-y-6 opacity-50 pointer-events-none'}>
        {/* Recipients */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Recipients</p>
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No recipients yet. Add one below.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {emails.map((email) => (
                <li
                  key={email}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="truncate">{email}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemoveEmail(email)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="consultant@example.com"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddEmail()
                }
              }}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEmail}
              disabled={isPending || !draftEmail.trim()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <ToggleRow
            label="Include score summary"
            description="Embed the composite score and per-dimension breakdown in the email body."
            checked={includeSummary}
            onCheckedChange={(v) => handleToggle('includeSummary', v)}
            disabled={isPending}
          />
          <ToggleRow
            label="Attach PDF"
            description="Attach the rendered PDF report to the email."
            checked={attachPdf}
            onCheckedChange={(v) => handleToggle('attachPdf', v)}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}
