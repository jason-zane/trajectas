'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cloneReportTemplate } from '@/app/actions/reports'

export function CloneTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const cloned = await cloneReportTemplate(templateId)
            toast.success('Template cloned')
            router.push(`/settings/reports/${cloned.id}/builder`)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to clone template')
          }
        })
      }
    >
      <Copy className="size-3.5" />
      <span className="sr-only">Clone</span>
    </Button>
  )
}
