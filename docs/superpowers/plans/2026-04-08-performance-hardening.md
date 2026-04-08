# Performance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant auth resolution, collapse N+1 loaders, add safe cross-request caching, reduce client hydration, and make marketing static-first — targeting warm TTFB under 300ms for workspace list pages.

**Architecture:** One request-scoped bootstrap resolves auth/brand/context once per request via React `cache()`. Cross-request caching via `unstable_cache` only for read-mostly tenant-level data (brand, reference lists). Campaign detail owned by layout, passed to child pages. Marketing converted from full `"use client"` root to server-rendered page with client islands.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres), `unstable_cache`, React `cache()`, CSS animations (tw-animate-css)

---

## Phase 1: Server-Side Performance (Tasks 1–6)

### Task 1: Create the Workspace Bootstrap

The current architecture calls `resolveAuthorizedScope()` twice per request (once in the layout auth gate, once in `WorkspaceShell` via `getWorkspaceContextOptions()`), and calls `resolveSessionActor()` separately a third time. This task consolidates all of that into a single request-scoped memoized bootstrap.

**Files:**
- Create: `src/lib/auth/workspace-bootstrap.ts`
- Modify: `src/lib/auth/types.ts` (add `WorkspaceBootstrap` type)
- Test: `tests/unit/workspace-bootstrap.test.ts`

**Background — React `cache()`:** In Next.js App Router, `React.cache()` deduplicates calls within a single server request. If two server components call the same `cache()`-wrapped function with the same arguments during the same request, the function body runs once. This is request-scoped only — no cross-request sharing. Import it as `import { cache } from "react"`.

#### Step-by-step

- [ ] **Step 1: Add WorkspaceBootstrap type**

Add the following to `src/lib/auth/types.ts`:

```typescript
import type { PortalType } from "@/components/portal-context";
import type { WorkspaceContextOption } from "@/lib/auth/workspace-access";
import type { BrandConfig } from "@/lib/brand/types";

export interface WorkspaceBootstrap {
  actor: ResolvedActor | null;
  scope: import("@/lib/auth/authorization").AuthorizedScope;
  portal: PortalType;
  routePrefix: string;
  isLocalDev: boolean;
  sidebarDefaultOpen: boolean;
  workspaceContextOptions: WorkspaceContextOption[];
  brandConfig: BrandConfig;
  supportSessionInfo: SupportSessionInfo | null;
}

export interface SupportSessionInfo {
  sessionId: string;
  tenantName: string;
  tenantType: "client" | "partner";
  actorName: string;
  returnUrl: string;
}
```

- [ ] **Step 2: Create workspace-bootstrap.ts**

Create `src/lib/auth/workspace-bootstrap.ts`:

```typescript
import { cache } from "react";
import { cookies } from "next/headers";
import { resolveAuthorizedScope } from "@/lib/auth/authorization";
import { getWorkspaceContextOptions } from "@/lib/auth/workspace-access";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSurfaceUrl } from "@/lib/hosts";
import type { PortalType } from "@/components/portal-context";
import type { WorkspaceBootstrap, SupportSessionInfo } from "@/lib/auth/types";

async function resolveSupportSessionInfo(
  actor: NonNullable<WorkspaceBootstrap["actor"]>,
  portal: PortalType
): Promise<SupportSessionInfo | null> {
  if (portal === "admin") return null;

  const supportSessionId = actor.activeContext?.supportSessionId;
  if (!supportSessionId || actor.role !== "platform_admin") return null;

  const db = createAdminClient();
  const { data: session } = await db
    .from("support_sessions")
    .select("id, target_surface, partner_id, client_id")
    .eq("id", supportSessionId)
    .eq("actor_profile_id", actor.id)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) return null;

  const targetSurface = session.target_surface as "client" | "partner";
  if (targetSurface !== portal) return null;

  const tenantId =
    targetSurface === "partner"
      ? String(session.partner_id)
      : String(session.client_id);

  const table = targetSurface === "partner" ? "partners" : "clients";
  const { data: tenant } = await db
    .from(table)
    .select("name, slug")
    .eq("id", tenantId)
    .single();

  if (!tenant) return null;

  const adminPath =
    targetSurface === "client"
      ? `/clients/${tenant.slug}/overview`
      : `/partners/${tenant.slug}/edit`;

  const adminUrl = buildSurfaceUrl("admin", adminPath);

  return {
    sessionId: String(session.id),
    tenantName: String(tenant.name),
    tenantType: targetSurface,
    actorName: actor.displayName ?? actor.email,
    returnUrl: adminUrl?.toString() ?? "/",
  };
}

/**
 * Request-scoped workspace bootstrap.
 *
 * Resolves auth, brand, context options, and support session info
 * exactly once per request via React cache(). Every workspace layout
 * and the WorkspaceShell should call this instead of independently
 * calling resolveAuthorizedScope / resolveSessionActor / getEffectiveBrand.
 */
export const getWorkspaceBootstrap = cache(
  async (portal: PortalType): Promise<WorkspaceBootstrap> => {
    const [cookieStore, { routePrefix, isLocalDev }] = await Promise.all([
      cookies(),
      getWorkspaceRequestContext(portal),
    ]);

    const sidebarDefaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

    const scope = await resolveAuthorizedScope();

    const [brandConfig, workspaceContextOptions] = await Promise.all([
      getEffectiveBrand(),
      portal === "admin" ? Promise.resolve([]) : getWorkspaceContextOptions(portal),
    ]);

    const supportSessionInfo =
      scope.actor && portal !== "admin"
        ? await resolveSupportSessionInfo(scope.actor, portal)
        : null;

    return {
      actor: scope.actor,
      scope,
      portal,
      routePrefix,
      isLocalDev,
      sidebarDefaultOpen,
      workspaceContextOptions,
      brandConfig,
      supportSessionInfo,
    };
  }
);
```

