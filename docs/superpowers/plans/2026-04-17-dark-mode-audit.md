# Dark Mode Audit & Scope Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force-light report-review surfaces + adjacent areas (builder, brand editors, results-viewing), remove dead dark-token generation on the assessment runner, and manually audit the remaining dark-capable surfaces.

**Architecture:** Re-use the existing `ForceLightTheme` component (currently at `src/components/assess/force-light-theme.tsx`). Relocate it to `src/components/force-light-theme.tsx`. Each forced-light sub-tree gets its own minimal `layout.tsx` that renders `<ForceLightTheme />` above `{children}`. Remove dead `generateDarkCSSTokens` calls on five `/assess/*` files. Manual Playwright audit of dark-capable surfaces produces a findings doc with prioritised fixes.

**Tech Stack:** Next.js 16 App Router, TypeScript, next-themes, vitest + @testing-library/react (jsdom), Playwright (manual via MCP for audit).

**Reference spec:** `docs/superpowers/specs/2026-04-17-dark-mode-audit-design.md`

---

## Preconditions

Before starting:

- [ ] **Confirm `feat/report-template-polish` has merged to `main`.** If not yet merged, rebase this branch after it lands — the polish branch modifies `src/app/(dashboard)/report-templates/[id]/preview/page.tsx`. This plan only adds a sibling `layout.tsx`, so no file conflict, but the preview shell from polish must exist first for end-to-end acceptance to pass.
- [ ] **Current branch:** `feat/dark-mode-audit` (already created and holds the design spec).

---

## File Plan

**New files (`layout.tsx` — one-liner force-light wrappers unless noted):**

| File | Purpose |
|---|---|
| `src/components/force-light-theme.tsx` | Relocated primitive (from `src/components/assess/force-light-theme.tsx`) |
| `tests/components/force-light-theme.test.tsx` | Unit test for the primitive |
| `src/app/(dashboard)/reports/layout.tsx` | Force-light admin reports |
| `src/app/(dashboard)/report-templates/[id]/builder/layout.tsx` | Force-light admin template builder |
| `src/app/(dashboard)/report-templates/[id]/preview/layout.tsx` | Force-light admin template preview |
| `src/app/(dashboard)/settings/brand/layout.tsx` | Force-light platform brand editor |
| `src/app/(dashboard)/clients/[slug]/branding/layout.tsx` | Force-light client brand editor |
| `src/app/(dashboard)/partners/[slug]/branding/layout.tsx` | Force-light partner brand editor |
| `src/app/(dashboard)/campaigns/[id]/overview/layout.tsx` | Force-light admin campaign overview |
| `src/app/(dashboard)/participants/[id]/layout.tsx` | Force-light admin participant detail |
| `src/app/partner/reports/layout.tsx` | Force-light partner reports viewer |
| `src/app/partner/report-templates/[id]/builder/layout.tsx` | Force-light partner template builder |
| `src/app/partner/report-templates/[id]/preview/layout.tsx` | Force-light partner template preview |
| `src/app/partner/campaigns/[id]/layout.tsx` | Force-light partner campaign detail (no `/overview` sub-route — page.tsx IS the overview; this scopes all three tabs: overview / participants / sessions — consistent with the approved "anywhere reviewing participant data" rule) |
| `src/app/client/reports/layout.tsx` | Force-light client reports viewer |
| `src/app/client/campaigns/[id]/overview/layout.tsx` | Force-light client campaign overview |
| `src/app/print/reports/layout.tsx` | Defensive force-light (new — currently no layout) |
| `src/app/print/report-templates/layout.tsx` | Defensive force-light (new — currently no layout) |
| `docs/superpowers/specs/dark-mode-audit-findings.md` | Created during audit task, populated with findings |

**Routes that do NOT exist (skip):**
- `/partner/participants/[id]` — no per-participant detail in partner portal
- `/client/participants/[id]` — no per-participant detail in client portal

**Modified files:**

| File | Change |
|---|---|
| `src/app/assess/layout.tsx` | Update `ForceLightTheme` import path only |
| `src/app/assess/[token]/layout.tsx` | Remove `generateDarkCSSTokens` import + call; emit `lightCss` only |
| `src/app/assess/[token]/report/page.tsx` | Same |
| `src/app/assess/[token]/report/export/page.tsx` | Same |
| `src/app/assess/[token]/demographics/page.tsx` | Same |
| `src/app/assess/join/[linkToken]/page.tsx` | Same |

