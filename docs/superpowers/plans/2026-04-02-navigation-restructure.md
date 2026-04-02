# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise the admin sidebar from 9 groups / 22 items down to 6 groups / ~16 items, extract platform settings to a separate area, merge AI Models + AI Prompts into a unified purpose-first page, and add a profile page.

**Architecture:** The sidebar config in `app-sidebar.tsx` drives all nav rendering — most changes are config-level. File moves use Next.js route groups. The AI Configuration merge creates a new `/settings/ai` route with list + detail views, reusing existing model picker and prompt editor components. The settings area conditionally renders a simplified sidebar when the path starts with `/settings`.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase (no schema changes), shadcn/ui components, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-02-navigation-restructure-design.md`

---

## File Structure

### New Files
- `src/app/(dashboard)/settings/ai/page.tsx` — AI Configuration list view
- `src/app/(dashboard)/settings/ai/[purpose]/page.tsx` — AI Configuration detail view
- `src/app/(dashboard)/settings/ai/[purpose]/ai-purpose-detail.tsx` — Client component: model selector + prompt editor
- `src/app/(dashboard)/settings/ai/loading.tsx` — Loading skeleton for AI list
- `src/app/(dashboard)/settings/ai/[purpose]/loading.tsx` — Loading skeleton for AI detail
- `src/app/(dashboard)/report-templates/page.tsx` — Moved from settings/reports
- `src/app/(dashboard)/report-templates/loading.tsx` — Moved from settings/reports
- `src/app/(dashboard)/report-templates/[id]/builder/page.tsx` — Moved from settings/reports/[id]/builder
- `src/app/(dashboard)/report-templates/[id]/builder/loading.tsx` — Moved
- `src/app/(dashboard)/report-templates/[id]/preview/page.tsx` — Moved from settings/reports/[id]/preview
- `src/app/(dashboard)/report-templates/[id]/preview/loading.tsx` — Moved
- `src/app/(dashboard)/users/page.tsx` — Moved from settings/users
- `src/app/(dashboard)/profile/page.tsx` — New profile page
- `src/app/(dashboard)/profile/profile-form.tsx` — Client component for profile editing

### Modified Files
- `src/components/app-sidebar.tsx` — New admin nav config, coming-soon pattern, conditional settings nav, footer gear icon
- `src/components/auth/account-menu.tsx` — Add Profile link
- `src/app/(dashboard)/assessments/page.tsx` — Add Item Selection Rules tab
- `src/app/(dashboard)/psychometrics/page.tsx` — Add tab bar for sub-pages

### Redirect Stubs (new files, each ~3 lines)
- `src/app/(dashboard)/settings/models/page.tsx` — Redirect to `/settings/ai`
- `src/app/(dashboard)/settings/prompts/page.tsx` — Redirect to `/settings/ai`
- `src/app/(dashboard)/settings/prompts/[purpose]/page.tsx` — Redirect to `/settings/ai/[purpose]`
- `src/app/(dashboard)/settings/users/page.tsx` — Redirect to `/users`
- `src/app/(dashboard)/settings/item-selection/page.tsx` — Redirect to `/assessments?tab=rules`
- `src/app/(dashboard)/settings/reports/page.tsx` — Redirect to `/report-templates`
- `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx` — Redirect to `/report-templates/[id]/builder`
- `src/app/(dashboard)/settings/reports/[id]/preview/page.tsx` — Redirect to `/report-templates/[id]/preview`

### Files to Delete (after moves)
- `src/app/(dashboard)/settings/item-selection/rules-editor.tsx` — Moves to assessments
- `src/app/(dashboard)/settings/item-selection/loading.tsx` — No longer needed
- `src/app/(dashboard)/settings/models/model-selector-form.tsx` — Replaced by AI config
- `src/app/(dashboard)/settings/models/loading.tsx` — Replaced
- `src/app/(dashboard)/settings/prompts/[purpose]/prompt-detail-editor.tsx` — Replaced by AI config

### Files Staying Put (components reused in new locations via import)
- `src/app/(dashboard)/settings/models/model-picker-combobox.tsx` — Imported by AI config detail via absolute path
- `src/app/(dashboard)/settings/models/credits-widget.tsx` — Imported by AI config list via absolute path

---

## Task 1: Restructure Admin Sidebar Config

**Files:**
- Modify: `src/components/app-sidebar.tsx`

This task updates the nav data arrays only. No new components or rendering changes yet — just the item groupings, labels, routes, and icons.

- [ ] **Step 1: Update the admin nav config**

Replace the `adminNav` array (lines 46-124) with the new structure:

```typescript
const adminNav = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: Home }],
  },
  {
    label: "Library",
    items: [
      { title: "Dimensions", href: "/dimensions", icon: LayoutGrid },
      { title: "Factors", href: "/factors", icon: Brain },
      { title: "Constructs", href: "/constructs", icon: Dna },
      { title: "Items", href: "/items", icon: FileQuestion },
      { title: "Item Generator", href: "/generate", icon: Wand2 },
      { title: "Response Formats", href: "/response-formats", icon: Settings2 },
      { title: "Psychometrics", href: "/psychometrics", icon: BarChart3 },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessment Builder", href: "/assessments", icon: ClipboardList },
      { title: "Report Templates", href: "/report-templates", icon: LayoutTemplate },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Templates", href: "/diagnostic-templates", icon: FileText, comingSoon: true },
      { title: "Sessions", href: "/diagnostics", icon: Layers, comingSoon: true },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Directory", href: "/directory", icon: Building2 },
      { title: "Users", href: "/users", icon: Users },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { title: "Chat", href: "/chat", icon: MessageSquare },
      { title: "Matching Engine", href: "/matching", icon: Sparkles },
    ],
  },
];
```

- [ ] **Step 2: Add `comingSoon` to the nav item type and update rendering**

Update the nav item type to include optional `comingSoon?: boolean`. In the sidebar rendering loop, when `comingSoon` is true:
- Render a `<div>` instead of a `<Link>` (non-clickable)
- Add `opacity-40 cursor-default` classes
- Append a small `<Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">Coming soon</Badge>` after the title span
- Add `title` attribute with "This feature is coming soon" for tooltip

