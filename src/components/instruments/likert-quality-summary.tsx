import { likertAnchorOptions } from '@/lib/assess/likert-anchors'
import type { LikertAuditReport } from '@/lib/instrument/likert/contracts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Shared screen/print account of the actual AI checks and scoring contract. */
export function LikertQualitySummary({ report }: { report: LikertAuditReport }) {
  const { status, spec } = report
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">{status.ready ? 'Current form: AI review complete' : 'Current form: automatic review incomplete'}</h2>
    <p className="text-sm">{status.selected} of {status.target} final items selected. {status.reviewed} candidates reviewed; {status.passed} passed the item checks. {status.detail}</p>
    {status.blockers.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{status.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>}
    <div className="space-y-1 text-sm">
      <p><strong>Recall period:</strong> {spec.timeframe}.</p>
      <p><strong>Response categories:</strong> {likertAnchorOptions(spec.format.anchors).map(({ value, label }) => `${value} = ${label}`).join('; ')}.</p>
      <p><strong>Scoring:</strong> Higher means more of each defined construct. Forward item = response; reverse item = {spec.format.points + 1} − response. Score constructs separately; do not combine them without an explicit scoring model.</p>
      <p><strong>Review models:</strong> {report.models.reviewers.join(', ')}.</p>
      <p>Every selected item requires three complete reviews, agreement on scoring direction, majority construct and facet assignment, no major unresolved issue, an ordered hypothetical response pattern and reading grade at or below {spec.readingCeiling}. The final form also meets exact coverage, reverse-key balance and wording-diversity checks. Every within-construct pair requires two explicit judgments: {status.pairsChecked ?? 0} of {status.pairsRequired ?? 0} pairs currently verified.</p>
    </div>
    <p className="text-sm text-muted-foreground">These are engineering acceptance criteria. Separate AI calls and different model providers reduce shared-context bias; their agreement is not proof of independent expertise or respondent validity. Hypothetical responses are scoring stress probes. Reliability, factor structure, norms, criterion relationships and differential item functioning are not measured by these checks.</p>
    <h3 className="font-medium">Reliability planning scenarios by construct</h3>
    {report.targetAlphaGoal !== undefined && <p className="text-sm">Design goal: α = {report.targetAlphaGoal.toFixed(2)}. This goal is recorded for planning; it is not a measured result or a requirement that AI can verify without responses.</p>}
    <p className="text-sm text-muted-foreground">Values below are algebraic scenarios using α = k r / (1 + (k − 1) r). Each column assumes a mean inter-item correlation; none is an estimate, confidence interval or acceptance score.</p>
    <Table><TableHeader><TableRow><TableHead>Construct</TableHead><TableHead>Items (k)</TableHead><TableHead>Assume r = .10</TableHead><TableHead>Assume r = .20</TableHead><TableHead>Assume r = .30</TableHead></TableRow></TableHeader><TableBody>{spec.constructs.map(construct => {
      const k = report.items.filter(item => item.constructId === construct.id && item.selected).length
      return <TableRow key={construct.id}><TableCell>{construct.name}</TableCell><TableCell>{k}</TableCell>{[0.1, 0.2, 0.3].map(r => <TableCell key={r}>{k > 1 ? (k * r / (1 + (k - 1) * r)).toFixed(2) : '—'}</TableCell>)}</TableRow>
    })}</TableBody></Table>
    <p className="text-xs text-muted-foreground">Specification fingerprint: {report.specHash}</p>
  </section>
}
