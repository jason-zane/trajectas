# Campaign Factor Selection

## Overview

Allow partners (and in future, clients) to customise which factors within a pre-built assessment are included when running a campaign. Platform admin builds complete assessments. Partners choose which factors they want to measure, and the system dynamically adjusts items, scoring, and reporting to match.

### Scope

**In scope:**
- Data model for per-campaign factor selection
- Assessment runner filtering by selected factors with dynamic item scaling
- Factor picker UI in partner and admin campaign detail pages
- Platform admin toggle to enable/disable customisation per assessment with minimum factor threshold
- Live summary (factor count, construct count, estimated items, estimated duration)

**Out of scope:**
- Client portal factor selection (future — uses same infrastructure)
- Construct-level selection (selection is at factor level only)
- Custom item ordering or cherry-picking individual items
- Changes to the scoring formula (existing rollup handles missing factors automatically)

---

## 1. Data Model

### 1.1 New table: `campaign_assessment_factors`

Stores the explicit factor selection when a partner customises. Absence of rows means "use all factors" (full assessment).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `campaign_assessment_id` | UUID | FK → `campaign_assessments(id)` ON DELETE CASCADE, NOT NULL |
| `factor_id` | UUID | FK → `factors(id)` ON DELETE CASCADE, NOT NULL |
| `created_at` | TIMESTAMPTZ | Default `now()` |

- Unique constraint on `(campaign_assessment_id, factor_id)`
- Index on `campaign_assessment_id`

### 1.2 New column on `assessments`

- `min_custom_factors` INT DEFAULT NULL

Semantics:
- `NULL` — assessment does not support factor customisation (picker is hidden)
- `1` — any selection of 1 or more factors is valid
- `N` — at least N factors must be selected

Set by the platform admin in the assessment builder. Validation: must be ≥ 1 and ≤ total factor count of the assessment.

### 1.3 Interpretation rules

| `min_custom_factors` | `campaign_assessment_factors` rows | Behaviour |
|----------------------|-------------------------------------|-----------|
| NULL | (ignored) | Full assessment, no customisation available |
| N (any value) | 0 rows | Full assessment (default) |
| N | 1+ rows | Custom selection — only selected factors' items are included |

### 1.4 Scoring impact

None. The existing scoring chain (items → constructs → factors → dimensions) only scores what was answered. Excluded factors produce no items, so no scores are generated. Reports already handle missing factor scores. No formula changes needed.

---

## 2. Assessment Runner Changes

### 2.1 Current flow

1. Load `campaign_assessments` for the campaign
2. Load `assessment_sections` with `assessment_section_items` (nested items)
3. Present all items to participant
4. Score all responses

### 2.2 New flow

1. Load `campaign_assessments` for the campaign
2. **Check for custom factor selection:** query `campaign_assessment_factors` for this `campaign_assessment_id`
3. If no rows → proceed as current (full assessment)
4. If rows exist → build a set of selected factor IDs
5. Load `assessment_sections` with `assessment_section_items`. **The runner query must be extended** to include `items.construct_id` and `items.purpose` in the select — these fields are needed for filtering but are not currently fetched.
6. **Resolve `campaign_assessment_id`:** query `campaign_assessments WHERE campaign_id = ? AND assessment_id = ?` to get the ID needed for the factor selection lookup. (`participant_sessions` stores `campaign_id` and `assessment_id` but not `campaign_assessment_id` directly.)
7. **Filter items:** for each item, resolve `item.construct_id → factor_constructs → factor_id`. Exclude items whose factor is not in the selected set.
8. **Scale items per construct:** count remaining constructs after filtering, apply `item_selection_rules` to determine `items_per_construct`. For each construct, take the top N items by `selection_priority` (then `display_order`).
9. **Skip empty sections:** sections with zero remaining items are not presented
10. Adjust progress indicators and section counts
11. Score only responded items (no changes to scoring logic)

### 2.3 Item filtering chain

```
item.construct_id
  → factor_constructs WHERE construct_id = item.construct_id
  → factor_id
  → is factor_id IN selected_factor_ids?
```

Items with `purpose != 'construct'` (attention checks, infrequency, impression management) are always included regardless of factor selection — they serve assessment validity, not factor measurement.

### 2.4 Item count scaling

The existing `item_selection_rules` table defines items-per-construct based on total construct count:

| Constructs | Items per construct |
|------------|-------------------|
| 1-2 | 15 |
| 3-5 | 10 |
| 6+ | 6 |

After filtering to selected factors, recount constructs and apply the rules. Fewer factors → fewer constructs → more items per construct → deeper measurement per factor.

### 2.5 Backwards compatibility

Campaigns without custom factor selections behave identically to today. No migration of existing campaign data needed.

---

## 3. Factor Picker UI (Partner Campaign Detail)

### 3.1 Location

Campaign detail → Assessments tab. Each attached assessment card shows its current mode.

### 3.2 Mode toggle

If the assessment has `min_custom_factors` set (not NULL):
- Card displays a toggle: **"Full Assessment"** (default) / **"Custom Selection"**
- "Full Assessment" mode shows the assessment as-is with factor count summary
- "Custom Selection" mode expands the factor picker

If `min_custom_factors` is NULL:
- No toggle shown. Assessment is always run in full.

