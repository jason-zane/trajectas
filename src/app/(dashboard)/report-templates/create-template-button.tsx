'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from '@/components/action-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSelectLabel } from '@/lib/select-display'
import { createReportTemplate } from '@/app/actions/reports'

export function CreateTemplateButton({
  basePath = '/report-templates',
}: {
  basePath?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [reportType, setReportType] = useState<'self_report' | '360'>('self_report')

  function handleCreate() {
    if (!name.trim()) return
    startTransition(async () => {
      try {
        const template = await createReportTemplate({
          name: name.trim(),
          reportType,
          displayLevel: 'factor',
        })
        toast.success('Template created')
        setOpen(false)
        router.push(`${basePath}/${template.id}/builder`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create template')
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New Template
      </Button>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        eyebrow="Reports"
        title="New report template"
        description="Set the basics. You'll drop in blocks and style in the builder next."
      >
        <ActionDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Standard individual"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-type">Report type</Label>
            <Select value={reportType} onValueChange={v => setReportType(v as typeof reportType)}>
              <SelectTrigger id="report-type">
                <SelectValue>
                  {(value: string | null) =>
                    getSelectLabel(value, [
                      { value: 'self_report', label: 'Self-report' },
                      { value: '360', label: '360' },
                    ])
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self_report">Self-report</SelectItem>
                <SelectItem value="360">360</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            <Plus className="size-4" />
            {isPending ? 'Creating…' : 'Create template'}
          </Button>
        </ActionDialogFooter>
      </ActionDialog>
    </>
  )
}
