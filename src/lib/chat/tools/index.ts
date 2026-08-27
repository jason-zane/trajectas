import 'server-only'

import { buildRegistry, type ChatTool } from '../registry'
import { findParticipantTool } from './find-participant'
import { findCampaignTool } from './find-campaign'
import { findAssessmentTool } from './find-assessment'
import { getSessionScoresTool } from './get-session-scores'
import { getCampaignProgressTool } from './get-campaign-progress'

/** Every tool available in data mode, in the order they are offered. */
export const CHAT_TOOLS = [
  findParticipantTool,
  findCampaignTool,
  findAssessmentTool,
  getSessionScoresTool,
  getCampaignProgressTool,
] as unknown as ChatTool[]

export const chatToolRegistry = buildRegistry(CHAT_TOOLS)
