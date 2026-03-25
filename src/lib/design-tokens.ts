/**
 * Design tokens — secondary reference for programmatic use.
 *
 * SOURCE OF TRUTH: src/app/globals.css
 * Keep this file in sync manually when the palette changes.
 *
 * Use cases:
 * - Chart/data-viz libraries (Recharts) that need colour strings
 * - Gradient helpers that interpolate values
 * - Future PDF/report generation
 */

export const brand = {
  sage: '#3d7a6e',
  sageDark: '#2d5f55',
  midnight: '#111820',
  stone: '#c8bfae',
  warmWhite: '#f8f6f2',
} as const;

export const portalAccents = {
  admin: { light: '#7a6db5', dark: '#9a8dd5', label: 'Soft Violet' },
  partner: { light: '#d4a032', dark: '#e0b040', label: 'Gold' },
  client: { light: '#b85c3a', dark: '#d07050', label: 'Terracotta' },
} as const;

export const semantic = {
  destructive: { light: '#c53030', dark: '#e05050' },
  success: { light: '#22c55e', dark: '#22c55e' },
  warning: { light: '#c99528', dark: '#d4a838' },
} as const;

export const taxonomy = {
  dimension: { bg: { light: '#e8e0f0', dark: '#2a2440' }, accent: '#7c5cbf' },
  factor: { bg: { light: '#ddf0ec', dark: '#1e3530' }, accent: '#3d9a88' },
  construct: { bg: { light: '#f0ddf0', dark: '#352040' }, accent: '#b060b8' },
  item: { bg: { light: '#f0e8d0', dark: '#353020' }, accent: '#b89030' },
} as const;

/** Gradient helpers — use CSS custom properties for portal-awareness */
export const gradients = {
  brandIcon: `linear-gradient(135deg, var(--brand), oklch(from var(--brand) calc(l + 0.1) c h))`,
  ambientGlow: (opacity: number) =>
    `radial-gradient(ellipse 80% 50% at 50% -20%, oklch(from var(--brand) l c h / ${opacity}%), transparent)`,
  primaryGlow: (opacity: number) =>
    `radial-gradient(ellipse at center, oklch(from var(--primary) l c h / ${opacity}%), transparent)`,
} as const;

export type PortalType = keyof typeof portalAccents;