**Key design decisions:**
- `resolveSupportSessionInfo` is moved here from `workspace-shell.tsx` (it was an internal function there). The shell version is now dead code.
- `getWorkspaceContextOptions` internally calls `resolveAuthorizedScope()` — but since `resolveAuthorizedScope` is not yet `cache()`-wrapped, this is still a duplicate call. Step 3 addresses that.
- `cookies()` is read once at bootstrap entry.

- [ ] **Step 3: Wrap `resolveAuthorizedScope` in React `cache()`**

In `src/lib/auth/authorization.ts`, wrap the exported function:

```typescript
import { cache } from "react";

// Rename existing function to impl:
async function resolveAuthorizedScopeImpl(): Promise<AuthorizedScope> {
  // ... existing body unchanged ...
}

export const resolveAuthorizedScope = cache(resolveAuthorizedScopeImpl);
```

This makes every call to `resolveAuthorizedScope()` within the same request return the same memoized result. The internal calls from `getWorkspaceContextOptions`, `requireClientAccess`, `requirePartnerAccess`, etc. all benefit automatically.

**Also wrap `resolveSessionActor()`** in `src/lib/auth/actor.ts`:

```typescript
import { cache } from "react";

async function resolveSessionActorImpl(): Promise<ResolvedActor | null> {
  // ... existing body unchanged ...
}

export const resolveSessionActor = cache(resolveSessionActorImpl);
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `npx vitest run tests/unit/authorization-rules.test.ts tests/integration/tenant-isolation.test.ts -v`
Expected: All existing tests pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/workspace-bootstrap.ts src/lib/auth/types.ts src/lib/auth/authorization.ts src/lib/auth/actor.ts
git commit -m "feat: add request-scoped workspace bootstrap with React cache()"
```

---

### Task 2: Consume Bootstrap in Layouts and Shell

Replace the duplicated auth/brand/context resolution in all three portal layouts and the `WorkspaceShell` with the single bootstrap.

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/partner/layout.tsx`
- Modify: `src/app/client/layout.tsx`
- Modify: `src/components/workspace-shell.tsx`

#### Step-by-step

- [ ] **Step 1: Refactor admin layout**

Replace `src/app/(dashboard)/layout.tsx` to use bootstrap:

```typescript
import { redirect } from "next/navigation";
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bootstrap = await getWorkspaceBootstrap("admin");

  if (!bootstrap.actor && !bootstrap.isLocalDev) {
    redirect("/login?next=/");
  }

  if (!bootstrap.scope.isPlatformAdmin && !bootstrap.isLocalDev) {
    return (
      <EmptyState
        title="This is restricted to platform admin"
        description="You do not have permission to access this area."
      />
    );
  }

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>
        {children}
      </WorkspaceShell>
    </SessionActivityProvider>
  );
}
```

- [ ] **Step 2: Refactor partner layout**

Replace `src/app/partner/layout.tsx`:

```typescript
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bootstrap = await getWorkspaceBootstrap("partner");

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>
        {children}
      </WorkspaceShell>
    </SessionActivityProvider>
  );
}
```

- [ ] **Step 3: Refactor client layout**

Same pattern — replace `src/app/client/layout.tsx`:

```typescript
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bootstrap = await getWorkspaceBootstrap("client");

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>
        {children}
      </WorkspaceShell>
    </SessionActivityProvider>
  );
}
```

- [ ] **Step 4: Refactor WorkspaceShell to accept bootstrap prop**

Rewrite `src/components/workspace-shell.tsx` to receive the pre-resolved bootstrap instead of fetching its own data. The shell no longer calls `getEffectiveBrand()`, `getWorkspaceContextOptions()`, `resolveSessionActor()`, or its internal `resolveSupportSessionInfo()`. All data arrives via the `bootstrap` prop. Delete the old `resolveSupportSessionInfo` function and the old `WorkspaceShellProps` interface.

```typescript
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalProvider } from "@/components/portal-context";
import { DashboardHeader } from "@/components/dashboard-header";
import { CommandPalette } from "@/components/command-palette";
import { PageTransition } from "@/components/page-transition";
import { WorkspaceContextSwitcher } from "@/components/workspace-context-switcher";
import { AccountMenu } from "@/components/auth/account-menu";
import { SupportSessionBanner } from "@/components/support-session-banner";
import { generateDashboardCSS } from "@/lib/brand/tokens";
import { headers } from "next/headers";
import { logSupportSessionPageView } from "@/app/actions/enter-portal";
import type { WorkspaceBootstrap } from "@/lib/auth/types";

