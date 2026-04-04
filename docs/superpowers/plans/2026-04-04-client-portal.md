# Client Portal & Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable client organizations to independently run assessment campaigns through a focused client portal, with admin-controlled entitlements governing which assessments, quotas, and report templates each client can access.

**Architecture:** Shared campaign detail shell with portal-specific page content. New junction tables for assessment/report entitlements with computed quota usage. Admin setup via new tabbed org detail page. Client portal with three nav items (Dashboard, Campaigns, Participants).

**Tech Stack:** Next.js (App Router), Supabase (Postgres + RLS), TypeScript, React Server/Client Components, Vitest, Tailwind CSS, sonner toasts

**Spec:** `docs/superpowers/specs/2026-04-04-client-portal-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `supabase/migrations/00066_client_entitlements.sql` | Tables, function, column, RLS, triggers |
| `src/app/actions/client-entitlements.ts` | CRUD for assessment/report assignments, quota queries |
| `tests/unit/client-entitlements.test.ts` | Unit tests for entitlement actions |
| `src/app/(dashboard)/organizations/[slug]/layout.tsx` | Org detail tabbed layout (fetches org) |
| `src/app/(dashboard)/organizations/[slug]/page.tsx` | Redirect to overview |
| `src/app/(dashboard)/organizations/[slug]/organization-detail-shell.tsx` | Tabbed shell component |
| `src/app/(dashboard)/organizations/[slug]/overview/page.tsx` | Migrated from edit/page.tsx |
| `src/app/(dashboard)/organizations/[slug]/assessments/page.tsx` | Assessment assignment management |
| `src/app/(dashboard)/organizations/[slug]/assessments/assessment-assignments.tsx` | Client component for assignment UI |
| `src/app/(dashboard)/organizations/[slug]/reports/page.tsx` | Report template assignment |
| `src/app/(dashboard)/organizations/[slug]/reports/report-assignments.tsx` | Client component for template checklist |
| `src/app/(dashboard)/organizations/[slug]/settings/page.tsx` | Client feature flags (branding toggle) |
| `src/app/(dashboard)/organizations/[slug]/settings/client-settings-panel.tsx` | Client component for settings |
| `src/app/client/dashboard/page.tsx` | Client dashboard |
| `src/app/client/dashboard/client-dashboard.tsx` | Client dashboard client component |
| `src/app/client/campaigns/page.tsx` | Client campaign list |
| `src/app/client/campaigns/create/page.tsx` | Client campaign creation |
| `src/app/client/campaigns/[id]/layout.tsx` | Client campaign detail layout |
| `src/app/client/campaigns/[id]/page.tsx` | Redirect to overview |
| `src/app/client/campaigns/[id]/overview/page.tsx` | Client campaign overview |
| `src/app/client/campaigns/[id]/assessments/page.tsx` | Client campaign assessments |
| `src/app/client/campaigns/[id]/participants/page.tsx` | Client campaign participants |
| `src/app/client/campaigns/[id]/results/page.tsx` | Client campaign results |
| `src/app/client/campaigns/[id]/experience/page.tsx` | Client campaign experience |
| `src/app/client/campaigns/[id]/branding/page.tsx` | Client campaign branding (conditional) |
| `src/app/client/campaigns/[id]/settings/page.tsx` | Client campaign settings |
| `src/app/client/participants/page.tsx` | Global participants view |
| `src/app/client/participants/global-participants.tsx` | Client component for cross-campaign participants |

### Modified files

| File | Change |
|------|--------|
| `src/types/database.ts` | Add types for new tables |
| `src/lib/supabase/mappers.ts` | Add row/insert mappers for new tables |
| `src/components/app-sidebar.tsx` | Replace `clientNav` array |
| `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx` | Portal-aware tabs + href generation |
| `src/app/(dashboard)/campaigns/[id]/overview/page.tsx` | Add access links, remove timeline |
| `src/app/(dashboard)/campaigns/[id]/participants/page.tsx` | Add access links section |
| `src/app/(dashboard)/campaigns/[id]/settings/page.tsx` | Add timeline, portal-gate report config |
| `src/app/actions/campaigns.ts` | Quota checks in `inviteParticipant` |
| `src/app/actions/assess.ts` | Quota checks in `registerViaLink` |
| `src/app/actions/organizations.ts` | Add `getOrganizationEntitlementSummary` |

### Deleted files

| File | Reason |
|------|--------|
| `src/app/(dashboard)/organizations/[slug]/edit/page.tsx` | Migrated to overview/ |
| `src/app/(dashboard)/organizations/[slug]/edit/organization-edit-form.tsx` | Migrated to overview/ |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00066_client_entitlements.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 00066_client_entitlements.sql
-- Client entitlements: assessment assignments, report template assignments,
-- quota computation, and branding toggle

-- 1. Assessment assignments table
CREATE TABLE IF NOT EXISTS client_assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  quota_limit INT,  -- NULL = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_assessment UNIQUE (organization_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_client_assessment_assignments_org
  ON client_assessment_assignments(organization_id);

COMMENT ON TABLE client_assessment_assignments IS
  'Links organizations to the assessments they can use in campaigns, with optional per-row quota limits.';

-- 2. Report template assignments table
CREATE TABLE IF NOT EXISTS client_report_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_report_template UNIQUE (organization_id, report_template_id)
);

CREATE INDEX IF NOT EXISTS idx_client_report_template_assignments_org
  ON client_report_template_assignments(organization_id);

COMMENT ON TABLE client_report_template_assignments IS
  'Links organizations to the report templates they can generate from campaign results.';

-- 3. Branding toggle on organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS can_customize_branding BOOLEAN NOT NULL DEFAULT false;

-- 4. Quota computation function
CREATE OR REPLACE FUNCTION get_assessment_quota_usage(p_org_id UUID, p_assessment_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE ca.assessment_id = p_assessment_id
    AND c.organization_id = p_org_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_assessment_quota_usage IS
  'Computes live quota usage for a given org + assessment. NULL-safe (returns 0 if no matches).';

-- 5. updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_assessment_assignments_updated ON client_assessment_assignments;
CREATE TRIGGER trg_client_assessment_assignments_updated
  BEFORE UPDATE ON client_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_client_report_template_assignments_updated ON client_report_template_assignments;
CREATE TRIGGER trg_client_report_template_assignments_updated
  BEFORE UPDATE ON client_report_template_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. RLS policies
ALTER TABLE client_assessment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON client_assessment_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "client_members_select_own" ON client_assessment_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT cm.organization_id FROM client_memberships cm
      WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
    )
  );

ALTER TABLE client_report_template_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON client_report_template_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "client_members_select_own" ON client_report_template_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT cm.organization_id FROM client_memberships cm
      WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
    )
  );
```

