# Admin Directory Polish Implementation Plan — Spec A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portal switcher with context-aware "Enter Portal" buttons powered by support sessions, redesign client/partner detail overview pages with stats + cleaned-up forms, add per-client/partner Users tabs, and fix the ownership display and assessments tab bugs.

**Architecture:** Leverages existing support session infrastructure (`startSupportSession`, `/client/support/launch`, `/partner/support/launch`). The "Enter Portal" button is a new UI affordance on top of existing auth mechanisms. Partner detail pages get a new tabbed shell (mirror of client detail shell). Users tab is a new page using existing `client_memberships` / `partner_memberships` tables.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-06-admin-directory-polish.md`

**Prerequisite:** The terminology rename plan (`2026-04-06-terminology-rename.md`) must be executed first. This plan assumes `clients` table and `clientId` naming throughout.

---

## File Structure

### New files

```
src/components/
├── enter-portal-button.tsx              — Reusable button for client/partner portal entry
└── support-session-banner.tsx           — "Return to admin" banner for active sessions

src/app/actions/
└── enter-portal.ts                      — Server action to start support session from directory

src/app/(dashboard)/clients/[slug]/
├── overview/
│   ├── client-overview.tsx              — NEW: stats + actions + edit form wrapper
│   └── client-stats.tsx                 — NEW: 4-card stats grid component
└── users/
    ├── page.tsx                         — NEW: users tab page
    ├── client-users-table.tsx           — NEW: user list component
    ├── invite-user-dialog.tsx           — NEW: invite flow dialog
    ├── pending-invites-section.tsx      — NEW: pending invites display
    └── loading.tsx                      — NEW: shimmer skeleton

src/app/(dashboard)/partners/[slug]/
├── layout.tsx                           — NEW: tabbed shell for partner detail
├── page.tsx                             — NEW: redirect to overview
├── partner-detail-shell.tsx             — NEW: tab bar component
├── overview/
│   ├── page.tsx                         — NEW: partner overview
│   ├── partner-overview.tsx             — NEW: stats + actions + edit form wrapper
│   └── partner-stats.tsx                — NEW: 4-card stats grid
└── users/
    ├── page.tsx                         — NEW
    ├── partner-users-table.tsx          — NEW
    └── loading.tsx                      — NEW
```

### Modified files

```
src/components/app-sidebar.tsx           — Remove BuildPortalSwitcher import and render
src/components/workspace-shell.tsx       — Add SupportSessionBanner rendering
src/app/(dashboard)/clients/[slug]/organization-detail-shell.tsx
                                          — Add "Users" tab, rename to client-detail-shell.tsx
src/app/(dashboard)/clients/[slug]/overview/organization-edit-form.tsx
                                          — Fix ownership display, wrap in new overview layout
src/app/(dashboard)/clients/[slug]/overview/page.tsx
                                          — Fetch stats, render ClientOverview
```

### Deleted files (after verification)

```
src/components/build-portal-switcher.tsx  — Delete after Enter Portal buttons verified
```

---

## Task 1: Remove Portal Switcher

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Remove BuildPortalSwitcher from sidebar**

In `src/components/app-sidebar.tsx`:
1. Remove the import of `BuildPortalSwitcher` and `portalConfig`
2. Remove the render of `<BuildPortalSwitcher />` from the sidebar header
3. Keep the portal icon/label display (read the current sidebar code to understand what stays vs what goes)

The sidebar header should still show the current portal (admin/partner/client) via icon + label, but without the dropdown switcher.

- [ ] **Step 2: Verify dev server works**

Run: `npm run dev`
Navigate to the admin portal. Verify:
- Sidebar renders without errors
- No dropdown switcher in header
- Portal icon/label still shows correctly

- [ ] **Step 3: Compile check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(sidebar): remove portal switcher — access via directory buttons only"
```

---

## Task 2: Enter Portal Server Action

**Files:**
- Create: `src/app/actions/enter-portal.ts`

- [ ] **Step 1: Read existing support session infrastructure**

Read these files to understand the existing API:
- `src/lib/auth/support-sessions.ts` — has `startSupportSession` function
- `src/lib/auth/support-launch.ts` — has launch URL building logic

Note the signature of `startSupportSession` — what params it takes, what it returns. The launch URLs use `?sessionId={id}&sessionKey={key}` format.

- [ ] **Step 2: Create the server action**

