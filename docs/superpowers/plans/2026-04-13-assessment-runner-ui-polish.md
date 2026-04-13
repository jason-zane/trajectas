# Assessment Runner UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the visual quality of all assessment runner screens to feel premium and intentional, with consistent spacing, typography, card treatment, and a clean crossfade transition between questions.

**Architecture:** Pure UI changes across 9 existing components — no DB migrations, no new files, no API changes. Changes are applied consistently: bigger headings, `space-y-8` rhythm, left-border accent on content cards, checkmark bullets, ambient glow on item card, and a crossfade transition replacing the jitter slide.

**Tech Stack:** React, Tailwind CSS, lucide-react, CSS custom properties (`--brand-*` tokens)

---

## File Structure

All changes are modifications to existing files — no new files created.

| File | Changes |
|------|---------|
| `src/components/assess/section-wrapper.tsx` | Replace slide animation with crossfade; increase eyebrow spacing |
| `src/components/assess/item-card.tsx` | Fixed stem `min-h`; ambient card glow |
| `src/components/assess/welcome-screen.tsx` | Bigger heading; `space-y-8`; info card left-border accent; checkmark bullets |
| `src/components/assess/join-form.tsx` | Bigger heading; `space-y-8`; form card left-border accent + `sm:p-8` |
| `src/components/assess/demographics-form.tsx` | Bigger heading; `space-y-8`; form card left-border accent + `sm:p-8` |
| `src/components/assess/consent-screen.tsx` | Bigger heading; `space-y-8`; content card left-border accent; checkmark bullets in body renderer |
| `src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx` | Bigger heading; `space-y-8`; wrap body prose in left-border accent card |
| `src/components/assess/review-screen.tsx` | Replace `ml-6` sub-rows with `pl-4 border-l-2` hierarchical treatment |
| `src/components/assess/complete-screen.tsx` | Bigger icon circle (`size-24`); swap raw Link for `<Button>` component |

---

## Task 1: Crossfade transition + eyebrow spacing (section-wrapper.tsx)

**Files:**
- Modify: `src/components/assess/section-wrapper.tsx`

### What to change

The current animation uses `translate-x-[+-8px] opacity-0` with `transition-all duration-200`. Replace with a pure opacity fade. The `slideDirection` state is now dead — remove it. The `navigateToItem` function keeps its `direction` parameter (called from both forward and back nav) but stops using it in the animation.

Also increase eyebrow label spacing: `mb-4` -> `mb-8`.

- [ ] **Step 1: Remove `slideDirection` state**

Delete this line from the state declarations:
```
const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
```

In `navigateToItem`, remove the `setSlideDirection(direction)` call and add `void direction;` to suppress the unused-param lint warning.

- [ ] **Step 2: Update the animation wrapper div**

Find the div with `transition-all duration-200 ease-out` wrapping `<ItemCard>`. Replace its className with:

```
transition-opacity duration-150 ease-out motion-reduce:transition-none motion-reduce:!opacity-100 {isAnimating ? "opacity-0" : "opacity-100"}
```

- [ ] **Step 3: Update eyebrow label spacing**

Change `mb-4` to `mb-8` on the assessment name `<p>` label above the item card.

- [ ] **Step 4: Verify visually**

