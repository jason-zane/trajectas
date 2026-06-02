/**
 * Library field assist — drafts one factor metadata field (overuse signature,
 * theoretical lineage, contrasts-with) for the authoring UI. Text output; the
 * admin reviews/edits before saving.
 */

import { getDefaultProvider } from '@/lib/ai/providers'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { getModelForTask } from '@/lib/ai/model-config'

export type AssistField = 'overuse_signature' | 'theoretical_lineage' | 'contrasts_with'

export interface FieldAssistInput {
  field: AssistField
  factor: {
    name: string
    categoryName?: string | null
    definition?: string | null
    indicatorsHigh?: string | null
  }
  /** Candidate factors (slug + name) — required for contrasts_with. */
  candidates?: { slug: string; name: string }[]
}

const stripHtml = (v?: string | null) => (v ? v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '')

export async function runFieldAssist(input: FieldAssistInput): Promise<string> {
  const provider = await getDefaultProvider()
  const taskConfig = await getModelForTask('library_field_assist')
  const prompt = await getActiveSystemPrompt('library_field_assist')

  const response = await provider.complete({
    prompt: buildPrompt(input),
    systemPrompt: prompt.content,
    model: taskConfig.modelId,
    temperature: taskConfig.config.temperature ?? 0.4,
    maxTokens: taskConfig.config.max_tokens ?? 400,
    responseFormat: 'text',
  })
  return response.content.trim()
}

function buildPrompt(input: FieldAssistInput): string {
  const { factor } = input
  const ctx = [
    `Name: ${factor.name}`,
    factor.categoryName ? `Category: ${factor.categoryName}` : '',
    factor.definition ? `Definition: ${stripHtml(factor.definition)}` : '',
    factor.indicatorsHigh ? `High-end indicators: ${stripHtml(factor.indicatorsHigh)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  if (input.field === 'contrasts_with') {
    const cands = (input.candidates ?? []).map((c) => `${c.slug} — ${c.name}`).join('\n')
    return `FIELD: contrasts_with\n\n## This factor\n${ctx}\n\n## Candidate factors (choose 2-4 slugs from THIS list only)\n${cands}\n\nReturn only the comma-separated slugs.`
  }
  return `FIELD: ${input.field}\n\n## This factor\n${ctx}\n\nDraft the ${input.field}.`
}