interface WorkspaceShellProps {
  children: React.ReactNode;
  bootstrap: WorkspaceBootstrap;
}

export async function WorkspaceShell({
  children,
  bootstrap,
}: WorkspaceShellProps) {
  const {
    actor,
    portal,
    routePrefix,
    isLocalDev,
    sidebarDefaultOpen,
    workspaceContextOptions,
    brandConfig,
    supportSessionInfo,
  } = bootstrap;

  const dashboardCSS = generateDashboardCSS(brandConfig);

  if (supportSessionInfo && actor) {
    const headerStore = await headers();
    const requestRoutePrefix = headerStore.get("x-trajectas-route-prefix");
    const path =
      requestRoutePrefix && requestRoutePrefix !== "/"
        ? requestRoutePrefix
        : `/${portal}`;

    logSupportSessionPageView(
      supportSessionInfo.sessionId,
      actor.id,
      path
    ).catch(() => {});
  }

  return (
    <PortalProvider
      initialPortal={portal}
      routePrefix={routePrefix}
      canSwitchPortal={isLocalDev}
    >
      {/* Brand CSS is generated server-side from sanitized config values */}
      <style
        dangerouslySetInnerHTML={{ __html: dashboardCSS }}
      />
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar />
        <SidebarInset>
          {supportSessionInfo && (
            <SupportSessionBanner
              sessionId={supportSessionInfo.sessionId}
              tenantName={supportSessionInfo.tenantName}
              tenantType={supportSessionInfo.tenantType}
              actorName={supportSessionInfo.actorName}
              returnUrl={supportSessionInfo.returnUrl}
            />
          )}
          <div className="ambient-glow" />
          <a href="#main-content" className="skip-to-content">
            Skip to content
          </a>
          <DashboardHeader
            accountControl={
              actor ? (
                <AccountMenu
                  email={actor.email}
                  displayName={actor.displayName}
                />
              ) : null
            }
            workspaceControls={
              portal === "admin" ||
              workspaceContextOptions.length === 0 ? null : (
                <WorkspaceContextSwitcher
                  surface={portal}
                  options={workspaceContextOptions}
                />
              )
            }
          />
          <main
            id="main-content"
            className="flex-1 overflow-auto p-4 md:p-6 lg:p-8"
          >
            <div className="mx-auto max-w-7xl">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
          <CommandPalette />
        </SidebarInset>
      </SidebarProvider>
    </PortalProvider>
  );
}
```

- [ ] **Step 5: Build check**

Run: `npx next build 2>&1 | tail -30`
Expected: Successful build with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx src/app/partner/layout.tsx src/app/client/layout.tsx src/components/workspace-shell.tsx
git commit -m "refactor: consume workspace bootstrap in all layouts and shell"
```

---

### Task 3: Add Bulk Quota Usage DB Function

Replace the N+1 quota RPC loop (`get_assessment_quota_usage` called per row) with a single set-based function.

**Files:**
- Create: `supabase/migrations/NNNN_bulk_quota_usage.sql` (use next migration number)
- Modify: `src/app/actions/client-entitlements.ts`
- Test: Manual verification via `npx supabase db reset` + existing test

**Background:** The current `get_assessment_quota_usage(p_client_id, p_assessment_id)` returns one `INT`. It's called in a loop — once per assessment assignment. The new `get_client_assessment_quota_usage_bulk(p_client_id)` returns a set of rows so all quotas resolve in one round trip.

#### Step-by-step

- [ ] **Step 1: Determine next migration number**

