'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { reviewResponseQuality } from '@/app/actions/response-quality'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { LocalTime } from '@/components/local-time'
import { QUALITY_STATUS_LABELS, QUALITY_REVIEW_LABELS, type QualityReviewDecision, type ResponseQualityDetail } from '@/lib/instrument/ipip-neo-120/response-quality'

export function ResponseQualityDetailPanel({ sessionId, detail }: { sessionId: string; detail: ResponseQualityDetail | null }) {
  const router = useRouter()
  const [decision, setDecision] = useState<QualityReviewDecision>('follow_up')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  async function saveReview() {
    if (!detail || saving) return
    const reviewId = requestId ?? crypto.randomUUID()
    setRequestId(reviewId); setSaving(true); setError(null)
    try {
      const result = await reviewResponseQuality({ sessionId, resultId: detail.id, reviewId, decision, notes })
      if ('error' in result) { setError(result.error); toast.error(result.error); return }
      toast.success('Response-quality review saved'); setNotes(''); setRequestId(null); router.refresh()
    } catch { setError('Unable to save the review. Please retry.'); toast.error('Unable to save the review.') }
    finally { setSaving(false) }
  }
  if (!detail) return <p className="text-sm text-muted-foreground">Not assessed. Response-quality checks have not been recorded for this attempt.</p>
  const { result, reviews } = detail
  return <div className="space-y-5">
    <Alert variant={result.status === 'review_recommended' ? 'warning' : 'info'}>
      <AlertTitle>{QUALITY_STATUS_LABELS[result.status]}</AlertTitle>
      <AlertDescription>Pilot review indicators for this completion. These checks do not establish dishonesty or change personality scores. Missing evidence is shown explicitly.</AlertDescription>
    </Alert>
    <dl className="divide-y divide-border">
      {result.indicators.map(indicator => <div key={indicator.id} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
        <dt className="text-sm font-medium">{indicator.label}<span className="block text-caption text-muted-foreground">{indicator.status === 'flagged' ? 'Review' : indicator.status === 'unavailable' ? 'Unavailable' : 'No flag'}</span></dt>
        <dd className="text-sm text-muted-foreground">{indicator.detail}</dd>
      </div>)}
    </dl>
    <p className="text-caption text-muted-foreground">Policy: {result.policyVersion} · Supplement: {result.moduleVersion ?? 'Not administered'} · Computed <LocalTime iso={detail.computedAt} format="date-time" /></p>
    {reviews.length > 0 ? <div className="space-y-3"><h3 className="text-sm font-semibold">Review history</h3>{reviews.map(review => <div key={review.id} className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{QUALITY_REVIEW_LABELS[review.decision]}</p>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review.notes}</p>
      <p className="text-caption text-muted-foreground"><LocalTime iso={review.createdAt} format="date-time" /></p>
    </div>)}</div> : null}
    {detail.canReview ? <form className="space-y-3 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); void saveReview() }}>
      <h3 className="text-sm font-semibold">Record assessor review</h3>
      <label className="block space-y-1 text-sm"><span>Decision</span><select className="block w-full rounded-md border border-input bg-background p-2" value={decision} disabled={saving} onChange={event => { setDecision(event.target.value as QualityReviewDecision); setRequestId(null) }}>
        {Object.entries(QUALITY_REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="block space-y-1 text-sm"><span>Review notes</span><Textarea value={notes} disabled={saving} minLength={10} maxLength={2000} required onChange={event => { setNotes(event.target.value); setRequestId(null) }} /></label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving || notes.trim().length < 10}>{saving ? 'Saving…' : 'Save review'}</Button>
    </form> : null}
  </div>
}
