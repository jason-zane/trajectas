import type { TemplateVariables } from './types'

/**
 * Replace `{{variableName}}` placeholders in a string with values
 * from the provided variables object.
 *
 * Unknown placeholders are left as-is so they're visible during development.
 */
export function interpolate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key as keyof TemplateVariables]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

/**
 * Recursively interpolate all string values in a content object.
 * Returns a new object — does not mutate the original.
 */
export function interpolateContent<T>(
  content: T,
  variables: TemplateVariables
): T {
  if (typeof content === 'string') {
    return interpolate(content, variables) as T
  }

  if (Array.isArray(content)) {
    return content.map((item) => interpolateContent(item, variables)) as T
  }

  if (content !== null && typeof content === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(content)) {
      result[key] = interpolateContent(value, variables)
    }
    return result as T
  }

  return content
}
