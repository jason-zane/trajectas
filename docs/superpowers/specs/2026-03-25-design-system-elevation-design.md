# Design System Elevation — Design Spec

## Summary

A comprehensive visual refresh of the Trajectas platform covering typography, colour palette, design tokens architecture, and visual hierarchy. The goal is to create a distinctive, premium feel that's warm and approachable — reflecting the org psych roots of the platform — while being robust enough that the entire palette can be changed from a single file.

**This is a breaking visual change.** The sidebar, fonts, and portal accent colours are all changing from the current codebase. This is intentional — the current values evolved piecemeal and are being replaced with a deliberately designed system.

---

## 1. Typography System

### Font Pairing

**Display/Heading font:** Newsreader (variable serif, Google Fonts)
- Used for: hero headings, page titles, entity names on cards, stat numbers, section labels (italic)
- Variable font with optical sizing (`opsz` axis) and weight axes
- Replaces: Geist Sans for all heading/display roles

**UI/Body font:** Plus Jakarta Sans (Google Fonts)
- Used for: body text, descriptions, buttons, labels, eyebrow text, table content, badges, form inputs, navigation
- Rounder and friendlier than Inter, pairs naturally with Newsreader
- Replaces: Geist Sans for all body/UI roles

**Mono font:** Geist Mono (unchanged, for code/technical display)

### Type Scale

Maps to existing CSS utility classes (sizes updated where noted):

| Role | CSS Class | Font | Weight | Size | Tracking | Notes |
|------|-----------|------|--------|------|----------|-------|
| Hero heading | `.text-display` | Newsreader | 600 | 2.75rem/44px (was 3rem) | -0.02em | Dashboard greeting. Responsive: 1.875rem on mobile. |
| Page title | `.text-headline` | Newsreader | 600 | 1.875rem/30px (unchanged) | -0.02em | All page headers |
| Entity name | `.text-title` | Newsreader | 500 | 1.0625rem/17px (was 1.25rem) | -0.01em | Card titles for entities |
| Stat number | (inline) | Newsreader | 600 | 32–36px | -0.02em | Dashboard stat cards |
| Section label | (new: `.text-section`) | Newsreader | 400 italic | 14px | normal | "Quick Actions", counts |
| Eyebrow | `.text-overline` | Plus Jakarta Sans | 600 | 10.5px (was 11px) | 0.1em (was 0.06em) | Uppercase, coloured |
| Body | `.text-body` | Plus Jakarta Sans | 400–500 | 15px (unchanged) | normal | Descriptions |
| Caption/meta | `.text-caption` | Plus Jakarta Sans | 400 | 12.5px (was 13px) | normal | Card metadata |
| Button | (shadcn default) | Plus Jakarta Sans | 600 | 13px | normal | All buttons |
| Table header | `.text-table-head` | Plus Jakarta Sans | 600 | 10.5px | 0.06em | New utility. Uppercase, tighter tracking than eyebrow. |

### Font Loading

In `src/app/layout.tsx`, replace Geist imports:

```tsx
import { Newsreader } from "next/font/google";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Geist_Mono } from "next/font/google";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  axes: ["opsz"], // include optical sizing axis
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
```

In `globals.css` `@theme inline`, update:
```css
--font-sans: var(--font-sans);       /* ← set by Plus Jakarta Sans variable */
--font-heading: var(--font-heading); /* ← set by Newsreader variable */
--font-mono: var(--font-geist-mono); /* ← keep existing */
```

**Migration note:** The current `layout.tsx` sets `variable: "--font-geist-sans"` on Geist, but the `@theme inline` block references `--font-sans` — there's no bridge between them. The current wiring is likely relying on a Tailwind v4 default. Switching to `variable: "--font-sans"` on Plus Jakarta Sans fixes this properly.

**Note:** `--font-heading` currently maps to `var(--font-sans)` in the codebase. Changing it to Newsreader will affect any component using `font-heading` — including shadcn's Card, Dialog, Sheet, Alert, and Popover components. This is intentional: CardTitle and Dialog headings should use the serif font.

### Where Each Font Appears

**Newsreader (serif) — content is "speaking":**
- Page greetings and titles (`.text-display`, `.text-headline`)
- Entity names on cards (`.text-title`, `font-heading`)
- Numbers that matter (stat counts)
- Section labels as gentle emphasis (italic, `.text-section`)

