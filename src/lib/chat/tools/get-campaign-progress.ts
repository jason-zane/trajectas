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
      // Resolved by id through the caller's own connection: an id they cannot
      // see reads as not-found because RLS returns no row, not because of any
      // check here.
      const progress = await getCampaignProgress(db, campaign_id)
      if (!progress) {
        return toolFail('not_found', 'No such campaign is visible to you.')
      }

      const caveats: string[] = [
        'Counts are people, not sittings, and describe participation only — they say nothing about how anyone scored.',
      ]
      if (progress.assessmentCount > 1) {
        caveats.push(
          `This campaign carries ${progress.assessmentCount} assessments; a person counts once regardless of how many they take.`,
        )
      }

      return toolOk(
        { progress, caveats },
        {
          source: 'campaigns_with_counts',
          deepLink: `/campaigns/${progress.campaignId}`,
          caveats,
        },
      )
    } catch (error) {
      const message = error instanceof ChatScoresError ? error.message : 'lookup failed'
      return toolFail('unavailable', `Could not load campaign progress: ${message}`)
    }
  },

  toBlocks(data): ChatBlock[] {
    return [
      {
        kind: 'campaign_summary',
        v: 1,
        campaignTitle: data.progress.title,
        clientName: null,
        status: data.progress.status,
        invited: data.progress.invited,
        started: data.progress.started,
        completed: data.progress.completed,
        scoredSessions: data.progress.completed,
        caveats: data.caveats,
        href: `/campaigns/${data.progress.campaignId}`,
      },
    ]
  },

  /** Identity and a coarse bucket — never the counts themselves. */
  redactForModel(data) {
    return {
      campaignTitle: data.progress.title,
      status: data.progress.status,
      completionState: completionBucket(
        data.progress.completed,
        data.progress.invited,
      ),
      hasAnyParticipants: data.progress.invited > 0,
      hasAnyCompleted: data.progress.completed > 0,
      carriesMultipleAssessments: data.progress.assessmentCount > 1,
    }
  },
})