- [ ] **Step 2: Push migration to local database**

Run: `npm run db:push`
Expected: Migration applies successfully, no errors.

- [ ] **Step 3: Verify tables exist**

Run: `npm run db:status`
Expected: Shows 00066 as applied. Then verify with a quick SQL check in Supabase Studio that both tables exist with correct columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00066_client_entitlements.sql
git commit -m "feat(entitlements): add client assessment/report assignment tables and quota function"
```

---

## Task 2: TypeScript Types & Mappers

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/supabase/mappers.ts`

- [ ] **Step 1: Add types to database.ts**

Add after the existing type definitions (find the section near other entity types):

```typescript
// --- Client Entitlements ---

export interface ClientAssessmentAssignment {
  id: string;
  organizationId: string;
  assessmentId: string;
  quotaLimit: number | null; // null = unlimited
  isActive: boolean;
  assignedBy: string;
  created_at: string;
  updated_at: string;
}

export interface ClientReportTemplateAssignment {
  id: string;
  organizationId: string;
  reportTemplateId: string;
  isActive: boolean;
  assignedBy: string;
  created_at: string;
  updated_at: string;
}

/** Assessment assignment enriched with usage data and assessment metadata */
export interface AssessmentAssignmentWithUsage extends ClientAssessmentAssignment {
  assessmentName: string;
  quotaUsed: number;
}
```

- [ ] **Step 2: Add mappers to mappers.ts**

Add at the end of the file, following the existing pattern:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapClientAssessmentAssignmentRow(row: any): ClientAssessmentAssignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    quotaLimit: row.quota_limit ?? null,
    isActive: row.is_active,
    assignedBy: row.assigned_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapClientReportTemplateAssignmentRow(row: any): ClientReportTemplateAssignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    reportTemplateId: row.report_template_id,
    isActive: row.is_active,
    assignedBy: row.assigned_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/lib/supabase/mappers.ts
git commit -m "feat(entitlements): add TypeScript types and mappers for assignment tables"
```

---

## Task 3: Entitlements Server Actions

**Files:**
- Create: `src/app/actions/client-entitlements.ts`
- Create: `tests/unit/client-entitlements.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/client-entitlements.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock auth
const auth = vi.hoisted(() => ({
  requireOrganizationAccess: vi.fn(),
  resolveAuthorizedScope: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireOrganizationAccess: auth.requireOrganizationAccess,
  resolveAuthorizedScope: auth.resolveAuthorizedScope,
}));

