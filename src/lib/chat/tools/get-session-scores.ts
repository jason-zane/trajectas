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
  getLatestSessionForParticipant,
  ChatScoresError,
} from '@/lib/dal/chat-scores'
import { getChatBandScheme } from '@/lib/dal/chat-band-scheme'

export const getSessionScoresTool = defineChatTool({
  name: 'get_session_scores',
  description:
    "Get a person's competency results for one assessment sitting. Pass a session_id, or a participant_id to use their most recent completed sitting. Call find_participant first to get the participant id. The scores are shown to the user as a card.",
  statusLabel: 'Loading results',
  params: z.object({
    session_id: z
      .string()
      .uuid()
      .optional()
      .describe('The specific sitting to load.'),
    participant_id: z
      .string()
      .uuid()
      .optional()
      .describe("A participant id, to load their most recent completed sitting."),
  }),
  async execute({ session_id, participant_id }, { db }) {
    if (!session_id && !participant_id) {
      return toolFail(
        'invalid_input',
        'Provide either a session_id or a participant_id.',
      )
    }

    let sessionId = session_id ?? null
    try {
      if (!sessionId && participant_id) {
        sessionId = await getLatestSessionForParticipant(db, participant_id)
        if (!sessionId) {
          return toolFail(
            'not_found',
            'That person has no assessment sitting visible to you yet.',
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
      const message = error instanceof ChatScoresError ? error.message : 'lookup failed'
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
