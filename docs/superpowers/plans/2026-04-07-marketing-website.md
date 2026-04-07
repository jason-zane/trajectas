# Marketing Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic single-page marketing website for Trajectas within the existing Next.js 16 app, featuring a mouse-reactive particle mesh, scroll-driven animations, text disintegration effects, and bold provocative copy.

**Architecture:** New `(marketing)` route group with its own layout (no sidebar/auth). Canvas-based particle system as a global background layer. Each section is an isolated client component with scroll-driven animations. Contact form submits via server action to Supabase + Resend notification.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, HTML Canvas (particle system), CSS Scroll Timeline API with IntersectionObserver fallback, Supabase (contact form storage), Resend (email notification), Zod (form validation)

**Spec:** `docs/superpowers/specs/2026-04-07-marketing-website-design.md`

---

## File Structure

```
src/app/(marketing)/
  layout.tsx                    — Marketing layout: fonts, metadata, no sidebar/auth
  page.tsx                      — Composes all sections in order
  globals-marketing.css         — Marketing-specific CSS variables and utilities
  components/
    particle-mesh.tsx           — Canvas particle system (mouse-reactive, section-aware)
    particle-config.ts          — Particle behaviour configs per section
    use-scroll-progress.ts      — Hook: normalised scroll progress for a ref element
    use-mouse-position.ts       — Hook: throttled mouse position relative to viewport
    nav.tsx                     — Fixed nav with transparent→frosted scroll transition
    hero.tsx                    — Hero section with sequential text reveal
    problem.tsx                 — Text disintegration/reformation scroll effect
    journey.tsx                 — Sticky scroll-driven 4-stage progression
    built-for.tsx               — Two alternating use-case panels
    contact.tsx                 — Contact form + footer
    contact-form.tsx            — Form client component with validation
  actions/
    submit-contact.ts           — Server action: validate, store, notify

supabase/migrations/
  YYYYMMDDHHMMSS_create_contact_submissions.sql — Contact form table
```

---

### Task 1: Marketing Route Group & Layout

**Files:**
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/app/(marketing)/globals-marketing.css`

- [ ] **Step 1: Create the marketing CSS file**

Create `src/app/(marketing)/globals-marketing.css` with marketing-specific CSS variables. These are the hex-based colours from the brand brief, mapped to CSS custom properties scoped to the marketing layout. Do NOT modify the existing `globals.css`.

```css
/* Marketing site colour tokens — scoped via [data-surface="marketing"] */
[data-surface="marketing"] {
  --mk-primary: #2d6a5a;
  --mk-primary-dark: #1e4a3e;
  --mk-accent: #c9a962;
  --mk-bg: #f8f6f1;
  --mk-text: #1a1a1a;
  --mk-text-muted: #6b6b6b;
  --mk-text-on-dark: #ffffff;
  --mk-text-on-dark-muted: rgba(255, 255, 255, 0.55);
}

/* Marketing typography utilities */
[data-surface="marketing"] .mk-eyebrow {
  font-weight: 200;
  font-size: 0.6875rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--mk-accent);
}

[data-surface="marketing"] .mk-display {
  font-size: clamp(3rem, 6vw, 5rem);
  line-height: 1.1;
  font-weight: 400;
  letter-spacing: -0.02em;
}

[data-surface="marketing"] .mk-headline {
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.01em;
}

[data-surface="marketing"] .mk-body {
  font-size: 1rem;
  line-height: 1.7;
  font-weight: 400;
}

[data-surface="marketing"] .mk-mono {
  font-family: var(--font-mono);
  font-weight: 300;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
}
```

- [ ] **Step 2: Create the marketing layout**

Create `src/app/(marketing)/layout.tsx`. This layout:
- Loads Instrument Serif and JetBrains Mono via `next/font/google` (Plus Jakarta Sans is already on the root layout)
- Sets `data-surface="marketing"` for scoped CSS
- Imports the marketing CSS file
- Sets metadata for the marketing site
- Does NOT include sidebar, auth checks, or workspace shell

```tsx
import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals-marketing.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trajectas — Contextual Psychometric Assessment",
  description:
    "Assessment built around your context. Your organisation, your roles, your definition of what good looks like.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-surface="marketing"
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create the page shell**

Create `src/app/(marketing)/page.tsx` as a placeholder that confirms the route works:

```tsx
export default function MarketingPage() {
  return (
    <main>
      <div className="flex h-screen items-center justify-center">
        <h1 className="mk-display font-[family-name:var(--font-display)]">
          Trajectas
        </h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify the route works**

Run: `npm run dev`
Navigate to: `http://localhost:3002` (or whichever path serves the marketing group — check if there's an existing root page that would conflict; if so, this may need to be at a temporary path for now)
Expected: "Trajectas" displayed in Instrument Serif at display size

- [ ] **Step 5: Commit**

```bash
git add src/app/\(marketing\)/
git commit -m "feat(marketing): scaffold route group, layout, and CSS tokens"
```

---

### Task 2: Mouse Position & Scroll Progress Hooks

**Files:**
- Create: `src/app/(marketing)/components/use-mouse-position.ts`
- Create: `src/app/(marketing)/components/use-scroll-progress.ts`

These two hooks are foundational — the particle mesh and scroll-driven sections both depend on them.

- [ ] **Step 1: Create the mouse position hook**

Create `src/app/(marketing)/components/use-mouse-position.ts`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface MousePosition {
  x: number;
  y: number;
}