// Mock supabase
const supabase = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
  };
  return {
    from: vi.fn(() => chain),
    rpc: chain.rpc,
    chain,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => supabase),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("client-entitlements actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireOrganizationAccess.mockResolvedValue({
      scope: { isPlatformAdmin: true, actor: { id: "admin-1" } },
      organizationId: "org-1",
    });
  });

  describe("getAssessmentAssignments", () => {
    it("returns assignments for an organization", async () => {
      supabase.chain.order.mockResolvedValueOnce({
        data: [
          {
            id: "asgn-1",
            organization_id: "org-1",
            assessment_id: "assess-1",
            quota_limit: 50,
            is_active: true,
            assigned_by: "admin-1",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
            assessments: { name: "Leadership" },
          },
        ],
        error: null,
      });
      supabase.rpc.mockResolvedValueOnce({ data: 32, error: null });

      const { getAssessmentAssignments } = await import(
        "@/app/actions/client-entitlements"
      );
      const result = await getAssessmentAssignments("org-1");

      expect(result).toHaveLength(1);
      expect(result[0].assessmentName).toBe("Leadership");
      expect(result[0].quotaUsed).toBe(32);
      expect(result[0].quotaLimit).toBe(50);
    });
  });

  describe("assignAssessment", () => {
    it("rejects non-admin users", async () => {
      auth.requireOrganizationAccess.mockResolvedValueOnce({
        scope: { isPlatformAdmin: false, actor: { id: "user-1" } },
        organizationId: "org-1",
      });

      const { assignAssessment } = await import(
        "@/app/actions/client-entitlements"
      );
      const result = await assignAssessment("org-1", {
        assessmentId: "assess-1",
        quotaLimit: null,
      });

      expect(result).toEqual({ error: "Only platform admins can manage entitlements" });
    });

    it("creates assignment for admin users", async () => {
      supabase.chain.single.mockResolvedValueOnce({
        data: { id: "asgn-new" },
        error: null,
      });

      const { assignAssessment } = await import(
        "@/app/actions/client-entitlements"
      );
      const result = await assignAssessment("org-1", {
        assessmentId: "assess-1",
        quotaLimit: 50,
      });

      expect(result).toEqual({ success: true, id: "asgn-new" });
    });
  });

  describe("checkQuotaAvailability", () => {
    it("returns available when quota is unlimited", async () => {
      supabase.chain.eq.mockResolvedValueOnce({
        data: [
          { assessment_id: "assess-1", quota_limit: null, is_active: true },
        ],
        error: null,
      });

      const { checkQuotaAvailability } = await import(
        "@/app/actions/client-entitlements"
      );
      const result = await checkQuotaAvailability("org-1", ["assess-1"]);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("returns violation when quota exhausted", async () => {
      supabase.chain.eq.mockResolvedValueOnce({
        data: [
          { assessment_id: "assess-1", quota_limit: 10, is_active: true },
        ],
        error: null,
      });
      supabase.rpc.mockResolvedValueOnce({ data: 10, error: null });

      const { checkQuotaAvailability } = await import(
        "@/app/actions/client-entitlements"
      );
      const result = await checkQuotaAvailability("org-1", ["assess-1"]);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run tests/unit/client-entitlements.test.ts`
Expected: FAIL — module `@/app/actions/client-entitlements` not found.

- [ ] **Step 3: Implement server actions**

Create `src/app/actions/client-entitlements.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationAccess } from "@/lib/auth/authorization";
import {
  mapClientAssessmentAssignmentRow,
  mapClientReportTemplateAssignmentRow,
} from "@/lib/supabase/mappers";
import type {
  AssessmentAssignmentWithUsage,
  ClientReportTemplateAssignment,
} from "@/types/database";

// ─── Assessment assignments ────────────────────────────────────────

export async function getAssessmentAssignments(
  organizationId: string
): Promise<AssessmentAssignmentWithUsage[]> {
  const { scope } = await requireOrganizationAccess(organizationId);
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("client_assessment_assignments")
    .select("*, assessments(name)")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows) return [];

  // Compute usage for each assignment
  const assignments: AssessmentAssignmentWithUsage[] = [];
  for (const row of rows) {
    const mapped = mapClientAssessmentAssignmentRow(row);
    const { data: usage } = await supabase.rpc("get_assessment_quota_usage", {
      p_org_id: organizationId,
      p_assessment_id: row.assessment_id,
    });
    assignments.push({
      ...mapped,
      assessmentName: row.assessments?.name ?? "Unknown",
      quotaUsed: usage ?? 0,
    });
  }

  return assignments;
}

export async function assignAssessment(
  organizationId: string,
  input: { assessmentId: string; quotaLimit: number | null }
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can manage entitlements" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_assessment_assignments")
    .insert({
      organization_id: organizationId,
      assessment_id: input.assessmentId,
      quota_limit: input.quotaLimit,
      assigned_by: scope.actor!.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "This assessment is already assigned to this client" };
    }
    throw error;
  }

  revalidatePath(`/organizations`);
  return { success: true, id: data.id };
}

export async function updateAssessmentAssignment(
  assignmentId: string,
  organizationId: string,
  updates: { quotaLimit?: number | null; isActive?: boolean }
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can manage entitlements" };
  }

  const supabase = await createClient();
  const updatePayload: Record<string, unknown> = {};
  if (updates.quotaLimit !== undefined) updatePayload.quota_limit = updates.quotaLimit;
  if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;

  const { error } = await supabase
    .from("client_assessment_assignments")
    .update(updatePayload)
    .eq("id", assignmentId)
    .eq("organization_id", organizationId);

  if (error) throw error;

  revalidatePath(`/organizations`);
  return { success: true };
}

export async function removeAssessmentAssignment(
  assignmentId: string,
  organizationId: string
): Promise<{ success: true } | { error: string }> {
  return updateAssessmentAssignment(assignmentId, organizationId, {
    isActive: false,
  });
}

// ─── Report template assignments ───────────────────────────────────

export async function getReportTemplateAssignments(
  organizationId: string
): Promise<ClientReportTemplateAssignment[]> {
  const { scope } = await requireOrganizationAccess(organizationId);
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("client_report_template_assignments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (rows ?? []).map(mapClientReportTemplateAssignmentRow);
}

export async function toggleReportTemplateAssignment(
  organizationId: string,
  reportTemplateId: string,
  assigned: boolean
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can manage entitlements" };
  }

  const supabase = await createClient();

  if (assigned) {
    const { error } = await supabase
      .from("client_report_template_assignments")
      .upsert(
        {
          organization_id: organizationId,
          report_template_id: reportTemplateId,
          is_active: true,
          assigned_by: scope.actor!.id,
        },
        { onConflict: "organization_id,report_template_id" }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("client_report_template_assignments")
      .update({ is_active: false })
      .eq("organization_id", organizationId)
      .eq("report_template_id", reportTemplateId);
    if (error) throw error;
  }

  revalidatePath(`/organizations`);
  return { success: true };
}

// ─── Quota checks ──────────────────────────────────────────────────

export async function checkQuotaAvailability(
  organizationId: string,
  assessmentIds: string[]
): Promise<{
  allowed: boolean;
  violations: Array<{ assessmentId: string; quotaLimit: number; quotaUsed: number }>;
}> {
  const supabase = await createClient();

  // Get assignments for the requested assessments
  const { data: assignments, error } = await supabase
    .from("client_assessment_assignments")
    .select("assessment_id, quota_limit, is_active")
    .eq("organization_id", organizationId)
    .in("assessment_id", assessmentIds)
    .eq("is_active", true);

  if (error) throw error;

  const violations: Array<{
    assessmentId: string;
    quotaLimit: number;
    quotaUsed: number;
  }> = [];

  for (const assignment of assignments ?? []) {
    if (assignment.quota_limit === null) continue; // unlimited

    const { data: usage } = await supabase.rpc("get_assessment_quota_usage", {
      p_org_id: organizationId,
      p_assessment_id: assignment.assessment_id,
    });

    const used = usage ?? 0;
    if (used >= assignment.quota_limit) {
      violations.push({
        assessmentId: assignment.assessment_id,
        quotaLimit: assignment.quota_limit,
        quotaUsed: used,
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}

// ─── Branding toggle ───────────────────────────────────────────────

export async function toggleClientBranding(
  organizationId: string,
  canCustomize: boolean
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can manage client settings" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ can_customize_branding: canCustomize })
    .eq("id", organizationId);

  if (error) throw error;

  revalidatePath(`/organizations`);
  return { success: true };
}

// ─── Client-facing queries ─────────────────────────────────────────

/** Returns assessments available to a client org (for campaign assessment picker) */
export async function getAvailableAssessmentsForClient(
  organizationId: string
): Promise<
  Array<{
    assessmentId: string;
    assessmentName: string;
    quotaLimit: number | null;
    quotaUsed: number;
    quotaRemaining: number | null; // null = unlimited
  }>
> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("client_assessment_assignments")
    .select("assessment_id, quota_limit, assessments(name)")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw error;

  const result = [];
  for (const row of rows ?? []) {
    const { data: usage } = await supabase.rpc("get_assessment_quota_usage", {
      p_org_id: organizationId,
      p_assessment_id: row.assessment_id,
    });
    const used = usage ?? 0;
    result.push({
      assessmentId: row.assessment_id,
      assessmentName: row.assessments?.name ?? "Unknown",
      quotaLimit: row.quota_limit,
      quotaUsed: used,
      quotaRemaining: row.quota_limit === null ? null : row.quota_limit - used,
    });
  }

  return result;
}

/** Returns report template IDs available to a client org */
export async function getAvailableReportTemplateIds(
  organizationId: string
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("client_report_template_assignments")
    .select("report_template_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []).map((r) => r.report_template_id);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run tests/unit/client-entitlements.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/client-entitlements.ts tests/unit/client-entitlements.test.ts
git commit -m "feat(entitlements): add server actions for assessment/report assignments and quota checks"
```

---

## Task 4: Org Detail Tabbed Shell

**Files:**
- Create: `src/app/(dashboard)/organizations/[slug]/layout.tsx`
- Create: `src/app/(dashboard)/organizations/[slug]/page.tsx`
- Create: `src/app/(dashboard)/organizations/[slug]/organization-detail-shell.tsx`
- Move: `src/app/(dashboard)/organizations/[slug]/edit/page.tsx` → `overview/page.tsx`
- Move: `src/app/(dashboard)/organizations/[slug]/edit/organization-edit-form.tsx` → `overview/organization-edit-form.tsx`

- [ ] **Step 1: Create the layout.tsx**

Create `src/app/(dashboard)/organizations/[slug]/layout.tsx`:

```typescript
import { getOrganizationBySlug } from "@/app/actions/organizations";
import { notFound } from "next/navigation";
import { OrganizationDetailShell } from "./organization-detail-shell";

export default async function OrganizationDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug, {
    includeArchived: true,
  });
  if (!organization) notFound();

  return (
    <OrganizationDetailShell organization={organization}>
      {children}
    </OrganizationDetailShell>
  );
}
```

- [ ] **Step 2: Create the shell component**

Create `src/app/(dashboard)/organizations/[slug]/organization-detail-shell.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import type { OrganizationWithCounts } from "@/app/actions/organizations";

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];

export function OrganizationDetailShell({
  organization,
  children,
}: {
  organization: OrganizationWithCounts;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeSegment =
    tabs.find((t) => pathname.endsWith(`/${t.segment}`))?.segment ?? "overview";

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Clients"
        title={organization.name}
        description={organization.industry ?? undefined}
      >
        {!organization.isActive && (
          <Badge variant="outline">Archived</Badge>
        )}
      </PageHeader>

      <nav className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeSegment === tab.segment;
          return (
            <Link
              key={tab.segment}
              href={`/organizations/${organization.slug}/${tab.segment}`}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create the redirect page**

Create `src/app/(dashboard)/organizations/[slug]/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/organizations/${slug}/overview`);
}
```

- [ ] **Step 4: Move edit page to overview**

Move `src/app/(dashboard)/organizations/[slug]/edit/page.tsx` to `src/app/(dashboard)/organizations/[slug]/overview/page.tsx`. Move `organization-edit-form.tsx` alongside it. Update the import path in the page file. Remove the standalone PageHeader from `OrganizationEditForm` since the shell now provides it.

```bash
mkdir -p src/app/\(dashboard\)/organizations/\[slug\]/overview
mv src/app/\(dashboard\)/organizations/\[slug\]/edit/page.tsx src/app/\(dashboard\)/organizations/\[slug\]/overview/page.tsx
mv src/app/\(dashboard\)/organizations/\[slug\]/edit/organization-edit-form.tsx src/app/\(dashboard\)/organizations/\[slug\]/overview/organization-edit-form.tsx
rmdir src/app/\(dashboard\)/organizations/\[slug\]/edit
```

Then update the import in `overview/page.tsx`:
```typescript
import { OrganizationEditForm } from "./organization-edit-form";
```

And remove the PageHeader section from `organization-edit-form.tsx` (lines ~197-231 that render the manual header) since the shell now provides it.

- [ ] **Step 5: Verify navigation works**

Run: `npm run dev` and navigate to `/organizations/{any-slug}`. Verify:
- Redirects to `/organizations/{slug}/overview`
- Tab bar renders with 5 tabs
- Overview tab shows the org edit form
- Branding tab still works
- Active tab indicator highlights correctly

- [ ] **Step 6: Commit**

```bash
git add -A src/app/\(dashboard\)/organizations/\[slug\]/
git commit -m "refactor(orgs): add tabbed detail shell for organization pages"
```

---

## Task 5: Admin Assessments Tab (Entitlement Management)

**Files:**
- Create: `src/app/(dashboard)/organizations/[slug]/assessments/page.tsx`
- Create: `src/app/(dashboard)/organizations/[slug]/assessments/assessment-assignments.tsx`

- [ ] **Step 1: Create server page**

Create `src/app/(dashboard)/organizations/[slug]/assessments/page.tsx`:

```typescript
import { getOrganizationBySlug } from "@/app/actions/organizations";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
import { getAssessments } from "@/app/actions/assessments";
import { notFound } from "next/navigation";
import { AssessmentAssignments } from "./assessment-assignments";

export default async function OrgAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  const [assignments, allAssessments] = await Promise.all([
    getAssessmentAssignments(organization.id),
    getAssessments(),
  ]);

  return (
    <AssessmentAssignments
      organizationId={organization.id}
      assignments={assignments}
      allAssessments={allAssessments}
    />
  );
}
```

- [ ] **Step 2: Create client component**

Create `src/app/(dashboard)/organizations/[slug]/assessments/assessment-assignments.tsx`. This is a Zone 1 (immediate) component — each assignment/update saves immediately with toast.

Key features:
- List of assigned assessments with quota bars
- "Assign Assessment" button → dialog with assessment picker + quota input (number or unlimited toggle)
- Edit quota inline
- Deactivate assignment
- Warning colours: sage (healthy), amber (≤10% remaining), red (exhausted)
- Uses `assignAssessment`, `updateAssessmentAssignment`, `removeAssessmentAssignment` server actions
- Toast feedback on every mutation

The component should follow the same card-based pattern used in the campaign participant manager, with `ScrollReveal` stagger on the assignment cards.

- [ ] **Step 3: Verify tab works**

Run: `npm run dev`, navigate to `/organizations/{slug}/assessments`.
Expected: Shows assessment assignment list (empty for now). "Assign Assessment" button opens dialog.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/organizations/\[slug\]/assessments/
git commit -m "feat(entitlements): add admin assessment assignment tab on org detail page"
```

---

## Task 6: Admin Reports Tab (Template Assignment)

**Files:**
- Create: `src/app/(dashboard)/organizations/[slug]/reports/page.tsx`
- Create: `src/app/(dashboard)/organizations/[slug]/reports/report-assignments.tsx`

- [ ] **Step 1: Create server page**

Create `src/app/(dashboard)/organizations/[slug]/reports/page.tsx`:

```typescript
import { getOrganizationBySlug } from "@/app/actions/organizations";
import { getReportTemplateAssignments } from "@/app/actions/client-entitlements";
import { getReportTemplates } from "@/app/actions/reports";
import { notFound } from "next/navigation";
import { ReportAssignments } from "./report-assignments";

export default async function OrgReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  const [assignments, allTemplates] = await Promise.all([
    getReportTemplateAssignments(organization.id),
    getReportTemplates(),
  ]);

  return (
    <ReportAssignments
      organizationId={organization.id}
      partnerId={organization.partnerId ?? null}
      assignments={assignments}
      allTemplates={allTemplates}
    />
  );
}
```

- [ ] **Step 2: Create client component**

Create `src/app/(dashboard)/organizations/[slug]/reports/report-assignments.tsx`. Zone 1 (immediate toggle) component:

Key features:
- Grouped by report type (self-report vs 360)
- Each template shown as a checkbox row with name, display level, description
- Check = `toggleReportTemplateAssignment(orgId, templateId, true)`
- Uncheck = `toggleReportTemplateAssignment(orgId, templateId, false)`
- Only shows platform-global templates (`partnerId === null`) and templates belonging to the org's partner
- Toast on each toggle

- [ ] **Step 3: Verify tab works**

Navigate to `/organizations/{slug}/reports`. Verify checklist renders, toggles save.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/organizations/\[slug\]/reports/
git commit -m "feat(entitlements): add admin report template assignment tab on org detail page"
```

---

## Task 7: Admin Settings Tab (Branding Toggle)

**Files:**
- Create: `src/app/(dashboard)/organizations/[slug]/settings/page.tsx`
- Create: `src/app/(dashboard)/organizations/[slug]/settings/client-settings-panel.tsx`

- [ ] **Step 1: Create server page**

Create `src/app/(dashboard)/organizations/[slug]/settings/page.tsx`:

```typescript
import { getOrganizationBySlug } from "@/app/actions/organizations";
import { notFound } from "next/navigation";
import { ClientSettingsPanel } from "./client-settings-panel";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  return (
    <ClientSettingsPanel
      organizationId={organization.id}
      canCustomizeBranding={organization.canCustomizeBranding ?? false}
    />
  );
}
```

Note: `canCustomizeBranding` needs to be added to the `OrganizationWithCounts` type and the `getOrganizationBySlug` query/mapper. Add `can_customize_branding` to the select query and map it in the organization mapper.

- [ ] **Step 2: Create client component**

Create `src/app/(dashboard)/organizations/[slug]/settings/client-settings-panel.tsx`. Zone 1 (immediate toggle):

Key features:
- Single toggle: "Custom Branding" with description text
- Calls `toggleClientBranding(orgId, value)` on change
- Toast confirmation
- Explanatory text below: "Even when disabled, you can still configure branding for this client on the Branding tab."

- [ ] **Step 3: Update organization type and mapper**

Modify `src/app/actions/organizations.ts` — add `can_customize_branding` to the select query in `getOrganizationBySlug`. Add `canCustomizeBranding: row.can_customize_branding ?? false` to the mapper in `mapOrganizationWithCounts`.

- [ ] **Step 4: Verify**

Navigate to `/organizations/{slug}/settings`. Toggle works, toast shows.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/organizations/\[slug\]/settings/ src/app/actions/organizations.ts
git commit -m "feat(entitlements): add client settings tab with branding toggle"
```

---

## Task 8: Campaign UX — Move Access Links

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/overview/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/settings/page.tsx`

- [ ] **Step 1: Add access links to overview page**

In `src/app/(dashboard)/campaigns/[id]/overview/page.tsx`, import and render `CampaignAccessLinks` component below the campaign summary stats. The component needs the `campaign` prop (it already receives it). Add the import and render it in a new section.

```typescript
import { CampaignAccessLinks } from "../settings/campaign-access-links";
```

Add after the stats/progress section, before the timeline:
```tsx
<CampaignAccessLinks campaign={campaign} />
```

- [ ] **Step 2: Add access links to participants page**

In `src/app/(dashboard)/campaigns/[id]/participants/page.tsx`, import and render `CampaignAccessLinks` above the participant manager:

```typescript
import { CampaignAccessLinks } from "../settings/campaign-access-links";
```

Render above `<CampaignParticipantManager>`.

- [ ] **Step 3: Remove access links from settings page**

In `src/app/(dashboard)/campaigns/[id]/settings/page.tsx`, remove the `<CampaignAccessLinks>` render. Keep the import if other code references it, otherwise remove.

- [ ] **Step 4: Move timeline from overview to settings**

In `overview/page.tsx`, remove the timeline section (the opens_at/closes_at display).

In `settings/page.tsx`, add the timeline display above or below the toggles section. This is a simple display of `campaign.opensAt` and `campaign.closesAt` formatted dates.

- [ ] **Step 5: Verify both pages**

Navigate to a campaign's Overview — access links present, no timeline.
Navigate to Participants — access links present above participant list.
Navigate to Settings — timeline present, no access links, toggles and report config still there.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/overview/ src/app/\(dashboard\)/campaigns/\[id\]/participants/ src/app/\(dashboard\)/campaigns/\[id\]/settings/
git commit -m "feat(campaigns): move access links to overview+participants, timeline to settings"
```

---

## Task 9: Portal-Aware Campaign Detail Shell

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`

- [ ] **Step 1: Make shell portal-aware**

Update `campaign-detail-shell.tsx` to:
1. Accept an optional `canCustomizeBranding` prop (for gating the Branding tab in client portal)
2. Use `usePortal()` to detect current portal
3. Filter tabs based on portal context
4. Use `href()` from portal context for link generation instead of hardcoded `/campaigns/...`

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { usePortal } from "@/components/portal-context";
import type { CampaignDetail } from "@/app/actions/campaigns";

const allTabs = [
  { label: "Overview", segment: "overview" },
  { label: "Assessments", segment: "assessments" },
  { label: "Participants", segment: "participants" },
  { label: "Results", segment: "results" },
  { label: "Experience", segment: "experience" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];

const statusVariant: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  closed: "destructive",
  archived: "outline",
};

export function CampaignDetailShell({
  campaign,
  canCustomizeBranding,
  children,
}: {
  campaign: CampaignDetail;
  canCustomizeBranding?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { portal, href } = usePortal();

  const tabs = allTabs.filter((tab) => {
    // Hide branding tab for client portal if not entitled
    if (tab.segment === "branding" && portal === "client" && !canCustomizeBranding) {
      return false;
    }
    return true;
  });

  const activeSegment =
    tabs.find((t) => pathname.endsWith(`/${t.segment}`))?.segment ?? "overview";

  const basePath = href(`/campaigns/${campaign.id}`);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title={campaign.title}
        description={campaign.organizationName}
      >
        <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </Badge>
      </PageHeader>

      <nav className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeSegment === tab.segment;
          return (
            <Link
              key={tab.segment}
              href={`${basePath}/${tab.segment}`}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
```

- [ ] **Step 2: Update campaign layout to pass branding flag**

In `src/app/(dashboard)/campaigns/[id]/layout.tsx`, fetch the org's `can_customize_branding` and pass it to the shell:

```typescript
import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "./campaign-detail-shell";
import { createClient } from "@/lib/supabase/server";

export default async function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  // Fetch branding entitlement for the campaign's org
  let canCustomizeBranding = true; // default true for admin
  if (campaign.organizationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("can_customize_branding")
      .eq("id", campaign.organizationId)
      .single();
    canCustomizeBranding = data?.can_customize_branding ?? false;
  }

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
    >
      {children}
    </CampaignDetailShell>
  );
}
```

- [ ] **Step 3: Verify admin campaign tabs still work**

Navigate to any campaign detail page in admin portal. All 7 tabs should render. Links should still work correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/campaign-detail-shell.tsx src/app/\(dashboard\)/campaigns/\[id\]/layout.tsx
git commit -m "feat(campaigns): make detail shell portal-aware with conditional branding tab"
```

---

## Task 10: Client Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Replace clientNav**

In `src/components/app-sidebar.tsx`, replace the `clientNav` constant (lines 140-164):

```typescript
const clientNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: Home }],
  },
  {
    label: "Assessments",
    items: [
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
];
```

- [ ] **Step 2: Remove settings nav for client portal**

Verify that the `settingsNav` is only shown for `portal === "admin"` (check the `isSettingsArea` condition at line 190). It already only shows for admin — confirm this is correct.

- [ ] **Step 3: Verify sidebar**

Switch to client portal (dev switcher). Sidebar should show: Dashboard, Campaigns, Participants. No diagnostics, no platform settings.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(client-portal): update sidebar nav to dashboard, campaigns, participants"
```

---

## Task 11: Client Dashboard

**Files:**
- Create: `src/app/client/dashboard/page.tsx`
- Create: `src/app/client/dashboard/client-dashboard.tsx`

- [ ] **Step 1: Create server page**

Create `src/app/client/dashboard/page.tsx`:

```typescript
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { redirect } from "next/navigation";
import { getCampaigns } from "@/app/actions/campaigns";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
import { ClientDashboard } from "./client-dashboard";

export default async function ClientDashboardPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/dashboard");
  if (access.status !== "ok") redirect("/unauthorized");

  const orgId = access.activeContext?.tenantId;
  if (!orgId) redirect("/unauthorized");

  const [campaigns, assignments] = await Promise.all([
    getCampaigns(),
    getAssessmentAssignments(orgId),
  ]);

  return (
    <ClientDashboard
      campaigns={campaigns}
      assessmentAssignments={assignments}
    />
  );
}
```

- [ ] **Step 2: Create client component**

Create `src/app/client/dashboard/client-dashboard.tsx`:

Key features:
- Summary stats row: Active campaigns count, Total participants, Completed, Reports ready
- Active campaigns list with progress
- Assessment usage table (compact, at bottom) with remaining/unlimited and mini progress bars
- Follow CLAUDE.md patterns: `ScrollReveal`, `PageHeader` with eyebrow, proper dark/light mode

- [ ] **Step 3: Verify dashboard**

Switch to client portal, navigate to `/client/dashboard`. Stats render, campaigns show.

- [ ] **Step 4: Commit**

```bash
git add src/app/client/dashboard/
git commit -m "feat(client-portal): add client dashboard with stats and usage overview"
```

---

## Task 12: Client Global Participants

**Files:**
- Create: `src/app/client/participants/page.tsx`
- Create: `src/app/client/participants/global-participants.tsx`

- [ ] **Step 1: Create server page**

Create `src/app/client/participants/page.tsx`:

```typescript
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { redirect } from "next/navigation";
import { GlobalParticipants } from "./global-participants";

export default async function ClientParticipantsPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/participants");
  if (access.status !== "ok") redirect("/unauthorized");

  const orgId = access.activeContext?.tenantId;
  if (!orgId) redirect("/unauthorized");

  return <GlobalParticipants organizationId={orgId} />;
}
```

- [ ] **Step 2: Create client component**

Create `src/app/client/participants/global-participants.tsx`:

Key features:
- Fetches all participants across all campaigns for this org (new server action needed: `getParticipantsForOrganization`)
- Table with: Name, Email, Campaign, Status badge, Report link
- Search by name/email (client-side filter)
- Filter by campaign (dropdown)
- Filter by status (dropdown)
- PageHeader with eyebrow "Participants"

Add a new server action `getParticipantsForOrganization(orgId)` to `src/app/actions/campaigns.ts` that joins `campaign_participants` with `campaigns` filtered by `organization_id`.

- [ ] **Step 3: Verify**

Navigate to `/client/participants`. Table renders with cross-campaign participants.

- [ ] **Step 4: Commit**

```bash
git add src/app/client/participants/ src/app/actions/campaigns.ts
git commit -m "feat(client-portal): add global participants view across all campaigns"
```

---

## Task 13: Client Campaign List & Create

**Files:**
- Create: `src/app/client/campaigns/page.tsx`
- Create: `src/app/client/campaigns/create/page.tsx`

- [ ] **Step 1: Create campaign list page**

Create `src/app/client/campaigns/page.tsx`:

```typescript
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { redirect } from "next/navigation";
import { getCampaigns } from "@/app/actions/campaigns";
// Reuse the admin campaign list component or create a thin wrapper
// The getCampaigns() action already scopes by org via auth context

export default async function ClientCampaignsPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/campaigns");
  if (access.status !== "ok") redirect("/unauthorized");

  const campaigns = await getCampaigns();

  // Render campaign list — reuse existing campaign list component
  // with portal-aware links (href() from usePortal)
  // ...
}
```

The campaign list component needs portal-aware links. Either modify the existing list component to use `usePortal().href()` or create a thin client wrapper.

- [ ] **Step 2: Create campaign create page**

Create `src/app/client/campaigns/create/page.tsx`:

Similar to admin create page but:
- `organizationId` is automatically set from auth context (not selectable)
- Uses the same `CampaignForm` component
- Redirects to `/client/campaigns/{id}/overview` after creation

- [ ] **Step 3: Verify**

Navigate to `/client/campaigns`. List shows org-scoped campaigns. "Create" works and redirects correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/client/campaigns/page.tsx src/app/client/campaigns/create/
git commit -m "feat(client-portal): add client campaign list and create pages"
```

---

## Task 14: Client Campaign Detail Pages

**Files:**
- Create: `src/app/client/campaigns/[id]/layout.tsx`
- Create: `src/app/client/campaigns/[id]/page.tsx`
- Create: `src/app/client/campaigns/[id]/overview/page.tsx`
- Create: `src/app/client/campaigns/[id]/assessments/page.tsx`
- Create: `src/app/client/campaigns/[id]/participants/page.tsx`
- Create: `src/app/client/campaigns/[id]/results/page.tsx`
- Create: `src/app/client/campaigns/[id]/experience/page.tsx`
- Create: `src/app/client/campaigns/[id]/branding/page.tsx`
- Create: `src/app/client/campaigns/[id]/settings/page.tsx`

- [ ] **Step 1: Create layout**

Create `src/app/client/campaigns/[id]/layout.tsx`:

```typescript
import { getCampaignById } from "@/app/actions/campaigns";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { notFound, redirect } from "next/navigation";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ClientCampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const access = await resolveWorkspaceAccess("client");
  if (access.status !== "ok") redirect("/unauthorized");

  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  let canCustomizeBranding = false;
  if (campaign.organizationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("can_customize_branding")
      .eq("id", campaign.organizationId)
      .single();
    canCustomizeBranding = data?.can_customize_branding ?? false;
  }

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
    >
      {children}
    </CampaignDetailShell>
  );
}
```

- [ ] **Step 2: Create redirect page**

Create `src/app/client/campaigns/[id]/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default async function ClientCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/campaigns/${id}/overview`);
}
```

