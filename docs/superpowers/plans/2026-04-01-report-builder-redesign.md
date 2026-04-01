# Report Builder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the report template builder with honest block definitions, expand-in-place UI, fixed data pipeline, and AI Text as a first-class block type.

**Architecture:** Expand-in-place canvas (Typeform/Tally pattern) replaces the three-panel layout. Block registry is cleaned up with accurate configs. Runner pulls strength/development commentary from library entities. AI Text block integrates with the prompt library for AI-generated report sections.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase (Postgres), Vitest, Tiptap (rich text editor — new dependency)

**Spec:** `docs/superpowers/specs/2026-04-01-report-builder-redesign.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/app/(dashboard)/settings/reports/[id]/builder/block-content-panels.tsx` | Per-block-type content tab panels |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-headers-panel.tsx` | Universal headers tab (eyebrow/heading/description) |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-presentation-panel.tsx` | Presentation tab (mode/chart/columns/accent) |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-print-panel.tsx` | Print tab (page break/hide PDF/hide screen) |
| `src/app/(dashboard)/settings/reports/[id]/builder/add-block-dropdown.tsx` | "+ Add block" dropdown popover |
| `src/components/reports/blocks/ai-text.tsx` | AI Text block rendering component |
| `src/components/rich-text-editor.tsx` | Tiptap rich text editor wrapper |
| `tests/unit/block-registry.test.ts` | Registry validation tests |
| `tests/unit/sample-data.test.ts` | Sample data generator tests |
| `tests/unit/runner-strengths.test.ts` | Strengths resolution tests |
| `tests/unit/runner-development.test.ts` | Development resolution tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/reports/registry.ts` | Clean registry — add AI Text, remove phantom charts, update configs |
| `src/lib/reports/types.ts` | New AiTextConfig, SectionDividerConfig update, remove aiNarrative from strengths/dev |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx` | Full rewrite — expand-in-place layout |
| `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx` | Pass template settings, prompt options |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-config-panels.tsx` | Delete — replaced by block-content-panels.tsx |
| `src/lib/reports/runner.ts` | Strengths uses strengthCommentary, development uses developmentSuggestion, AI Text resolution |
| `src/lib/reports/sample-data.ts` | Respect block config, include commentary fields |
| `src/components/reports/report-renderer.tsx` | Add AI Text to BLOCK_COMPONENTS map |
| `src/components/reports/blocks/strengths-highlights.tsx` | Render strengthCommentary, remove charts/AI |
| `src/components/reports/blocks/development-plan.tsx` | Render developmentSuggestion, remove AI toggle |
| `src/components/reports/blocks/section-divider.tsx` | Four style variants |
| `src/components/reports/blocks/cover-page.tsx` | Tighter sizing, simplified config |
| `src/app/actions/reports.ts` | Add getReportPrompts(), remove autoRelease from template settings |
| `src/app/(dashboard)/factors/factor-form.tsx` | Add strengthCommentary, developmentSuggestion textareas |
| `src/app/(dashboard)/constructs/construct-form.tsx` | Add strengthCommentary, developmentSuggestion textareas |
| `src/app/(dashboard)/dimensions/dimension-form.tsx` | Add strengthCommentary, developmentSuggestion textareas |

---

## Task 1: Clean Up Block Registry & Types

**Files:**
- Modify: `src/lib/reports/types.ts`
- Modify: `src/lib/reports/registry.ts`
- Create: `tests/unit/block-registry.test.ts`

- [ ] **Step 1: Write registry validation tests**