Run: `ls supabase/migrations/ | tail -5`
Use the next sequential number (e.g., if latest is `00082_...`, use `00083`).

- [ ] **Step 2: Create migration**

Create `supabase/migrations/NNNN_bulk_quota_usage.sql`:

```sql
-- Bulk quota usage for a client: returns one row per assessment
-- with the count of quota-consuming participants.
CREATE OR REPLACE FUNCTION get_client_assessment_quota_usage_bulk(p_client_id UUID)
RETURNS TABLE (assessment_id UUID, quota_used INT) AS $$
  SELECT
    ca.assessment_id,
    COALESCE(COUNT(cp.id)::INT, 0) AS quota_used
  FROM campaign_assessments ca
  JOIN campaigns c ON c.id = ca.campaign_id
  LEFT JOIN campaign_participants cp
    ON cp.campaign_id = c.id
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
  WHERE c.client_id = p_client_id
    AND c.deleted_at IS NULL
  GROUP BY ca.assessment_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_client_assessment_quota_usage_bulk IS
  'Returns quota usage counts for all assessments belonging to a client in a single query.';

-- Partner-level bulk equivalent
CREATE OR REPLACE FUNCTION get_partner_assessment_quota_usage_bulk(p_partner_id UUID)
RETURNS TABLE (assessment_id UUID, quota_used INT) AS $$
  SELECT
    ca.assessment_id,
    COALESCE(COUNT(cp.id)::INT, 0) AS quota_used
  FROM campaign_assessments ca
  JOIN campaigns c ON c.id = ca.campaign_id
  LEFT JOIN campaign_participants cp
    ON cp.campaign_id = c.id
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
  WHERE c.partner_id = p_partner_id
    AND c.deleted_at IS NULL
  GROUP BY ca.assessment_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_partner_assessment_quota_usage_bulk IS
  'Returns quota usage counts for all assessments under a partner in a single query.';
```

- [ ] **Step 3: Apply migration locally**

Run: `npx supabase db reset`
Expected: Migration applies without error.

- [ ] **Step 4: Rewrite `getAssessmentAssignments` to use bulk function**

In `src/app/actions/client-entitlements.ts`, replace the N+1 loop (lines ~44-75):

```typescript
export async function getAssessmentAssignments(
  clientId: string,
): Promise<AssessmentAssignmentWithUsage[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  // Parallel: fetch assignments and all quota usage in two queries
  const [assignmentResult, usageResult] = await Promise.all([
    db
      .from('client_assessment_assignments')
      .select('*, assessments(title)')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    db.rpc('get_client_assessment_quota_usage_bulk', { p_client_id: clientId }),
  ])

  if (assignmentResult.error) {
    throwActionError(
      'getAssessmentAssignments',
      'Unable to load assessment assignments.',
      assignmentResult.error
    )
  }
  if (usageResult.error) {
    throwActionError(
      'getAssessmentAssignments.quotaUsage',
      'Unable to load assessment quota usage.',
      usageResult.error
    )
  }

  if (!assignmentResult.data || assignmentResult.data.length === 0) return []

  // Build a lookup map: assessment_id -> quota_used
  const usageMap = new Map<string, number>()
  for (const row of usageResult.data ?? []) {
    usageMap.set(String(row.assessment_id), row.quota_used)
  }

  return assignmentResult.data.map((row) => {
    const assessmentRecord = Array.isArray(row.assessments)
      ? row.assessments[0]
      : row.assessments
    const assessmentName =
      (assessmentRecord as Record<string, unknown>)?.title ?? 'Unknown'

    return {
      ...mapClientAssessmentAssignmentRow(row),
      assessmentName: String(assessmentName),
      quotaUsed: usageMap.get(String(row.assessment_id)) ?? 0,
    }
  })
}
```

- [ ] **Step 5: Rewrite `checkQuotaAvailability` to use bulk functions**

Replace the entire function body (lines ~135-231) with:

