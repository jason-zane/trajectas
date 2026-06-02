/**
 * Architect overview — a short plain-English summary of what a chosen
 * competency set will (and won't) reveal for a role. Text output, not JSON.
 */

import type { Brief } from '@/types/ai'
import { getDefaultProvider } from '@/lib/ai/providers'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { getModelForTask } from '@/lib/ai/model-config'

export type OverviewFactor = {
  factorName: string
  categoryName: string | null
  rank: number
}

export interface ArchitectOverviewInput {
  brief: Brief
  included: OverviewFactor[]
  excluded: OverviewFactor[]
}

export async function runArchitectOverview(input: ArchitectOverviewInput): Promise<string> {
  const provider = await getDefaultProvider()
  const taskConfig = await getModelForTask('architect_overview')
  const prompt = await getActiveSystemPrompt('architect_overview')

  const response = await provider.complete({
    prompt: buildOverviewPrompt(input),
    systemPrompt: prompt.content,
    model: taskConfig.modelId,
    temperature: taskConfig.config.temperature ?? 0.4,
    maxTokens: taskConfig.config.max_tokens ?? 400,
    responseFormat: 'text',
  })

  return response.content.trim()
}

function buildOverviewPrompt(input: ArchitectOverviewInput): string {
  const { brief } = input
  const line = (f: OverviewFactor) =>
    `- ${f.factorName}${f.categoryName ? ` (${f.categoryName})` : ''}`
  const included = input.included.length
    ? input.included.map(line).join('\n')
    : '- (none)'
  const excluded = input.excluded.length
    ? input.excluded.map(line).join('\n')
    : '- (none notable)'

  return `## Role
${brief.roleTitle || '(unspecified)'} — ${brief.level} — ${brief.function || 'function unspecified'}
Decision: ${brief.outcomeIntent || brief.outcome}

## Competencies being measured
${included}

## Notable competencies left out
${excluded}

Write the 2-3 sentence overview described in the system prompt.`
}
