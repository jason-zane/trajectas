// =============================================================================
// src/lib/chat/tools/find-participant.ts
//
// Resolve a person the user named ("Sarah", "s.chen@acme.com") to participant
// rows they are allowed to see. There is no client_id predicate here on
// purpose: the campaign_participants SELECT policy scopes through the parent
// campaign to auth_user_client_ids(), so a platform admin searches everyone
// and a client member searches only their own people through this same query.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type EntityLink } from '../envelope'
import { escapeLikePattern, sanitiseOrTerm, SEARCH_LIMIT } from './search-utils'

interface ParticipantRow {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  status: string | null
  campaign_id: string
  campaigns: { id: string; title: string | null } | null
}

function displayName(row: ParticipantRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return name || row.email || 'Unnamed participant'
}

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

    // Order matters: strip PostgREST `or=` delimiters first, then escape LIKE
    // wildcards, so neither layer can be steered by the search text.
    const pattern = `%${escapeLikePattern(sanitiseOrTerm(term))}%`
    const { data, error } = await db
      .from('campaign_participants')
      .select('id, email, first_name, last_name, status, campaign_id, campaigns(id, title)')
      .is('deleted_at', null)
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
      )
      .limit(SEARCH_LIMIT)

    if (error) {
      return toolFail('unavailable', `Participant lookup failed: ${error.message}`)
    }

    const rows = (data ?? []) as unknown as ParticipantRow[]
    if (rows.length === 0) {
      return toolFail(
        'not_found',
        `No participant matching "${term}" is visible to you. Try an email address, or a different spelling.`,
      )
    }

    const links: EntityLink[] = rows.map((row) => ({
      kind: 'participant' as const,
      id: row.id,
      label: displayName(row),
      sublabel: row.campaigns?.title ?? null,
      href: `/campaigns/${row.campaign_id}/participants/${row.id}`,
    }))

    return toolOk(
      {
        matchCount: links.length,
        truncated: links.length === SEARCH_LIMIT,
        participants: rows.map((row, i) => ({
          participantId: row.id,
          name: displayName(row),
          email: row.email,
          status: row.status,
          campaignId: row.campaign_id,
          campaignTitle: row.campaigns?.title ?? null,
          href: links[i].href,
        })),
      },
      {
        source: 'campaign_participants',
        deepLink: links.length === 1 ? links[0].href : null,
        caveats:
          links.length === SEARCH_LIMIT
            ? [`Only the first ${SEARCH_LIMIT} matches are shown.`]
            : [],
      },
    )
  },
})
