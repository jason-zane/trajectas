@AGENTS.md

## UI/UX Standards — Premium Feel

Every page in this platform must feel premium and intentional. Follow these patterns for all new pages and components:

### Interactive Cards
- All clickable cards MUST use `variant="interactive"` on the `<Card>` component
- Wrap interactive cards in `<TiltCard>` (from `@/components/tilt-card`) for 3D perspective on hover
- Wrap cards in `<ScrollReveal delay={index * 60}>` (from `@/components/scroll-reveal`) for staggered entrance animations — never use hardcoded `stagger-N animate-fade-in-up` CSS classes
- Cards in grids should stagger with 60ms delay increments

### Icon Glow Effect
- Icon containers on cards should glow on hover: `group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300`
- Set `--glow-color` via inline style using the appropriate taxonomy/accent CSS variable
- Example: `style={{ "--glow-color": "var(--dimension-accent)" } as React.CSSProperties}`

### Typography Hierarchy
- Page titles: use `<PageHeader>` component with `eyebrow` prop for context (e.g., "Library")
- Section labels: use `.text-section` class
- Card entity names: use font-semibold (600 weight)
- Meta/counts: use `.text-caption` class
- Eyebrow labels: use `.text-overline` class with taxonomy-appropriate colour

### Colour Usage
- Never use raw hex/oklch values in components — always reference CSS variables or Tailwind utilities
- Use taxonomy colours (dimension/competency/trait/item) for entity-specific accents
- Use `--primary` for portal-aware accent (buttons, focus rings, eyebrows)
- Use `--brand` for brand-constant elements (sidebar, ambient glow)

### Toast Feedback
- All CRUD operations should show toast notifications via `sonner`
- Success: `toast.success("Entity created")` then navigate
- Error: `toast.error(message)` in addition to inline display

### Loading States
- Every route must have a `loading.tsx` that matches the page layout structure
- Use shimmer animation (`animate-shimmer`) not plain `animate-pulse`

### Dark Mode
- Every component must look correct in both light and dark mode
- Cards: shadow-driven in light, border-driven in dark
- Test both modes when building any UI