Create `src/app/actions/enter-portal.ts`:

```typescript
"use server";

import { requireAdminScope } from "@/lib/auth/authorization";
import { startSupportSession } from "@/lib/auth/support-sessions";
import { buildSurfaceUrl } from "@/lib/hosts";

type EnterPortalInput = {
  tenantType: "client" | "partner";
  tenantId: string;
};

export async function createEnterPortalLaunchUrl(
  input: EnterPortalInput
): Promise<{ success: true; launchUrl: string } | { error: string }> {
  const { scope } = await requireAdminScope();

  if (!scope.actor?.id) {
    return { error: "Unable to determine acting user" };
  }

  try {
    // NOTE: Read src/lib/auth/types.ts to confirm exact field names on SupportSessionInput.
    // The field may be `targetSurface` + `targetTenantId` rather than `targetTenantType` + `targetTenantId`.
    // Adjust the call below to match the actual interface.
    const fourHoursMs = 4 * 60 * 60 * 1000;
    const { sessionId, sessionKey } = await startSupportSession({
      actorProfileId: scope.actor.id,
      targetSurface: input.tenantType,
      targetTenantId: input.tenantId,
      reason: "Admin portal access",
      expiresAt: new Date(Date.now() + fourHoursMs).toISOString(),
    });

    // Build the launch URL for the target surface
    const surfaceName = input.tenantType === "client" ? "client" : "partner";
    const launchPath = `/${surfaceName}/support/launch?sessionId=${encodeURIComponent(sessionId)}&sessionKey=${encodeURIComponent(sessionKey)}`;

    // buildSurfaceUrl returns absolute URL with correct host in production
    const url = buildSurfaceUrl(surfaceName, launchPath);
    const launchUrl = url ? url.toString() : launchPath;

    return { success: true, launchUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to start session",
    };
  }
}
```

Adjust the function name imports (`requireAdminScope`, `startSupportSession`, `buildSurfaceUrl`) if they differ from the actual API — read the source files first.

Also add an `endSupportSession` action in the same file:

```typescript
export async function endSupportSession(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireAdminScope();

  const db = createAdminClient();
  const { error } = await db
    .from("support_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // Clear the support session cookie
  // Read src/lib/auth/support-sessions.ts to find the existing cookie clearing mechanism.
  // If none exists, set the cookie to empty with maxAge 0.

  return { success: true };
}
```

- [ ] **Step 3: Compile check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/enter-portal.ts
git commit -m "feat(admin): add enter-portal and end-session server actions"
```

---

## Task 3: Enter Portal Button Component

**Files:**
- Create: `src/components/enter-portal-button.tsx`

- [ ] **Step 1: Create the button component**

```typescript
"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createEnterPortalLaunchUrl } from "@/app/actions/enter-portal";

type EnterPortalButtonProps = {
  tenantType: "client" | "partner";
  tenantId: string;
  tenantName: string;
  variant?: "default" | "outline";
};

export function EnterPortalButton({
  tenantType,
  tenantId,
  tenantName,
  variant = "default",
}: EnterPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const result = await createEnterPortalLaunchUrl({ tenantType, tenantId });
    setIsLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const newWindow = window.open(result.launchUrl, "_blank");
    if (!newWindow) {
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }

    toast.success(`Opening ${tenantName} ${tenantType} portal in new tab`);
  }

  const label = tenantType === "client" ? "Enter Client Portal" : "Enter Partner Portal";

  return (
    <Button onClick={handleClick} disabled={isLoading} variant={variant}>
      {isLoading ? "Starting session..." : label}
      <ExternalLink className="size-4 ml-2" />
    </Button>
  );
}
```

- [ ] **Step 2: Compile check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/enter-portal-button.tsx
git commit -m "feat(admin): add EnterPortalButton component"
```

---

## Task 4: Support Session Banner

**Files:**
- Create: `src/components/support-session-banner.tsx`
- Modify: `src/components/workspace-shell.tsx`

- [ ] **Step 1: Create the banner component**

