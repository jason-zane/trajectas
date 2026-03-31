# Report Generation System — Part 1: Foundation + Runner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete data layer, server actions, block type system, and report runner pipeline for the report generation system — no UI, fully testable via server actions and the API route.

**Architecture:** Config-driven block engine. Templates stored as JSONB in `report_templates`. A runner pipeline reads a `report_snapshot` row, fetches scores + taxonomy, resolves bands + narrative, and writes `rendered_data` back. Snapshot rows are created by a Postgres trigger when `participant_sessions.status` transitions to `completed`.

**Tech Stack:** Next.js 15 App Router, Supabase/PostgreSQL, TypeScript, OpenRouter (for AI narrative enhancement). Migration runs via `npm run db:push`.

**Dependency:** This plan must be fully complete before starting Part 2 (UI). Run `npx tsc --noEmit` at the end to verify zero errors.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/00041_report_generation_system.sql` | Create | All DB changes: enums, columns, tables, trigger, RLS, seeds |
| `src/types/database.ts` | Modify | New enum types, updated Dimension/Factor/Construct, new table interfaces |
| `src/lib/supabase/mappers.ts` | Modify | Update 3 existing mappers + add 3 new mappers |
| `src/app/actions/reports.ts` | Create | CRUD for templates, campaign config, snapshot management |
| `src/lib/reports/types.ts` | Create | BlockType, BlockConfig, BlockCondition, all per-block config interfaces |
| `src/lib/reports/registry.ts` | Create | Block metadata registry (labels, categories, default configs) |
| `src/lib/reports/band-resolution.ts` | Create | Band resolution: norm-derived → entity override → global default |
| `src/lib/reports/narrative.ts` | Create | Derived narrative assembly from indicators + definitions |
| `src/lib/reports/ai-narrative.ts` | Create | AI enhancement via OpenRouter `report_narrative` prompt |
| `src/lib/reports/runner.ts` | Create | processSnapshot() — the 6-step pipeline |
| `src/app/api/reports/generate/route.ts` | Create | POST route — polls pending snapshots, calls processSnapshot() |

---

## Task 1: Migration 00041

**Files:**
- Create: `supabase/migrations/00041_report_generation_system.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================================
-- Migration 00041: Report generation system
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New enum types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('self_report', '360');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_display_level AS ENUM ('dimension', 'factor', 'construct');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE person_reference_type AS ENUM ('you', 'first_name', 'participant', 'the_participant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_snapshot_status AS ENUM ('pending', 'generating', 'ready', 'released', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_audience_type AS ENUM ('participant', 'hr_manager', 'consultant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE narrative_mode_type AS ENUM ('derived', 'ai_enhanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Extend ai_prompt_purpose enum
-- ---------------------------------------------------------------------------

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'report_narrative';

-- ---------------------------------------------------------------------------
-- 3. Add band + development fields to taxonomy tables
-- ---------------------------------------------------------------------------

ALTER TABLE dimensions
  ADD COLUMN IF NOT EXISTS band_label_low         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_mid         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_high        TEXT,
  ADD COLUMN IF NOT EXISTS pomp_threshold_low     INTEGER,
  ADD COLUMN IF NOT EXISTS pomp_threshold_high    INTEGER,
  ADD COLUMN IF NOT EXISTS development_suggestion TEXT;

ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS band_label_low         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_mid         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_high        TEXT,
  ADD COLUMN IF NOT EXISTS pomp_threshold_low     INTEGER,
  ADD COLUMN IF NOT EXISTS pomp_threshold_high    INTEGER,
  ADD COLUMN IF NOT EXISTS development_suggestion TEXT;

ALTER TABLE constructs
  ADD COLUMN IF NOT EXISTS band_label_low         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_mid         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_high        TEXT,
  ADD COLUMN IF NOT EXISTS pomp_threshold_low     INTEGER,
  ADD COLUMN IF NOT EXISTS pomp_threshold_high    INTEGER,
  ADD COLUMN IF NOT EXISTS development_suggestion TEXT;

-- ---------------------------------------------------------------------------
-- 4. report_templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_templates (
  id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       UUID                 REFERENCES partners(id) ON DELETE CASCADE,
  name             TEXT                 NOT NULL,
  description      TEXT,
  report_type      report_type          NOT NULL DEFAULT 'self_report',
  display_level    report_display_level NOT NULL DEFAULT 'factor',
  group_by_dimension BOOLEAN            NOT NULL DEFAULT false,
  person_reference person_reference_type NOT NULL DEFAULT 'the_participant',
  auto_release     BOOLEAN              NOT NULL DEFAULT false,
  blocks           JSONB                NOT NULL DEFAULT '[]'::jsonb,
  is_active        BOOLEAN              NOT NULL DEFAULT true,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ          NOT NULL DEFAULT now(),

  CONSTRAINT report_templates_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS report_templates_partner_id_idx
  ON report_templates (partner_id);
CREATE INDEX IF NOT EXISTS report_templates_report_type_idx
  ON report_templates (report_type);
CREATE INDEX IF NOT EXISTS report_templates_active_idx
  ON report_templates (is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER set_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE report_templates IS
  'Reusable report layouts for a single audience. Blocks stored as ordered JSONB array.';

-- ---------------------------------------------------------------------------
-- 5. campaign_report_config
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaign_report_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_template_id  UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  hr_manager_template_id   UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  consultant_template_id   UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_campaign_report_config_updated_at
  BEFORE UPDATE ON campaign_report_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE campaign_report_config IS
  'Maps audience types to report templates for a campaign. One row per campaign.';

-- ---------------------------------------------------------------------------
-- 6. report_snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_snapshots (
  id                     UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id            UUID                   NOT NULL REFERENCES report_templates(id),
  participant_session_id UUID                   NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  campaign_id            UUID                   NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  audience_type          report_audience_type   NOT NULL,
  status                 report_snapshot_status NOT NULL DEFAULT 'pending',
  narrative_mode         narrative_mode_type    NOT NULL DEFAULT 'derived',
  rendered_data          JSONB,
  pdf_url                TEXT,
  released_at            TIMESTAMPTZ,
  released_by            UUID                   REFERENCES profiles(id),
  generated_at           TIMESTAMPTZ,
  error_message          TEXT,
  created_at             TIMESTAMPTZ            NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ            NOT NULL DEFAULT now(),

  CONSTRAINT report_snapshots_session_audience_unique
    UNIQUE (participant_session_id, audience_type)
);

CREATE INDEX IF NOT EXISTS report_snapshots_session_id_idx
  ON report_snapshots (participant_session_id);
CREATE INDEX IF NOT EXISTS report_snapshots_campaign_id_idx
  ON report_snapshots (campaign_id);
CREATE INDEX IF NOT EXISTS report_snapshots_status_idx
  ON report_snapshots (status);
CREATE INDEX IF NOT EXISTS report_snapshots_pending_idx
  ON report_snapshots (status, created_at) WHERE status = 'pending';

CREATE TRIGGER set_report_snapshots_updated_at
  BEFORE UPDATE ON report_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE report_snapshots IS
  'Point-in-time report renders. One row per session × audience. Frozen at generation.';

-- ---------------------------------------------------------------------------
-- 7. Snapshot creation trigger on participant_sessions completion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_report_snapshots_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
BEGIN
  -- Only fire on status transition to 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Skip sessions not linked to a campaign
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the report config for this campaign
  SELECT * INTO v_config
  FROM campaign_report_config
  WHERE campaign_id = NEW.campaign_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Create one snapshot per non-null template
  IF v_config.participant_template_id IS NOT NULL THEN
    INSERT INTO report_snapshots
      (template_id, participant_session_id, campaign_id, audience_type, status)
    VALUES
      (v_config.participant_template_id, NEW.id, NEW.campaign_id, 'participant', 'pending')
    ON CONFLICT (participant_session_id, audience_type) DO NOTHING;
  END IF;

  IF v_config.hr_manager_template_id IS NOT NULL THEN
    INSERT INTO report_snapshots
      (template_id, participant_session_id, campaign_id, audience_type, status)
    VALUES
      (v_config.hr_manager_template_id, NEW.id, NEW.campaign_id, 'hr_manager', 'pending')
    ON CONFLICT (participant_session_id, audience_type) DO NOTHING;
  END IF;

  IF v_config.consultant_template_id IS NOT NULL THEN
    INSERT INTO report_snapshots
      (template_id, participant_session_id, campaign_id, audience_type, status)
    VALUES
      (v_config.consultant_template_id, NEW.id, NEW.campaign_id, 'consultant', 'pending')
    ON CONFLICT (participant_session_id, audience_type) DO NOTHING;
  END IF;

  -- Notify runner (payload = session id so runner can find its pending snapshots)
  PERFORM pg_notify('report_generation_queue', NEW.id::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_session_completed_create_snapshots ON participant_sessions;
CREATE TRIGGER on_session_completed_create_snapshots
  AFTER UPDATE OF status ON participant_sessions
  FOR EACH ROW EXECUTE FUNCTION create_report_snapshots_on_completion();

-- ---------------------------------------------------------------------------
-- 8. RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE report_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_report_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots       ENABLE ROW LEVEL SECURITY;

-- report_templates: platform-global templates readable by all authenticated;
--   partner-scoped readable by partner members; writable by partner admins only.

CREATE POLICY "report_templates_select" ON report_templates
  FOR SELECT TO authenticated
  USING (
    partner_id IS NULL
    OR partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      JOIN profiles p ON p.id = pm.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "report_templates_insert" ON report_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      JOIN profiles p ON p.id = pm.profile_id
      WHERE p.auth_user_id = auth.uid() AND pm.role = 'admin'
    )
  );

CREATE POLICY "report_templates_update" ON report_templates
  FOR UPDATE TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      JOIN profiles p ON p.id = pm.profile_id
      WHERE p.auth_user_id = auth.uid() AND pm.role = 'admin'
    )
  );

-- campaign_report_config: any partner member for campaigns they own
CREATE POLICY "campaign_report_config_select" ON campaign_report_config
  FOR SELECT TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN partner_memberships pm ON pm.partner_id = c.partner_id
      JOIN profiles p ON p.id = pm.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "campaign_report_config_all" ON campaign_report_config
  FOR ALL TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN partner_memberships pm ON pm.partner_id = c.partner_id
      JOIN profiles p ON p.id = pm.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- report_snapshots: audience-specific read; service role handles writes
CREATE POLICY "report_snapshots_consultant_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'consultant'
    AND status IN ('ready', 'released')
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN partner_memberships pm ON pm.partner_id = c.partner_id
      JOIN profiles p ON p.id = pm.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "report_snapshots_participant_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'participant'
    AND released_at IS NOT NULL
    AND participant_session_id IN (
      SELECT ps.id FROM participant_sessions ps
      JOIN profiles p ON p.id = ps.participant_profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "report_snapshots_hr_manager_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'hr_manager'
    AND released_at IS NOT NULL
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN client_memberships cm ON cm.organization_id = c.organization_id
      JOIN profiles p ON p.id = cm.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Seed report_narrative AI prompt
-- ---------------------------------------------------------------------------

INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Report Narrative Enhancement v1',
  'report_narrative'::ai_prompt_purpose,
  $$You are an expert occupational psychologist writing personalised psychometric feedback. Your task is to enhance a derived narrative paragraph so it reads as thoughtful, individualised professional feedback.

## Guidelines
- Maintain the core meaning from the derived text — do not introduce information not supported by the scores or indicators
- Write in a professional but accessible tone — not clinical, not overly effusive
- Use the person reference token {{person}} to refer to the participant
- Target 3–5 sentences per block narrative
- Do not start with "{{person}}" — vary your sentence openers
- Avoid clichés ("leverages strengths", "excels at", "is a natural")
- Reference the specific construct or factor name naturally

## Output
Return ONLY the enhanced narrative paragraph. No preamble, no JSON, no explanation.$$,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts WHERE purpose = 'report_narrative' AND version = 1
);

-- ---------------------------------------------------------------------------
-- 10. Seed 4 platform-global templates
-- ---------------------------------------------------------------------------

INSERT INTO report_templates
  (id, partner_id, name, description, report_type, display_level,
   group_by_dimension, person_reference, auto_release, blocks, is_active)
VALUES
  (
    'a1b2c3d4-0001-0000-0000-000000000001',
    NULL,
    'Standard Individual',
    'Participant-facing self-report summary with narrative, strengths, and development plan.',
    'self_report', 'factor', true, 'you', false,
    '[
      {"id":"blk-si-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-si-02","type":"custom_text","order":2,"config":{"heading":"About This Report","content":"This report summarises your assessment results. Use it as a guide for reflection and professional development."}},
      {"id":"blk-si-03","type":"score_overview","order":3,"config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
      {"id":"blk-si-04","type":"score_detail","order":4,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-si-05","type":"score_detail","order":5,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-si-06","type":"score_detail","order":6,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-si-07","type":"strengths_highlights","order":7,"config":{"topN":3,"displayLevel":"factor","style":"cards"}},
      {"id":"blk-si-08","type":"development_plan","order":8,"config":{"maxItems":3,"prioritiseByScore":true}}
    ]'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0001-0000-0000-000000000002',
    NULL,
    'Hiring Manager Brief',
    'Concise hr_manager-facing summary: scores and band labels only.',
    'self_report', 'factor', false, 'the_participant', false,
    '[
      {"id":"blk-hm-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-hm-02","type":"score_overview","order":2,"config":{"chartType":"bars","displayLevel":"factor","groupByDimension":false,"showDimensionScore":false}},
      {"id":"blk-hm-03","type":"score_detail","order":3,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":false,"showIndicators":false,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-hm-04","type":"score_detail","order":4,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":false,"showIndicators":false,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-hm-05","type":"custom_text","order":5,"config":{"heading":"Confidentiality Notice","content":"This report is provided for assessment purposes only. Results should be interpreted by a qualified practitioner."}}
    ]'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0001-0000-0000-000000000003',
    NULL,
    '360 Debrief — Participant',
    'Participant-facing 360 report with rater comparison, gap analysis, and development plan.',
    '360', 'factor', true, 'you', false,
    '[
      {"id":"blk-3p-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-3p-02","type":"custom_text","order":2,"config":{"heading":"Confidentiality","content":"Ratings have been aggregated to protect rater anonymity. No individual rater can be identified."}},
      {"id":"blk-3p-03","type":"score_overview","order":3,"config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
      {"id":"blk-3p-04","type":"rater_comparison","order":4,"config":{"raterGroups":["self","manager","peers","direct_reports"]}},
      {"id":"blk-3p-05","type":"gap_analysis","order":5,"config":{"gapThreshold":20,"showBlindSpots":true,"showHiddenStrengths":true}},
      {"id":"blk-3p-06","type":"score_detail","order":6,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":false}},
      {"id":"blk-3p-07","type":"score_detail","order":7,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":false}},
      {"id":"blk-3p-08","type":"development_plan","order":8,"config":{"maxItems":3,"prioritiseByScore":true}}
    ]'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0001-0000-0000-000000000004',
    NULL,
    '360 Debrief — Consultant',
    'Full consultant 360 report with construct-level breakdown and open comments.',
    '360', 'construct', true, 'the_participant', false,
    '[
      {"id":"blk-3c-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-3c-02","type":"score_overview","order":2,"config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
      {"id":"blk-3c-03","type":"rater_comparison","order":3,"config":{"raterGroups":["self","manager","peers","direct_reports"]}},
      {"id":"blk-3c-04","type":"gap_analysis","order":4,"config":{"gapThreshold":20,"showBlindSpots":true,"showHiddenStrengths":true}},
      {"id":"blk-3c-05","type":"score_detail","order":5,"config":{"displayLevel":"construct","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":true}},
      {"id":"blk-3c-06","type":"score_detail","order":6,"config":{"displayLevel":"construct","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":true}},
      {"id":"blk-3c-07","type":"open_comments","order":7,"config":{"minRatersForDisplay":3,"groupByFactor":true}},
      {"id":"blk-3c-08","type":"development_plan","order":8,"config":{"maxItems":5,"prioritiseByScore":true}}
    ]'::jsonb,
    true
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Apply the migration**

```bash
npm run db:push
```

Expected: Migration applies without error. All 4 new enum types, 6 taxonomy columns, 3 tables, trigger, RLS policies, and 4 seeded templates are present.

- [ ] **Step 3: Verify in DB console**

```bash
npm run db:status
```

Expected: Migration 00041 shows as applied.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00041_report_generation_system.sql
git commit -m "feat: add report generation system DB — tables, enums, trigger, RLS, seeds"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add new enum types after the existing `AIPromptPurpose` block**

Find the `AIPromptPurpose` type and add `'report_narrative'` to the union, then add the new enums below it:

```typescript
/** The intended purpose of a stored AI system prompt. */
export type AIPromptPurpose =
  | 'competency_matching'
  | 'ranking_explanation'
  | 'diagnostic_analysis'
  | 'item_generation'
  | 'factor_item_generation'
  | 'preflight_analysis'
  | 'embedding'
  | 'chat'
  | 'report_narrative'   // ← add this line

/** Report assessment type. */
export type ReportType = 'self_report' | '360'

/** Score resolution depth for a report block. */
export type ReportDisplayLevel = 'dimension' | 'factor' | 'construct'

/** How the report refers to the participant in narrative text. */
export type PersonReferenceType = 'you' | 'first_name' | 'participant' | 'the_participant'

/** Lifecycle status of a report snapshot. */
export type ReportSnapshotStatus = 'pending' | 'generating' | 'ready' | 'released' | 'failed'

/** The intended audience for a report snapshot. */
export type ReportAudienceType = 'participant' | 'hr_manager' | 'consultant'

/** How report narrative text was produced. */
export type NarrativeModeType = 'derived' | 'ai_enhanced'
```

- [ ] **Step 2: Add 6 new fields to the `Dimension` interface**

Immediately before `created_at` in the `Dimension` interface:

```typescript
  /** Label for the low performance band. Null = global default ("Developing"). */
  bandLabelLow?: string
  /** Label for the mid performance band. Null = global default ("Effective"). */
  bandLabelMid?: string
  /** Label for the high performance band. Null = global default ("Highly Effective"). */
  bandLabelHigh?: string
  /** POMP upper boundary for low band. Null = global default (40). */
  pompThresholdLow?: number
  /** POMP lower boundary for high band. Null = global default (70). */
  pompThresholdHigh?: number
  /** Development suggestion text for reports. AI-generated when blank. */
  developmentSuggestion?: string
```

Apply the same 6 fields to the `Factor` interface and the `Construct` interface.

- [ ] **Step 3: Add the three new table interfaces at the end of the file**

```typescript
// ---------------------------------------------------------------------------
// Report generation tables
// ---------------------------------------------------------------------------

/**
 * Reusable report layout for a single audience.
 * Blocks are an ordered JSONB array of BlockConfig objects.
 */
export interface ReportTemplate {
  id: string
  partnerId?: string
  name: string
  description?: string
  reportType: ReportType
  displayLevel: ReportDisplayLevel
  groupByDimension: boolean
  personReference: PersonReferenceType
  autoRelease: boolean
  blocks: Record<string, unknown>[]  // BlockConfig[] — typed in src/lib/reports/types.ts
  isActive: boolean
  deletedAt?: string
  created_at: string
  updated_at?: string
}

/**
 * Maps audience types to report templates for a campaign.
 * One row per campaign.
 */
export interface CampaignReportConfig {
  id: string
  campaignId: string
  participantTemplateId?: string
  hrManagerTemplateId?: string
  consultantTemplateId?: string
  created_at: string
  updated_at?: string
}

/**
 * A point-in-time rendered report for one participant session + audience.
 */
export interface ReportSnapshot {
  id: string
  templateId: string
  participantSessionId: string
  campaignId: string
  audienceType: ReportAudienceType
  status: ReportSnapshotStatus
  narrativeMode: NarrativeModeType
  renderedData?: Record<string, unknown>  // ResolvedBlockData[] — typed in runner
  pdfUrl?: string
  releasedAt?: string
  releasedBy?: string
  generatedAt?: string
  errorMessage?: string
  created_at: string
  updated_at?: string
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add report generation types — enums, updated taxonomy fields, new table interfaces"
```

---

## Task 3: Mappers

**Files:**
- Modify: `src/lib/supabase/mappers.ts`

- [ ] **Step 1: Update `mapDimensionRow` to include the 6 new fields**

Add after `indicatorsHigh`:

```typescript
    bandLabelLow: row.band_label_low ?? undefined,
    bandLabelMid: row.band_label_mid ?? undefined,
    bandLabelHigh: row.band_label_high ?? undefined,
    pompThresholdLow: row.pomp_threshold_low ?? undefined,
    pompThresholdHigh: row.pomp_threshold_high ?? undefined,
    developmentSuggestion: row.development_suggestion ?? undefined,
```

Apply the same 6 lines to `mapFactorRow` and `mapConstructRow`.

- [ ] **Step 2: Add imports for new types**

At the top of `mappers.ts`, extend the import from `@/types/database`:

```typescript
import type {
  // ... existing imports ...
  ReportTemplate,
  CampaignReportConfig,
  ReportSnapshot,
} from '@/types/database'
```

- [ ] **Step 3: Add three new mapper functions at the end of the file**

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReportTemplateRow(row: any): ReportTemplate {
  return {
    id: row.id,
    partnerId: row.partner_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    reportType: row.report_type,
    displayLevel: row.display_level,
    groupByDimension: row.group_by_dimension,
    personReference: row.person_reference,
    autoRelease: row.auto_release,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignReportConfigRow(row: any): CampaignReportConfig {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    participantTemplateId: row.participant_template_id ?? undefined,
    hrManagerTemplateId: row.hr_manager_template_id ?? undefined,
    consultantTemplateId: row.consultant_template_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReportSnapshotRow(row: any): ReportSnapshot {
  return {
    id: row.id,
    templateId: row.template_id,
    participantSessionId: row.participant_session_id,
    campaignId: row.campaign_id,
    audienceType: row.audience_type,
    status: row.status,
    narrativeMode: row.narrative_mode,
    renderedData: row.rendered_data ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    releasedAt: row.released_at ?? undefined,
    releasedBy: row.released_by ?? undefined,
    generatedAt: row.generated_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/mappers.ts
git commit -m "feat: update mappers for report system — taxonomy band fields + 3 new table mappers"
```

---

## Task 4: Server Actions

**Files:**
- Create: `src/app/actions/reports.ts`

- [ ] **Step 1: Write the server actions file**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import {
  mapReportTemplateRow,
  mapCampaignReportConfigRow,
  mapReportSnapshotRow,
} from '@/lib/supabase/mappers'
import type {
  ReportTemplate,
  CampaignReportConfig,
  ReportSnapshot,
  ReportType,
  ReportDisplayLevel,
  PersonReferenceType,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

export async function getReportTemplates(): Promise<ReportTemplate[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapReportTemplateRow)
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapReportTemplateRow(data) : null
}

export interface CreateReportTemplateInput {
  name: string
  description?: string
  reportType: ReportType
  displayLevel: ReportDisplayLevel
  groupByDimension?: boolean
  personReference?: PersonReferenceType
  autoRelease?: boolean
  partnerId?: string
}

export async function createReportTemplate(
  input: CreateReportTemplateInput,
): Promise<ReportTemplate> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      report_type: input.reportType,
      display_level: input.displayLevel,
      group_by_dimension: input.groupByDimension ?? false,
      person_reference: input.personReference ?? 'the_participant',
      auto_release: input.autoRelease ?? false,
      partner_id: input.partnerId ?? null,
      blocks: [],
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/settings/reports')
  return mapReportTemplateRow(data)
}

export async function cloneReportTemplate(id: string): Promise<ReportTemplate> {
  await requireAdminScope()
  const db = await createAdminClient()
  const source = await getReportTemplate(id)
  if (!source) throw new Error('Template not found')
  const { data, error } = await db
    .from('report_templates')
    .insert({
      name: `${source.name} (copy)`,
      description: source.description ?? null,
      report_type: source.reportType,
      display_level: source.displayLevel,
      group_by_dimension: source.groupByDimension,
      person_reference: source.personReference,
      auto_release: false,  // never auto-release a clone by default
      partner_id: source.partnerId ?? null,
      blocks: source.blocks,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/settings/reports')
  return mapReportTemplateRow(data)
}

export async function updateReportTemplateBlocks(
  id: string,
  blocks: Record<string, unknown>[],
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ blocks })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/settings/reports/${id}/builder`)
}

export async function updateReportTemplateSettings(
  id: string,
  updates: Partial<CreateReportTemplateInput>,
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.description !== undefined) row.description = updates.description
  if (updates.displayLevel !== undefined) row.display_level = updates.displayLevel
  if (updates.groupByDimension !== undefined) row.group_by_dimension = updates.groupByDimension
  if (updates.personReference !== undefined) row.person_reference = updates.personReference
  if (updates.autoRelease !== undefined) row.auto_release = updates.autoRelease
  const { error } = await db.from('report_templates').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/reports')
  revalidatePath(`/settings/reports/${id}/builder`)
}

export async function deleteReportTemplate(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/reports')
}

// ---------------------------------------------------------------------------
// Campaign Report Config
// ---------------------------------------------------------------------------

export async function getCampaignReportConfig(
  campaignId: string,
): Promise<CampaignReportConfig | null> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('campaign_report_config')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCampaignReportConfigRow(data) : null
}

export interface UpsertCampaignReportConfigInput {
  participantTemplateId?: string | null
  hrManagerTemplateId?: string | null
  consultantTemplateId?: string | null
}

export async function upsertCampaignReportConfig(
  campaignId: string,
  input: UpsertCampaignReportConfigInput,
): Promise<CampaignReportConfig> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('campaign_report_config')
    .upsert(
      {
        campaign_id: campaignId,
        participant_template_id: input.participantTemplateId ?? null,
        hr_manager_template_id: input.hrManagerTemplateId ?? null,
        consultant_template_id: input.consultantTemplateId ?? null,
      },
      { onConflict: 'campaign_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/campaigns/${campaignId}`)
  return mapCampaignReportConfigRow(data)
}

// ---------------------------------------------------------------------------
// Report Snapshots
// ---------------------------------------------------------------------------

export async function getReportSnapshotsForCampaign(
  campaignId: string,
): Promise<ReportSnapshot[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapReportSnapshotRow)
}

export async function getReportSnapshot(id: string): Promise<ReportSnapshot | null> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapReportSnapshotRow(data) : null
}

export async function releaseSnapshot(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({
      released_at: new Date().toISOString(),
      status: 'released',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/reports')
}

export async function retrySnapshot(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({ status: 'pending', error_message: null })
    .eq('id', id)
    .eq('status', 'failed')
  if (error) throw new Error(error.message)
  // Kick the runner
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshotId: id }),
  })
}

/** Manually create and queue snapshots for a session (admin/testing use). */
export async function queueSnapshotsForSession(sessionId: string): Promise<void> {
  await requireAdminScope()
  // Trigger the runner — it will call processSnapshot for each pending row
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/reports.ts
git commit -m "feat: add report server actions — templates, campaign config, snapshot management"
```

---

## Task 5: Block Type Definitions

**Files:**
- Create: `src/lib/reports/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// =============================================================================
// src/lib/reports/types.ts — Block engine type system
// =============================================================================

// ---------------------------------------------------------------------------
// Block type registry key
// ---------------------------------------------------------------------------

export type BlockType =
  // Meta
  | 'cover_page'
  | 'custom_text'
  | 'section_divider'
  // Score (self-report + 360)
  | 'score_overview'
  | 'score_detail'
  | 'strengths_highlights'
  | 'development_plan'
  | 'norm_comparison'   // registered but deferred — runner skips if included
  // 360-only
  | 'rater_comparison'
  | 'gap_analysis'
  | 'open_comments'

export type BlockCategory = 'meta' | 'score' | 'highlight' | '360'

// ---------------------------------------------------------------------------
// Block condition
// ---------------------------------------------------------------------------

export type BlockCondition =
  | { type: 'hasNormData' }
  | { type: 'has360Data' }
  | { type: 'scoreAbove'; entityId: string; threshold: number }
  | { type: 'scoreBelow'; entityId: string; threshold: number }

// ---------------------------------------------------------------------------
// Per-block config interfaces
// ---------------------------------------------------------------------------

export interface CoverPageConfig {
  showDate?: boolean
  showLogo?: boolean
  subtitle?: string
}

export interface CustomTextConfig {
  heading?: string
  content: string   // markdown
}

export interface SectionDividerConfig {
  title: string
  subtitle?: string
}

export interface ScoreOverviewConfig {
  chartType: 'radar' | 'bars'
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean
  showDimensionScore?: boolean
  entityIds?: string[]  // null/empty = all scored entities
}

export interface ScoreDetailConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  entityId: string | null
  showScore?: boolean
  showBandLabel?: boolean
  showDefinition?: boolean
  showIndicators?: boolean
  showDevelopment?: boolean
  showChildBreakdown?: boolean
}

export interface StrengthsHighlightsConfig {
  topN: number
  displayLevel: 'dimension' | 'factor' | 'construct'
  style: 'cards' | 'list'
}

export interface DevelopmentPlanConfig {
  maxItems: number
  prioritiseByScore?: boolean
  entityIds?: string[]
}

export interface NormComparisonConfig {
  // deferred — no fields required for v1 stub
  _deferred: true
}

export interface RaterComparisonConfig {
  entityIds?: string[]
  raterGroups: Array<'self' | 'manager' | 'peers' | 'direct_reports'>
}

export interface GapAnalysisConfig {
  gapThreshold?: number   // default 20 (POMP points)
  showBlindSpots?: boolean
  showHiddenStrengths?: boolean
}

export interface OpenCommentsConfig {
  minRatersForDisplay?: number   // default 3
  groupByFactor?: boolean
}

// ---------------------------------------------------------------------------
// BlockConfig — one entry in report_templates.blocks
// ---------------------------------------------------------------------------

export type BlockConfigMap = {
  cover_page: CoverPageConfig
  custom_text: CustomTextConfig
  section_divider: SectionDividerConfig
  score_overview: ScoreOverviewConfig
  score_detail: ScoreDetailConfig
  strengths_highlights: StrengthsHighlightsConfig
  development_plan: DevelopmentPlanConfig
  norm_comparison: NormComparisonConfig
  rater_comparison: RaterComparisonConfig
  gap_analysis: GapAnalysisConfig
  open_comments: OpenCommentsConfig
}

export interface BlockConfig<T extends BlockType = BlockType> {
  id: string
  type: T
  order: number
  config: BlockConfigMap[T]
  condition?: BlockCondition
  printBreakBefore?: boolean
  printHide?: boolean
  screenHide?: boolean
}

// ---------------------------------------------------------------------------
// Resolved block data — written to report_snapshots.rendered_data
// ---------------------------------------------------------------------------

export interface ResolvedBlockData {
  blockId: string
  type: BlockType
  order: number
  printBreakBefore?: boolean
  printHide?: boolean
  screenHide?: boolean
  // Block-specific resolved payload — typed by each block component
  data: Record<string, unknown>
  skipped?: boolean
  skipReason?: string
}

// ---------------------------------------------------------------------------
// Band resolution result
// ---------------------------------------------------------------------------

export type Band = 'low' | 'mid' | 'high'

export interface BandResult {
  band: Band
  bandLabel: string
  pompScore: number
  thresholdLow: number
  thresholdHigh: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/types.ts
git commit -m "feat: add report block type system — BlockConfig, BlockCondition, ResolvedBlockData"
```

---

## Task 6: Block Registry (metadata only)

**Files:**
- Create: `src/lib/reports/registry.ts`

The registry maps block types to builder metadata (labels, categories, default configs). No React imports here — this file is used by both server (runner) and client (builder).

- [ ] **Step 1: Write the registry**

```typescript
// =============================================================================
// src/lib/reports/registry.ts — Block metadata registry
// =============================================================================

import type { BlockType, BlockCategory, BlockConfig } from './types'

export interface BlockMeta {
  label: string
  category: BlockCategory
  description: string
  defaultConfig: Record<string, unknown>
  is360Only?: boolean
  isDeferred?: boolean
}

export const BLOCK_REGISTRY: Record<BlockType, BlockMeta> = {
  cover_page: {
    label: 'Cover Page',
    category: 'meta',
    description: 'Participant name, campaign title, date, and partner logo.',
    defaultConfig: { showDate: true, showLogo: true },
  },
  custom_text: {
    label: 'Custom Text',
    category: 'meta',
    description: 'Admin-authored freeform text or instructions. Supports markdown.',
    defaultConfig: { heading: '', content: '' },
  },
  section_divider: {
    label: 'Section Divider',
    category: 'meta',
    description: 'Visual break with title and optional subtitle.',
    defaultConfig: { title: 'Section Title' },
  },
  score_overview: {
    label: 'Score Overview',
    category: 'score',
    description: 'Radar or bar chart across all factors or dimensions.',
    defaultConfig: { chartType: 'radar', displayLevel: 'factor', groupByDimension: true, showDimensionScore: true },
  },
  score_detail: {
    label: 'Score Detail',
    category: 'score',
    description: 'Single entity score with band label, definition, indicators, and development suggestion.',
    defaultConfig: { displayLevel: 'factor', entityId: null, showScore: true, showBandLabel: true, showDefinition: true, showIndicators: true, showDevelopment: false, showChildBreakdown: false },
  },
  strengths_highlights: {
    label: 'Strengths Highlights',
    category: 'highlight',
    description: 'Top N entities by score with hero visual treatment.',
    defaultConfig: { topN: 3, displayLevel: 'factor', style: 'cards' },
  },
  development_plan: {
    label: 'Development Plan',
    category: 'highlight',
    description: 'Aggregated development suggestions prioritised by lowest score.',
    defaultConfig: { maxItems: 3, prioritiseByScore: true },
  },
  norm_comparison: {
    label: 'Norm Comparison',
    category: 'score',
    description: 'Percentile/sten rank against norm group. Deferred — requires norm group assignment.',
    defaultConfig: { _deferred: true },
    isDeferred: true,
  },
  rater_comparison: {
    label: 'Rater Comparison',
    category: '360',
    description: 'Grouped bars: self vs manager vs peers vs direct reports.',
    defaultConfig: { raterGroups: ['self', 'manager', 'peers', 'direct_reports'] },
    is360Only: true,
  },
  gap_analysis: {
    label: 'Gap Analysis',
    category: '360',
    description: 'Blind spots (self high, others low) and hidden strengths (self low, others high).',
    defaultConfig: { gapThreshold: 20, showBlindSpots: true, showHiddenStrengths: true },
    is360Only: true,
  },
  open_comments: {
    label: 'Open Comments',
    category: '360',
    description: 'Aggregated qualitative feedback from raters. Anonymity floor: min 3 raters.',
    defaultConfig: { minRatersForDisplay: 3, groupByFactor: true },
    is360Only: true,
  },
}

export const BLOCK_CATEGORIES: Record<BlockCategory, { label: string; order: number }> = {
  meta: { label: 'Layout & Text', order: 1 },
  score: { label: 'Score Blocks', order: 2 },
  highlight: { label: 'Highlights', order: 3 },
  '360': { label: '360 Blocks', order: 4 },
}

/** Parse and validate template blocks JSONB into typed BlockConfig array. */
export function parseBlocks(raw: Record<string, unknown>[]): BlockConfig[] {
  return raw
    .filter((b) => typeof b.type === 'string' && b.type in BLOCK_REGISTRY)
    .map((b) => b as unknown as BlockConfig)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/registry.ts
git commit -m "feat: add block registry — metadata, categories, parseBlocks helper"
```

---

## Task 7: Band Resolution

**Files:**
- Create: `src/lib/reports/band-resolution.ts`

- [ ] **Step 1: Write the band resolution utility**

```typescript
// =============================================================================
// src/lib/reports/band-resolution.ts
// Resolves a POMP score to a band result using the hierarchy:
//   1. (Future) norm-derived thresholds
//   2. Entity override (band_label_* / pomp_threshold_* on dimension/factor/construct)
//   3. Global default (stored in partner config or hardcoded defaults)
// =============================================================================

import type { Band, BandResult } from './types'

export interface BandEntity {
  bandLabelLow?: string
  bandLabelMid?: string
  bandLabelHigh?: string
  pompThresholdLow?: number
  pompThresholdHigh?: number
}

export interface GlobalBandDefaults {
  thresholdLow: number   // POMP upper boundary for low band (default 40)
  thresholdHigh: number  // POMP lower boundary for high band (default 70)
  labelLow: string       // default "Developing"
  labelMid: string       // default "Effective"
  labelHigh: string      // default "Highly Effective"
}

export const DEFAULT_BAND_GLOBALS: GlobalBandDefaults = {
  thresholdLow: 40,
  thresholdHigh: 70,
  labelLow: 'Developing',
  labelMid: 'Effective',
  labelHigh: 'Highly Effective',
}

export function resolveBand(
  pompScore: number,
  entity: BandEntity,
  globals: GlobalBandDefaults = DEFAULT_BAND_GLOBALS,
): BandResult {
  const thresholdLow = entity.pompThresholdLow ?? globals.thresholdLow
  const thresholdHigh = entity.pompThresholdHigh ?? globals.thresholdHigh

  let band: Band
  if (pompScore <= thresholdLow) {
    band = 'low'
  } else if (pompScore >= thresholdHigh) {
    band = 'high'
  } else {
    band = 'mid'
  }

  const bandLabel =
    band === 'low'
      ? (entity.bandLabelLow ?? globals.labelLow)
      : band === 'high'
        ? (entity.bandLabelHigh ?? globals.labelHigh)
        : (entity.bandLabelMid ?? globals.labelMid)

  return { band, bandLabel, pompScore, thresholdLow, thresholdHigh }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/band-resolution.ts
git commit -m "feat: add band resolution utility — entity override → global default hierarchy"
```

---

## Task 8: Derived Narrative Builder

**Files:**
- Create: `src/lib/reports/narrative.ts`

- [ ] **Step 1: Write the narrative builder**

```typescript
// =============================================================================
// src/lib/reports/narrative.ts
// Assembles derived narrative text from taxonomy indicators + definitions.
// All text is deterministic — no AI involved here.
// =============================================================================

import type { Band } from './types'
import type { PersonReferenceType } from '@/types/database'

export interface NarrativeEntity {
  name: string
  definition?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
  developmentSuggestion?: string
}

/**
 * Resolve the {{person}} token to the appropriate reference string.
 * firstName is only used when personReference === 'first_name'.
 */
export function resolvePersonToken(
  text: string,
  personReference: PersonReferenceType,
  firstName?: string,
): string {
  const ref =
    personReference === 'you'
      ? 'you'
      : personReference === 'first_name'
        ? (firstName ?? 'the participant')
        : 'the participant'
  return text.replace(/\{\{person\}\}/g, ref)
}

/**
 * Build a narrative paragraph for a scored entity.
 *
 * Format:
 *   [Definition sentence.] [Indicator text for resolved band.]
 *
 * Falls back gracefully when indicators are missing.
 */
export function buildDerivedNarrative(
  entity: NarrativeEntity,
  band: Band,
  personReference: PersonReferenceType,
  firstName?: string,
): string {
  const parts: string[] = []

  if (entity.definition) {
    parts.push(entity.definition.trim().replace(/\.?$/, '.'))
  }

  const indicators =
    band === 'low'
      ? entity.indicatorsLow
      : band === 'high'
        ? entity.indicatorsHigh
        : entity.indicatorsMid

  if (indicators) {
    parts.push(indicators.trim())
  }

  const raw = parts.join(' ').trim()
  return resolvePersonToken(raw, personReference, firstName)
}

/**
 * Build a development suggestion for the lowest-scoring entities.
 * Returns null if no suggestion text exists.
 */
export function buildDevelopmentSuggestion(
  entity: NarrativeEntity,
  personReference: PersonReferenceType,
  firstName?: string,
): string | null {
  if (!entity.developmentSuggestion) return null
  return resolvePersonToken(entity.developmentSuggestion.trim(), personReference, firstName)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/narrative.ts
git commit -m "feat: add derived narrative builder — indicator assembly + {{person}} token resolution"
```

---

## Task 9: AI Narrative Enhancement

**Files:**
- Create: `src/lib/reports/ai-narrative.ts`

- [ ] **Step 1: Write the AI enhancement module**

```typescript
// =============================================================================
// src/lib/reports/ai-narrative.ts
// Optional AI narrative enhancement via OpenRouter.
// Called when narrative_mode === 'ai_enhanced' on the snapshot.
// Falls back to derived narrative if prompt is unavailable or call fails.
// =============================================================================

import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { resolvePersonToken } from './narrative'
import type { PersonReferenceType } from '@/types/database'

export interface AIEnhanceInput {
  entityName: string
  derivedNarrative: string
  pompScore: number
  bandLabel: string
  personReference: PersonReferenceType
  firstName?: string
}

/**
 * Enhance a derived narrative paragraph using OpenRouter.
 * Returns the derived narrative unchanged if the prompt is unavailable
 * or if the AI call fails — this must never throw.
 */
export async function enhanceNarrative(input: AIEnhanceInput): Promise<string> {
  try {
    const prompt = await getActiveSystemPrompt('report_narrative')
    if (!prompt) {
      console.warn('[ai-narrative] No active report_narrative prompt — using derived narrative')
      return input.derivedNarrative
    }

    const taskConfig = await getModelForTask('item_generation')  // reuse same model tier
    const model = taskConfig.modelId

    const userMessage = [
      `Entity: ${input.entityName}`,
      `POMP Score: ${input.pompScore} (${input.bandLabel})`,
      `Derived narrative to enhance:`,
      input.derivedNarrative,
    ].join('\n')

    const provider = openRouterProvider(model, { systemPrompt: prompt.content })
    const { text } = await provider.generateText({ prompt: userMessage })

    if (!text || text.trim().length < 10) {
      return input.derivedNarrative
    }

    return resolvePersonToken(text.trim(), input.personReference, input.firstName)
  } catch (err) {
    console.error('[ai-narrative] Enhancement failed — falling back to derived:', err)
    return input.derivedNarrative
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: If `openRouterProvider` API doesn't exactly match, adjust to match `src/lib/ai/providers/openrouter.ts`. Read that file if needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/ai-narrative.ts
git commit -m "feat: add AI narrative enhancement — OpenRouter integration with derived fallback"
```

---

## Task 10: Report Runner

**Files:**
- Create: `src/lib/reports/runner.ts`

The runner processes one snapshot at a time. Each step corresponds to the 6-step pipeline in the spec.

- [ ] **Step 1: Write the runner**

```typescript
// =============================================================================
// src/lib/reports/runner.ts
// processSnapshot(snapshotId) — the 6-step report generation pipeline.
//
// Steps:
//   1. Fetch   — load template, scores, taxonomy entities in parallel
//   2. Condition-check — skip blocks whose conditions aren't met
//   3. Band resolution — for each scored entity
//   4. Derived narrative — assemble from indicators + definition
//   5. AI enhance — if narrative_mode === 'ai_enhanced'
//   6. Snapshot — write rendered_data, set status → ready
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { mapReportSnapshotRow, mapReportTemplateRow } from '@/lib/supabase/mappers'
import { parseBlocks } from './registry'
import { resolveBand, DEFAULT_BAND_GLOBALS } from './band-resolution'
import { buildDerivedNarrative, buildDevelopmentSuggestion } from './narrative'
import { enhanceNarrative } from './ai-narrative'
import type { BlockConfig, ResolvedBlockData, BandResult } from './types'

interface SessionData {
  id: string
  campaignId: string
  participantProfileId: string
  firstName?: string
  lastName?: string
}

interface ScoreMap {
  [entityId: string]: number  // entityId → scaledScore (POMP 0–100)
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function processSnapshot(snapshotId: string): Promise<void> {
  const db = await createAdminClient()

  // Mark as generating
  await db
    .from('report_snapshots')
    .update({ status: 'generating' })
    .eq('id', snapshotId)
    .eq('status', 'pending')

  try {
    // -----------------------------------------------------------------------
    // Step 1: Fetch all required data in parallel
    // -----------------------------------------------------------------------

    const snapshotResult = await db
      .from('report_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single()
    if (snapshotResult.error || !snapshotResult.data) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }
    const snapshot = mapReportSnapshotRow(snapshotResult.data)

    const [templateResult, scoresResult, sessionResult] = await Promise.all([
      db.from('report_templates').select('*').eq('id', snapshot.templateId).single(),
      db.from('participant_scores').select('*').eq('session_id', snapshot.participantSessionId),
      db
        .from('participant_sessions')
        .select('id, campaign_id, participant_profile_id, profiles(first_name, last_name)')
        .eq('id', snapshot.participantSessionId)
        .single(),
    ])

    if (templateResult.error || !templateResult.data) {
      throw new Error(`Template not found: ${snapshot.templateId}`)
    }
    if (scoresResult.error) throw new Error(scoresResult.error.message)
    if (sessionResult.error || !sessionResult.data) {
      throw new Error(`Session not found: ${snapshot.participantSessionId}`)
    }

    const template = mapReportTemplateRow(templateResult.data)
    const blocks = parseBlocks(template.blocks)

    // Build score map: factorId → scaledScore
    const scoreMap: ScoreMap = {}
    for (const row of scoresResult.data ?? []) {
      scoreMap[row.factor_id] = row.scaled_score
    }

    // Session + participant name for person reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionRow = sessionResult.data as any
    const sessionData: SessionData = {
      id: sessionRow.id,
      campaignId: sessionRow.campaign_id,
      participantProfileId: sessionRow.participant_profile_id,
      firstName: sessionRow.profiles?.first_name,
      lastName: sessionRow.profiles?.last_name,
    }

    // Fetch all taxonomy entities needed by score blocks
    const entityIds = extractEntityIds(blocks)
    const taxonomyMap = await fetchTaxonomyEntities(db, entityIds)

    // -----------------------------------------------------------------------
    // Steps 2–5: Process each block
    // -----------------------------------------------------------------------

    const resolvedBlocks: ResolvedBlockData[] = []

    for (const block of blocks) {
      // Step 2: Condition check
      const conditionResult = evaluateCondition(block, scoreMap)
      if (!conditionResult.pass) {
        resolvedBlocks.push({
          blockId: block.id,
          type: block.type,
          order: block.order,
          printBreakBefore: block.printBreakBefore,
          printHide: block.printHide,
          screenHide: block.screenHide,
          data: {},
          skipped: true,
          skipReason: conditionResult.reason,
        })
        continue
      }

      // Step 3–5: Resolve block data (band + narrative per entity)
      const data = await resolveBlockData(
        block,
        scoreMap,
        taxonomyMap,
        template.personReference,
        template.displayLevel,
        sessionData,
        snapshot.narrativeMode === 'ai_enhanced',
      )

      resolvedBlocks.push({
        blockId: block.id,
        type: block.type,
        order: block.order,
        printBreakBefore: block.printBreakBefore,
        printHide: block.printHide,
        screenHide: block.screenHide,
        data,
      })
    }

    // -----------------------------------------------------------------------
    // Step 6: Write snapshot
    // -----------------------------------------------------------------------

    await db.from('report_snapshots').update({
      status: template.autoRelease ? 'released' : 'ready',
      released_at: template.autoRelease ? new Date().toISOString() : null,
      generated_at: new Date().toISOString(),
      rendered_data: resolvedBlocks,
      error_message: null,
    }).eq('id', snapshotId)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[runner] processSnapshot failed for ${snapshotId}:`, message)
    await db.from('report_snapshots').update({
      status: 'failed',
      error_message: message,
    }).eq('id', snapshotId)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractEntityIds(blocks: BlockConfig[]): string[] {
  const ids = new Set<string>()
  for (const block of blocks) {
    const config = block.config as Record<string, unknown>
    if (typeof config.entityId === 'string' && config.entityId) ids.add(config.entityId)
    if (Array.isArray(config.entityIds)) {
      config.entityIds.forEach((id) => typeof id === 'string' && id && ids.add(id))
    }
  }
  return Array.from(ids)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTaxonomyEntities(db: any, entityIds: string[]): Promise<Map<string, any>> {
  if (entityIds.length === 0) return new Map()

  const [factorsResult, constructsResult, dimensionsResult] = await Promise.all([
    db.from('factors').select('*').in('id', entityIds),
    db.from('constructs').select('*').in('id', entityIds),
    db.from('dimensions').select('*').in('id', entityIds),
  ])

  const map = new Map<string, Record<string, unknown>>()
  for (const row of [
    ...(factorsResult.data ?? []),
    ...(constructsResult.data ?? []),
    ...(dimensionsResult.data ?? []),
  ]) {
    map.set(row.id, row)
  }
  return map
}

function evaluateCondition(
  block: BlockConfig,
  scoreMap: ScoreMap,
): { pass: boolean; reason?: string } {
  if (!block.condition) return { pass: true }

  switch (block.condition.type) {
    case 'hasNormData':
      return { pass: false, reason: 'norm_comparison deferred' }
    case 'has360Data':
      // TODO: check if 360 rater data exists for this session
      return { pass: false, reason: '360 data check not yet implemented' }
    case 'scoreAbove': {
      const score = scoreMap[block.condition.entityId]
      if (score === undefined) return { pass: false, reason: 'no score for entity' }
      return score > block.condition.threshold
        ? { pass: true }
        : { pass: false, reason: `score ${score} not above threshold ${block.condition.threshold}` }
    }
    case 'scoreBelow': {
      const score = scoreMap[block.condition.entityId]
      if (score === undefined) return { pass: false, reason: 'no score for entity' }
      return score < block.condition.threshold
        ? { pass: true }
        : { pass: false, reason: `score ${score} not below threshold ${block.condition.threshold}` }
    }
  }
}

async function resolveBlockData(
  block: BlockConfig,
  scoreMap: ScoreMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  personReference: import('@/types/database').PersonReferenceType,
  templateDisplayLevel: import('@/types/database').ReportDisplayLevel,
  session: SessionData,
  aiEnhance: boolean,
): Promise<Record<string, unknown>> {
  if (block.type === 'norm_comparison') {
    return { _deferred: true, message: 'Norm comparison not available in this version.' }
  }

  if (['cover_page', 'custom_text', 'section_divider'].includes(block.type)) {
    // Meta blocks: config is passed through as-is + session/campaign data injected
    return {
      ...block.config,
      participantName: session.firstName
        ? `${session.firstName} ${session.lastName ?? ''}`.trim()
        : undefined,
      generatedAt: new Date().toISOString(),
    }
  }

  if (block.type === 'score_detail') {
    const config = block.config as import('./types').ScoreDetailConfig
    const entityId = config.entityId
    if (!entityId) return { _empty: true, reason: 'entityId not configured' }

    const entity = taxonomyMap.get(entityId)
    if (!entity) return { _empty: true, reason: `entity ${entityId} not found` }

    const pompScore = scoreMap[entityId]
    if (pompScore === undefined) return { _empty: true, reason: `no score for ${entityId}` }

    const bandResult = resolveBand(pompScore, {
      bandLabelLow: entity.band_label_low,
      bandLabelMid: entity.band_label_mid,
      bandLabelHigh: entity.band_label_high,
      pompThresholdLow: entity.pomp_threshold_low,
      pompThresholdHigh: entity.pomp_threshold_high,
    })

    let narrative: string | null = null
    if (config.showIndicators || config.showDefinition) {
      const derived = buildDerivedNarrative(
        {
          name: entity.name,
          definition: entity.definition,
          indicatorsLow: entity.indicators_low,
          indicatorsMid: entity.indicators_mid,
          indicatorsHigh: entity.indicators_high,
        },
        bandResult.band,
        personReference,
        session.firstName,
      )
      narrative = aiEnhance
        ? await enhanceNarrative({
            entityName: entity.name,
            derivedNarrative: derived,
            pompScore,
            bandLabel: bandResult.bandLabel,
            personReference,
            firstName: session.firstName,
          })
        : derived
    }

    const developmentSuggestion = config.showDevelopment
      ? buildDevelopmentSuggestion(
          { name: entity.name, developmentSuggestion: entity.development_suggestion },
          personReference,
          session.firstName,
        )
      : null

    return {
      entityId,
      entityName: entity.name,
      entitySlug: entity.slug,
      definition: config.showDefinition ? entity.definition : undefined,
      pompScore,
      bandResult,
      narrative,
      developmentSuggestion,
      config,
    }
  }

  if (block.type === 'score_overview') {
    const config = block.config as import('./types').ScoreOverviewConfig
    const scores = Object.entries(scoreMap).map(([entityId, pompScore]) => {
      const entity = taxonomyMap.get(entityId)
      const bandResult = entity
        ? resolveBand(pompScore, {
            bandLabelLow: entity.band_label_low,
            bandLabelMid: entity.band_label_mid,
            bandLabelHigh: entity.band_label_high,
            pompThresholdLow: entity.pomp_threshold_low,
            pompThresholdHigh: entity.pomp_threshold_high,
          })
        : resolveBand(pompScore, {})
      return { entityId, entityName: entity?.name ?? entityId, pompScore, bandResult }
    })
    return { scores, config }
  }

  if (block.type === 'strengths_highlights') {
    const config = block.config as import('./types').StrengthsHighlightsConfig
    const ranked = Object.entries(scoreMap)
      .map(([entityId, pompScore]) => ({
        entityId,
        entityName: taxonomyMap.get(entityId)?.name ?? entityId,
        pompScore,
      }))
      .sort((a, b) => b.pompScore - a.pompScore)
      .slice(0, config.topN)
    return { highlights: ranked, config }
  }

  if (block.type === 'development_plan') {
    const config = block.config as import('./types').DevelopmentPlanConfig
    const items = Object.entries(scoreMap)
      .map(([entityId, pompScore]) => {
        const entity = taxonomyMap.get(entityId)
        return {
          entityId,
          entityName: entity?.name ?? entityId,
          pompScore,
          suggestion: entity?.development_suggestion
            ? buildDevelopmentSuggestion(
                { name: entity.name, developmentSuggestion: entity.development_suggestion },
                personReference,
                session.firstName,
              )
            : null,
        }
      })
      .filter((item) => item.suggestion)
      .sort((a, b) => a.pompScore - b.pompScore)
      .slice(0, config.maxItems)
    return { items, config }
  }

  // 360 blocks — return raw config for now; full resolution requires rater data
  return { config: block.config, _360: true }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues: `db` type from createAdminClient, participant_sessions column names (use snake_case in select string).

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/runner.ts
git commit -m "feat: add report runner — 6-step pipeline, band resolution, narrative assembly"
```

---

## Task 11: Runner API Route

**Files:**
- Create: `src/app/api/reports/generate/route.ts`

- [ ] **Step 1: Write the API route**

```typescript
import { processSnapshot } from '@/lib/reports/runner'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireAdminScope,
} from '@/lib/auth/authorization'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/reports/generate
 *
 * Two call patterns:
 *   { snapshotId } — process one specific snapshot
 *   { sessionId }  — process all pending snapshots for a session
 *   {}             — process the next pending snapshot in queue
 *
 * Client fires this with fetch() and does not await the response for
 * background generation. Admin/retry calls await the response.
 */
export async function POST(request: Request) {
  try {
    await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  try {
    const body = await request.json() as {
      snapshotId?: string
      sessionId?: string
    }

    const db = await createAdminClient()

    if (body.snapshotId) {
      // Process one specific snapshot
      await processSnapshot(body.snapshotId)
      return Response.json({ processed: [body.snapshotId] })
    }

    if (body.sessionId) {
      // Process all pending snapshots for a session
      const { data } = await db
        .from('report_snapshots')
        .select('id')
        .eq('participant_session_id', body.sessionId)
        .eq('status', 'pending')
      const ids = (data ?? []).map((r: { id: string }) => r.id)
      await Promise.all(ids.map(processSnapshot))
      return Response.json({ processed: ids })
    }

    // Process the oldest pending snapshot in queue
    const { data: next } = await db
      .from('report_snapshots')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!next) {
      return Response.json({ processed: [], message: 'No pending snapshots' })
    }

    await processSnapshot(next.id)
    return Response.json({ processed: [next.id] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Runner failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Smoke-test locally (if a completed session exists)**

Manually set a `participant_session.status = 'completed'` for a test session that has a campaign with a `campaign_report_config`, then call:

```bash
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{}' \
  -b "your-auth-cookie"
```

Expected: 200 with `{ processed: ["<snapshotId>"] }`. Snapshot row in DB should have `status: 'ready'` and non-null `rendered_data`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/generate/route.ts
git commit -m "feat: add report runner API route — POST /api/reports/generate"
```

---

## Final Verification

- [ ] **Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Confirm migration applied**

```bash
npm run db:status
```

Expected: 00041 shows as applied.

- [ ] **Final commit summary**

At this point Part 1 is complete. All server-side infrastructure is in place:
- 3 new DB tables with RLS and triggers
- 6 new taxonomy fields per entity level
- 4 seeded platform-global templates
- TypeScript types and mappers
- Server actions for CRUD + snapshot management
- Block type system with registry
- Band resolution utility
- Derived narrative + AI enhancement
- Runner pipeline
- Runner API route

Part 2 (UI) can now begin. Agents working on Part 2 depend on everything in this plan being complete and `npx tsc --noEmit` passing.
