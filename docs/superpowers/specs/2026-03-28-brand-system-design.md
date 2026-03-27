# Talent Fit Brand System — Design Specification

## Context

Talent Fit needs a unified brand system that governs how the platform looks across all external-facing surfaces: assessment runners, candidate reports, email invitations, and eventually client portals. Currently, brand colors are hardcoded in CSS (`--brand: oklch(0.50 0.08 175)`), there's no brand editor, and organizations have no branding fields. This spec designs a configurable brand token system, a visual brand editor, and a redesigned assessment runner — establishing the foundation for all future branded surfaces.

## Brand Principles

**Personality:** Calm authority — like Apple or Aesop. Minimal, considered, premium. Every element feels intentional. Conveys quality and thoughtfulness.

**Design language:**
- Generous white space, refined typography (Plus Jakarta Sans)
- Subtle animations and transitions (spring easing, not bounce)
- Shadow-driven depth in light mode, border-driven in dark mode
- OKLCH color space throughout for perceptually uniform palettes
- No visual clutter — the content IS the interface

## Three-Layer Brand Architecture

### Layer 1: Brand Foundation (everywhere)
The Talent Fit brand identity. Sage/teal hue family (around hue 175). Appears in:
- Logo and wordmark
- External-facing pages (assessment runner, reports, emails)
- Sidebar brand mark across all portals
- Ambient glow and trust signals

Full 10-step OKLCH scale (50-900) generated from primary hue.

### Layer 2: Portal Accents (authenticated only)
Wayfinding colors for dashboard users. These are NOT brand colors — they indicate which portal context you're in:
- **Admin**: Violet (hue 290) — existing `data-portal="admin"`
- **Partner**: Gold (hue 80) — existing `data-portal="partner"`
- **Client**: Terracotta (hue 45) — existing `data-portal="client"`

Portal accents are never visible to candidates or in reports.

### Layer 3: Client Brand Override (external-facing only)
Optional per-organization branding applied to assessment runners and reports:
- Client logo replaces TalentFit logo in header
- Client primary color replaces sage for accents, buttons, selection states
- "Powered by TalentFit" footer badge
- Falls back to TalentFit defaults when no client brand is configured

## Sub-project 1: Brand Token Foundation

### Brand Configuration Schema

```typescript
interface BrandConfig {
  // Identity
  name: string                    // "Talent Fit" or org name
  logoUrl?: string                // Full logo (horizontal)
  logomarkUrl?: string            // Square icon version

  // Color — stored as hex, converted to OKLCH internally
  primaryColor: string            // Hex, e.g., "#2d6a5a"
  accentColor: string             // Hex, e.g., "#c9a962"
  neutralTemperature: 'warm' | 'neutral' | 'cool'
  // Controls the hue tint of all neutral tones (grays used in
  // backgrounds, borders, muted text). 'warm' shifts toward amber,
  // 'cool' shifts toward blue, 'neutral' is achromatic.

  // Typography
  headingFont: string             // From curated list
  bodyFont: string
  monoFont: string

  // Shape
  borderRadius: 'sharp' | 'soft' | 'round'  // 4px / 8px / 16px base

  // Surfaces
  darkModeEnabled: boolean
}
```

### Token Generation Pipeline

```
BrandConfig (JSON in DB)
  ├─→ generateCSSTokens(config)   → CSS custom properties string
  ├─→ generatePDFStyles(config)   → Style object for PDF renderer
  └─→ generateEmailStyles(config) → Inline CSS map for email templates
```

**CSS Token Generation:**
1. Convert hex primary to OKLCH (hue, chroma, lightness)
2. Generate 10-step lightness scale (50: 0.97, 100: 0.93, ..., 900: 0.20)
3. Output CSS custom properties: `--brand-50` through `--brand-900`
4. Generate semantic tokens: `--brand-surface`, `--brand-text`, `--brand-accent`, `--brand-border`
5. Generate surface tokens: `--brand-bg`, `--brand-card`, `--brand-elevated`

**PDF/Email transforms** produce equivalent values in hex format for compatibility.

### Database

New `brand_configs` table:
- `id` UUID PRIMARY KEY
- `owner_type` TEXT ('platform' | 'organization')
- `owner_id` UUID (NULL for platform, org ID for organizations)
- `config` JSONB (BrandConfig)
- `is_default` BOOLEAN DEFAULT false
- `created_at`, `updated_at`, `deleted_at` (standard soft-delete)

**Unique constraint:** One config per owner (owner_type + owner_id).

**Seed data:** Platform default with current Talent Fit values (sage primary, gold accent, Plus Jakarta Sans, soft radius).

**Organization lookup:** To find an org's brand, query `brand_configs WHERE owner_type = 'organization' AND owner_id = org.id`. No FK needed on organizations — the polymorphic `owner_type + owner_id` pattern is the single source of truth. Falls back to `WHERE owner_type = 'platform' AND is_default = true` when no org config exists.

### Curated Font List