```typescript
export async function checkQuotaAvailability(
  clientId: string,
  assessmentIds: string[],
): Promise<{
  allowed: boolean
  violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[]
}> {
  await requireClientAccess(clientId)

  if (assessmentIds.length === 0) {
    return { allowed: true, violations: [] }
  }

  const db = await createClient()

  // Parallel: fetch client assignments, client quota usage, and partner id
  const [assignmentsResult, clientUsageResult, clientForPartnerResult] = await Promise.all([
    db
      .from('client_assessment_assignments')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .in('assessment_id', assessmentIds),
    db.rpc('get_client_assessment_quota_usage_bulk', { p_client_id: clientId }),
    db.from('clients').select('partner_id').eq('id', clientId).single(),
  ])

  if (assignmentsResult.error) {
    throwActionError(
      'checkQuotaAvailability.assignments',
      'Unable to validate assessment quota.',
      assignmentsResult.error
    )
  }
  if (clientUsageResult.error) {
    throwActionError(
      'checkQuotaAvailability.clientUsage',
      'Unable to validate assessment quota.',
      clientUsageResult.error
    )
  }

  // Build client usage map: assessment_id -> quota_used
  const clientUsageMap = new Map<string, number>()
  for (const row of clientUsageResult.data ?? []) {
    clientUsageMap.set(String(row.assessment_id), row.quota_used)
  }

  const violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[] = []

  // Check client-level quota violations
  for (const row of assignmentsResult.data ?? []) {
    if (row.quota_limit === null) continue
    const quotaUsed = clientUsageMap.get(String(row.assessment_id)) ?? 0
    if (quotaUsed >= row.quota_limit) {
      violations.push({
        assessmentId: row.assessment_id,
        quotaLimit: row.quota_limit,
        quotaUsed,
      })
    }
  }

  // Partner-level quota check
  const partnerId = clientForPartnerResult.data?.partner_id
  if (partnerId) {
    // Parallel: fetch partner assignments for requested assessments + bulk usage
    const [partnerAssignmentsResult, partnerUsageResult] = await Promise.all([
      db
        .from('partner_assessment_assignments')
        .select('assessment_id, quota_limit')
        .eq('partner_id', partnerId)
        .eq('is_active', true)
        .in('assessment_id', assessmentIds),
      db.rpc('get_partner_assessment_quota_usage_bulk', { p_partner_id: partnerId }),
    ])

    if (partnerAssignmentsResult.error) {
      throwActionError(
        'checkQuotaAvailability.partnerAssignments',
        'Unable to validate partner assessment quota.',
        partnerAssignmentsResult.error
      )
    }
    if (partnerUsageResult.error) {
      throwActionError(
        'checkQuotaAvailability.partnerUsage',
        'Unable to validate partner assessment quota.',
        partnerUsageResult.error
      )
    }

    // Build partner usage map: assessment_id -> quota_used
    const partnerUsageMap = new Map<string, number>()
    for (const row of partnerUsageResult.data ?? []) {
      partnerUsageMap.set(String(row.assessment_id), row.quota_used)
    }

    for (const partnerAssignment of partnerAssignmentsResult.data ?? []) {
      if (partnerAssignment.quota_limit == null) continue
      const quotaUsed = partnerUsageMap.get(String(partnerAssignment.assessment_id)) ?? 0
      if (quotaUsed >= partnerAssignment.quota_limit) {
        violations.push({
          assessmentId: partnerAssignment.assessment_id,
          quotaLimit: partnerAssignment.quota_limit,
          quotaUsed,
        })
      }
    }
  }

  return { allowed: violations.length === 0, violations }
}
```

**What changed vs the original:**
- Client quota: single bulk RPC replaces N per-row RPCs
- Partner quota: single `partner_assessment_assignments` set-query replaces N single-row lookups; single `get_partner_assessment_quota_usage_bulk` RPC replaces N per-assessment RPCs
- `partner_id` lookup runs in parallel with the first two queries
- Partner assignments and partner bulk usage run in parallel with each other

- [ ] **Step 6: Run existing tests**

Run: `npx vitest run tests/unit/client-entitlements.test.ts -v`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/ src/app/actions/client-entitlements.ts
git commit -m "perf: replace N+1 quota RPCs with bulk functions"
```

---

### Task 4: Deduplicate Campaign Detail Loading

The campaign detail layout fetches `getCampaignById(id)`, and then every child page (`overview`, `participants`, `assessments`, `settings`, `results`, `experience`, `branding`) calls `getCampaignById(id)` again. That's 8 calls for the same data in one request. Fix: wrap `getCampaignById` in `React.cache()` and fold the `can_customize_branding` lookup into a cached helper.

**Files:**
- Modify: `src/app/actions/campaigns.ts` (wrap in `cache()`)
- Modify: `src/app/(dashboard)/campaigns/[id]/layout.tsx` (cache branding query)

#### Step-by-step

- [ ] **Step 1: Find and read getCampaignById**

Read `src/app/actions/campaigns.ts` and locate the `getCampaignById` function.

- [ ] **Step 2: Wrap getCampaignById in React cache()**

```typescript
import { cache } from "react";

// Rename existing function:
async function getCampaignByIdImpl(id: string) {
  // ... existing body unchanged ...
}

