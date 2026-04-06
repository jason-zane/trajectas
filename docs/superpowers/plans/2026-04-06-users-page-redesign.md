# Users Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/users` page with a filterable table, user detail/edit pages, full role and membership management, and an invite modal.

**Architecture:** The list page is a server component that fetches a unified user+invite list, passing it to a client component for filtering/search. User detail and invite detail are separate routes with their own server components. New server actions handle role changes, membership management, and invite resending. Existing actions (revoke, deactivate) are reused.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase (no schema changes), shadcn/ui components, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-06-users-page-redesign.md`

---

## File Structure

### New Files
- `src/app/actions/user-management.ts` — New server actions: listUsersForAdmin, getUserDetail, getInviteDetail, updateUserRole, addMembership, updateMembershipRole, resendInvite
- `src/app/(dashboard)/users/page.tsx` — Rewritten list page (server component)
- `src/app/(dashboard)/users/users-table.tsx` — Client component: filterable table with tabs, search, status pills
- `src/app/(dashboard)/users/invite-dialog.tsx` — Client component: invite modal (replaces invite-user-form.tsx)
- `src/app/(dashboard)/users/loading.tsx` — Shimmer skeleton for list page
- `src/app/(dashboard)/users/[id]/page.tsx` — User detail page (server component)
- `src/app/(dashboard)/users/[id]/user-detail-client.tsx` — Client component: role editor, memberships, danger zone
- `src/app/(dashboard)/users/[id]/loading.tsx` — Shimmer skeleton for detail page
- `src/app/(dashboard)/users/invite/[inviteId]/page.tsx` — Invite detail page (server component)
- `src/app/(dashboard)/users/invite/[inviteId]/invite-detail-client.tsx` — Client component: resend/revoke actions
- `src/app/(dashboard)/users/invite/[inviteId]/loading.tsx` — Shimmer skeleton for invite detail

### Modified Files
- `src/app/actions/staff-users.ts` — Convert revokeMembershipAction and setStaffUserActiveStateAction to accept direct params (not FormData) so the new client components can call them with toast feedback

### Deleted Files
- `src/app/(dashboard)/users/invite-user-form.tsx` — Replaced by invite-dialog.tsx

---

## Task 1: Server Actions for User Management

**Files:**
- Create: `src/app/actions/user-management.ts`

This task creates all the new data-fetching and mutation server actions. No UI yet.

- [ ] **Step 1: Create the server actions file with listUsersForAdmin**

Create `src/app/actions/user-management.ts` with `'use server'` directive. Implement `listUsersForAdmin()`:

- Call `requireAdminScope()`
- Query `profiles` excluding roles `assessor` and `participant`, selecting `id, email, display_name, role, is_active, created_at`
- Query `partner_memberships` (non-revoked) joined to `partners.name` via a second query
- Query `client_memberships` (non-revoked) joined to `clients.name` via a second query
- Query `user_invites` where `accepted_at IS NULL` and `revoked_at IS NULL` and `expires_at > now()`
- For invites, also join tenant name: query the tenant table based on `tenant_type` and `tenant_id`
- Return a typed `UserListItem[]` discriminated union:

```typescript
type ProfileListItem = {
  type: 'profile'
  id: string
  email: string
  displayName: string | null
  role: string
  isActive: boolean
  createdAt: string
  partnerMemberships: Array<{ id: string; partnerId: string; partnerName: string; role: string }>
  clientMemberships: Array<{ id: string; clientId: string; clientName: string; role: string }>
}

type InviteListItem = {
  type: 'invite'
  id: string
  email: string
  role: string
  tenantType: string
  tenantId: string | null
  tenantName: string | null
  expiresAt: string
  createdAt: string
}