### 3.3 Factor picker (Custom Selection mode)

**Layout:** Expanding panel inline below the assessment card. Keeps context visible (partner can see the assessment info while picking factors). Not a modal — the content is too long for a modal and benefits from the full page width.

**Structure:**
- Factors grouped by dimension (collapsible sections)
- Dimension header: dimension name, icon, "X of Y factors selected" counter
- Each factor row: checkbox, factor name, description (truncated with expand), construct count badge

**Example:**
```
▼ Leadership Focus                    3 of 5 selected
  ☑ Strategic Thinking                3 constructs
    Ability to envision long-term goals and...
  ☑ Decision Making                   4 constructs
    Capacity to evaluate options and make...
  ☐ Delegation                        2 constructs
    Willingness to distribute responsib...
  ☑ Influence                         3 constructs
    Ability to persuade and motivate ot...
  ☐ Accountability                    2 constructs

▼ Interpersonal Skills                1 of 4 selected
  ...
```

### 3.4 Live summary bar

Sticky bar (top or bottom of picker) showing real-time calculations:

```
6 factors · 18 constructs · ~108 items · Est. 15 min
Minimum required: 4 factors
```

- **Factors:** count of checked factors
- **Constructs:** sum of constructs across selected factors (from `factor_constructs`)
- **Items:** estimated using `item_selection_rules` (constructs → items_per_construct × construct_count)
- **Duration:** items × ~8 seconds, formatted as minutes
- **Minimum warning:** if below `min_custom_factors`, show amber warning, disable save

### 3.5 Save behaviour

- Zone 2 (explicit save) — "Save Selection" button
- Save replaces all `campaign_assessment_factors` rows for this campaign-assessment (delete + insert)
- Toast confirmation on save
- Switching back to "Full Assessment" deletes all rows, toast confirms

### 3.6 Validation

- Cannot save with fewer factors than `min_custom_factors`
- Cannot save with zero factors
- Save button disabled when validation fails, with explanatory text

---

## 4. Platform Admin: Assessment Builder

### 4.1 New setting

In the assessment edit page (settings section or a dedicated card):

- **"Allow factor customisation"** — toggle, off by default
- When on, reveals: **"Minimum factors required"** — number input
  - Default: floor(total_factors / 2) or 1, whichever is greater
  - Min: 1
  - Max: total factor count of the assessment
  - Updates if factors are added/removed from the assessment

### 4.2 Where it appears

On the assessment edit/settings page. A small card within existing settings — not a separate tab.

### 4.3 Persistence

Updates `assessments.min_custom_factors`:
- Toggle off → set to NULL
- Toggle on → set to the number input value

Zone 2 save (part of the assessment settings save action).

---

## 5. Partner Portal Integration

### 5.1 Campaign assessments tab

The partner's campaign assessment tab already lists attached assessments. The factor picker toggle and panel appear here using the same components as the admin portal.

### 5.2 Assessment picker filtering

When a partner adds an assessment to a campaign, only assessments assigned to their client (via `client_assessment_assignments`) appear. The `min_custom_factors` value determines whether the customisation toggle is shown after attachment.

### 5.3 Quota interaction

Factor customisation does not affect quota counting. A participant is a participant regardless of how many factors are selected — quotas count participants, not factors.

---

## 6. Reporting

### 6.1 Factor-aware reports

Reports already render scores per factor. When factors are excluded:
- Excluded factors have no scores → they don't appear in the report
- Report layout adjusts automatically (fewer rows/bars in charts)
- No special handling needed — the report renderer already skips factors with null scores

### 6.2 Report context

The report should indicate which factors were assessed. Add an italicised line in the report metadata/header area: *"This assessment measured X of Y available factors."* Deferred from this spec — can be added as a follow-up when the report template system is extended. Not blocking for MVP.

---

## 7. RLS and Security

### 7.1 RLS on `campaign_assessment_factors`

Same pattern as `campaign_assessments`:
- Platform admin: full access
- Partner/client: SELECT if the campaign belongs to their tenant
- Writes via admin client (server actions control mutation logic)

### 7.2 Partner restrictions

Partners can only customise factors on campaigns belonging to their clients. The existing `requireCampaignAccess` check covers this.

---

## 8. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Partner selects factors, then admin removes a factor from the assessment | The `campaign_assessment_factors` row references a factor no longer in the assessment. Runner filters it out naturally (no matching items). Stale row is harmless. |
| Partner switches from custom back to full | All `campaign_assessment_factors` rows deleted. Full assessment runs. |
| Campaign already has participants when factors are changed | Existing completed sessions keep their scores. New participants get the updated factor selection. On save, show a confirmation dialog: "X participants have already completed this assessment. Changing the factor selection will only affect future participants. Continue?" |
| Assessment with 0 factors | `min_custom_factors` validation prevents enabling customisation when no factors are linked. |
| All constructs under a factor have 0 items | Factor appears in picker but with "0 items available" warning. Selecting it has no effect on the assessment. |

---

## 9. Migration

Single migration:
1. Create `campaign_assessment_factors` table with indexes, unique constraint, RLS
2. `ALTER TABLE assessments ADD COLUMN min_custom_factors INT DEFAULT NULL`

No data migration needed — existing campaigns have no custom selections (NULL = full assessment).