export const getCampaignById = cache(getCampaignByIdImpl);
```

This makes all 8 calls within the same request resolve to a single execution. The layout call runs first, and the child page calls return the cached result.

- [ ] **Step 3: Cache can_customize_branding in campaign layout**

In `src/app/(dashboard)/campaigns/[id]/layout.tsx`, wrap the extra branding query:

```typescript
import { cache } from "react";
import { getCampaignById } from "@/app/actions/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "./campaign-detail-shell";

const getCanCustomizeBranding = cache(async (clientId: string | null) => {
  if (!clientId) return true;
  const db = createAdminClient();
  const { data } = await db
    .from("clients")
    .select("can_customize_branding")
    .eq("id", clientId)
    .single();
  return data?.can_customize_branding ?? false;
});

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

  const canCustomizeBranding = await getCanCustomizeBranding(campaign.clientId);

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

- [ ] **Step 4: Build check**

Run: `npx next build 2>&1 | tail -30`
Expected: Successful build.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/campaigns.ts "src/app/(dashboard)/campaigns/[id]/layout.tsx"
git commit -m "perf: deduplicate campaign detail loading via React cache()"
```

---

### Task 5: Add Cross-Request Caching for Brand Resolution

Brand config changes rarely (only on explicit admin save). Wrap brand reads in `unstable_cache` with tag-based invalidation.

**Files:**
- Modify: `src/app/actions/brand.ts`
- Modify: `src/lib/auth/workspace-bootstrap.ts`

**Background — `unstable_cache`:** In Next.js 16, `unstable_cache` is the non-Cache-Components way to cache across requests. It takes: `(fn, keyParts, options)`. The `tags` option enables `revalidateTag()` invalidation. **Important:** You cannot call `cookies()` or `headers()` inside an `unstable_cache` callback — all request-dependent values must be passed as arguments (which become the cache key).

#### Step-by-step

- [ ] **Step 1: Add cached brand helpers**

In `src/app/actions/brand.ts`, add cached wrappers below the existing read functions:

```typescript
import { unstable_cache, revalidateTag } from 'next/cache'

/**
 * Cached effective brand resolution.
 * Safe to cache cross-request because brand data is not user-specific.
 */
export const getCachedEffectiveBrand = unstable_cache(
  async (clientId?: string | null, campaignId?: string | null) => {
    return getEffectiveBrand(clientId, campaignId)
  },
  ['effective-brand'],
  { revalidate: 300, tags: ['brand'] }
)
```

- [ ] **Step 2: Add tag invalidation to write functions**

In `upsertBrandConfig` and `resetBrandToDefault`, add after existing `revalidatePath` calls:

```typescript
revalidateTag('brand')
```

- [ ] **Step 3: Verify cache safety, then update bootstrap to use cached brand**

**Before changing the import**, read `src/app/actions/brand.ts` and confirm that `getEffectiveBrand(clientId?, campaignId?)` derives its output entirely from its arguments — not from `cookies()`, `headers()`, or any other request-specific context. If it reads cookies or headers internally, the `unstable_cache` wrapper is unsafe (cross-tenant cache bleed). Based on the current implementation it does not — it's purely argument-driven — but confirm before proceeding.

Once confirmed, in `src/lib/auth/workspace-bootstrap.ts` replace:
```typescript
import { getEffectiveBrand } from "@/app/actions/brand";
```
with:
```typescript
import { getCachedEffectiveBrand } from "@/app/actions/brand";
```
And in the bootstrap body, replace `getEffectiveBrand()` with `getCachedEffectiveBrand()`.

**Note:** The bootstrap calls `getEffectiveBrand()` with no arguments (resolves platform default). The cache key will be `['effective-brand', undefined, undefined]`. This is safe because platform brand is not user- or tenant-specific.

- [ ] **Step 4: Build check**

Run: `npx next build 2>&1 | tail -30`
Expected: Successful build.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/brand.ts src/lib/auth/workspace-bootstrap.ts
git commit -m "perf: add cross-request caching for brand resolution (300s TTL)"
```

---

### Task 6: Baseline Performance Measurement

Before moving to client-side work, capture timing baselines.

**Files:**
- Create: `scripts/benchmark-ttfb.sh`

#### Step-by-step

- [ ] **Step 1: Create benchmark script**

Create `scripts/benchmark-ttfb.sh`:

