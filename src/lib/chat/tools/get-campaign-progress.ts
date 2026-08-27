// =============================================================================
// src/lib/chat/tools/get-campaign-progress.ts
//
// Where a campaign has got to. Counts go to the browser as a card; the model
// gets a coarse bucket, so it can frame the answer without restating a figure
// it never saw.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import { completionBucket } from '../redaction'
import { getCampaignProgress, ChatScoresError } from '@/lib/dal/chat-scores'
import { searchCampaigns, ChatSearchError } from '@/lib/dal/chat-search'

export const getCampaignProgressTool = defineChatTool({
  name: 'get_campaign_progress',
  description:
    'Get how far a campaign has got: how many people were invited, have started, and have completed. Call find_campaign first to get the campaign id. The figures are shown to the user as a card.',
  statusLabel: 'Checking campaign progress',
  params: z.object({
    campaign_id: z.string().uuid().describe('The campaign to summarise.'),
  }),
  async execute({ campaign_id }, { db }) {
    try {
      // Resolve identity through the same scoped read the search tool uses, so
      // an id the caller cannot see reads as not-found rather than as an empty
      // but apparently valid campaign.
      const matches = await searchCampaigns(db, { limit: 200 })
      const campaign = matches.find((c) => c.campaignId === campaign_id)
      if (!campaign) {
        return toolFail(
          'not_found',
          'No such campaign is visible to you.',
        )
      }

      const progress = await getCampaignProgress(db, campaign_id)
      const caveats: string[] = [
        'Counts describe participation only — they say nothing about how anyone scored.',
      ]

      return toolOk(
        { campaign, progress, caveats },
        {
          source: 'campaign_participants + participant_sessions',
          deepLink: campaign.href,
          caveats,
        },
      )
    } catch (error) {
      const message =
        error instanceof ChatScoresError || error instanceof ChatSearchError
          ? error.message
          : 'lookup failed'
      return toolFail('unavailable', `Could not load campaign progress: ${message}`)
    }
  },

  toBlocks(data): ChatBlock[] {
    return [
      {
        kind: 'campaign_summary',
        v: 1,
        campaignTitle: data.campaign.title,
        clientName: data.campaign.clientName,
        status: data.campaign.status,
        invited: data.progress.invited,
        started: data.progress.started,
        completed: data.progress.completed,
        scoredSessions: data.progress.scoredSessions,
        caveats: data.caveats,
        href: data.campaign.href,
      },
    ]
  },

  /** Identity and a coarse bucket — never the counts themselves. */
  redactForModel(data) {
    return {
      campaignTitle: data.campaign.title,
      clientName: data.campaign.clientName,
      status: data.campaign.status,
      completionState: completionBucket(data.progress.completed, data.progress.invited),
      hasAnyParticipants: data.progress.invited > 0,
      hasAnyCompleted: data.progress.completed > 0,
    }
  },
})
