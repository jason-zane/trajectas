// =============================================================================
// src/lib/chat/envelope.ts
//
// The wire contract for grounded chat. Every tool returns a ToolEnvelope and
// every structured thing the client renders is a ChatBlock. Both shapes are
// deliberately locked: the model is prompted against the envelope and the
// browser parses the block union, so renaming a field here is a coordinated
// change across the prompt, the route and the client — not a refactor.
//
// The `v` discriminator on ChatBlock exists so a deployed client can ignore a
// block kind/version it does not understand rather than crash on it.
// =============================================================================

/** A resolved entity the assistant can point at. `href` is an in-app route. */
export interface EntityLink {
  kind: 'participant' | 'campaign' | 'assessment' | 'client' | 'session'
  id: string
  label: string
  /** Secondary line — e.g. the campaign a participant belongs to. */
  sublabel?: string | null
  href: string | null
}

/** Why a tool could not answer. Never "no rows so I guessed". */
export type ToolFailureReason =
  | 'not_found'
  | 'ambiguous'
  | 'forbidden'
  | 'unavailable'
  | 'invalid_input'

export interface ToolSuccess<T> {
  ok: true
  data: T
  /** Where the numbers came from and when — rendered as card provenance. */
  provenance: { source: string; asOf: string }
  deepLink: string | null
  /** Caveats the renderer must show (e.g. "no norm group — not comparative"). */
  caveats: string[]
}

export interface ToolFailure {
  ok: false
  reason: ToolFailureReason
  message: string
  /** Populated for `ambiguous` so the assistant can ask which one. */
  candidates?: EntityLink[]
}

export type ToolEnvelope<T> = ToolSuccess<T> | ToolFailure

export function toolOk<T>(
  data: T,
  opts: {
    source: string
    asOf?: string
    deepLink?: string | null
    caveats?: string[]
  },
): ToolSuccess<T> {
  return {
    ok: true,
    data,
    provenance: { source: opts.source, asOf: opts.asOf ?? new Date().toISOString() },
    deepLink: opts.deepLink ?? null,
    caveats: opts.caveats ?? [],
  }
}

export function toolFail(
  reason: ToolFailureReason,
  message: string,
  candidates?: EntityLink[],
): ToolFailure {
  return candidates?.length
    ? { ok: false, reason, message, candidates }
    : { ok: false, reason, message }
}

// ---------------------------------------------------------------------------
// Blocks — the structured payloads streamed to the browser
// ---------------------------------------------------------------------------

/** Where an answer continues — a real surface, with this answer's state loaded. */
export interface BlockDestination {
  label: string
  href: string
  description: string
}

export interface EntityLinksBlock {
  kind: 'entity_links'
  v: 1
  title: string
  links: EntityLink[]
}

/**
 * One factor's score, already resolved through the claims ladder. `percentile`
 * and the confidence interval appear ONLY when the underlying row had a
 * versioned norm group — otherwise the fields are absent, mirroring
 * UncalibratedCompetencyScore, so a card can never render a rank claim the
 * data does not support.
 */
export interface ScoreCardFactor {
  factorId: string
  name: string
  scaledScore: number
  provisional: boolean
  percentile?: number
  confidenceIntervalLower?: number | null
  confidenceIntervalUpper?: number | null
  normVersion?: string
}

export interface ScoreCardBlock {
  kind: 'score_card'
  v: 1
  participantName: string
  assessmentTitle: string | null
  completedAt: string | null
  /** True only when every factor carries a versioned norm group. */
  normReferenced: boolean
  factors: ScoreCardFactor[]
  /** The band scheme these scores are being read against. */
  bandScheme: {
    palette: string
    bands: Array<{ key: string; label: string; min: number; max: number }>
  }
  caveats: string[]
  href: string | null
  destinations?: BlockDestination[]
}

export interface CampaignSummaryBlock {
  kind: 'campaign_summary'
  v: 1
  campaignTitle: string | null
  clientName: string | null
  status: string | null
  invited: number
  started: number
  completed: number
  scoredSessions: number
  caveats: string[]
  href: string | null
  destinations?: BlockDestination[]
}

/** Where an answer continues — a real surface, with this answer's state loaded. */
export interface TimelineSittingView {
  sessionId: string
  campaignTitle: string | null
  assessmentTitle: string | null
  completedAt: string | null
  factorCount: number
  compositeScore: number | null
  compositeMethod: string | null
  href: string | null
}

export interface TimelineChangeView {
  factorName: string
  assessmentTitle: string | null
  fromScore: number
  toScore: number
  delta: number
  fromAt: string | null
  toAt: string | null
}

export interface TimelineBlock {
  kind: 'timeline'
  v: 1
  personName: string
  sittings: TimelineSittingView[]
  /** Only ever within one instrument. */
  changes: TimelineChangeView[]
  caveats: string[]
  destinations: BlockDestination[]
}

export interface ComparisonCell {
  score: number
  /** Carried through so a leader marker is never shown as settled when it isn't. */
  provisional: boolean
}

export interface ComparisonPersonView {
  name: string
  campaignTitle: string | null
  completedAt: string | null
  /** Keyed by factorId, for the shared factors only. */
  cells: Record<string, ComparisonCell>
}

export interface ComparisonBlock {
  kind: 'comparison'
  v: 1
  assessmentTitle: string | null
  sameCampaign: boolean
  factors: Array<{ factorId: string; name: string }>
  people: ComparisonPersonView[]
  bandScheme: {
    palette: string
    bands: Array<{ key: string; label: string; min: number; max: number }>
  }
  caveats: string[]
  destinations: BlockDestination[]
}

export type ChatBlock =
  | EntityLinksBlock
  | ScoreCardBlock
  | CampaignSummaryBlock
  | TimelineBlock
  | ComparisonBlock

// ---------------------------------------------------------------------------
// Stream frames — one JSON object per line (ndjson)
// ---------------------------------------------------------------------------

export type ChatFrame =
  | { type: 'status'; label: string }
  | { type: 'text'; delta: string }
  | { type: 'block'; block: ChatBlock }
  | { type: 'error'; message: string }

export function encodeFrame(frame: ChatFrame): string {
  return `${JSON.stringify(frame)}\n`
}
