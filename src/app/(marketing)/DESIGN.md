---
name: Trajectas public surface
description: The selection panel's wall — a position description and the capability library pinned on emerald baize, joined by thread.
---

<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Trajectas public surface

Governs the public site (`src/app/(marketing)`) and the public Role Builder.
The admin, partner and client portals keep `docs/ui-standards.md`; the
assessment runner keeps its own brand cascade. This file does not reach them.

## Overview

**Creative North Star: "The Panel's Wall"**

The public surface is the wall of a selection panel's room. The role is pinned
up as a document; the capability library is pinned beside it as an index of
cards; gold thread runs from the lines of the role to the few capabilities it
turns on; and the assessment that results is a single sheet further down the
wall. Everything the visitor reads is an object on that wall. The wall itself
is emerald baize, drenched: the brand colour is the material, not an accent.

The composition is two streams meeting. The role and the library run as two
columns split by one seam of thread; they exchange material across the seam;
downstream they merge into one measure. That is the product's mechanism drawn
literally, and it replaces both the page this category always ships (dark SaaS
hero, product screenshot, three feature cards) and its opposite (cream
broadsheet, italic serif, tracked mono eyebrows), which is what the previous
home page was.

Order, not clutter. A panel's wall is tidy: cards sit on a strict grid, threads
are few and deliberate, pins are small, nothing is scattered or tilted except a
stamp. The world is skeuomorphic in grammar (cards, pins, thread, stamps,
sheets) and flat in rendering (no photographic textures, no drop-shadow
theatre).

**Key Characteristics:**
- Emerald baize as the ground of every public page; reading happens on paper
  cards laid on it.
- One seam, a few threads: the visible relationship between role and
  capability is the signature.
- Cards on a grid, pins as punctuation, one stamp per page at most.
- Serif with authority for reading, monospace only for typed labels and
  measurements.

## Colors

Drenched: the ground is the brand emerald; paper, ink and gold are the only
other materials.

### Primary
- **Baize** (`#2d6a5a`, the brand emerald): the wall. Fills the whole ground of
  every public page. Never used as text.
- **Baize shadow** (`#224d41`): bars, footers and the backs of face-down cards;
  the same felt in shade.

### Secondary
- **Thread gold** (`#c9a962`, the brand gold): thread, pins, the primary
  button's fill, the active tier. Decorative and structural, never body text.
- **Gold ink** (`#8a6d2c`): gold when it must be read on paper — stamps,
  measurement labels on cards. Meets 4.5:1 on paper.

### Neutral
- **Paper** (`#fbfaf6`): cards, sheets, and display type set directly on the
  baize.
- **Paper edge** (`#e9e5db`): hairline rules inside a card; the shaded edge of
  a stack.
- **Ink** (`#1a1a1a`, the brand ink): all reading text on paper.
- **Ink soft** (`#4a4a45`): secondary text on paper.
- **Mint** (`#dbeadf`): secondary text set on the baize. Tinted from the hue,
  never grey.

### Named Rules
**The Paper Rule.** Prose is read on paper. Nothing longer than a lede is set
directly on the baize.

**The One Stamp Rule.** A page carries at most one stamp, and it says
something true about this role ("Recommended for this role"). A stamp is
never decoration.

**The Gold Is Not Text Rule.** Thread gold appears as line, dot, fill and
outline. When gold must be read, it is gold ink.

## Typography

**Display Font:** Libre Caslon Display (fallback: Georgia, serif)
**Body Font:** Libre Caslon Text (fallback: Georgia, serif)
**Label/Mono Font:** Courier Prime (fallback: "Courier New", monospace) — a typewriter face, because a label on a card is typed, not coded. Bold (700) for labels and stamped buttons, regular (400) for measurements.
**Wordmark only:** Plus Jakarta Sans 800, lowercase, per `docs/brand-identity.md`. Not used anywhere else on the public surface.

**Character:** Caslon is the face of the formal brief and the bound report — a
selection panel's reading material. The mono is the typed label on a card and
the measurement beside it, never a costume for "technical".

### Hierarchy (provisional sizes)
- **Display** (400, `clamp(2.75rem, 5vw, 4.5rem)`, 1.02, tracking -0.01em):
  one per page, set in paper on the baize.
- **Headline** (400, 2.5rem, 1.1): section heads, paper on baize, sentence
  case. No eyebrows above them.
- **Title** (700 Caslon Text, 1.125–1.25rem, 1.25): card titles, capability
  names.
- **Body** (400 Caslon Text, 0.9375–1.0625rem, 1.55): sheet and card prose,
  ink on paper, measure 60–70ch.
- **Label** (500 Geist Mono, 0.6875rem, tracking 0.12em, uppercase): typed
  card labels ("The role", "The library") and measurements ("6 items · 72 s").
  Used on cards and tags, not as section eyebrows.

### Named Rules
**The Typed Label Rule.** Monospace marks something typed onto a card or
measured: a label, a count, a duration, a code. It never introduces a section.

## Layout

A 12-column grid on a 1440 canvas with 96px outer margins and 24px gutters;
the seam sits on the centre gutter. The two-stream composition runs role (left
5 columns) | seam | library (right 5 columns), then merges into a full-width
sheet. Cards snap to the grid; only stamps rotate. Vertical rhythm is 8px;
more space above a heading than below it.

Below 1024px (Tailwind's `lg`) the streams stack: role, then library (as a wrapped index of
names), then the merged sheet. Threads are dropped, not shrunk; a single
vertical thread in the left margin keeps the pins connected. Type does not
shrink below the body size; the display drops to 2.75rem.

## Elevation & Depth

Objects on a wall. A card sits proud of the baize by a hairline edge and a
short, soft, offset shadow (`0 1px 0 rgba(0,0,0,.18), 0 6px 14px -8px
rgba(0,0,0,.45)`); a pinned card lifts by 2px and its shadow lengthens.
Face-down cards show baize shadow with a gold edge. No glass, no blur, no
glow, no halos. Depth otherwise comes from the baize weave (a 2–3% woven
texture drawn in CSS) sitting behind everything.

### Named Rules
**The Pin Rule.** Anything attached to the wall has a pin: a 10px gold dot
with a 1px offset shadow, placed on the card's top edge. Nothing floats.

## Shapes

Paper corners: 2px radius on cards and sheets, none on the wall. Buttons are
stamped tags: 2px radius, gold fill, ink mono caps. Thread is a 1.5px gold
line, curved between its two pins, never a straight connector with arrows.
Stamps are a 1.5px gold-ink outline, rotated 4–6°, multiplied onto the paper.
Face-down cards are the same rectangle in baize shadow with a 1px gold edge.

## Do's and Don'ts

### Do:
- **Do** fill the ground with baize; the emerald is the surface, not a stripe.
- **Do** put every paragraph on paper, and give the paper a pin.
- **Do** draw the role-to-capability relationship as thread whenever both are
  on screen; it is the product's argument.
- **Do** show live library counts as typed measurements on a tag.
- **Do** keep controls in the wall's vocabulary: stamped tags for buttons,
  paper strips for inputs, pinned cards for options.

### Don't:
- **Don't** tilt, scatter or overlap cards; the wall is a panel's, not a
  detective's. Only a stamp rotates.
- **Don't** use grain, gradients, glass or glow. Depth is edge and shadow.
- **Don't** put a mono eyebrow over section headings, or number sections.
- **Don't** set gold as text on paper; use gold ink.
- **Don't** invent evidence for the wall: no client names, quotes or
  statistics beyond the live library counts (see PRODUCT.md).
