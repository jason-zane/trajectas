# Assessment Flow Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move assessment intro pages from the experience template into the assessment builder, simplify the participant flow, fix the branding preview, and restructure the experience editor into clear pre/assessment/post zones.

**Architecture:** A new `intro_content` JSONB column on `assessments` stores per-assessment intro pages. A new `intro_override` JSONB column on `campaign_assessments` allows campaigns to suppress or replace intros. The flow router routes to `/assess/[token]/assessment-intro/[assessmentIndex]` instead of directly to sections. The experience editor removes `section_intro` and reorganises into three visual zones. The branding preview gets a client selector.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase (JSONB columns), Tiptap rich text editor, shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-04-07-assessment-flow-simplification-design.md`

---

## File Structure

### New Files
- `supabase/migrations/00074_assessment_intro_and_flow_cleanup.sql` — Schema migration
- `src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx` — Runtime assessment intro page
- `src/app/assess/[token]/assessment-intro/[assessmentIndex]/loading.tsx` — Shimmer skeleton for intro page
- `src/app/(dashboard)/assessments/[id]/edit/intro/page.tsx` — Assessment builder intro tab (or section within existing edit page)
- `src/app/(dashboard)/assessments/[id]/edit/intro/assessment-intro-editor.tsx` — Client component for intro editing
- `src/app/actions/assessment-intro.ts` — Server actions for intro CRUD

### Modified Files
- `src/types/database.ts` — Add `introContent` to `Assessment` interface
- `src/lib/experience/types.ts` — Remove `section_intro` from `ExperiencePageType`, update `FlowConfig`
- `src/lib/experience/defaults.ts` — Remove `section_intro` from `DEFAULT_PAGE_CONTENT`
- `src/lib/experience/flow-router.ts` — Route to `assessment-intro/0` instead of `section/0`
- `src/lib/supabase/mappers.ts` — Map `intro_content` on assessment rows
- `src/app/assess/[token]/section/[sectionIndex]/page.tsx` — Compute `postAssessmentUrl`, pass to SectionWrapper
- `src/components/assess/section-wrapper.tsx` — Rename prop `postSectionsUrl` → `postAssessmentUrl`, remove `sectionIntroContent`
- `src/components/flow-editor/flow-sidebar.tsx` — Remove `section_intro`, update zone logic
- `src/components/flow-editor/page-preview-frame.tsx` — Remove `PreviewSectionIntro` case
- `src/components/flow-editor/flow-editor.tsx` — Remove section_intro state handling
- `src/app/(dashboard)/settings/experience/page.tsx` — Add client selector for branding preview
- `src/app/actions/campaigns.ts` — Add `getCampaignAssessmentIntros()` for campaign override data

### Files to Delete
- `src/components/flow-editor/previews/preview-section-intro.tsx` — No longer needed
- `src/components/assess/section-intro-screen.tsx` — Replaced by assessment-intro route

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00074_assessment_intro_and_flow_cleanup.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add assessment intro content column
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS intro_content JSONB DEFAULT NULL;

COMMENT ON COLUMN assessments.intro_content IS
  'Per-assessment intro page content: { enabled, heading, body, buttonLabel }. NULL = never configured.';

-- Add campaign-level intro override column
ALTER TABLE campaign_assessments
  ADD COLUMN IF NOT EXISTS intro_override JSONB DEFAULT NULL;

COMMENT ON COLUMN campaign_assessments.intro_override IS
  'Campaign override for assessment intro: null = use default, { suppress: true } = skip, or { heading, body, buttonLabel } = custom.';

-- Remove section_intro from all experience template flow configs
UPDATE experience_templates
SET flow_config = flow_config - 'section_intro'
WHERE flow_config ? 'section_intro';

-- Remove section_intro from page_content
UPDATE experience_templates
SET page_content = page_content - 'section_intro'
WHERE page_content ? 'section_intro';
```

- [ ] **Step 2: Push the migration**

```bash
npm run db:push
```

The schema cache is automatically reloaded after migration push.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00074_assessment_intro_and_flow_cleanup.sql
git commit -m "feat(schema): add assessment intro_content and campaign intro_override columns"
```

---

## Task 2: Type Updates

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/experience/types.ts`
- Modify: `src/lib/experience/defaults.ts`
- Modify: `src/lib/supabase/mappers.ts`

