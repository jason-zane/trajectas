# Phase 1 master catalogue

Generated: 2026-04-18
Consolidates: `client-portal.md`, `partner-portal.md`, `admin.md`, `participant.md`, `primitives.md`, `overlays.md`

## App at a glance

| Surface | Pages | Route group |
|---------|------:|-------------|
| Admin (staff) portal | 97 | `src/app/(dashboard)/` |
| Client portal | 21 | `src/app/client/` |
| Partner portal | 21 | `src/app/partner/` |
| Participant assessment flow | 13 | `src/app/assess/` |
| **Total authenticated + public pages** | **152** | |

Plus:
- **30 UI primitives** (`src/components/ui/`) — 6 use cva, 1 is dead code (`scroll-area.tsx`)
- **38 top-level reusables** (`src/components/`) — layout chrome, overlays, feature modals, workspace composition
- **3 ActionDialog-family primitives** (`src/components/action-dialog/`) — now the canonical modal stack

## Inventory index

| # | File | Scope | Status |
|---|------|-------|--------|
| A1 | [client-portal.md](./client-portal.md) | 21 client-portal pages, 13 overlay triggers, sub-navigation map | ✅ |
| A2 | [partner-portal.md](./partner-portal.md) | 21 partner-portal pages, 10 overlay triggers | ✅ |
| A3 | [admin.md](./admin.md) | 97 admin pages across 14 sections, 13 nested layouts | ✅ |
| A4 | [participant.md](./participant.md) | 13-page assessment flow with 8 preliminary UX observations | ✅ |
| A5 | [primitives.md](./primitives.md) | 30 UI primitives + 38 reusables, usage counts, gap findings | ✅ |
| A6 | [overlays.md](./overlays.md) | App-wide overlay inventory (ActionDialog, Confirm, Sheet, Popover, Dropdown, Tooltip, Command) | ✅ |

## Cross-portal patterns

### Shared shells (high consistency)

1. **`WorkspaceShell`** is the single top-level shell for all three authenticated portals (admin, client, partner). Each portal passes its mode into the shell, which renders the appropriate sidebar sections + header chrome. This is a major consistency win — the portal chrome is unified.

2. **`SessionActivityProvider` + `SessionExpiryWarning`** are mounted at every portal's root layout — idle-timeout handling is uniform app-wide.

3. **`CampaignDetailShell`** is shared between admin and client portals for `/campaigns/[id]/*` routes (6 sub-tabs: Overview · Assessments · Settings · Branding · Experience · Participants). The partner portal has its own `/partner/campaigns/[id]` shape (different — no sub-tabs, single detail page with inline sections).

4. **`ClientDetailShell` / `PartnerDetailShell`** are used by admin for staff-level drill-in into client/partner orgs.

### Shared overlay primitives (high consistency)

- Every destructive action across the app routes through **`ConfirmDialog`** (40 consumer files), which now renders internally via `ActionDialog` — visual consistency is automatic.
- Every data-table row-action menu uses **`DataTableActionsMenu`** (15 table callsites) — consistent ellipsis behaviour across ~20+ row-level menus app-wide.
- **`CommandPalette`** is mounted once globally and triggered by `Cmd+K` / `Ctrl+K` everywhere.

### Theme / light-forced surfaces

Three contexts force light theme regardless of user preference:

| Portal | Route | Reason |
|--------|-------|--------|
| Client | `/client/campaigns/[id]/overview` | Campaign overview always light for consistent metric visuals |
| Client | `/client/reports/[snapshotId]` | Report snapshots always light (print parity) |
| Admin | `/campaigns/[id]/overview` | Matches client-portal behaviour |
| Admin | `/reports/*` | All report views |
| Admin | `/settings/brand` preview | Brand editor preview context |
| Participant | `src/app/assess/**` | All participant-facing assessment pages |

Phase 2 implication: the dark-mode evaluation criterion is N/A for these surfaces.

### Dynamic-router catch-alls (client + partner only)

- `/client/[[...slug]]` → `WorkspacePortalPage` / `WorkspacePortalLivePage`
- `/partner/[[...slug]]` → same
- `/partner/diagnostics/[id]` → same

These routes are **config-driven** (workspace portal pages authored in config, not in page.tsx). Phase 2 scoring should cascade to the rendering component, not the thin route file.

## Divergences & asymmetries

### Admin portal has features the sub-portals don't

- **Library** (dimensions/constructs/factors/items/response-formats) — only in admin
- **Platform-level settings** (AI, Prompts, Models, Email templates, Experience, Item selection) — only in admin
- **Diagnostics** + **Generate** — internal tooling, admin only
- **Directory** — cross-tenant visibility, admin only
- **Matching** — admin only
- **Chat** — admin only

### Client portal has 2 stub pages

