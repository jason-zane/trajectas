# Marketing Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final visual polish pass on the marketing site — SVG journey curves, hero particle density bias, contact form dissolution animation, and extended journey dwell time.

**Architecture:** Pure CSS/canvas tweaks to existing components. No new dependencies. Journey curves use an inline SVG with `stroke-dashoffset` driven by the existing `--scroll-progress` CSS variable. Hero density bias is a one-line change to particle initialisation. Contact form dissolution uses CSS transitions on existing DOM elements. Journey dwell is a scroll-height + timing adjustment.

**Tech Stack:** Next.js 16, React 19, CSS custom properties, HTML5 Canvas, SVG

---

## Task 1: Journey Dwell Time Extension

Extend the journey section scroll distance so the fully-revealed state lingers before the user scrolls past.

**Files:**
- Modify: `src/app/(marketing)/components/journey.tsx:46` (scroll height)
- Modify: `src/app/(marketing)/globals-marketing.css:173-188` (stage timing)

#### Step-by-step

- [ ] **Step 1: Increase journey scroll height**

In `src/app/(marketing)/components/journey.tsx`, change the section's class from `min-h-[250vh]` to `min-h-[350vh]`:

```tsx
// Before
className="relative min-h-[250vh]"

// After
className="relative min-h-[350vh]"
```

- [ ] **Step 2: Adjust stage reveal timing to use the first 65% of progress**

In `src/app/(marketing)/components/journey.tsx`, change the stage start calculation so stages spread across 0–0.65 instead of 0–0.75:

```tsx
// Before
const stageStart = i * 0.25;

// After
const stageStart = i * 0.18;
```

This means: stage 01 starts at 0%, 02 at 18%, 03 at 36%, 04 at 54%. All four are fully visible by ~72% progress, leaving ~28% of scroll (roughly one full viewport height) where everything stays put.

- [ ] **Step 3: Adjust journey line growth in CSS**

In `src/app/(marketing)/globals-marketing.css`, update the `.journey-line` rule so the line finishes growing by 70% progress instead of overshooting:

```css
/* Before */
[data-surface="marketing"] .journey-line {
  height: min(100%, calc(var(--scroll-progress, 0) * 120%));
  background: var(--mk-accent);
  opacity: 0.3;
}

/* After */
[data-surface="marketing"] .journey-line {
  height: min(100%, calc(var(--scroll-progress, 0) * 150%));
  background: var(--mk-accent);
  opacity: 0.3;
}
```

The higher multiplier (150% vs 120%) compensates for the longer scroll distance — the line still reaches full height by approximately the same visual moment (when stage 04 fills in).

- [ ] **Step 4: Verify scroll behaviour**

Run: `pnpm dev`

Scroll through the journey section and confirm:
- All four stages reveal progressively as before
- After stage 04 is fully visible, there is roughly one full viewport of scroll where everything stays static and readable
- The vertical line reaches the bottom dot around when stage 04 reveals

- [ ] **Step 5: Commit**

```bash
git add src/app/\(marketing\)/components/journey.tsx src/app/\(marketing\)/globals-marketing.css
git commit -m "polish(marketing): extend journey dwell time so completed state lingers"
```

---

## Task 2: SVG Trajectory Curves (Journey Section)

Replace the straight vertical `<div>` centre line with an SVG path that curves between dots, drawing itself progressively as scroll advances.

**Files:**
- Modify: `src/app/(marketing)/components/journey.tsx`
- Modify: `src/app/(marketing)/globals-marketing.css`

#### Step-by-step

- [ ] **Step 1: Replace the vertical line div with an SVG path**

In `src/app/(marketing)/components/journey.tsx`, replace the centre-line `<div>` block:

```tsx
// REMOVE this block:
{/* Central trajectory line — hidden on mobile */}
<div className="absolute left-1/2 top-[10%] h-[80%] w-px -translate-x-1/2 hidden md:block">
  <div className="journey-line w-full origin-top" />
</div>
```

Replace with an SVG that draws a gentle S-curve through four evenly-spaced points. The path uses cubic beziers curving left-right-left-right to match the alternating stage layout:

```tsx
{/* SVG trajectory curve — hidden on mobile */}
<svg
  className="journey-curve absolute left-1/2 top-[10%] hidden h-[80%] w-24 -translate-x-1/2 overflow-visible md:block"
  viewBox="0 0 100 400"
  preserveAspectRatio="none"
  fill="none"
  aria-hidden="true"
>
  <path
    className="journey-curve-path"
    d="M 50 0 C 50 35, 20 45, 20 100 S 80 145, 80 200 S 20 255, 20 300 S 50 365, 50 400"
    stroke="var(--mk-accent)"
    strokeWidth="1.5"
    vectorEffect="non-scaling-stroke"
    pathLength={1}
  />
</svg>
```

Key details:
- `viewBox="0 0 100 400"` with `preserveAspectRatio="none"` lets the SVG stretch to fill the container height
- The path starts at top-centre (50,0), curves left to (20,100), right to (80,200), left to (20,300), and back to centre (50,400)
- `vectorEffect="non-scaling-stroke"` keeps the stroke width consistent regardless of SVG scaling
- `w-24` (6rem) gives the curves visible horizontal travel
- `pathLength={1}` is an SVG attribute (not CSS) — it normalises the path length so `stroke-dasharray: 1` and `stroke-dashoffset` work as 0-to-1 progress values

