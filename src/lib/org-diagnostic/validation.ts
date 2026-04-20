/**
 * Cross-table validation rules for the Org Diagnostic feature.
 *
 * These rules cannot be enforced as DB constraints without cross-table
 * triggers (which the codebase avoids). They live here as pure functions
 * so that any server action mutating org-diagnostic rows has one canonical
 * place to call them.
 *
 * Each function returns a discriminated union:
 *   { ok: true } | { ok: false; error: string }
 *
 * Callers choose how to surface the error (form validation, server-action
 * thrown error, etc.).
 */

import type {
  OrgDiagnosticCampaignKind,
  OrgDiagnosticInstrument,
  OrgDiagnosticProfileKind,
  OrgDiagnosticRespondentType,
} from '@/types/database'

export type ValidationResult = { ok: true } | { ok: false; error: string }

const RESPONDENT_TYPE_TO_INSTRUMENT: Record<OrgDiagnosticRespondentType, OrgDiagnosticInstrument> = {
  employee: 'OPS',
  senior_leader: 'LCQ',
  hiring_manager: 'REP',
  team_member: 'REP',
}

/**
 * Baseline campaigns may only have OPS or LCQ tracks.
 * Role_rep campaigns may only have REP tracks.
 */
export function validateTrackInstrumentForCampaignKind(
  campaignKind: OrgDiagnosticCampaignKind,
  trackInstrument: OrgDiagnosticInstrument,
): ValidationResult {
  const allowed: Record<OrgDiagnosticCampaignKind, OrgDiagnosticInstrument[]> = {
    baseline: ['OPS', 'LCQ'],
    role_rep: ['REP'],
  }

  if (!allowed[campaignKind].includes(trackInstrument)) {
    return {
      ok: false,
      error: `Instrument ${trackInstrument} is not permitted on a ${campaignKind} campaign (allowed: ${allowed[campaignKind].join(', ')}).`,
    }
  }

  return { ok: true }
}

/**
 * A respondent's type implies which instrument they take. Their assigned
 * track must serve that instrument.
 */
export function validateRespondentTypeMatchesTrack(
  respondentType: OrgDiagnosticRespondentType,
  trackInstrument: OrgDiagnosticInstrument,
): ValidationResult {
  const expected = RESPONDENT_TYPE_TO_INSTRUMENT[respondentType]

  if (expected !== trackInstrument) {
    return {
      ok: false,
      error: `Respondent type ${respondentType} requires a ${expected} track (got ${trackInstrument}).`,
    }
  }

  return { ok: true }
}

/**
 * A role can only pin to a snapshot whose clientId matches the role's
 * clientId AND whose kind is 'baseline'.
 */
export function validateRolePinTarget(
  snapshot: { clientId: string; kind: OrgDiagnosticProfileKind },
  role: { clientId: string },
): ValidationResult {
  if (snapshot.clientId !== role.clientId) {
    return {
      ok: false,
      error: `Cannot pin role to a snapshot from a different client (snapshot client ${snapshot.clientId} ≠ role client ${role.clientId}).`,
    }
  }

  if (snapshot.kind !== 'baseline') {
    return {
      ok: false,
      error: `Roles may only pin to baseline snapshots (got kind=${snapshot.kind}).`,
    }
  }

  return { ok: true }
}

/**
 * A role_rep campaign must have exactly one track.
 */
export function validateRoleRepCampaignTrackCount(trackCount: number): ValidationResult {
  if (trackCount !== 1) {
    return {
      ok: false,
      error: `A role_rep campaign must have exactly one track (got ${trackCount}).`,
    }
  }
  return { ok: true }
}

export { RESPONDENT_TYPE_TO_INSTRUMENT }