**Plus Jakarta Sans — content is "working":**
- All UI chrome (buttons, nav, badges, inputs)
- Descriptions and body copy (`.text-body`, `.text-caption`)
- Table data
- Eyebrow labels (`.text-overline`)

---

## 2. Colour Palette

All colours specified in both hex (for reference/design tools) and oklch (for implementation). The codebase uses oklch exclusively.

### Brand Colours (constant, portal-independent)

| Token | Role | Hex | oklch (light) | oklch (dark) |
|-------|------|-----|---------------|--------------|
| `--brand` | Sidebar, brand identity | `#3d7a6e` | `oklch(0.50 0.08 175)` | `oklch(0.40 0.07 175)` |
| `--midnight` | Dark surfaces, foreground | `#111820` | n/a | `oklch(0.13 0.01 260)` |
| `--stone` | Warm neutral | `#c8bfae` | `oklch(0.80 0.03 80)` | `oklch(0.80 0.03 80)` |
| `--warm-white` | Light background | `#f8f6f2` | `oklch(0.97 0.005 80)` | n/a |

**New variable:** `--brand` does not exist in the current CSS. It must be added to `:root` and `.dark` blocks.

### Portal Accent Colours

**This is a change from the current codebase.** The current portal accents are: admin=indigo (hue 265), partner=teal (hue 175), client=amber (hue 55). These are being replaced:

| Portal | New Accent | Hex | oklch (light) | oklch (dark) |
|--------|-----------|-----|---------------|--------------|
| Admin | Soft Violet | `#7a6db5` | `oklch(0.52 0.14 290)` | `oklch(0.65 0.14 290)` |
| Partner | Gold | `#d4a032` | `oklch(0.73 0.14 80)` | `oklch(0.78 0.12 80)` |
| Client/Org | Terracotta | `#b85c3a` | `oklch(0.55 0.14 45)` | `oklch(0.62 0.14 45)` |

The accent flows through these CSS variables: `--primary`, `--primary-foreground`, `--ring`, `--accent`, `--accent-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-ring`, `--chart-1`, `--shadow-glow`. (Same mechanism as current `[data-portal]` selectors — just new colour values.)

### Semantic Colours (portal-independent)

| Token | Role | oklch (light) | oklch (dark) |
|-------|------|---------------|--------------|
| `--destructive` | Error, delete | `oklch(0.55 0.22 25)` | `oklch(0.65 0.19 25)` |
| `--success` | Active badges | `oklch(0.65 0.20 145)` | `oklch(0.65 0.20 145)` |
| `--warning` | Caution states | `oklch(0.70 0.14 70)` | `oklch(0.75 0.12 70)` |

**Note:** `--success` is a new variable (not in current CSS). `--warning` is intentionally shifted from the partner gold accent (hue 70 vs hue 80) to avoid visual collision in the partner portal.

### Surface & Text Colours

Derived from brand colours. These replace the current values in `:root` and `.dark`:

| Variable | Light Mode | Dark Mode | Derivation |
|----------|-----------|-----------|------------|
| `--background` | `oklch(0.97 0.005 80)` | `oklch(0.13 0.01 260)` | warm-white / midnight |
| `--foreground` | `oklch(0.14 0.01 260)` | `oklch(0.93 0.005 80)` | midnight / warm white |
| `--card` | `oklch(1 0 0)` | `oklch(0.17 0.01 260)` | white / slightly lighter than bg |
| `--muted` | `oklch(0.95 0.005 80)` | `oklch(0.22 0.01 260)` | stone-derived |
| `--muted-foreground` | `oklch(0.45 0.01 260)` | `oklch(0.60 0.01 260)` | fg at reduced opacity |
| `--border` | `oklch(0.90 0.005 80)` | `oklch(1 0 0 / 8%)` | stone-derived / white alpha |
| `--sidebar` | `oklch(0.50 0.08 175)` | `oklch(0.40 0.07 175)` | brand |
| `--sidebar-foreground` | `oklch(1 0 0 / 80%)` | `oklch(1 0 0 / 80%)` | white alpha |

