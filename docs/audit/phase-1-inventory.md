# Phase 1 — Inventory

Goal: produce a complete, structured catalogue of every surface in the in-scope portals, plus screenshot coverage of every state.

**This is pure cataloguing work, no evaluation.** Save judgment for Phase 2.

---

## How autonomous runs work

Each task below is a **self-contained prompt** designed to run in a single scheduled Claude agent session. Pattern:

1. You create a Claude schedule (via `/schedule` or `CronCreate`) with the task prompt as input
2. Schedule fires overnight
3. Agent reads this doc + framework.md, executes the task, commits artifacts, pushes, and exits
4. You review the commit next morning; if off, you revise the prompt or the framework

**Schedule naming convention**: `audit-<phase>-<task-id>` — e.g. `audit-1-A1` for Task A1.

**Branch convention**: each task commits to `claude/audit-inventory-<portal>` — multiple tasks for the same portal share a branch.

---

## Task suite overview

| Task | What | Target | Output | Est. duration |
|------|------|--------|--------|---------------|
| **A1** | Enumerate client portal pages | `src/app/client/**/page.tsx` | `inventory/client-portal.md` | 60–90 min |
| **A2** | Enumerate partner portal pages | `src/app/partner/**/page.tsx` | `inventory/partner-portal.md` | 60–90 min |
| **A3** | Enumerate admin/staff pages | `src/app/(dashboard)/**/page.tsx` | `inventory/admin.md` | 90–120 min |
| **A4** | Enumerate participant assessment UI | `src/app/assess/**/page.tsx` and related | `inventory/participant.md` | 45–60 min |
| **A5** | Enumerate component primitives | `src/components/ui/*.tsx` + `src/components/*.tsx` | `inventory/primitives.md` | 60–90 min |
| **A6** | Enumerate overlays (modals / sheets / popovers) | app-wide search | `inventory/overlays.md` | 60 min |
| **B1** | Screenshot client portal (all states, both themes) | routes from A1 | `screenshots/client/**/*.png` | 90–120 min |
| **B2** | Screenshot partner portal | routes from A2 | `screenshots/partner/**/*.png` | 90–120 min |
| **B3** | Screenshot admin portal | routes from A3 | `screenshots/admin/**/*.png` | 90–120 min |
| **B4** | Screenshot participant UI | routes from A4 | `screenshots/participant/**/*.png` | 60 min |
| **C1** | Consolidate inventories into master catalogue | all `inventory/*.md` | `inventory/_master.md` | 30 min |

**Priority order**: A1 → A5 → A6 → B1 → A2 → A3 → B2 → B3 → A4 → B4 → C1.

Client-portal outputs (A1, B1) are the priority. A5 and A6 are shared prerequisites for every portal's Phase 2.

---

## Global prompt preamble

Prepend this to every task prompt below:

```
You are executing an audit inventory task for the Trajectas codebase.

Before doing anything:
1. Read /docs/audit/README.md (overview)
2. Read /docs/audit/framework.md (surface taxonomy — Part 1)
3. Confirm you are on a branch named `claude/audit-inventory-<portal>` (create it from main if needed)

Working rules:
- Commit your output to the branch specified in the task
- Push at the end; do not create a PR
- Do NOT evaluate quality. Catalogue only.
- If you find a surface that doesn't fit the existing taxonomy, flag it at the bottom of your output under "## Taxonomy gaps" — do not invent a new type silently.
- If the target directory has ≥ 40 pages, process in passes and commit incrementally so progress is not lost if you run out of time.
- If you cannot finish, commit what you have with a `## Incomplete` section listing what's still to do. A subsequent scheduled run can pick up from there.
```

---

## Task A1 — Client portal page inventory

**Schedule name**: `audit-1-A1`
**Branch**: `claude/audit-inventory-client`
**Est. duration**: 60–90 min

### Prompt

```
<global preamble>

## Task A1 — Client portal page inventory

Target: every page under `src/app/client/` (including nested routes)

Produce `docs/audit/inventory/client-portal.md` with this structure:

# Client portal inventory
Generated: <YYYY-MM-DD>
Source: src/app/client/

## Summary
- N pages found
- Grouped: X dashboard, Y listing, Z detail, W editor, V other
- Route depth: shallow (≤2) / nested (3+) — note any deeply nested paths

## Pages
A markdown table with columns:
| # | Route | File | Surface type | Interactive elements | States to capture |

Rules for each column:
- Route: the URL path (e.g. `/client/campaigns/[id]/participants`)
- File: path relative to repo root
- Surface type: one of the types in framework.md Part 1. If ambiguous, pick closest + add note.
- Interactive elements: a concise list (e.g. "invite-participant button, bulk-import button, participant data-table with row actions"). Don't paste code — describe.
- States to capture: pick from {loaded, empty, loading, error, unauthenticated}. Only list states that actually render differently.

