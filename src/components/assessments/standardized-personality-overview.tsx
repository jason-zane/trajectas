import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IPIP_DOMAINS, IPIP_FACETS, IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { PERSONALITY_PROFILE_PROMPT, PERSONALITY_PROFILE_SOURCE } from '@/lib/instrument/ipip-neo-120/catalogue'
import taxonomy from '@/lib/instrument/ipip-neo-120/source/authored-taxonomy.json'
import presentation from '@/lib/instrument/ipip-neo-120/presentation.json'
import format from '@/lib/instrument/ipip-neo-120/source/response-format.json'

/** Authorized authoring view. Scientific content stays readable and immutable. */
export function StandardizedPersonalityOverview({ description }: { description?: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>About this profile</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>{description}</p>
          <p>Based on {PERSONALITY_PROFILE_SOURCE}. The original 120 statements, five response options and scoring keys are preserved.</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">120 statements</Badge>
            <Badge variant="outline">5 dimensions</Badge>
            <Badge variant="outline">30 traits</Badge>
            <Badge variant="outline">Self-report</Badge>
          </div>
          <p>Participants rate how accurately each statement describes them. There are no right or wrong answers. Free-text, cognitive and response-quality items from the shared library are separate from this complete form.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dimensions and traits</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {IPIP_DOMAINS.map(domain => (
            <details key={domain.code} className="rounded-lg border p-4">
              <summary className="cursor-pointer font-semibold">{domain.displayName}</summary>
              <p className="mt-3 text-sm text-muted-foreground">{taxonomy.domains.find(d => d.code === domain.code)?.definition}</p>
              <dl className="mt-4 space-y-4">
                {IPIP_FACETS.filter(f => f.domainCode === domain.code).map(facet => {
                  const source = taxonomy.facets.find(f => f.code === facet.code)!
                  const definitions: Record<string, string> = presentation.definitions
                  return (
                    <div key={facet.code}>
                      <dt className="text-sm font-medium">{facet.displayName}</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{definitions[facet.code] ?? source.definition}</dd>
                    </div>
                  )
                })}
              </dl>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Participant instructions and questions</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="font-medium">{PERSONALITY_PROFILE_PROMPT}</p>
          <p>Answer for yourself as you generally are, rather than how you would like to be. Read the short statements as descriptions of yourself: “Love excitement.” means “I love excitement.” The shared instructions provide that context without rewriting the original statements.</p>
          <ol className="list-decimal space-y-1 pl-5">
            {Object.values(format.config.anchors).map(anchor => <li key={anchor}>{anchor}</li>)}
          </ol>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">View all 120 statements in delivery order</summary>
            <ol aria-label="Personality statements" className="mt-4 list-decimal space-y-2 pl-6">
              {IPIP_ITEMS.map(item => <li key={item.itemId}>{item.stem}</li>)}
            </ol>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Scoring and scientific references</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>Each trait uses four items; each dimension uses 24. Responses are keyed in the original scientific direction, then displayed as scale scores from 0–100. Native totals are retained. There is no overall personality score or norm percentile.</p>
          <p>Higher Social Confidence and Stress Tolerance indicate more confidence and tolerance. Their displays reverse the original Self-Consciousness and Vulnerability scales. Emotional Reactivity still uses the six original native trait totals.</p>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">Original scale names and reference codes</summary>
            <dl className="mt-4 space-y-3">
              {[...IPIP_DOMAINS, ...IPIP_FACETS].map(scale => (
                <div key={scale.code}>
                  <dt className="font-medium">{scale.displayName} <span className="font-mono text-xs text-muted-foreground">{scale.code}</span></dt>
                  <dd className="text-muted-foreground">Original: {scale.scientificName}{'reverseDisplay' in scale && scale.reverseDisplay ? ' · Display direction reversed' : ''}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="text-muted-foreground">Source: Johnson, J. A. (2014). Measuring thirty facets of the Five Factor Model with a 120-item public domain inventory. Journal of Research in Personality, 51, 78–89.</p>
        </CardContent>
      </Card>
    </div>
  )
}
