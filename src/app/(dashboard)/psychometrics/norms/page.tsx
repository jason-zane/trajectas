import { getNormGroups } from '@/app/actions/psychometrics'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { NormReferenceTable } from '@/components/norms/norm-reference-table'
import { listNormReferences } from '@/lib/dal/norm-references'

export default async function NormsPage() {
  const [references, existingGroups] = await Promise.all([listNormReferences(undefined, true), getNormGroups()])
  return <div className="max-w-7xl space-y-6">
    <PageHeader eyebrow="Psychometrics" title="Norm groups" description="Manage assessment-specific populations, source evidence and immutable reference versions." />
    <Alert variant="info"><AlertTitle>References require explicit review</AlertTitle><AlertDescription>New source data starts in draft. Dataset reuse, form equivalence, methodology, stability and intended use must be reviewed before a version becomes available in campaigns. Sample size does not confer approval.</AlertDescription></Alert>
    <NormReferenceTable references={references} />
    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">To refresh a population, choose New version and upload its updated aggregate distribution. Review and activate the new version, then choose it for new campaigns or report editions. Existing campaigns, scores and reports retain their original version.</p>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Existing calibration groups</h2>
      <p className="max-w-prose text-sm text-muted-foreground">These groups support existing assessments and reports. Their recorded sample sizes describe the available data; approval for a new assessment requires a compatible, reviewed reference version above.</p>
      {existingGroups.length ? <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3 font-medium">Group</th><th className="p-3 font-medium">Population</th><th className="p-3 text-right font-medium">Responses</th><th className="p-3 text-right font-medium">Constructs</th></tr></thead><tbody>{existingGroups.map(g => <tr key={g.id} className="border-b border-border last:border-0"><td className="p-3 font-medium">{g.name}</td><td className="p-3 text-muted-foreground">{[g.industry,g.roleLevel,g.region].filter(Boolean).join(' · ') || g.description || 'Recorded calibration population'}</td><td className="p-3 text-right tabular-nums">{g.sampleSize.toLocaleString('en-AU')}</td><td className="p-3 text-right tabular-nums">{g.constructCount}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No existing calibration groups are recorded.</p>}
    </section>
  </div>
}
