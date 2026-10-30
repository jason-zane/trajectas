import type { ReferenceOption } from '@/lib/norms/types'
import { referenceWeightingLabel } from '@/lib/norms/types'

export function ReferenceDetails({ reference: r }: { reference: ReferenceOption }) {
  const countries: Record<string, string> = { USA: 'United States', UK: 'United Kingdom', 'New Zeala': 'New Zealand', 'South Afr': 'South Africa', Netherlan: 'Netherlands', Philippin: 'Philippines' }
  return <div className="space-y-3 text-sm">
    <dl className="grid gap-2 text-muted-foreground">
      <div><dt className="inline font-medium">Version: </dt><dd className="inline break-words">{r.version}</dd></div>
      <div><dt className="inline font-medium">Ages: </dt><dd className="inline">{r.ageBoundsInclusive.join('–')}</dd></div>
      <div><dt className="inline font-medium">Countries: </dt><dd className="inline">{r.countryLabels?.map(country => countries[country] ?? country).join(', ') ?? 'All recorded countries'}</dd></div>
      <div><dt className="inline font-medium">Weighting: </dt><dd className="inline">{referenceWeightingLabel(r.weighting)}</dd></div>
      <div><dt className="inline font-medium">Collection period: </dt><dd className="inline">{r.provenance?.collectionPeriod ?? 'Not recorded'}</dd></div>
      <div><dt className="inline font-medium">Population: </dt><dd className="inline">{r.provenance?.population ?? 'Review the source population before use'}</dd></div>
      <div><dt className="inline font-medium">Form / scoring: </dt><dd className="inline break-words">{r.formVersion} / {r.scoringVersion}</dd></div>
      <div><dt className="inline font-medium">Method: </dt><dd className="inline break-words">{r.methodVersion ?? 'See recorded methodology review'}</dd></div>
      {r.provenance?.sourceUrl?.startsWith('https://') && <div><dt className="inline font-medium">Source: </dt><dd className="inline"><a className="underline underline-offset-4" href={r.provenance.sourceUrl} target="_blank" rel="noreferrer">Publication and dataset</a></dd></div>}
      {r.provenance?.attribution && <div><dt className="inline font-medium">Attribution: </dt><dd className="inline">{r.provenance.attribution}</dd></div>}
      {r.provenance?.intendedUse && <div><dt className="inline font-medium">Intended use: </dt><dd className="inline">{r.provenance.intendedUse}</dd></div>}
      {r.provenance?.previousVersionId && <p>A refreshed version. Earlier campaigns and reports retain their original comparison.</p>}
    </dl>
    {r.instrumentId === 'ipip-neo-120-johnson-2014' && <p className="text-muted-foreground">Historical, self-selected internet responses do not verify occupation, leadership experience or English proficiency. Age-based groups are not verified manager or executive samples. Weighting does not remove source bias; effective N describes weighting, not validity.</p>}
  </div>
}
