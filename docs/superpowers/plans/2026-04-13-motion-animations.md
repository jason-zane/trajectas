# Motion / Framer Motion Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-rolled CSS animation primitives with Framer Motion (now `motion`) to unlock exit animations, layout animations, shared element transitions, and spring physics throughout the platform.

**Architecture:** Install `motion` (v12+, the renamed Framer Motion package). Migrate `TiltCard`, `ScrollReveal`, and `page-transition.tsx` to motion primitives. Add `<AnimatePresence>` wrappers to dialogs, sheets, toasts (where not handled by Sonner), and list items. Apply `layout` prop to reorderable lists in the assessment builder and drag-and-drop surfaces.

**Tech stack:** `motion` (Framer Motion v12)

**Key reference files:**
- Current hand-rolled animation components: `src/components/tilt-card.tsx`, `src/components/scroll-reveal.tsx`, `src/components/page-transition.tsx`
- Dialog usage: search `<Dialog` across `src/`
- DnD surfaces: `src/components/flow-editor/flow-editor.tsx`, assessment builder drag lists
- List animations: `src/app/(dashboard)/factors/factor-list.tsx` (gold standard for staggered entrance)

---

## Implementation Steps

### Phase 1 — Install and configure

- [ ] Install `motion` package: `npm install motion`
- [ ] Verify `motion` exports `AnimatePresence`, `motion`, `LayoutGroup`, `useMotionValue`, `useSpring` — check the package docs (`node_modules/motion/`) before writing any code
- [ ] Add `"use client"` guard pattern: confirm motion components only import in client components (never in Server Components directly)

### Phase 2 — Replace hand-rolled primitives

- [ ] Rewrite `src/components/tilt-card.tsx` using `motion.div` with `useMotionValue` and `useSpring` for x/y tilt — remove CSS transform inline styles
- [ ] Rewrite `src/components/scroll-reveal.tsx` using `motion.div` with `initial`, `whileInView`, `viewport={{ once: true }}` — remove IntersectionObserver logic
- [ ] Replace `src/components/page-transition.tsx` (currently just a CSS class) with a `motion.div` wrapper component that applies enter/exit transitions; use `AnimatePresence` in the root layout

### Phase 3 — Dialog and sheet exit animations

- [ ] Identify all `<Dialog`, `<Sheet`, `<Drawer` usage sites via Grep
- [ ] Wrap dialog content roots in `motion.div` with `initial={{ opacity: 0, scale: 0.95 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.95 }}`
- [ ] Add `<AnimatePresence>` to the open/close boolean in each dialog controller (base-ui Dialog uses a `render` prop or open state — check base-ui docs before implementation)
- [ ] Test that backdrop also fades out on close

### Phase 4 — List / reorder animations

- [ ] Add `layout` prop to assessment builder item list items so reordering morphs positions rather than cutting
- [ ] Add `layout` to campaign section reorder list
- [ ] Add `layout` and `AnimatePresence` to the report builder block list so adding/removing blocks animates
- [ ] Wrap staggered card grids in `<AnimatePresence>` where items can be deleted (e.g., participant list, item bank)

### Phase 5 — Shared element transitions

- [ ] Identify expand-to-detail patterns: participant card → detail view, session row → session detail
- [ ] Apply `layoutId` to the card surface and the expanded view so motion morphs between them
- [ ] Use `LayoutGroup` wrapper at the page level to scope layout animations

### Phase 6 — Respect prefers-reduced-motion

- [ ] Create `src/lib/motion.ts` that exports `shouldReduceMotion` (using `window.matchMedia('(prefers-reduced-motion: reduce)')`)
- [ ] In all motion components, pass `transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}` or use `useReducedMotion()` hook from motion

### Phase 7 — Cleanup

- [ ] Remove unused CSS keyframe definitions from `src/app/globals.css` that were powering the replaced animations (`stagger-N`, `animate-fade-in-up`)
- [ ] Confirm `TiltCard` and `ScrollReveal` import paths are updated everywhere via Grep

---

## Acceptance criteria

- Dialogs and sheets animate in AND out (no hard disappear on close)
- Drag-and-drop reorder in assessment builder shows smooth position morphing
- ScrollReveal entrance still staggers correctly
- TiltCard still provides perspective tilt on hover
- No animation plays when `prefers-reduced-motion: reduce` is set
- No Server Component import errors (motion is client-only)