export function useMousePosition(throttleMs = 16): MousePosition {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });
  const lastUpdate = useRef(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    function handleMouseMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastUpdate.current < throttleMs) return;
      lastUpdate.current = now;
      setPosition({ x: e.clientX, y: e.clientY });
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [throttleMs]);

  return position;
}
```

- [ ] **Step 2: Create the scroll progress hook**

Create `src/app/(marketing)/components/use-scroll-progress.ts`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a normalised 0–1 scroll progress value for the given element.
 * 0 = element top enters viewport bottom, 1 = element bottom exits viewport top.
 * The `scrollLength` multiplier controls how many viewport heights of
 * scroll travel the element occupies (for sticky sections).
 */
export function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        if (!ref.current) {
          ticking.current = false;
          return;
        }
        const rect = ref.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const totalScrollDistance = rect.height - viewportHeight;

        if (totalScrollDistance <= 0) {
          // Element shorter than viewport — progress based on viewport crossing
          const raw = 1 - (rect.top / viewportHeight);
          setProgress(Math.max(0, Math.min(1, raw)));
        } else {
          // Element taller than viewport — progress based on scroll through
          const raw = -rect.top / totalScrollDistance;
          setProgress(Math.max(0, Math.min(1, raw)));
        }

        ticking.current = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial position
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { ref, progress };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/components/use-mouse-position.ts src/app/\(marketing\)/components/use-scroll-progress.ts
git commit -m "feat(marketing): add mouse position and scroll progress hooks"
```

---

### Task 3: Particle Mesh System

**Files:**
- Create: `src/app/(marketing)/components/particle-config.ts`
- Create: `src/app/(marketing)/components/particle-mesh.tsx`

This is the most technically complex component. The particle mesh is a full-viewport canvas that renders behind all content, responds to mouse position, and adapts its behaviour based on which section is currently in view.

- [ ] **Step 1: Create particle configuration**

Create `src/app/(marketing)/components/particle-config.ts`:

```ts
export interface ParticleConfig {
  /** Max number of particles */
  count: number;
  /** Particle colour as CSS colour string */
  colour: string;
  /** Connection line colour as CSS colour string */
  lineColour: string;
  /** Max distance for connection lines (px) */
  connectionDistance: number;
  /** Particle speed multiplier (1 = default) */
  speed: number;
  /** Mouse influence radius (px) */
  mouseRadius: number;
  /** Mouse push/pull strength (positive = repel) */
  mouseStrength: number;
  /** Min/max particle radius */
  sizeRange: [number, number];
  /** Opacity range */
  opacityRange: [number, number];
}

export const SECTION_CONFIGS: Record<string, ParticleConfig> = {
  hero: {
    count: 120,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.12)",
    connectionDistance: 150,
    speed: 0.3,
    mouseRadius: 200,
    mouseStrength: 0.8,
    sizeRange: [1, 4],
    opacityRange: [0.1, 0.6],
  },
  problem: {
    count: 80,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.08)",
    connectionDistance: 120,
    speed: 0.4,
    mouseRadius: 180,
    mouseStrength: 0.6,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.4],
  },
  journey: {
    count: 100,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.1)",
    connectionDistance: 140,
    speed: 0.2,
    mouseRadius: 200,
    mouseStrength: 0.7,
    sizeRange: [1, 4],
    opacityRange: [0.1, 0.5],
  },
  builtFor: {
    count: 60,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.1)",
    connectionDistance: 130,
    speed: 0.25,
    mouseRadius: 180,
    mouseStrength: 0.5,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.4],
  },
  contact: {
    count: 50,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.06)",
    connectionDistance: 100,
    speed: 0.15,
    mouseRadius: 160,
    mouseStrength: 0.3,
    sizeRange: [1, 3],
    opacityRange: [0.05, 0.3],
  },
};
```

- [ ] **Step 2: Create the particle mesh canvas component**

Create `src/app/(marketing)/components/particle-mesh.tsx`. This is a large component — the core particle system with:
- A full-viewport fixed canvas
- Particle class with position, velocity, size, opacity
- Connection lines between nearby particles
- Mouse repulsion/attraction
- Smooth config transitions when the active section changes
- `requestAnimationFrame` render loop
- Device pixel ratio handling
- `prefers-reduced-motion` fallback (render a static subtle gradient instead)

The component accepts `activeSection` as a prop (string key matching `SECTION_CONFIGS`) and `mousePosition` (`{x, y}`). The parent page will determine the active section via IntersectionObserver on each section element.

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { SECTION_CONFIGS, type ParticleConfig } from "./particle-config";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

interface ParticleMeshProps {
  activeSection: string;
  mousePosition: { x: number; y: number };
}