Heading/body fonts available in the editor (loaded via Google Fonts with `display: swap` unless noted):
- Plus Jakarta Sans (current default)
- Inter
- DM Sans
- Sora
- Outfit
- Manrope
- Source Sans 3

Mono fonts:
- Geist Mono (current default — loaded via `next/font/google`)
- JetBrains Mono
- Fira Code

## Sub-project 2: Brand Editor UI

### Admin Editor — `/settings/brand`

**Layout:** Two-column, controls left (360px), live preview right (fluid).

**Controls panel (left):**
1. **Identity section:** Logo upload (drag/drop), logomark upload
2. **Colors section:** Primary color picker (hex input + visual swatch + auto-generated scale preview), accent color picker, neutral temperature toggle (warm/neutral/cool)
3. **Typography section:** Heading font dropdown with sample preview, body font dropdown
4. **Shape section:** Border radius preset (sharp/soft/round) with visual shape previews
5. **Actions:** Save Changes button (Zone 2 explicit save), Reset to Defaults

**Preview gallery (right):**
Scrollable vertical gallery with Light/Dark/Mobile toggle at top.

Preview surfaces:
1. Assessment runner card (sample likert question, horizontal layout) — **live, functional**
2. Report cover/header mockup — **static mockup** (reports not yet built)
3. Email invitation template — **static mockup** (email system not yet built)
4. Welcome screen — **live** (existing `/assess/[token]/welcome` route, restyled in SP3)
5. Completion/thank you screen — **live** (existing `/assess/[token]/complete` route, restyled in SP3)
6. Badge/certification mark — **static mockup**

Static mockups show representative HTML previews with brand tokens applied. They become live previews when those features are implemented. All previews update instantly on control changes (client-side CSS variable injection). Save persists to DB.

**Note:** This editor introduces a new `/settings` section in the dashboard sidebar. The sidebar component (`app-sidebar.tsx`) will need a new "Settings" menu group.

### Client Editor — `/organizations/[slug]/branding`

**Simplified layout:** Same two-column but controls are just:
1. Logo upload
2. Primary color picker (hex input + swatch + auto-generated scale)
3. Save button

Preview shows only the assessment runner card with their branding applied.

**Admin override:** Admins can access any organization's full brand editor from the admin dashboard, providing the complete design system controls. This is the "setup service" Jason offers as a product cost.

### Persistence

- **Zone 2:** Explicit save for all brand settings
- **Unsaved changes warning** on navigate-away via `useUnsavedChanges`
- **Toast feedback:** `toast.success("Brand settings saved")`

## Sub-project 3: Assessment Runner Redesign

### Layout: Card-Centered on Light Background

**Structure:**
```
┌─────────────────────────────────────────┐
│ [Logo]                        [← Back]  │  ← Header
├─────────────────────────────────────────┤
│ ▇▇▇▇▇▇▇▇▇░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← 2px progress bar
│                                         │
│         ┌───────────────────┐           │
│         │ ASSESSMENT NAME   │           │
│         │                   │           │
│         │ Question text     │           │
│         │ here...           │           │
│         │                   │           │
│         │ [Options]         │           │
│         └───────────────────┘           │
│                                         │
│        · Responses saved automatically  │  ← Footer
└─────────────────────────────────────────┘
```

### Navigation Model Change

The redesigned runner uses a **one-item-per-card** model. The existing `itemsPerPage` pagination in `section-wrapper.tsx` is replaced — every question gets its own card regardless of the assessment's `itemsPerPage` setting. This simplifies the UX and enables auto-advance. The existing multi-item-per-page display is removed.

**Review screen:** The existing `/assess/[token]/review` route and `ReviewScreen` component are kept and restyled to match the new card-centered design. After the final question, candidates see a summary of their responses with the option to go back and change answers before submitting. This is important for assessment validity — candidates should feel confident before finalizing.

### Key Behaviors

- **Auto-advance:** Clicking a single-select option (likert, forced choice, binary, single SJT) automatically transitions to the next question with a brief slide animation
- **Continue button:** Multi-step formats (free text, ranking, multi-rank SJT) show an explicit Continue button
- **Back button:** Top-right, subtle, allows going back one question
- **Progress bar:** 2px height, full-width below header. Shows proportional progress. No question count, no percentage — just a visual indicator
- **Section label:** Shows the assessment name (NOT the competency being measured — avoids priming)
- **Auto-save:** Responses saved immediately (Zone 1). Footer shows "Responses saved automatically" with a gentle pulsing dot
- **No question numbers:** Never show "Question X of Y"

### Likert Layout

- **Desktop (≥768px):** Horizontal row of options — each option is a tap target showing the word label (Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree). No numbers.
- **Mobile (<768px):** Vertical stack of options, full-width tap targets

### Response Format Adaptations

All share the same card container, header, progress bar, and back button.

| Format | Layout | Auto-advance? |
|--------|--------|---------------|
| Likert | Horizontal (desktop) / vertical (mobile) radio buttons | Yes |
| Forced Choice | Two statement cards with "or" divider | Yes |
| Binary | Two large tap targets (Yes/No) | Yes |
| Free Text | Textarea with character guidance | No (Continue) |
| Ranking | Drag-to-reorder list with position numbers | No (Continue) |
| SJT | Scenario block + lettered response options | Yes (single) / No (rank) |