**This is a major change to the sidebar.** The current sidebar is a light neutral surface (`oklch(0.975)`) with dark text. This spec changes it to the brand colour (sage teal) with white text. This affects `app-sidebar.tsx` and all sidebar-related CSS variables in both light and dark modes.

### Taxonomy Colours

Unchanged from current codebase. These are functional colours for hierarchy levels, not brand colours. They stay in their current oklch values and hue assignments. They are defined in `globals.css` alongside the other variables but are conceptually separate from the brand system.

---

## 3. Design Tokens Architecture

### Source of Truth: CSS Custom Properties

In Tailwind v4, the CSS `@theme inline` block **is** the configuration. There is no `tailwind.config.js`. Therefore:

**`globals.css` is the single source of truth for all design tokens.**

The CSS custom properties in `:root`, `.dark`, and `[data-portal]` blocks define every colour, font, shadow, and spacing value. Tailwind reads these at build time via `@theme inline` to generate utility classes.

### Secondary Reference: `src/lib/design-tokens.ts`

A TypeScript file that **re-exports** a subset of token values for programmatic use. It is a consumer of the design system, not the source. Use cases:

- Gradient helpers that need to interpolate token values
- Chart/data viz libraries (Recharts) that need colour values as strings
- Future PDF/report generation that can't read CSS variables
- Brand colour documentation

```typescript
/**
 * Design tokens — secondary reference.
 * Source of truth is globals.css.
 * Keep in sync manually when palette changes.
 */
export const brand = {
  sage: '#3d7a6e',
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

/** Gradient helpers using CSS custom properties (portal-aware) */
export const gradients = {
  brandIcon: `linear-gradient(135deg, var(--brand), oklch(from var(--brand) calc(l + 0.1) c h))`,
  ambientGlow: (opacity: number) =>
    `radial-gradient(ellipse 80% 50% at 50% -20%, oklch(from var(--brand) l c h / ${opacity}%), transparent)`,
  primaryGlow: (opacity: number) =>
    `radial-gradient(ellipse at center, oklch(from var(--primary) l c h / ${opacity}%), transparent)`,
} as const;
```

### How It Flows

```
globals.css (SOURCE OF TRUTH)
  ├─→ @theme inline { ... } → Tailwind utility classes
  ├─→ :root { light mode CSS variables }
  ├─→ .dark { dark mode CSS variables }
  ├─→ [data-portal="admin"] { accent overrides }
  ├─→ [data-portal="partner"] { accent overrides }
  └─→ [data-portal="client"] { accent overrides }

design-tokens.ts (SECONDARY REFERENCE — keep in sync)
  ├─→ Chart/data-viz libraries
  ├─→ Gradient helpers
  └─→ Future: PDF report generation
```

### Rules

1. **No raw colour values in components.** Every colour must reference a CSS variable or a Tailwind utility derived from one. If you find a hex/oklch literal in a `.tsx` file, it's a bug.
2. **Portal accent is always `--primary`.** Components use `--primary`, and the `[data-portal]` selector sets what `--primary` resolves to.
3. **Brand colour is `--brand` / `--sidebar`.** The sidebar, brand icon, and ambient glow reference these variables, never a specific hex.
4. **Taxonomy colours are self-contained.** `--dimension-*`, `--competency-*`, `--trait-*`, `--item-*` are independent of portal accents and brand colours.
5. **Dark mode shifts are co-located.** Each section of `globals.css` (`:root` and `.dark`) defines the same variables, keeping light/dark pairs together.
6. **`design-tokens.ts` must be kept in sync manually.** A comment at the top of the file states this. If a colour changes in `globals.css`, it must also be updated in `design-tokens.ts`.

---

## 4. Visual Hierarchy Patterns

### Eyebrow Labels

Coloured uppercase text above headings to provide context:
- **Page-level:** "LIBRARY" above "Dimensions" title, "OVERVIEW" above "Dashboard"
- **Card-level:** "DIMENSION" / "FACTOR" / "CONSTRUCT" on entity cards, using taxonomy accent colour
- Font: Plus Jakarta Sans 600, 10.5px, letter-spacing 0.1em (`.text-overline`)

### Section Labels

Italic serif for gentle emphasis on section dividers:
- "Quick Actions", "2 dimensions", "Showing 156 items"
- Font: Newsreader 400 italic, 14px (new utility: `.text-section`)
- Colour: `text-muted-foreground`