- [ ] **Step 3: Create tab pages**

Each client tab page is a thin server component that delegates to shared components from the admin portal, with client-specific restrictions:

**overview/page.tsx** — Reuse admin overview components. Include access links section.

**assessments/page.tsx** — Like admin but filter available assessments to assigned only. Use `getAvailableAssessmentsForClient(orgId)` to get the filtered list. Show quota indicators per assessment.

**participants/page.tsx** — Reuse admin participant manager. Add access links section. Add quota warning banner using `checkQuotaAvailability()`.

**results/page.tsx** — Reuse admin results view. Filter report template options to assigned templates using `getAvailableReportTemplateIds(orgId)`. No report config panel.

**experience/page.tsx** — Identical to admin. Reuse components directly.

**branding/page.tsx** — Same as admin campaign branding page. Only reachable if `can_customize_branding` is true (tab hidden otherwise by shell).

**settings/page.tsx** — Toggles + timeline only. No report config panel. Use `usePortal()` to conditionally exclude `ReportConfigPanel`.

- [ ] **Step 4: Verify all tabs**

Navigate through each tab in client portal for an existing campaign. Verify:
- Overview: stats + access links, no timeline
- Assessments: only assigned assessments shown
- Participants: list + access links + quota warnings
- Results: reports with filtered template options
- Experience: works identically to admin
- Branding: only visible if entitled
- Settings: toggles + timeline, no report config

