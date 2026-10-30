/** Presentation contract for trajectas-response-quality-v2 administrations.
 * Complete the source sentence fragment; never paraphrase or alter its key.
 * The source definition, form identity and scoring input remain canonical. */
export const PERSONALITY_FIRST_PERSON_PRESENTATION = 'trajectas-first-person-v1'
export const PERSONALITY_FIRST_PERSON_PROMPT = 'How accurately does this statement describe you as you generally are?'
export function firstPersonPersonalityStem(source: string): string {
  return `I ${source.charAt(0).toLowerCase()}${source.slice(1)}`
}
