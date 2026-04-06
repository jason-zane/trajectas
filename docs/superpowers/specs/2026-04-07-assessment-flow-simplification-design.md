# Assessment Flow Simplification

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Assessment-owned intro pages, flow router restructure, experience editor cleanup, branding preview fix.

## Problem

The participant assessment flow has several issues:

1. **No assessment-specific intro** — the experience template owns a generic "section intro" page, but there's no way to write instructions specific to a particular assessment. Campaign admins have to configure this per-campaign.
2. **Flow ordering bug** — the `review` and `complete` pages had order values < 100, placing them before the `__sections__` sentinel instead of after. Fixed in migration 00072 but the architecture needs clarification.
3. **Branding preview broken** — the experience editor always shows platform brand, not the client brand that participants will actually see.
4. **Reports page misplaced** — sits ambiguously in the flow instead of clearly post-assessment.
5. **Section intro is redundant** — per-section instructions already exist on `assessment_sections.instructions`. A dedicated flow page for section intros adds complexity without value.

## Design Principles

1. **Assessments own their context** — an assessment's intro, instructions, and framing live with the assessment definition, not the campaign experience template. Build once, reuse across campaigns.
2. **Campaigns own the wrapper** — welcome, consent, demographics, complete, report pages are campaign concerns. Campaigns can override or suppress an assessment's intro but don't have to configure it.
3. **Simple by default** — a campaign with one assessment and sensible defaults should require zero experience configuration.

## New Participant Flow

```
Pre-assessment:
  1. Join (token validation + routing)
  2. Welcome (campaign-level)
  3. Consent (optional)
  4. Demographics (optional)
  [Custom pages — order < 100]

Per assessment (repeats for multi-assessment campaigns):
  5. Assessment Intro (from assessment definition, overridable per campaign)
  6. Questions (sections/items)

Post-assessment:
  [Custom pages — order >= 100]
  7. Review (optional)
  8. Complete
  9. Report (optional — show results)
```

Custom pages can be placed anywhere — before assessments, between assessments, or after. Order numbers control placement.

## Schema Changes

### `assessments` table

Add column:
```sql
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS intro_content JSONB DEFAULT NULL;
```

Shape:
```typescript
interface AssessmentIntroContent {
  enabled: boolean      // Toggle — false hides the page but preserves content
  heading: string       // e.g. "AI Capability Index"
  body: string          // Rich text HTML from Tiptap editor
  buttonLabel: string   // e.g. "Begin Assessment"
}
```

`NULL` means intro has never been configured. `{ enabled: false, ... }` means the admin wrote content but toggled the intro off — content is preserved for re-enabling later. The intro page is shown only when `intro_content` is non-null AND `enabled` is true.

### `campaign_assessments` table

Add column:
```sql
ALTER TABLE campaign_assessments
  ADD COLUMN IF NOT EXISTS intro_override JSONB DEFAULT NULL;
```

Shape:
```typescript
type IntroOverride =
  | null                                    // Use assessment's default intro
  | { suppress: true }                      // Skip intro entirely
  | { heading: string; body: string; buttonLabel: string }  // Custom content
```

### Flow config migration

Update all existing experience templates:
- Remove `section_intro` from `flowConfig`
- Set `report` to order 103 (after complete at 102)

## Assessment Builder — Intro Tab

A new "Intro" tab in the assessment builder (`/assessments/[id]/edit`).

**Content:**
- Toggle: "Show intro page" (enabled by default when content exists)
- Heading input — pre-filled with assessment title
- Rich text body — Tiptap editor (same component used in experience template page editor and report builder custom text blocks)
- Button label input — default: "Begin Assessment"
- Template variables available: `{{assessmentTitle}}`, `{{questionCount}}`. The `{{estimatedMinutes}}` variable is reserved for future use — listed in the editor UI as "coming soon" but not resolved at runtime yet.

**Persistence:** Zone 3 (auto-save). Heading, body, and button label auto-save on blur + 3s debounce, consistent with other text fields in the builder. The toggle saves immediately (Zone 1).

## Flow Router Changes