## Overlays triggered from this portal
Same format as in framework.md Part 3.

## Navigation surface
Describe the sidebar / top nav / breadcrumbs the portal uses. Reference the component file.

## Taxonomy gaps
List any surfaces that did not fit the taxonomy. One line per gap.

At the end, commit to the branch with message:
"audit(phase-1): client portal page inventory"
and push.
```

### Done criteria

- Every `page.tsx` under `src/app/client/` appears in the table
- Every row has all 6 columns filled
- File is committed and pushed to `claude/audit-inventory-client`

---

## Task A2 — Partner portal page inventory

**Schedule name**: `audit-1-A2`
**Branch**: `claude/audit-inventory-partner`
**Est. duration**: 60–90 min

Same shape as A1, targeting `src/app/partner/` → `inventory/partner-portal.md`.

---

## Task A3 — Admin/staff page inventory

**Schedule name**: `audit-1-A3`
**Branch**: `claude/audit-inventory-admin`
**Est. duration**: 90–120 min

Target: `src/app/(dashboard)/` (the main authenticated admin surface)
Output: `inventory/admin.md`

**Additional note for A3**: this portal has ~60 pages. If you run out of time, commit partial progress and add an `## Incomplete` section listing routes still to audit. The next scheduled run can pick up by reading the file and only processing the listed routes.

---

## Task A4 — Participant assessment UI inventory

**Schedule name**: `audit-1-A4`
**Branch**: `claude/audit-inventory-participant`
**Est. duration**: 45–60 min

Target: `src/app/assess/`, `src/app/(participant)/`, and any participant-only routes.
Output: `inventory/participant.md`

**Additional note for A4**: this is a high-stakes, public-facing surface. Flag any UX concerns you notice incidentally (even though evaluation is Phase 2) under a `## Preliminary observations` section — they'll feed the mini-audit.

---

## Task A5 — Component primitives inventory

**Schedule name**: `audit-1-A5`
**Branch**: `claude/audit-inventory-primitives`
**Est. duration**: 60–90 min

Target: every `.tsx` file under `src/components/ui/` and `src/components/` (excluding page-specific components).

Output: `docs/audit/inventory/primitives.md` with this structure:

```markdown
# Component primitives inventory
Generated: <YYYY-MM-DD>

## Summary
- N primitive components found

## Primitives
| # | Component | File | Variants | Sizes | States | Notes |
|---|-----------|------|----------|-------|--------|-------|
| 1 | `Button` | `src/components/ui/button.tsx` | default, outline, ghost, destructive, secondary, link | xs, sm, default, lg, icon-* | hover, focus, active, disabled, loading | Used ~200x across app |

For each primitive, report:
- All exported variants (look at cva() config or variant prop type)
- All exported sizes
- States it supports (enabled/disabled at minimum; hover/focus/active for interactive; loading if async)
- Approximate usage count (grep caller count, rough order of magnitude)

## Custom / app-specific components
Components in `src/components/` (not under `ui/`) that aren't primitives but are reusable. Lighter touch — name + file + one-line purpose only.

## Taxonomy gaps
Any interactive element in `src/components/ui/` that wasn't covered in framework.md Part 1's "Within-page" or "Overlay" categories.
```

---

## Task A6 — Overlay inventory (modals, sheets, popovers, menus)

**Schedule name**: `audit-1-A6`
**Branch**: `claude/audit-inventory-overlays`
**Est. duration**: 60 min

Goal: every overlay in the app, regardless of which portal triggers it.

Search patterns:
- `<ActionDialog` (post-migration)
- `<Dialog` (if any legacy remains — flag for migration)
- `<Sheet` / `<Drawer`
- `<Popover` (excluding tooltip usage)
- `<DropdownMenu`
- `<AlertDialog` (if any)
- `<CommandDialog`

Output: `docs/audit/inventory/overlays.md`:

```markdown
# Overlays inventory

## ActionDialogs (single-step modal actions)
| # | Trigger | File | Purpose | Complexity |

## ActionWizards (multi-step modal flows)
| # | Trigger | File | Steps | Purpose |

## ConfirmDialogs
| # | Trigger location | Purpose | Variant (destructive/default) |

## Sheets / Drawers
| # | Trigger | File | Side | Purpose |

## Popovers
| # | Trigger | File | Purpose |

## Dropdown menus
| # | Trigger | File | Action count | Location (row action / header action / avatar) |

## Legacy / unmigrated overlays
If any `DialogContent` not from ActionDialog still exists, list it here as a migration gap.

## Command palette
Current state of `CommandDialog` usage. Expected: kept as-is per the ActionDialog migration decision.
```