Run dev server (`pnpm dev`). Navigate to any assessment section. Click a response option that auto-advances — confirm items crossfade without lateral movement. Click Back — same behaviour. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/section-wrapper.tsx
git commit -m "feat(runner): replace slide animation with crossfade, increase eyebrow spacing"
```

---

## Task 2: Item card — fixed stem height + ambient glow (item-card.tsx)

**Files:**
- Modify: `src/components/assess/item-card.tsx`

### What to change

1. **Stem min-height**: `text-xl` with `leading-relaxed` is ~2rem per line. Add `min-h-[4rem]` to the stem `<p>` so 1-line and 2-line questions render the same card height.

2. **Ambient glow**: Replace the `shadow-sm dark:shadow-none` Tailwind class on the card div with an arbitrary shadow that glows in the brand primary colour at low opacity. Use `color-mix()` for opacity control. Dark mode suppresses via `dark:shadow-none`.

- [ ] **Step 1: Add min-h to stem**

Find the question stem `<p>` tag (has `mb-6 text-lg leading-relaxed sm:text-xl`). Add `min-h-[4rem]` to its className.

- [ ] **Step 2: Update card shadow**

On the outer card `<div>`, replace `shadow-sm dark:shadow-none` with:
```
shadow-[0_0_40px_-8px_color-mix(in_srgb,var(--brand-primary,hsl(var(--primary)))_15%,transparent)] dark:shadow-none
```

- [ ] **Step 3: Verify visually**

Run dev server. Step through questions with short (1-line) and long (2-line) stems. Confirm card height stays consistent. Confirm subtle glow in light mode, no glow in dark mode.

- [ ] **Step 4: Commit**

```bash
git add src/components/assess/item-card.tsx
git commit -m "feat(runner): fix item stem min-height and add ambient card glow"
```

---

## Task 3: Welcome screen polish (welcome-screen.tsx)

**Files:**
- Modify: `src/components/assess/welcome-screen.tsx`

### What to change

1. Content stack: `space-y-6` -> `space-y-8`
2. Heading: `text-2xl sm:text-3xl` -> `text-3xl sm:text-4xl`
3. Info card: add `border-l-[3px]` to className; add `borderLeftColor: "var(--brand-primary, hsl(var(--primary)))"` to inline style
4. `InfoBullet` component: replace dot `<span>` with `Check` icon from lucide

- [ ] **Step 1: Add Check to lucide import**

```tsx
import { ArrowRight, RotateCcw, Check } from "lucide-react";
```

- [ ] **Step 2: Update content wrapper, heading, and info card**

Content wrapper: `space-y-6` -> `space-y-8`

Heading className: `text-2xl font-semibold tracking-tight sm:text-3xl` -> `text-3xl font-semibold tracking-tight sm:text-4xl`

Info card className: add `border-l-[3px]` (keep existing `rounded-2xl border p-6 shadow-sm dark:shadow-none`)

Info card style: add `borderLeftColor: "var(--brand-primary, hsl(var(--primary)))"` alongside the existing borderColor.

- [ ] **Step 3: Update InfoBullet**

Replace the dot span:
```tsx
<span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-primary, hsl(var(--primary)))" }} />
```

With a Check icon:
```tsx
<Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--brand-primary, hsl(var(--primary)))" }} />
```

- [ ] **Step 4: Verify visually**

Check the welcome screen. Confirm: bigger heading, more spacing, left border accent on info card, checkmark bullets.

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/welcome-screen.tsx
git commit -m "feat(runner): polish welcome screen — heading, spacing, card accent, checkmark bullets"
```

---

## Task 4: Registration screens (join-form, demographics-form, consent-screen)

**Files:**
- Modify: `src/components/assess/join-form.tsx`
- Modify: `src/components/assess/demographics-form.tsx`
- Modify: `src/components/assess/consent-screen.tsx`

### join-form.tsx changes

1. Content stack: `space-y-6` -> `space-y-8`
2. Heading: `text-2xl` -> `text-3xl sm:text-4xl` (remove the `sm:` prefix on the base, both get bumped)
3. Form card className: add `border-l-[3px] sm:p-8`
4. Form card style: add `borderLeftColor: "var(--brand-primary, hsl(var(--primary)))"`

### demographics-form.tsx changes

Same four changes as join-form. Note: demographics has `text-2xl font-semibold tracking-tight sm:text-3xl` — bump to `text-3xl font-semibold tracking-tight sm:text-4xl`.

### consent-screen.tsx changes

1. Content stack: `space-y-6` -> `space-y-8`
2. Heading: `text-2xl sm:text-3xl` -> `text-3xl sm:text-4xl`
3. Body card className: add `border-l-[3px] sm:p-8`
4. Body card style: add `borderLeftColor: "var(--brand-primary, hsl(var(--primary)))"`
5. Bullet renderer inside body content: replace the dot `<span>` with `<Check>` icon (same pattern as InfoBullet above — add `Check` to lucide import first)

- [ ] **Step 1: Update join-form.tsx** (4 changes above)

- [ ] **Step 2: Update demographics-form.tsx** (4 changes above)

- [ ] **Step 3: Update consent-screen.tsx** (5 changes above, add Check import)

- [ ] **Step 4: Verify visually**