### Remove `section_intro`

The `section_intro` page type is removed from the flow system:
- Removed from `flowConfig` type
- Removed from `getFullFlowOrder()` logic
- Removed from experience editor page list
- The `assessment_sections.instructions` field continues to exist for optional per-section text shown inline above the questions (not as a separate page)

### New route: `/assess/[token]/assessment-intro/[assessmentIndex]`

Server component that:
1. Validates access token
2. Determines the assessment by index in the campaign's ordered assessment list
3. Resolves intro content:
   - Check `campaign_assessments.intro_override`:
     - `null` → use `assessments.intro_content`
     - `{ suppress: true }` → redirect to first section of this assessment
     - `{ heading, body, buttonLabel }` → use override content
   - If resolved content is `null` (assessment has no intro) → redirect to first section
4. Renders the intro page with effective campaign brand
5. Button navigates to the first section of this assessment

### Navigation updates

**Flow router `getNextFlowUrl` change:**
When `getNextFlowUrl` would return the `__sections__` sentinel URL, it now returns `/assess/{token}/assessment-intro/0` instead of `/assess/{token}/section/0`. The assessment-intro route handles the redirect to sections if the intro is suppressed/null, so the flow router doesn't need database access — it always routes to assessment-intro first and lets that server component decide.

**Pre-assessment → assessment:**
When the last pre-assessment page (or custom page) completes:
- `getNextFlowUrl` returns `/assess/[token]/assessment-intro/0`
- The assessment-intro server component checks if intro exists/is enabled → shows intro page or redirects to `section/0`

**Between assessments:**
The section page passes a `postAssessmentUrl` prop (computed server-side) to `SectionWrapper` instead of the current `postSectionsUrl`. This URL is:
- `/assess/[token]/assessment-intro/[nextIndex]` if another assessment exists
- The first post-assessment page URL if this is the last assessment

The section page computes this by: looking at the campaign's ordered assessment list, finding the current assessment's position, and checking if there's a next one.

**Section index scope:**
Section indices are **per-assessment** (reset to 0 for each assessment). The section page already resolves the target assessment by scanning for the first incomplete one. The `sectionIndex` in the URL refers to the section within that assessment, not globally.

**`SectionWrapper` prop changes:**
- Remove `postSectionsUrl` prop
- Add `postAssessmentUrl` prop (same purpose, clearer name)
- Remove `sectionIntroContent` prop (section intro is removed)

### Flow config ordering

Pages use order numbers to position themselves relative to the `__sections__` sentinel (order 100):

| Page | Default Order | Position |
|------|--------------|----------|
| join | 1 | Pre-assessment |
| welcome | 2 | Pre-assessment |
| consent | 3 | Pre-assessment |
| demographics | 4 | Pre-assessment |
| `__sections__` | 100 | Assessment block |
| review | 101 | Post-assessment |
| complete | 102 | Post-assessment |
| report | 103 | Post-assessment |

Custom pages can use any order number. Pages with order < 100 appear before assessments, >= 100 after.

## Experience Editor Updates

### Flow visualisation

The page card layout reorganises into three visual zones with clear labels:

**Pre-Assessment zone:**
- Welcome, Consent, Demographics cards (toggleable)
- Custom page cards (order < 100)
- "Add Page" button for pre-assessment custom pages

**Assessment zone:**
- A non-editable placeholder card: "Assessments — Each assessment shows its own intro then questions"
- Subtitle: "Configure assessment intros in the Assessment Builder"
- Optionally clickable to navigate to the assessments list

**Post-Assessment zone:**
- Review, Complete, Report cards (toggleable)
- Custom page cards (order >= 100)
- "Add Page" button for post-assessment custom pages

The section intro card is removed.

### Custom page placement

"Add Page" buttons appear in both pre- and post-assessment zones. When adding a custom page, the user chooses a position (order number is set automatically based on where the button is). Custom pages can also be reordered via drag or order editing.

### Campaign-level assessment intro overrides

When editing experience for a specific campaign (campaign-scoped context), an additional section appears within the assessment zone:

