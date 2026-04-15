'use client'

import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { regenerateSnapshot } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'

interface RegenerateReportButtonProps {
  snapshotId: string
}

export function RegenerateReportButton({ snapshotId }: RegenerateReportButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRegenerate() {
    startTransition(async () => {
      try {
        await regenerateSnapshot(snapshotId)
        toast.success('Report regeneration started. Refresh in a few seconds to see the updated report.')
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to regenerate report')
      }
    })
  }

  return (
    <Button
      variant="outline"
      onClick={handleRegenerate}
      disabled={isPending}
    >
      <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Regenerating...' : 'Regenerate'}
    </Button>
  )
}
