// =============================================================================
// src/lib/chat/tools/find-participant.ts
//
// Resolve a person the user named ("Sarah", "s.chen@acme.com") to participants
// they are allowed to see. The query lives in the DAL; tenancy comes from the
// RLS policies on the caller's connection, not from a predicate here.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail } from '../envelope'
import {
  searchParticipants,
  ChatSearchError,
  CHAT_SEARCH_LIMIT,
} from '@/lib/dal/chat-search'

export const findParticipantTool = defineChatTool({
  name: 'find_participant',
  description:
    'Find people (participants) by name or email address. Returns matching participants with the campaign each belongs to. Use this first whenever the user names a person, to get the participant id needed by other tools.',
  statusLabel: 'Searching participants',
  params: z.object({
    query: z
      .string()
      .min(1)
      .max(120)
      .describe('Part of a name or email address, e.g. "Sarah" or "chen@acme.com".'),
  }),
  async execute({ query }, { db }) {
    const term = query.trim()
    if (!term) {
      return toolFail('invalid_input', 'Provide a name or email fragment to search for.')
    }

    let participants
    try {
      participants = await searchParticipants(db, term)
    } catch (error) {
      const message = error instanceof ChatSearchError ? error.message : 'lookup failed'
      return toolFail('unavailable', `Participant lookup failed: ${message}`)
    }

    if (participants.length === 0) {
      return toolFail(
        'not_found',
        `No participant matching "${term}" is visible to you. Try an email address, or a different spelling.`,
      )
    }

    return toolOk(
      {
        matchCount: participants.length,
        truncated: participants.length === CHAT_SEARCH_LIMIT,
        participants,
      },
      {
        source: 'campaign_participants',
        deepLink: participants.length === 1 ? participants[0].href : null,
        caveats:
          participants.length === CHAT_SEARCH_LIMIT
            ? [`Only the first ${CHAT_SEARCH_LIMIT} matches are shown.`]
            : [],
      },
    )
  },
})
