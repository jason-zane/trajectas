# Navigation Restructure Design

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Admin sidebar reorganisation, platform settings breakout, AI configuration merge, account menu, coming-soon pattern

## Problem

The admin sidebar has grown to 9 groups and 22 items. Related features are scattered (Users in Settings, Psychometrics isolated from Library, AI Models and AI Prompts on separate pages). There is no distinction between platform configuration and day-to-day product work, and the account menu (top-right avatar) has no link to user-level settings.

## Design Principles

1. **Domain grouping** — items grouped by what they relate to, not when they were built.
2. **Settings live close to what they configure** — item selection rules belong in Assessments, not a global settings page. Response formats belong in Library. Only truly platform-wide config goes to Platform Settings.
3. **Separate building from configuring** — the main sidebar is for building and operating the product. Platform configuration lives behind a gear icon in a separate settings area.
4. **Coming-soon visibility** — planned features (Diagnostics) stay visible but greyed out with a badge, so the roadmap is always apparent.

## Admin Sidebar (6 groups, ~16 items)

### Overview
| Item | Route | Notes |
|------|-------|-------|
| Dashboard | `/` | Unchanged |

### Library
| Item | Route | Notes |
|------|-------|-------|
| Dimensions | `/dimensions` | Unchanged |
| Factors | `/factors` | Unchanged |
| Constructs | `/constructs` | Unchanged |
| Items | `/items` | Unchanged |
| Item Generator | `/generate` | Unchanged |
| Response Formats | `/response-formats` | Unchanged |
| Psychometrics | `/psychometrics` | **Moved from own group** — it is the feedback loop on the taxonomy |

Psychometrics sub-pages (Overview, Item Health, Reliability, Norms) are no longer individual sidebar items. The `/psychometrics` page uses a tab bar for internal navigation between sub-pages.

### Assessments
| Item | Route | Notes |
|------|-------|-------|
| Assessment Builder | `/assessments` | Unchanged |
| Report Templates | `/report-templates` | **Moved from Reports group** — route changed from `/settings/reports` to avoid collision with existing `/reports` snapshot viewer |
| Campaigns | `/campaigns` | Unchanged |
| Participants | `/participants` | Unchanged |

**Item Selection Rules** move out of Settings and into the Assessments section as a tab on the `/assessments` list page (alongside the assessment list). The rules are global (not per-assessment) — they govern how all assessments determine item counts based on construct count. The existing `RulesEditor` component is reused. No longer a standalone nav item or route.

### Diagnostics
| Item | Route | Notes |
|------|-------|-------|
| Templates | `/diagnostic-templates` | **Coming soon** — greyed out, non-clickable, badge |
| Sessions | `/diagnostics` | **Coming soon** — greyed out, non-clickable, badge |

### People
| Item | Route | Notes |
|------|-------|-------|
| Directory | `/directory` | **Moved from own group** |
| Users | `/users` | **Moved from Settings** — users are people, not platform config |

### AI Tools
| Item | Route | Notes |
|------|-------|-------|
| Chat | `/chat` | Unchanged |
| Matching Engine | `/matching` | Unchanged |

### Footer
A gear icon + "Platform Settings" link at the bottom of the sidebar, separated by a divider. Navigates to the settings area.

## Platform Settings (separate area)

Accessed via the gear icon at the bottom of the sidebar. Contains only platform-wide configuration.

**Layout**: Platform Settings routes remain under `(dashboard)/settings/`. The sidebar conditionally renders a settings-specific nav (just the three settings items + a "Back to platform" link) when the path starts with `/settings`. This avoids a separate route group — the `app-sidebar.tsx` component detects the settings context and switches its nav config.

| Item | Route | Notes |
|------|-------|-------|
| Brand | `/settings/brand` | Unchanged |
| Experience | `/settings/experience` | Unchanged |
| AI Configuration | `/settings/ai` | **New** — merged AI Models + AI Prompts |

### AI Configuration (merged page)