**Deleted files:**

| File | Reason |
|---|---|
| `src/components/assess/force-light-theme.tsx` | Relocated to `src/components/force-light-theme.tsx` |

---

## Task ordering

1. Move + test `ForceLightTheme` primitive.
2. Update the sole existing import (`src/app/assess/layout.tsx`).
3. Add forced-light layouts in batches (admin → partner → client → print).
4. Remove dead dark-token generation on `/assess/*`.
5. Manual audit → findings doc.
6. Apply prioritised audit fixes.
7. Final verification + finishing.

Tasks 1–4 are mechanical and testable. Task 5 is discovery; tasks 6+ depend on findings. We'll keep the plan flexible — audit fixes get added as sub-tasks once findings are triaged with the user.

---

# FEATURE 1 — Primitive relocation

## Task 1: Write failing test for `ForceLightTheme`

**Files:**
- Create: `tests/components/force-light-theme.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/force-light-theme.test.tsx
// @vitest-environment jsdom

import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ForceLightTheme } from "@/components/force-light-theme";

describe("ForceLightTheme", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("removes the dark class from <html> on mount", () => {
    document.documentElement.classList.add("dark");
    render(<ForceLightTheme />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("restores the dark class on unmount when it was set before mount", () => {
    document.documentElement.classList.add("dark");
    const { unmount } = render(<ForceLightTheme />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    unmount();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("does not add the dark class on unmount if it was not set before mount", () => {
    // html is already light
    const { unmount } = render(<ForceLightTheme />);
    unmount();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("renders nothing visible", () => {
    const { container } = render(<ForceLightTheme />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/force-light-theme.test.tsx`
Expected: FAIL with module-resolution error (`Cannot find module @/components/force-light-theme`).

---

## Task 2: Relocate `ForceLightTheme` and make the test pass

**Files:**
- Create: `src/components/force-light-theme.tsx`
- Delete: `src/components/assess/force-light-theme.tsx`

- [ ] **Step 1: Create the new file at the new path**

```tsx
// src/components/force-light-theme.tsx
"use client";

import { useEffect } from "react";

/**
 * Forces light theme regardless of system/user preference.
 *
 * Mount inside a route-level `layout.tsx` to scope forced-light behaviour
 * to that sub-tree. Removes the `dark` class from <html> on mount and
 * restores it on unmount.
 *
 * Used for report review surfaces, report template builder/preview, brand
 * editors, results-viewing surfaces, and the candidate-facing assessment
 * runner — everywhere the content is designed only for light mode.
 */
export function ForceLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.colorScheme = "light";

    return () => {
      html.style.colorScheme = "";
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  return null;
}
```

- [ ] **Step 2: Delete the old file**

```bash
rm src/components/assess/force-light-theme.tsx
```

- [ ] **Step 3: Run test**

Run: `npx vitest run tests/components/force-light-theme.test.tsx`
Expected: PASS — all 4 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/force-light-theme.tsx tests/components/force-light-theme.test.tsx
git rm src/components/assess/force-light-theme.tsx
git commit -m "refactor: relocate ForceLightTheme to src/components/ with unit test"
```

---

## Task 3: Update the existing import on the assess layout

**Files:**
- Modify: `src/app/assess/layout.tsx`

- [ ] **Step 1: Update the import**

Change line 5:

```tsx
// before
import { ForceLightTheme } from "@/components/assess/force-light-theme";