- [ ] **Step 5: Commit**

```bash
git add src/app/client/campaigns/
git commit -m "feat(client-portal): add all client campaign detail tab pages"
```

---

## Task 15: Quota Enforcement in Server Actions

**Files:**
- Modify: `src/app/actions/campaigns.ts` (inviteParticipant)
- Modify: `src/app/actions/assess.ts` (registerViaLink)

- [ ] **Step 1: Write failing test for quota check in invite**

Create or extend `tests/unit/campaign-quota.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock checkQuotaAvailability
const entitlements = vi.hoisted(() => ({
  checkQuotaAvailability: vi.fn(),
}));
vi.mock("@/app/actions/client-entitlements", () => entitlements);

// Mock other deps...

describe("inviteParticipant quota enforcement", () => {
  it("rejects invite when quota is exhausted", async () => {
    entitlements.checkQuotaAvailability.mockResolvedValueOnce({
      allowed: false,
      violations: [{ assessmentId: "a1", quotaLimit: 10, quotaUsed: 10 }],
    });

    // ... invoke inviteParticipant and expect error
  });

  it("allows invite when quota has capacity", async () => {
    entitlements.checkQuotaAvailability.mockResolvedValueOnce({
      allowed: true,
      violations: [],
    });

    // ... invoke inviteParticipant and expect success
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run tests/unit/campaign-quota.test.ts`
Expected: FAIL — quota check not yet integrated.

