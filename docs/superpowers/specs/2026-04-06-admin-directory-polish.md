# Admin Portal Navigation & Directory Polish — Spec A

## Overview

Replace the build-portal-switcher with context-aware "Enter Portal" buttons on client and partner detail pages, powered by support sessions. Polish the client/partner detail pages with a proper overview (stats + details) and add a new Users tab for per-client/partner user management.

**Note:** This spec assumes the terminology rename (`organizations` → `clients`) has been completed first. All references here use "client" terminology.

### Scope

**In scope:**
- Remove `build-portal-switcher` component from sidebar
- Add "Enter Client Portal" / "Enter Partner Portal" buttons on detail Overview pages
- Support session mechanism: new tab + audit trail + scoped view
- "Return to admin" banner in client/partner portals for active support sessions
- Client detail Overview redesign: stats cards + cleaned-up details form
- Partner detail Overview redesign: same pattern
- New Users tab on both client and partner detail pages (platform admin only)
- Fix ownership dropdown `__platform__` raw text display bug
- Investigate and fix the assessments tab bug

**Out of scope:**
- Client-side user self-management (client admins managing their own users from within the client portal)
- Partner portal operational features (partner portal remains cosmetic placeholder)
- Client-side branding self-service editor (Spec B)
- New roles or permissions (use existing `client_memberships.role` and `partner_memberships.role`)

---

## 1. Portal Navigation Changes

### 1.1 Remove `build-portal-switcher`

Delete the switcher component usage from the sidebar:

- Remove import and render of `BuildPortalSwitcher` from `src/components/app-sidebar.tsx`
- The component file itself (`src/components/build-portal-switcher.tsx`) can remain temporarily for reference, then be deleted once "Enter Portal" buttons are verified working

Platform admins no longer use this switcher. They access client/partner portals exclusively through the "Enter Portal" buttons on detail pages.

### 1.2 "Enter Client Portal" button

**Location:** Client detail Overview page (`/clients/[slug]/overview`), prominent primary CTA.

**Behaviour:**
1. Click creates a `support_sessions` row via existing `startSupportSession` service:
   - `actor_profile_id` = current admin's profile ID
   - `target_tenant_type` = `"client"`
   - `target_tenant_id` = this client's ID
   - `reason` = `"Admin portal access"` (default — no user prompt for this iteration)
   - `started_at` = now
   - `expires_at` = now + 4 hours (configurable default)
2. Returns `{ sessionId, sessionKey }` — the key is a secondary HMAC secret used as two-factor validation
3. Opens new tab at the existing launch endpoint: `/client/support/launch?sessionId={id}&sessionKey={key}` (local dev) or `https://client.talentfit.com/support/launch?sessionId={id}&sessionKey={key}` (production with host routing)
4. The existing launch endpoint validates both the session ID and key, sets the support session cookie, and redirects to `/client/dashboard` (or partner dashboard)

**Note:** This leverages the existing support session launch infrastructure (`src/lib/auth/support-launch.ts`, `/client/support/launch` and `/partner/support/launch` routes). The "Enter Portal" button is a new UI affordance, not a new auth mechanism.

### 1.3 "Enter Partner Portal" button

Same as client, but:
- `target_tenant_type` = `"partner"`
- Opens launch URL at `/partner/support/launch?sessionId={id}&sessionKey={key}`
- Launch endpoint redirects to `/partner/dashboard` after session validation
- Partner portal currently shows cosmetic placeholder — button still works, just lands on placeholder

### 1.4 Return to admin mechanism

**When active support session detected in client/partner portal:**
- Top of workspace shell shows a thin banner: "Support session active — viewing {ClientName} as {AdminName}. [Return to admin]"
- Banner uses subtle amber/warning styling (not alarming, but clearly visible)
- "Return to admin" link:
  - Ends the support session (`expires_at` = now)
  - Clears support session cookie
  - Redirects back to `/clients/[slug]/overview` (client) or `/partners/[slug]/overview` (partner)

**Automatic session end:**
- Session expires after 4 hours of inactivity
- Expired session sends user to `/unauthorized?reason=session_expired` with clear message

