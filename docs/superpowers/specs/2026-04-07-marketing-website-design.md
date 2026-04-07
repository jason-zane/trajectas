# Trajectas Marketing Website — Design Spec

## Overview

A single-page cinematic marketing website for Trajectas, living inside the existing Next.js 16 application as a new `/(marketing)` route group served on `trajectas.com`. The site introduces Trajectas as a contextual psychometric assessment platform through six full-viewport "scenes" connected by a continuous scroll narrative.

The visual identity centres on a **living data constellation** — a mouse-reactive particle mesh that persists across sections, evolving in density, colour, and behaviour as the user scrolls. Every section features distinct animation treatments: character disintegration, scroll-driven progression, constellation assembly, and particle dissolution.

The tone is **bold and provocative** — the copy challenges the assessment industry's status quo, names what's broken, and positions Trajectas as the alternative. Not warm, not playful, not apologetic.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structure | Single page, six scenes | Content doesn't justify multiple pages yet; cinematic scroll IS the wow factor; componentised for future breakout |
| Visual language | Data constellation | Particle networks reinforce measurement/mapping metaphor; mouse reactivity creates "alive" feeling |
| Tone | Bold, provocative | Challenges status quo; has a point of view; names what's broken directly |
| Typography | Plus Jakarta Sans + Instrument Serif (headlines) + JetBrains Mono (data/labels) | May simplify to Jakarta only if it feels like too much |
| Architecture | Inside existing Next.js app | New /(marketing) route group; shares codebase, fonts, build pipeline |
| Contact | Embedded form | Name, email, company, message; keeps users on-site; structured leads |
| Credibility section | Excluded for now | Add when there's social proof/case studies to pair with |

## Messaging Hierarchy

1. **Lead with outcomes** — what this does for your people and your decisions
2. **Support with clarity** — simple to understand, simple to act on
3. **Differentiate with context** — built for your org, not borrowed from someone else's
4. **Prove with rigour** — psychometric methodology, customisation, measurement over time

Core provocation: **Generic assessment measures nothing that matters.** The industry sells one-size-fits-all rulers. Trajectas builds the ruler around what actually matters to this organisation, these roles, this context. And the output is something people actually understand and use.

## Colour Palette

| Role | Value | Usage |
|------|-------|-------|
| Primary | `#2d6a5a` | Headlines, nav, buttons, key UI |
| Primary Dark | `#1e4a3e` | Dark sections, hero background, nav scrolled state |
| Accent Gold | `#c9a962` | Eyebrows, step numbers, hover states, submit button |
| Background | `#f8f6f1` | Warm off-white for light sections |
| Text | `#1a1a1a` | Body text on light backgrounds |
| Text Muted | Soft greys | Secondary text, descriptions |

## Typography

| Role | Font | Weight | Size | Style |
|------|------|--------|------|-------|
| Eyebrow | Plus Jakarta Sans | 200 (Thin) | 11px | Full caps, letter-spacing 0.15em, gold accent |
| Display headline | Instrument Serif | 400 | clamp(48px–80px) | Sentence case, white on dark |
| Section headline | Plus Jakarta Sans | 700 | 28–36px | Sentence case |
| Body | Plus Jakarta Sans | 400 | 15–16px | Regular line-height 1.6–1.7 |
| Data/labels | JetBrains Mono | 300 | 11px | Step numbers, stage markers, metadata |

Note: the serif and mono fonts are exploratory. If the visual weight feels excessive during implementation, simplify to Plus Jakarta Sans only.

## Global Visual System

### Particle Mesh Background

A canvas-based particle field that persists across sections as a continuous background layer.

- **Particles**: Hundreds of small nodes (1–4px), varying opacity (0.1–0.6), gold (`#c9a962`) on dark sections, primary green on light sections
- **Connections**: Fine lines drawn between particles within proximity range, very low opacity (0.05–0.15)
- **Mouse reactivity**: Particles within a radius of the cursor gently push away or gravitate — a magnetic wake effect as the mouse moves
- **Idle behaviour**: Particles drift slowly on their own; the field breathes even without interaction
- **Section adaptation**: Particle density, colour, speed, and connection behaviour evolve per section
- **Performance**: `requestAnimationFrame` loop, throttled connection calculations, efficient spatial hashing
- **Accessibility**: Respects `prefers-reduced-motion` — falls back to a static subtle gradient

### Scroll-Driven Animation

Multiple sections use scroll position (not time) to drive animations. This gives the user control over pacing and creates a physical connection between scrolling and content transformation.

Implementation: CSS scroll-driven animations where possible (Scroll Timeline API), with IntersectionObserver + scroll listener fallback for complex sequences.

## Section Specifications

### Section 1 — Navigation

**Purpose**: Minimal fixed nav. Logo and single CTA. The simplicity is intentional.