- [ ] **Step 3: Add quota check to inviteParticipant**

In `src/app/actions/campaigns.ts`, in the `inviteParticipant` function, after the auth check and before the insert:

```typescript
import { checkQuotaAvailability } from "@/app/actions/client-entitlements";

// Inside inviteParticipant, after requireCampaignAccess:
if (organizationId) {
  // Get assessment IDs for this campaign
  const { data: campaignAssessments } = await supabase
    .from("campaign_assessments")
    .select("assessment_id")
    .eq("campaign_id", campaignId);

  const assessmentIds = (campaignAssessments ?? []).map(
    (ca) => ca.assessment_id
  );

  if (assessmentIds.length > 0) {
    const quota = await checkQuotaAvailability(organizationId, assessmentIds);
    if (!quota.allowed) {
      return {
        error: {
          _form: [
            `Assessment quota reached. Cannot invite more participants.`,
          ],
        },
      };
    }
  }
}
```

- [ ] **Step 4: Add quota check to registerViaLink**

In `src/app/actions/assess.ts`, in the `registerViaLink` function, add a similar check before creating the participant. For access link registration, use a user-friendly error: "This campaign is currently full."

- [ ] **Step 5: Run tests — verify they pass**

Run: `npx vitest run tests/unit/campaign-quota.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/campaigns.ts src/app/actions/assess.ts tests/unit/campaign-quota.test.ts
git commit -m "feat(entitlements): enforce assessment quotas on participant invite and access link registration"
```

