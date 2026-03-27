// =============================================================================
// Curated font list for the brand editor
// =============================================================================

export interface FontOption {
  /** Display name. */
  name: string
  /** CSS font-family value (with fallbacks). */
  family: string
  /** Category for grouping in the editor. */
  category: 'sans' | 'mono'
  /** Available weights. */
  weights: number[]
  /** Google Fonts identifier (null if loaded via next/font). */
  googleId: string | null
}

export const HEADING_BODY_FONTS: FontOption[] = [
  {
    name: 'Plus Jakarta Sans',
    family: '"Plus Jakarta Sans", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Plus+Jakarta+Sans',
  },
  {
    name: 'Inter',
    family: '"Inter", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Inter',
  },
  {
    name: 'DM Sans',
    family: '"DM Sans", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'DM+Sans',
  },
  {
    name: 'Sora',
    family: '"Sora", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Sora',
  },
  {
    name: 'Outfit',
    family: '"Outfit", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Outfit',
  },
  {
    name: 'Manrope',
    family: '"Manrope", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Manrope',
  },
  {
    name: 'Source Sans 3',
    family: '"Source Sans 3", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Source+Sans+3',
  },
]

export const MONO_FONTS: FontOption[] = [
  {
    name: 'Geist Mono',
    family: '"Geist Mono", ui-monospace, monospace',
    category: 'mono',
    weights: [400, 500, 600],
    googleId: null, // loaded via next/font/google in layout.tsx
  },
  {
    name: 'JetBrains Mono',
    family: '"JetBrains Mono", ui-monospace, monospace',
    category: 'mono',
    weights: [400, 500, 600, 700],
    googleId: 'JetBrains+Mono',
  },
  {
    name: 'Fira Code',
    family: '"Fira Code", ui-monospace, monospace',
    category: 'mono',
    weights: [400, 500, 600, 700],
    googleId: 'Fira+Code',
  },
]

/** All available fonts in a flat array. */
export const ALL_FONTS: FontOption[] = [...HEADING_BODY_FONTS, ...MONO_FONTS]

/** Look up a font by name. */
export function getFontByName(name: string): FontOption | undefined {
  return ALL_FONTS.find((f) => f.name === name)
}

/** Build a Google Fonts <link> URL for the given font names. */
export function buildGoogleFontsUrl(fontNames: string[]): string | null {
  const families = fontNames
    .map((name) => getFontByName(name))
    .filter((f): f is FontOption => f != null && f.googleId != null)
    .map((f) => `family=${f.googleId}:wght@${f.weights.join(';')}`)

  if (families.length === 0) return null
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}