**Layout**:
- Fixed position, full width, high z-index
- "Trajectas" in Plus Jakarta Bold, left-aligned
- "Get in touch" as outlined button (1px border), right-aligned

**States**:
- **Over hero (initial)**: Transparent background, white text, white button border
- **Scrolled**: Background transitions in over ~200ms — frosted glass blur or solid dark (`#1e4a3e`)

**Mobile**: Same two elements, slightly smaller. No hamburger. No additional links.

### Section 2 — Hero

**Purpose**: First impression. Stop people. Establish the particle mesh. Deliver the provocation.

**Layout**: Full viewport height. Content left-aligned, vertically centred, occupying ~55–60% width. Particle mesh densest on the right side for visual weight balance.

**Content** (animates in sequentially):
1. **Eyebrow**: "CONTEXTUAL ASSESSMENT" — thin caps, gold. Fades in first.
2. **Headline**: Provocation statement (territory: "Generic assessment measures nothing that matters.") — Display serif, white. Animates in word-by-word or line-by-line with subtle upward slide.
3. **Subtext**: One to two sentences. The what-we-do line (territory: "Every organisation defines capability differently. Your assessment should too.") — Regular weight, white at ~60% opacity. Fades in after headline.
4. **CTA**: "Start a conversation" — solid primary green button, white text. Fades in last. Hover: background lightens or gold accent border appears.

**Scroll hint**: Subtle animated chevron or thin pulsing line at viewport bottom. Disappears on first scroll.

**Background**: Deep primary (`#1e4a3e`) with the living particle mesh. This is where the mouse-reactive behaviour is first experienced.

### Section 3 — The Problem

**Purpose**: Name what's broken in assessment today. The animation IS the argument — no other content needed.

**The effect — Text disintegration and reformation**:

Scroll-driven (not time-based). ~1.5–2x viewport height of scroll travel.

1. **Start state**: Generic assessment language displayed prominently, centre-aligned, in muted grey:
   - "Standardised competency frameworks"
   - "Norm-referenced percentile scores"
   - "One-size-fits-all benchmarks"
   - "Industry-standard personality profiles"

2. **Disintegration**: As the user scrolls, each phrase breaks apart character-by-character. Letters fragment into 3–5 particles each that scatter and drift upward into the particle field. Not a fade — actual fragmentation with physics.

3. **Reformation**: After generic language clears, new language assembles from converging particles:
   - "Your context"
   - "Your definition of capability"
   - "Measurement that drives decisions"
   - "Assessment that actually means something"

4. **Typography shift**: Generic text in muted grey → reformed text in white/primary green, bolder, more confident. The type treatment reinforces the message.

**Background transition**: During this section, the background shifts from dark (`#1e4a3e`) to warm off-white (`#f8f6f1`). Particles shift from gold-on-dark to primary-green-on-light.

### Section 4 — The Journey

**Purpose**: Walk the user through the Trajectas process. The scroll IS the journey — you don't read about movement, you experience it.

**Layout**: Sticky viewport positioning. Content transforms as the user scrolls through 3–4x viewport height of scroll distance. Four stages connected by trajectory lines.

**Stage 1 — "Where you are now"**:
- Particle field: scattered, disconnected, no clear structure
- Text: "Data without direction. Numbers that don't connect to decisions."
- Feeling: uncertain, unstructured

**Stage 2 — "Define the context"**:
- Particle field: nodes begin clustering, structure emerges, faint connection lines appear
- Text: "We learn your organisation. Your roles. Your definition of what good looks like."
- Feeling: structure forming

**Stage 3 — "Build the instrument"**:
- Particle field: nodes lock into a clear framework shape (radial or grid), connection lines solidify
- Text: "A tailored assessment, grounded in psychometric methodology. Shaped by your requirements."
- Feeling: purposeful, engineered

**Stage 4 — "Clarity"**:
- Particle field: resolves into something clean and simple — fewer nodes, stronger connections, clear hierarchy
- Text: "Insight that connects to decisions. Not just a score — a direction."
- Feeling: signal from noise

**Transitions**:
- A trajectory line (gold accent) draws itself from stage to stage as a smooth curve arcing across the viewport
- Stage numbers (01–04) in monospace, positioned as markers along the path
- Subtle background colour shift from warm neutral through to confident deep green

### Section 5 — Built For

**Purpose**: Two primary use cases — getting the right people in (hiring) and understanding the people you have (capability mapping).

**Panel 1 — "Hiring for critical roles"**:
- Layout: Content left, constellation visual right
- Eyebrow: "BUILT FOR" — thin caps, gold
- Headline: "Hiring for critical roles"
- Body: Territory of assessing candidates against your context, your roles, your definition of capability — not someone else's competency model
- Visual: Constellation assembles on scroll — particles converge on a focal point (the candidate), connection lines radiate to context nodes (role, team, org)