// after
import { ForceLightTheme } from "@/components/force-light-theme";
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/assess/layout.tsx
git commit -m "refactor: point assess layout at new ForceLightTheme path"
```

---

# FEATURE 2 — Force-light layouts

Every layout in this feature has the identical body. For brevity, each task shows the path(s) and one shared template:

```tsx
import { ForceLightTheme } from "@/components/force-light-theme";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  );
}
```

## Task 4: Admin — reports + template builder + template preview

**Files:**
- Create: `src/app/(dashboard)/reports/layout.tsx`
- Create: `src/app/(dashboard)/report-templates/[id]/builder/layout.tsx`
- Create: `src/app/(dashboard)/report-templates/[id]/preview/layout.tsx`

- [ ] **Step 1: Create all three layouts using the shared template above.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev**

Start dev: `npm run dev`. Log in as platform admin. Enable dark mode via theme toggle. Then:
- Navigate to `/reports` → confirm light. Navigate back to `/dashboard` → confirm dark returns.
- Navigate to `/report-templates/[any-id]/builder` → confirm light.
- Navigate to `/report-templates/[any-id]/preview` → confirm light.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/reports/layout.tsx
git add src/app/\(dashboard\)/report-templates/\[id\]/builder/layout.tsx
git add src/app/\(dashboard\)/report-templates/\[id\]/preview/layout.tsx
git commit -m "feat: force light on admin reports, template builder, template preview"
```

---

## Task 5: Admin — brand editors (platform + client + partner)

**Files:**
- Create: `src/app/(dashboard)/settings/brand/layout.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/branding/layout.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/branding/layout.tsx`

- [ ] **Step 1: Create all three layouts using the shared template.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev (dark toggle on)**

Navigate to:
- `/settings/brand` → confirm light.
- `/clients/[any-slug]/branding` → confirm light.
- `/partners/[any-slug]/branding` → confirm light.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/brand/layout.tsx
git add src/app/\(dashboard\)/clients/\[slug\]/branding/layout.tsx
git add src/app/\(dashboard\)/partners/\[slug\]/branding/layout.tsx
git commit -m "feat: force light on platform, client, and partner brand editors"
```

---

## Task 6: Admin — campaign overview + participant detail

**Files:**
- Create: `src/app/(dashboard)/campaigns/[id]/overview/layout.tsx`
- Create: `src/app/(dashboard)/participants/[id]/layout.tsx`

- [ ] **Step 1: Create both layouts using the shared template.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev (dark toggle on)**

Navigate to:
- `/campaigns/[any-id]/overview` → confirm light; sibling tab `/campaigns/[id]/assessments` stays dark.
- `/participants/[any-id]` → confirm light.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/overview/layout.tsx
git add src/app/\(dashboard\)/participants/\[id\]/layout.tsx
git commit -m "feat: force light on admin campaign overview and participant detail"
```

---

## Task 7: Partner portal — reports + template builder + template preview

**Files:**
- Create: `src/app/partner/reports/layout.tsx`
- Create: `src/app/partner/report-templates/[id]/builder/layout.tsx`
- Create: `src/app/partner/report-templates/[id]/preview/layout.tsx`

- [ ] **Step 1: Create all three layouts using the shared template.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev as partner (dark toggle on)**

- `/partner/reports/[any-snapshot]` → confirm light.
- `/partner/report-templates/[any-id]/builder` → confirm light.
- `/partner/report-templates/[any-id]/preview` → confirm light.

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/reports/layout.tsx
git add src/app/partner/report-templates/\[id\]/builder/layout.tsx
git add src/app/partner/report-templates/\[id\]/preview/layout.tsx
git commit -m "feat: force light on partner reports, template builder, template preview"
```

---

## Task 8: Partner portal — campaign detail (no `/overview` sub-route)

**Files:**
- Create: `src/app/partner/campaigns/[id]/layout.tsx`

**Note:** Partner campaigns are structured differently from admin — there's no `/overview/` subfolder; `page.tsx` at `[id]/` IS the overview, with `participants/` and `sessions/` as sibling tabs. Putting the layout at `[id]/` forces light across all three tabs. That's consistent with the approved scope rule "anywhere reviewing participant data."

- [ ] **Step 1: Create the layout using the shared template.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev as partner (dark toggle on)**

Navigate to `/partner/campaigns/[any-id]` → confirm light. Click Participants tab → still light. Click Sessions tab → still light. Click Campaigns (parent list) → dark returns.

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/campaigns/\[id\]/layout.tsx
git commit -m "feat: force light on partner campaign detail (overview + tabs)"
```

---

## Task 9: Client portal — reports + campaign overview

**Files:**
- Create: `src/app/client/reports/layout.tsx`
- Create: `src/app/client/campaigns/[id]/overview/layout.tsx`

