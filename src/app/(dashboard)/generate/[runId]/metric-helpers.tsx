// ---------------------------------------------------------------------------
// Shared colour palettes and metric interpretation helpers
// ---------------------------------------------------------------------------

export const CONSTRUCT_HUES = [
  "var(--primary)",
  "hsl(220 70% 50%)",
  "hsl(142 70% 50%)",
  "hsl(38 92% 50%)",
  "hsl(270 60% 55%)",
  "hsl(180 60% 40%)",
  "hsl(340 70% 55%)",
  "hsl(60 80% 45%)",
]

export function constructColor(index: number): string {
  return CONSTRUCT_HUES[index % CONSTRUCT_HUES.length]
}

// Pastel palette for sub-theme community badges — distinct from construct hues
// Uses oklch for consistent lightness across dark/light mode
export const SUBTHEME_HUES = [
  { bg: "oklch(0.85 0.08 250)", text: "oklch(0.35 0.12 250)" },  // blue
  { bg: "oklch(0.85 0.08 150)", text: "oklch(0.35 0.12 150)" },  // green
  { bg: "oklch(0.85 0.08 50)",  text: "oklch(0.35 0.12 50)" },   // amber
  { bg: "oklch(0.85 0.08 320)", text: "oklch(0.35 0.12 320)" },  // pink
  { bg: "oklch(0.85 0.08 200)", text: "oklch(0.35 0.12 200)" },  // teal
  { bg: "oklch(0.85 0.08 100)", text: "oklch(0.35 0.12 100)" },  // lime
  { bg: "oklch(0.85 0.08 280)", text: "oklch(0.35 0.12 280)" },  // purple
  { bg: "oklch(0.85 0.08 20)",  text: "oklch(0.35 0.12 20)" },   // orange
]

export function subthemeColor(communityId: number): { bg: string; text: string } {
  const idx = ((communityId - 1) % SUBTHEME_HUES.length + SUBTHEME_HUES.length) % SUBTHEME_HUES.length
  return SUBTHEME_HUES[idx]
}

// ---------------------------------------------------------------------------
// wTO interpretation
// ---------------------------------------------------------------------------

export interface MetricInterpretation {
  label: string
  className: string
}

export function wtoInterpretation(value: number): MetricInterpretation {
  if (value < 0.10) return { label: "Excellent", className: "text-emerald-600 dark:text-emerald-400" }
  if (value <= 0.20) return { label: "Good", className: "text-muted-foreground" }
  if (value <= 0.30) return { label: "Marginal", className: "text-amber-600 dark:text-amber-400" }
  return { label: "Redundant", className: "text-red-600 dark:text-red-400" }
}

// ---------------------------------------------------------------------------
// NMI interpretation
// ---------------------------------------------------------------------------

export interface NmiInterpretation {
  label: string
  className: string
  barClass: string
  summary: string
}

export function nmiInterpretation(value: number): NmiInterpretation {
  if (value >= 0.90) return {
    label: "Excellent",
    className: "text-emerald-600 dark:text-emerald-400",
    barClass: "bg-emerald-500",
    summary: "Your items cleanly separate into distinct constructs.",
  }
  if (value >= 0.75) return {
    label: "Good",
    className: "text-primary",
    barClass: "bg-primary",
    summary: "Your items align well with your intended constructs.",
  }
  if (value >= 0.50) return {
    label: "Moderate",
    className: "text-amber-600 dark:text-amber-400",
    barClass: "bg-amber-500",
    summary: "Some items overlap between constructs — consider revising definitions.",
  }
  return {
    label: "Poor",
    className: "text-red-600 dark:text-red-400",
    barClass: "bg-red-500",
    summary: "Items aren't cleanly separating — consider revising construct definitions.",
  }
}