export function ParticleMesh({ activeSection, mousePosition }: ParticleMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const configRef = useRef<ParticleConfig>(SECTION_CONFIGS.hero);
  const animFrameRef = useRef<number>(0);

  // Smoothly transition config when section changes
  useEffect(() => {
    configRef.current = SECTION_CONFIGS[activeSection] ?? SECTION_CONFIGS.hero;
  }, [activeSection]);

  const initParticles = useCallback((width: number, height: number) => {
    const config = configRef.current;
    const particles: Particle[] = [];
    for (let i = 0; i < config.count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed,
        radius: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
        opacity: config.opacityRange[0] + Math.random() * (config.opacityRange[1] - config.opacityRange[0]),
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);
      initParticles(window.innerWidth, window.innerHeight);
    }

    resize();
    window.addEventListener("resize", resize);

    function animate() {
      const config = configRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx!.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mousePosition;

      // Update and draw particles
      for (const p of particles) {
        // Mouse influence
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < config.mouseRadius && dist > 0) {
          const force = (1 - dist / config.mouseRadius) * config.mouseStrength;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Apply velocity with damping
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Add slight drift
        p.vx += (Math.random() - 0.5) * 0.02 * config.speed;
        p.vy += (Math.random() - 0.5) * 0.02 * config.speed;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Draw particle
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = config.colour;
        ctx!.globalAlpha = p.opacity;
        ctx!.fill();
      }

      // Draw connections
      ctx!.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < config.connectionDistance) {
            const lineOpacity = 1 - dist / config.connectionDistance;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = config.lineColour;
            ctx!.globalAlpha = lineOpacity;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      ctx!.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initParticles, mousePosition]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
```

**Note to implementer:** The above is a working starting point. During implementation, optimise the connection loop (spatial grid/hashing) if frame rate drops below 60fps. The O(n^2) connection check is fine for 50–120 particles but monitor performance. Also, the `mousePosition` prop will cause re-renders — consider using a ref passed from the parent instead of state, or memoise the component and pass mouse position via a ref callback.

- [ ] **Step 3: Verify particle mesh renders**

Temporarily import `ParticleMesh` into `page.tsx` with hardcoded props to verify the canvas renders:

```tsx
"use client";

import { ParticleMesh } from "./components/particle-mesh";
import { useMousePosition } from "./components/use-mouse-position";

export default function MarketingPage() {
  const mouse = useMousePosition();
  return (
    <main>
      <ParticleMesh activeSection="hero" mousePosition={mouse} />
      <div className="relative z-10 flex h-screen items-center justify-center">
        <h1 className="mk-display font-[family-name:var(--font-display)] text-white">
          Trajectas
        </h1>
      </div>
    </main>
  );
}
```

Run: `npm run dev`
Expected: Gold particles floating on screen, reacting to mouse movement, with connection lines between nearby particles.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/components/particle-config.ts src/app/\(marketing\)/components/particle-mesh.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add canvas particle mesh with mouse reactivity"
```

---

### Task 4: Navigation Component

**Files:**
- Create: `src/app/(marketing)/components/nav.tsx`

- [ ] **Step 1: Create the navigation component**

Create `src/app/(marketing)/components/nav.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-8 py-5 transition-all duration-200"
      style={{
        backgroundColor: scrolled
          ? "rgba(30, 74, 62, 0.92)"
          : "transparent",
        backdropFilter: scrolled ? "blur(12px) saturate(180%)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(255, 255, 255, 0.06)"
          : "1px solid transparent",
      }}
    >
      <span
        className="text-lg font-bold tracking-tight"
        style={{ color: "var(--mk-text-on-dark)" }}
      >
        Trajectas
      </span>

      <a
        href="#contact"
        className="text-sm transition-colors duration-200"
        style={{
          color: "var(--mk-text-on-dark)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          padding: "8px 20px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--mk-accent)";
          e.currentTarget.style.color = "var(--mk-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
          e.currentTarget.style.color = "var(--mk-text-on-dark)";
        }}
      >
        Get in touch
      </a>
    </nav>
  );
}
```

- [ ] **Step 2: Add nav to the page**

Update `src/app/(marketing)/page.tsx` to include the Nav component.

- [ ] **Step 3: Verify nav states**

Run: `npm run dev`
Expected: Transparent nav over content. On scroll past ~50px, transitions to frosted dark background. "Get in touch" button highlights gold on hover.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/components/nav.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add fixed nav with scroll-driven frosted glass transition"
```

---

### Task 5: Hero Section

**Files:**
- Create: `src/app/(marketing)/components/hero.tsx`

- [ ] **Step 1: Create the hero section**

Create `src/app/(marketing)/components/hero.tsx`. Key features:
- Full viewport height
- Content left-aligned ~55% width
- Sequential reveal animation: eyebrow → headline (word-by-word) → subtext → CTA
- Uses Instrument Serif for the headline via `font-[family-name:var(--font-display)]`
- Scroll hint at bottom (animated thin line)
- `data-section="hero"` attribute for the particle mesh to detect

```tsx
"use client";

import { useEffect, useState } from "react";

export function Hero() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Small delay to ensure fonts are loaded before animation starts
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const headline = "Generic assessment measures nothing that matters.";
  const words = headline.split(" ");

  return (
    <section
      data-section="hero"
      className="relative z-10 flex h-screen items-center px-8 md:px-16 lg:px-24"
      style={{ backgroundColor: "var(--mk-primary-dark)" }}
    >
      <div className="max-w-[55%]">
        {/* Eyebrow */}
        <p
          className="mk-eyebrow mb-6 transition-all duration-700"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
          }}
        >
          Contextual Assessment
        </p>

        {/* Headline — word-by-word reveal */}
        <h1 className="mk-display font-[family-name:var(--font-display)]" style={{ color: "var(--mk-text-on-dark)" }}>
          {words.map((word, i) => (
            <span
              key={i}
              className="inline-block mr-[0.3em] transition-all duration-500"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(20px)",
                transitionDelay: `${300 + i * 80}ms`,
              }}
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Subtext */}
        <p
          className="mk-body mt-6 max-w-md transition-all duration-700"
          style={{
            color: "var(--mk-text-on-dark-muted)",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transitionDelay: "900ms",
          }}
        >
          Every organisation defines capability differently. Your assessment
          should too.
        </p>

        {/* CTA */}
        <a
          href="#contact"
          className="mt-8 inline-block px-8 py-4 text-sm font-bold tracking-wide transition-all duration-200"
          style={{
            backgroundColor: "var(--mk-primary)",
            color: "var(--mk-text-on-dark)",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transitionDelay: "1100ms",
          }}
        >
          Start a conversation
        </a>
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
        style={{ opacity: revealed ? 1 : 0, transitionDelay: "1400ms" }}
      >
        <div
          className="h-8 w-px animate-pulse"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)" }}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add hero to page and verify**

