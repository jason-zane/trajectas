// =============================================================================
// src/lib/chat/tools/get-person-timeline.ts
//
// A person's sittings over time. Answers briefly, then hands the user to the
// Trajectory canvas with their history already loaded.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import { trajectoryForPerson } from '../destinations'
import { getPersonTimeline, ChatTimelineError } from '@/lib/dal/chat-timeline'
import { searchPeople, ChatSearchError } from '@/lib/dal/chat-search'

export const getPersonTimelineTool = defineChatTool({
  name: 'get_person_timeline',
  description:
    "A person's assessment history over time: every completed sitting, and how their scores changed. Use this for \"over time\", \"history\", \"has X improved\", \"show me X's journey\". Pass a name or email. The timeline is shown to the user as a card with a link into the Trajectory view.",
  statusLabel: 'Building timeline',
  params: z.object({
    person_name_or_email: z
      .string()
      .min(1)
      .max(160)
      .describe("The person's name or email address."),
  }),
  async execute({ person_name_or_email }, { db }) {
    try {
      const { people } = await searchPeople(db, person_name_or_email)
      if (people.length === 0) {
        return toolFail(
          'not_found',
          `No one matching "${person_name_or_email}" is visible to you.`,
        )
      }
      if (people.length > 1) {
        return toolFail(
          'ambiguous',
          `More than one person matches "${person_name_or_email}". Ask which one.`,
          people.map((person) => ({
            kind: 'participant' as const,
            id: person.participantIds[0],
            label: person.name,
            sublabel: [person.email, person.clientName].filter(Boolean).join(' · ') || null,
            href: person.href,
          })),
        )
      }

      const person = people[0]
      const timeline = await getPersonTimeline(db, person.participantIds)
      const scored = timeline.sittings.filter((s) => s.factors.length > 0)

      if (timeline.sittings.length === 0) {
        return toolFail(
          'not_found',
          `${person.name} has no completed sittings visible to you.`,
        )
      }

      const caveats: string[] = []
      if (scored.length === 0) {
        caveats.push(
          'None of these sittings has competency scores to show — they may be cognitive, or not yet scored.',
        )
      }
      if (scored.length === 1) {
        caveats.push(
          'Only one scored sitting, so there is no change to report yet — this is a starting point, not a trend.',
        )
      }
      if (timeline.changes.length > 0) {
        caveats.push(
          'Change is shown only where the same factor was measured by the same assessment twice. Scores from different instruments are not comparable.',
        )
      }
      if (scored.some((s) => s.factors.some((f) => f.percentile === undefined))) {
        caveats.push(
          'Criterion-referenced scores — how much of the defined standard was met, not a ranking against other people.',
        )
      }
      if (timeline.droppedRows > 0) {
        caveats.push(`${timeline.droppedRows} score row(s) could not be displayed safely.`)
      }

      return toolOk(
        { person, timeline, caveats },
        {
          source: 'participant_sessions + participant_scores',
          deepLink: trajectoryForPerson(person.participantIds)?.href ?? person.href,
          caveats,
        },
      )
    } catch (error) {
      const message =
        error instanceof ChatTimelineError || error instanceof ChatSearchError
          ? error.message
          : 'lookup failed'
      return toolFail('unavailable', `Could not build the timeline: ${message}`)
    }
  },

  toBlocks(data): ChatBlock[] {
    const destination = trajectoryForPerson(data.person.participantIds)
    return [
      {
        kind: 'timeline',
        v: 1,
        personName: data.person.name,
        sittings: data.timeline.sittings.map((s) => ({
          sessionId: s.sessionId,
          campaignTitle: s.campaignTitle,
          assessmentTitle: s.assessmentTitle,
          completedAt: s.completedAt,
          factorCount: s.factors.length,
          compositeScore: s.compositeScore,
          compositeMethod: s.compositeMethod,
          href: s.href,
        })),
        changes: data.timeline.changes.map((c) => ({
          factorName: c.factorName,
          assessmentTitle: c.assessmentTitle,
          fromScore: c.fromScore,
          toScore: c.toScore,
          delta: c.delta,
          fromAt: c.fromAt,
          toAt: c.toAt,
        })),
        caveats: data.caveats,
        destinations: destination ? [destination] : [],
      },
    ]
  },

  /** Shape and direction only — never a score or a delta value. */
  redactForModel(data) {
    const scored = data.timeline.sittings.filter((s) => s.factors.length > 0)
    const changes = data.timeline.changes
    return {
      personName: data.person.name,
      sittingCount: data.timeline.sittings.length,
      scoredSittingCount: scored.length,
      campaigns: data.person.campaigns.map((c) => c.title).filter(Boolean),
      firstSittingAt: data.timeline.sittings[0]?.completedAt ?? null,
      latestSittingAt:
        data.timeline.sittings[data.timeline.sittings.length - 1]?.completedAt ?? null,
      hasComparableChange: changes.length > 0,
      // Names and direction, computed in code. No magnitudes.
      improvedFactors: changes.filter((c) => c.delta > 0).map((c) => c.factorName),
      declinedFactors: changes.filter((c) => c.delta < 0).map((c) => c.factorName),
      unchangedFactors: changes.filter((c) => c.delta === 0).map((c) => c.factorName),
      largestMoveFactor: changes[0]?.factorName ?? null,
    }
  },
})