```bash
#!/usr/bin/env bash
# Benchmark warm TTFB for key workspace routes.
# Run against a local production build: next build && next start
#
# Usage: ./scripts/benchmark-ttfb.sh [base_url] [cookie_file]

BASE="${1:-http://localhost:3000}"
COOKIE_FILE="${2:-}"
COOKIE_FLAG=""
if [ -n "$COOKIE_FILE" ]; then
  COOKIE_FLAG="-b $COOKIE_FILE"
fi

ROUTES=(
  "/"
  "/dashboard"
  "/client/dashboard"
  "/client/campaigns"
  "/partner/settings/brand"
)

echo "=== TTFB Benchmark ==="
echo "Base: $BASE"
echo ""

for route in "${ROUTES[@]}"; do
  # Warm the route (discard first request)
  curl -s -o /dev/null $COOKIE_FLAG "$BASE$route" 2>/dev/null

  # Measure warm TTFB (3 samples)
  total=0
  for i in 1 2 3; do
    ttfb=$(curl -s -o /dev/null -w '%{time_starttransfer}' $COOKIE_FLAG "$BASE$route" 2>/dev/null)
    ms=$(echo "$ttfb * 1000" | bc)
    total=$(echo "$total + $ms" | bc)
  done
  avg=$(echo "scale=0; $total / 3" | bc)
  echo "$route: ${avg}ms (avg of 3 warm requests)"
done
```

- [ ] **Step 2: Run baseline**

```bash
chmod +x scripts/benchmark-ttfb.sh
npx next build && npx next start &
sleep 5
./scripts/benchmark-ttfb.sh
kill %1
```

Record baseline numbers for comparison after Phase 2.

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark-ttfb.sh
git commit -m "chore: add TTFB benchmark script"
```

---

## Phase 2: Client-Side & Marketing (Tasks 7–9)

### Task 7: Remove PageTransition Remount

`PageTransition` uses `key={pathname}` which forces a full React remount of the entire page subtree on every navigation. Replace with a CSS-only entry animation that doesn't remount.

**Files:**
- Modify: `src/components/page-transition.tsx`

#### Step-by-step

- [ ] **Step 1: Convert to CSS-only animation**

Replace `src/components/page-transition.tsx`:

```typescript
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-in-up">
      {children}
    </div>
  );
}
```

**What changed:**
- Removed `"use client"` — this is now a plain server component
- Removed `usePathname()` import and the `key={pathname}` prop
- The `animate-fade-in-up` CSS class still plays on initial mount. Route transitions get the animation from Next.js `loading.tsx` skeleton to page swap, which triggers the CSS animation on the new DOM.
- No more full subtree remount on every navigation.

- [ ] **Step 2: Build and verify no hydration errors**

Run: `npx next build 2>&1 | tail -20`
Expected: Successful build. No `"use client"` required since there's no hook usage.

- [ ] **Step 3: Commit**

```bash
git add src/components/page-transition.tsx
git commit -m "perf: remove PageTransition remount, use CSS-only animation"
```

---

### Task 8: Lazy-Load CommandPalette

CommandPalette is in the critical shell for every portal. Lazy-load it so its JS doesn't block initial render.

**Files:**
- Modify: `src/components/workspace-shell.tsx`

#### Step-by-step

- [ ] **Step 1: Dynamic import CommandPalette**

In `src/components/workspace-shell.tsx`, replace:

```typescript
import { CommandPalette } from "@/components/command-palette";
```

with:

```typescript
import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((m) => m.CommandPalette),
  { ssr: false }
);
```

This defers loading the CommandPalette module until after the shell renders. The `ssr: false` means no server-side rendering of the palette (it's a client-only dialog anyway).

- [ ] **Step 2: Build check**

Run: `npx next build 2>&1 | tail -20`
Expected: CommandPalette now in a separate JS chunk, not in the shared shell bundle.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace-shell.tsx
git commit -m "perf: lazy-load CommandPalette out of critical shell"
```

---

### Task 9: Make Marketing Page Static-First

Convert the marketing home page from a full `"use client"` root into a server-rendered page with client islands for interaction.

**Files:**
- Modify: `src/app/(marketing)/page.tsx`
- Create: `src/app/(marketing)/components/marketing-islands.tsx` (client islands)

**Note:** This task intersects with the scroll performance plan in `groovy-orbiting-pixel.md`. The scroll plan addresses CSS custom property animations for `Problem`, `Journey`, and scroll progress. This task addresses the page-level `"use client"` root and particle mesh loading. The two are compatible — this task converts the page structure, and the scroll plan refines individual section animations. Do the scroll plan work after this task.

#### Step-by-step

- [ ] **Step 1: Create client island component**