Replaces the current separate `/settings/models` and `/settings/prompts` pages with a single purpose-first interface at `/settings/ai`.

**List view** (`/settings/ai`):
- Grid or list of all 12 AI purposes (item generation, report narrative, competency matching, etc.)
- Each purpose card shows: purpose name, description, currently assigned model name, active prompt version
- "Apply model to all" bulk action available from this view
- OpenRouter credits widget remains (if management key is set)
- Embedding purpose shows "No prompt" since embeddings don't use system prompts

**Detail view** (`/settings/ai/[purpose]`):

For the `embedding` purpose, the detail page shows only the Model section. The System Prompt section is hidden and replaced with an explanatory note ("Embedding models do not use system prompts").

For all other purposes:
- Back link to AI Configuration list
- Purpose name and description at top
- **Model section**: current model with "Change" action opening the model picker combobox (existing component, reused)
- **System Prompt section**: prompt editor textarea, current version indicator, "Save as new version" button
- **Version history**: expandable/collapsible list of previous versions with restore/activate actions (existing UX, reused)
- Save patterns follow existing Zone 2 conventions

**Data model**: no schema changes required. `ai_model_configs` and `ai_system_prompts` tables remain as-is. The merge is purely a UI consolidation — both tables are already keyed by `purpose`.

**Migration path for routes**:
- `/settings/models` → redirect to `/settings/ai`
- `/settings/prompts` → redirect to `/settings/ai`
- `/settings/prompts/[purpose]` → redirect to `/settings/ai/[purpose]`
- `/settings/users` → redirect to `/users`
- `/settings/item-selection` → redirect to `/assessments` (rules tab)
- `/settings/reports` → redirect to `/report-templates`
- `/settings/reports/[id]` → redirect to `/report-templates/[id]`

## Account Menu (top-right avatar)

Currently shows name, email, and sign out. Adds a Profile link.

| Item | Action | Notes |
|------|--------|-------|
| Display name | Display only | Shown at top of dropdown |
| Email | Display only | Below name |
| Profile | Link to `/profile` | **New** — edit name, email, avatar |
| Sign out | Action | Unchanged |

Theme toggle remains in the header as a standalone control, not in the account menu.

**Profile page** (`/profile`): lives at `(dashboard)/profile/`. Minimal page for editing display name, email, and avatar. Not part of Platform Settings — it is user-level, accessible from any portal. The `(dashboard)` layout already handles auth for all portal types, so no special access logic is needed.

## Coming-Soon Nav Pattern

For nav items representing planned but unbuilt features:

- Item renders with reduced opacity (e.g. `opacity-40`)
- Non-clickable (no link, cursor default)
- Small inline badge: "Coming soon" in muted style
- Tooltip on hover explaining the feature is planned
- Applied to: Diagnostic Templates, Diagnostic Sessions

## Partner & Client Portal Impact

The partner and client portals are not affected by this restructure. Their nav configs in `app-sidebar.tsx` remain unchanged. The changes are scoped to the admin portal nav config.

## Migration Summary

| Item | From | To |
|------|------|----|
| Psychometrics (4 pages) | Own sidebar group | Library group |
| Report Templates | Reports group + `/settings/reports` | Assessments group, route to `/report-templates` |
| Item Selection Rules | Settings > Item Selection | Tab on `/assessments` list page (global rules) |
| Users | Settings > Users | People group, route to `/users` |
| Directory | Own sidebar group | People group |
| AI Models | Settings > AI Models | Platform Settings > AI Configuration |
| AI Prompts | Settings > AI Prompts | Platform Settings > AI Configuration |
| Brand | Settings > Brand | Platform Settings > Brand |
| Experience | Settings > Experience | Platform Settings > Experience |

## Out of Scope

- Partner/client portal navigation changes
- Redesign of individual page content (only nav placement changes)
- New features within Diagnostics (just the coming-soon state)
- Changes to the portal switcher or workspace context switcher
