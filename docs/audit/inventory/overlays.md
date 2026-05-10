# App-wide overlays inventory

Generated: 2026-04-18

All counts verified by direct Grep on `src/`. Raw JSX tag matches only — `<ActionDialog`, `<ConfirmDialog`, etc. with word boundaries. Not callsite-counted (a file can host multiple instances).

## Summary

| Overlay type | Files | Status |
|--------------|------:|--------|
| `ActionDialog` | 20 | Primary modal primitive — app-wide migration complete |
| `ActionWizard` | 1 | Used by QuickLaunchModal only |
| `ConfirmDialog` | 40 | Standard destructive-action gate (internally built on ActionDialog) |
| `DialogContent` (legacy) | 1 | **Only remaining direct use is `src/components/ui/command.tsx` (CommandDialog base) — migration fully complete on app surfaces** |
| `Sheet` / `SheetContent` | 3 | Drawer-style panels (mobile nav + 2 app panels) |
| `Popover` | 7 | Mostly combobox/picker triggers |
| `DropdownMenu` (direct) | 6 | Direct callsites |
| `DataTableActionsMenu` (wraps DropdownMenu) | 15 | Row-actions across every data table — the real consumer count |
| `CommandDialog` | 1 | Global command palette |
| `Tooltip` | 15 files / 24 occurrences | Enumeration skipped |

**Migration status**: the ActionDialog migration is complete. No legacy `<Dialog>` / `<DialogContent>` usage remains outside the primitive files themselves (`dialog.tsx` for base + `command.tsx` for the command palette, which intentionally uses Dialog internally).

## ActionDialogs (single-step actions)

| # | File | Trigger / purpose |
|---|------|-------------------|
| 1 | `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` | Invite participant (×1), Bulk import (×1), Import issues display (×1) — 3 dialogs in this file |
| 2 | `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx` | Add assessment |
| 3 | `src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx` | Create access link |
| 4 | `src/app/(dashboard)/clients/[slug]/assessments/assessment-assignments.tsx` | Assign assessment (client) |
| 5 | `src/app/(dashboard)/clients/[slug]/settings/client-integrations-panel.tsx` | Create API credential + Add/Edit webhook endpoint — 2 dialogs in this file |
| 6 | `src/app/(dashboard)/partners/[slug]/assessments/partner-assessment-assignments.tsx` | Assign assessment (partner) |
| 7 | `src/app/(dashboard)/partners/[slug]/clients/partner-clients-table.tsx` | Assign client |
| 8 | `src/app/(dashboard)/report-templates/create-template-button.tsx` | New report template |
| 9 | `src/app/(dashboard)/users/invite-dialog.tsx` | Invite staff user (scope + role + tenant form) |
| 10 | `src/components/auth/session-expiry-warning.tsx` | Session expiring — stay signed in / sign out |
| 11 | `src/components/campaigns/launch-campaign-button.tsx` | Launch campaign chooser (new vs reuse) |
| 12 | `src/components/dimension-construct-linker.tsx` | Link dimensions/constructs |
| 13 | `src/components/flow-editor/add-page-dialog.tsx` | Add custom page to flow |
| 14 | `src/components/invite-member-dialog.tsx` | Invite team member (shared between client + partner portals) |
| 15 | `src/components/library-bulk-import-button.tsx` | Library bulk import (`size="xl"` variant) |
| 16 | `src/components/library-bundle-import-button.tsx` | Full library import (`size="xl"` variant) |
| 17 | `src/components/reports/send-report-button.tsx` | Send report email |
| 18 | `src/components/support-launch-button.tsx` | Start audited support session |
| 19 | `src/components/ui/confirm-dialog.tsx` | **Primitive** — ConfirmDialog is now built on ActionDialog |
| 20 | `src/components/campaigns/quick-launch-modal.tsx` | Uses ActionDialog shell for the wizard |

**Total ActionDialog callsites** (estimated, counting multi-dialog files): **~24 distinct dialog instances** across 20 files.

## Wizards (ActionWizard)

| # | File | Steps | Purpose |
|---|------|------:|---------|
| 1 | `src/components/campaigns/quick-launch-modal.tsx` | 3–4 (dynamic: Campaign → Assessment → [Capabilities] → Invite) | Guided new-campaign launch |

**Only one wizard currently.** Likely candidates for future migration to ActionWizard:
- Full library import (2-step "Prepare / Review" flow — currently uses a custom step toggle inside ActionDialog)
- Bulk library import (same)
- Staff invite (could be 3-step: scope → role → review)

## Confirmations (ConfirmDialog — 40 files)

Grouped by usage area for readability (not individually enumerated — too many):

| Area | Files | Typical use |
|------|------:|-------------|
| Library management (dimensions, factors, constructs, items) | ~6 | Delete entity |
| Campaign / assessment operations | ~9 | Remove assessment, delete campaign, remove participant, archive run |
| User / role management (invite, users, pending invites) | ~6 | Revoke invite, remove user |
| Branding / settings / email templates | ~5 | Unsaved changes warnings |
| Tables with row actions (clients, partners, users, reports, directory) | ~10 | Delete / archive / restore row |
| Other (generate run, library toolbar, etc.) | ~4 | Batch delete, reset, clear |

