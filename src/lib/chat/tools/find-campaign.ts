// =============================================================================
// src/lib/chat/tools/find-campaign.ts
//
// Resolve a campaign the user named. Tenancy comes from the campaigns SELECT
// policy on the requester's connection, not from a predicate here.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type EntityLink } from '../envelope'
import { escapeLikePattern, sanitiseOrTerm, SEARCH_LIMIT } from './search-utils'

interface CampaignRow {
  id: string
  title: string | null
  status: string | null
  kind: string | null
  opens_at: string | null
  closes_at: string | null
  clients: { id: string; name: string | null } | null
}

export const findCampaignTool = defineChatTool({
  name: 'find_campaign',
  description:
    'Find assessment campaigns by title, optionally narrowed by status. Returns campaign ids needed by progress and results tools. Call with an empty query to list the campaigns visible to the user.',
  statusLabel: 'Searching campaigns',
  params: z.object({
    query: z
      .string()
      .max(120)
      .optional()
      .describe('Part of the campaign title. Omit to list all visible campaigns.'),
    status: z
      .string()
      .max(40)
      .optional()
      .describe('Optional exact status filter, e.g. "active", "draft", "closed".'),
  }),
  async execute({ query, status }, { db }) {
    let builder = db
      .from('campaigns')
      .select('id, title, status, kind, opens_at, closes_at, clients(id, name)')
      .is('deleted_at', null)

    const term = query?.trim()
    if (term) {
      builder = builder.ilike('title', `%${escapeLikePattern(sanitiseOrTerm(term))}%`)
    }
    if (status?.trim()) {
      builder = builder.eq('status', status.trim())
    }

    const { data, error } = await builder
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT)

    if (error) {
      return toolFail('unavailable', `Campaign lookup failed: ${error.message}`)
    }

    const rows = (data ?? []) as unknown as CampaignRow[]
    if (rows.length === 0) {
      return toolFail(
        'not_found',
        term
          ? `No campaign matching "${term}" is visible to you.`
          : 'No campaigns are visible to you.',
      )
    }

    const links: EntityLink[] = rows.map((row) => ({
      kind: 'campaign' as const,
      id: row.id,
      label: row.title ?? 'Untitled campaign',
      sublabel: row.clients?.name ?? null,
      href: `/campaigns/${row.id}`,
    }))

    return toolOk(
      {
        matchCount: links.length,
        truncated: links.length === SEARCH_LIMIT,
        campaigns: rows.map((row, i) => ({
          campaignId: row.id,
          title: row.title,
          status: row.status,
          kind: row.kind,
          clientName: row.clients?.name ?? null,
          opensAt: row.opens_at,
          closesAt: row.closes_at,
          href: links[i].href,
        })),
      },
      {
        source: 'campaigns',
        deepLink: links.length === 1 ? links[0].href : null,
        caveats:
          links.length === SEARCH_LIMIT
            ? [`Only the first ${SEARCH_LIMIT} matches are shown.`]
            : [],
      },
    )
  },
})
