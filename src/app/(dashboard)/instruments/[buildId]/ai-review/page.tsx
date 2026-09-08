import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLikertAuditReport } from '@/lib/instrument/likert/pipeline'
import { LikertQualitySummary } from '@/components/instruments/likert-quality-summary'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function LikertReviewPage({ params }: { params: Promise<{ buildId: string }> }) {
  await requireAdminScope()
  const { buildId } = await params
  const report = await getLikertAuditReport(createAdminClient(), buildId)
  return <div className="max-w-6xl space-y-8">
    <PageHeader title="AI item review" description="The current specification, reviewer reasoning and final scoring keys.">
      <Link className="text-sm underline" href={`/api/instruments/${buildId}/ai-review`}>Download review evidence (JSON)</Link>
    </PageHeader>
    <LikertQualitySummary report={report} />
    <div className="space-y-3">{[...report.items].sort((a, b) => Number(b.selected) - Number(a.selected)).map(item => <Card className="p-5" key={item.id}>
      <div className="mb-2 flex flex-wrap gap-2"><Badge variant={item.selected ? 'default' : 'secondary'}>{item.selected ? 'Selected' : item.quality?.pass ? 'Reserve' : item.quality ? 'Needs revision' : 'Awaiting current review'}</Badge><span className="text-sm text-muted-foreground">{item.construct} · {item.facet} · {item.reverseScored ? 'Reverse key' : 'Forward key'}</span></div>
      <p className="font-medium">{item.stem}</p>
      {item.quality?.correctedKey && <p className="mt-2 text-sm">Scoring key corrected after unanimous independent inference.</p>}
      {item.quality && <details className="mt-3 text-sm"><summary className="cursor-pointer">Reviewer reasoning and checks</summary>
        {item.quality.reasons.length > 0 && <ul className="my-3 list-disc space-y-1 pl-4">{item.quality.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
        {item.quality.reviews.map(review => <div className="mt-4 border-t pt-3" key={review.model}><p className="font-medium">{review.model}</p><p>{review.rationale}</p><p className="text-muted-foreground">Interpretation: {review.paraphrase}</p><p>Relevance {review.relevance}/4 · Clarity {review.clarity}/4 · {review.reverseScored ? 'Reverse' : 'Forward'} · Hypothetical raw responses: {review.lowTypicalHigh.join(' / ')}</p></div>)}
      </details>}
    </Card>)}</div>
  </div>
}
