# Resizable Panels Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-draggable split-panel layouts to the report builder and assessment item editor so users can see a live preview alongside the configuration panel — making the builder experience feel professional-grade.

**Architecture:** `react-resizable-panels` provides `<PanelGroup>`, `<Panel>`, and `<PanelResizeHandle>` primitives. Panels persist their size to `localStorage` via the `autoSaveId` prop. The report builder gets a horizontal split: config tree on left, live preview iframe/render on right. The item editor gets a vertical or horizontal split: item metadata on left, candidate-view preview on right.

**Tech stack:** `react-resizable-panels`

**Key reference files:**
- Report builder: `src/app/(dashboard)/report-templates/[id]/builder/` — read the builder client component
- Assessment item editor: search for item edit page in `src/app/(dashboard)/items/[id]/` or similar
- Existing preview component: search for `PreviewPanel` or similar in report builder

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install react-resizable-panels`
- [ ] Read `node_modules/react-resizable-panels/README.md` — confirm `PanelGroup`, `Panel`, `PanelResizeHandle` API and `autoSaveId` prop
- [ ] Confirm it is a client-only library (`"use client"` required)

### Phase 2 — Report builder split layout

- [ ] Read the report builder client component fully before editing
- [ ] Identify the current layout structure: is there already a left/right split, or is it a single column?
- [ ] Wrap the builder in `<PanelGroup direction="horizontal" autoSaveId="report-builder">`:
  - Left `<Panel defaultSize={35} minSize={20}>`: block tree / configuration panel
  - `<PanelResizeHandle>`: styled drag handle (12px wide, matches the current sidebar divider style)
  - Right `<Panel defaultSize={65} minSize={30}>`: live preview
- [ ] Style the resize handle to match the existing border/divider tokens — use `--border` CSS variable, add a visual drag affordance (two vertical lines or a grip icon)
- [ ] Confirm the preview panel scrolls independently from the config panel

### Phase 3 — Assessment item editor split layout

- [ ] Read the item editor page component before editing
- [ ] Identify what "candidate preview" would show — the rendered item stem + response options as a candidate would see them
- [ ] Create `src/components/item-preview.tsx` if it doesn't exist: renders a read-only view of the item using the same assessment runner styling
- [ ] Wrap the item editor in `<PanelGroup direction="horizontal" autoSaveId="item-editor">`:
  - Left `<Panel defaultSize={50} minSize={30}>`: item metadata form
  - `<PanelResizeHandle>`: styled drag handle
  - Right `<Panel defaultSize={50} minSize={25}>`: `<ItemPreview item={currentItem} />`
- [ ] Item preview should update in real-time as the user edits (if the current form uses controlled state this is free; if it uses server actions on blur, update the preview optimistically)

### Phase 4 — Collapse support

- [ ] Add `collapsible` and `collapsedSize={0}` to the preview panel in both builders — a collapse button in the panel header lets users go full-width edit mode
- [ ] Add a toggle button in the toolbar: "Show/hide preview" — sets `panelRef.collapse()` / `panelRef.expand()`
- [ ] Persist collapsed state via `autoSaveId`

### Phase 5 — Mobile / narrow viewport

- [ ] At viewport width < 768px, switch `<PanelGroup direction="horizontal">` to tabs (show config OR preview, not side by side)
- [ ] Use `useWindowSize` or a CSS container query to switch modes

---

## Acceptance criteria

- Report builder shows config panel and live preview side by side, draggable
- Item editor shows item form and candidate preview side by side, draggable
- Panel sizes persist across page reloads
- Preview panel can be collapsed to full-width edit mode
- On mobile, panels switch to a tab layout
