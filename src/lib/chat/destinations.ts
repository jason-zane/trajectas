// =============================================================================
// src/lib/chat/destinations.ts
//
// Where an answer continues.
//
// The rule this encodes: if the platform already has a surface for a question,
// chat's job is to answer briefly and then hand the user to that surface WITH
// THE STATE ALREADY LOADED — not to reimplement it, and not to dump them on an
// empty landing page to re-enter what they just said.
//
// Both destinations take a plain `ids` list of campaign_participants ids:
//   /participants/trajectory?ids=…   (page.tsx: `?id=` one, `?ids=` up to
//                                     CANVAS_MAX_PEOPLE — the canvas turns a
//                                     single trajectory into a comparison)
//   /participants/compare?ids=…      (page.tsx: falls back to `ids` when the
//                                     richer `entries` param is absent)
//
// Kept in one module so the shapes are checked in one place: a link that
// silently loses its state is worse than no link, because it looks like it
// worked.
// =============================================================================

import 'server-only'

/** src/lib/validations/canvas.ts — the canvas refuses more than this. */
export const TRAJECTORY_MAX_PEOPLE = 8

export interface ChatDestination {
  label: string
  href: string
  /** What the user will find there, so the card can say it. */
  description: string
}

function idsParam(participantIds: string[], max: number): string | null {
  const ids = Array.from(new Set(participantIds.filter(Boolean))).slice(0, max)
  return ids.length > 0 ? ids.join(',') : null
}

/**
 * The Trajectory canvas for one person, pre-loaded. Every participation id is
 * passed because the canvas plots a person across campaigns, and dropping any
 * would silently shorten their history.
 */
export function trajectoryForPerson(participantIds: string[]): ChatDestination | null {
  const ids = idsParam(participantIds, TRAJECTORY_MAX_PEOPLE)
  if (!ids) return null
  return {
    label: 'Open in Trajectory',
    href: `/participants/trajectory?ids=${ids}`,
    description: 'Their sittings over time, charted, with the competency breakdown.',
  }
}

/**
 * The Trajectory canvas for several people at once — the platform's own
 * candidates-over-time comparison.
 *
 * Takes ONE id per person (the caller decides which), so eight people fit
 * rather than one person's eight participations crowding everyone else out.
 */
export function trajectoryForPeople(
  representativeIds: string[],
): ChatDestination | null {
  const ids = idsParam(representativeIds.filter(Boolean), TRAJECTORY_MAX_PEOPLE)
  if (!ids) return null
  return {
    label: 'Compare over time',
    href: `/participants/trajectory?ids=${ids}`,
    description: 'These people charted side by side across their sittings.',
  }
}

/**
 * The comparison matrix, pre-loaded with these people.
 *
 * Pass the participation id of the SITTING being compared, not just any of the
 * person's rows: the page loads sessions attached to the exact id it is given,
 * so the wrong row opens an empty matrix.
 */
export function compareMatrixFor(
  selectedParticipantIds: string[],
  assessmentId?: string | null,
): ChatDestination | null {
  const ids = idsParam(selectedParticipantIds.filter(Boolean), TRAJECTORY_MAX_PEOPLE)
  if (!ids) return null
  const assessments = assessmentId ? `&assessments=${assessmentId}` : ''
  return {
    label: 'Open comparison matrix',
    href: `/participants/compare?ids=${ids}${assessments}`,
    description: 'Full factor-by-factor matrix, with dimension and construct levels.',
  }
}

/** A campaign's own results surface. */
export function campaignResults(campaignId: string): ChatDestination {
  return {
    label: 'Open campaign results',
    href: `/campaigns/${campaignId}/results`,
    description: 'Everyone in the campaign, with the full results view.',
  }
}

/** A campaign's participant list. */
export function campaignParticipants(campaignId: string): ChatDestination {
  return {
    label: 'Open participants',
    href: `/campaigns/${campaignId}/participants`,
    description: 'Who is in the campaign and where each person has got to.',
  }
}