- [ ] **Step 2: Add CSS for progressive stroke draw**

In `src/app/(marketing)/globals-marketing.css`, remove the old `.journey-line` rule and add the curve animation:

```css
/* REMOVE this rule: */
[data-surface="marketing"] .journey-line {
  height: min(100%, calc(var(--scroll-progress, 0) * 150%));
  background: var(--mk-accent);
  opacity: 0.3;
}

/* ADD this rule: */
[data-surface="marketing"] .journey-curve-path {
  stroke-dasharray: 1;
  stroke-dashoffset: calc(1 - clamp(0, calc(var(--scroll-progress, 0) * 1.5), 1));
  opacity: 0.35;
}
```

Note: `pathLength={1}` is already on the `<path>` element in the JSX from Step 1. It normalises the total path length to 1, so `stroke-dasharray: 1` means "one full path length" and `stroke-dashoffset` can animate from 1 (hidden) to 0 (fully drawn).

- [ ] **Step 3: Update reduced-motion fallback**

In `src/app/(marketing)/globals-marketing.css`, inside the `@media (prefers-reduced-motion: reduce)` block, replace the `.journey-line` rule:

```css
/* REMOVE: */
[data-surface="marketing"] .journey-line {
  height: 100%;
}

/* ADD: */
[data-surface="marketing"] .journey-curve-path {
  stroke-dashoffset: 0;
  opacity: 0.35;
}
```

- [ ] **Step 4: Verify the curve draws on scroll**

Run: `pnpm dev`

Scroll to the journey section and confirm:
- The S-curve is visible and traces through where the dots sit
- It draws progressively as you scroll (starting empty, ending fully drawn)
- The curve completes around when stage 04 reveals
- On mobile (< 768px) the SVG is hidden
- `prefers-reduced-motion` shows the full curve immediately

- [ ] **Step 5: Commit**

```bash
git add src/app/\(marketing\)/components/journey.tsx src/app/\(marketing\)/globals-marketing.css
git commit -m "polish(marketing): replace straight journey line with SVG S-curve that draws on scroll"
```

---

## Task 3: Hero Particle Density Bias

Bias particle initialisation so more particles cluster toward the right side and slightly upward, creating visual asymmetry that frames the centred hero text.

**Files:**
- Modify: `src/app/(marketing)/components/particle-mesh.tsx:73-91`

#### Step-by-step

- [ ] **Step 1: Add density bias to particle initialisation**

In `src/app/(marketing)/components/particle-mesh.tsx`, modify the `initParticles` callback. The current code uses uniform random distribution:

```typescript
// Before
x: Math.random() * width,
y: Math.random() * height,
```

Replace with a power-curve bias. `Math.pow(Math.random(), 0.65)` shifts the distribution rightward (more values closer to 1.0). A gentler `Math.pow(Math.random(), 0.85)` shifts upward slightly:

```typescript
// After
x: Math.pow(Math.random(), 0.65) * width,
y: (1 - Math.pow(Math.random(), 0.85)) * height,
```

The `1 -` on the y-axis flips the bias so particles favour the top rather than the bottom (since y=0 is top of screen).

**Important:** This only affects the hero section's initial spawn. Once particles are moving, they drift naturally and redistribute over time. The bias creates a first-impression density cluster, not a permanent constraint.

- [ ] **Step 2: Verify particle distribution**

Run: `pnpm dev`

Load the marketing page and observe the hero section:
- Particles should visibly cluster more toward the right side
- The top-right quadrant should be denser
- The left side and bottom should be sparser, giving the hero text room
- After a few seconds of drift, the distribution softens but the initial impression is asymmetric
- Mouse interaction still works normally

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/components/particle-mesh.tsx
git commit -m "polish(marketing): bias hero particle density toward top-right for text framing"
```

---

## Task 4: Contact Form Dissolution Animation

Replace the hard-cut success state with a staggered dissolution where form fields drift upward and fade, then the success message fades in.

**Files:**
- Modify: `src/app/(marketing)/components/contact-form.tsx`
- Modify: `src/app/(marketing)/globals-marketing.css`

#### Step-by-step

- [ ] **Step 1: Add dissolution CSS classes**

In `src/app/(marketing)/globals-marketing.css`, add the following rules at the end of the file (before the `@media (prefers-reduced-motion)` block):

```css
/* Contact form dissolution */
[data-surface="marketing"] .contact-field {
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}

[data-surface="marketing"] .contact-field-dissolve {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
  pointer-events: none;
}

@keyframes contact-success-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-surface="marketing"] .contact-success {
  animation: contact-success-enter 0.6s ease-out 0.4s both;
}
```

Inside the `@media (prefers-reduced-motion: reduce)` block, add:

```css
[data-surface="marketing"] .contact-field {
  transition: none;
}