Import `Badge` from `@/components/ui/badge`.

- [ ] **Step 3: Remove unused icon imports**

Remove `ListFilter` (was for Item Selection in Settings) from the import. Keep all others — they're still used.

- [ ] **Step 4: Verify the sidebar renders correctly**

Run: `npm run dev` and check the admin sidebar in browser. Confirm:
- 6 groups visible: Overview, Library, Assessments, Diagnostics, People, AI Tools
- Diagnostics items are greyed out with "Coming soon" badge
- No Settings group in the sidebar
- Active state highlighting still works

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "refactor(nav): restructure admin sidebar — 6 groups, coming-soon pattern"
```

---

## Task 2: Add Settings Footer + Conditional Settings Nav

**Files:**
- Modify: `src/components/app-sidebar.tsx`

Add the gear icon footer link and conditional settings-mode nav when on `/settings/*` paths.

- [ ] **Step 1: Add the settings footer to the main sidebar**

Import `Settings` icon from Lucide. In the `AppSidebar` component, replace the empty `<SidebarFooter />` with:

```tsx
<SidebarFooter className="px-3 pb-3">
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={pathname.startsWith("/settings")}
        tooltip="Platform Settings"
        render={<Link href="/settings/brand" />}
      >
        <Settings className="size-4" />
        <span>Platform Settings</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarFooter>
```

- [ ] **Step 2: Add the settings nav config**

Add a `settingsNav` array after the portal nav configs:

```typescript
const settingsNav = [
  {
    label: "Platform Settings",
    items: [
      { title: "Brand", href: "/settings/brand", icon: Palette },
      { title: "Experience", href: "/settings/experience", icon: Users },
      { title: "AI Configuration", href: "/settings/ai", icon: Cpu },
    ],
  },
];
```

- [ ] **Step 3: Conditionally switch nav when on settings paths**

In the `AppSidebar` component, after resolving `navSections`, add logic to switch to settings nav when on a settings path:

```typescript
const isSettingsArea = pathname.startsWith("/settings");
const displayNav = isSettingsArea && portal === "admin" ? settingsNav : navSections;
```

Use `displayNav` instead of `navSections` in the `SidebarContent` render.

- [ ] **Step 4: Add "Back to platform" link above settings nav**

When `isSettingsArea` is true, render a back link inside `SidebarContent` before the nav groups:

```tsx
{isSettingsArea && portal === "admin" && (
  <div className="px-3 py-2">
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
    >
      <ArrowLeft className="size-4" />
      <span>Back to platform</span>
    </Link>
  </div>
)}
```

Import `ArrowLeft` from Lucide.

- [ ] **Step 5: Hide the settings footer when already in settings**

Wrap the `SidebarFooter` with a condition so it only shows when NOT in settings:

```tsx
{!(isSettingsArea && portal === "admin") && (
  <SidebarFooter>...</SidebarFooter>
)}
```

- [ ] **Step 6: Verify in browser**

- Click "Platform Settings" gear icon → sidebar switches to settings nav with back link
- Click "Back to platform" → returns to main nav
- Settings nav shows: Brand, Experience, AI Configuration
- Active state works on settings items

- [ ] **Step 7: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(nav): add platform settings area with conditional sidebar nav"
```

---

## Task 3: Move Users Page

**Files:**
- Create: `src/app/(dashboard)/users/page.tsx`
- Modify: `src/app/(dashboard)/settings/users/page.tsx` (becomes redirect)
- Move: `src/app/(dashboard)/settings/users/invite-user-form.tsx` → `src/app/(dashboard)/users/invite-user-form.tsx`

- [ ] **Step 1: Create the new users route directory**

```bash
mkdir -p src/app/\(dashboard\)/users
```

- [ ] **Step 2: Move the page and component files**

```bash
cp src/app/\(dashboard\)/settings/users/page.tsx src/app/\(dashboard\)/users/page.tsx
cp src/app/\(dashboard\)/settings/users/invite-user-form.tsx src/app/\(dashboard\)/users/invite-user-form.tsx
```

- [ ] **Step 3: Update the new page's eyebrow**

In `src/app/(dashboard)/users/page.tsx`:
- Change the `PageHeader` eyebrow from `"Settings"` to `"People"`
- Fix the `InviteUserForm` import — the old page uses an absolute path `@/app/(dashboard)/settings/users/invite-user-form`. Change it to `./invite-user-form`

- [ ] **Step 3b: Update revalidatePath in staff-users actions**

In `src/app/actions/staff-users.ts`, update all `revalidatePath('/settings/users')` calls to `revalidatePath('/users')`. There are ~4 occurrences across the revoke/deactivate/reactivate actions.

- [ ] **Step 4: Replace the old page with a redirect**

Replace `src/app/(dashboard)/settings/users/page.tsx` with:

```typescript
import { redirect } from "next/navigation";

export default function SettingsUsersRedirect() {
  redirect("/users");
}
```

- [ ] **Step 5: Delete the old invite-user-form**

```bash
rm src/app/\(dashboard\)/settings/users/invite-user-form.tsx
```

- [ ] **Step 6: Verify**

Navigate to `/users` — page renders. Navigate to `/settings/users` — redirects to `/users`. Sidebar "Users" link under People group goes to `/users`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/users/ src/app/\(dashboard\)/settings/users/
git commit -m "refactor(nav): move users page from settings to /users"
```

---

## Task 4: Move Report Templates

**Files:**
- Create: `src/app/(dashboard)/report-templates/` (entire directory tree)
- Modify: `src/app/(dashboard)/settings/reports/page.tsx` (becomes redirect)
- Modify: `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx` (becomes redirect)
- Modify: `src/app/(dashboard)/settings/reports/[id]/preview/page.tsx` (becomes redirect)

This is the largest file move — report templates have a list page, builder sub-route, and preview sub-route, plus several components.

- [ ] **Step 1: Create the new directory structure**

```bash
mkdir -p src/app/\(dashboard\)/report-templates/\[id\]/builder
mkdir -p src/app/\(dashboard\)/report-templates/\[id\]/preview
```

- [ ] **Step 2: Copy all report template files**

```bash
# List page + components
cp src/app/\(dashboard\)/settings/reports/page.tsx src/app/\(dashboard\)/report-templates/page.tsx
cp src/app/\(dashboard\)/settings/reports/loading.tsx src/app/\(dashboard\)/report-templates/loading.tsx
cp src/app/\(dashboard\)/settings/reports/active-toggle.tsx src/app/\(dashboard\)/report-templates/active-toggle.tsx
cp src/app/\(dashboard\)/settings/reports/create-template-button.tsx src/app/\(dashboard\)/report-templates/create-template-button.tsx
cp src/app/\(dashboard\)/settings/reports/clone-template-button.tsx src/app/\(dashboard\)/report-templates/clone-template-button.tsx
cp src/app/\(dashboard\)/settings/reports/delete-template-button.tsx src/app/\(dashboard\)/report-templates/delete-template-button.tsx

# Builder
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/page.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/page.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/loading.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/loading.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-builder-client.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/block-builder-client.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/add-block-dropdown.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/add-block-dropdown.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-headers-panel.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/block-headers-panel.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-content-panels.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/block-content-panels.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-presentation-panel.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/block-presentation-panel.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-print-panel.tsx src/app/\(dashboard\)/report-templates/\[id\]/builder/block-print-panel.tsx

# Preview
cp src/app/\(dashboard\)/settings/reports/\[id\]/preview/page.tsx src/app/\(dashboard\)/report-templates/\[id\]/preview/page.tsx
cp src/app/\(dashboard\)/settings/reports/\[id\]/preview/loading.tsx src/app/\(dashboard\)/report-templates/\[id\]/preview/loading.tsx
```

- [ ] **Step 3: Update internal references in moved files**

Grep all moved files for `/settings/reports` and replace with `/report-templates`. Known locations:

In `report-templates/page.tsx`:
- Change the `PageHeader` eyebrow from `"Settings"` or `"Reports"` to `"Assessments"`
- Update any hardcoded `/settings/reports` links to `/report-templates`

In `report-templates/[id]/builder/page.tsx`:
- Update any breadcrumb/back links from `/settings/reports` to `/report-templates`

In `report-templates/[id]/builder/block-builder-client.tsx`:
- Replace any `/settings/reports` references with `/report-templates`

In `report-templates/create-template-button.tsx`:
- Update `router.push(\`/settings/reports/${template.id}/builder\`)` → `router.push(\`/report-templates/${template.id}/builder\`)`

In `report-templates/clone-template-button.tsx`:
- Update `router.push(\`/settings/reports/${cloned.id}/builder\`)` → `router.push(\`/report-templates/${cloned.id}/builder\`)`

In `report-templates/[id]/preview/page.tsx`:
- Update `<a href={\`/settings/reports/${id}/builder\`}>` → `<a href={\`/report-templates/${id}/builder\`}>`

In server actions (`src/app/actions/reports.ts`):
- Update any `revalidatePath("/settings/reports")` calls to `revalidatePath("/report-templates")`

- [ ] **Step 4: Replace old pages with redirects**

Replace `src/app/(dashboard)/settings/reports/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function SettingsReportsRedirect() {
  redirect("/report-templates");
}
```

Replace `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default async function SettingsReportBuilderRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/report-templates/${id}/builder`);
}
```

Replace `src/app/(dashboard)/settings/reports/[id]/preview/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default async function SettingsReportPreviewRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/report-templates/${id}/preview`);
}
```

- [ ] **Step 5: Delete old component files from settings/reports**

Delete the component files that were copied (NOT the page.tsx files which are now redirects):
```bash
rm src/app/\(dashboard\)/settings/reports/active-toggle.tsx
rm src/app/\(dashboard\)/settings/reports/create-template-button.tsx
rm src/app/\(dashboard\)/settings/reports/clone-template-button.tsx
rm src/app/\(dashboard\)/settings/reports/delete-template-button.tsx
rm src/app/\(dashboard\)/settings/reports/loading.tsx
```

Delete old builder components (now redirects live at those page.tsx paths):
```bash
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-builder-client.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/add-block-dropdown.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-headers-panel.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-content-panels.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-presentation-panel.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-print-panel.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/loading.tsx
rm src/app/\(dashboard\)/settings/reports/\[id\]/preview/loading.tsx
```

- [ ] **Step 6: Verify**

- Navigate to `/report-templates` — list page renders
- Click a template → `/report-templates/[id]/builder` — builder renders
- Navigate to `/settings/reports` — redirects to `/report-templates`
- Sidebar "Report Templates" link works

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/report-templates/ src/app/\(dashboard\)/settings/reports/ src/app/actions/reports.ts
git commit -m "refactor(nav): move report templates from /settings/reports to /report-templates"
```

---

## Task 5: Add Item Selection Rules Tab to Assessments

**Files:**
- Modify: `src/app/(dashboard)/assessments/page.tsx` — Add tab navigation (Assessments | Item Selection Rules)
- Move: `src/app/(dashboard)/settings/item-selection/rules-editor.tsx` → `src/app/(dashboard)/assessments/rules-editor.tsx`
- Modify: `src/app/(dashboard)/settings/item-selection/page.tsx` (becomes redirect)

- [ ] **Step 1: Copy the rules editor component**

```bash
cp src/app/\(dashboard\)/settings/item-selection/rules-editor.tsx src/app/\(dashboard\)/assessments/rules-editor.tsx
```

- [ ] **Step 2: Convert assessments page to a tabbed layout**

The page currently receives no search params. Add a `searchParams` prop and render tabs:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getItemSelectionRules } from "@/app/actions/item-selection-rules";
import { RulesEditor } from "./rules-editor";
```

Wrap the existing content in a `<Tabs>` component with `defaultValue` driven by `searchParams.tab ?? "assessments"`. Add two `TabsTrigger` buttons ("Assessments" and "Item Selection Rules") inside a `TabsList` placed after the `PageHeader`. The existing card grid goes in `<TabsContent value="assessments">` and a new `<TabsContent value="rules">` contains the `RulesEditor`.

Fetch `getItemSelectionRules()` at the top of the page alongside `getAssessments()`.

- [ ] **Step 3: Update the import path in rules-editor.tsx and revalidatePath**

Check the moved `rules-editor.tsx` for any relative imports that need updating. The action import `@/app/actions/item-selection-rules` uses an absolute path so it should work as-is.

In `src/app/actions/item-selection-rules.ts`, update `revalidatePath('/settings/item-selection')` to `revalidatePath('/assessments')`.

- [ ] **Step 4: Replace old item-selection page with redirect**

Replace `src/app/(dashboard)/settings/item-selection/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function ItemSelectionRedirect() {
  redirect("/assessments?tab=rules");
}
```

- [ ] **Step 5: Clean up old files**

```bash
rm src/app/\(dashboard\)/settings/item-selection/rules-editor.tsx
rm src/app/\(dashboard\)/settings/item-selection/loading.tsx
```

- [ ] **Step 6: Verify**

- Navigate to `/assessments` — default tab shows assessment cards
- Click "Item Selection Rules" tab — rules editor renders
- Navigate to `/settings/item-selection` — redirects to `/assessments?tab=rules`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/assessments/ src/app/\(dashboard\)/settings/item-selection/
git commit -m "refactor(nav): move item selection rules into assessments page as tab"
```

---

## Task 6: Build Merged AI Configuration Page

**Files:**
- Create: `src/app/(dashboard)/settings/ai/page.tsx` — List view
- Create: `src/app/(dashboard)/settings/ai/loading.tsx` — Loading skeleton
- Create: `src/app/(dashboard)/settings/ai/[purpose]/page.tsx` — Detail view (server component)
- Create: `src/app/(dashboard)/settings/ai/[purpose]/ai-purpose-detail.tsx` — Detail client component
- Create: `src/app/(dashboard)/settings/ai/[purpose]/loading.tsx` — Loading skeleton

This is the largest new feature. It merges the AI Models grid and AI Prompts table into a single purpose-first interface.

- [ ] **Step 1: Create the AI configuration list page**

Create `src/app/(dashboard)/settings/ai/page.tsx`:

This server component fetches `getModelConfigs()` and `getPromptSummaries()`, then renders:
- `PageHeader` with eyebrow "Platform Settings", title "AI Configuration", description
- Credits widget (from existing `../../models/credits-widget.tsx` — import via relative path or move to a shared location)
- "Apply model to all" bar (reuse the `ApplyToAllBar` concept from model-selector-form, but simplify — just a combobox + button)
- Grid of purpose cards showing: icon, label, description, current model name, current prompt version badge ("v3" or "Not configured"), arrow icon. Each card links to `/settings/ai/[purpose]`

Use the existing `PURPOSE_META` and `PURPOSE_ORDER` from the model-selector-form. Extract these into a shared file `src/lib/ai/purpose-meta.ts` so both the old components (during transition) and new page can use them.

- [ ] **Step 2: Create the shared purpose metadata file**

Create `src/lib/ai/purpose-meta.ts` by extracting `PURPOSE_META`, `PURPOSE_ORDER`, and the `PurposeMeta` interface from `src/app/(dashboard)/settings/models/model-selector-form.tsx`. Export them. Update the model-selector-form to import from this shared file (it still exists for the redirect period).

- [ ] **Step 3: Create the AI configuration detail page**

Create `src/app/(dashboard)/settings/ai/[purpose]/page.tsx`:

This server component:
- Validates `purpose` param against `PURPOSE_ORDER`
- Fetches: model config for this purpose (`getModelConfigs()` filtered), prompt versions (`getPromptVersions(purpose)`), available models (`openRouterProvider.listModels(...)`)
- Renders `AiPurposeDetail` client component with all data as props

- [ ] **Step 4: Create the AI purpose detail client component**

Create `src/app/(dashboard)/settings/ai/[purpose]/ai-purpose-detail.tsx`:

This "use client" component combines:
- **Back link** to `/settings/ai`
- **PageHeader** with purpose name and description
- **Model section**: Card showing current model, "Change" button opens `ModelPickerCombobox` (imported via absolute path `@/app/(dashboard)/settings/models/model-picker-combobox`). Save button with existing save-state pattern. Uses `updateModelForPurpose` action.
- **System Prompt section** (hidden for `embedding` purpose):
  - Textarea for prompt content
  - Current version indicator
  - "Save as new version" button using `createPromptVersion` action
  - Dirty state tracking (compare trimmed content)
- **Version history**: Collapsible list of previous versions with "Restore to editor" and "Activate" buttons using `activatePromptVersion` action. Same UX as existing `prompt-detail-editor.tsx`.

Reuse patterns from existing `prompt-detail-editor.tsx` and `model-selector-form.tsx`.

- [ ] **Step 5: Create loading skeletons**

Create `src/app/(dashboard)/settings/ai/loading.tsx`:
- Shimmer skeleton matching the list layout (PageHeader shimmer + grid of card shimmer rectangles)

Create `src/app/(dashboard)/settings/ai/[purpose]/loading.tsx`:
- Shimmer skeleton matching the detail layout (back link + header + model card shimmer + textarea shimmer)

- [ ] **Step 6: Replace old AI pages with redirects**

Replace `src/app/(dashboard)/settings/models/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function ModelsRedirect() {
  redirect("/settings/ai");
}
```

Replace `src/app/(dashboard)/settings/prompts/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function PromptsRedirect() {
  redirect("/settings/ai");
}
```

Replace `src/app/(dashboard)/settings/prompts/[purpose]/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default async function PromptDetailRedirect({ params }: { params: Promise<{ purpose: string }> }) {
  const { purpose } = await params;
  redirect(`/settings/ai/${purpose}`);
}
```

- [ ] **Step 7: Clean up old component files**

```bash
rm src/app/\(dashboard\)/settings/models/model-selector-form.tsx
rm src/app/\(dashboard\)/settings/models/loading.tsx
rm src/app/\(dashboard\)/settings/prompts/\[purpose\]/prompt-detail-editor.tsx
```

Keep `model-picker-combobox.tsx` and `credits-widget.tsx` in their current locations (imported by new AI config pages).

- [ ] **Step 7b: Update revalidatePath in model-config actions**

In `src/app/actions/model-config.ts`, update all `revalidatePath('/settings/models')` calls to `revalidatePath('/settings/ai')`. There are ~2 occurrences in `updateModelForPurpose` and `applyModelToAllPurposes`.

- [ ] **Step 8: Verify**

- Navigate to `/settings/ai` — list of 12 purposes with model + prompt status
- Click a purpose → `/settings/ai/item_generation` — model selector + prompt editor render
- Change model, save → toast, model updates
- Edit prompt, save as new version → toast, version increments
- Navigate to `/settings/models` → redirects to `/settings/ai`
- Navigate to `/settings/prompts/item_generation` → redirects to `/settings/ai/item_generation`
- Embedding purpose shows model only, no prompt section

- [ ] **Step 9: Commit**

```bash
git add src/app/\(dashboard\)/settings/ai/ src/lib/ai/purpose-meta.ts src/app/\(dashboard\)/settings/models/ src/app/\(dashboard\)/settings/prompts/
git commit -m "feat(nav): unified AI Configuration page — merge models + prompts by purpose"
```

---

## Task 7: Add Psychometrics Tab Bar

**Files:**
- Modify: `src/app/(dashboard)/psychometrics/page.tsx`
- Create: `src/app/(dashboard)/psychometrics/layout.tsx` — Shared layout with tab navigation

- [ ] **Step 1: Create a psychometrics layout with tab navigation**

Create `src/app/(dashboard)/psychometrics/layout.tsx`:

```typescript
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

This is a client layout that renders **only** a tab bar (no PageHeader — each sub-page keeps its own). The tab bar sits above the `{children}` slot. The tabs link to:
- Overview → `/psychometrics`
- Item Health → `/psychometrics/items`
- Reliability → `/psychometrics/reliability`
- Norms → `/psychometrics/norms`

Use `usePathname()` to determine active tab. Each trigger wraps a `<Link>` to navigate between sub-pages. The tab bar sits at the top; `{children}` renders below.

Note: This is a navigation-only tab bar (route-based), not state-based tabs. Each sub-page remains its own route.

- [ ] **Step 2: Update the psychometrics overview page**

In `src/app/(dashboard)/psychometrics/page.tsx`, remove the "Quick links" section that currently links to sub-pages (since the tab bar now handles navigation). Keep all other content (readiness checks, stats, etc).

- [ ] **Step 3: Verify**

- Navigate to `/psychometrics` — tab bar shows with "Overview" active
- Click "Item Health" tab → navigates to `/psychometrics/items`
- Click "Norms" tab → navigates to `/psychometrics/norms`
- Sidebar shows single "Psychometrics" item under Library

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/psychometrics/
git commit -m "feat(nav): add psychometrics tab bar for sub-page navigation"
```

---

## Task 8: Profile Page + Account Menu Update

**Files:**
- Create: `src/app/(dashboard)/profile/page.tsx`
- Create: `src/app/(dashboard)/profile/profile-form.tsx`
- Modify: `src/components/auth/account-menu.tsx`

- [ ] **Step 1: Create the profile page**

Create `src/app/(dashboard)/profile/page.tsx`:

Server component that:
- Fetches current user data (email, display_name from Supabase auth `getUser()`)
- Renders `PageHeader` with title "Profile"
- Renders `ProfileForm` client component with current values

- [ ] **Step 2: Create the profile form component**

Create `src/app/(dashboard)/profile/profile-form.tsx`:

Client component with:
- Display name input
- Email display (read-only — changing email requires auth flow)
- Avatar initials display (derived from name)
- Save button with standard save-state pattern
- Uses a server action to update the user's display name in the `profiles` table (or equivalent — check existing user data model)

- [ ] **Step 3: Update the account menu**

In `src/components/auth/account-menu.tsx`:

Replace the disabled "Signed in" menu item with a "Profile" link:

```tsx
<DropdownMenuItem onClick={() => router.push("/profile")}>
  <User2 className="size-4" />
  Profile
</DropdownMenuItem>
```

- [ ] **Step 4: Verify**

- Click avatar → dropdown shows "Profile" and "Sign out"
- Click "Profile" → navigates to `/profile`
- Profile page shows name/email
- Edit name, save → toast, name updates

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/profile/ src/components/auth/account-menu.tsx
git commit -m "feat(nav): add profile page and link from account menu"
```

---

## Task 9: Update Settings Root Redirect

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Check and update the settings root redirect**

The current `settings/page.tsx` likely redirects to `/settings/brand`. Verify this is still correct (Brand is the first item in the settings nav). If it redirects elsewhere, update to `/settings/brand`.

- [ ] **Step 2: Commit (if changed)**

```bash
git add src/app/\(dashboard\)/settings/page.tsx
git commit -m "fix(nav): ensure settings root redirects to brand"
```

---

## Task 10: Final Verification + Cleanup

**Files:** Various

- [ ] **Step 1: Run a full build to catch any broken imports**

```bash
npm run build
```

Fix any TypeScript errors or broken imports from moved files.

- [ ] **Step 2: Verify all redirects work**

Test each old URL redirects correctly:
- `/settings/models` → `/settings/ai`
- `/settings/prompts` → `/settings/ai`
- `/settings/prompts/item_generation` → `/settings/ai/item_generation`
- `/settings/users` → `/users`
- `/settings/item-selection` → `/assessments?tab=rules`
- `/settings/reports` → `/report-templates`
- `/settings/reports/[id]/builder` → `/report-templates/[id]/builder`

- [ ] **Step 3: Verify partner and client portals are unaffected**

Switch to partner portal — nav should be unchanged. Switch to client portal — nav should be unchanged.

- [ ] **Step 4: Verify dark mode**

Check sidebar, settings area, AI config pages, profile page, and psychometrics tabs in both light and dark mode.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix(nav): post-restructure cleanup and import fixes"
```