- [ ] **Step 1: Add `AssessmentIntroContent` type and update `Assessment` interface**

In `src/types/database.ts`, add the new type near the Assessment interface:

```typescript
export interface AssessmentIntroContent {
  enabled: boolean
  heading: string
  body: string
  buttonLabel: string
}
```

Add to the `Assessment` interface:
```typescript
introContent?: AssessmentIntroContent | null
```

Also add `IntroOverride` type:
```typescript
export type IntroOverride =
  | null
  | { suppress: true }
  | { heading: string; body: string; buttonLabel: string }
```

- [ ] **Step 2: Remove `section_intro` from experience types**

In `src/lib/experience/types.ts`:
- Remove `'section_intro'` from the `ExperiencePageType` union
- Remove `SectionIntroContent` from `PageContentMap` (or mark it as deprecated — check if it's used elsewhere first)
- Remove any `section_intro` reference from `FlowConfig`

In `src/lib/experience/defaults.ts`:
- Remove the `section_intro` entry from `DEFAULT_PAGE_CONTENT`

- [ ] **Step 3: Update the assessment mapper**

In `src/lib/supabase/mappers.ts`, in `mapAssessmentRow()`:
- Add `introContent: row.intro_content ?? null` to the mapped object

In `toAssessmentInsert()`:
- Add `intro_content: a.introContent ?? null` to the insert object

Also update `mapCampaignAssessmentRow()` (if it exists) to include:
- `introOverride: row.intro_override ?? null`

And update the `CampaignAssessment` interface in `database.ts` to add:
```typescript
introOverride?: IntroOverride
```

- [ ] **Step 4: Add `assessmentTitle` and `questionCount` to TemplateVariables**

In `src/lib/experience/types.ts`, update the `TemplateVariables` interface:
```typescript
assessmentTitle?: string
questionCount?: number
```

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/types/database.ts src/lib/experience/types.ts src/lib/experience/defaults.ts src/lib/supabase/mappers.ts
git commit -m "feat(types): add assessment intro types, remove section_intro from experience"
```

---

## Task 3: Assessment Intro Server Actions

**Files:**
- Create: `src/app/actions/assessment-intro.ts`

- [ ] **Step 1: Create the server actions file**

Create `src/app/actions/assessment-intro.ts` with `'use server'` directive:

**`getAssessmentIntro(assessmentId: string)`** — fetches `intro_content` from the assessments table. Returns `AssessmentIntroContent | null`. Requires admin scope.

**`updateAssessmentIntro(assessmentId: string, content: AssessmentIntroContent)`** — upserts `intro_content` JSONB on the assessments table. Audit logged. Revalidates `/assessments/${assessmentId}/edit`.

**`toggleAssessmentIntro(assessmentId: string, enabled: boolean)`** — updates just the `enabled` field within the existing `intro_content` JSONB (if it exists). If `intro_content` is null and `enabled` is true, creates a default content object with heading = assessment title, empty body, buttonLabel = "Begin Assessment". Revalidates path.

**`updateCampaignIntroOverride(campaignId: string, assessmentId: string, override: IntroOverride)`** — updates `intro_override` on the `campaign_assessments` junction row. Audit logged. Revalidates campaign experience paths.

**`getCampaignAssessmentIntros(campaignId: string)`** — fetches all campaign_assessments for this campaign joined with assessments.intro_content and assessments.title. Returns array of `{ assessmentId, assessmentTitle, introContent, introOverride }`. Used by the campaign experience editor.

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/actions/assessment-intro.ts
git commit -m "feat(actions): add assessment intro CRUD and campaign override actions"
```

---

## Task 4: Assessment Builder Intro Tab

**Files:**
- Create: `src/app/(dashboard)/assessments/[id]/edit/intro/page.tsx`
- Create: `src/app/(dashboard)/assessments/[id]/edit/intro/assessment-intro-editor.tsx`
- Create: `src/app/(dashboard)/assessments/[id]/edit/intro/loading.tsx`
- Modify: `src/app/(dashboard)/assessments/[id]/edit/page.tsx` — Add navigation link to intro tab

The assessment edit page (`/assessments/[id]/edit`) currently renders a single `AssessmentBuilder` component with no tab system. The intro editor is added as a sub-route (`/assessments/[id]/edit/intro`) with a navigation link from the main edit page. The main edit page gets a simple tab bar or link row at the top: "Builder" (active on `/edit`) | "Intro" (links to `/edit/intro`).

- [ ] **Step 1: Create the assessment intro editor client component**

Create `src/app/(dashboard)/assessments/[id]/edit/intro/assessment-intro-editor.tsx` ("use client"):

Props: `{ assessmentId: string, assessmentTitle: string, initialContent: AssessmentIntroContent | null }`

UI:
- Toggle switch: "Show intro page" — Zone 1, calls `toggleAssessmentIntro` immediately with toast
- Heading input — pre-filled with assessment title if content is null
- Rich text body — use the existing Tiptap `RichTextEditor` component from `@/components/rich-text-editor`
- Button label input — default "Begin Assessment"
- Template variable hints: show available vars (`{{assessmentTitle}}`, `{{questionCount}}`) as helper text below the body editor. Show `{{estimatedMinutes}}` as "Coming soon".
- All text fields auto-save (Zone 3): blur + 3s debounce via `useAutoSave` pattern, calling `updateAssessmentIntro`

- [ ] **Step 2: Create the intro tab page and loading skeleton**

Create `src/app/(dashboard)/assessments/[id]/edit/intro/page.tsx`:

Server component:
- Fetch assessment by ID (to get title and existing intro_content)
- Render a back/nav link to `/assessments/[id]/edit` ("Back to Builder")
- Render `PageHeader` with eyebrow "Assessment", title "Intro Page"
- Render `AssessmentIntroEditor` with the data

Create `src/app/(dashboard)/assessments/[id]/edit/intro/loading.tsx`:
- Shimmer skeleton matching the intro editor layout (toggle + heading input + textarea + button label input)

- [ ] **Step 3: Add navigation link to the assessment edit page**

In `src/app/(dashboard)/assessments/[id]/edit/page.tsx`:
- Add a simple link/button row below the PageHeader that links to `/assessments/[id]/edit/intro` with text like "Edit Assessment Intro Page" or a tab-style navigation bar with "Builder | Intro" links.

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/\(dashboard\)/assessments/\[id\]/edit/
git commit -m "feat(assessments): add intro page editor tab in assessment builder"
```

---

## Task 5: Flow Router + Assessment Intro Runtime Route

**Files:**
- Modify: `src/lib/experience/flow-router.ts`
- Create: `src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx`

- [ ] **Step 1: Update the flow router**

In `src/lib/experience/flow-router.ts`:

Change `getNextFlowUrl()`: when the next step is `SECTIONS_SENTINEL`, return `/assess/${token}/assessment-intro/0` instead of `/assess/${token}/section/0`.

```typescript
if (next === SECTIONS_SENTINEL) {
  return `/assess/${token}/assessment-intro/0`
}
```

- [ ] **Step 2: Create the assessment intro runtime page**

Create `src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx`:

Server component:
1. `const { token, assessmentIndex: idxStr } = await params`
2. Validate token via `validateAccessToken(token)`
3. Parse `assessmentIndex` as integer
4. Get the assessment at this index from `result.data.assessments[idx]`
5. If no assessment at that index → redirect to first post-assessment page
6. Query `campaign_assessments` for this campaign + assessment to get `intro_override`
7. Resolve intro content:
   - If `intro_override` is `{ suppress: true }` → redirect to `/assess/${token}/section/0`
   - If `intro_override` has heading/body/buttonLabel → use that
   - Else use `assessments.intro_content` (query assessment by ID)
   - If resolved content is null or `enabled` is false → redirect to `/assess/${token}/section/0`
8. Load effective brand via `getEffectiveBrand(campaign.clientId, campaign.id)`
9. Load experience template for template variable interpolation
10. Interpolate template variables in heading and body (`assessmentTitle`, `questionCount`)
11. Render the intro page:
    - Brand CSS tokens (same pattern as other flow pages)
    - Logo, heading, body (rendered as HTML), button
    - Button links to `/assess/${token}/section/0`

Use the same visual pattern as the welcome page for consistency (PreviewShell-like layout).

- [ ] **Step 3: Create loading skeleton**

Create `src/app/assess/[token]/assessment-intro/[assessmentIndex]/loading.tsx`:
- Shimmer skeleton with centered content area: heading shimmer + body shimmer + button shimmer
- Use `animate-shimmer` (not animate-pulse)

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/lib/experience/flow-router.ts src/app/assess/\[token\]/assessment-intro/
git commit -m "feat(flow): add assessment-intro route, update flow router to use it"
```

---

## Task 6: Section Page + SectionWrapper Updates

**Files:**
- Modify: `src/app/assess/[token]/section/[sectionIndex]/page.tsx`
- Modify: `src/components/assess/section-wrapper.tsx`
- Delete: `src/components/assess/section-intro-screen.tsx`

- [ ] **Step 1: Update the section page to compute postAssessmentUrl**

In `src/app/assess/[token]/section/[sectionIndex]/page.tsx`:

After determining `targetAssessment`, compute the URL for when this assessment's questions finish:

```typescript
// Find current assessment's position in the campaign's assessment list
const currentAssessmentIdx = assessments.findIndex(
  (a) => a.assessmentId === targetAssessment.assessmentId
)
const nextAssessmentIdx = currentAssessmentIdx + 1

let postAssessmentUrl: string
if (nextAssessmentIdx < assessments.length) {
  // More assessments to go — route to next assessment's intro
  postAssessmentUrl = `/assess/${token}/assessment-intro/${nextAssessmentIdx}`
} else {
  // Last assessment — route to first post-assessment page
  postAssessmentUrl = getPostSectionsUrl(experience, token)
}
```

Replace `postSectionsUrl` with `postAssessmentUrl` in the `SectionWrapper` props.

Remove: the `sectionIntroContent` prop and the `getPageContent(experience, "section_intro")` call + `interpolateContent` call for section intro.

**Verification note:** The `totalSections` and `sectionIndex` values passed to `SectionWrapper` are already scoped to the current assessment (loaded via `getSessionState` which queries sections for `session.assessment_id`). The within-assessment section-to-section navigation (`section/${sectionIndex + 1}`) is unaffected by this change. Only the "after last section" URL changes (from `postSectionsUrl` to `postAssessmentUrl`).

- [ ] **Step 2: Update SectionWrapper props**

In `src/components/assess/section-wrapper.tsx`:

- Rename prop `postSectionsUrl` → `postAssessmentUrl`
- Remove prop `sectionIntroContent`
- Remove the `introShown` state and the `SectionIntroScreen` conditional render
- Remove the import of `SectionIntroScreen`
- Update all references from `postSectionsUrl` to `postAssessmentUrl`

- [ ] **Step 3: Delete section-intro-screen.tsx**

```bash
rm src/components/assess/section-intro-screen.tsx
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/assess/\[token\]/section/ src/components/assess/
git commit -m "feat(runner): replace section intro with assessment intro, update navigation"
```

---

## Task 7: Experience Editor — Remove Section Intro + Three-Zone Layout

**Files:**
- Modify: `src/components/flow-editor/flow-sidebar.tsx`
- Modify: `src/components/flow-editor/page-preview-frame.tsx`
- Modify: `src/components/flow-editor/flow-editor.tsx`
- Delete: `src/components/flow-editor/previews/preview-section-intro.tsx`

- [ ] **Step 1: Update flow-sidebar.tsx**

In `buildPageList()` function:
- Remove the hardcoded `section_intro` entry
- The three-zone layout (pre / assessment / post) already exists in this file — verify the assessment zone placeholder card says something like "Assessments — Each assessment shows its own intro then questions" with subtitle "Configure assessment intros in the Assessment Builder"

- [ ] **Step 2: Update page-preview-frame.tsx**

- Remove the `case "section_intro":` and its `<PreviewSectionIntro>` render
- Remove the import of `PreviewSectionIntro`

- [ ] **Step 3: Update flow-editor.tsx**

- Remove any `section_intro` handling from state management (pageContent updates, save logic)
- Remove the `section_intro` page content from the initial state if it was being loaded

- [ ] **Step 4: Delete preview-section-intro.tsx**

```bash
rm src/components/flow-editor/previews/preview-section-intro.tsx
```

Update the barrel export in `src/components/flow-editor/previews/index.ts` to remove the `PreviewSectionIntro` export.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/components/flow-editor/
git commit -m "feat(editor): remove section_intro, update three-zone flow layout"
```

---

## Task 8: Branding Preview Fix

**Files:**
- Modify: `src/app/(dashboard)/settings/experience/page.tsx`
- Modify: `src/components/flow-editor/flow-editor.tsx` (add client selector state)
- Modify: `src/components/flow-editor/page-preview-frame.tsx` (accept dynamic brand)

- [ ] **Step 1: Add client list to the platform experience page**

In `src/app/(dashboard)/settings/experience/page.tsx`:

Fetch the list of active clients alongside existing data:
```typescript
const [record, brandRecord, { data: clients }] = await Promise.all([
  getPlatformExperienceTemplate(),
  getPlatformBrand(),
  db.from("clients").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
])
```

Pass `clients` to `FlowEditor` as a new `clients` prop.

- [ ] **Step 2: Add "Preview as" client selector to FlowEditor**

In `src/components/flow-editor/flow-editor.tsx`:

Add optional prop: `clients?: Array<{ id: string; name: string }>`

Add state: `const [previewClientId, setPreviewClientId] = useState<string | null>(null)`

When `previewClientId` changes, fetch the effective brand via a dedicated server action. Create `getClientBrandForPreview(clientId: string)` in `src/app/actions/brand.ts` (or similar) — a thin wrapper around `getEffectiveBrand` that can be called from the client component. Use `useTransition` + `useEffect` to handle the async fetch, with the current brand shown while loading.

Add a `<Select>` or combobox in the preview panel header area that lists clients + a "Platform (default)" option.

- [ ] **Step 3: Pass dynamic brand to PagePreviewFrame**

The `PagePreviewFrame` already accepts `brandConfig` as a prop. The change is in `FlowEditor` — when `previewClientId` is set, pass the client's brand instead of the platform brand.

Use a server action like `getEffectiveBrand(clientId)` (check if this exists or needs a wrapper that can be called from client).

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/\(dashboard\)/settings/experience/ src/components/flow-editor/
git commit -m "feat(editor): add client selector for branding preview"
```

---

## Task 9: Campaign Experience — Assessment Intro Overrides

**Files:**
- Modify: `src/components/flow-editor/flow-editor.tsx` — Accept campaign assessment data
- Create or modify campaign experience page to pass linked assessments

- [ ] **Step 1: Add campaign assessment intro override UI**

In `FlowEditor`, when `ownerType === "campaign"`, show an additional section in the assessment zone:

For each linked assessment (passed as a new `campaignAssessments` prop):
- Assessment name
- Current status badge: "Using default" / "Custom" / "Skipped"
- Expandable section with:
  - Radio group: "Use assessment default" / "Custom intro" / "Skip intro"
  - If "Custom": heading input, Tiptap body editor, button label input
  - Save button that calls `updateCampaignIntroOverride(campaignId, assessmentId, override)`

- [ ] **Step 2: Update campaign experience page to pass data**

Find the campaign experience page (likely at `src/app/(dashboard)/campaigns/[id]/experience/page.tsx`).

First, fetch the campaign record to get `clientId` (use existing `getCampaignById(id)` or equivalent). Then:
- Call `getCampaignAssessmentIntros(campaignId)` and pass the result to `FlowEditor` as `campaignAssessments` prop
- Call `getEffectiveBrand(campaign.clientId, campaign.id)` instead of `getPlatformBrand()` so the preview automatically shows the client's brand

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/components/flow-editor/ src/app/\(dashboard\)/campaigns/
git commit -m "feat(campaigns): add assessment intro override UI in campaign experience editor"
```

---

## Task 10: Final Verification + Cleanup

**Files:** Various

- [ ] **Step 1: Run a full build**

```bash
npm run build
```

Fix any TypeScript errors or broken imports.

- [ ] **Step 2: Verify the assessment builder intro tab**

- Navigate to an assessment → edit → Intro tab
- Toggle intro on/off
- Edit heading, body, button label
- Verify auto-save works

- [ ] **Step 3: Verify the participant flow**

Reset a test participant and walk through:
- Token landing → Welcome → Assessment Intro (from assessment) → Questions → Review → Complete
- Verify the intro page shows the assessment's content with correct branding
- Verify suppressing the intro in campaign settings skips to questions

- [ ] **Step 4: Verify the experience editor**

- Platform level: three zones visible, no section_intro card, "Preview as" client dropdown works
- Campaign level: assessment intro override section visible, can set custom/skip/default

- [ ] **Step 5: Verify dark mode**

Check all new/modified pages in both light and dark mode.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "fix: assessment flow simplification cleanup"
```