- [ ] **Step 1: Create both layouts using the shared template.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev as client (dark toggle on)**

- `/client/reports/[any-snapshot]` → confirm light.
- `/client/campaigns/[any-id]/overview` → confirm light; sibling tab `/client/campaigns/[id]/participants` stays dark.

- [ ] **Step 4: Commit**

```bash
git add src/app/client/reports/layout.tsx
git add src/app/client/campaigns/\[id\]/overview/layout.tsx
git commit -m "feat: force light on client reports and campaign overview"
```

---

## Task 10: Print routes — defensive force-light

**Files:**
- Create: `src/app/print/reports/layout.tsx`
- Create: `src/app/print/report-templates/layout.tsx`

**Context:** `/print/*` sits outside `(dashboard)`, so it doesn't currently inherit a dark-capable layout chain. We still add `<ForceLightTheme />` as a belt-and-braces safeguard — zero runtime cost, prevents surprise if `ThemeProvider` placement ever changes.

- [ ] **Step 1: Create both layouts using the shared template.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test in dev**

Trigger a PDF export from a released report (via the PDF button). Verify PDF looks identical to the previous output. (Puppeteer render path unchanged — this is pure insurance.)

- [ ] **Step 4: Commit**

```bash
git add src/app/print/reports/layout.tsx
git add src/app/print/report-templates/layout.tsx
git commit -m "feat: defensive force-light on /print/* routes"
```

---

# FEATURE 3 — Assessment runner dead-code cleanup

## Task 11: Remove `generateDarkCSSTokens` from 5 `/assess/*` files

**Files:**
- Modify: `src/app/assess/[token]/layout.tsx`
- Modify: `src/app/assess/[token]/report/page.tsx`
- Modify: `src/app/assess/[token]/report/export/page.tsx`
- Modify: `src/app/assess/[token]/demographics/page.tsx`
- Modify: `src/app/assess/join/[linkToken]/page.tsx`

**Pattern to remove (appears with slight variations in all 5 files):**

```tsx
// Remove this import:
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
// Replace with:
import { generateCSSTokens } from "@/lib/brand/tokens";

// Remove this block:
const { css: lightCss } = generateCSSTokens(brandConfig);
const darkCss = brandConfig.darkModeEnabled
  ? generateDarkCSSTokens(brandConfig)
  : "";
const safeCSS = `${lightCss}\n${darkCss}`;
// Replace with (preserve the variable name used in the file — some call it `safeCSS`, others `brandCss`, others `brandCssText`):
const { css: safeCSS } = generateCSSTokens(brandConfig);
```

**Per-file detail:**

| File | Variable name used | Notes |
|---|---|---|
| `src/app/assess/[token]/layout.tsx` | `brandCss` | Inside try block at line 24-39 region — preserve try/catch flow |
| `src/app/assess/[token]/report/page.tsx` | `safeCSS` | Line ~69-73 |
| `src/app/assess/[token]/report/export/page.tsx` | `safeCSS` | Line ~56-60 |
| `src/app/assess/[token]/demographics/page.tsx` | `brandCssText` | Line ~59-64; preserve the existing comment about CSS being server-generated |
| `src/app/assess/join/[linkToken]/page.tsx` | `safeCSS` | Line ~51-55 |

- [ ] **Step 1: Apply changes to all 5 files.**

For each file:
1. Update the import to drop `generateDarkCSSTokens`.
2. Replace the three-line `lightCss` + `darkCss` + concat block with a single `const { css: <existing-var-name> } = generateCSSTokens(brandConfig);` preserving the file's existing variable name.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. No dangling references to `generateDarkCSSTokens` or `darkCss` in `/assess/*`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (no unused-import warnings).

- [ ] **Step 4: Smoke-test the assess runner**

Start dev: `npm run dev`. Visit a token URL (e.g., via a test participant). Verify:
- Join page, demographics page, section page, report page all render correctly.
- No console errors about missing CSS tokens or styling issues.
- Regression check with dark system preference: `/assess/*` still renders light (ForceLightTheme still does its job).

- [ ] **Step 5: Commit**