Update `page.tsx` to include `<Hero />`. Verify the sequential reveal animation plays on load, the headline uses Instrument Serif, and the particle mesh shows behind the content.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/components/hero.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add hero section with word-by-word reveal animation"
```

---

### Task 6: Problem Section (Text Disintegration)

**Files:**
- Create: `src/app/(marketing)/components/problem.tsx`

This is the most visually complex section. The scroll-driven text disintegration effect requires:
- Characters rendered individually as positioned spans
- Scroll progress drives each character's opacity, blur, and position
- Particles scatter from character positions (can be CSS-based pseudo-elements or small spans)
- New text assembles from bottom-up after old text clears

- [ ] **Step 1: Create the problem section**

Create `src/app/(marketing)/components/problem.tsx`:

The component should:
1. Use `useScrollProgress` to get a 0–1 value over ~2x viewport scroll distance
2. Render generic phrases where each character is a `<span>` with individually calculated styles based on scroll progress
3. At progress 0–0.4: generic text visible, beginning to fragment
4. At progress 0.4–0.6: transition zone — old text fully scattered, particles visible, background colour shifting
5. At progress 0.6–1.0: new text assembles character by character
6. Background transitions from `--mk-primary-dark` to `--mk-bg` over the full scroll range

The section needs a tall scroll container (e.g., `min-h-[200vh]`) with sticky-positioned visible content inside:

```tsx
"use client";

import { useMemo } from "react";
import { useScrollProgress } from "./use-scroll-progress";

const GENERIC_PHRASES = [
  "Standardised competency frameworks",
  "Norm-referenced percentile scores",
  "One-size-fits-all benchmarks",
  "Industry-standard personality profiles",
];

const REFORMED_PHRASES = [
  "Your context",
  "Your definition of capability",
  "Measurement that drives decisions",
  "Assessment that actually means something",
];

