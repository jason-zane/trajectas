// =============================================================================
// src/lib/chat/tools/find-campaign.ts
//
// Resolve a campaign the user named. Query lives in the DAL; tenancy comes from
// the campaigns SELECT policy on the caller's connection.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import {
  searchCampaigns,
  ChatSearchError,
  CHAT_SEARCH_LIMIT,
} from '@/lib/dal/chat-search'

export const findCampaignTool = defineChatTool({
  name: 'find_campaign',
  description:
    'Find assessment campaigns by title, optionally narrowed by status. Returns campaign ids needed by other tools. Call with no query to list the campaigns visible to the user.',
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
  async execute({ query, status }, { db, scope }) {
    let campaigns
    try {
      campaigns = await searchCampaigns(db, scope, { term: query, status })
    } catch (error) {
      const message = error instanceof ChatSearchError ? error.message : 'lookup failed'
      return toolFail('unavailable', `Campaign lookup failed: ${message}`)
    }

    const term = query?.trim()
    if (campaigns.length === 0) {
      return toolFail(
        'not_found',
        term
          ? `No campaign matching "${term}" is visible to you.`
          : 'No campaigns are visible to you.',
      )
    }

    return toolOk(
      {
        matchCount: campaigns.length,
        truncated: campaigns.length === CHAT_SEARCH_LIMIT,
        campaigns,
      },
      {
        source: 'campaigns',
        deepLink: campaigns.length === 1 ? campaigns[0].href : null,
        caveats:
          campaigns.length === CHAT_SEARCH_LIMIT
            ? [`Only the first ${CHAT_SEARCH_LIMIT} matches are shown.`]
            : [],
      },
    )
  },
  toBlocks(data): ChatBlock[] {
    if (data.campaigns.length === 0) return []
    return [
      {
        kind: 'entity_links',
        v: 1,
        title: 'Campaigns',
        links: data.campaigns.map((row) => ({
          kind: 'campaign' as const,
          id: row.campaignId,
          label: row.title ?? 'Untitled',
          sublabel: row.clientName ?? null,
          href: row.href,
        })),
      },
    ]
  },
})