[data-surface="marketing"] .contact-success {
  animation: none;
  opacity: 1;
  transform: none;
}
```

- [ ] **Step 2: Refactor ContactForm to use dissolution state**

In `src/app/(marketing)/components/contact-form.tsx`, replace the entire file content:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { submitContact, type ContactFormState } from "../actions/submit-contact";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    submitContact,
    undefined
  );
  const [dissolving, setDissolving] = useState(false);

  const isSuccess = state && "success" in state && state.success;

  useEffect(() => {
    if (isSuccess) {
      setDissolving(true);
    }
  }, [isSuccess]);

  const fieldErrors = state && "fields" in state ? state.fields : undefined;

  // Stagger delay for each field row during dissolution
  const fieldDelay = (index: number) =>
    dissolving ? { transitionDelay: `${index * 80}ms` } : undefined;

  return (
    <div className="relative w-full max-w-lg">
      {/* Form — dissolves on success */}
      <form action={formAction} className="w-full">
        {state && "error" in state && !fieldErrors && (
          <div
            className="mb-6 rounded-2xl border p-3 text-sm"
            style={{
              borderColor: "rgba(239, 68, 68, 0.5)",
              color: "#ef4444",
            }}
          >
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            className={`contact-field ${dissolving ? "contact-field-dissolve" : ""}`}
            style={fieldDelay(0)}
          >
            <label
              htmlFor="contact-name"
              className="mk-eyebrow mb-2 block text-[9px]"
            >
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              autoComplete="name"
              required
              disabled={dissolving}
              className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                color: "var(--mk-text-on-dark)",
              }}
            />
            {fieldErrors?.name && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div
            className={`contact-field ${dissolving ? "contact-field-dissolve" : ""}`}
            style={fieldDelay(1)}
          >
            <label
              htmlFor="contact-email"
              className="mk-eyebrow mb-2 block text-[9px]"
            >
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={dissolving}
              className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                color: "var(--mk-text-on-dark)",
              }}
            />
            {fieldErrors?.email && (
              <p className="mt-1 text-xs text-red-400">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div
            className={`contact-field col-span-1 md:col-span-2 ${dissolving ? "contact-field-dissolve" : ""}`}
            style={fieldDelay(2)}
          >
            <label
              htmlFor="contact-company"
              className="mk-eyebrow mb-2 block text-[9px]"
            >
              Company
            </label>
            <input
              id="contact-company"
              name="company"
              autoComplete="organization"
              disabled={dissolving}
              className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                color: "var(--mk-text-on-dark)",
              }}
            />
          </div>

          <div
            className={`contact-field col-span-1 md:col-span-2 ${dissolving ? "contact-field-dissolve" : ""}`}
            style={fieldDelay(3)}
          >
            <label
              htmlFor="contact-message"
              className="mk-eyebrow mb-2 block text-[9px]"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={4}
              disabled={dissolving}
              className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                color: "var(--mk-text-on-dark)",
              }}
            />
            {fieldErrors?.message && (
              <p className="mt-1 text-xs text-red-400">
                {fieldErrors.message[0]}
              </p>
            )}
          </div>

          <div
            className={`contact-field col-span-1 md:col-span-2 ${dissolving ? "contact-field-dissolve" : ""}`}
            style={fieldDelay(4)}
          >
            <button
              type="submit"
              disabled={pending || dissolving}
              className="w-full rounded-full py-4 text-sm font-bold tracking-wide transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: "var(--mk-accent)",
                color: "var(--mk-primary-dark)",
              }}
            >
              {pending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </form>

      {/* Success message — fades in after dissolution via CSS @keyframes */}
      {dissolving && (
        <div className="contact-success absolute inset-0 flex flex-col items-center justify-center gap-4">

          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
            style={{
              backgroundColor: "rgba(201, 169, 98, 0.15)",
              color: "var(--mk-accent)",
            }}
          >
            ✓
          </div>
          <p
            className="text-lg font-bold"
            style={{ color: "var(--mk-text-on-dark)" }}
          >
            We&apos;ll be in touch.
          </p>
        </div>
      )}
    </div>
  );
}
```

Key changes from the original:
- Wraps form + success in a `relative` container so the success message can overlay with `absolute inset-0`
- Each field row gets a `contact-field` class and conditionally adds `contact-field-dissolve`
- Staggered `transitionDelay` (0ms, 80ms, 160ms, 240ms, 320ms) so fields dissolve top-to-bottom
- Fields are `disabled` during dissolution to prevent interaction
- Success message uses a CSS `@keyframes` animation (`contact-success-enter`) with a 400ms delay — the animation runs automatically on mount, no class toggle needed, so the transition is reliable

- [ ] **Step 3: Verify the dissolution animation**

Run: `pnpm dev`

Submit the contact form (requires Supabase running or mock the action) and confirm:
- Form fields dissolve upward with a stagger, top fields disappearing first
- The checkmark and "We'll be in touch." fades in smoothly after a beat
- With `prefers-reduced-motion`, the transition is instant (no animation)
- Form inputs are disabled during dissolution (no double-submit)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/components/contact-form.tsx src/app/\(marketing\)/globals-marketing.css
git commit -m "polish(marketing): add staggered dissolution animation to contact form success"
```
