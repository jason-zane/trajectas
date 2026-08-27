// =============================================================================
// src/lib/chat/tools/compare-people.ts
//
// Side-by-side comparison of people on one common instrument.
//
// This works WITHOUT norms, and that is not a compromise. People who sat the
// same assessment were measured against the same defined standard, so "she met
// more of it than he did" is a fact about this instrument. Norms would let you
// say where either sits among people generally — a different claim, which this
// tool does not make and the card does not imply.
//
// What it refuses to do is compare across instruments. That is the failure the
// whole design exists to prevent, so a missing shared assessment is a refusal
// rather than a best effort.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import { compareMatrixFor, trajectoryForPeople } from '../destinations'
import { comparePeopleOnCommonAssessment, ChatTimelineError } from '@/lib/dal/chat-timeline'
import { searchPeople, ChatSearchError } from '@/lib/dal/chat-search'
import { getChatBandScheme } from '@/lib/dal/chat-band-scheme'

export const comparePeopleTool = defineChatTool({
  name: 'compare_people',
  description:
    'Compare two or more people side by side on a common assessment, factor by factor. Works without norms — everyone is measured against the same standard. Use for "compare X and Y", "who is stronger on…", "how do these candidates differ". Pass names or emails. The comparison is shown to the user as a card.',
  statusLabel: 'Comparing',
  params: z.object({
    people: z
      .array(z.string().min(1).max(160))
      .min(2)
      .max(8)
      .describe('Two to eight names or email addresses.'),
  }),
  async execute({ people }, { db }) {
    try {
      const resolved: Array<{ name: string; participantIds: string[] }> = []
      const unresolved: string[] = []

      for (const term of people) {
        const { people: matches } = await searchPeople(db, term)
        if (matches.length === 0) {
          unresolved.push(term)
          continue
        }
        if (matches.length > 1) {
          return toolFail(
            'ambiguous',
            `"${term}" matches more than one person. Ask which one before comparing.`,
            matches.map((m) => ({
              kind: 'participant' as const,
              id: m.participantIds[0],
              label: m.name,
              sublabel: [m.email, m.clientName].filter(Boolean).join(' · ') || null,
              href: m.href,
            })),
          )
        }
        resolved.push({ name: matches[0].name, participantIds: matches[0].participantIds })
      }

      if (unresolved.length > 0) {
        return toolFail(
          'not_found',
          `Could not find: ${unresolved.join(', ')}. Try email addresses.`,
        )
      }
      if (resolved.length < 2) {
        return toolFail('invalid_input', 'Need at least two distinct people to compare.')
      }

      const comparison = await comparePeopleOnCommonAssessment(db, resolved)
      if (!comparison) {
        return toolFail(
          'not_found',
          'These people have no assessment in common with scores visible to you. Comparing scores from different instruments would not be meaningful, so there is nothing to show.',
        )
      }
      if (comparison.sharedFactorIds.length === 0) {
        return toolFail(
          'not_found',
          'They sat the same assessment but share no scored factors, so there is nothing to line up.',
        )
      }

      const bandScheme = await getChatBandScheme(db)
      const caveats: string[] = [
        'Criterion-referenced: everyone is measured against the same standard on this instrument. This says nothing about how any of them compares with people generally.',
      ]
      if (!comparison.sameCampaign) {
        caveats.push(
          'These sittings are from different campaigns, so conditions and timing differed.',
        )
      }
      for (const person of comparison.excluded) {
        caveats.push(`${person.name} is not shown — ${person.reason}.`)
      }

      return toolOk({ comparison, bandScheme, caveats }, {
        source: 'participant_scores',
        deepLink:
          compareMatrixFor(
            comparison.people.map((p) => p.campaignParticipantIds),
            comparison.assessmentId,
          )?.href ?? null,
        caveats,
      })
    } catch (error) {
      const message =
        error instanceof ChatTimelineError || error instanceof ChatSearchError
          ? error.message
          : 'lookup failed'
      return toolFail('unavailable', `Could not build the comparison: ${message}`)
    }
  },

  toBlocks(data): ChatBlock[] {
    const { comparison } = data
    const shared = new Set(comparison.sharedFactorIds)
    const factorNames = new Map<string, string>()
    for (const person of comparison.people) {
      for (const factor of person.factors) {
        if (shared.has(factor.factorId)) factorNames.set(factor.factorId, factor.name)
      }
    }

    const idLists = comparison.people.map((p) => p.campaignParticipantIds)
    const destinations = [
      compareMatrixFor(idLists, comparison.assessmentId),
      trajectoryForPeople(idLists),
    ].filter((d): d is NonNullable<typeof d> => d !== null)

    return [
      {
        kind: 'comparison',
        v: 1,
        assessmentTitle: comparison.assessmentTitle,
        sameCampaign: comparison.sameCampaign,
        factors: [...shared].map((id) => ({
          factorId: id,
          name: factorNames.get(id) ?? 'Unnamed factor',
        })).sort((a, b) => a.name.localeCompare(b.name)),
        people: comparison.people.map((person) => ({
          name: person.name,
          campaignTitle: person.campaignTitle,
          completedAt: person.completedAt,
          scores: Object.fromEntries(
            person.factors
              .filter((f) => shared.has(f.factorId))
              .map((f) => [f.factorId, f.scaledScore]),
          ),
        })),
        bandScheme: data.bandScheme,
        caveats: data.caveats,
        destinations,
      },
    ]
  },

  /**
   * Who leads on what, computed here. The model never sees a score, so it can
   * describe the shape of the comparison without being able to misquote it.
   */
  redactForModel(data) {
    const { comparison } = data
    const shared = new Set(comparison.sharedFactorIds)
    const leaderByFactor: Record<string, string> = {}

    for (const factorId of shared) {
      let best: { name: string; score: number } | null = null
      let tied = false
      for (const person of comparison.people) {
        const factor = person.factors.find((f) => f.factorId === factorId)
        if (!factor) continue
        if (!best || factor.scaledScore > best.score) {
          best = { name: person.name, score: factor.scaledScore }
          tied = false
        } else if (factor.scaledScore === best.score) {
          tied = true
        }
      }
      const name = comparison.people
        .flatMap((p) => p.factors)
        .find((f) => f.factorId === factorId)?.name
      if (best && name) leaderByFactor[name] = tied ? 'tied' : best.name
    }

    const counts: Record<string, number> = {}
    for (const leader of Object.values(leaderByFactor)) {
      if (leader === 'tied') continue
      counts[leader] = (counts[leader] ?? 0) + 1
    }

    return {
      assessmentTitle: comparison.assessmentTitle,
      sameCampaign: comparison.sameCampaign,
      people: comparison.people.map((p) => p.name),
      sharedFactorCount: shared.size,
      leaderByFactor,
      factorsLedCount: counts,
      excluded: comparison.excluded.map((e) => e.name),
    }
  },
})