---

## Task 16: Assessment & Report Filtering for Client Portal

**Files:**
- Modify: `src/app/actions/campaigns.ts` (addAssessmentToCampaign)

- [ ] **Step 1: Write failing test for assessment restriction**

```typescript
describe("addAssessmentToCampaign client restriction", () => {
  it("rejects unassigned assessments for client portal", async () => {
    // Mock: client portal context, assessment not in assignments
    // Expect: error about assessment not being available
  });
});
```

- [ ] **Step 2: Add client restriction to addAssessmentToCampaign**

In `src/app/actions/campaigns.ts`, in `addAssessmentToCampaign`, after the auth check:

```typescript
// Check if this is a client portal request and enforce entitlements
if (!scope.isPlatformAdmin && organizationId) {
  const { data: assignment } = await supabase
    .from("client_assessment_assignments")
    .select("id, is_active")
    .eq("organization_id", organizationId)
    .eq("assessment_id", assessmentId)
    .eq("is_active", true)
    .single();

  if (!assignment) {
    return { error: "This assessment is not available for your organization" };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/campaign-quota.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/campaigns.ts tests/unit/campaign-quota.test.ts
git commit -m "feat(entitlements): restrict assessment attachment to assigned assessments for client portal"
```

---

## Task 17: Clean Up Catch-All Routes