### Card Entity Names

Newsreader 500 at 16–17px for card titles. Since `--font-heading` maps to Newsreader, any component using `font-heading` (including shadcn's `CardTitle`) will automatically use the serif. No per-component override needed.

### Sidebar Text Contrast

**This is a change from the current sidebar.** The sidebar moves from a light neutral surface to the brand colour (sage teal) with white text. Contrast levels on the sage teal (`#3d7a6e`) background:

| Element | Colour | Contrast ratio vs #3d7a6e |
|---------|--------|---------------------------|
| Active nav item | `#ffffff` | 4.8:1 (AA pass) |
| Inactive nav items | `rgba(255,255,255,0.8)` | ~3.8:1 (AA-large pass) |
| Group labels | `rgba(255,255,255,0.55)` | ~2.6:1 (decorative, acceptable) |
| Brand subtitle | `rgba(255,255,255,0.7)` | ~3.4:1 (AA-large pass) |
| Active indicator | Portal accent colour | 3px bar, decorative |

### Light vs Dark Mode Principles

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background | Warm white (`--warm-white`) | Midnight (`--midnight`) |
| Cards | White bg, shadow-driven | Dark bg, border-driven |
| Sidebar | Brand colour | Slightly darker brand |
| Accent colours | Deeper variants | Brighter variants |
| Borders | Stone-derived, visible | White at 6–8%, subtle |
| Ambient glow | 3–4% opacity | 5–6% opacity |
| Text on cards | Near-black | Warm white |

---

## 5. Scope of Changes

### New files
| File | Purpose |
|------|---------|
| `src/lib/design-tokens.ts` | Secondary reference for programmatic token access |

### Modified files — Major changes
| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Replace Geist font imports with Newsreader + Plus Jakarta Sans + Geist Mono. Update className on `<html>`. |
| `src/app/globals.css` | **Full rewrite of colour variables** in `:root`, `.dark`, and `[data-portal]` blocks. Update `@theme inline` font references. Update type utility classes (`.text-display`, `.text-headline`, `.text-title`, `.text-overline`). Add new `.text-section` utility. Add `--brand`, `--success`, `--warning` variables. |
| `src/components/app-sidebar.tsx` | **Sidebar redesign.** All text colours change from dark-on-light to white-on-brand. Group labels, nav items, brand section all need updated colour classes. |
| `src/app/(dashboard)/layout.tsx` | Sidebar bg now references `--sidebar` (brand colour). May need to remove explicit bg overrides. |

### Modified files — Typography updates
| File | Changes |
|------|---------|
| `src/components/page-header.tsx` | Add optional `eyebrow` prop. Title uses `font-heading` (now serif). |
| `src/app/(dashboard)/page.tsx` | Serif heading, serif stat numbers, eyebrow date, italic section labels. |
| `src/app/(dashboard)/dimensions/page.tsx` | Eyebrow labels on cards, serif entity names via `font-heading`. |
| `src/app/(dashboard)/factors/competency-list.tsx` | Same pattern. |
| `src/app/(dashboard)/constructs/page.tsx` | Same pattern. |
| `src/app/(dashboard)/items/item-list.tsx` | Table header sizing. |

### Modified files — Cascading from `font-heading` change
| File | Impact |
|------|--------|
| `src/components/ui/card.tsx` | `CardTitle` uses `font-heading` → now serif. **Intentional.** |
| `src/components/ui/dialog.tsx` | `DialogTitle` uses `font-heading` → now serif. **Intentional.** |
| `src/components/ui/sheet.tsx` | `SheetTitle` may use `font-heading`. **Review and confirm.** |
| `src/components/ui/alert.tsx` | `AlertTitle` may use `font-heading`. **Review and confirm.** |

### Audit
| Scope | Action |
|-------|--------|
| All `.tsx` files | Search for raw hex/oklch literals. Replace with CSS variable references. |

---

## 6. What This Does NOT Cover

- Taxonomy colour specific values (functional, not brand — can be refined separately)
- Logo/wordmark design
- Marketing site design
- Report template design (future — will import from `design-tokens.ts`)
- New component creation (existing shadcn components adopt new variables)
- Dark mode sidebar: exact shade of brand-dark needs visual testing during implementation
