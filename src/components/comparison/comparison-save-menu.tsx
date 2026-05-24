'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, Globe2, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from '@/components/action-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  saveComparison,
  updateSavedComparison,
} from '@/app/actions/saved-comparisons'
import type { ColumnLevel, EntryRequest } from '@/lib/comparison/types'
import type { ShareScope } from '@/lib/comparison/saved-types'

type Props = {
  entries: EntryRequest[]
  assessmentIds: string[]
  visibleLevels: ColumnLevel[]
  deltaMode: boolean
  saved: {
    id: string
    name: string
    shareScope: ShareScope
    isOwn: boolean
  } | null
  basePath: string
}

export function ComparisonSaveMenu({
  entries,
  assessmentIds,
  visibleLevels,
  deltaMode,
  saved,
  basePath,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(saved?.name ?? '')
  const [share, setShare] = useState<boolean>(saved?.shareScope === 'team')
  const [submitting, setSubmitting] = useState(false)

  function openDialog() {
    setName(saved?.name ?? '')
    setShare(saved?.shareScope === 'team')
    setOpen(true)
  }

  async function onSubmit() {
    if (entries.length === 0) {
      toast.error('Add at least one participant before saving.')
      return
    }
    setSubmitting(true)
    try {
      if (saved) {
        await updateSavedComparison(saved.id, {
          name,
          entries,
          assessmentIds,
          visibleLevels,
          deltaMode,
          shareScope: share ? 'team' : 'private',
        })
        toast.success('Comparison updated')
        setOpen(false)
        router.refresh()
      } else {
        const created = await saveComparison({
          name,
          entries,
          assessmentIds,
          visibleLevels,
          deltaMode,
          shareScope: share ? 'team' : 'private',
        })
        toast.success(share ? 'Comparison saved & shared' : 'Comparison saved')
        setOpen(false)
        router.replace(`${basePath}?saved=${created.id}`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const isExisting = !!saved
  const canEdit = !saved || saved.isOwn || saved.shareScope === 'team'

  return (
    <>
      <Button
        variant={isExisting ? 'default' : 'outline'}
        size="sm"
        onClick={openDialog}
        className={cn('h-8 gap-1.5', isExisting && 'shadow-sm')}
        disabled={!canEdit}
      >
        {isExisting ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
        {isExisting ? 'Saved' : 'Save'}
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={(o) => !submitting && setOpen(o)}
        eyebrow={isExisting ? 'Update comparison' : 'Save comparison'}
        title={isExisting ? 'Update this comparison' : 'Name this comparison'}
        description={
          isExisting
            ? 'Changes apply to anyone who can see this comparison.'
            : 'Give it a name you’ll recognise later. You can share it with your team or keep it private.'
        }
      >
        <ActionDialogBody>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="comparison-name">Name</Label>
              <Input
                id="comparison-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q2 finalist shortlist"
                autoFocus
              />
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {share ? (
                    <Globe2 className="size-3.5 text-primary" />
                  ) : (
                    <Lock className="size-3.5 text-muted-foreground" />
                  )}
                  {share ? 'Shared with your team' : 'Private to you'}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {share
                    ? 'Teammates in this workspace can see and edit this comparison.'
                    : 'Only you can see this comparison. You can share it later.'}
                </p>
              </div>
              <Switch checked={share} onCheckedChange={setShare} aria-label="Share with team" />
            </div>
          </div>
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting || name.trim().length === 0}>
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            {isExisting ? 'Update' : 'Save'}
          </Button>
        </ActionDialogFooter>
      </ActionDialog>
    </>
  )
}
