// =============================================================================
// Curated font list for the brand editor
// =============================================================================

export interface FontOption {
  /** Display name. */
  name: string
  /** CSS font-family value (with fallbacks). */
  family: string
  /** Category for grouping in the editor. */
  category: 'sans' | 'serif' | 'mono'
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
  {
    name: 'Geist',
    family: '"Geist", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Geist',
  },
  {
    name: 'Figtree',
    family: '"Figtree", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Figtree',
  },
  {
    name: 'Albert Sans',
    family: '"Albert Sans", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Albert+Sans',
  },
  {
    name: 'Onest',
    family: '"Onest", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Onest',
  },
  {
    name: 'Public Sans',
    family: '"Public Sans", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Public+Sans',
  },
  {
    name: 'Hanken Grotesk',
    family: '"Hanken Grotesk", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Hanken+Grotesk',
  },
  {
    name: 'Be Vietnam Pro',
    family: '"Be Vietnam Pro", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Be+Vietnam+Pro',
  },
  {
    name: 'Lexend',
    family: '"Lexend", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Lexend',
  },
  {
    name: 'Work Sans',
    family: '"Work Sans", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Work+Sans',
  },
  {
    name: 'Nunito Sans',
    family: '"Nunito Sans", system-ui, sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
    googleId: 'Nunito+Sans',
  },
  // -- Serifs ---------------------------------------------------------------
  {
    name: 'Fraunces',
    family: '"Fraunces", Georgia, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    googleId: 'Fraunces',
  },
  {
    name: 'Source Serif 4',
    family: '"Source Serif 4", Georgia, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    googleId: 'Source+Serif+4',
  },
  {
    name: 'Newsreader',
    family: '"Newsreader", Georgia, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    googleId: 'Newsreader',
  },
  {
    name: 'Crimson Pro',
    family: '"Crimson Pro", Georgia, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    googleId: 'Crimson+Pro',
  },
  {
    name: 'Lora',
    family: '"Lora", Georgia, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    googleId: 'Lora',
  },
  {
    name: 'Merriweather',
    family: '"Merriweather", Georgia, serif',
    category: 'serif',
    weights: [400, 700],
    googleId: 'Merriweather',
  },
  {
    name: 'EB Garamond',
    family: '"EB Garamond", Georgia, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    googleId: 'EB+Garamond',
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
