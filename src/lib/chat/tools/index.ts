import 'server-only'

import { buildRegistry, type ChatTool } from '../registry'
import { findParticipantTool } from './find-participant'
import { findCampaignTool } from './find-campaign'
import { findAssessmentTool } from './find-assessment'

/** Every tool available in data mode, in the order they are offered. */
export const CHAT_TOOLS = [
  findParticipantTool,
  findCampaignTool,
  findAssessmentTool,
] as unknown as ChatTool[]

export const chatToolRegistry = buildRegistry(CHAT_TOOLS)
