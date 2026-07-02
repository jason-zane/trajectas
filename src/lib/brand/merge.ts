// =============================================================================
// Brand layer merging
//
// The brand cascade is resolved by merging layers in ascending specificity:
//   TRAJECTAS_DEFAULTS → platform → partner → client → campaign
//
// Merge semantics are SHALLOW at top-level-field granularity: a layer that
// defines a field wholly replaces the value from less-specific layers, and
// nested groups (semanticColors, taxonomyColors, emailStyles, reportTheme,
// typography, buttonStyle, gradientAccent, portalAccents) are atomic units.
// This matches how the editors edit them and keeps resolution predictable —
// there is never a half-merged nested object.
//
// Historic rows that stored complete configs for non-platform owners remain
// valid: they are overrides that happen to define every field.
// =============================================================================

import type { BrandConfig, BrandOverrides } from './types'
import { TRAJECTAS_DEFAULTS } from './defaults'

/**
 * Merge brand layers into a complete, resolved BrandConfig.
 *
 * Layers are applied in array order — later layers win. `TRAJECTAS_DEFAULTS`
 * is always the base, so the result is complete even when every layer is
 * null. `undefined` and `null` field values in a layer are treated as
 * "not overridden" and skipped; empty strings are kept (an empty `logoUrl`
 * is a meaningful override — "remove the inherited logo").
 */
export function mergeBrandLayers(
  layers: Array<BrandOverrides | null | undefined>
): BrandConfig {
  const result: Record<string, unknown> = structuredClone(
    TRAJECTAS_DEFAULTS
  ) as Record<string, unknown>

  for (const layer of layers) {
    if (!layer) continue
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null) continue
      result[key] = value
    }
  }

  return result as unknown as BrandConfig
}

/**
 * Reduce a candidate config to only the fields that differ from the
 * inherited (parent-resolved) config. Used by the editors to persist minimal
 * override objects: fields the user never touched stay inherited and track
 * future changes to the parent brand.
 *
 * Comparison is per top-level field via JSON stringification — adequate for
 * BrandConfig's plain-data fields.
 */
export function diffBrandOverrides(
  inherited: BrandConfig,
  candidate: BrandConfig
): BrandOverrides {
  const overrides: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined) continue
    const inheritedValue = (inherited as unknown as Record<string, unknown>)[key]
    if (JSON.stringify(value) !== JSON.stringify(inheritedValue)) {
      overrides[key] = value
    }
  }

  return overrides as BrandOverrides
}

/** True when the override layer contains no overridden fields. */
export function isEmptyOverrides(overrides: BrandOverrides): boolean {
  return Object.values(overrides).every((v) => v === undefined)
}
