import type { AIPromptPurpose } from '@/types/database'

/**
 * The canonical runtime list of AI prompt purposes.
 *
 * `AIPromptPurpose` is a type, so it vanishes at runtime — anything needing the
 * values (a zod enum, a settings dropdown, a bulk update) has to restate them.
 * Those restatements drifted: adding the six `instrument_*` purposes to the
 * union left the validation enums in `validations/prompts.ts` and
 * `validations/model-config.ts` rejecting every one of them, so the settings
 * page could neither load nor save a prompt for a purpose it was displaying.
 *
 * This array is the single source. The assertion below makes omitting a purpose
 * a COMPILE error rather than a runtime "Invalid input" discovered in the UI.
 */
export const AI_PROMPT_PURPOSES = [
  'competency_matching',
  'ranking_explanation',
  'diagnostic_analysis',
  'item_generation',
  'factor_item_generation',
  'library_import_structuring',
  'preflight_analysis',
  'embedding',
  'chat',
  'chat_data',
  'report_narrative',
  'report_strengths_analysis',
  'report_development_advice',
  'item_critique',
  'synthetic_respondent',
  'brief_extraction',
  'architect_overview',
  'library_field_assist',
  'instrument_structure',
  'instrument_blueprint',
  'instrument_items',
  'instrument_critique',
  'instrument_fairness',
  'instrument_congruence',
] as const satisfies readonly AIPromptPurpose[]

/**
 * Compile-time proof that the array above covers the whole union. If a purpose
 * is added to `AIPromptPurpose` and not to `AI_PROMPT_PURPOSES`, the `Exclude`
 * resolves to that purpose instead of `never` and this line fails to typecheck.
 */
type MissingPurpose = Exclude<
  AIPromptPurpose,
  (typeof AI_PROMPT_PURPOSES)[number]
>
const _exhaustive: MissingPurpose extends never ? true : never = true
void _exhaustive

/** Purposes that select a text-generation model (i.e. everything but embeddings). */
export const TEXT_AI_PROMPT_PURPOSES = AI_PROMPT_PURPOSES.filter(
  (purpose) => purpose !== 'embedding'
)
