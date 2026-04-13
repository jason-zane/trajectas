# Keyboard Shortcuts Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts for power-user workflows — primarily in the assessment builder, item editor, and report builder — so I/O psychologists working for hours don't need to reach for the mouse for common actions.

**Architecture:** `react-hotkeys-hook` wraps `useEffect` + keyboard event listeners with a clean API, scope management, and `enableOnFormTags` for inputs. Shortcuts are scoped to route context (global shortcuts work everywhere; builder shortcuts only active when a builder is mounted). A keyboard shortcut reference panel is added to the command palette.

**Tech stack:** `react-hotkeys-hook`

**Key reference files:**
- Command palette: search for `cmdk` usage in `src/components/`
- Assessment builder: `src/app/(dashboard)/assessments/[id]/builder/` or similar
- Item editor: search for item edit page
- Report builder: `src/app/(dashboard)/report-templates/[id]/builder/`
- Existing save hooks: `useUnsavedChanges`, `useAutoSave`

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install react-hotkeys-hook`
- [ ] Read `node_modules/react-hotkeys-hook/README.md` — confirm `useHotkeys(keys, callback, options)` API and scope system
- [ ] Note: requires `"use client"` — do not use in Server Components

### Phase 2 — Global shortcuts

- [ ] Create `src/hooks/use-global-shortcuts.ts`:
  - `mod+k` → open command palette (may already be wired; check cmdk implementation and avoid double-binding)
  - `mod+/` → open keyboard shortcut reference panel
  - `Escape` → close any open dialog/sheet (check if base-ui already handles this — if so, skip)
- [ ] Mount `useGlobalShortcuts()` in the root dashboard layout

### Phase 3 — Save shortcut

- [ ] In pages with explicit save buttons (Zone 2 per save/persistence principles), add `mod+s` shortcut that programmatically clicks the save button
- [ ] Target surfaces: partner details form, construct form, campaign settings
- [ ] Do NOT add `mod+s` to auto-save (Zone 3) pages — it would be a no-op and confuse users
- [ ] Show a brief toast on `mod+s` in Zone 2 pages: `toast.info("Saving...")` if the save is in-flight

### Phase 4 — Assessment builder shortcuts

- [ ] Read the assessment builder component before implementing
- [ ] Add shortcut scope `"assessment-builder"` active when builder is mounted
- [ ] Shortcuts:
  - `mod+d` → duplicate selected item/block
  - `mod+backspace` → delete selected item (trigger `ConfirmDialog` — don't delete without confirmation)
  - `ArrowUp` / `ArrowDown` (with modifier, e.g., `mod+shift+up`) → reorder selected item up/down in the list
  - `mod+enter` → save current item and advance to next

### Phase 5 — Report builder shortcuts

- [ ] Add scope `"report-builder"` active when report builder is mounted
- [ ] Shortcuts:
  - `mod+d` → duplicate selected block
  - `mod+backspace` → remove selected block
  - `mod+p` → toggle preview panel (if resizable panels plan is implemented)
  - `[` / `]` → navigate to previous/next block in the tree

### Phase 6 — Shortcut reference panel

- [ ] Create `src/components/keyboard-shortcuts-panel.tsx`:
  - Renders a list of active shortcuts grouped by scope (Global, Builder, etc.)
  - Opens via `mod+/` global shortcut or a "?" button in the toolbar
  - Implemented as a Sheet (side drawer) with sections per scope
- [ ] Register shortcuts in a central `SHORTCUTS` constant so the panel is always in sync with what's actually registered

### Phase 7 — Conflict audit

- [ ] Grep for existing `keydown` event listeners or `onKeyDown` handlers in the codebase
- [ ] Confirm no conflicts with browser defaults (avoid `mod+w`, `mod+t`, `mod+n`)
- [ ] Confirm no conflicts with TipTap editor's built-in shortcuts when the editor is focused (`react-hotkeys-hook` `enableOnContentEditable: false` is the default — this is correct)

---

## Acceptance criteria

- `mod+k` opens command palette from any page
- `mod+s` triggers save on Zone 2 form pages
- Assessment builder reorder shortcuts move items without mouse
- Shortcut reference panel lists all active shortcuts
- No shortcut fires when focus is inside a TipTap editor
- No conflicts with browser built-in shortcuts