export function Problem() {
  const { ref, progress } = useScrollProgress();

  // Background colour interpolation (dark → warm white)
  const bgColor = useMemo(() => {
    // Simple lerp between primary-dark and bg
    const t = Math.max(0, Math.min(1, progress));
    return t < 0.5
      ? "var(--mk-primary-dark)"
      : "var(--mk-bg)";
  }, [progress]);

  return (
    <section
      ref={ref}
      data-section="problem"
      className="relative"
      style={{ minHeight: "200vh" }}
    >
      <div
        className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-8"
        style={{ backgroundColor: bgColor, transition: "background-color 0.3s ease" }}
      >
        {/* Generic text — dissolves as progress goes 0 → 0.5 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {GENERIC_PHRASES.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="flex flex-wrap justify-center">
              {phrase.split("").map((char, charIdx) => {
                const charProgress = progress * 2; // 0–1 over first half
                const delay = (phraseIdx * 30 + charIdx * 2) / 150;
                const charOpacity = Math.max(0, 1 - (charProgress - delay) * 3);
                const yOffset = charProgress > delay ? -(charProgress - delay) * 60 : 0;
                const blur = charProgress > delay ? (charProgress - delay) * 8 : 0;

                return (
                  <span
                    key={charIdx}
                    className="inline-block text-2xl font-bold md:text-4xl"
                    style={{
                      color: progress < 0.5 ? "var(--mk-text-muted)" : "transparent",
                      opacity: charOpacity,
                      transform: `translateY(${yOffset}px)`,
                      filter: `blur(${blur}px)`,
                      transition: "color 0.3s",
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Reformed text — assembles as progress goes 0.5 → 1 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {REFORMED_PHRASES.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="flex flex-wrap justify-center">
              {phrase.split("").map((char, charIdx) => {
                const assembleProgress = (progress - 0.5) * 2; // 0–1 over second half
                const delay = (phraseIdx * 20 + charIdx * 2) / 100;
                const charOpacity = Math.max(0, Math.min(1, (assembleProgress - delay) * 3));
                const yOffset = assembleProgress > delay ? 0 : 12;
                const blur = assembleProgress > delay ? 0 : 4;

                return (
                  <span
                    key={charIdx}
                    className="inline-block font-[family-name:var(--font-display)] text-2xl md:text-4xl"
                    style={{
                      color: "var(--mk-primary)",
                      opacity: charOpacity,
                      transform: `translateY(${yOffset}px)`,
                      filter: `blur(${blur}px)`,
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Note to implementer:** This is the scaffold. The disintegration effect here uses opacity + blur + translateY per character. During implementation, enhance with actual particle scatter — small `<span>` elements or a canvas overlay that spawns particles at each character's position as it dissolves. The key is getting the scroll-driven timing right first, then layering in visual fidelity.

- [ ] **Step 2: Add to page and verify scroll effect**

Add `<Problem />` after `<Hero />` in `page.tsx`. Scroll through and verify: generic text dissolves, reformed text assembles, background transitions.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/components/problem.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add problem section with scroll-driven text disintegration"
```

---

### Task 7: Journey Section (Scroll-Driven Progression)

**Files:**
- Create: `src/app/(marketing)/components/journey.tsx`

- [ ] **Step 1: Create the journey section**

Create `src/app/(marketing)/components/journey.tsx`. This section:
- Uses sticky positioning with ~3.5x viewport scroll height
- Four stages appear sequentially based on scroll progress
- Stages alternate left/right of a central trajectory line
- A gold trajectory line draws itself vertically as you scroll
- Stage numbers in monospace, stage titles in bold, descriptions in body text
- Background colour shifts from warm neutral to deep green over the scroll range
- `data-section="journey"` for particle mesh adaptation

The scroll progress maps to 4 stages:
- 0.0–0.25: Stage 1 visible
- 0.25–0.50: Stage 2 visible
- 0.50–0.75: Stage 3 visible
- 0.75–1.0: Stage 4 visible

Each stage fades in as its range begins and stays visible.

```tsx
"use client";

import { useScrollProgress } from "./use-scroll-progress";

const STAGES = [
  {
    num: "01",
    title: "Where you are now",
    desc: "Data without direction. Numbers that don't connect to decisions.",
  },
  {
    num: "02",
    title: "Define the context",
    desc: "We learn your organisation. Your roles. Your definition of what good looks like.",
  },
  {
    num: "03",
    title: "Build the instrument",
    desc: "A tailored assessment, grounded in psychometric methodology. Shaped by your requirements.",
  },
  {
    num: "04",
    title: "Clarity",
    desc: "Insight that connects to decisions. Not just a score — a direction.",
  },
];

export function Journey() {
  const { ref, progress } = useScrollProgress();

  // Background interpolation: warm neutral → deep green
  const bgOpacity = Math.max(0, Math.min(1, progress));

  return (
    <section
      ref={ref}
      data-section="journey"
      className="relative"
      style={{ minHeight: "350vh" }}
    >
      <div
        className="sticky top-0 flex h-screen items-center justify-center overflow-hidden"
        style={{
          background: `color-mix(in srgb, var(--mk-bg) ${Math.round((1 - bgOpacity) * 100)}%, var(--mk-primary-dark))`,
        }}
      >
        {/* Central trajectory line */}
        <div className="absolute left-1/2 top-[10%] h-[80%] w-px -translate-x-1/2">
          <div
            className="w-full origin-top transition-none"
            style={{
              height: `${Math.min(100, progress * 120)}%`,
              background: "var(--mk-accent)",
              opacity: 0.3,
            }}
          />
        </div>

        {/* Stages */}
        <div className="relative flex h-[70%] w-full max-w-4xl flex-col justify-between px-8">
          {STAGES.map((stage, i) => {
            const stageStart = i * 0.25;
            const stageProgress = Math.max(0, Math.min(1, (progress - stageStart) / 0.2));
            const isLeft = i % 2 === 0;
            const isLightBg = progress < 0.5;

            return (
              <div
                key={i}
                className="flex items-center"
                style={{
                  justifyContent: isLeft ? "flex-start" : "flex-end",
                  opacity: stageProgress,
                  transform: `translateX(${isLeft ? -1 : 1}${(1 - stageProgress) * 30}px)`,
                }}
              >
                <div
                  className="max-w-xs"
                  style={{ textAlign: isLeft ? "right" : "left" }}
                >
                  <div className="mk-mono" style={{ color: "var(--mk-accent)" }}>
                    {stage.num}
                  </div>
                  <h3
                    className="mt-1 text-xl font-bold"
                    style={{
                      color: isLightBg ? "var(--mk-text)" : "var(--mk-text-on-dark)",
                    }}
                  >
                    {stage.title}
                  </h3>
                  <p
                    className="mk-body mt-2"
                    style={{
                      color: isLightBg ? "var(--mk-text-muted)" : "var(--mk-text-on-dark-muted)",
                    }}
                  >
                    {stage.desc}
                  </p>
                </div>

                {/* Dot on the center line */}
                <div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: `2px solid var(--mk-accent)`,
                    opacity: stageProgress,
                    background: stageProgress > 0.8 ? "var(--mk-accent)" : "transparent",
                    transition: "background 0.3s",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to page and verify**

Add `<Journey />` after `<Problem />`. Scroll through and verify: stages appear sequentially, trajectory line draws, background transitions, stages alternate sides.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/components/journey.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add journey section with scroll-driven stage progression"
```

---

### Task 8: Built For Section

**Files:**
- Create: `src/app/(marketing)/components/built-for.tsx`

- [ ] **Step 1: Create the built-for section**

Create `src/app/(marketing)/components/built-for.tsx`:

Two alternating panels (hiring: content-left/visual-right, capability: content-right/visual-left). Each panel is near-full viewport height. Secondary use cases as a minimal strip below.

Uses IntersectionObserver for scroll-reveal of each panel. Constellation visuals are simplified node-and-line SVGs that animate on viewport entry.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface PanelProps {
  eyebrow: string;
  title: string;
  body: string;
  reverse?: boolean;
  visual: React.ReactNode;
}

function Panel({ eyebrow, title, body, reverse, visual }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`flex min-h-[80vh] items-center gap-16 px-8 md:px-16 lg:px-24 ${
        reverse ? "flex-row-reverse" : ""
      }`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0)"
          : "translateY(40px)",
        transition: "opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="flex-1">
        <p className="mk-eyebrow mb-4">{eyebrow}</p>
        <h2
          className="mk-headline"
          style={{ color: "var(--mk-text)" }}
        >
          {title}
        </h2>
        <p
          className="mk-body mt-4 max-w-md"
          style={{ color: "var(--mk-text-muted)" }}
        >
          {body}
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {visual}
      </div>
    </div>
  );
}

function HiringVisual() {
  // Abstracted constellation: central node with radiating connections
  // to context nodes (role, team, org). Animate on mount.
  return (
    <svg viewBox="0 0 300 300" className="h-64 w-64">
      {/* Implementation: animated nodes and lines assembling */}
      {/* Central candidate node + surrounding context nodes */}
    </svg>
  );
}

function CapabilityVisual() {
  // Network of nodes with varying connection strengths
  // Some bright (strengths), some dim/dashed (gaps)
  return (
    <svg viewBox="0 0 300 300" className="h-64 w-64">
      {/* Implementation: network graph with varying opacities */}
    </svg>
  );
}

export function BuiltFor() {
  return (
    <section
      data-section="builtFor"
      style={{ backgroundColor: "var(--mk-bg)" }}
    >
      <Panel
        eyebrow="Built for"
        title="Hiring for critical roles"
        body="Most hiring assessments measure against someone else's idea of good. Yours should measure against yours. Assess candidates against your context, your roles, your definition of capability."
        visual={<HiringVisual />}
      />

      <Panel
        eyebrow="Built for"
        title="Capability mapping"
        body="You can't close gaps you can't see. Map where your people sit today against where your organisation needs them to be. Not a snapshot — a living picture that changes as they do."
        reverse
        visual={<CapabilityVisual />}
      />

      {/* Secondary use cases */}
      <div
        className="flex gap-12 px-8 py-16 md:px-16 lg:px-24"
        style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div style={{ borderLeft: "2px solid #ddd", paddingLeft: 16 }}>
          <p className="text-sm font-bold" style={{ color: "var(--mk-text)" }}>
            Development & progression
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--mk-text-muted)" }}>
            Track growth over time with measurement that stays connected to context.
          </p>
        </div>
        <div style={{ borderLeft: "2px solid #ddd", paddingLeft: 16 }}>
          <p className="text-sm font-bold" style={{ color: "var(--mk-text)" }}>
            Team & leadership assessment
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--mk-text-muted)" }}>
            Understand collective capability. Composition, not just individual profiles.
          </p>
        </div>
      </div>
    </section>
  );
}
```

**Note to implementer:** The SVG visuals (`HiringVisual` and `CapabilityVisual`) need full implementation during build — animated nodes that assemble on viewport entry. Use SVG `<circle>` and `<line>` elements with CSS transitions or SMIL animations. The scaffold above provides the layout and scroll-reveal; the visual polish is where the @frontend-design skill applies.

- [ ] **Step 2: Add to page and verify**

Add `<BuiltFor />` after `<Journey />`. Verify panels scroll-reveal, layout alternates, secondary use cases appear below.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/components/built-for.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add built-for section with alternating panels"
```

---

### Task 9: Contact Form Server Action & Database

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_create_contact_submissions.sql`
- Create: `src/app/(marketing)/actions/submit-contact.ts`

- [ ] **Step 1: Create the database migration**

Create the migration file (use current timestamp for the prefix):

```sql
-- Contact form submissions from the marketing website
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  message text not null,
  created_at timestamptz not null default now()
);

-- RLS: no public access, only service role can insert/read
alter table public.contact_submissions enable row level security;

-- No RLS policies — only accessible via admin/service-role client
```

- [ ] **Step 2: Run the migration**

Run: `npm run db:push`
Expected: Migration applied successfully.

- [ ] **Step 3: Create the server action**

Create `src/app/(marketing)/actions/submit-contact.ts`:

```ts
"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email address"),
  company: z.string().max(200).optional(),
  message: z.string().min(1, "Message is required").max(5000),
});

export type ContactFormState =
  | { success: true }
  | { error: string; fields?: Record<string, string[]> }
  | undefined;

export async function submitContact(
  _state: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      error: "Please check the form fields.",
      fields: parsed.error.flatten().fieldErrors,
    };
  }

  const db = createAdminClient();

  const { error } = await db.from("contact_submissions").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company ?? null,
    message: parsed.data.message,
  });

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  // Send notification email to hello@trajectas.com
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: "hello@trajectas.com",
      subject: `New enquiry from ${parsed.data.name}`,
      text: [
        `Name: ${parsed.data.name}`,
        `Email: ${parsed.data.email}`,
        parsed.data.company ? `Company: ${parsed.data.company}` : null,
        `\nMessage:\n${parsed.data.message}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch {
    // Don't fail the submission if the notification email fails
  }

  return { success: true };
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/app/\(marketing\)/actions/submit-contact.ts
git commit -m "feat(marketing): add contact form server action and database table"
```

---

### Task 10: Contact Section & Footer

**Files:**
- Create: `src/app/(marketing)/components/contact-form.tsx`
- Create: `src/app/(marketing)/components/contact.tsx`

- [ ] **Step 1: Create the contact form client component**

Create `src/app/(marketing)/components/contact-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { submitContact, type ContactFormState } from "../actions/submit-contact";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    submitContact,
    undefined
  );
  const [submitted, setSubmitted] = useState(false);

  if (state?.success || submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div
          className="flex h-12 w-12 items-center justify-center text-2xl"
          style={{ color: "var(--mk-accent)" }}
        >
          ✓
        </div>
        <p
          className="text-lg font-bold"
          style={{ color: "var(--mk-text-on-dark)" }}
        >
          We'll be in touch.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-lg">
      {state?.error && !state.fields && (
        <div
          className="mb-6 border p-3 text-sm"
          style={{
            borderColor: "rgba(239, 68, 68, 0.5)",
            color: "#ef4444",
          }}
        >
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mk-eyebrow mb-2 block text-[9px]">Name</label>
          <input
            name="name"
            required
            className="w-full border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "var(--mk-text-on-dark)",
            }}
          />
          {state?.fields?.name && (
            <p className="mt-1 text-xs text-red-400">{state.fields.name[0]}</p>
          )}
        </div>

        <div>
          <label className="mk-eyebrow mb-2 block text-[9px]">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "var(--mk-text-on-dark)",
            }}
          />
          {state?.fields?.email && (
            <p className="mt-1 text-xs text-red-400">{state.fields.email[0]}</p>
          )}
        </div>

        <div className="col-span-2">
          <label className="mk-eyebrow mb-2 block text-[9px]">Company</label>
          <input
            name="company"
            className="w-full border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "var(--mk-text-on-dark)",
            }}
          />
        </div>

        <div className="col-span-2">
          <label className="mk-eyebrow mb-2 block text-[9px]">Message</label>
          <textarea
            name="message"
            required
            rows={4}
            className="w-full resize-none border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "var(--mk-text-on-dark)",
            }}
          />
          {state?.fields?.message && (
            <p className="mt-1 text-xs text-red-400">{state.fields.message[0]}</p>
          )}
        </div>

        <div className="col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="w-full py-4 text-sm font-bold tracking-wide transition-opacity disabled:opacity-50"
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
  );
}
```

- [ ] **Step 2: Create the contact section with footer**

Create `src/app/(marketing)/components/contact.tsx`:

```tsx
import { ContactForm } from "./contact-form";