---

## Task B1 — Client portal screenshot capture

**Schedule name**: `audit-1-B1`
**Branch**: `claude/audit-inventory-client`
**Est. duration**: 90–120 min
**Prerequisite**: A1 complete (uses the inventory as the list of routes to capture)

### Prompt

```
<global preamble>

## Task B1 — Client portal screenshot capture

Prerequisite: read `docs/audit/inventory/client-portal.md`. If it does not exist, abort and log a message — A1 must complete first.

Tools: use Playwright (already configured for this repo — see `playwright.config.ts` and `e2e-seeded.yml`).

For each row in the inventory's Pages table, capture the following states (only the ones listed in the "States to capture" column):

### State capture protocol

- **loaded** — normal signed-in view with seeded data
- **empty** — log in as a user with no data for this page (see `e2e-seeded.yml` seed personas), OR inject a query param that empties the view if the route supports it
- **loading** — capture before data arrives; use Playwright `page.route()` to delay the API call
- **error** — inject a server error via `page.route()` stubbing the data action to return 500

For each state, capture:
- Light mode
- Dark mode (toggle via the theme switcher)
- Desktop viewport (1440×900)
- If the route is expected to work on mobile, also capture at 390×844

File naming:
`docs/audit/screenshots/client/<route-slug>/<state>-<theme>-<viewport>.png`

Example: `docs/audit/screenshots/client/dashboard/loaded-light-desktop.png`

### Working strategy

- Launch a Playwright test script saved to `docs/audit/screenshots/_capture-client.ts` (DO NOT add to the test suite — this is a one-off capture runner)
- Use the seeded auth helper from `tests/e2e/` to log in
- If any route cannot be reached (auth failure, missing seed data, etc.), log it in a `_capture-log.md` file in the screenshots directory; do not stop
- Commit all `.png` files (they're small)
- At the end, commit with message:
  "audit(phase-1): client portal screenshots"

### Done criteria

- Every page from the inventory has at least `loaded-light-desktop.png`
- If the inventory listed `empty` / `loading` / `error` states, those are also captured
- `_capture-log.md` exists with success/failure per route
```

---

## Task B2 — Partner portal screenshot capture

Same shape as B1, for partner portal. Prerequisite: A2 complete.

## Task B3 — Admin portal screenshot capture

Same shape as B1, for admin portal. Prerequisite: A3 complete. **Expected to be the longest task — likely needs to be split across 2 nights.**

## Task B4 — Participant UI screenshot capture

Same shape as B1, for participant flows. Prerequisite: A4 complete.

---

## Task C1 — Consolidated master catalogue

**Schedule name**: `audit-1-C1`
**Branch**: `claude/audit-inventory-all` (new branch, merges all inventory branches first)
**Est. duration**: 30 min
**Prerequisite**: all A-tasks complete

### Prompt

```
<global preamble>

## Task C1 — Consolidate inventories

Read every file in `docs/audit/inventory/` and produce `docs/audit/inventory/_master.md`:

# Master audit inventory

## Totals
- N pages total across all portals
- M overlays
- P primitives

## Pages by portal
Links to each portal's inventory file, plus headline count.

## Cross-cutting observations
Things you noticed that span multiple portals — e.g. "All three portals use a dashboard-style landing but each uses a different primary-action pattern."

DO NOT evaluate. Just observe structural similarities/differences.

## Phase 2 surface queue
A flat list of `(portal, surface)` tuples in recommended evaluation order:
1. Start with the portal's dashboard (most-visited surface)
2. Then its listings
3. Then details
4. Then editors
5. Overlays grouped by type (evaluate all modals together, all sheets together)

This becomes the input to Phase 2 prompt generation.
```

---

## After Phase 1

Once all tasks are complete:

1. Review the inventories yourself (spot-check a few rows)
2. Adjust the taxonomy in `framework.md` if the A6 / A5 runs flagged gaps
3. Generate Phase 2 task prompts from the `_master.md` queue (separate doc: `phase-2-evaluate.md`)
4. Start scheduling Phase 2 tasks overnight

Phase 2 structure will mirror this one — one task per surface or per surface group, each producing a `findings/<surface>.md` file.

---

## Scheduling cheat sheet

```bash
# Example: schedule A1 to run tonight
/schedule "Run audit task A1 from docs/audit/phase-1-inventory.md. Execute the prompt under '## Task A1 — Client portal page inventory'."
```

For rapid iteration while we validate the framework, start by running **A1 alone** manually in a fresh session — don't queue the whole suite until we've seen one full output and confirmed it matches expectations.
