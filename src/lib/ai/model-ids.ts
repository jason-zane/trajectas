/**
 * Model-id helpers shared by the AI layer.
 *
 * Kept in its own module (no imports, no I/O) so both server code and the
 * settings validation schemas can use it without pulling in the provider
 * registry or the Supabase clients.
 */

/** Model-id prefix that identifies a TypeSafe Jev decision model. */
export const JEV_MODEL_PREFIX = 'typesafe/'

/**
 * True when the model id refers to a TypeSafe Jev decision model.
 *
 * OpenRouter prefixes a "floor"-routed variant with `~`, so strip that first.
 */
export function isJevModelId(modelId: string): boolean {
  return modelId.replace(/^~/, '').startsWith(JEV_MODEL_PREFIX)
}