### Client Branding Integration

When an organization has a brand config:
1. Load org `brand_config` on runner initialization
2. Generate CSS tokens from config
3. Inject as `<style>` tag with CSS custom properties
4. Logo swaps to org logo
5. Primary color swaps to org primary (buttons, selection states, progress bar, section label)
6. "Powered by TalentFit" appears in footer

When no org brand: TalentFit defaults apply.

### Dark/Light Mode

- Default: light (candidates shouldn't need to configure this)
- Respects system preference if `darkModeEnabled` is true in brand config
- Dark mode uses border-driven cards instead of shadow-driven

### Mobile Responsive

- Card max-width: 540px on desktop, full-width minus padding on mobile
- Likert: horizontal → vertical at 768px breakpoint
- Touch targets: minimum 44px height for all interactive elements
- Progress bar and header remain fixed

## Future Work (Architecture-Ready)

These surfaces are NOT in scope for initial implementation but the token pipeline supports them:

### Candidate Reports (Web + PDF)
- HTML report pages with interactive charts (web-first)
- PDF export matching the web layout
- Brand tokens applied: cover header gradient, accent colors on charts, logo placement
- Both TalentFit branded and client co-branded variants

### Email Templates
- Invitation emails, reminder emails, completion notifications
- Brand tokens generate inline CSS (email clients don't support CSS variables)
- TalentFit header + optional client co-branding

*Note: Welcome and completion screens are restyled in SP3 (they already exist at `/assess/[token]/welcome` and `/assess/[token]/complete`). They are NOT future work.*

## Key Files to Create/Modify

### New Files
- `src/lib/brand/types.ts` — BrandConfig type + Zod schema
- `src/lib/brand/tokens.ts` — Token generation pipeline (CSS, PDF, email)
- `src/lib/brand/defaults.ts` — TalentFit default brand config
- `src/lib/brand/fonts.ts` — Curated font list and loader
- `src/app/(dashboard)/settings/brand/page.tsx` — Admin brand editor
- `src/app/(dashboard)/organizations/[slug]/branding/page.tsx` — Client brand editor
- `src/app/actions/brand.ts` — Brand CRUD server actions
- `src/lib/validations/brand.ts` — Zod validation schemas
- `src/components/brand-editor/` — Editor UI components (color picker, font selector, preview gallery, etc.)
- `supabase/migrations/XXXXX_brand_configs.sql` — Database migration

### Modified Files
- `src/app/assess/layout.tsx` — Inject brand CSS tokens
- `src/components/assess/section-wrapper.tsx` — Card-centered redesign
- `src/components/assess/formats/*.tsx` — All 6 response format components redesigned
- `src/components/assess/progress-bar.tsx` — Redesign to thin bar
- `src/app/actions/assess.ts` — Load brand config on runner init
- `src/types/database.ts` — Add BrandConfig, extend Organization type
- `src/app/globals.css` — Add brand token CSS custom properties

### Existing Utilities to Reuse
- `src/lib/utils.ts` — `cn()` for class merging
- `src/hooks/use-unsaved-changes.ts` — Unsaved changes warning
- `src/hooks/use-auto-save.ts` — Pattern reference (though brand editor is Zone 2)
- `src/components/ui/card.tsx` — Card component with variants
- `src/components/ui/button.tsx` — Button with CVA variants
- `src/components/auto-save-indicator.tsx` — Reference for save state UI pattern

## Implementation Sequence

1. **Sub-project 1: Brand Token Foundation** — Types, token generation, DB migration, seed data
2. **Sub-project 2: Brand Editor UI** — Admin editor, client editor, preview gallery
3. **Sub-project 3: Assessment Runner Redesign** — Card layout, all formats, brand integration, responsive

Each sub-project gets its own implementation plan and review cycle.

## Verification

### Sub-project 1
- Token generation unit tests: hex input → correct OKLCH scale output
- DB migration applies cleanly via `npm run db:push`
- Seed data creates TalentFit default brand config
- Type safety: BrandConfig validates with Zod

### Sub-project 2
- Brand editor loads at `/settings/brand`
- All controls functional: color picker, font selector, shape, surface
- Preview gallery updates in real-time on control changes
- Save persists to DB, reload shows saved values
- Client editor at `/organizations/[slug]/branding` shows simplified view
- Light/Dark/Mobile preview toggle works
- Unsaved changes warning triggers on navigate-away

### Sub-project 3
- Assessment runner renders card-centered layout
- Likert: horizontal on desktop, vertical on mobile
- Auto-advance works for single-select formats
- Continue button appears for multi-step formats
- Back button navigates to previous question
- Progress bar shows proportional progress (no numbers)
- Client branding loads when org has brand config
- Dark mode respects system preference when enabled
- All 6 formats render correctly
- Touch targets ≥ 44px on mobile