```typescript
"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { endSupportSession } from "@/app/actions/enter-portal";

type SupportSessionBannerProps = {
  sessionId: string;
  tenantName: string;
  tenantType: "client" | "partner";
  tenantSlug: string; // for building the return path
  actorName: string;
};

export function SupportSessionBanner({
  sessionId,
  tenantName,
  tenantType,
  tenantSlug,
  actorName,
}: SupportSessionBannerProps) {
  const [isEnding, setIsEnding] = useState(false);

  async function handleReturn() {
    setIsEnding(true);
    await endSupportSession(sessionId);
    // Navigate back to admin — the return path is the client/partner detail page
    const adminPath = tenantType === "client"
      ? `/clients/${tenantSlug}/overview`
      : `/partners/${tenantSlug}/overview`;
    window.location.href = adminPath;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Support session active — viewing <strong>{tenantName}</strong> as{" "}
            <strong>{actorName}</strong>
          </span>
        </div>
        <button
          onClick={handleReturn}
          disabled={isEnding}
          className="text-amber-900 dark:text-amber-200 underline hover:no-underline font-medium"
        >
          {isEnding ? "Ending session..." : "Return to admin"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate banner into workspace-shell**

Read `src/components/workspace-shell.tsx` to understand its current structure. Add the banner at the top when a support session is active.

The shell already receives actor/scope context. Check if it has access to support session info. If not, pass it as a prop from the layout that wraps the shell.

Logic:
- Only render the banner if `scope.supportSession` exists AND `portal === scope.supportSession.targetTenantType`
- Compute `returnPath` from the support session tenant info: `/${tenantType}s/${slug}/overview`
- Need to fetch the tenant's slug (may require an additional query or pass through layout)

This step requires reading the existing code to understand how to integrate. Adjust as needed based on actual structure.

- [ ] **Step 3: Test manually**

Without a real support session, this won't render. Verify:
- No runtime errors when rendering without a session
- Banner renders with dummy data (temporarily hard-code values to verify visuals)
- Remove dummy values after visual verification

- [ ] **Step 4: Commit**

```bash
git add src/components/support-session-banner.tsx src/components/workspace-shell.tsx
git commit -m "feat(admin): add SupportSessionBanner with return-to-admin link"
```

---

## Task 5: Fix Ownership Display Bug

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/overview/organization-edit-form.tsx` (the name may already be renamed from Task 1 of the rename plan)

- [ ] **Step 1: Read the current ownership dropdown code**

Read the form component, locate the partner/ownership dropdown. Find where `__platform__` is defined and where it's displayed.

- [ ] **Step 2: Create a display helper**

At the top of the component file (or in a shared utility):

```typescript
const PLATFORM_OWNED_VALUE = "__platform__";

function formatOwnershipDisplay(
  value: string | null,
  partners: Array<{ id: string; name: string }>
): string {
  if (!value || value === PLATFORM_OWNED_VALUE) {
    return "Trajectas (platform-owned)";
  }
  const partner = partners.find((p) => p.id === value);
  return partner?.name ?? "Unknown";
}
```

- [ ] **Step 3: Use the helper in both dropdown states**

Update the dropdown component to use `formatOwnershipDisplay` for:
- The collapsed/closed dropdown display (currently showing `__platform__`)
- The options list items (confirm they already show proper text)

The dropdown should NEVER show raw `__platform__` text anywhere.

- [ ] **Step 4: Manual verification**