### 1.5 Support session cookie handling

Support session cookie infrastructure already exists. Verify during implementation:
- Cookie is signed and scoped appropriately per environment
- `resolveAuthorizedScope` already recognises the `supportSession` field — this is the integration point

**Priority in authorization:**
- Support session cookie, if valid, takes precedence over normal active context cookie
- `resolveAuthorizedScope` already has `supportSession` field — leverage this

---

## 2. Client Detail Overview Page

### 2.1 Layout

```
[PageHeader: "Clients" eyebrow, client name, Active/Archived badge]
[Tab bar: Overview | Assessments | Reports | Users | Branding | Settings]

[Summary stats grid — 4 cards]
  - Active Campaigns (number + "X running")
  - Total Participants (across all campaigns)
  - Assigned Assessments (count from client_assessment_assignments)
  - Team Members (count from client_memberships)

[Key Actions row]
  - "Enter Client Portal" button (primary, prominent)

[Client Details section]
  - Existing OrganizationEditForm, cleaned up:
    - Fix ownership display (no raw __platform__)
    - Keep Zone 2 save pattern
```

### 2.2 Ownership dropdown fix

**Current bug:** Dropdown shows `__platform__` raw sentinel value in collapsed state.

**Fix:** Map internal values to display text consistently:
- Internal value `__platform__` → display "Talent Fit (platform-owned)"
- Internal value `{partner_id}` → display partner's name
- Ensure both the closed dropdown state and opened options use the same mapping
- Centralise the mapping in a small helper function

### 2.3 "Enter Client Portal" button UI

- Prominent primary button with external-link icon
- Tooltip on hover: "Opens a new tab to preview this client's portal as an admin"
- Disabled state: "Enter Client Portal (creating session...)" during the brief server action
- Error handling: toast error if session creation fails

---

## 3. Partner Detail Overview Page

Mirror Section 2 for partners:

- Summary stats (adapted for partner context):
  - Client Count (organisations under this partner)
  - Active Campaigns (across all their clients)
  - Partner Members (from `partner_memberships`)
  - Assigned Assessments (if partners have assessment entitlements; otherwise drop card)
- "Enter Partner Portal" button
- Partner Details form (clean up same ownership-style bugs if present)

Partner detail page structure matches client detail:
- Tabs: Overview | Clients | Users | Branding | Settings (partners already have a "Clients" list, not "Assessments")
- **The partner detail tabbed shell does not currently exist and must be created as part of this spec** (partner `[slug]` route currently has only an `edit/` subdirectory, no layout, no overview, no shell)

---

## 4. Users Tab

### 4.1 Client Users tab

**Route:** `/clients/[slug]/users/page.tsx`

**Access:** Platform admin only in this spec. Future iteration may allow client admins to manage their own users.

**Display:**
- Table of users with columns:
  - Name (first + last, or email if no name)
  - Email
  - Role (admin / member)
  - Added (created_at of membership)
  - Last active (if tracked; otherwise hide column)
- Empty state when no members: "No team members yet. Invite someone to get started."

**Actions:**
- **Invite user button** (top right) — opens dialog:
  - Email input
  - Role selector (admin / member)
  - Creates `user_invites` row with `tenant_type='client'`, `tenant_id={clientId}`, `role`, `email`
  - Toast confirmation with invite link or email sent status
- **Row actions** (per user):
  - Change role dropdown (admin ↔ member) — updates `client_memberships.role`, toast on save
  - Remove from client — confirmation dialog, sets `client_memberships.revoked_at = now()`, toast with undo

**Data source:**
- `client_memberships` table, joined with `profiles` for user details
- Active rows only (`revoked_at IS NULL`)

### 4.2 Partner Users tab

Mirror client Users tab:
- Route: `/partners/[slug]/users/page.tsx`
- Same columns, same actions
- Data source: `partner_memberships` joined with `profiles`
- Invite flow creates `user_invites` with `tenant_type='partner'`

### 4.3 Pending invites section

**Below the active users table:**
- Section titled "Pending Invites"
- Rows show: email, role, invited date, expires date
- Actions: Resend invite, Revoke invite (`user_invites.revoked_at = now()`)
- Only shows if there are pending invites (no empty state section)

