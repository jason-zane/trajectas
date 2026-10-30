import type { CustomReportRenderContext } from '@/lib/reports/custom'
import type { ReferenceInterpretation } from '@/lib/norms/types'
import { referenceWeightingLabel } from '@/lib/norms/types'

export type ReferenceComparisonData = {
  schemaVersion: 'personality-reference-report-v1'
  editionNumber: number
  scales: Array<{ code: string; name: string; scientificName: string; nativeRawSum: number; scaleScore: number; referenceRank: number | null; domain: string }>
  reference: ReferenceInterpretation['reference'] | null
}
const number = (value: number) => new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format(value)
export function ReferenceComparisonReport({ data, ctx }: { data: ReferenceComparisonData; ctx: CustomReportRenderContext }) {
  return <article className="space-y-8 p-6 sm:p-10 print:space-y-0 print:p-0">
    <div className="space-y-3 border-b border-border pb-6 print:px-[20mm] print:pt-[16mm] print:pb-[8mm]">
      <p className="text-overline text-primary">Personality reference comparison · Edition {data.editionNumber}</p>
      <h1 className="text-3xl font-bold tracking-tight">{ctx.participantName}</h1>
      <p className="text-sm text-muted-foreground">{ctx.assessmentName} · {ctx.campaignName}</p>
      <p className="max-w-prose text-sm">Scale scores describe your self-reported tendencies. Higher scores describe more of a trait; they do not establish better personality or leadership effectiveness.</p>
    </div>
    <section className="space-y-2 print:px-[20mm] print:py-[8mm]">
      <h2 className="text-xl font-semibold">{data.reference ? 'Your comparison reference' : 'Scale scores only'}</h2>
      {data.reference ? <><p className="font-medium">{data.reference.name}</p><p className="text-sm text-muted-foreground">The reference rank shows your position within this named population. It is different from your scale score and is not a percentage of questions answered correctly.</p></> : <p className="text-sm text-muted-foreground">This report shows native scale scores without a norm comparison.</p>}
    </section>
    {['N','E','O','A','C'].map(domain => <section key={domain} className={`space-y-3 break-inside-avoid print:px-[20mm] print:py-[8mm] ${['E', 'A'].includes(domain) ? 'print:break-before-page' : ''}`}>
      <h2 className="text-xl font-semibold">{data.scales.find(s => s.code === domain)?.name}</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left"><th className="py-3 pr-4 font-medium">Scale</th><th className="p-3 text-right font-medium">Scale score (0–100)</th>{data.reference && <th className="py-3 pl-3 text-right font-medium">Reference rank (0–100)</th>}</tr></thead>
        <tbody>{data.scales.filter(s => s.domain === domain).map(s => <tr key={s.code} className="border-b border-border/60"><td className="py-3 pr-4"><span className={s.code.length === 1 ? 'font-semibold' : ''}>{s.name}</span></td><td className="p-3 text-right tabular-nums">{number(s.scaleScore)}</td>{data.reference && <td className="py-3 pl-3 text-right tabular-nums">{s.referenceRank === null ? '—' : number(s.referenceRank)}</td>}</tr>)}</tbody>
      </table></div>
    </section>)}
    <section className="space-y-3 text-sm break-inside-avoid print:break-before-page print:px-[20mm] print:py-[8mm]">
      <h2 className="text-xl font-semibold">How this report was prepared</h2>
      <p>All 120 responses contribute to the five dimensions and 30 traits. Native totals are retained. Social Confidence and Stress Tolerance reverse the original native facet direction for display; Emotional Reactivity uses its original native totals. There is no overall personality score.</p>
      {data.reference && <>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="font-medium">Reference</dt><dd>{data.reference.name}</dd></div>
          <div><dt className="font-medium">Age range</dt><dd>{data.reference.ageBoundsInclusive.join('–')}</dd></div>
          <div><dt className="font-medium">Weighting</dt><dd>{referenceWeightingLabel(data.reference.weighting)}</dd></div>
          <div><dt className="font-medium">Source responses / effective N</dt><dd className="tabular-nums">{data.reference.rawN.toLocaleString('en-AU')} / {Math.round(data.reference.effectiveN).toLocaleString('en-AU')}</dd></div>
          <div><dt className="font-medium">Collection period</dt><dd>{data.reference.provenance.collectionPeriod ?? 'Recorded in the reference source'}</dd></div>
          <div><dt className="font-medium">Reference version</dt><dd className="break-words">{data.reference.version}</dd></div>
        </dl>
        <p>Percentiles use the weighted empirical distribution and assign half the tied score mass. The source consists of historical, self-selected internet responses; age and country do not verify occupation, leadership experience or English proficiency. Weighting cannot remove source bias or create new information.</p>
        <p className="break-words text-caption text-muted-foreground">Method: {data.reference.methodVersion}. Reference artifact: {data.reference.artifactSha256}.</p>
      </>}
    </section>
  </article>
}