```ts
// tests/unit/block-registry.test.ts
import { describe, it, expect } from 'vitest'
import { BLOCK_REGISTRY, BLOCK_CATEGORIES } from '@/lib/reports/registry'

describe('BLOCK_REGISTRY', () => {
  it('has all expected block types', () => {
    const types = Object.keys(BLOCK_REGISTRY)
    expect(types).toContain('cover_page')
    expect(types).toContain('custom_text')
    expect(types).toContain('section_divider')
    expect(types).toContain('score_overview')
    expect(types).toContain('score_detail')
    expect(types).toContain('strengths_highlights')
    expect(types).toContain('development_plan')
    expect(types).toContain('ai_text')
  })

  it('strengths_highlights has no supportedCharts', () => {
    expect(BLOCK_REGISTRY.strengths_highlights.supportedCharts).toBeUndefined()
  })

  it('development_plan has no supportedCharts', () => {
    expect(BLOCK_REGISTRY.development_plan.supportedCharts).toBeUndefined()
  })

  it('ai_text has no supportedCharts', () => {
    expect(BLOCK_REGISTRY.ai_text.supportedCharts).toBeUndefined()
  })

  it('score_overview has exactly 4 chart types', () => {
    expect(BLOCK_REGISTRY.score_overview.supportedCharts).toEqual(['bar', 'radar', 'gauges', 'scorecard'])
  })

  it('cover_page has fixed featured mode', () => {
    expect(BLOCK_REGISTRY.cover_page.supportedModes).toEqual(['featured'])
  })

  it('section_divider has no modes', () => {
    expect(BLOCK_REGISTRY.section_divider.supportedModes).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/block-registry.test.ts`
Expected: FAIL — ai_text not in registry, strengths still has charts, section_divider still has modes

- [ ] **Step 3: Update types.ts**

In `src/lib/reports/types.ts`:
- Add `'ai_text'` to the `BlockType` union
- Add `'ai'` to the `BlockCategory` union
- Add `AiTextConfig` interface: `{ promptId: string }`
- Update `SectionDividerConfig`: `{ style: 'thin_rule' | 'thick_rule' | 'whitespace' | 'dot_break' }`
- Remove `aiNarrative` from `StrengthsHighlightsConfig`
- Remove `style` from `StrengthsHighlightsConfig`
- Remove `aiNarrative` from `DevelopmentPlanConfig`
- Remove `chartType` from `ScoreOverviewConfig` (it lives at block level)
- Add `showScore` and `showBandLabel` to `ScoreOverviewConfig`
- Rename `showChildBreakdown` to `showNestedScores` in `ScoreDetailConfig`
- Add `AiTextConfig` to `BlockConfigMap`
- Add universal header fields to `BlockConfig`: `eyebrow?: string`, `heading?: string`, `blockDescription?: string`

- [ ] **Step 4: Update registry.ts**

In `src/lib/reports/registry.ts`:
- Add `'ai'` category to `BLOCK_CATEGORIES` with order 3.5 (between highlights and 360)
- Update `section_divider`: `supportedModes: []`, `defaultConfig: { style: 'thin_rule' }`
- Update `score_overview`: `supportedCharts: ['bar', 'radar', 'gauges', 'scorecard']`, remove `chartType` from `defaultConfig`, add `showScore: true, showBandLabel: true`
- Update `strengths_highlights`: remove `supportedCharts`, remove `style` and `aiNarrative` from `defaultConfig`
- Update `development_plan`: remove `aiNarrative` from `defaultConfig`
- Rename `showChildBreakdown` to `showNestedScores` in `score_detail` defaultConfig
- Add `ai_text` entry:
  ```ts
  ai_text: {
    label: 'AI Text',
    category: 'ai',
    description: 'AI-generated narrative content from the prompt library.',
    defaultConfig: { promptId: '' },
    supportedModes: ['open', 'featured', 'inset'],
    defaultMode: 'open',
  },
  ```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/block-registry.test.ts`
Expected: PASS

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: May have downstream errors from renamed fields — note them for later tasks

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/types.ts src/lib/reports/registry.ts tests/unit/block-registry.test.ts
git commit -m "feat(reports): clean block registry — add AI Text, remove phantom charts, update configs"
```

---

## Task 2: Library Form Fields (Strength & Development Commentary)

**Files:**
- Modify: `src/app/(dashboard)/factors/factor-form.tsx`
- Modify: `src/app/(dashboard)/constructs/construct-form.tsx`
- Modify: `src/app/(dashboard)/dimensions/dimension-form.tsx`

- [ ] **Step 1: Read current factor-form.tsx to understand the auto-save field pattern**

Read `src/app/(dashboard)/factors/factor-form.tsx` — find the existing auto-save textarea pattern used for `description`, `definition`, `indicatorsLow`, etc. The new fields follow the exact same pattern.

- [ ] **Step 2: Add strengthCommentary and developmentSuggestion fields to factor-form.tsx**