```bash
git add src/app/assess/\[token\]/layout.tsx
git add src/app/assess/\[token\]/report/page.tsx
git add src/app/assess/\[token\]/report/export/page.tsx
git add src/app/assess/\[token\]/demographics/page.tsx
git add src/app/assess/join/\[linkToken\]/page.tsx
git commit -m "chore: remove dead generateDarkCSSTokens calls from /assess/*"
```

---

# FEATURE 4 — Manual dark-mode audit

## Task 12: Playwright-driven walkthrough + findings doc

**Files:**
- Create: `docs/superpowers/specs/dark-mode-audit-findings.md`

**Routes to inspect in dark mode (desktop 1280w + iPhone 14 @ 390×844):**

*Admin (platform role):*
- `/dashboard`
- `/dimensions`, `/constructs`, `/factors`, `/items`, `/response-formats`
- `/psychometrics/reliability`, `/psychometrics/norms`
- `/assessments`, `/assessments/[id]` (canvas)
- `/campaigns`, `/campaigns/[id]/assessments`, `/campaigns/[id]/participants`, `/campaigns/[id]/sessions`, `/campaigns/[id]/settings`, `/campaigns/[id]/experience`
- `/participants` (list)
- `/clients`, `/partners`, `/users`, `/directory`
- `/settings` (root + non-brand sub-pages)
- `/chat`
- `/generate/new`, `/generate/[runId]`
- `/diagnostics`
- Command palette (⌘K), theme toggle dropdown, notifications popover

*Partner portal:* `/partner/dashboard`, `/partner/assessments`, `/partner/campaigns` list, `/partner/participants`, `/partner/settings`, `/partner/support`.

*Client portal:* `/client/dashboard`, `/client/campaigns`, `/client/campaigns/[id]/participants`, `/client/participants`, `/client/settings`, `/client/support`.

*Auth:* `/login`, `/unauthorized`.

*Dialogs/modals to verify in each appropriate surface:* confirm-delete dialog, bulk-import modal (dimensions page), create-template modal (report-templates list), create-campaign modal.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`. Log in as platform admin. Set theme toggle to Dark.

- [ ] **Step 2: Walk each route via Playwright MCP, capturing screenshots**

For each route in the list:
1. Navigate via `mcp__plugin_playwright_playwright__browser_navigate`.
2. `mcp__plugin_playwright_playwright__browser_resize` to 1280×800 for desktop capture, then 390×844 for mobile.
3. `mcp__plugin_playwright_playwright__browser_take_screenshot` after each resize. Save to `test-results/dark-audit/<route-slug>-{desktop|mobile}.png`.

- [ ] **Step 3: Catalog findings**

Create `docs/superpowers/specs/dark-mode-audit-findings.md` with this structure:

```markdown
# Dark Mode Audit — Findings

**Date:** YYYY-MM-DD
**Scope:** dashboard / partner / client / auth surfaces (dark-capable).
**Excluded:** forced-light surfaces, marketing, print.

## Findings

| # | Route | Issue | Severity | Proposed fix | Screenshot |
|---|---|---|---|---|---|
| 1 | `/dashboard` | … | broken / ugly / minor | … | `test-results/dark-audit/dashboard-mobile.png` |
| 2 | … | … | … | … | … |

## Patterns observed

- (Fill in as common issues emerge — e.g., "badges have insufficient contrast when stacked on dark cards", "chart axes use hardcoded greys that disappear in dark", etc.)

## Triage

**To fix in this branch (broken + high-visibility ugly):**
- # …

**Deferred (minor, or out of scope):**
- # …
```

- [ ] **Step 4: Present findings to the user**

Surface the populated findings document and ask which items to fix in this branch vs defer. Capture the decision in the "Triage" section of the findings doc.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/dark-mode-audit-findings.md
git add test-results/dark-audit/
git commit -m "docs: dark-mode audit findings with triage"
```

---

## Task 13: Apply approved audit fixes

**Files:** Determined by Task 12 triage — unknown at plan-writing time.

- [ ] **Step 1: For each approved fix, implement and commit separately.**

