# Dark Mode Audit & Scope Lockdown — Design Spec

**Date:** 2026-04-17
**Status:** Approved — awaiting spec review
**Related:** `feat/report-template-polish` branch (must merge first)

## Problem

Dark mode currently applies across most of the app — every surface inside `(dashboard)`, `/partner/*`, and `/client/*`. The assessment runner (`/assess/*`) is already forced-light via `ForceLightTheme` (commit `8c1caec`).

Two issues:

1. Dark mode has not been consistently designed or audited across surfaces. Parts of the app look poor in dark mode on mobile.
2. Report review surfaces currently follow system theme, but reports are effectively print-adjacent artefacts — they are designed in light and should be reviewed in light, regardless of user preference.

## Goals

1. Lock specific surfaces to light mode (reports, report builder, brand editors, results-viewing surfaces).
2. Audit all remaining dark-capable surfaces for visual quality issues; produce a prioritised fix list.
3. Remove dead dark-token generation code on the assessment runner (forced-light since `8c1caec` but still emits unused `darkCss`).

## Non-Goals

- Redesigning the overall dark palette (CSS tokens in `globals.css` `.dark` block stay as-is).
- Removing the `brandConfig.darkModeEnabled` flag entirely — left in place for potential future use; brand editors' toggle continues to render.
- Visual regression snapshot testing as a CI gate.
- Marketing site, auth/login, print routes — out of scope, already correct.

## Scope

### Forced-light surfaces (whole-route lock)

| Area | Route(s) | New layout file |
|---|---|---|
| Dashboard report viewer | `/reports`, `/reports/[snapshotId]` | `src/app/(dashboard)/reports/layout.tsx` |
| Report template builder | `/report-templates/[id]/builder` | `src/app/(dashboard)/report-templates/[id]/builder/layout.tsx` |
| Report template preview | `/report-templates/[id]/preview` | `src/app/(dashboard)/report-templates/[id]/preview/layout.tsx` |
| Platform brand editor | `/settings/brand` | `src/app/(dashboard)/settings/brand/layout.tsx` |
| Client brand editor | `/clients/[slug]/branding` | `src/app/(dashboard)/clients/[slug]/branding/layout.tsx` |
| Partner brand editor | `/partners/[slug]/branding` | `src/app/(dashboard)/partners/[slug]/branding/layout.tsx` |
| Campaign overview (admin) | `/campaigns/[id]/overview` | `src/app/(dashboard)/campaigns/[id]/overview/layout.tsx` |
| Participant detail (admin) | `/participants/[id]` | `src/app/(dashboard)/participants/[id]/layout.tsx` |
| Partner template preview | `/partner/report-templates/[id]/preview` | `src/app/partner/report-templates/[id]/preview/layout.tsx` |
| Partner campaign overview | `/partner/campaigns/[id]/overview` | `src/app/partner/campaigns/[id]/overview/layout.tsx` |
| Partner participant detail | `/partner/participants/[id]` | `src/app/partner/participants/[id]/layout.tsx` |
| Partner reports viewer | `/partner/reports/[snapshotId]` (if exists) | `src/app/partner/reports/layout.tsx` |
| Client campaign overview | `/client/campaigns/[id]/overview` | `src/app/client/campaigns/[id]/overview/layout.tsx` |
| Client participant detail | `/client/participants/[id]` (if exists) | `src/app/client/participants/[id]/layout.tsx` |
| Client reports viewer | `/client/reports/[snapshotId]` (if exists) | `src/app/client/reports/layout.tsx` |

Presence of partner/client mirrors confirmed at implementation time — missing routes are skipped.

### Assessment runner cleanup (no force-light change)

`ForceLightTheme` stays. Remove dead dark-token generation:

- `src/app/assess/layout.tsx` — remove `darkCss` from `getCachedEffectiveBrand()` path
- `src/app/assess/[token]/report/page.tsx` — remove `generateDarkCSSTokens` call, remove `safeCSS = lightCss + darkCss` composition (use lightCss only)
- `src/app/assess/[token]/report/export/page.tsx` — same as above
- `src/app/assess/[token]/demographics/page.tsx` — same
- `src/app/assess/join/[linkToken]/page.tsx` — same

### Dark-capable surfaces (stay as-is; audited)

- Dashboard home, entity lists (dimensions, constructs, factors, items, participants, clients, partners, users)
- Assessments list + canvas (non-overview tabs)
- Campaigns list + tabs other than overview
- Settings pages other than `/settings/brand`
- Chat, Generate, Diagnostics, Psychometrics
- Directory
- Auth (login/logout/unauthorized)
- Partner + client mirrors of the above (non-forced-light routes)

### Out of scope

- `/print/*` routes (always light by construction; receive a defensive `<ForceLightTheme />` as a belt-and-braces precaution)
- `/(marketing)/*` (own stylesheet, already light-only)

## Design

### Architecture

**Primitive.** Rename `src/components/assess/force-light-theme.tsx` → `src/components/force-light-theme.tsx`. Update the one existing import in `src/app/assess/layout.tsx`. Behaviour unchanged: `useEffect` on mount removes `dark` class from `<html>` and sets `colorScheme: "light"`; restores on unmount.

**Application pattern.** Each forced-light sub-tree gets a minimal `layout.tsx`:

```tsx
import { ForceLightTheme } from "@/components/force-light-theme";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  );
}
```

