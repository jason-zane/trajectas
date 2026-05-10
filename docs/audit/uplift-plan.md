# Trajectas — Design Uplift Plan (A+ target)

Generated: 2026-04-18
Based on: audit findings (`findings-client-portal.md`, `findings-participant.md`, `findings-deep-dives.md`, `priorities-v2.md`) + your direction (quietly confident · premium · editorial-meets-consumer · Apple-physics motion · light mode only) + the Trajectas marketing site's existing brand system as reference.

---

## Status — 2026-04-20

**P0 — complete.** Brand tokens, dark-mode removal (#33), typography system, branded error boundaries (#20), reduced-motion override all shipped.

**P1 — complete.** Dashboard rebuild (#21, #24), campaign detail polish (#25), participant progress (#26), data tables uplift (#16, #17, #22), empty-state primitive (#18), alert variants (#19), motion language (absorbed into the above — `ease-spring` now applied across 34 files). Participant editorial typography (#27, #34) closed the assess-flow tail.

**Client portal close-out (this session).**
- Lane 4 housekeeping — stub routes + `ScrollArea` deletion (#37)
- DD-P-01 — branded misconfig errors in assess flow (#38)
- DD-BE-01 — brand-capability revalidation (#39)
- DD-FE-01 — FlowEditor page-card keyboard a11y (#40)

Spot-check of the client portal confirmed zero `<div onClick>` anti-patterns and zero `dark:` variant leftovers in `/client` or `/components`.

**P2 — in scope next.** Admin + partner baseline sweep (tokens/typography/tables/empty-states/alerts/errors). Bespoke admin-only surfaces (dashboard, library, psychometrics, diagnostics, generate) deferred to later initiatives.

---

## Discovery — the brand is already defined

The marketing site (`src/app/(marketing)/`) isn't just "a landing page" — it's a finished brand expression that the app hasn't adopted yet. The uplift is mostly about **bringing the app up to what the marketing already promises**, not inventing something new.

### Current marketing brand tokens (from `globals-marketing.css`)

```
--mk-primary:       #2d6a5a   (forest emerald)
--mk-primary-dark:  #1e4a3e   (deep emerald — hero bg)
--mk-accent:        #c9a962   (warm gold)
--mk-bg:            #f8f6f1   (warm cream — not pure white, important)
--mk-text:          #1a1a1a   (near-black)
--mk-text-muted:    #6b6b6b   (graphite grey)
```

### Current marketing typography

- **Display**: Plus Jakarta Sans 800, `clamp(2.75rem, 5.5vw, 4.5rem)`, `line-height 1.1`, tracking `-0.03em`
- **Headline**: same family 700, `clamp(1.75rem, 3vw, 2.25rem)`, tracking `-0.01em`
- **Eyebrow**: same family 600, `0.6875rem`, tracking `0.18em`, uppercase, in accent gold
- **Body**: 1rem, `line-height 1.7`
- **Mono label**: JetBrains Mono 300–400, `0.6875rem`, tracking `0.08em` (the "01 / 02 / 03" numbering style)

### Current marketing motion sophistication

- Scroll-progress-driven CSS variables (not JS-heavy)
- Character-level reveals (80ms stagger per word on hero)
- Physics-style transforms (`translate3d` + `rotate` + `scale` composed)
- Sticky scroll sections with progress-mapped background morphs
- Full `prefers-reduced-motion: reduce` fallbacks for every animation

**This is Apple-physics-tier motion work. It just isn't in the app yet.**

---

## What I'm locking in (no need to confirm)

Based on your answers + marketing analysis, these decisions are made:

### Brand tokens app-wide

Drop the per-portal primaries (violet/orange/amber). Adopt the marketing palette everywhere:

- **Primary** — emerald `#2d6a5a` with dark variant `#1e4a3e`
- **Accent** — gold `#c9a962`
- **Canvas** — cream `#f8f6f1` (not white — this is what makes it feel editorial)
- **Ink** — near-black `#1a1a1a`
- **Muted** — graphite `#6b6b6b`
- **Portal differentiation** — removed. Portal identity becomes the sidebar label + context switcher, not a primary hue. Client / partner / admin all use the same brand. This simplifies 50+ hardcoded places and kills an entire regression class.
- **Semantic additions** — add proper `warning`, `info`, `success` tokens (amber, blue, green) consistent with the emerald palette. These are functional, not brand colours.

### Typography app-wide

- **Single family**: Plus Jakarta Sans at weights 400 / 600 / 700 / 800 (already loaded)
- **Scale**: port the `mk-*` classes as canonical app tokens (`.type-display`, `.type-headline`, `.type-title`, `.type-body`, `.type-eyebrow`, `.type-caption`, `.type-mono`)
- **Mono font**: JetBrains Mono (already loaded)
- **Swap out Geist Mono** in root layout — inconsistent with marketing's JetBrains choice
- **No new font purchases**. We have what we need.

### Theme

- **Light mode only.** Remove all `dark:` Tailwind variants. Delete `ThemeProvider`, `theme-toggle.tsx`, `force-light-theme.tsx`. Massive simplification.

### Motion language

Adopt the marketing's established motion vocabulary app-wide:

- **Easing**: spring-style `cubic-bezier(0.22, 1, 0.36, 1)` (already defined as `ease-spring` in Tailwind config)
- **Durations**: 150ms (micro), 300ms (standard), 500ms (page-level), 700ms (hero)
- **Transform composition**: `translate3d` + `scale` + `opacity` — GPU-accelerated
- **Stagger pattern**: 60–80ms per item for list reveals
- **Scroll reveals**: IntersectionObserver + `ScrollReveal` component (already built)
- **Reduced-motion**: CSS `@media (prefers-reduced-motion: reduce)` hard override at root

### Accessibility baseline

- WCAG AA compliance minimum (4.5:1 contrast for text)
- AAA where reasonable (7:1 on body text)
- Every interactive element reachable via Tab, activates on Enter/Space
- Focus rings always visible (no `outline: none` without replacement)
- Icon-only buttons always have `aria-label`
- Respect `prefers-reduced-motion` system-wide

### Error state philosophy

Every error surface gets:
1. Branded container (not bare text)
2. Clear explanation of what happened (differentiated by error class)
3. At least one next-step CTA — "Contact admin" becomes `mailto:` from campaign/client config, never dead copy
4. The primitive: `<BrandedError reason={...} contactEmail={...} />` used everywhere

---

## What still needs your sign-off (before P1)

I'll mock these up first, present, iterate, THEN code. Each is 1 lightweight demo, not a full redesign.

1. **Dashboard layout treatment** — I'll show 2 options: (a) current "hero + stat cards + active campaigns" refined, vs (b) editorial-style "this week at a glance" with a dominant metric and supporting context. Pick one.
2. **Metric card hierarchy** — plain number vs number-with-delta vs number-with-sparkline. Which feels "Trajectas"?
3. **Participant-flow progress indicator** — segmented pill vs progress bar vs combined stage-and-question indicator. Pick one.
4. **Page title sizing** — the marketing hero is massive (4.5rem). App pages should be smaller but still confident. I'll show 2–3 scales.

Everything else I decide and call out as I go.

---

## P0 — Foundation (Week 1, ~5 days)

Non-negotiable. Ships before any visible polish so the uplift has a solid base.

### P0-1 — Fix 3 production bugs (1 day)

- `/client/campaigns` buttonVariants server/client error (BUG-1)
- Nested session page never renders (BUG-2)
- Session scores showing "Unknown" (BUG-3)

### P0-2 — Adopt marketing brand tokens app-wide (1 day)

- Replace `--primary`, `--accent`, `--muted`, `--background` in `src/app/globals.css` with marketing palette
- Remove portal-scoped primaries (admin violet, client orange, partner amber blocks)
- Update `--background` to cream (`#f8f6f1`) — this is the biggest visual shift
- Add semantic tokens: `--warning`, `--info`, `--success`
- Ship as one PR so the visual shift is atomic

### P0-3 — Remove dark mode (0.5 day)

- Delete `ThemeProvider`, `theme-toggle.tsx`, `force-light-theme.tsx`
- Strip all `dark:` Tailwind variants from component files
- Remove `<html className="dark">` toggle logic
- Simplify colour tokens (no more `.dark { ... }` block in `globals.css`)

### P0-4 — Port typography system (0.5 day)

- Create `src/app/typography.css` with `.type-display`, `.type-headline`, `.type-title`, `.type-body`, `.type-eyebrow`, `.type-caption`, `.type-mono` classes
- Update `PageHeader` primitive to use the new classes
- Swap `Geist_Mono` for `JetBrains_Mono` in root layout

### P0-5 — Branded error boundaries scaffolding (1 day)

- Create `src/components/errors/branded-error.tsx` with props: `{ title, description, icon, contactEmail, primaryAction, secondaryAction }`
- Add `src/app/client/error.tsx`, `src/app/partner/error.tsx`, `src/app/assess/error.tsx`, `src/app/(dashboard)/error.tsx` (replace existing) — all rendering `<BrandedError />`
- Create variant for `loading.tsx` matching brand (currently generic shimmer; needs cream canvas + brand accent)

### P0-6 — Motion root override for reduced-motion (0.25 day)

- Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### P0-7 — UI standards doc update (0.5 day)

- Update `docs/ui-standards.md` to codify:
  - Brand tokens (new palette)
  - Typography scale (new classes)
  - Motion language (physics, durations)
  - Error-state requirements (branded + CTA)
  - A11y requirements (focus rings, aria-label rules, keyboard)
  - "No `<div onClick>`" rule + rationale

**P0 total: ~4.75 days.** Entire site looks different after P0 (new colours, new canvas, new typography) even before any P1 visual work.

---

## P1 — Visible uplift (Weeks 2–3, ~10 days)

This is where the site moves from "working" to "people talk about it."

### P1-1 — Client dashboard rebuild (2 days)

- New editorial layout, large typography, confident whitespace
- Metric cards upgraded with deltas + sparklines (lightweight inline SVG)
- "Active campaigns" re-treated as a cinematic carousel or large card grid
- Remove the current "What do you need?" card — replace with a single clear primary action
- Mobile layout rebuilt properly from scratch (fixes the current mobile breakage as a side-effect)

### P1-2 — Campaign detail shell polish (1.5 days)

- Fix tab-highlight sync for nested routes
- New treatment of campaign header (title gets room to breathe, Active status badge goes gold, breadcrumbs refined)
- Remove the muted title/subtitle issue (was a dark-mode artefact — gone with dark mode)
- Standardise detail-page spacing rhythm

### P1-3 — Participant flow: progress indicator + error recovery (2 days)

- Persistent segmented progress bar at top of every `/assess/` stage
- "Question 5 · Section 1 of 1 · About 4 min left" footer label
- Respects `campaign.showProgress` for question granularity; always shows stage count
- Branded error surface for section-start failures (differentiated copy per error class)
- `mailto:` CTA on `/assess/expired` with fallback

### P1-4 — Data table visual uplift (1.5 days)

- Row hover: subtle `color-mix(in oklch, var(--primary) 3%, var(--background))` background
- Subtle zebra striping (very light — 2% tint alternating)
- Column weighting: primary column bold, secondary muted, metadata smaller
- Pagination + pageSize controls restyled
- Apply to: participants table, campaigns table, assessments table, reports table (4 tables = pattern consistency)

### P1-5 — Empty state pattern (1 day)

- Create `<EmptyState>` primitive: icon (lucide), title, description, optional CTA
- Replace ~12 ad-hoc empty states across the client portal
- Raise contrast on all "Nothing here yet" text
- Visual consistency across every empty state

### P1-6 — Alert variants + banner pattern (1 day)

- Extend `alertVariants` cva in `ui/alert.tsx` with `warning`, `info`, `success`
- Migrate ~12 hand-rolled warning banners to `<Alert variant="warning">`
- The "No assessments attached" campaign overview banner becomes the canonical warning example

### P1-7 — Motion language rollout (1 day)

- Audit every component that animates; align easing/duration with the new system
- Add hover transitions to cards (subtle depth change, 200ms)
- Add press-down feedback to buttons (`scale(0.97)` on active — already in Button primitive, verify applied)
- Page transitions: soft fade + 8px Y-translate on route change (matches marketing hero)
- Stagger list reveals: 60–80ms per item

---

## P2 — Refinement (Weeks 4–5, ~10 days)

### P2-1 — Admin portal uplift (2 days)

Same brand tokens, same patterns, same data table treatment, same empty states. Mostly repetition once P1 is locked.

### P2-2 — Partner portal uplift (1.5 days)

Same story, smaller surface.

### P2-3 — Keyboard + focus sweep (2 days)

- FlowEditor page card → proper button
- Audit every `<div onClick>` across the codebase (estimated 10–20 instances based on the one we found)
- Verify `focus-visible:` present on every interactive primitive
- Manual keyboard walkthrough of dashboard, campaigns, participants, assess flow

### P2-4 — Cache invalidation + workflow fixes (0.5 day)

- Brand capability cache fix (DD-BE-01)
- Campaign session nested route proper fix (BUG-2 detail)

### P2-5 — Perf baseline + audit (1 day)

- Lighthouse on 5 key routes
- Bundle size snapshot
- Motion perf (FPS) verification on stat cards + flow editor
- Document perf budget going forward

### P2-6 — Primitive cleanup (1 day)

- Migrate Card to cva (P-011)
- Extract Combobox primitive + migrate 5 Popover callsites (P-012)
- Delete ScrollArea (P-006) or adopt in 2 places
- Delete client-portal stub routes (P-010)

### P2-7 — Content + polish pass (1 day)

- Sub-minute duration formatter
- Long email truncate-with-tooltip
- Singular/plural helper + fix "1 seconds"
- Date picker primitive to replace browser-native
- Breadcrumb rollout to top-level portal pages (dashboard, participants list, assessments list)

### P2-8 — Custom date picker + select components (1 day)

- Date picker built on `react-day-picker` (already in deps probably), themed to brand
- Custom select to replace native `<select>` on demographics page + filters — better UX, searchable where useful

---

## Effort summary

| Phase | Duration | Effect |
|-------|----------|--------|
| P0 | ~5 days | Foundation: new brand, dark mode gone, error states branded, type system live. **Site looks meaningfully different.** |
| P1 | ~10 days | Visible uplift: client dashboard rebuilt, participant progress live, tables feel scannable, empty states elevated. **This is where "A+" becomes visible.** |
| P2 | ~10 days | Refinement: admin + partner lifted, a11y swept, perf baselined, primitives cleaned. **Consistency across the app.** |
| **Total** | **~25 days** | **~5 working weeks, single-engineer pace.** |

## What I'm NOT doing in this plan

- New features (audit is remediation + uplift only)
- Marketing site changes (already where it needs to be; don't touch)
- Multi-language / i18n
- New integrations
- New report templates / new block types
- Migration to a different framework / UI lib

---

## My working approach during execution

- **One PR per P-item.** 25 focused PRs vs one giant 25-day branch. Reviewable, revertible, atomic.
- **Visual diff per PR.** Before/after screenshot in every PR description so you can see the uplift.
- **Ship P0 before any P1 visible work.** Tokens + errors + types first. Nothing in P1 depends on design decisions you haven't made yet.
- **Mockup your sign-off points before coding.** Items P1-1, P1-3 have "pick one" decisions — I'll show options first.
- **Commit the new UI standards as PR gates.** Once codified, every subsequent PR has to pass the standards checklist.

## Open decisions I still want from you

You said Q5–Q10 I could default. Two I'd like confirmation on anyway because they change the mocks:

1. **Editorial-dashboard vs refined-current-dashboard** (P1-1): editorial means bigger typography, less dense, one dominant "what matters this week" visual. Current-refined means the grid-of-stat-cards pattern but elevated. Editorial is braver, current-refined is safer. Either works.
2. **Metric card with sparkline/delta or plain number** (P1-1): sparklines read "data product", plain numbers read "dashboard". Which matches your product vision?

If you answer those two, I can start on P0 today and have mockups for you within a day.

---

## Files to update after each phase

- `docs/ui-standards.md` — live doc, revised per phase
- `docs/audit/uplift-plan.md` (this doc) — append completion status per PR
- `CHANGELOG.md` — user-visible changes (worth starting if not existing)

## Risk register

| Risk | Mitigation |
|------|------------|
| Scope creep during P1 (temptation to add features) | Strict "remediation + brand only" rule; new-feature asks go to a separate backlog |
| Changing brand tokens breaks hardcoded colours in reports / emails | Grep sweep at start of P0-2; migrate brand usages to tokens as part of the same PR |
| Dark mode removal breaks user preferences | It was never exposed as a user choice on the authenticated portals meaningfully; safe |
| Plus Jakarta Sans looks different at new sizes | Pre-ship typography demo in a sandbox page; iterate before rolling out app-wide |
| Motion changes feel laggy on lower-end devices | CSS-driven (not JS); GPU-accelerated transforms; already fine on marketing site |
