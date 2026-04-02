'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteReportTemplate } from '@/app/actions/reports'

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteReportTemplate(templateId)
        toast.success('Template deleted')
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete template')
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Delete</span>
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete template?"
        description="This cannot be undone. Any campaigns using this template will lose their report config."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