No wrapping div. No style changes. The component is the whole mechanism.

**SSR flash.** Initial server render emits the app in whatever class next-themes SSR resolves; on client hydration, the `dark` class is stripped before first paint via `useEffect`. A brief dark flash is possible for users on dark system theme. Same behaviour ships in `/assess/*` today; if noticeable in practice, mitigate with a pre-hydration inline script — deferred until observed.

**Client-component rules.** `ForceLightTheme` is `"use client"`. Importing it from a server `layout.tsx` is standard Next.js interop.

### Audit methodology

Manual Playwright walkthrough of dark-capable surfaces. For each route:

1. Set theme to dark via theme toggle.
2. Capture desktop screenshot (1280w).
3. Capture mobile screenshot (iPhone 14 viewport, 390×844).
4. Catalogue findings to `docs/superpowers/specs/dark-mode-audit-findings.md`.

Each finding is one row: `route | issue | severity (broken/ugly/minor) | proposed fix | screenshot path`.

Inspect popovers (command palette, theme toggle, filters, notifications), dialogs (confirm delete, bulk-import, create template), and interactive states (hover, focus, active) — not just idle page.

Findings document gets committed. Fixes are applied in priority order as part of this branch's implementation plan.

### Coordination with `feat/report-template-polish`

Both streams edit the same file: `src/app/(dashboard)/report-templates/[id]/preview/page.tsx` (polish rebuilds the preview shell; this work adds a sibling `layout.tsx`). No merge conflict — different files.

**Sequencing:** polish merges first. This work branches from updated `main` and layers on.

### Dead-code cleanup — assessment runner

Five files currently call `generateDarkCSSTokens(brandConfig)` conditionally on `brandConfig.darkModeEnabled`, then concatenate `lightCss + darkCss` into the emitted `<style>` block. Since `ForceLightTheme` strips the `dark` class on mount, the dark tokens can never apply. Remove the generation and concatenation; emit `lightCss` only.

`brandConfig.darkModeEnabled` flag itself stays — brand editors still surface the toggle (interpretation: "dark mode styling stored for future re-enablement"). Removal of the flag is a separate follow-up decision.

### Defensive force-light on `/print/*`

`/print/*` routes live outside `(dashboard)`, so don't currently inherit the root `ThemeProvider` in any way that would make them dark. Add `<ForceLightTheme />` to any existing print layout (or each print page that lacks one) as a belt-and-braces safeguard. Zero runtime cost.

## Testing

### Unit tests

- `tests/unit/force-light-theme.test.ts` — mount with `<html class="dark">`, assert class removed; unmount, assert class restored.

### Static checks

`npm run typecheck && npx vitest run && npm run lint` after each batch of layout additions. Expected: all green, no behavioural changes beyond force-light.

### Manual acceptance — desktop + mobile in dark mode

For each forced-light route:
1. Set theme to dark.
2. Navigate into route.
3. Confirm no `dark` class on `<html>`.
4. Confirm page renders with light tokens.
5. Navigate out — confirm dark returns without reload.

Route list:
- `/reports/[snapshotId]` with a released snapshot
- `/report-templates/[id]/preview` (post-polish-merge)
- `/report-templates/[id]/builder`
- `/settings/brand`, `/clients/[slug]/branding`, `/partners/[slug]/branding`
- `/campaigns/[id]/overview`
- `/participants/[id]`
- Partner + client mirrors where they exist
- `/assess/[token]/report` — regression check (still force-light after dead-code removal)

## Risks

| Risk | Mitigation |
|---|---|
| Flash of dark before `useEffect` strips class | Matches current `/assess/*` behaviour; add pre-hydration script only if noticeable |
| Missed forced-light surfaces | Audit pass surfaces them; add layouts defensively as findings come in |
| Force-light layout placed above `(dashboard)` layout, losing nav | Integration-test each route renders expected chrome |
| Brand-editor dark toggle now misleading | Leave toggle; document in editor help-text or address in follow-up |
| `feat/report-template-polish` merge conflict | Sequencing policy: this branch starts after polish merges |
| Dead-code removal breaks a brand relying on dark tokens | Verified: dark class never set on `/assess/*`; dark tokens unreachable |

## File Plan

### New files

| File | Purpose |
|---|---|
| `src/components/force-light-theme.tsx` | Relocated from `src/components/assess/force-light-theme.tsx` |
| Layout files per Scope table above | Per-route force-light application |
| `tests/unit/force-light-theme.test.ts` | Unit test for the primitive |
| `docs/superpowers/specs/dark-mode-audit-findings.md` | Audit output (populated during implementation) |

### Modified files

| File | Change |
|---|---|
| `src/app/assess/layout.tsx` | Update import to new path; remove `generateDarkCSSTokens` call (line 36 region) |
| `src/app/assess/[token]/report/page.tsx` | Remove `generateDarkCSSTokens` import + call; emit `lightCss` only |
| `src/app/assess/[token]/report/export/page.tsx` | Same as above |
| `src/app/assess/[token]/demographics/page.tsx` | Same as above |
| `src/app/assess/join/[linkToken]/page.tsx` | Same as above |
| `/print/*` existing layouts | Add `<ForceLightTheme />` defensively |

### Deleted files

| File | Reason |
|---|---|
| `src/components/assess/force-light-theme.tsx` | Moved up a level |

## Open Questions

None remaining — all scope and approach decisions confirmed in brainstorming.
