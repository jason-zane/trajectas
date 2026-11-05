/**
 * Derive an item's scoring bounds.
 *
 * Explicit `minValue`/`maxValue` on the response-format config win. When the
 * config lacks them, the item's own option values define the scale — e.g. the
 * seeded binary format carries no bounds, so its 0/1 options must score 0–1,
 * not the Likert default 1–5. Items with no options (AI-generated items get
 * none) can still derive bounds from binary-style configs: the seeded shape
 * keys option values as `labels` keys ({"0": "No", "1": "Yes"}) and the admin
 * form stores `trueValue`/`falseValue` — the runner's binary component
 * submits 0/1 in both cases. A binary format whose config carries none of
 * those shapes still scores 0–1 — the runner's hardcoded Yes=1/No=0 fallback
 * applies to every option-less binary item. Only after that do we fall back
 * to the config's `points` (Likert) or the 1–5 default.
 */
export function deriveItemBounds(
  config: Record<string, unknown>,
  optionValues: number[],
  formatType?: string,
): { minValue: number; maxValue: number } {
  const cfgMin = typeof config.minValue === 'number' ? config.minValue : undefined
  const cfgMax = typeof config.maxValue === 'number' ? config.maxValue : undefined
  if (cfgMin !== undefined && cfgMax !== undefined) {
    return { minValue: cfgMin, maxValue: cfgMax }
  }
  if (optionValues.length > 0) {
    return {
      minValue: Math.min(...optionValues),
      maxValue: Math.max(...optionValues),
    }
  }
  if (config.labels && typeof config.labels === 'object' && !Array.isArray(config.labels)) {
    const labelValues = Object.keys(config.labels as Record<string, unknown>)
      .map(Number)
      .filter(Number.isFinite)
    if (new Set(labelValues).size >= 2) {
      return {
        minValue: Math.min(...labelValues),
        maxValue: Math.max(...labelValues),
      }
    }
  }
  if (
    typeof config.trueValue === 'number' &&
    typeof config.falseValue === 'number' &&
    config.trueValue !== config.falseValue
  ) {
    return {
      minValue: Math.min(config.trueValue, config.falseValue),
      maxValue: Math.max(config.trueValue, config.falseValue),
    }
  }
  if (formatType === 'binary') {
    return { minValue: cfgMin ?? 0, maxValue: cfgMax ?? 1 }
  }
  const points = typeof config.points === 'number' ? config.points : 5
  return { minValue: cfgMin ?? 1, maxValue: cfgMax ?? points }
}
