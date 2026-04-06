# Partner Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add assessment/report entitlements and branding control for partners, mirroring the existing client entitlement system with hierarchical enforcement.

**Architecture:** New migration adds `can_customize_branding` to partners, two assignment tables, and a quota RPC function. New server actions file mirrors `client-entitlements.ts`. New settings page mirrors `client-settings-panel.tsx`. Existing client entitlements are modified to respect partner-level constraints (pool guard on assessment assignment, partner quota check, cascading branding flag).

**Tech Stack:** Next.js App Router, React, Supabase (RLS + RPC), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-07-partner-entitlements-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00073_partner_entitlements.sql`

- [ ] **Step 1: Create the migration**

Mirror migration `00066_client_entitlements.sql` but for partners. The migration must include:

1. Add `can_customize_branding` column to `partners` table
2. Create `partner_assessment_assignments` table
3. Create `partner_report_template_assignments` table
4. Create `get_partner_assessment_quota_usage` RPC function
5. Create indexes, triggers, and RLS policies

```sql
-- =============================================================================
-- Partner entitlements: assessment/report assignments + branding flag
-- Mirrors 00066_client_entitlements.sql for the partner level
-- =============================================================================

-- 1. Branding flag
ALTER TABLE partners ADD COLUMN IF NOT EXISTS can_customize_branding BOOLEAN NOT NULL DEFAULT false;

-- 2. Assessment assignments
CREATE TABLE IF NOT EXISTS partner_assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  quota_limit INT,  -- NULL = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_partner_assessment UNIQUE (partner_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_assessment_assignments_partner
  ON partner_assessment_assignments(partner_id);

-- 3. Report template assignments
CREATE TABLE IF NOT EXISTS partner_report_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_partner_report_template UNIQUE (partner_id, report_template_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_report_template_assignments_partner
  ON partner_report_template_assignments(partner_id);

-- 4. Partner quota usage function
-- Counts active participants across ALL of a partner's clients for a given assessment
CREATE OR REPLACE FUNCTION get_partner_assessment_quota_usage(
  p_partner_id UUID,
  p_assessment_id UUID
) RETURNS INT AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  JOIN clients cl ON c.client_id = cl.id
  WHERE cl.partner_id = p_partner_id
    AND ca.assessment_id = p_assessment_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;

-- 5. Updated-at triggers
DROP TRIGGER IF EXISTS trg_partner_assessment_assignments_updated ON partner_assessment_assignments;
CREATE TRIGGER trg_partner_assessment_assignments_updated
  BEFORE UPDATE ON partner_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_partner_report_template_assignments_updated ON partner_report_template_assignments;
CREATE TRIGGER trg_partner_report_template_assignments_updated
  BEFORE UPDATE ON partner_report_template_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. RLS policies
ALTER TABLE partner_assessment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON partner_assessment_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "partner_members_select_own" ON partner_assessment_assignments
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
    )
  );

ALTER TABLE partner_report_template_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON partner_report_template_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "partner_members_select_own" ON partner_report_template_assignments
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
    )
  );
```

- [ ] **Step 2: Push migration**

Run: `npm run db:push`
Expected: Migration applied successfully

- [ ] **Step 3: Regenerate Supabase types**

Run the Supabase type generation command so the client knows about the new tables, columns, and RPC function. Check `package.json` for the script name (likely `db:gen-types` or similar).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00073_partner_entitlements.sql
git commit -m "feat(partner): add entitlement tables, quota function, and branding flag"
```

---

### Task 2: TypeScript Types and Mappers

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/supabase/mappers.ts`

- [ ] **Step 1: Add `canCustomizeBranding` to Partner interface**

In `src/types/database.ts`, find the `Partner` interface (lines 186-201). Add after the `isActive` field:

```typescript
  /** Whether the partner can customise their own brand and control client branding. */
  canCustomizeBranding: boolean