For each linked assessment:
- Assessment name
- Current intro status: "Using assessment default" / "Custom override" / "Skipped"
- Expand to see/edit:
  - Radio group: Use default / Custom / Skip
  - If "Custom": same Tiptap content editor (heading, body, button label)

This section only appears in campaign-scoped editing, not the platform-level template editor.

### Branding preview

**Platform-level editor** (`/settings/experience`):
- Add a "Preview as" client dropdown in the preview panel header
- Lists all active clients
- Default: platform brand
- Selecting a client calls `getEffectiveBrand(clientId)` and passes the result to the preview components
- The preview system already handles brand config correctly — only the config source changes

**Campaign-scoped editor:**
- Automatically uses the campaign's client brand — fetched via `getEffectiveBrand(clientId, campaignId)`
- No selector needed

**No changes to the preview rendering system itself** — it already generates CSS tokens from brand config and applies them to preview containers. The fix is entirely about which brand config is passed in.

## Runtime Details

### Assessment intro page rendering

The `/assess/[token]/assessment-intro/[assessmentIndex]` route:
- Uses the same brand CSS token system as all other flow pages
- Renders heading, body (rich text HTML), and button
- Supports the same template variable interpolation as other pages
- Button navigates to the first section of this assessment

### Item options fallback

The existing fallback in `getSessionState()` that derives likert options from `responseFormatConfig.anchors` when `item_options` is empty is documented as intentional behaviour. This handles AI-generated items that have stems but no per-item options.

## Migration Plan

### Database migration

```sql
-- Add assessment intro content
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS intro_content JSONB DEFAULT NULL;

-- Add campaign-level intro override
ALTER TABLE campaign_assessments
  ADD COLUMN IF NOT EXISTS intro_override JSONB DEFAULT NULL;

-- Clean up flow configs: remove section_intro from all templates
UPDATE experience_templates
SET flow_config = flow_config - 'section_intro'
WHERE flow_config ? 'section_intro';

-- Ensure report is post-assessment on all templates (order 103)
UPDATE experience_templates
SET flow_config = flow_config || '{"report": {"enabled": false, "order": 103, "reportMode": "holding"}}'::jsonb
WHERE flow_config ? 'report'
  AND (flow_config->'report'->>'order')::int < 100;
```

### Code changes summary

| Area | Change |
|------|--------|
| Assessment builder | Add "Intro" tab with Tiptap editor |
| Flow router (`flow-router.ts`) | `getNextFlowUrl` returns assessment-intro URL instead of section/0 when hitting sentinel |
| Section page | Pass `postAssessmentUrl` (not `postSectionsUrl`) to SectionWrapper |
| `SectionWrapper` | Replace `postSectionsUrl` prop with `postAssessmentUrl`, remove `sectionIntroContent` prop and `SectionIntroScreen` render |
| Experience editor (`flow-editor.tsx`) | Three-zone layout, remove section_intro card, add assessment placeholder |
| Experience editor (`flow-sidebar.tsx`) | Remove hardcoded `section_intro` entry |
| Experience defaults (`defaults.ts`) | Remove `section_intro` from `DEFAULT_PAGE_CONTENT` |
| Experience editor | Campaign-scoped assessment intro overrides (new prop: linked assessments + overrides) |
| Platform experience page (`settings/experience/page.tsx`) | Add client selector, pass effective brand |
| Campaign experience page (`campaigns/[id]/experience/page.tsx`) | Fetch campaign row for clientId, use `getEffectiveBrand(clientId, campaignId)`, pass linked assessments |
| New route | `/assess/[token]/assessment-intro/[assessmentIndex]` |
| Types | Update `FlowConfig`, `Assessment`, `CampaignAssessment` interfaces, `TemplateVariables` |

## Out of Scope

- Per-item `item_options` population for AI-generated items (separate task)
- Assessment time estimate calculation for `{{estimatedMinutes}}` template variable (future enhancement — can use a simple items * seconds-per-item formula when implemented)
- Multi-language support for intro content
- Drag-and-drop reordering of custom pages in the experience editor (use order number editing for now)
- Changes to the consent or demographics page editors