- `/client/diagnostics/[id]` — always `notFound()` — feature not implemented
- `/client/diagnostic-results/[id]` — always `notFound()` — feature not implemented

These are placeholders. Phase 2 should skip them and flag for deletion or implementation.

### Sub-navigation differs by entity shape

- **Campaigns** use a tab-shell (`CampaignDetailShell`) — same in admin + client.
- **Clients (staff)** use tab-shell (`ClientDetailShell`) — admin only.
- **Partners (staff)** use tab-shell (`PartnerDetailShell`) — admin only.
- **Reports** have no tab shell — flat list of sub-routes.
- **Settings** (admin) has no tab shell — navigated via cards from the `/settings` index page.
- **Participants** use tab shell for detail (sessions / activity / snapshots) via `ParticipantDetailView` component, not a layout.

## Commonality heatmap (Phase 2 screenshot scope)

For each surface type, where it appears:

| Surface type | Admin | Client | Partner | Participant |
|--------------|:-----:|:------:|:-------:|:-----------:|
| `dashboard` | ✓ (2) | ✓ (1) | ✓ (1) | — |
| `listing` | ✓ (~24) | ✓ (5) | ✓ (5) | — |
| `detail` | ✓ (~24) | ✓ (7) | ✓ (8) | ✓ (several) |
| `editor` | ✓ (~33) | ✓ (3) | ✓ (4) | — |
| `form` (single-step) | — | — | — | ✓ (3) |
| `wizard` (page-level) | — | — | — | ✓ (section) |
| `print-export` | ✓ (3) | ✓ (1) | ✓ (2) | ✓ (1) |
| `redirect` | ✓ (1) | ✓ (1) | — | ✓ (1) |
| `dynamic-router` | — | ✓ (1) | ✓ (2) | — |
| `error-page` | — | ✓ (2 stubs) | — | ✓ (1) |

**Phase 2 screenshot approach**: sample ~3 pages per surface-type per portal to avoid diminishing returns. Capture every `dashboard` and `error-page` (low count, high signal). For `editor` and `listing`, 3 examples each per portal yields good coverage.

## Priority findings from Phase 1

These are catalogued now and should be scored in Phase 2 (not fixed in Phase 1):

### High-priority UX findings

1. **Participant flow lacks step indicators on consent/demographics/intro pages.** Disorienting for long flows. See `participant.md` §1.
2. **Mobile experience for participant flow is unaudited.** ~50%+ of assessments are likely taken on mobile. Warrants a dedicated mobile audit (own session).
3. **No explicit breadcrumbs anywhere.** "Where am I" context is carried by sidebar + page header only. Breadcrumbs primitive exists (`breadcrumbs.tsx`) but is rarely used. See `client-portal.md` §Navigation.
4. **Tooltip coverage is uneven.** 15 files / 24 occurrences across 200+ interactive components. Likely icon-only buttons without accessible tooltips.

### High-priority taxonomy / primitive findings

5. **Alert is missing semantic variants.** Only `default` and `destructive`. Many surfaces hand-roll warning/info banners (quota warning, import-issues, etc.). Phase 2: add `warning` / `info` / `success` variants, migrate.
6. **No `Combobox` primitive.** 5+ Popover callsites implement combobox patterns manually. Phase 2: consolidate.
7. **Card uses ad-hoc variant typing instead of cva.** Consistency gap — other primitives with variants use cva. Low-priority cleanup.
8. **ScrollArea is dead code.** Delete or adopt. Don't leave floating.

### Architectural / content findings

9. **Client portal has 2 stub pages** (`diagnostics/[id]`, `diagnostic-results/[id]`). Delete or implement.
10. **Assessment flow is redirect-heavy with no perceived-performance scaffolding.** Slow connections will feel laggy. Phase 2: evaluate skeletons.
11. **Only 1 ActionWizard exists** (QuickLaunchModal). Library bulk import, library bundle import, and staff invite could benefit from migration to ActionWizard for consistent stepper UX.

## What's deferred to Phase 2

Phase 1 is pure cataloguing — no scoring, no screenshots, no comparative judgements. Phase 2 will:

1. **Capture screenshots** per surface type (~3 per type per portal as a sampling heuristic)
2. **Score against the 17-criterion rubric** (A1–A5 visual, B1–B5 interaction, C1–C4 navigation, D1–D3 quality)
3. **Perform deep dives** on the participant flow (its own mini-audit, including mobile)
4. **Produce a prioritised findings doc** with confidence-weighted recommendations

## What's deferred to Phase 3

- Remediation PRs per finding, sized and sequenced by impact × effort
- Primitive gap-fills (Combobox, Alert variants, ScrollArea decision)
- Participant-flow UX improvements (step indicators, skeletons, mobile parity)

## Incomplete

None at Phase 1. Every inventory file is complete and verified by direct Grep/Glob on `src/`. Ready to scope Phase 2.
