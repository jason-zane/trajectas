'use client'

// =============================================================================
// Cognitive Profile block — LR-11 / #341.
//
// The ONLY report component permitted to render a cognitive/ability score.
// Every entity it receives has already passed through
// resolveCognitiveScoreDisplay() in src/lib/reports/runner.ts — this
// component never sees a raw participant_scores row, only the narrowed
// CognitiveScoreDisplay union (src/lib/reports/cognitive-claims.ts).
//
// Render rules mirror the instrument's claims ladder
// (docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
// 05-scoring-and-interpretation.md §5.4, §3.4, §4.1):
//   - kind: 'uncalibrated' → raw count only ("N of M items correct"). No
//     percentile, no band, no verbal comparison to any group. The
//     "no comparison group yet" panel is mandatory, not optional — never
//     silently omitted in favour of showing a bare number.
//   - kind: 'calibrated' → T-score, percentile, confidence interval, and the
//     norm-group reference actually attached to the score. Every field here
//     was already validated non-null by resolveCognitiveScoreDisplay before
//     construction (mirroring the DB CHECK constraints in
//     20260813104000_cognitive_scoring.sql) — this component adds no
//     interpretation of its own, it only formats what was resolved.
//
// This file and cognitive-claims.ts are the only two files under
// src/lib/reports/** and src/components/reports/** permitted to reference
// `percentile` — see tests/architecture/cognitive-claims-ladder.test.ts.
// =============================================================================

import type { CognitiveScoreDisplay } from '@/lib/reports/cognitive-claims'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

interface CognitiveProfileEntity {
  entityId: string
  entityName: string
  display: CognitiveScoreDisplay
}

interface CognitiveProfileData {
  entities?: CognitiveProfileEntity[]
  _empty?: boolean
  reason?: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 font-mono text-[10px] font-medium tracking-[0.18em]"
      style={{ color: 'var(--report-muted-colour)' }}
    >
      {children}
    </p>
  )
}

export function CognitiveProfileBlock({
  data,
}: {
  data: Record<string, unknown>
  mode?: PresentationMode
  chartType?: ChartType
}) {
  const d = data as unknown as CognitiveProfileData
  if (d._empty || !d.entities?.length) return null

  const anyProvisional = d.entities.some((e) => e.display.provisional)

  return (
    <div className="report-entry space-y-5">
      {anyProvisional && <ProvisionalBanner />}
      {d.entities.map((entity) => (
        <CognitiveScoreRow key={entity.entityId} entity={entity} />
      ))}
    </div>
  )
}

function ProvisionalBanner() {
  return (
    <div
      className="rounded-md border px-3 py-2 text-[11.5px] font-medium leading-snug"
      style={{
        borderColor: 'var(--report-inset-border)',
        background: 'var(--report-inset-bg)',
        color: 'var(--report-heading-colour)',
      }}
    >
      Pilot — not for selection decisions. This assessment is in development.
      Its scores have not been calibrated against a comparison group and no
      validity evidence exists for them yet.
    </div>
  )
}

function CognitiveScoreRow({ entity }: { entity: CognitiveProfileEntity }) {
  const { entityName, display } = entity
  return (
    <div
      className="border-b pb-4 last:border-b-0 last:pb-0"
      style={{ borderColor: 'var(--report-divider)' }}
    >
      <SectionLabel>{entityName.toUpperCase()}</SectionLabel>
      {display.kind === 'uncalibrated' ? (
        <UncalibratedScore display={display} />
      ) : (
        <CalibratedScore display={display} />
      )}
    </div>
  )
}

function UncalibratedScore({
  display,
}: {
  display: Extract<CognitiveScoreDisplay, { kind: 'uncalibrated' }>
}) {
  return (
    <div className="space-y-2">
      <p className="text-[15px] font-semibold" style={{ color: 'var(--report-heading-colour)' }}>
        {display.rawCorrect} of {display.itemsUsed} items correct
      </p>
      <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--report-muted-colour)' }}>
        A raw count is not a comparison. This is a report of how many
        questions were answered correctly, not a rank, a percentile, or a
        score against any group of people.
      </p>
      <div
        className="rounded-md border px-3 py-2.5 text-[11.5px] leading-relaxed"
        style={{
          borderColor: 'var(--report-inset-border)',
          background: 'var(--report-inset-bg)',
          color: 'var(--report-body-colour)',
        }}
      >
        <p className="mb-1 font-semibold" style={{ color: 'var(--report-heading-colour)' }}>
          There is no comparison group for this score yet.
        </p>
        <p>
          A score only means something against a defined group of people. We
          have not yet collected one for this assessment, so we cannot tell
          you whether this result is high, low or typical — and neither can
          anyone else. This score is suitable for research and product
          evaluation only. It is not suitable for deciding between
          candidates.
        </p>
      </div>
    </div>
  )
}

function CalibratedScore({
  display,
}: {
  display: Extract<CognitiveScoreDisplay, { kind: 'calibrated' }>
}) {
  return (
    <div className="space-y-2">
      <p className="text-[15px] font-semibold" style={{ color: 'var(--report-heading-colour)' }}>
        T = {Math.round(display.tScore)} · {Math.round(display.percentile)}th percentile
      </p>
      <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--report-muted-colour)' }}>
        95% interval: {Math.round(display.confidenceIntervalLower)}–
        {Math.round(display.confidenceIntervalUpper)}. Scores within this
        range are not meaningfully different.
      </p>
      <p className="text-[11px]" style={{ color: 'var(--report-muted-colour)' }}>
        Compared against norm group {display.normGroupId} (version {display.normVersion}).
      </p>
    </div>
  )
}
