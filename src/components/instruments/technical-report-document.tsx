import type { TechnicalReport } from '@/lib/instrument/technical-report'

/**
 * The technical report, rendered as a document.
 *
 * Shared by the on-screen view and the print/PDF route so the two cannot drift.
 * It renders the report MODEL and holds no science of its own: every threshold,
 * interval and evidence class is decided in `technical-report.ts`.
 *
 * The one rule this component enforces visually: a forecast must never be
 * presentable as an observation. Each claim renders its evidence class, and the
 * validation banner states the instrument's standing before any number appears.
 */

const STATUS_COPY: Record<
  TechnicalReport['limitations']['validationStatus'],
  { title: string; body: string; tone: string }
> = {
  designed_to_standard: {
    title: 'Designed to standard — not yet empirically validated',
    body:
      'Every figure in this report is design-time evidence: it describes how the instrument was constructed and reviewed, not how it has behaved with respondents. No response data has been collected, so no reliability or item statistic here is an observation.',
    tone: 'border-l-[color:var(--warning,#b45309)]'
  },
  piloting: {
    title: 'Piloting — provisional empirical evidence',
    body:
      'Some response data has been collected, but not enough for stable estimates. Figures marked observed are real but provisional, and should not be quoted as final psychometric properties.',
    tone: 'border-l-[color:var(--warning,#b45309)]'
  },
  calibrated: {
    title: 'Calibrated',
    body:
      'Sufficient response data has been collected for the observed figures below to be treated as stable estimates. Claims still marked forecast remain design-time evidence.',
    tone: 'border-l-[color:var(--success,#15803d)]'
  }
}

const CLASS_LABEL: Record<string, string> = {
  a_priori: 'Forecast',
  synthetic: 'Simulated',
  empirical: 'Observed'
}

function ClaimTag({ evidenceClass }: { evidenceClass: string }) {
  return (
    <span className="ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {CLASS_LABEL[evidenceClass] ?? evidenceClass}
    </span>
  )
}

function Section({
  n,
  title,
  children
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 break-inside-avoid">
      <h2 className="border-b pb-1 text-base font-semibold">
        {n}. {title}
      </h2>
      {children}
    </section>
  )
}

function Row({
  label,
  value,
  evidenceClass
}: {
  label: string
  value: React.ReactNode
  evidenceClass?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">
        {value}
        {evidenceClass ? <ClaimTag evidenceClass={evidenceClass} /> : null}
      </span>
    </div>
  )
}

/**
 * A non-finite value here means "not computed", not "zero". Printing NaN in a
 * document a customer reads is worse than printing nothing, and printing 0
 * would be an outright false claim (0% assignment accuracy reads as a
 * catastrophic result rather than as an unrun check).
 */
const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)
const pct = (v: number | null | undefined) =>
  isNum(v) ? `${(v * 100).toFixed(0)}%` : '—'
const num = (v: number | null | undefined, dp = 2) =>
  isNum(v) ? v.toFixed(dp) : '—'

