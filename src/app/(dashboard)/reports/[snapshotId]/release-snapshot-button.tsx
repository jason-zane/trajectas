'use client'

import { useTransition } from 'react'
import { CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { releaseSnapshot } from '@/app/actions/reports'

export function ReleaseSnapshotButton({ snapshotId }: { snapshotId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <Button
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await releaseSnapshot(snapshotId)
        toast.success('Report released')
      })}
    >
      <CheckCircle className="size-4" />
      {isPending ? 'Releasing…' : 'Release Report'}
    </Button>
  )
}