**Panel 2 — "Capability mapping"**:
- Layout: Content right, constellation visual left (mirrors panel 1)
- Headline: "Capability mapping"
- Body: Territory of mapping where people sit today against where the org needs them to be — not a snapshot, a living picture
- Visual: Network constellation — multiple nodes with varying connection strengths, some pulsing brighter (strengths), some dimmer with dotted connections (gaps)

**Secondary use cases**: Below the two panels, a minimal strip with "Development & progression" and "Team & leadership assessment" — text links or minimal cards. These earn full sections later when there's more content.

**Scroll behaviour**: Each panel enters with opacity fade + slight vertical shift. Constellation visuals assemble over ~800ms on viewport entry.

### Section 6 — Contact

**Purpose**: Close the loop. Invitation to start a conversation.

**Background**: Transitions to dark (`#1e4a3e`). Particle field calms — particles slow, connections become sparse and soft. The energy settles.

**Content** (centred, generous spacing):
- **Eyebrow**: "GET IN TOUCH" — thin caps, gold
- **Headline**: Territory of "Let's talk about what contextual assessment looks like for your organisation." — Display type, white. A statement, not a question.
- **Subtext**: "Tell us what you're working on."

**Form**:
- Four fields: Name, Email, Company, Message (textarea, 3–4 lines)
- Sharp styling: no rounded corners, fine 1px borders, generous padding
- Labels above fields in thin caps (matching eyebrow style)
- Submit: "Send" — solid gold accent background, dark text. Full or generous width.
- Hover: subtle brightness shift
- **Success state**: Form dissolves into particles (callback to problem section), replaced by "We'll be in touch." with subtle check animation

**Footer** (same dark background, below a fine 1px separator):
- "Trajectas" left, "© 2026 Trajectas" right
- Nothing else. No social links, no sitemap.

## Technical Architecture

### Route Structure

```
src/app/(marketing)/
  layout.tsx          — Marketing layout (own fonts, styles, no sidebar)
  page.tsx            — Single page with all six sections
  components/
    particle-mesh.tsx — Canvas-based particle system (client component)
    nav.tsx           — Fixed navigation with scroll state
    hero.tsx          — Hero section
    problem.tsx       — Text disintegration/reformation
    journey.tsx       — Scroll-driven stage progression
    built-for.tsx     — Use case panels with constellation visuals
    contact.tsx       — Contact form and footer
```

### Key Technical Considerations

- **Particle system**: HTML Canvas with `requestAnimationFrame`. Spatial hashing for efficient proximity checks. Mouse position tracked via `mousemove` listener on the canvas.
- **Scroll animations**: CSS Scroll Timeline API where supported, with IntersectionObserver + scroll listener fallback. The journey section uses sticky positioning with scroll-progress-based transforms.
- **Character disintegration**: Each character rendered as an individual DOM element or canvas text, with particle physics applied on scroll trigger. May use a hybrid approach — DOM for text rendering, canvas overlay for particle effects.
- **Form submission**: Server action posting to a contact/leads table in Supabase. Sends notification email via Resend.
- **Fonts**: Instrument Serif and JetBrains Mono loaded via `next/font/google` alongside the existing Plus Jakarta Sans.
- **Performance**: Particle count and connection calculations capped. Canvas resolution scaled to device pixel ratio but throttled on lower-end devices. All animations respect `prefers-reduced-motion`.
- **Mobile**: Particle effects simplified (fewer particles, no mouse reactivity — touch not applicable). Scroll-driven animations preserved but with reduced complexity. All sections stack to single column.

## Responsive Behaviour

- **Navigation**: Same layout, slightly smaller elements
- **Hero**: Headline scales down via clamp(). Content goes full width. Particle mesh simplified.
- **Problem**: Same scroll-driven effect, full width text
- **Journey**: Stages stack vertically along the central path line instead of alternating left/right
- **Built For**: Panels stack to single column. Visuals sit above their text content.
- **Contact**: Form fields stack to single column
- **Footer**: Same layout

## What's Excluded (For Now)

- Pricing page
- Methodology/white papers
- Case studies
- Blog
- Credibility/bio section
- Multiple pages (future breakout when content warrants it)
- Features not yet built (org-diagnostic matching, etc.)

## Open Questions

1. **Final headline copy**: The provocation territory is established ("Generic assessment measures nothing that matters") but the exact wording needs refinement during implementation
2. **Font decision**: Instrument Serif + JetBrains Mono are exploratory — may simplify to Plus Jakarta Sans only if the visual weight is too much
3. **Form backend**: Supabase table + Resend notification assumed — needs confirmation on email routing (hello@trajectas.com?)
4. **Domain routing**: Confirm `trajectas.com` serves the marketing route group while subdomains serve the platform surfaces
