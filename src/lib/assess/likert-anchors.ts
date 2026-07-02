/**
 * Likert anchor handling.
 *
 * Anchors live on response_formats.config as either a record keyed by 1-based
 * scale value ({"1": "Strongly Disagree", ...}) — the canonical DB shape — or
 * a plain array (rows saved by the admin form, whose editing state is an
 * array). Array indices are 0-based, so treating them as scale values shifts
 * every option one point below the format's 1-based scoring bounds. Any code
 * that turns anchors into option values must go through this module.
 *
 * @module
 */

export interface AnchorOption {
  label: string
  value: number
}

/**
 * Convert stored anchors into ordered option values on the 1-based scale.
 */
export function likertAnchorOptions(anchors: unknown): AnchorOption[] {
  if (Array.isArray(anchors)) {
    return anchors.map((label, i) => ({ label: String(label), value: i + 1 }))
  }
  if (anchors && typeof anchors === 'object') {
    return Object.entries(anchors as Record<string, unknown>)
      .map(([val, label]) => ({ label: String(label), value: Number(val) }))
      .sort((a, b) => a.value - b.value)
  }
  return []
}

/**
 * Canonicalize a likert config for persistence: re-key array anchors to the
 * 1-based record shape. No-op when anchors are already a record (or absent).
 */
export function normalizeLikertAnchors(
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(config.anchors)) return config
  const anchors: Record<string, string> = {}
  config.anchors.forEach((label, i) => {
    anchors[String(i + 1)] = String(label)
  })
  return { ...config, anchors }
}