export function TechnicalReportDocument({
  report
}: {
  report: TechnicalReport
}) {
  const status = STATUS_COPY[report.limitations.validationStatus]

  return (
    <article className="space-y-8">
      {/* Standing comes FIRST. A reader must know what class of evidence this
          document contains before they read a single number from it. */}
      <div className={`border-l-4 ${status.tone} bg-muted/40 p-4`}>
        <p className="text-sm font-semibold">{status.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{status.body}</p>
      </div>

      <Section n={1} title="Instrument">
        <Row label="Name" value={report.identity.instrumentName} />
        <Row label="Measure type" value={report.identity.measureType} />
        {report.identity.useContext ? (
          <Row label="Use context" value={report.identity.useContext} />
        ) : null}
        <Row
          label="Generated"
          value={new Date(report.identity.generatedAt).toISOString().slice(0, 10)}
        />
      </Section>

      <Section n={2} title="Specification">
        {report.specification.constructs.map((c) => {
          const actual = c.facetGrid.reduce((n, cell) => n + cell.actualCount, 0)
          const target = c.facetGrid.reduce((n, cell) => n + cell.targetCount, 0)
          return (
            <div key={c.constructId} className="mb-4">
              <p className="text-sm font-medium">{c.constructName}</p>
              {c.definition ? (
                <p className="mt-1 text-sm text-muted-foreground">{c.definition}</p>
              ) : null}
              {c.exclusions && c.exclusions.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Explicitly excludes: {c.exclusions.join('; ')}
                </p>
              ) : null}
              <Row
                label="Items (actual / target)"
                value={`${actual} / ${target}`}
              />
              <Row
                label="Facet × intensity cells"
                value={c.facetGrid.length}
              />
            </div>
          )
        })}
      </Section>

      <Section n={3} title="Content validity">
        <p className="text-sm text-muted-foreground">
          Independent raters assigned each item back to a construct without being
          told its intended target. Accuracy is the share returned to the intended
          construct.
        </p>
        {!isNum(report.contentValidity.overall.assignmentAccuracy.value) ? (
          <p className="text-sm text-muted-foreground">
            The blind congruence panel has not been run for this instrument, so
            there is no content-validity evidence to report yet. This is the
            strongest evidence available before collecting responses, and it
            should be run before the instrument is used.
          </p>
        ) : (
          <>
        <Row
          label="Assignment accuracy"
          value={pct(report.contentValidity.overall.assignmentAccuracy.value)}
          evidenceClass={report.contentValidity.overall.assignmentAccuracy.evidenceClass}
        />
        <Row
          label="Aiken's V (relevance)"
          value={num(report.contentValidity.overall.aikenV.value)}
          evidenceClass={report.contentValidity.overall.aikenV.evidenceClass}
        />
        <Row
          label="Fleiss' κ (rater agreement)"
          value={num(report.contentValidity.overall.fleissKappa.value)}
          evidenceClass={report.contentValidity.overall.fleissKappa.evidenceClass}
        />
          </>
        )}
      </Section>

      <Section n={4} title="Discriminant evidence">
        <p className="text-sm text-muted-foreground">
          {report.discriminantEvidence.platformCaveat}
        </p>
        {report.discriminantEvidence.pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pairwise comparison was recorded for this build.
          </p>
        ) : (
          report.discriminantEvidence.pairs.map((p, i) => (
            <Row
              key={i}
              label={`${p.construct1} ↔ ${p.construct2}`}
              value={num(p.overlap.value)}
              evidenceClass={p.overlap.evidenceClass}
            />
          ))
        )}
      </Section>

      <Section n={5} title="Fairness">
        <Row label="Items reviewed" value={report.fairness.itemsReviewed.value} />
        <Row label="Items flagged" value={report.fairness.flaggedItems.length} />
        {Object.entries(report.fairness.categories).map(([cat, info]) => (
          <Row key={cat} label={cat} value={info.count} />
        ))}
      </Section>

      <Section n={6} title="Reliability">
        <p className="text-sm text-muted-foreground">
          α is projected from the item count and facet spread using the
          Spearman–Brown relationship. It is a design-time forecast, not a
          measurement, and is shown with the interval its assumptions imply.
        </p>
        {!isNum(report.reliability.alpha.value.point) ? (
          <p className="text-sm text-muted-foreground">
            No α forecast: this instrument has too few items for the
            Spearman–Brown projection to mean anything yet.
          </p>
        ) : (
          <>
        <Row
          label="Forecast α"
          value={
            report.reliability.alpha.value.interval
              ? `${num(report.reliability.alpha.value.point)} (${num(
                  report.reliability.alpha.value.interval[0]
                )}–${num(report.reliability.alpha.value.interval[1])})`
              : num(report.reliability.alpha.value.point)
          }
          evidenceClass={report.reliability.alpha.evidenceClass}
        />
        <Row
          label="Mean inter-item r"
          value={num(report.reliability.meanInterItemR.value.point)}
          evidenceClass={report.reliability.meanInterItemR.evidenceClass}
        />
          </>
        )}
        {/* The coherence band is a judgement DERIVED from the forecast. With no
            computable forecast there is nothing to judge, and printing
            "incoherent" would assert a defect the evidence does not support. */}
        {isNum(report.reliability.alpha.value.point) ? (
          <Row label="Coherence band" value={report.reliability.coherence} />
        ) : null}
        {isNum(report.reliability.alpha.value.point) &&
        report.reliability.shrinkageNote ? (
          <p className="text-xs text-muted-foreground">
            {report.reliability.shrinkageNote}
          </p>
        ) : null}
        {report.reliability.observedAlpha ? (
          <Row
            label="Observed α"
            value={num(report.reliability.observedAlpha.value.point)}
            evidenceClass={report.reliability.observedAlpha.evidenceClass}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No observed α: this instrument has not been calibrated against real
            respondents.
          </p>
        )}
      </Section>

      <Section n={7} title="Provenance">
        <Row label="Total items" value={report.provenance.totalItems.value} />
        <Row
          label="Traceable to a blueprint cell"
          value={report.provenance.itemsAssignedToBlueprint.value}
        />
        <Row label="Orphaned" value={report.provenance.orphanedItems.value} />
      </Section>

      <Section n={8} title="Limitations">
        <ul className="space-y-2 text-sm">
          {report.limitations.claims.map((c, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4">
              <span>{c.claim}</span>
              <span className="shrink-0 text-muted-foreground">
                {CLASS_LABEL[c.evidenceClass] ?? c.evidenceClass}
                {c.sampleSizeNeeded
                  ? ` — needs n ≥ ${c.sampleSizeNeeded}${
                      c.sampleSizeProvided != null
                        ? `, have ${c.sampleSizeProvided}`
                        : ''
                    }`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Reliability with a confidence interval requires n ≥{' '}
          {report.limitations.minSampleSizeForAlpha} per scale. IRT parameters,
          differential item functioning and norms require n ≥{' '}
          {report.limitations.minSampleSizeForIrtDif}.
        </p>
      </Section>
    </article>
  )
}
