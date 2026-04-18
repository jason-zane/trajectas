'use client'

import { useState, useTransition } from 'react'
import { Mail, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sendReportSnapshotEmail, type ReportSnapshotSendDraft } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from '@/components/action-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SendReportButtonProps {
  snapshotId: string
  draft: ReportSnapshotSendDraft
  alreadySent?: boolean
}

export function SendReportButton({
  snapshotId,
  draft,
  alreadySent = false,
}: SendReportButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(draft.body)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setBody(draft.body)
    }
    setOpen(nextOpen)
  }

  function handleSend() {
    startTransition(async () => {
      try {
        await sendReportSnapshotEmail({
          snapshotId,
          body,
        })
        toast.success(alreadySent ? 'Report email sent again' : 'Report email sent')
        setOpen(false)
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to send report email'
        )
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setBody(draft.body)
          setOpen(true)
        }}
      >
        {alreadySent ? <Mail className="size-4" /> : <Send className="size-4" />}
        {alreadySent ? 'Send again' : 'Send to participant'}
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="Share report"
        title="Send report to participant"
        description="Review the email below before sending the secure report link."
      >
        <ActionDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-email-to">To</Label>
            <Input id="report-email-to" value={draft.recipientEmail} readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-email-subject">Subject</Label>
            <Input id="report-email-subject" value={draft.subject} readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-email-body">Body</Label>
            <Textarea
              id="report-email-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
            />
            <p className="text-xs text-muted-foreground">
              A &quot;View Report&quot; button with the secure report link will be added to
              the email automatically.
            </p>
          </div>
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isPending || body.trim().length === 0}
          >
            <Send className="size-4" />
            {isPending ? 'Sending...' : 'Send email'}
          </Button>
        </ActionDialogFooter>
      </ActionDialog>
    </>
  )
}
