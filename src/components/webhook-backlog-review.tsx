'use client'
import { useState,useTransition } from 'react'
import { toast } from 'sonner'
import type { WebhookBacklogReview } from '@/lib/dal/webhook-backlog'
import { releaseWebhookBacklogAction } from '@/app/actions/webhook-backlog'
import { usePortal } from '@/components/portal-context'
import { Button } from '@/components/ui/button'
import { Card,CardHeader,CardTitle,CardDescription,CardContent } from '@/components/ui/card'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { Alert,AlertDescription } from '@/components/ui/alert'
type SavedEvent = WebhookBacklogReview['events'][number]
const columns: ColumnDef<SavedEvent>[] = [
  { accessorKey: 'id', header: 'Event ID', cell: ({ row }) => <span className="font-mono text-caption">{row.original.id}</span> },
  { accessorKey: 'eventType', header: 'Event' },
  { accessorKey: 'createdAt', header: 'Created' },
  { accessorKey: 'attempts', header: 'Attempts used', cell: ({ row }) => <span className="tabular-nums">{row.original.attempts}</span> },
]
export function WebhookBacklogReviewPanel({clientId,initial}:{clientId:string;initial:WebhookBacklogReview}) {
  const [review,setReview]=useState(false),[released,setReleased]=useState(false),[error,setError]=useState<string|null>(null)
  const [pending,startTransition]=useTransition()
  const {features}=usePortal()
  const canRelease=initial.deliveryEnabled && features.webhookDelivery
  return <Card><CardHeader><CardTitle>Saved webhook events</CardTitle><CardDescription>Paused events stay saved after delivery is re-enabled. Review this batch before scheduling it for delivery. Requests already in flight cannot be recalled.</CardDescription></CardHeader><CardContent className="space-y-4">
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {released ? <p>Reviewed events are queued for delivery. Refresh to inspect any remaining events.</p> : <>
      <p>Exhausted attempt budgets remain stopped and are excluded from release. {initial.events.length} eligible saved events in this batch.{initial.hasMore?' More events remain for a separate review.':''}</p>
      {!canRelease && <p className="text-sm text-muted-foreground">Client webhook delivery must be enabled before saved events can be released.</p>}
      {initial.events.length === 0 && <EmptyState size="sm" title="No saved events to release" description="New eligible paused events will appear here. Exhausted events remain stopped." />}
      {review && <><DataTable columns={columns} data={initial.events} getRowId={event => event.id} pageSize={100} hideClientPagination revealOnScroll={false} />
        <p className="text-sm text-muted-foreground">Schedule exactly these {initial.events.length} events using their existing event IDs and remaining attempt budgets. Newly saved events require another review. Recorded successful deliveries are skipped; receivers must deduplicate event IDs.</p></>}
      {initial.events.length>0 && <div className="flex gap-3">{!review ? <Button variant="outline" onClick={()=>setReview(true)}>Review saved events</Button> : <><Button disabled={pending||!canRelease} onClick={()=>startTransition(async()=>{
        try {const result=await releaseWebhookBacklogAction(clientId,initial.events.map(event=>event.id));if('error'in result){setError(result.error);toast.error(result.error);return}setReleased(true);setError(null);toast.success('Reviewed events queued for delivery')}
        catch {setError('Unable to release saved webhook events.');toast.error('Unable to release saved webhook events.')}
      })}>Release reviewed batch</Button><Button variant="outline" disabled={pending} onClick={()=>setReview(false)}>Cancel</Button></> }</div>}
    </>}
  </CardContent></Card>
}