---

## 5. Bug Fixes

### 5.1 Ownership display fix

See section 2.2.

### 5.2 Assessments tab bug investigation

**Reported issue:** Assessments tab on client detail page "isn't working" (user-reported).

**Investigation steps during implementation:**
- Run dev server, navigate to client detail Assessments tab
- Check browser console for JS errors
- Check server logs for action errors
- Verify `getAssessmentAssignments` returns correctly
- Verify RLS policies don't block platform admin access
- Check component rendering logic

**Fix approach:** Determined during investigation. Most likely candidates:
- Auth/scope mismatch (server action rejecting admin)
- Missing data in Supabase response
- Component crash on empty state

---

## 6. Data Model Changes

No schema changes required. This spec uses existing tables:

- `support_sessions` — already exists (referenced in `src/lib/auth/types.ts` as `SupportSessionRecord`)
- `client_memberships` — exists with `role`, `revoked_at`
- `partner_memberships` — exists with `role`, `revoked_at`
- `user_invites` — exists with `tenant_type`, `tenant_id`, `role`, `email`
- `profiles` — exists with user details

**If `support_sessions` table doesn't fully exist or needs fields:**
- Verify during implementation
- Add migration if required (session ID, actor, target, expires_at fields)

---

## 7. File Structure

### New files

```
src/app/(dashboard)/clients/[slug]/
├── overview/
│   └── client-overview.tsx           — NEW: overview with stats + actions + form
└── users/
    ├── page.tsx                      — NEW: users tab page
    ├── client-users-table.tsx        — NEW: user list component
    ├── invite-user-dialog.tsx        — NEW: invite flow
    └── loading.tsx                   — NEW: shimmer skeleton

src/app/(dashboard)/partners/[slug]/
├── layout.tsx                        — NEW: tabbed shell (if not exists)
├── page.tsx                          — NEW: redirect to overview
├── partner-detail-shell.tsx          — NEW: tab bar (if needed)
├── overview/
│   ├── page.tsx                      — NEW
│   └── partner-overview.tsx          — NEW
└── users/
    ├── page.tsx                      — NEW
    └── partner-users-table.tsx       — NEW (or share with client)

src/components/
├── enter-portal-button.tsx           — NEW: reusable button for both client/partner
└── support-session-banner.tsx        — NEW: return-to-admin banner

src/app/actions/
└── support-sessions.ts               — NEW: create/end/validate session actions

src/lib/auth/
└── support-session-cookie.ts         — NEW: cookie encoding/decoding
```

### Modified files

```
src/components/app-sidebar.tsx        — remove BuildPortalSwitcher
src/components/workspace-shell.tsx    — add SupportSessionBanner for active sessions
src/app/(dashboard)/clients/[slug]/overview/organization-edit-form.tsx
                                       — fix ownership display, embed in new overview layout
src/app/(dashboard)/clients/[slug]/organization-detail-shell.tsx
                                       — add "Users" tab to tab list
```

### Deleted files (after verification)

```
src/components/build-portal-switcher.tsx  — after Enter Portal buttons confirmed working
```

---

## 8. Authorization

- **"Enter Portal" buttons:** Platform admin only. Use `requireAdminScope()` in the server action that creates the session.
- **Users tab read:** Platform admin only in this spec.
- **Users tab mutations:** Platform admin only.
- **Support session resolution:** Already handled by existing `resolveAuthorizedScope` — just ensure support session cookie takes precedence.

---

## 9. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Admin clicks "Enter" but already has active session for another client | End current session, create new one, open new tab |
| Admin's support session expires mid-task in client portal | Next request redirects to `/unauthorized?reason=session_expired` with "Return to admin" link |
| New tab blocked by popup blocker | Show toast: "Popup blocked — allow popups or click [here] to open" |
| Platform admin invites user with existing account | Link existing profile to new membership; no duplicate profiles |
| Invite user with pending invite already | Show error: "This email already has a pending invite" |
| Remove client admin who is the only admin | Show warning, require confirmation, allow it (can be re-added later) |