Add two new auto-save textareas after the existing indicators section, using the same `useAutoSave` + `AutoSaveIndicator` pattern:

- Label: "Strength Commentary" / placeholder: "What to say when this factor is a top-scoring area…"
- Label: "Development Suggestion" / placeholder: "What to say when this factor is an area for development…"

Both use `updateFactorField` action with field names `strengthCommentary` and `developmentSuggestion`.

- [ ] **Step 3: Add the same fields to construct-form.tsx**

Same pattern, using `updateConstructField`.

- [ ] **Step 4: Add the same fields to dimension-form.tsx**

Same pattern, using `updateDimensionField`.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/factors/factor-form.tsx src/app/\(dashboard\)/constructs/construct-form.tsx src/app/\(dashboard\)/dimensions/dimension-form.tsx
git commit -m "feat(library): add strength commentary and development suggestion fields to entity forms"
```

---

## Task 3: Server Actions — Report Prompts & Settings Cleanup

**Files:**
- Modify: `src/app/actions/reports.ts`

- [ ] **Step 1: Read current reports.ts to understand existing actions**

Read `src/app/actions/reports.ts` — find `updateReportTemplateSettings`, `CreateReportTemplateInput`, and understand the pattern.

- [ ] **Step 2: Add getReportPrompts() action**

Add a new server action that fetches all active AI system prompts suitable for report generation:

```ts
export async function getReportPrompts(): Promise<{ id: string; name: string; purpose: string }[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('ai_system_prompts')
    .select('id, name, purpose')
    .eq('is_active', true)
    .like('purpose', 'report_%')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 3: Remove autoRelease from updateReportTemplateSettings**

Remove the `if (updates.autoRelease !== undefined)` line from the action. Remove `autoRelease` from `CreateReportTemplateInput`.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean (or downstream errors from autoRelease removal — those are expected)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/reports.ts
git commit -m "feat(reports): add getReportPrompts action, remove autoRelease from template settings"
```

---

## Task 4: Builder UI — Expand-in-Place Layout

**Files:**
- Modify: `src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx` (full rewrite)
- Modify: `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx`
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/add-block-dropdown.tsx`

- [ ] **Step 1: Update page.tsx to pass template settings and prompt options**

Read and update `page.tsx` to:
- Call `getReportPrompts()` in parallel with existing fetches
- Pass `templateSettings` and `promptOptions` to `BlockBuilderClient`

- [ ] **Step 2: Create add-block-dropdown.tsx**

A popover dropdown triggered by "+ Add block" button. Groups block types by category from `BLOCK_CATEGORIES` and `BLOCK_REGISTRY`. Deferred/360 blocks shown greyed out with "Coming soon". Clicking an active block type calls the `onAdd(type)` callback.

- [ ] **Step 3: Rewrite block-builder-client.tsx — scaffold**

Replace the entire file with the expand-in-place layout:
- Top bar: back, editable name, badge, `+ Add block` (using `AddBlockDropdown`), gear icon, preview, save
- Full-width canvas with `max-w-3xl` centered
- Block cards: collapsed and expanded states
- Template settings sheet (gear icon → Sheet with displayLevel, personReference)
- State: `blocks`, `expandedBlockId`, `name`, entity options, usage, settings

The component manages:
- `addBlock(type)` — adds block with defaults from registry, expands it
- `removeBlock(id)` — removes with confirmation
- `toggleExpand(id)` — expand/collapse (only one at a time)
- `updateConfig(key, value)` — update expanded block's config
- `updateBlock(updates)` — update block-level fields (mode, chartType, etc.)
- Drag to reorder
- Save (blocks + name)
- Template settings save

- [ ] **Step 4: Block cards — collapsed state**

Each collapsed card renders:
```
[Grip] [Number] [Type Name] [ModeTag] [Summary] [Delete] [Chevron]
```

Use the `getBlockSummary()` helper (move from old block-config-panels.tsx or rewrite to match new configs).

Inline `+` buttons between cards (visible on hover).

- [ ] **Step 5: Block cards — expanded state with tabs**

Expanded block shows four tabs: Content, Headers, Presentation, Print.

Tab component using a simple `useState` for active tab. Tab content renders the appropriate panel component.

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors for missing panel components — those are created in next tasks

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/settings/reports/\[id\]/builder/
git commit -m "feat(reports): expand-in-place builder layout with tab system"
```

---

## Task 5: Block Tab Panels — Content

**Files:**
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/block-content-panels.tsx`
- Delete: `src/app/(dashboard)/settings/reports/[id]/builder/block-config-panels.tsx`

- [ ] **Step 1: Create block-content-panels.tsx**

Per-block-type content panels. Each panel has curated controls specific to that block type. Export a `BlockContentPanel` component that routes to the right panel by `block.type`.

Panels:
- `CoverPageContent` — showDate, showLogo, showPoweredBy, poweredByText
- `CustomTextContent` — rich text editor for content (placeholder for now — Tiptap integration in Task 9)
- `SectionDividerContent` — style selector (4 options with visual previews)
- `ScoreOverviewContent` — displayLevel, entity multi-select, showScore, showBandLabel, groupByDimension
- `ScoreDetailContent` — displayLevel, entity multi-select, 6 show toggles, chartType for per-entity vis
- `StrengthsContent` — topN (number input), displayLevel
- `DevelopmentContent` — maxItems, displayLevel, prioritiseByScore, entityIds filter
- `AiTextContent` — promptId dropdown (populated from promptOptions prop)
- `NormComparisonContent` — "Coming soon" message
- `RaterComparisonContent` — "Coming soon" message
- `GapAnalysisContent` — "Coming soon" message
- `OpenCommentsContent` — "Coming soon" message

Reuse the `EntityMultiSelect` component from the existing code.

- [ ] **Step 2: Delete old block-config-panels.tsx**

```bash
rm src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-config-panels.tsx
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add -A src/app/\(dashboard\)/settings/reports/\[id\]/builder/
git commit -m "feat(reports): per-block content panels replacing auto-generated config"
```

---

## Task 6: Block Tab Panels — Headers, Presentation, Print

**Files:**
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/block-headers-panel.tsx`
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/block-presentation-panel.tsx`
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/block-print-panel.tsx`

- [ ] **Step 1: Create block-headers-panel.tsx**

Universal layout for every block type:
- Eyebrow — text input, placeholder "e.g. Your Profile"
- Heading — text input, placeholder "e.g. Score Overview"
- Description — textarea, placeholder "Optional supporting text…"

All update block-level fields via `onUpdateBlock({ eyebrow, heading, blockDescription })`.

- [ ] **Step 2: Create block-presentation-panel.tsx**

Contextual based on block type:
- Mode selector — from `BLOCK_REGISTRY[type].supportedModes` (hidden if empty, e.g. section_divider)
- Chart type — only shown if `BLOCK_REGISTRY[type].supportedCharts` exists
- Columns — only shown when mode is 'carded' (1/2/3 selector)
- Inset accent — only shown when mode is 'inset'

- [ ] **Step 3: Create block-print-panel.tsx**

Three toggles:
- Page break before
- Hide in PDF
- Hide on screen

- [ ] **Step 4: Wire panels into the expanded block tabs in block-builder-client.tsx**

Import and render each panel in the appropriate tab.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/settings/reports/\[id\]/builder/
git commit -m "feat(reports): universal headers, presentation, and print tab panels"
```

---

## Task 7: Rendering Fixes — Block Components

**Files:**
- Modify: `src/components/reports/blocks/strengths-highlights.tsx`
- Modify: `src/components/reports/blocks/development-plan.tsx`
- Modify: `src/components/reports/blocks/section-divider.tsx`
- Modify: `src/components/reports/blocks/cover-page.tsx`
- Create: `src/components/reports/blocks/ai-text.tsx`
- Modify: `src/components/reports/report-renderer.tsx`

- [ ] **Step 1: Update strengths-highlights.tsx**

- Change data interface: expect `strengthCommentary` instead of derived narrative
- Remove chart rendering code
- Remove AI narrative callout
- Render each highlight as: entity name + strength commentary text
- Keep mode-based layout (featured/carded/open)

- [ ] **Step 2: Update development-plan.tsx**

- Remove AI narrative/suggestion rendering
- Render each item as: entity name + `developmentSuggestion` text
- Keep mode-based layout

- [ ] **Step 3: Update section-divider.tsx**

- Read current `style` from data (defaulting to `thin_rule`)
- Render four variants:
  - `thin_rule`: 1px border-top, muted colour, full width
  - `thick_rule`: 3px border-top, primary colour, 80px width
  - `whitespace`: 48-64px vertical padding, no visible element
  - `dot_break`: three centred dots with letter-spacing
- No mode wrapper

- [ ] **Step 4: Update cover-page.tsx**

- Reduce min-height from 60vh to something more proportional (e.g. `min-h-[300px]` screen, full page print)
- Remove subtitle rendering — pull assessment name from session data automatically
- Simplify logo: single `showLogo` check

- [ ] **Step 5: Create ai-text.tsx**

New block component:
- Props: `{ data: Record<string, unknown>; mode?: PresentationMode }`
- Data shape: `{ generatedText: string; promptName: string; isPreview?: boolean }`
- If `isPreview` or no `generatedText`: render placeholder message
- Otherwise: render formatted text with subtle "AI-generated" badge
- Respects mode wrapper (open/featured/inset)

- [ ] **Step 6: Update report-renderer.tsx**

Add `ai_text: AiTextBlock` to `BLOCK_COMPONENTS` map. Import the new component.

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

- [ ] **Step 8: Commit**

```bash
git add src/components/reports/
git commit -m "feat(reports): update block components — strengths/dev use commentary, new AI Text and divider styles"
```

---

## Task 8: Runner Pipeline Updates

**Files:**
- Modify: `src/lib/reports/runner.ts`
- Create: `tests/unit/runner-strengths.test.ts`
- Create: `tests/unit/runner-development.test.ts`

- [ ] **Step 1: Write strengths resolution test**

```ts
// tests/unit/runner-strengths.test.ts
import { describe, it, expect } from 'vitest'

describe('strengths highlights resolution', () => {
  it('returns top N entities by score with strengthCommentary', () => {
    // Test that given 5 entities with scores and strengthCommentary,
    // topN=3 returns the 3 highest scored with their commentary
  })

  it('returns empty commentary when entity has no strengthCommentary', () => {
    // Graceful fallback
  })
})
```

- [ ] **Step 2: Write development resolution test**

```ts
// tests/unit/runner-development.test.ts
import { describe, it, expect } from 'vitest'

describe('development plan resolution', () => {
  it('returns bottom N entities by score with developmentSuggestion', () => {
    // Test that given 5 entities, maxItems=3, prioritiseByScore=true,
    // returns 3 lowest scored with their developmentSuggestion
  })

  it('respects entityIds filter', () => {
    // Only includes entities in the filter
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/runner-strengths.test.ts tests/unit/runner-development.test.ts`

- [ ] **Step 4: Update runner.ts — strengths resolution**

Read `src/lib/reports/runner.ts` and find the strengths_highlights resolution logic. Update it to:
- Fetch `strengthCommentary` from taxonomy entities
- Rank by POMP score descending
- Take top N (from block config)
- Return `{ entityName, pompScore, bandResult, strengthCommentary }` per entity
- Remove AI narrative generation call for this block type

- [ ] **Step 5: Update runner.ts — development resolution**

Find development_plan resolution logic. Update to:
- Fetch `developmentSuggestion` from taxonomy entities (already partially done)
- Rank by score ascending when prioritiseByScore is true
- Take bottom N
- Apply entityIds filter if present
- Return `{ entityName, pompScore, bandResult, developmentSuggestion }` per entity
- Remove AI narrative generation call for this block type

- [ ] **Step 6: Add AI Text block resolution to runner**

Add a new case in the block resolution switch for `ai_text`:
- Read `promptId` from config
- Fetch the prompt template from `ai_system_prompts` by ID
- Fetch the model config for that prompt's purpose
- Assemble full data context (all scores, bands, entities, commentary, participant info)
- Call the model via existing OpenRouter integration
- Return `{ generatedText, promptName, model }`
- On failure: return `{ generatedText: 'Unable to generate narrative. Please try again.', error: true }`

- [ ] **Step 7: Remove duplicate chartType from score_overview resolution**

Ensure the runner reads `block.chartType` (block-level) not `block.config.chartType`.

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/unit/runner-strengths.test.ts tests/unit/runner-development.test.ts`
Expected: PASS

- [ ] **Step 9: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

- [ ] **Step 10: Commit**

```bash
git add src/lib/reports/runner.ts tests/unit/runner-strengths.test.ts tests/unit/runner-development.test.ts
git commit -m "feat(reports): runner uses library commentary, adds AI Text resolution"
```

---

## Task 9: Sample Data Generator

**Files:**
- Modify: `src/lib/reports/sample-data.ts`
- Create: `tests/unit/sample-data.test.ts`

- [ ] **Step 1: Write sample data tests**

```ts
// tests/unit/sample-data.test.ts
import { describe, it, expect } from 'vitest'

describe('generateSampleData', () => {
  it('respects topN on strengths block', () => {
    // Generate sample data for a strengths block with topN=5
    // Expect 5 highlights in the result
  })

  it('respects maxItems on development block', () => {
    // Generate sample data for a development block with maxItems=4
    // Expect 4 items
  })

  it('generates placeholder for AI Text block', () => {
    // Expect generatedText to contain placeholder message
    // Expect isPreview to be true
  })

  it('includes strengthCommentary in sample entities', () => {
    // Sample highlights should have non-empty strengthCommentary
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sample-data.test.ts`

- [ ] **Step 3: Update sample-data.ts**

Read and update `src/lib/reports/sample-data.ts`:
- Read block config to determine counts (topN, maxItems, entityIds)
- Generate appropriate sample entities with strengthCommentary and developmentSuggestion
- Add `ai_text` case: return `{ generatedText: 'AI-generated narrative will appear here when the report is generated.', promptName: 'Preview', isPreview: true }`
- Update section_divider to pass through the `style` config value
- Respect `displayLevel` for entity name generation

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/sample-data.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/sample-data.ts tests/unit/sample-data.test.ts
git commit -m "feat(reports): sample data respects block config, supports AI Text"
```

---

## Task 10: Rich Text Editor for Custom Text Block

**Files:**
- Modify: `package.json` (add tiptap dependency)
- Create: `src/components/rich-text-editor.tsx`
- Modify: `src/app/(dashboard)/settings/reports/[id]/builder/block-content-panels.tsx` (CustomTextContent)

- [ ] **Step 1: Install Tiptap**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
```

- [ ] **Step 2: Create rich-text-editor.tsx**

A reusable rich text editor component wrapping Tiptap:
- Props: `{ content: string; onChange: (html: string) => void; placeholder?: string }`
- Starter kit extensions (bold, italic, headings, lists, blockquote)
- Styled to match the app's design system (dark mode compatible)
- Outputs HTML string

- [ ] **Step 3: Wire into CustomTextContent panel**

Replace the plain `<Textarea>` in the custom text content panel with `<RichTextEditor>`.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/rich-text-editor.tsx src/app/\(dashboard\)/settings/reports/\[id\]/builder/block-content-panels.tsx
git commit -m "feat: add Tiptap rich text editor for custom text blocks"
```

---

## Task 11: Integration Testing & Cleanup

**Files:**
- Various — cleanup pass

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Fix any remaining type errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Fix any failures.

- [ ] **Step 3: Remove old block-config-panels.tsx imports**

Search for any remaining imports of the deleted file and update them.

- [ ] **Step 4: Verify parseBlocks handles new block types**

Read `src/lib/reports/registry.ts` — ensure `parseBlocks()` correctly handles `ai_text` blocks and the updated configs.

- [ ] **Step 5: Push migrations**

Run: `npm run db:push`
Verify the strength_commentary column and seed data are applied.

- [ ] **Step 6: Manual smoke test**

Open the builder in the browser:
1. Gear icon opens template settings sheet with displayLevel + personReference
2. `+ Add block` dropdown shows all categories with 360 greyed out
3. Click a block → expands with 4 tabs
4. Content tab shows correct controls per block type
5. Score overview: single chart type selector, no duplicates
6. Strengths: topN input, no chart selector
7. AI Text: prompt dropdown populated from DB
8. Section divider: 4 style options
9. Preview renders correctly
10. Dark mode looks correct

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "fix(reports): integration cleanup and verification"
```
