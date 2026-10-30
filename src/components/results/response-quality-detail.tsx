'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { reviewResponseQuality } from '@/app/actions/response-quality'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { LocalTime } from '@/components/local-time'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, CircleHelp, Flag } from 'lucide-react'
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
  const flagged = result.indicators.filter(i => i.status === 'flagged').length
  const unavailable = result.indicators.filter(i => i.status === 'unavailable').length
  return <div className="space-y-5">
    <Alert variant={result.status === 'review_recommended' ? 'warning' : 'info'}>
      <AlertTitle>{QUALITY_STATUS_LABELS[result.status]}</AlertTitle>
      <AlertDescription>{flagged} of {result.indicators.length} checks flagged for review{unavailable ? ` · ${unavailable} unavailable` : ''}. These pilot checks do not establish dishonesty or change personality scores. Consider them alongside the participant’s context.</AlertDescription>
    </Alert>
    <dl className="divide-y divide-border">
      {result.indicators.map(indicator => <div key={indicator.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(13rem,1fr)_2fr] sm:gap-6">
        <dt className="flex items-start gap-3 text-sm font-medium">
          {indicator.status === 'flagged' ? <Flag className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> : indicator.status === 'unavailable' ? <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
          <span>{indicator.label}<span className="mt-1 block text-caption font-normal text-muted-foreground">{indicator.status === 'flagged' ? 'Review suggested' : indicator.status === 'unavailable' ? 'Insufficient evidence' : 'No flag'}</span></span>
        </dt>
        <dd className="text-sm leading-relaxed text-muted-foreground">{indicator.detail}</dd>
      </div>)}
    </dl>
    <details className="text-caption text-muted-foreground"><summary className="cursor-pointer py-1 font-medium">About these checks</summary><p className="mt-2 leading-relaxed">Instruction checks, unusual endorsements and idealised self-description are considered alongside response timing and repeated answers. Thresholds are provisional and require human interpretation.</p><p className="mt-2 break-words">Policy: {result.policyVersion} · Administration: {result.moduleVersion ?? 'Not administered'} · Computed <LocalTime iso={detail.computedAt} format="date-time" /></p></details>
    {reviews.length > 0 ? <div className="space-y-3 border-t border-border pt-5"><div className="flex items-center gap-2"><h3 className="text-section">Assessor reviews</h3><Badge variant="secondary">{reviews.length}</Badge></div><p className="text-caption text-muted-foreground">Latest first. Each decision is retained with the original automated evidence.</p>{reviews.map(review => <div key={review.id} className="space-y-1 border-b border-border py-3 last:border-0">
      <p className="text-sm font-medium">{QUALITY_REVIEW_LABELS[review.decision]}</p>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review.notes}</p>
      <p className="text-caption text-muted-foreground"><LocalTime iso={review.createdAt} format="date-time" /></p>
    </div>)}</div> : null}
    {detail.canReview ? <form className="space-y-3 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); void saveReview() }}>
      <h3 className="text-sm font-semibold">Record assessor review</h3>
      <div className="space-y-2"><label htmlFor="quality-review-decision" className="text-sm font-medium">Decision</label><Select value={decision} disabled={saving} onValueChange={value => { if (value) setDecision(value as QualityReviewDecision); setRequestId(null) }}>
        <SelectTrigger id="quality-review-decision" className="w-full sm:max-w-sm"><SelectValue>{QUALITY_REVIEW_LABELS[decision]}</SelectValue></SelectTrigger><SelectContent>
          {Object.entries(QUALITY_REVIEW_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent></Select></div>
      <label className="block space-y-2 text-sm font-medium"><span>Review notes</span><Textarea value={notes} disabled={saving} minLength={10} maxLength={2000} required rows={3} placeholder="Record the context considered, any follow-up and the reason for your decision." onChange={event => { setNotes(event.target.value); setRequestId(null) }} /></label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving || notes.trim().length < 10}>{saving ? 'Saving…' : 'Save review'}</Button>
    </form> : null}
  </div>
}
