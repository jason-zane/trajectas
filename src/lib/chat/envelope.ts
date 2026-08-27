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

export interface EntityLinksBlock {
  kind: 'entity_links'
  v: 1
  title: string
  links: EntityLink[]
}

export type ChatBlock = EntityLinksBlock

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
