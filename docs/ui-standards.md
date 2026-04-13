# UI/UX Standards — Premium Feel

Every page in this platform must feel premium and intentional. Follow these patterns for all new pages and components:

## Interactive Cards
- All clickable cards MUST use `variant="interactive"` on the `<Card>` component
- Wrap interactive cards in `<TiltCard>` (from `@/components/tilt-card`) for 3D perspective on hover
- Wrap cards in `<ScrollReveal delay={index * 60}>` (from `@/components/scroll-reveal`) for staggered entrance animations — never use hardcoded `stagger-N animate-fade-in-up` CSS classes
- Cards in grids should stagger with 60ms delay increments

## Icon Glow Effect
- Icon containers on cards should glow on hover: `group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300`
- Set `--glow-color` via inline style using the appropriate taxonomy/accent CSS variable
- Example: `style={{ "--glow-color": "var(--dimension-accent)" } as React.CSSProperties}`

## Typography Hierarchy
- Page titles: use `<PageHeader>` component with `eyebrow` prop for context (e.g., "Library")
- Section labels: use `.text-section` class
- Card entity names: use font-semibold (600 weight)
- Meta/counts: use `.text-caption` class
- Eyebrow labels: use `.text-overline` class with taxonomy-appropriate colour

## Colour Usage
- Never use raw hex/oklch values in components — always reference CSS variables or Tailwind utilities
- Use taxonomy colours (dimension/competency/trait/item) for entity-specific accents
- Use `--primary` for portal-aware accent (buttons, focus rings, eyebrows)
- Use `--brand` for brand-constant elements (sidebar, ambient glow)

## Toast Feedback
- All CRUD operations should show toast notifications via `sonner`
- Success: `toast.success("Entity created")` — stay on page, don't navigate
- Error: `toast.error(message)` in addition to inline display
- Delete: `toast.success("Entity deleted", { action: { label: "Undo", onClick: ... }, duration: 5000 })`

## Loading States
- Every route must have a `loading.tsx` that matches the page layout structure
- Use shimmer animation (`animate-shimmer`) not plain `animate-pulse`

## Dark Mode
- Every component must look correct in both light and dark mode
- Cards: shadow-driven in light, border-driven in dark
- Test both modes when building any UI

# Save & Persistence Principles

1. **ZONES**: Every page is Zone 1 (immediate), Zone 2 (explicit save), or Zone 3 (auto-save). Never mix zones — except: text areas on a Zone 2 page may auto-save (Zone 3) if they're visually distinct from structural controls.
2. **FEEDBACK**: Every mutation produces a toast. Success = green, error = red (persistent), undo = includes action button. Auto-save fields use inline indicators ("Saving..." / "Saved") instead of toasts.
3. **STAY**: Explicit save keeps the user on the page. Only navigate away on explicit user action. For creates, use `router.replace()` to switch to the edit URL.
4. **WARN**: Unsaved structural changes trigger a dialog on navigate-away via `useUnsavedChanges` hook. Auto-saved fields don't participate in this check.
5. **DELETE**: `ConfirmDialog` → soft-delete (`deleted_at` column) → toast with undo (5s) → redirect after timeout. Never hard-delete from UI.
6. **TOGGLES**: Imperative controls (switches, toggles) take effect immediately with toast confirmation. No save button. Use dedicated `toggle*Active()` server actions.
7. **AUTO-SAVE TEXT**: Description, definition, indicator, stem, and instruction fields auto-save on blur + 3s debounce via `useAutoSave` hook. Inline `AutoSaveIndicator` component. No save button needed for these fields. Only active in edit mode.
8. **ERRORS**: Inline banner + toast for explicit saves. Inline indicator + persistent error state for auto-save fields. Never auto-dismiss errors.
9. **SAVE BUTTON**: Label transitions: "Save Changes" → "Saving..." → "Saved" (2s) → back to normal. Disabled during saved state.
