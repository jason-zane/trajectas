import 'server-only'

/**
 * Doc 03 (item-generation-pipeline) §6.5: colour is never an encoding channel
 * anywhere in this instrument. Fill state is carried by pattern
 * (outline/hatched/solid); every item survives full desaturation without
 * loss of information. The renderer therefore has a two-token palette, not
 * the Okabe-Ito colour-blind-safe set — that set is reserved for admin/QA
 * diagnostic overlays and is deliberately NOT used for stimulus geometry
 * (using it there would make colour an encoding channel, which doc
 * 03-logical-reasoning-design.md §1.4/§7.4 forbids).
 *
 * `#111827` on `#FFFFFF` is ~16.9:1 contrast; the dark inversion is the same
 * ratio. Both clear doc 03's 4.5:1 floor and WCAG 2.2 SC 1.4.11's 3:1 for
 * graphical objects.
 *
 * Doc 03 §6.5: "Dark mode is a delivery covariate... For the pilot, lock
 * light mode." The renderer accepts a theme parameter (so dark mode is not
 * hard-coded out of the implementation) but delivery (src/lib/dal/
 * cognitive-items.ts) always renders 'light' until the device-DIF analysis
 * doc 03 §12 Stage 3 requires exists.
 */
export type CognitiveTheme = 'light' | 'dark'

export const PALETTE: Record<CognitiveTheme, {
  ink: string
  paper: string
  cellRule: string
  blankMark: string
}> = {
  light: {
    ink: '#111827', // all stimulus geometry: strokes and solid fills
    paper: '#FFFFFF', // cell background
    cellRule: '#D1D5DB', // 1px cell border — chrome, not stimulus
    blankMark: '#9CA3AF', // the "?" placeholder in R3C3 (rendered outside the SVG — see CognitiveResponse)
  },
  dark: {
    ink: '#F9FAFB',
    paper: '#111827',
    cellRule: '#374151',
    blankMark: '#6B7280',
  },
}

/** Delivery-time default per doc 03 §6.5's "lock light mode" pilot decision. */
export const DELIVERY_THEME: CognitiveTheme = 'light'
