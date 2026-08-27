import 'server-only'

import { buildRegistry, type ChatTool } from '../registry'
import { findParticipantTool } from './find-participant'
import { findCampaignTool } from './find-campaign'
import { findAssessmentTool } from './find-assessment'
import { getSessionScoresTool } from './get-session-scores'
import { getCampaignProgressTool } from './get-campaign-progress'
import { getPersonTimelineTool } from './get-person-timeline'
import { comparePeopleTool } from './compare-people'

/** Every tool available in data mode, in the order they are offered. */
export const CHAT_TOOLS = [
  findParticipantTool,
  findCampaignTool,
  findAssessmentTool,
  getSessionScoresTool,
  getCampaignProgressTool,
  getPersonTimelineTool,
  comparePeopleTool,
] as unknown as ChatTool[]

export const chatToolRegistry = buildRegistry(CHAT_TOOLS)