type UserListItem = ProfileListItem | InviteListItem
```

- [ ] **Step 2: Add getUserDetail action**

`getUserDetail(profileId: string)` — returns the full profile with all memberships (including revoked ones) and tenant names. Uses `requireAdminScope()`. Returns a typed object or `null` if not found.

- [ ] **Step 3: Add getInviteDetail action**

`getInviteDetail(inviteId: string)` — returns the invite record with tenant name resolved. Uses `requireAdminScope()`. Returns typed object or `null`.

- [ ] **Step 4: Add updateUserRole action**

`updateUserRole(profileId: string, role: UserRole)` — validates role is one of: `platform_admin`, `partner_admin`, `org_admin`, `consultant`. Updates `profiles.role`. Audit logs. Revalidates `/users` and `/users/${profileId}`.

- [ ] **Step 5: Add addMembership action**

`addMembership(profileId: string, tenantType: 'partner' | 'client', tenantId: string, role: 'admin' | 'member')` — uses upsert with `onConflict` to handle re-activation of revoked memberships (clears `revoked_at`). Audit logs. Revalidates paths.

- [ ] **Step 6: Add updateMembershipRole action**

`updateMembershipRole(membershipId: string, tenantType: 'partner' | 'client', role: 'admin' | 'member')` — updates the `role` column on the membership. Audit logs. Revalidates paths.

- [ ] **Step 7: Add resendInvite action**

`resendInvite(inviteId: string)` — validates invite is pending and not revoked. Generates new 32-byte token via `crypto.randomBytes(32).toString('base64url')`, hashes with SHA256, updates `invite_token_hash` and `expires_at` (7 days from now). Audit logs. Returns the new invite URL via `createInviteLink()`.

- [ ] **Step 8: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/actions/user-management.ts
git commit -m "feat(users): add server actions for user management"
```

---

## Task 2: Refactor Existing Staff User Actions

**Files:**
- Modify: `src/app/actions/staff-users.ts`

The existing actions use FormData (for native form submission). The new UI needs to call them directly from client components with toast feedback. Add parallel versions that accept typed params.

- [ ] **Step 1: Add typed wrappers for existing actions**