**Files:**
- Modify: `src/app/client/[[...slug]]/page.tsx`
- Modify: `src/lib/workspace-portal-config.ts`

- [ ] **Step 1: Update workspace portal config**

Remove the now-replaced page configs from `clientPortalPages` in `workspace-portal-config.ts`:
- Remove `campaigns`, `assessments`, `results`, `diagnostics`, `diagnostic-results` keys
- Keep the root `""` key as a fallback

- [ ] **Step 2: Verify catch-all doesn't conflict**

The catch-all `[[...slug]]` route should only match paths that don't have discrete route files. Since we've created `/client/dashboard/`, `/client/campaigns/`, and `/client/participants/`, Next.js will prefer the specific routes. The catch-all becomes a fallback for any unrecognized paths.

Verify by navigating to:
- `/client/dashboard` → should hit the dashboard page (not catch-all)
- `/client/campaigns` → should hit campaigns list (not catch-all)
- `/client/participants` → should hit participants page (not catch-all)
- `/client/unknown` → should hit catch-all (404 or placeholder)

- [ ] **Step 3: Commit**

```bash
git add src/app/client/ src/lib/workspace-portal-config.ts
git commit -m "refactor(client-portal): update catch-all to coexist with discrete routes"
```

---

## Verification Checklist

After all tasks are complete, verify end-to-end:

- [ ] **Admin flow**: Create an org → Assign assessments with quotas → Assign report templates → Toggle branding → Verify all tabs on org detail page
- [ ] **Client portal**: Switch to client portal → Dashboard shows stats and usage → Create a campaign → Add assigned assessments only → Invite participants → Verify quota enforcement → View results → Generate reports with assigned templates only
- [ ] **Quota enforcement**: Exhaust a quota → Verify invite is blocked → Withdraw a participant (before start) → Verify credit returned → Verify invite works again
- [ ] **Branding gate**: Toggle off branding → Client campaign detail has no Branding tab → Toggle on → Tab appears
- [ ] **Access links**: Verify access links appear on Overview and Participants pages, not on Settings
- [ ] **Both portals**: Verify campaign UX changes (access links, timeline) work on both admin and client portals
