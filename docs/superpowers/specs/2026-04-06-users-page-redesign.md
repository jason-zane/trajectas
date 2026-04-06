# Users Page Redesign

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Redesign the `/users` page with filterable table, user detail/edit page, role and membership management, and invite modal. Platform-admin only.

## Problem

The current users page is a flat list of profiles with a basic invite form at the top. There is no way to filter by role type, no way to edit a user's role or memberships after invite, no search, and pending invites are shown separately from accepted users. As the platform grows, this doesn't scale.

## Design Principles

1. **Single source of truth** — one unified table shows all users (accepted + pending invites) with status badges to distinguish them.
2. **Filter first** — tabs for role categories, pills for status, search by name/email. Finding a user should be fast.
3. **Detail page for editing** — clicking a user navigates to a dedicated page where role and memberships can be fully managed. This scales better than inline editing as users accumulate memberships.
4. **Platform-admin only** — all user management actions require platform admin scope. Partner-scoped management is future work.

## Users List Page (`/users`)

### Layout

- `PageHeader` with eyebrow "People", title "Users", and an "Invite User" button (opens modal)
- Filter tabs below the header
- Secondary filters row with status pills and search
- Table of users

### Filter Tabs

Tabs filter by the user's platform role category:

Tabs filter by the user's platform role category. The users list only shows staff users — `assessor` and `candidate` roles are excluded (they are assessment-takers, not platform staff). Note: the DB enum value is `candidate` (not `participant` — the enum was never renamed).

| Tab | Includes DB roles |
|-----|------------------|
| All | All staff roles |
| Platform Admins | `platform_admin` |
| Partner Users | `partner_admin`, `consultant` (where user has partner memberships) |
| Client Users | `org_admin`, `consultant` (where user has client memberships only) |

Note: `consultant` is a shared DB role used for both partner members and client members. The tab assignment uses memberships to disambiguate — a `consultant` with partner memberships shows under Partner Users; one with only client memberships shows under Client Users; one with both shows in both tabs.

Tabs show a count badge. Active tab is visually highlighted. Selecting a tab filters the table immediately (client-side filter on already-loaded data).

### Secondary Filters

- **Status pills**: Active / Inactive / Pending — multi-select toggles. Default: Active + Pending shown, Inactive hidden.
- **Search input**: filters by display name or email, debounced (300ms). Client-side filtering.

### Table

| Column | Content | Notes |
|--------|---------|-------|
| User | Avatar initials + display name + email (stacked) | For pending invites: email only, avatar shows "?" |
| Role | Platform role badge | e.g. "Platform Admin", "Partner Admin" |
| Tenants | Small badges for partner/client names | Max 3 visible, "+N" overflow. Tooltip shows full list. |
| Status | Active (green) / Inactive (muted) / Pending (amber) | |
| Date | Joined date or Invited date | Relative format ("3d ago") with tooltip for absolute |

Rows are clickable — navigate to `/users/[id]` for accepted users, `/users/invite/[inviteId]` for pending invites.

### Data Source

A new `listUsersForAdmin()` server action that returns a unified list:
- Query `profiles` (excluding `assessor` and `candidate` roles) with their `partner_memberships` (joined to `partners.name`) and `client_memberships` (joined to `clients.name`)
- Query `user_invites` where `accepted_at IS NULL` and `revoked_at IS NULL` and `expires_at > now()`
- Merge into a single typed array sorted by name/email, with a discriminator field (`type: 'profile' | 'invite'`)

## User Detail Page (`/users/[id]`)

### Header

- Back link to `/users`
- Large avatar (initials), display name (read-only here — editable on `/profile`), email (read-only)
- Status badge + active/inactive toggle (Zone 1 — immediate with toast)

### Platform Role Section

- Card with current platform role displayed
- Dropdown to change role. The UI shows friendly names; the action writes DB enum values:

| Display Name | DB Value (`profiles.role`) | Notes |
|-------------|--------------------------|-------|
| Platform Admin | `platform_admin` | Full platform access |
| Partner Admin | `partner_admin` | Manages partner(s) |
| Partner Member | `consultant` | Contributor-level partner access |
| Client Admin | `org_admin` | Manages client org |
| Client Member | `consultant` | Contributor-level client access |

Note: `consultant` is used for both Partner Member and Client Member. The distinction is made by which memberships the user holds, not the profile role alone. When changing to Partner Member or Client Member, the action sets `profiles.role = 'consultant'`.

- Save button (Zone 2 — explicit save). Changing platform role is significant.
- If the new role implies a tenant (e.g. Partner Admin) but the user has no corresponding membership, show an inline hint: "Add a partner membership below to complete this role assignment."
- Server action: `updateUserRole(profileId, newRole)` — accepts the DB enum value, updates `profiles.role`, audit logged

### Memberships Section

- Card listing all partner and client memberships

Each membership row shows:
- Icon (Briefcase for partner, Building2 for client) + tenant name
- Role dropdown (admin / member) — changes save immediately (Zone 1) with toast
- Created date
- Revoke button — opens confirm dialog, soft-revokes via existing `revokeMembershipAction` (sets `revoked_at`, not `deleted_at`), toast with 5s undo