Each fix follows the normal TDD loop where applicable (component-level tests for UI components with observable behaviour; visual-only fixes don't require tests but do require a before/after screenshot in the commit body). Keep commits atomic — one fix per commit, clearly titled `fix(dark-mode): <surface> — <issue>`.

- [ ] **Step 2: After each fix, re-verify the specific surface in dark mode via Playwright.**

- [ ] **Step 3: Update the findings doc to mark fixed items.**

At the end of this task, all "to fix in this branch" rows should have status `✅ fixed in <commit-sha>`.

- [ ] **Step 4: Commit the findings doc update**

```bash
git add docs/superpowers/specs/dark-mode-audit-findings.md
git commit -m "docs: mark audit findings fixed in this branch"
```

---

# FEATURE 5 — Final verification

## Task 14: Full test suite + typecheck + lint

- [ ] **Step 1: Run all static checks**

Run: `npm run typecheck && npx vitest run && npm run lint`
Expected: typecheck + lint pass; vitest shows only the same pre-existing failures that exist on main (not introduced by this plan).

- [ ] **Step 2: If anything regresses, fix it and re-run.**

---

## Task 15: Manual acceptance on all forced-light routes

Performed on desktop + mobile, dark-mode system preference.

- [ ] For each route, verify:
  1. Set theme toggle to Dark.
  2. Navigate in — page renders with light tokens, no `dark` class on `<html>`.
  3. Navigate out — `dark` class returns without reload.

- [ ] Routes (skip any that don't exist in your environment):

**Admin:**
- [ ] `/reports` + `/reports/[snapshotId]`
- [ ] `/report-templates/[id]/builder`
- [ ] `/report-templates/[id]/preview`
- [ ] `/settings/brand`
- [ ] `/clients/[slug]/branding`
- [ ] `/partners/[slug]/branding`
- [ ] `/campaigns/[id]/overview`
- [ ] `/participants/[id]`

**Partner:**
- [ ] `/partner/reports/[snapshotId]`
- [ ] `/partner/report-templates/[id]/builder`
- [ ] `/partner/report-templates/[id]/preview`
- [ ] `/partner/campaigns/[id]` (all tabs)

**Client:**
- [ ] `/client/reports/[snapshotId]`
- [ ] `/client/campaigns/[id]/overview`

**Assess (regression check):**
- [ ] `/assess/[token]/join` — light
- [ ] `/assess/[token]/demographics` — light
- [ ] `/assess/[token]/report` — light

---

## Task 16: Finishing skill

- [ ] When everything green, invoke `superpowers:finishing-a-development-branch`.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Flash of dark before `useEffect` strips the class | Matches current `/assess/*` behaviour; escalate to pre-hydration inline script only if noticeable during acceptance |
| Partner/client route exists but layout placed at wrong depth, accidentally forcing light on sibling tabs | Smoke-test in each task verifies sibling routes stay dark-capable; Task 8 is a deliberate exception (documented in its task description) |
| `feat/report-template-polish` not yet merged → preview shell missing | Preconditions check explicitly gates this — do not start until polish is on main |
| Audit scope creep (too many fixes) | Task 12 Step 4 surfaces a triage list to the user; only approved items enter Task 13 |
| Dead-code removal breaks a brand that was relying on dark tokens via some unexpected path | Verified in spec: `ForceLightTheme` on `/assess/*` removes the `dark` class before paint, so dark tokens can never apply. Dev smoke-test in Task 11 Step 4 is the final gate |
| Test for `ForceLightTheme` accidentally leaks state into later tests (mutates `<html>`) | `afterEach` in Task 1 test body explicitly resets both `className` and `style.colorScheme` on `document.documentElement` |

---

## Notes on scope handled at implementation time

- **`/partner/participants/[id]` and `/client/participants/[id]` don't exist** — spec lists them as "if exists"; they are SKIPPED (not created).
- **Partner campaign detail `/partner/campaigns/[id]/`** has no `/overview` sub-route; layout goes at `[id]/` which force-lights all three tabs (overview / participants / sessions). Consistent with the approved rule "anywhere reviewing participant data."
- **Admin campaign detail `/(dashboard)/campaigns/[id]/`** has a proper `/overview` sub-folder, so the layout scopes just the overview tab — other tabs stay dark-capable.
- **Client campaign detail `/client/campaigns/[id]/`** has a proper `/overview` sub-folder — scoped the same way as admin.