Add these new exports alongside the existing ones (don't remove the originals — they may still be used by other pages):

```typescript
export async function revokeInviteById(inviteId: string) {
  const scope = await requireAdminScope()
  await revokeInvite(inviteId, scope.actor?.id ?? '')
  revalidatePath('/users')
  return { success: true }
}

export async function revokeMembershipById(membershipId: string, membershipType: 'partner' | 'client') {
  const scope = await requireAdminScope()
  await revokeMembership({
    membershipId,
    membershipType,
    actorProfileId: scope.actor?.id ?? '',
  })
  revalidatePath('/users')
  return { success: true }
}

export async function toggleUserActiveState(profileId: string, isActive: boolean) {
  const scope = await requireAdminScope()
  await setProfileActiveState({
    profileId,
    isActive,
    actorProfileId: scope.actor?.id ?? '',
  })
  revalidatePath('/users')
  revalidatePath(`/users/${profileId}`)
  return { success: true }
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/actions/staff-users.ts
git commit -m "feat(users): add typed wrappers for existing staff user actions"
```

---

## Task 3: Users List Page + Table

**Files:**
- Rewrite: `src/app/(dashboard)/users/page.tsx`
- Create: `src/app/(dashboard)/users/users-table.tsx`
- Create: `src/app/(dashboard)/users/loading.tsx`

- [ ] **Step 1: Create the users-table client component**

Create `src/app/(dashboard)/users/users-table.tsx` ("use client"):

Props: `{ users: UserListItem[], partners: Array<{id: string, name: string}>, clients: Array<{id: string, name: string}> }`

State:
- `activeTab`: 'all' | 'platform' | 'partner' | 'client' (default 'all')
- `statusFilters`: Set<'active' | 'inactive' | 'pending'> (default: active + pending)
- `search`: string (default '')
- `inviteOpen`: boolean (default false)

Render:
- Filter tabs as a row of buttons/pills: All, Platform Admins, Partner Users, Client Users — each with a count badge
- Status pills: Active / Inactive / Pending as toggleable badges
- Search input with debounce
- Table using `<Table>` from shadcn/ui with columns: User, Role, Tenants, Status, Date
- Each row is a `<Link>` to `/users/[id]` or `/users/invite/[inviteId]`
- Avatar initials for profiles, "?" for invites
- Role badges with friendly names (map DB values: `platform_admin` → "Platform Admin", `partner_admin` → "Partner Admin", `org_admin` → "Client Admin", `consultant` → "Member")
- Tenant badges: outline variant, max 3 with "+N" overflow
- Status: emerald dot for Active, muted for Inactive, amber for Pending
- Date: relative format using a helper

Tab filtering logic:
- "All": show everything
- "Platform Admins": profiles where role === 'platform_admin'
- "Partner Users": profiles where role === 'partner_admin' OR (role === 'consultant' AND has partner memberships)
- "Client Users": profiles where role === 'org_admin' OR (role === 'consultant' AND has client memberships)
- Pending invites: map invite roles to tabs — platform_admin → Platform, partner_* → Partner, client_* → Client

Includes an `<InviteDialog>` component (built in Task 4) triggered by `inviteOpen` state.

- [ ] **Step 2: Rewrite the users page server component**

Replace `src/app/(dashboard)/users/page.tsx`:

```typescript
import { requireAdminScope } from "@/lib/auth/authorization"
import { createAdminClient } from "@/lib/supabase/admin"
import { listUsersForAdmin } from "@/app/actions/user-management"
import { PageHeader } from "@/components/page-header"
import { UsersTable } from "./users-table"

export default async function UsersPage() {
  await requireAdminScope()
  const db = createAdminClient()

  const [users, { data: partners }, { data: clients }] = await Promise.all([
    listUsersForAdmin(),
    db.from("partners").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    db.from("clients").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
  ])

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader eyebrow="People" title="Users" description="Manage staff accounts, roles, and workspace memberships." />
      <UsersTable users={users} partners={partners ?? []} clients={clients ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Create the loading skeleton**

Create `src/app/(dashboard)/users/loading.tsx` with `animate-shimmer` skeletons matching the list layout: header area + filter tabs + table rows.

- [ ] **Step 4: Delete old invite-user-form.tsx**

```bash
rm src/app/\(dashboard\)/users/invite-user-form.tsx
```

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/\(dashboard\)/users/
git commit -m "feat(users): redesigned users list page with filterable table"
```

---

## Task 4: Invite Dialog

**Files:**
- Create: `src/app/(dashboard)/users/invite-dialog.tsx`

- [ ] **Step 1: Create the invite dialog component**

Create `src/app/(dashboard)/users/invite-dialog.tsx` ("use client"):

Props: `{ open: boolean, onOpenChange: (open: boolean) => void, partners: Array<{id: string, name: string}>, clients: Array<{id: string, name: string}> }`

Uses `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` from shadcn/ui.

Inside the dialog:
- Email input
- Scope radio group (Platform / Partner / Client) using shadcn RadioGroup or segmented buttons
- Role select (dynamically filtered by scope — same logic as old invite-user-form)
- Tenant combobox (only shown for partner/client scope)
- Send Invite button

On submit: calls `createStaffInviteAction` via `useActionState`. On success: copies invite link to clipboard, shows `toast.success`, closes dialog via `onOpenChange(false)`.

Reuse the role options logic from the old `invite-user-form.tsx`.

- [ ] **Step 2: Wire the dialog into UsersTable**

In `users-table.tsx`, add the "Invite User" button in the header area that sets `inviteOpen = true`. Render `<InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} partners={partners} clients={clients} />`.

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/\(dashboard\)/users/
git commit -m "feat(users): add invite dialog modal"
```

---

## Task 5: User Detail Page

**Files:**
- Create: `src/app/(dashboard)/users/[id]/page.tsx`
- Create: `src/app/(dashboard)/users/[id]/user-detail-client.tsx`
- Create: `src/app/(dashboard)/users/[id]/loading.tsx`

- [ ] **Step 1: Create the user detail server page**

Create `src/app/(dashboard)/users/[id]/page.tsx`:

- `requireAdminScope()`
- Fetch user detail via `getUserDetail(id)` from `user-management.ts`
- If not found, `notFound()`
- Fetch partners and clients lists (for the add membership combobox)
- Render `UserDetailClient` with all data as props

- [ ] **Step 2: Create the user detail client component**

Create `src/app/(dashboard)/users/[id]/user-detail-client.tsx` ("use client"):

Props: `{ user: UserDetailData, partners: Array<{id: string, name: string}>, clients: Array<{id: string, name: string}> }`

Layout sections:

**Header:**
- Back link to `/users` (ArrowLeft + "Users")
- Large avatar (initials from display name or email), name, email, status badge
- Active/inactive toggle (Switch component) — calls `toggleUserActiveState` with toast

**Platform Role card:**
- Current role shown in a Select dropdown with friendly names mapping to DB values
- Save button (Zone 2) — calls `updateUserRole` with toast, save-state pattern (idle → saving → saved)
- Hint text if role implies tenant but no membership exists

**Memberships card:**
- List of partner memberships, then client memberships
- Each row: icon + tenant name, role Select (admin/member) that saves immediately via `updateMembershipRole` with toast, created date, Revoke button
- Revoke opens ConfirmDialog → calls `revokeMembershipById` with toast + undo
- "Add Membership" button at bottom — opens a collapsible section with: tenant type radio, tenant combobox, role select, Save button → calls `addMembership` with toast

**Danger Zone card:**
- Red-bordered card at bottom
- "Deactivate User" / "Reactivate User" button — ConfirmDialog → calls `toggleUserActiveState`

- [ ] **Step 3: Create loading skeleton**

Create `src/app/(dashboard)/users/[id]/loading.tsx` with shimmer skeletons matching the detail layout.

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/\(dashboard\)/users/\[id\]/
git commit -m "feat(users): add user detail page with role and membership management"
```

---

## Task 6: Invite Detail Page

**Files:**
- Create: `src/app/(dashboard)/users/invite/[inviteId]/page.tsx`
- Create: `src/app/(dashboard)/users/invite/[inviteId]/invite-detail-client.tsx`
- Create: `src/app/(dashboard)/users/invite/[inviteId]/loading.tsx`

- [ ] **Step 1: Create the invite detail server page**

Create `src/app/(dashboard)/users/invite/[inviteId]/page.tsx`:

- `requireAdminScope()`
- Fetch invite via `getInviteDetail(inviteId)`
- If not found, `notFound()`
- Render `InviteDetailClient`

- [ ] **Step 2: Create the invite detail client component**

Create `src/app/(dashboard)/users/invite/[inviteId]/invite-detail-client.tsx` ("use client"):

Props: invite detail data

Layout:
- Back link to `/users`
- Email (large text), role badge, tenant name (if applicable)
- Status: "Pending" badge (amber)
- Expiry info: "Expires in N days" or "Expired N days ago" with absolute date tooltip
- Invited date

Actions:
- "Resend Invite" button — calls `resendInvite`, copies new URL to clipboard, toast.success
- "Revoke Invite" button — ConfirmDialog, calls `revokeInviteById`, redirects to `/users` with router.push, toast.success

- [ ] **Step 3: Create loading skeleton**

Create `src/app/(dashboard)/users/invite/[inviteId]/loading.tsx` with shimmer skeleton.

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
git add src/app/\(dashboard\)/users/invite/
git commit -m "feat(users): add invite detail page with resend and revoke"
```

---

## Task 7: Final Verification + Cleanup

**Files:** Various

- [ ] **Step 1: Run a full build**

```bash
npm run build
```

Fix any TypeScript errors or broken imports.

- [ ] **Step 2: Verify all routes work**

- `/users` — list page with filters, table, invite button
- `/users/[id]` — user detail with role editing, memberships, danger zone
- `/users/invite/[inviteId]` — invite detail with resend/revoke
- Invite modal opens and creates invites
- Tab filtering works (All, Platform, Partner, Client)
- Status filtering works (Active, Inactive, Pending)
- Search works

- [ ] **Step 3: Verify dark mode**

Check all new pages in both light and dark mode.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix(users): post-redesign cleanup"
```
