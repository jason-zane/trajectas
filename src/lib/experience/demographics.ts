import { demographicsConfigSchema } from '@/lib/validations/experience'
import type { DemographicsConfig } from './types'

/** Validate against the effective collection form, rather than a generic JSON map. */
export function validateDemographicAnswers(config: DemographicsConfig, answers: Record<string, string>):
  { values: Record<string, string> } | { error: string } {
  const parsed = demographicsConfigSchema.safeParse(config)
  if (!parsed.success) return { error: 'The demographic form is unavailable. Please contact your administrator.' }
  const enabled = parsed.data.fields.filter(field => field.enabled)
  if (Object.keys(answers).some(key => !enabled.some(field => field.key === key))) return { error: 'The demographic form has changed. Please reload and try again.' }
  const values: Record<string, string> = {}
  for (const field of enabled) {
    const value = (answers[field.key] ?? '').trim()
    if (field.required && !value) return { error: `${field.label} is required` }
    if (value.length > 500) return { error: `${field.label} is too long` }
    if (value && field.type === 'select' && !field.options?.some(option => option.value === value)) return { error: `Please choose an available option for ${field.label}` }
    // An empty string records an optional field that was shown but left unanswered.
    values[field.key] = value
  }
  return { values }
}