All ConfirmDialog callers now render through ActionDialog internally (since the primitive was migrated). Visual consistency is automatic.

## Sheets / Drawers

| # | File | Side | Purpose |
|---|------|------|---------|
| 1 | `src/components/ui/sidebar.tsx` | left | Mobile navigation drawer (responsive sidebar collapse) |
| 2 | `src/app/(dashboard)/generate/[runId]/pipeline-explainer-sheet.tsx` | right | "How the pipeline works" explainer (accordion-based) |
| 3 | `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx` | right | Live preview sheet for the report template builder |

Sheet usage is intentionally sparing — only where a sliding side-panel adds value (mobile nav, large preview, deep explainer). Not a candidate for ActionDialog migration — Sheet is a distinct overlay shape.

## Popovers

| # | File | Purpose |
|---|------|---------|
| 1 | `src/app/(dashboard)/users/invite-dialog.tsx` | `TenantCombobox` inside the staff-invite form |
| 2 | `src/components/dimension-construct-linker.tsx` | Entity search dropdown |
| 3 | `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx` | Block configuration context |
| 4 | `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` | Block-level text editing controls |
| 5 | `src/app/(dashboard)/report-templates/[id]/builder/add-block-dropdown.tsx` | "Add block" picker |
| 6 | `src/app/(dashboard)/users/[id]/user-detail-client.tsx` | User detail context actions |
| 7 | `src/app/(dashboard)/settings/models/model-picker-combobox.tsx` | AI model selection combobox |

**Pattern observation**: most Popover usages are combobox / picker patterns, not general contextual information. A shared `Combobox` primitive could replace ~4 of these if it doesn't exist yet.

## Dropdown menus

Direct `<DropdownMenu` callers (6 files):

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/data-table/data-table-actions-menu.tsx` | **The shared wrapper** — used by every data table row-action |
| 2 | `src/components/data-table/data-table-faceted-filter.tsx` | Faceted column filter for tables |
| 3 | `src/components/theme-toggle.tsx` | Light / dark / system theme picker |
| 4 | `src/components/library-selection-toolbar.tsx` | Bulk-action menu for library selections |
| 5 | `src/components/workspace-context-switcher.tsx` | Switch active workspace (staff portal) |
| 6 | `src/components/auth/account-menu.tsx` | Avatar → profile / sign-out menu |

**`DataTableActionsMenu` is used in 15 places** (every data table that has row actions):

- Participants tables (client, partner, admin — 3 places)
- Campaigns table, assessments table, report-templates table, users table, client-users table, partner-users table
- Directory tables (partner directory, client directory)
- Partner-clients table, partner-assessment-assignments, assessment-assignments

This means the **true "dropdown-menu surface" count is ~20+ distinct row-level menus across the app**, all backed by the same primitive. Consistency is high.

## Command palette

| File | Trigger | Purpose |
|------|---------|---------|
| `src/components/command-palette.tsx` (→ uses `src/components/ui/command.tsx`) | `Cmd+K` / `Ctrl+K` | Global command palette — portal-aware, navigation + quick actions |

## Tooltips

**15 files, 24 occurrences.** Enumerated locations include: data tables (faceted filter, health list, items, constructs), run-generation UI (quality panel, sortable item table), sidebar, flow-editor sidebar, reports table, participants tables (x3), users table (x2), assessments and campaigns-tables row tooltips.

Coverage is uneven — many icon-only buttons across the app likely need tooltips but don't have them. **This is a likely Phase 2 pattern finding** (accessibility + discoverability).

## Observations

1. **ActionDialog migration is complete on app surfaces.** The only remaining `<DialogContent>` is inside `src/components/ui/command.tsx` (CommandDialog's internal structure) — that's intentional and shouldn't change.

2. **ConfirmDialog is the most-used overlay by volume (40 files).** Because it now routes through ActionDialog internally, visual consistency comes for free across every destructive confirm.

3. **Only one ActionWizard exists.** Several existing flows (library imports, staff invite) could benefit from migrating their step logic to ActionWizard for consistent stepper / slide-transition / validation gating. Worth a sweep.

4. **Sheets are underused — intentionally.** Only 3 callers, all justified (mobile nav, explainer, preview). Nothing to migrate here.

5. **Popovers are almost entirely combobox patterns.** A dedicated `<Combobox>` primitive (if not already existing) would reduce 4–5 Popover callsites to thin wrappers and improve consistency.

6. **Dropdown usage is heavily centralised.** 15 data tables all use `DataTableActionsMenu` — a win for consistency. Direct `<DropdownMenu>` use is limited to 6 purpose-built places (theme, avatar, workspace switcher, faceted filter, library toolbar).

7. **Tooltip coverage likely uneven.** 15 files is low for an app with ~200+ interactive components. Phase 2 should look for icon-only buttons without tooltips.

## Taxonomy gaps

None — the framework's overlay taxonomy (modal-action / modal-wizard / modal-confirm / drawer-sheet / popover / dropdown-menu / command-palette / tooltip / context-menu) covers every type observed. No context menus (right-click menus) detected in the codebase — not a gap, just unused.