Check each screen. Confirm consistent left border accent, bigger headings, and more spacing across all three.

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/join-form.tsx src/components/assess/demographics-form.tsx src/components/assess/consent-screen.tsx
git commit -m "feat(runner): polish registration screens — spacing, heading, card accent, checkmark bullets"
```

---

## Task 5: Assessment intro polish

**Files:**
- Modify: `src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx`

### What to change

1. Content stack: `space-y-6` -> `space-y-8`
2. Heading: `text-2xl sm:text-3xl` -> `text-3xl sm:text-4xl`
3. The body prose currently sits directly in the content stack with no container. Wrap it in a card div with the same left-border accent treatment as the other content cards.

The card wrapper to add around the existing body prose div:
```tsx
<div
  className="rounded-2xl border border-l-[3px] p-6 sm:p-8 shadow-sm dark:shadow-none"
  style={{
    background: "var(--brand-neutral-50, hsl(var(--card)))",
    borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
    borderLeftColor: "var(--brand-primary, hsl(var(--primary)))",
  }}
>
  {/* existing body prose element goes here, unchanged */}
</div>
```

Only render this card if `body` is truthy (the existing `{body && (...)}` guard handles this).

- [ ] **Step 1: Apply all three changes to page.tsx**

- [ ] **Step 2: Verify visually**

Navigate to a campaign with an assessment intro configured. Confirm body prose sits in a left-border card, heading is larger, spacing is balanced.

- [ ] **Step 3: Commit**

```bash
git add "src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx"
git commit -m "feat(runner): polish assessment intro — heading size, body card accent"
```

---

## Task 6: Review screen polish (review-screen.tsx)

**Files:**
- Modify: `src/components/assess/review-screen.tsx`

### What to change

1. Content stack: `space-y-6` -> `space-y-8`
2. Per-section sub-rows: remove `ml-6` from className, add `pl-4` and a left border. Use inline style `borderLeftColor: "var(--brand-neutral-300, hsl(var(--border)))"` with a `border-l-2` Tailwind class.

For the sub-row divs, change from:
```
className="flex items-center gap-3 rounded-xl border px-4 py-3 ml-6"
```
To:
```
className="flex items-center gap-3 rounded-xl border border-l-2 px-4 py-3 pl-4"
```
And add to the inline style: `borderLeftColor: "var(--brand-neutral-300, hsl(var(--border)))"`

- [ ] **Step 1: Update review-screen.tsx**

- [ ] **Step 2: Verify visually**

Navigate to a review screen via a multi-section assessment with custom section titles (required to render sub-rows). Confirm the hierarchical left-border indentation.

- [ ] **Step 3: Commit**

```bash
git add src/components/assess/review-screen.tsx
git commit -m "feat(runner): polish review screen — spacing and section indentation via border"
```

---

## Task 7: Complete screen polish (complete-screen.tsx)

**Files:**
- Modify: `src/components/assess/complete-screen.tsx`

### What to change

1. Icon circle: `size-20` -> `size-24`; inner `CheckCircle2` icon: `size-10` -> `size-12`
2. The `nextUrl` CTA is a raw `<Link>` with inline styles. Wrap it with the `<Button size="lg" asChild>` pattern for consistency with all other CTAs in the runner.

- [ ] **Step 1: Add Button import**

```tsx
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Update icon sizes**

Change `size-20` -> `size-24` on the circle div.
Change `size-10` -> `size-12` on the `CheckCircle2`.

- [ ] **Step 3: Replace raw Link with Button**

Find the `{nextUrl && !content.redirectUrl && (...)}` block. Replace the raw `<Link className="inline-flex ...">` with:

```tsx
<div className="flex justify-center">
  <Button
    size="lg"
    asChild
    className="min-w-[200px] gap-1.5"
    style={{
      background: "var(--brand-primary, hsl(var(--primary)))",
      color: "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
    }}
  >
    <Link href={nextUrl}>
      Continue
      <ArrowRight className="size-4" />
    </Link>
  </Button>
</div>
```

- [ ] **Step 4: Verify visually**

Navigate to a complete screen (requires finishing an assessment). Confirm the icon is larger, and the Continue button (when present) matches the style of all other CTA buttons.

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/complete-screen.tsx
git commit -m "feat(runner): polish complete screen — larger icon, consistent Button CTA"
```

---

## Final verification

- [ ] Do a full end-to-end pass: join form -> welcome -> (assessment intro if applicable) -> section questions -> review -> complete
- [ ] Verify in both light mode and dark mode
- [ ] Confirm crossfade animation is smooth, no lateral movement, question heights stable
- [ ] Confirm all card left-border accents appear consistently across screens
- [ ] Confirm ambient glow on item card: present in light, absent in dark