```

- [ ] **Step 2: Add partner assignment types**

In `src/types/database.ts`, after the `ClientReportTemplateAssignment` interface (after line 1792), add:

```typescript
export interface PartnerAssessmentAssignment {
  id: string
  partnerId: string
  assessmentId: string
  quotaLimit: number | null // null = unlimited
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

export interface PartnerReportTemplateAssignment {
  id: string
  partnerId: string
  reportTemplateId: string
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

/** Partner assessment assignment enriched with usage data and assessment metadata */
export interface PartnerAssessmentAssignmentWithUsage extends PartnerAssessmentAssignment {
  assessmentName: string
  quotaUsed: number
}
```

- [ ] **Step 3: Add partner mapper functions**

In `src/lib/supabase/mappers.ts`, after `mapClientReportTemplateAssignmentRow` (after line 826), add:

```typescript
export function mapPartnerAssessmentAssignmentRow(row: any): PartnerAssessmentAssignment {
  return {
    id: row.id,
    partnerId: row.partner_id,
    assessmentId: row.assessment_id,
    quotaLimit: row.quota_limit ?? null,
    isActive: row.is_active,
    assignedBy: row.assigned_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapPartnerReportTemplateAssignmentRow(row: any): PartnerReportTemplateAssignment {
  return {
    id: row.id,
    partnerId: row.partner_id,
    reportTemplateId: row.report_template_id,
    isActive: row.is_active,
    assignedBy: row.assigned_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
```

Add the imports for the new types at the top of `mappers.ts`.

- [ ] **Step 4: Update partner mapper to include `canCustomizeBranding`**

Find the existing `mapPartnerRow` function in `mappers.ts`. Add `canCustomizeBranding: row.can_customize_branding ?? false` to the return object.

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/lib/supabase/mappers.ts
git commit -m "feat(partner): add entitlement types and mapper functions"
```

---

### Task 3: Partner Entitlements Server Actions

**Files:**
- Create: `src/app/actions/partner-entitlements.ts`

**Reference:** `src/app/actions/client-entitlements.ts` — mirror this file's structure exactly, changing `client` → `partner`, `clientId` → `partnerId`, `requireClientAccess` → `requirePartnerAccess`.

- [ ] **Step 1: Create the actions file**

Create `src/app/actions/partner-entitlements.ts` with these functions, mirroring the client equivalents:

**Imports needed:**
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePartnerAccess } from "@/lib/auth/authorization"
import { mapPartnerAssessmentAssignmentRow, mapPartnerReportTemplateAssignmentRow } from "@/lib/supabase/mappers"
import { throwActionError } from "@/lib/security/action-errors"
import { revalidatePath } from "next/cache"
import type { PartnerAssessmentAssignment, PartnerReportTemplateAssignment, PartnerAssessmentAssignmentWithUsage } from "@/types/database"
```

**Functions to implement (mirror client-entitlements.ts line by line):**

1. `getPartnerAssessmentAssignments(partnerId)` — mirror lines 21-76 of client-entitlements.ts
   - Auth: `await requirePartnerAccess(partnerId)`
   - Query: `partner_assessment_assignments` where `partner_id = partnerId` and `is_active = true`
   - For each row, call RPC `get_partner_assessment_quota_usage(partnerId, assessmentId)` for usage count
   - Return `PartnerAssessmentAssignmentWithUsage[]` (uses the partner-specific type, not the client one)

2. `getPartnerReportTemplateAssignments(partnerId)` — mirror lines 101-122
   - Auth: `await requirePartnerAccess(partnerId)`
   - Query: `partner_report_template_assignments` where `partner_id = partnerId` and `is_active = true`

3. `assignAssessmentToPartner(partnerId, input: { assessmentId: string; quotaLimit?: number | null })` — mirror lines 204-237
   - Auth: `requirePartnerAccess(partnerId)` then check `scope.isPlatformAdmin`
   - INSERT into `partner_assessment_assignments` with `partner_id`, `assessment_id`, `quota_limit`, `assigned_by`
   - Handle unique constraint violation (code `'23505'`)
   - Revalidate `/partners`

4. `updatePartnerAssessmentAssignment(assignmentId, partnerId, updates)` — mirror lines 239-270
   - Auth: platform admin only
   - UPDATE `partner_assessment_assignments` matching `id` + `partner_id`

5. `removePartnerAssessmentAssignment(assignmentId, partnerId)` — mirror lines 272-279
   - Calls `updatePartnerAssessmentAssignment` with `{ isActive: false }`
   - **Extra guard:** Before deactivating, check if any clients under this partner still have this assessment assigned (query `client_assessment_assignments` where `assessment_id` matches and `client_id` IN clients belonging to partner and `is_active = true`). If so, return error: "Remove this assessment from all clients first."

6. `togglePartnerReportTemplateAssignment(partnerId, reportTemplateId, assigned)` — mirror lines 281-329
   - Auth: platform admin only
   - Upsert/deactivate pattern matching `toggleReportTemplateAssignment`

7. `togglePartnerBranding(partnerId, canCustomize: boolean)` — mirror lines 331-350
   - Auth: platform admin only
   - UPDATE `partners` table SET `can_customize_branding = canCustomize`
   - Revalidate `/partners`

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 3: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/partner-entitlements.ts
git commit -m "feat(partner): add entitlement server actions"
```

---

### Task 4: Partner Settings UI

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/settings/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/settings/partner-settings-panel.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/settings/loading.tsx`

**Reference:** `src/app/(dashboard)/clients/[slug]/settings/` — mirror this pattern.

- [ ] **Step 1: Create the server page**

Mirror `src/app/(dashboard)/clients/[slug]/settings/page.tsx`. Load the partner by slug, pass `partnerId`, `partnerSlug`, and `canCustomizeBranding` to the panel.

```typescript
import { notFound } from "next/navigation"
import { getPartnerBySlug } from "@/app/actions/partners"
import { PartnerSettingsPanel } from "./partner-settings-panel"

export default async function PartnerSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const partner = await getPartnerBySlug(slug)
  if (!partner) notFound()

  return (
    <PartnerSettingsPanel
      partnerId={partner.id}
      partnerSlug={slug}
      canCustomizeBranding={partner.canCustomizeBranding ?? false}
    />
  )
}
```

- [ ] **Step 2: Create the settings panel component**

Mirror `src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx` structure. Three cards:

1. **Feature Flags** — `can_customize_branding` toggle
   - Same optimistic + rollback + revalidation pattern as client settings (lines 29-45 of client-settings-panel)
   - Label: "Custom Branding"
   - Description: "Allow this partner and their clients to customise their own brand settings."
   - Uses `togglePartnerBranding(partnerId, checked)` from partner-entitlements

2. **Assessment Assignments** — table listing assigned assessments
   - Fetch via `getPartnerAssessmentAssignments(partnerId)` on mount (or server-side)
   - Columns: Assessment Name, Quota (editable or "Unlimited"), Usage count, Remove button
   - "Assign Assessment" button opens a picker
   - Uses `assignAssessmentToPartner`, `updatePartnerAssessmentAssignment`, `removePartnerAssessmentAssignment`

3. **Report Template Assignments** — table listing assigned templates
   - Fetch via `getPartnerReportTemplateAssignments(partnerId)` on mount
   - Columns: Template Name, Toggle/Remove button
   - "Assign Template" button opens a picker
   - Uses `togglePartnerReportTemplateAssignment`

**Important:** Look at how the client settings panel implements the assessment and report template sections. If it uses sub-components or inline rendering, follow the same pattern. The component may be substantial (~200-300 lines) — that's expected for a settings panel matching the client one.

- [ ] **Step 3: Create loading state**

```typescript
export default function PartnerSettingsLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="h-32 rounded-xl bg-muted/40 animate-shimmer" />
      <div className="h-64 rounded-xl bg-muted/40 animate-shimmer" />
      <div className="h-48 rounded-xl bg-muted/40 animate-shimmer" />
    </div>
  )
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/settings/
git commit -m "feat(partner): add settings page with entitlements and branding toggle"
```

---

### Task 5: Client Entitlements — Partner Pool Guard & Branding Cascade

**Files:**
- Modify: `src/app/actions/client-entitlements.ts`
- Modify: `src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx`
- Modify: `src/app/client/settings/brand/client/page.tsx`

This task adds the hierarchical enforcement: partner controls what clients can access.

- [ ] **Step 1: Add `isClientBrandingEnabled` helper**

In `src/app/actions/client-entitlements.ts`, add a new exported function:

```typescript
/**
 * Check if branding is enabled for a client, respecting partner cascade.
 * Returns false if the client's own flag is off OR if the client's partner has branding disabled.
 */
export async function isClientBrandingEnabled(clientId: string): Promise<boolean> {
  const db = await createClient()

  const { data: client } = await db
    .from('clients')
    .select('can_customize_branding, partner_id')
    .eq('id', clientId)
    .single()

  if (!client?.can_customize_branding) return false

  // If client has a partner, check partner's flag too
  if (client.partner_id) {
    const { data: partner } = await db
      .from('partners')
      .select('can_customize_branding')
      .eq('id', client.partner_id)
      .single()

    if (!partner?.can_customize_branding) return false
  }

  return true
}
```

- [ ] **Step 2: Add partner pool guard on `assignAssessmentToClient`**

In the existing `assignAssessment` function (around line 208), after the auth check but before the INSERT, add:

```typescript
// If client belongs to a partner, verify assessment is in partner's pool
const { data: clientRow } = await db.from('clients')
  .select('partner_id')
  .eq('id', clientId)
  .single()

if (clientRow?.partner_id) {
  const { data: partnerAssignment } = await db
    .from('partner_assessment_assignments')
    .select('id')
    .eq('partner_id', clientRow.partner_id)
    .eq('assessment_id', input.assessmentId)
    .eq('is_active', true)
    .maybeSingle()

  if (!partnerAssignment) {
    return { error: 'This assessment is not available through the partner\'s allocation.' }
  }
}
```

- [ ] **Step 3: Add partner-level quota check to `checkQuotaAvailability`**

In `checkQuotaAvailability` (around line 135), after the existing client quota check loop (around line 195), add a partner-level check:

```typescript
// Partner-level quota check (if client belongs to a partner)
const { data: clientForPartner } = await db.from('clients')
  .select('partner_id')
  .eq('id', clientId)
  .single()

if (clientForPartner?.partner_id) {
  for (const assessmentId of assessmentIds) {
    const { data: partnerAssignment } = await db
      .from('partner_assessment_assignments')
      .select('quota_limit')
      .eq('partner_id', clientForPartner.partner_id)
      .eq('assessment_id', assessmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (partnerAssignment?.quota_limit != null) {
      const { data: usage } = await db.rpc('get_partner_assessment_quota_usage', {
        p_partner_id: clientForPartner.partner_id,
        p_assessment_id: assessmentId,
      })

      if ((usage ?? 0) >= partnerAssignment.quota_limit) {
        violations.push({
          assessmentId,
          quotaLimit: partnerAssignment.quota_limit,
          quotaUsed: usage ?? 0,
        })
      }
    }
  }
}
```

- [ ] **Step 4: Update client settings panel for partner cascade**

In `src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx`:

The server page needs to pass extra info about the partner's branding state. Modify the page (`src/app/(dashboard)/clients/[slug]/settings/page.tsx`) to also load the partner's `can_customize_branding` if the client has a `partner_id`. Pass `partnerBrandingDisabled: boolean` as a prop.

In the panel, when `partnerBrandingDisabled` is true:
- Render the branding toggle as disabled
- Show helper text: "Brand customisation is controlled by the partner. Contact the partner admin to enable."

Also, when the client belongs to a partner, the assessment assignment picker should only show assessments from the partner's pool. The server page should pass the partner's assessment IDs (from `getPartnerAssessmentAssignments`) alongside the full assessment list, and the panel should filter the picker to only show matching assessments. This prevents confusing 400 errors when the server-side guard rejects assignments not in the partner pool.

- [ ] **Step 5: Update client portal brand page**

In `src/app/client/settings/brand/client/page.tsx`, replace the direct `client.can_customize_branding` check (line 36) with:

```typescript
import { isClientBrandingEnabled } from "@/app/actions/client-entitlements"

// Replace: if (!client.can_customize_branding)
// With:
const brandingEnabled = await isClientBrandingEnabled(clientId)
if (!brandingEnabled) {
```

- [ ] **Step 6: Verify types and tests**

Run: `npx tsc --noEmit`
Expected: Clean compilation

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/client-entitlements.ts src/app/(dashboard)/clients/[slug]/settings/ src/app/client/settings/brand/client/page.tsx
git commit -m "feat(partner): add partner pool guard, quota cascade, and branding cascade to client entitlements"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 2: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 3: Visual verification**

Start dev server: `npm run dev`

**Partner settings (admin):**
1. Navigate to `/partners/[slug]/settings`
2. Feature flags card with branding toggle
3. Assessment assignments table — assign an assessment with quota, see it appear
4. Report template assignments — assign a template, see it appear
5. Remove an assessment — if clients have it, see the error message
6. Toggle branding on/off — verify toast feedback

**Partner cascade to clients:**
7. Assign 2 assessments to a partner (quota: 10 each)
8. Navigate to a client under that partner → Settings
9. Assessment picker only shows those 2 assessments (not all platform assessments)
10. Disable partner branding → client branding toggle greys out with "Controlled by partner" text
11. Enable partner branding → client toggle becomes active

**Quota enforcement:**
12. Set partner quota to a low number (e.g. 2)
13. Create sessions up to the quota
14. Try to invite another participant → see "Partner allocation exhausted" error

**Client portal branding cascade:**
15. Disable partner branding
16. Switch to client portal → Settings > Brand → see "Brand customisation is not enabled" message
17. Enable partner branding + enable client branding
18. Client portal → Settings > Brand → full editor renders
