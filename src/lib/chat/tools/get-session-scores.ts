// =============================================================================
// src/lib/chat/tools/get-session-scores.ts
//
// One person's results for one sitting. The values travel to the browser as a
// score_card block; the model receives identity plus ordinal facts and no
// numbers at all (see ../redaction.ts).
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import { ordinalFactsFrom } from '../redaction'
import {
  getSessionScores,
  getLatestScoredSession,
  ChatScoresError,
} from '@/lib/dal/chat-scores'
import { searchPeople, ChatSearchError } from '@/lib/dal/chat-search'
import { getChatBandScheme } from '@/lib/dal/chat-band-scheme'

export const getSessionScoresTool = defineChatTool({
  name: 'get_session_scores',
  description:
    "Get a person's competency results. Pass person_name_or_email (e.g. \"Jason Hunt\" or their email) to get their MOST RECENT result across every campaign — this is the right choice for \"show me X's latest result\". Pass participant_id for their latest result in one specific campaign, or session_id for one exact sitting. The scores are shown to the user as a card.",
  statusLabel: 'Loading results',
  params: z.object({
    person_name_or_email: z
      .string()
      .max(160)
      .optional()
      .describe(
        "A person's name or email address. Resolves their most recent result across ALL campaigns.",
      ),
    session_id: z
      .string()
      .uuid()
      .optional()
      .describe('One exact sitting.'),
    participant_id: z
      .string()
      .uuid()
      .optional()
      .describe("A participant id — their latest result within that one campaign."),
  }),
  async execute({ session_id, participant_id, person_name_or_email }, { db }) {
    if (!session_id && !participant_id && !person_name_or_email) {
      return toolFail(
        'invalid_input',
        'Provide a person_name_or_email, a participant_id, or a session_id.',
      )
    }

    let sessionId = session_id ?? null
    let skippedMoreRecent = false
    try {
      if (!sessionId && person_name_or_email) {
        // A person is not a participant row: campaign_participants holds one
        // per campaign, so "their latest result" has to span all of them.
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
              sublabel: person.email,
              href: person.href,
            })),
          )
        }
        const resolved = await getLatestScoredSession(db, people[0].participantIds)
        sessionId = resolved.sessionId
        skippedMoreRecent = resolved.skippedMoreRecent
        if (!sessionId) {
          return toolFail(
            'not_found',
            `${people[0].name} has no completed sitting with competency scores visible to you.`,
          )
        }
      }

      if (!sessionId && participant_id) {
        const resolved = await getLatestScoredSession(db, [participant_id])
        sessionId = resolved.sessionId
        skippedMoreRecent = resolved.skippedMoreRecent
        if (!sessionId) {
          return toolFail(
            'not_found',
            'That person has no completed sitting with competency scores visible to you.',
          )
        }
      }

      const scores = await getSessionScores(db, sessionId as string)
      if (!scores) {
        return toolFail(
          'not_found',
          'No such sitting is visible to you. It may belong to another client, or to a campaign whose individual results are confidential.',
        )
      }

      if (scores.factors.length === 0) {
        return toolFail(
          'not_found',
          scores.cognitiveRows > 0
            ? 'That sitting has only cognitive scores, which this view does not render.'
            : 'That sitting has no competency scores yet — it may not have been scored.',
        )
      }

      const bandScheme = await getChatBandScheme(db)
      const caveats: string[] = []
      const normReferenced = scores.factors.every((f) => f.percentile !== undefined)
      if (!normReferenced) {
        caveats.push(
          'No norm group — these are criterion-referenced scores against the band scheme, not a comparison with other people.',
        )
      }
      if (scores.factors.some((f) => f.provisional)) {
        caveats.push('Some scores are provisional.')
      }
      if (scores.droppedRows > 0) {
        caveats.push(
          `${scores.droppedRows} score row(s) could not be displayed safely and were omitted.`,
        )
      }
      if (scores.cognitiveRows > 0) {
        caveats.push(
          `${scores.cognitiveRows} cognitive score(s) are not shown here — they use a different scale.`,
        )
      }
      if (skippedMoreRecent) {
        // Say only what the query established: the later sitting had no
        // competency scores VISIBLE TO THIS CALLER. It might be cognitive-only,
        // unscored, or scored behind a policy that hides it — claiming which
        // would be a guess dressed as a fact.
        caveats.push(
          'This is the most recent sitting with competency scores available to you. A later sitting exists but has none to show.',
        )
      }

      return toolOk(
        { ...scores, bandScheme, caveats, normReferenced },
        {
          source: 'participant_scores',
          asOf: scores.session.completedAt ?? new Date().toISOString(),
          deepLink: scores.session.href,
          caveats,
        },
      )
    } catch (error) {
      const message =
        error instanceof ChatScoresError || error instanceof ChatSearchError
          ? error.message
          : 'lookup failed'
      return toolFail('unavailable', `Could not load results: ${message}`)
    }
  },

  toBlocks(data): ChatBlock[] {
    return [
      {
        kind: 'score_card',
        v: 1,
        participantName: data.session.participantName,
        assessmentTitle: data.session.assessmentTitle,
        completedAt: data.session.completedAt,
        normReferenced: data.normReferenced,
        factors: data.factors,
        bandScheme: data.bandScheme,
        caveats: data.caveats,
        href: data.session.href,
      },
    ]
  },

  /** Identity and ordinals only — not one score value. */
  redactForModel(data) {
    return {
      participantName: data.session.participantName,
      assessmentTitle: data.session.assessmentTitle,
      completedAt: data.session.completedAt,
      ...ordinalFactsFrom(data.factors),
    }
  },
})