Create `src/app/(marketing)/components/marketing-islands.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const SECTIONS = ["hero", "problem", "journey", "builtFor", "contact"] as const;

// Lazy-load ParticleMesh — deferred until idle, skipped on mobile/reduced-motion
const ParticleMesh = dynamic(
  () => import("./particle-mesh").then((m) => m.ParticleMesh),
  { ssr: false }
);

/**
 * Client island: section observer + mouse glow + particle mesh.
 * Wraps only the interactive parts that need client-side JS.
 */
export function MarketingInteractive() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [showParticles, setShowParticles] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  // Section observer
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((section) => {
      const el = document.querySelector(`[data-section="${section}"]`);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(section);
        },
        { threshold: 0.3 }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Mouse glow + particle gate
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isMobile = window.innerWidth < 768;

    if (prefersReduced || isMobile) return;

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Defer particle load until after idle
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setShowParticles(true));
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        cancelIdleCallback(id);
      };
    } else {
      const timer = setTimeout(() => setShowParticles(true), 200);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        clearTimeout(timer);
      };
    }
  }, []);

  return (
    <>
      {showParticles && (
        <ParticleMesh activeSection={activeSection} mouseRef={mouseRef} />
      )}
      <div
        ref={glowRef}
        className="pointer-events-none fixed left-0 top-0 z-[15] h-[600px] w-[600px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(47,227,173,0.12) 0%, transparent 70%)",
          transform: "translate(-9999px, -9999px)",
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Convert marketing page to server component**

Replace `src/app/(marketing)/page.tsx`:

```typescript
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { Problem } from "./components/problem";
import { Journey } from "./components/journey";
import { BuiltFor } from "./components/built-for";
import { Contact } from "./components/contact";
import { MarketingInteractive } from "./components/marketing-islands";

export default function MarketingPage() {
  return (
    <>
      <MarketingInteractive />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <Problem />
        <Journey />
        <BuiltFor />
        <Contact />
      </main>
    </>
  );
}
```

**What changed:**
- Removed `"use client"` — the page is now a server component
- The main document structure (Nav, Hero, Problem, Journey, BuiltFor, Contact) renders as server HTML
- Interactive behavior (section observer, mouse glow, particle mesh) is isolated in `MarketingInteractive` client island
- ParticleMesh is lazy-loaded with `dynamic()` and gated behind reduced-motion + screen size checks

**Important:** `Nav`, `Hero`, `Problem`, etc. may themselves be `"use client"`. That's fine — they become client boundaries within a server-rendered page. The key improvement is that the page-level HTML renders server-side, so the first contentful paint doesn't wait for JS hydration.

- [ ] **Step 3: Check Nav active section communication**

Some child components (e.g., `Nav`) may currently receive the `activeSection` state from the parent page. Since the observer now lives in `MarketingInteractive`, check if `Nav` uses `activeSection` as a prop. If so, the section observer needs to communicate to Nav via a shared mechanism.

Read `src/app/(marketing)/components/nav.tsx` and check for `activeSection` prop usage. If present, the simplest fix is to move the observer into a shared context provider or use a DOM-based approach (e.g., `data-active-section` attribute set by the observer, read by Nav via its own observer or MutationObserver).

- [ ] **Step 4: Build and test**

Run: `npx next build 2>&1 | tail -20`
Expected: Successful build.

Manually verify:
- `curl -s http://localhost:3000 | head -100` — should contain meaningful HTML content (Hero text, section headers), not an empty body waiting for JS.
- Particle mesh should not appear for `prefers-reduced-motion` users.
- Particle mesh should not appear on mobile widths.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(marketing)/page.tsx" "src/app/(marketing)/components/marketing-islands.tsx"
git commit -m "perf: convert marketing page to static-first with client islands"
```

---

## Verification

### Security verification (run after all tasks)

- [ ] **Cross-user isolation:** Sign in as User A, navigate to /dashboard, note data. Sign out. Sign in as User B — verify User B sees their own data, no bleed from User A's cached bootstrap.
- [ ] **Cross-tenant isolation:** Switch active workspace context to Partner X, verify data. Switch to Partner Y, verify data changes on next navigation.
- [ ] **Support session:** Enter a support session as platform admin, verify banner appears. Exit session, verify banner disappears and data reverts.
- [ ] **Brand invalidation:** Change brand config via admin, verify the next request reflects the new brand (within 300s TTL, or immediately after `revalidateTag`).

### Performance verification

- [ ] Re-run `./scripts/benchmark-ttfb.sh` with the same setup as the baseline.
- [ ] Compare warm TTFB numbers against the 250-300ms target for list pages and 400ms for detail pages.
- [ ] If targets are not met, add `console.time`/`console.timeEnd` around the bootstrap, campaign detail, and quota loading to identify remaining bottlenecks.

### Marketing verification

- [ ] `curl -s http://localhost:3000 | grep -c '<section'` — verify sections render in HTML.
- [ ] Open in browser with DevTools Performance tab — verify no full-page hydration before content appears.
- [ ] Test with `prefers-reduced-motion: reduce` — particles and glow should not load.
- [ ] Test at mobile width (< 768px) — particles should not load.
