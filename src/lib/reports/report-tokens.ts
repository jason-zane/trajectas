import type { ReportTheme } from './presentation'

/**
 * Strip characters that could break out of a CSS value context.
 * Prevents injection of `</style>`, `<script>`, or CSS rule-breaking characters.
 */
function sanitiseCSSValue(value: string): string {
  return value.replace(/[<>{}();\\"/]/g, '')
}

/**
 * Generate CSS custom properties from a ReportTheme.
 * Converts camelCase keys to kebab-case CSS variables.
 * e.g., reportHighBandFill → --report-high-band-fill
 */
export function generateReportCSSTokens(theme: ReportTheme): string {
  const vars = Object.entries(theme)
    .map(([key, value]) => {
      const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `  --${cssVar}: ${sanitiseCSSValue(String(value))};`
    })
    .join('\n')

  return vars
}
