// =============================================================================
// src/lib/chat/tools/find-participant.ts
//
// Resolve a person the user named to PEOPLE, not to participation rows.
//
// campaign_participants holds one row per person per campaign, and re-invites
// add more, so a single human can hold dozens. Returning those raw answered
// "who is Jason Hunt" with a wall of near-identical entries. Grouping restores
// the unit the question was asked in, and carries the participation count so
// the breadth is still visible.
//
// Tenancy comes from the RLS policies on the caller's connection.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import { searchPeople, ChatSearchError, CHAT_SEARCH_LIMIT } from '@/lib/dal/chat-search'

export const findParticipantTool = defineChatTool({
  name: 'find_participant',
  description:
    'Find people by name or email. A full name works ("Jason Hunt"). Returns one entry per person with how many campaigns they appear in. Use this to confirm who is meant; to show their results, prefer passing the name or email straight to get_session_scores.',
  statusLabel: 'Searching people',
  params: z.object({
    query: z
      .string()
      .min(1)
      .max(160)
      .describe('A name or email address, whole or partial.'),
  }),
  async execute({ query }, { db }) {
    const term = query.trim()
    if (!term) {
      return toolFail('invalid_input', 'Provide a name or email to search for.')
    }

    let result
    try {
      result = await searchPeople(db, term)
    } catch (error) {
      const message = error instanceof ChatSearchError ? error.message : 'lookup failed'
      return toolFail('unavailable', `Person lookup failed: ${message}`)
    }

    if (result.people.length === 0) {
      return toolFail(
        'not_found',
        `No one matching "${term}" is visible to you. Try an email address, or fewer words.`,
      )
    }

    return toolOk(
      {
        matchCount: result.people.length,
        truncated: result.truncated,
        people: result.people.map((person) => ({
          name: person.name,
          email: person.email,
          participationCount: person.participationCount,
          campaigns: person.campaigns.slice(0, 5),
          // The first id is enough to chain into a campaign-specific lookup;
          // the full set is what makes a cross-campaign "latest" possible.
          participantId: person.participantIds[0],
          participantIds: person.participantIds,
          href: person.href,
        })),
      },
      {
        source: 'campaign_participants',
        deepLink: result.people.length === 1 ? result.people[0].href : null,
        caveats: result.truncated
          ? [`Only the first ${CHAT_SEARCH_LIMIT} people are shown.`]
          : [],
      },
    )
  },

  toBlocks(data): ChatBlock[] {
    if (data.people.length === 0) return []
    return [
      {
        kind: 'entity_links',
        v: 1,
        title: 'People',
        links: data.people.map((person) => ({
          kind: 'participant' as const,
          id: person.participantId,
          label: person.name,
          sublabel:
            person.participationCount > 1
              ? `${person.email ?? 'no email'} · ${person.participationCount} campaigns`
              : (person.email ?? person.campaigns[0]?.title ?? null),
          href: person.href,
        })),
      },
    ]
  },
})