Run dev server, navigate to a client's Overview page. Verify:
- Ownership dropdown shows "Trajectas (platform-owned)" when platform-owned
- Ownership dropdown shows partner name when partner-owned
- No raw `__platform__` text visible anywhere

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[slug\]/overview/
git commit -m "fix(clients): render ownership display text consistently"
```

---

## Task 6: Client Overview Stats & Redesign

**Files:**
- Create: `src/app/(dashboard)/clients/[slug]/overview/client-stats.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/overview/client-overview.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/overview/page.tsx`

- [ ] **Step 1: Create stats fetcher server action**

Add a new function to `src/app/actions/clients.ts` (renamed from organizations.ts):

```typescript
export async function getClientStats(clientId: string): Promise<{
  activeCampaignCount: number;
  totalParticipants: number;
  assignedAssessmentCount: number;
  teamMemberCount: number;
}> {
  const { scope } = await requireClientAccess(clientId);
  const db = createAdminClient();

  // Active campaigns
  const { count: activeCampaignCount } = await db
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "active")
    .is("deleted_at", null);

  // Total participants across all campaigns
  const { data: campaignIds } = await db
    .from("campaigns")
    .select("id")
    .eq("client_id", clientId)
    .is("deleted_at", null);
  const ids = (campaignIds ?? []).map((c) => c.id);

  let totalParticipants = 0;
  if (ids.length > 0) {
    const { count } = await db
      .from("campaign_participants")
      .select("*", { count: "exact", head: true })
      .in("campaign_id", ids);
    totalParticipants = count ?? 0;
  }

  // Assigned assessments
  const { count: assignedAssessmentCount } = await db
    .from("client_assessment_assignments")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("is_active", true);

  // Team members
  const { count: teamMemberCount } = await db
    .from("client_memberships")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("revoked_at", null);

  return {
    activeCampaignCount: activeCampaignCount ?? 0,
    totalParticipants,
    assignedAssessmentCount: assignedAssessmentCount ?? 0,
    teamMemberCount: teamMemberCount ?? 0,
  };
}
```

- [ ] **Step 2: Create ClientStats component**

Create `client-stats.tsx`:

```typescript
import { Megaphone, Users, ClipboardList, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ClientStatsProps = {
  activeCampaignCount: number;
  totalParticipants: number;
  assignedAssessmentCount: number;
  teamMemberCount: number;
};

export function ClientStats(props: ClientStatsProps) {
  const cards = [
    { label: "Active Campaigns", value: props.activeCampaignCount, icon: Megaphone },
    { label: "Total Participants", value: props.totalParticipants, icon: Users },
    { label: "Assigned Assessments", value: props.assignedAssessmentCount, icon: ClipboardList },
    { label: "Team Members", value: props.teamMemberCount, icon: Building2 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {label}
                </p>
                <p className="text-3xl font-bold">{value}</p>
              </div>
              <Icon className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create ClientOverview wrapper**

Create `client-overview.tsx`:

```typescript
import { ClientStats } from "./client-stats";
import { EnterPortalButton } from "@/components/enter-portal-button";
import { OrganizationEditForm } from "./organization-edit-form"; // or ClientEditForm after Task 5
import type { ClientWithCounts } from "@/app/actions/clients";

type ClientOverviewProps = {
  client: ClientWithCounts;
  stats: {
    activeCampaignCount: number;
    totalParticipants: number;
    assignedAssessmentCount: number;
    teamMemberCount: number;
  };
  partnerOptions: Array<{ id: string; name: string }>;
  canAssignPartner: boolean;
};

export function ClientOverview({
  client,
  stats,
  partnerOptions,
  canAssignPartner,
}: ClientOverviewProps) {
  return (
    <div className="space-y-6">
      <ClientStats {...stats} />

      <div className="flex justify-start">
        <EnterPortalButton
          tenantType="client"
          tenantId={client.id}
          tenantName={client.name}
        />
      </div>

      <OrganizationEditForm
        organization={client}
        partnerOptions={partnerOptions}
        canAssignPartner={canAssignPartner}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update the overview page**

Update `src/app/(dashboard)/clients/[slug]/overview/page.tsx` to:
1. Fetch stats via `getClientStats(client.id)` alongside existing data
2. Render `<ClientOverview client={client} stats={stats} ...>` instead of the edit form directly

- [ ] **Step 5: Manual verification**

Navigate to a client's Overview page. Verify:
- 4 stat cards render at the top
- "Enter Client Portal" button is visible and clickable
- Edit form renders below
- No layout issues

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[slug\]/overview/ src/app/actions/clients.ts
git commit -m "feat(clients): redesign overview with stats dashboard and portal entry"
```

---

## Task 7: Client Users Tab

**Files:**
- Create: `src/app/(dashboard)/clients/[slug]/users/page.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/users/client-users-table.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/users/invite-user-dialog.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/users/pending-invites-section.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/users/loading.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx` (add "Users" tab)

- [ ] **Step 1: Add server actions for user management**

Add to `src/app/actions/clients.ts`:

```typescript
export async function getClientMembers(clientId: string): Promise<Array<{
  membershipId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  addedAt: string;
}>> {
  const { scope } = await requireClientAccess(clientId);
  if (!scope.isPlatformAdmin) {
    throw new Error("Only platform admins can view team members");
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("client_memberships")
    .select("id, role, created_at, profiles(id, email, first_name, last_name)")
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    membershipId: row.id,
    userId: row.profiles?.id,
    email: row.profiles?.email ?? "",
    firstName: row.profiles?.first_name ?? null,
    lastName: row.profiles?.last_name ?? null,
    role: row.role,
    addedAt: row.created_at,
  }));
}

export async function getClientPendingInvites(clientId: string) {
  const { scope } = await requireClientAccess(clientId);
  if (!scope.isPlatformAdmin) {
    throw new Error("Only platform admins can view pending invites");
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("user_invites")
    .select("id, email, role, created_at, expires_at")
    .eq("tenant_type", "client")
    .eq("tenant_id", clientId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function inviteUserToClient(
  clientId: string,
  input: { email: string; role: "admin" | "member" }
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireClientAccess(clientId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can invite users" };
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine acting user" };
  }

  const db = createAdminClient();

  // Check for existing pending invite
  const { data: existing } = await db
    .from("user_invites")
    .select("id")
    .eq("tenant_type", "client")
    .eq("tenant_id", clientId)
    .eq("email", input.email.toLowerCase())
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) {
    return { error: "This email already has a pending invite" };
  }

  // Create invite (additional fields like invite_token_hash, expires_at
  // should follow existing invite creation pattern — read existing invite
  // code in the codebase, likely in actions/staff-users.ts or similar)
  const { error } = await db.from("user_invites").insert({
    email: input.email.toLowerCase(),
    tenant_type: "client",
    tenant_id: clientId,
    role: input.role,
    invited_by_profile_id: scope.actor.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/clients`);
  return { success: true };
}

export async function changeClientMemberRole(
  clientId: string,
  membershipId: string,
  role: "admin" | "member"
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireClientAccess(clientId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can change roles" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("client_memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/clients`);
  return { success: true };
}

export async function removeClientMember(
  clientId: string,
  membershipId: string
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requireClientAccess(clientId);
  if (!scope.isPlatformAdmin) {
    return { error: "Only platform admins can remove members" };
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine acting user" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("client_memberships")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_profile_id: scope.actor.id,
    })
    .eq("id", membershipId)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/clients`);
  return { success: true };
}
```

NOTE: The `user_invites` insert above is simplified. Read existing invite creation code (likely `src/app/actions/staff-users.ts` or similar) to match the project's invite pattern exactly — including `invite_token_hash`, any email sending, etc.

- [ ] **Step 2: Create the users page**

Create `page.tsx`:

```typescript
import { getClientBySlug, getClientMembers, getClientPendingInvites } from "@/app/actions/clients";
import { notFound } from "next/navigation";
import { ClientUsersTable } from "./client-users-table";
import { PendingInvitesSection } from "./pending-invites-section";
import { InviteUserDialog } from "./invite-user-dialog";

export default async function ClientUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const [members, invites] = await Promise.all([
    getClientMembers(client.id),
    getClientPendingInvites(client.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team members</h2>
          <p className="text-sm text-muted-foreground">
            Users who have access to this client's data and operations
          </p>
        </div>
        <InviteUserDialog clientId={client.id} />
      </div>

      <ClientUsersTable clientId={client.id} members={members} />

      {invites.length > 0 && (
        <PendingInvitesSection clientId={client.id} invites={invites} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ClientUsersTable component**

The table should:
- Have columns: Name, Email, Role (dropdown), Added, Actions
- Name formatting: `{firstName} {lastName}` or email if no name
- Role dropdown (admin/member) calls `changeClientMemberRole` on change
- Remove action with confirmation dialog calls `removeClientMember`
- Toast feedback on all mutations
- `useRouter().refresh()` after mutations
- Empty state: "No team members yet. Invite someone to get started."

Follow existing table patterns in the codebase. Read one or two existing table components for structure.

- [ ] **Step 4: Create InviteUserDialog component**

Dialog with:
- Email input (required)
- Role selector (admin / member, default: member)
- Submit button calls `inviteUserToClient`
- Toast feedback + close dialog on success
- Error display inline

- [ ] **Step 5: Create PendingInvitesSection**

List of pending invites with:
- Email, role, invited date, expires date columns
- Actions: Resend (if email sending exists), Revoke (sets `revoked_at`)

- [ ] **Step 6: Create loading.tsx**

Shimmer skeleton matching the table layout.

- [ ] **Step 7: Add Users tab to client detail shell**

In the client detail shell (renamed file), add "Users" to the tabs array:

```typescript
const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];
```

- [ ] **Step 8: Manual verification**

Navigate to `/clients/[slug]/users`. Verify:
- Tab appears in the tab bar
- Members list loads (may be empty — empty state shows)
- Invite dialog opens and submits
- Role changes persist
- Remove action works with confirmation

- [ ] **Step 9: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[slug\]/users/ src/app/\(dashboard\)/clients/\[slug\]/client-detail-shell.tsx src/app/actions/clients.ts
git commit -m "feat(clients): add Users tab for member management"
```

---

## Task 8: Partner Detail Tabbed Shell

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/layout.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`

- [ ] **Step 1: Check current partner route structure**

Run: `ls src/app/\(dashboard\)/partners/\[slug\]/`

The current structure has only an `edit/` subdirectory. We'll create the tabbed shell around it, then migrate content to an `overview/` directory in Task 9.

- [ ] **Step 2: Create layout.tsx**

Read `src/app/(dashboard)/clients/[slug]/layout.tsx` for the pattern (created by the rename plan). Mirror for partners:

```typescript
import { getPartnerBySlug } from "@/app/actions/partners";
import { notFound } from "next/navigation";
import { PartnerDetailShell } from "./partner-detail-shell";

export default async function PartnerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);
  if (!partner) notFound();

  return (
    <PartnerDetailShell partner={partner}>{children}</PartnerDetailShell>
  );
}
```

NOTE: `getPartnerBySlug` may not exist — check `src/app/actions/partners.ts`. If it doesn't exist, add it using the same pattern as `getClientBySlug`.

- [ ] **Step 3: Create partner-detail-shell.tsx**

Mirror `client-detail-shell.tsx` with partner-appropriate tabs:

```typescript
const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Clients", segment: "clients" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];
```

Use "Partners" as the PageHeader eyebrow.

- [ ] **Step 4: Create redirect page.tsx**

```typescript
import { redirect } from "next/navigation";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/partners/${slug}/overview`);
}
```

- [ ] **Step 5: Manual verification**

Navigate to `/partners/[slug]`. Verify:
- Redirects to `/partners/[slug]/overview` (will 404 until Task 9 creates overview)
- Tab bar is visible

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/partners/\[slug\]/layout.tsx src/app/\(dashboard\)/partners/\[slug\]/page.tsx src/app/\(dashboard\)/partners/\[slug\]/partner-detail-shell.tsx
git commit -m "feat(partners): add tabbed detail shell"
```

---

## Task 9: Partner Overview Page

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/overview/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/overview/partner-overview.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/overview/partner-stats.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/overview/loading.tsx`
- Move: `src/app/(dashboard)/partners/[slug]/edit/*` content into overview

- [ ] **Step 1: Add getPartnerStats server action**

Add to `src/app/actions/partners.ts`:

```typescript
export async function getPartnerStats(partnerId: string): Promise<{
  clientCount: number;
  activeCampaignCount: number;
  teamMemberCount: number;
  assignedAssessmentCount: number;
}> {
  // Auth check via requireAdminScope or similar
  const db = createAdminClient();

  const { count: clientCount } = await db
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .is("deleted_at", null);

  const { data: clientIds } = await db
    .from("clients")
    .select("id")
    .eq("partner_id", partnerId)
    .is("deleted_at", null);
  const ids = (clientIds ?? []).map((c) => c.id);

  let activeCampaignCount = 0;
  let assignedAssessmentCount = 0;

  if (ids.length > 0) {
    const { count: campaigns } = await db
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .in("client_id", ids)
      .eq("status", "active")
      .is("deleted_at", null);
    activeCampaignCount = campaigns ?? 0;

    const { count: assessments } = await db
      .from("client_assessment_assignments")
      .select("*", { count: "exact", head: true })
      .in("client_id", ids)
      .eq("is_active", true);
    assignedAssessmentCount = assessments ?? 0;
  }

  const { count: teamMemberCount } = await db
    .from("partner_memberships")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .is("revoked_at", null);

  return {
    clientCount: clientCount ?? 0,
    activeCampaignCount,
    teamMemberCount: teamMemberCount ?? 0,
    assignedAssessmentCount,
  };
}
```

- [ ] **Step 2: Create PartnerStats component**

Mirror `client-stats.tsx` with partner-appropriate cards:
- Clients (count)
- Active Campaigns (across their clients)
- Team Members
- Assigned Assessments (aggregate across their clients)

- [ ] **Step 3: Create PartnerOverview wrapper**

Mirror `client-overview.tsx`. Include `EnterPortalButton` with `tenantType="partner"`. Include the partner edit form (move from existing `edit/` directory).

- [ ] **Step 4: Move edit form content**

```bash
mkdir -p src/app/\(dashboard\)/partners/\[slug\]/overview
git mv src/app/\(dashboard\)/partners/\[slug\]/edit/page.tsx src/app/\(dashboard\)/partners/\[slug\]/overview/page.tsx
# Move any form component too
```

Update the overview/page.tsx to fetch stats and render `<PartnerOverview>`.

- [ ] **Step 5: Manual verification**

Navigate to `/partners/[slug]`. Verify:
- Redirects to overview
- Stats cards render
- Enter Partner Portal button visible
- Edit form renders

- [ ] **Step 6: Commit**

```bash
git add -A src/app/\(dashboard\)/partners/\[slug\]/ src/app/actions/partners.ts
git commit -m "feat(partners): add overview page with stats and portal entry"
```

---

## Task 10: Partner Users Tab

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/users/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/users/partner-users-table.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/users/loading.tsx`

- [ ] **Step 1: Add partner user management server actions**

Add to `src/app/actions/partners.ts` (mirror the client user management actions from Task 7):
- `getPartnerMembers(partnerId)` — queries `partner_memberships`
- `getPartnerPendingInvites(partnerId)` — queries `user_invites` with `tenant_type='partner'`
- `inviteUserToPartner(partnerId, { email, role })`
- `changePartnerMemberRole(partnerId, membershipId, role)`
- `removePartnerMember(partnerId, membershipId)`

- [ ] **Step 2: Create users page and components**

Mirror the client users implementation (Task 7) exactly. Consider extracting shared components if there's significant overlap, but a simple copy-paste-adapt is acceptable here.

- [ ] **Step 3: Manual verification**

Navigate to `/partners/[slug]/users`. Verify it works like the client Users tab.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/partners/\[slug\]/users/ src/app/actions/partners.ts
git commit -m "feat(partners): add Users tab for partner member management"
```

---

## Task 11: Investigate and Fix Assessments Tab Bug

**Files:** Determined during investigation

- [ ] **Step 1: Reproduce the bug**

Run: `npm run dev`
Navigate to any client's Assessments tab. Observe:
- Is the page blank?
- Is there a server error?
- Is there a JS console error?
- Does the data load but render incorrectly?

- [ ] **Step 2: Check server logs**

Look at the terminal running `npm run dev` for any errors when the page loads.

- [ ] **Step 3: Check network tab**

In browser devtools, check the Network tab when loading the Assessments tab. Look for failing requests or server errors.

- [ ] **Step 4: Investigate and fix**

Based on findings, apply fix. Most likely candidates:
- `getAssessmentAssignments` auth check rejecting platform admin
- Data response shape mismatch
- Component prop validation error
- Missing null checks in the component

If stuck for more than 15 minutes, report back with findings — the bug may require more context.

- [ ] **Step 5: Manual verification**

Reload the Assessments tab. Verify:
- Page loads without errors
- Empty state shows if no assignments
- Existing assignments render correctly

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(clients): resolve assessments tab rendering bug

[Describe the root cause found]"
```

---

## Task 12: Delete Build Portal Switcher

**Files:**
- Delete: `src/components/build-portal-switcher.tsx`

- [ ] **Step 1: Verify no remaining references**

```bash
grep -rn "BuildPortalSwitcher\|build-portal-switcher" src/
```

Expected: No matches (or only matches in the file itself).

If references found, update them to use the Enter Portal buttons instead.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/build-portal-switcher.tsx
```

- [ ] **Step 3: Compile check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused build-portal-switcher component"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npx vitest run` passes with no failures
- [ ] Sidebar no longer has portal switcher dropdown
- [ ] Client detail Overview page shows 4 stat cards + "Enter Client Portal" button + edit form
- [ ] Partner detail Overview page shows 4 stat cards + "Enter Partner Portal" button + edit form
- [ ] "Enter Client Portal" opens new tab, lands on client dashboard scoped to that client
- [ ] "Enter Partner Portal" opens new tab, lands on partner placeholder
- [ ] Support session banner appears at top of client/partner portal when active session
- [ ] "Return to admin" link in banner ends session and returns to admin
- [ ] Users tab exists on both client and partner detail pages
- [ ] Users tab can invite, change role, and remove members
- [ ] Pending invites section shows when invites exist
- [ ] Ownership dropdown shows "Trajectas (platform-owned)" — no raw `__platform__` text
- [ ] Assessments tab loads without errors