**Add Membership** button at the bottom:
- Opens a popover or inline form
- Tenant type selector: Partner / Client
- Tenant combobox: searchable list of partners or clients
- Role selector: Admin / Member
- Save button creates the membership
- Server action: `addMembership(profileId, tenantType, tenantId, role)` — inserts into `partner_memberships` or `client_memberships`, audit logged
- Validation: prevent duplicate memberships (same profile + same tenant). If a revoked membership exists for the same profile+tenant, re-activate it (clear `revoked_at`) rather than inserting a new row, since there is a unique constraint on `(profile_id, partner_id)` / `(profile_id, client_id)`.

### Danger Zone

At the bottom of the page, visually separated:
- "Deactivate User" button (or "Reactivate" if currently inactive) — confirm dialog, toggles `profiles.is_active` via existing `setStaffUserActiveStateAction`

## Pending Invite Detail Page (`/users/invite/[inviteId]`)

A slimmer detail view for invites that haven't been accepted yet.

### Content

- Back link to `/users`
- Email (large, prominent)
- Intended role badge
- Intended tenant (if partner/client scope) with name
- Invite status: Pending
- Expiry countdown: "Expires in 4 days" or "Expired 2 days ago"
- Invited date

### Actions

- **Resend Invite** — generates a new token, resets expiry to 7 days from now. Toast with the new link copied to clipboard.
- **Revoke Invite** — confirm dialog, soft-deletes via existing `revokeInviteAction`, redirects to `/users` with toast.

Server action: `resendInvite(inviteId)` — validates invite is still pending and not revoked, generates new 32-byte token, hashes with SHA256, updates `invite_token_hash` and `expires_at`, returns new invite URL. This implicitly invalidates the old token. Audit logged.

## Invite Modal

Triggered by the "Invite User" button on the list page. Same fields as today, presented in a dialog:

- **Email** input (required)
- **Scope** radio group: Platform / Partner / Client
- **Role** selector: dynamically filtered based on scope
  - Platform → Platform Admin only
  - Partner → Partner Admin, Partner Member
  - Client → Client Admin, Client Member
- **Tenant** combobox: appears only for Partner/Client scope. Searchable list of partners or clients.
- **"Send Invite" button** — creates invite via existing `createStaffInviteAction`, copies link to clipboard, shows success toast, closes dialog

No changes to the underlying invite mechanics — same 7-day expiry, same token-based flow.

## Server Actions

### New Actions

| Action | Input | Effect |
|--------|-------|--------|
| `listUsersForAdmin()` | none | Returns unified profile + invite list with memberships and tenant names |
| `getUserDetail(profileId)` | profile UUID | Returns profile + all memberships with tenant names |
| `getInviteDetail(inviteId)` | invite UUID | Returns invite record with tenant name |
| `updateUserRole(profileId, role)` | profile UUID, new role | Updates `profiles.role`, audit logged |
| `addMembership(profileId, tenantType, tenantId, role)` | profile UUID, 'partner'\|'client', tenant UUID, 'admin'\|'member' | Creates membership, audit logged. Rejects duplicates. |
| `updateMembershipRole(membershipId, tenantType, role)` | membership UUID, 'partner'\|'client', 'admin'\|'member' | Updates membership role, audit logged |
| `resendInvite(inviteId)` | invite UUID | Regenerates token, resets expiry, returns new URL |

### Existing Actions (unchanged)

- `createStaffInviteAction` — invite creation
- `revokeInviteAction` — soft-delete invite
- `revokeMembershipAction` — soft-delete membership
- `setStaffUserActiveStateAction` — toggle active/inactive

## Persistence Zones

| Element | Zone | Pattern |
|---------|------|---------|
| Active/inactive toggle | Zone 1 (immediate) | Toggle with toast |
| Membership role dropdown | Zone 1 (immediate) | Dropdown change with toast |
| Platform role change | Zone 2 (explicit save) | Dropdown + Save button |
| Add membership | Zone 2 (explicit save) | Form + Save button |
| Revoke membership | Zone 1 (immediate) | Confirm dialog → toast with undo |
| Revoke invite | Zone 1 (immediate) | Confirm dialog → toast, redirect |
| Resend invite | Zone 1 (immediate) | Button → toast with link |

**Zone mixing note:** The user detail page intentionally mixes Zone 1 (toggles, membership role, revoke) with Zone 2 (platform role, add membership). This is acceptable because Zone 2 elements are clearly separated in their own cards with explicit save buttons, and the Zone 1 elements are imperative controls (toggles, dropdowns) per the CLAUDE.md guideline that "imperative controls take effect immediately."

## UI Standards

Per CLAUDE.md:
- Table rows use hover highlighting
- Status badges use appropriate color: Active (emerald), Inactive (muted), Pending (amber)
- Role badges use `--primary` color
- Tenant badges use outline variant
- All mutations show toast feedback
- Confirm dialogs for destructive actions (revoke, deactivate)
- Loading states with `animate-shimmer` skeletons
- Dark mode support throughout
- `loading.tsx` for `/users`, `/users/[id]`, and `/users/invite/[inviteId]` routes

## Route Structure

| Route | Purpose |
|-------|---------|
| `/users` | List page with filters, table, invite modal |
| `/users/[id]` | User detail/edit page (for accepted profiles) |
| `/users/invite/[inviteId]` | Pending invite detail page |

## Out of Scope

- Partner-scoped user management (partner admins managing their own users)
- Avatar upload (profile page handles this)
- Notification preferences
- Bulk user operations
- User activity/audit log view