export function Contact() {
  return (
    <section
      id="contact"
      data-section="contact"
      style={{ backgroundColor: "var(--mk-primary-dark)" }}
    >
      {/* Contact content */}
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 py-24 text-center">
        <p className="mk-eyebrow mb-6">Get in touch</p>
        <h2
          className="mk-display max-w-2xl font-[family-name:var(--font-display)]"
          style={{ color: "var(--mk-text-on-dark)" }}
        >
          Let's talk about what contextual assessment looks like for your
          organisation.
        </h2>
        <p
          className="mk-body mt-4 mb-12"
          style={{ color: "var(--mk-text-on-dark-muted)" }}
        >
          Tell us what you're working on.
        </p>
        <ContactForm />
      </div>

      {/* Footer */}
      <footer
        className="flex items-center justify-between px-8 py-6"
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <span
          className="text-sm font-bold"
          style={{ color: "rgba(255, 255, 255, 0.4)" }}
        >
          Trajectas
        </span>
        <span
          className="text-xs"
          style={{ color: "rgba(255, 255, 255, 0.2)" }}
        >
          © 2026 Trajectas
        </span>
      </footer>
    </section>
  );
}
```

- [ ] **Step 3: Add to page and verify**

Add `<Contact />` as the last section. Verify the form renders, validates on submit, shows success state. Test the "Get in touch" nav link scrolls to this section.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/components/contact-form.tsx src/app/\(marketing\)/components/contact.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(marketing): add contact section with form, server action, and footer"
```

