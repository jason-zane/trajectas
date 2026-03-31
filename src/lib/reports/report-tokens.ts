import type { ReportTheme } from './presentation'

/**
 * Generate CSS custom properties from a ReportTheme.
 * Converts camelCase keys to kebab-case CSS variables.
 * e.g., reportHighBandFill → --report-high-band-fill
 */
export function generateReportCSSTokens(theme: ReportTheme): string {
  const vars = Object.entries(theme)
    .map(([key, value]) => {
      const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `  --${cssVar}: ${value};`
    })
    .join('\n')

  return vars
}