---

### Task 11: Page Assembly & Section Detection

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

- [ ] **Step 1: Assemble the full page**

Update `src/app/(marketing)/page.tsx` to compose all sections with active section detection for the particle mesh:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticleMesh } from "./components/particle-mesh";
import { useMousePosition } from "./components/use-mouse-position";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { Problem } from "./components/problem";
import { Journey } from "./components/journey";
import { BuiltFor } from "./components/built-for";
import { Contact } from "./components/contact";

const SECTIONS = ["hero", "problem", "journey", "builtFor", "contact"] as const;

export default function MarketingPage() {
  const mouse = useMousePosition();
  const [activeSection, setActiveSection] = useState<string>("hero");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach((section) => {
      const el = document.querySelector(`[data-section="${section}"]`);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(section);
          }
        },
        { threshold: 0.3 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      <ParticleMesh activeSection={activeSection} mousePosition={mouse} />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <Problem />
        <Journey />
        <BuiltFor />
        <Contact />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Full scroll-through test**

Run: `npm run dev`
Scroll through the entire page. Verify:
- Particle mesh visible behind all sections
- Particle behaviour changes as you scroll between sections
- Nav transitions from transparent to frosted
- Hero word-by-word reveal plays on load
- Problem section text dissolves and reforms on scroll
- Journey section stages appear sequentially
- Built-for panels scroll-reveal with alternating layout
- Contact form works, footer visible
- "Get in touch" nav link smooth-scrolls to contact

- [ ] **Step 3: Add smooth scroll behaviour**

Add to `globals-marketing.css`:

```css
[data-surface="marketing"] {
  scroll-behavior: smooth;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/
git commit -m "feat(marketing): assemble full page with section detection and smooth scroll"
```

---

### Task 12: Responsive & Accessibility

**Files:**
- Modify: `src/app/(marketing)/components/hero.tsx`
- Modify: `src/app/(marketing)/components/problem.tsx`
- Modify: `src/app/(marketing)/components/journey.tsx`
- Modify: `src/app/(marketing)/components/built-for.tsx`
- Modify: `src/app/(marketing)/components/contact-form.tsx`

- [ ] **Step 1: Mobile responsive pass**

Go through each component and add responsive classes:

**Hero:** Change `max-w-[55%]` to `max-w-full md:max-w-[55%]`. Ensure headline clamp works at mobile sizes.

**Problem:** Text sizes from `text-2xl md:text-4xl` are already responsive. Verify scroll distance works on mobile.

**Journey:** Stages should stack vertically on mobile instead of alternating left/right. Change to `flex-col` below `md` breakpoint with all stages left-aligned.

**Built For:** Panels should stack on mobile: `flex-col md:flex-row` and `flex-col md:flex-row-reverse`. Visuals above text on mobile.

**Contact Form:** Grid from 2-col to 1-col on mobile: `grid-cols-1 md:grid-cols-2`.

- [ ] **Step 2: Accessibility pass**

- Verify all sections have semantic HTML (`<section>`, `<nav>`, `<footer>`, `<main>`)
- Add `aria-label` to sections where the content is animation-driven (Problem section)
- Verify `prefers-reduced-motion` is respected: particle mesh falls back to static, scroll animations snap instead of animate
- Ensure colour contrast meets WCAG AA for all text on all backgrounds
- Ensure the contact form has proper labels and focus states
- Ensure the canvas has `aria-hidden="true"` (already added)

- [ ] **Step 3: Test on narrow viewport**

Resize browser to ~375px width. Verify all sections render correctly, no horizontal scroll, text readable, form usable.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/
git commit -m "feat(marketing): responsive layout and accessibility improvements"
```

---

### Task 13: Visual Polish & Animation Refinement

**Files:**
- Modify: various components in `src/app/(marketing)/components/`

This task is where the @frontend-design skill should be used to elevate the visual quality beyond the structural scaffolding.

- [ ] **Step 1: Particle mesh polish**

Refine the particle system:
- Add spatial hashing for connection calculations if performance is an issue
- Smooth config transitions when `activeSection` changes (lerp between configs over ~500ms)
- Add subtle particle "breathing" — slow oscillation in opacity
- Ensure particle density is higher on the right side of the hero
- Test on lower-end devices and reduce particle count if needed

- [ ] **Step 2: Problem section disintegration polish**

Enhance the character disintegration:
- Add actual particle spawn from character positions (small divs or canvas overlay)
- Add slight random rotation to dissolving characters
- Make the reformed text entrance more dramatic — scale from 0.95 to 1.0 with a spring ease
- Fine-tune scroll timing so the transition feels smooth and intentional

- [ ] **Step 3: Journey section polish**

- Add trajectory curves (SVG paths) between stage dots instead of just the vertical line
- Animate the dots filling in as each stage activates
- Add subtle background particle density increase as stages progress (from scattered to structured)

- [ ] **Step 4: Built-for constellation visuals**

Implement the SVG constellation animations:
- Hiring: Central node with animated connections radiating outward
- Capability: Network graph with nodes at varying opacities and connection strengths
- Both should animate on viewport entry using CSS transitions on SVG elements

- [ ] **Step 5: Contact form success animation**

Implement the form-dissolves-to-particles success state:
- On successful submission, form elements dissolve (similar to problem section effect)
- Confirmation message fades in from particles assembling

- [ ] **Step 6: Overall animation timing review**

Scroll through the entire page and refine:
- Ensure no janky transitions between sections
- Verify the particle mesh colour transitions are smooth
- Check that scroll-driven animations feel responsive, not laggy
- Adjust timing curves, delays, and easing as needed

- [ ] **Step 7: Commit**

```bash
git add src/app/\(marketing\)/
git commit -m "feat(marketing): visual polish and animation refinement"
```

---

### Task 14: Route Configuration & Loading State

**Files:**
- Create: `src/app/(marketing)/loading.tsx`
- Potentially modify: routing configuration if root page conflicts

- [ ] **Step 1: Check for route conflicts**

Determine whether there's an existing `src/app/page.tsx` that would conflict with the marketing route group. If so, the marketing page needs to either replace it or be served conditionally based on hostname. Check the existing routing/domain configuration.

If there IS a root page conflict, the marketing route group may need to be served via hostname detection in middleware (e.g., `trajectas.com` → marketing layout, `admin.trajectas.com` → dashboard). Check if middleware already handles this pattern.

- [ ] **Step 2: Create loading state**

Create `src/app/(marketing)/loading.tsx`:

```tsx
export default function MarketingLoading() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ backgroundColor: "#1e4a3e" }}
    >
      <span
        className="text-lg font-bold tracking-tight animate-shimmer"
        style={{ color: "rgba(255, 255, 255, 0.6)" }}
      >
        Trajectas
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/loading.tsx
git commit -m "feat(marketing): add loading state and verify route configuration"
```

---

### Task 15: Final Integration Test & Cleanup

- [ ] **Step 1: Full build test**

Run: `npm run build`
Expected: Build succeeds with no errors. Fix any type errors or import issues.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: 0 warnings. Fix any linting issues.

- [ ] **Step 3: Full scroll-through on dev server**

Run: `npm run dev`
Complete a full scroll-through. Check:
- [ ] Particle mesh renders and responds to mouse
- [ ] Nav transitions correctly
- [ ] Hero animation plays on load
- [ ] Problem section text dissolves and reforms
- [ ] Journey section progresses through stages
- [ ] Built-for panels reveal on scroll
- [ ] Contact form submits and shows success
- [ ] Smooth scroll from nav CTA to contact
- [ ] No console errors
- [ ] No layout shifts or jank

- [ ] **Step 4: Mobile check**

Resize to 375px and repeat the scroll-through. Ensure everything is usable.

- [ ] **Step 5: Reduced motion check**

Enable "prefers-reduced-motion: reduce" in browser settings. Verify the site is fully functional without animations.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(marketing): complete marketing website v1"
```
