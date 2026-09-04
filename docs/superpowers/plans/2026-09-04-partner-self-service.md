# Partner Self-Service — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task, one PR per phase. Steps use checkbox (`- [ ]`) syntax for tracking. Read the whole "Ground rules" section before touching code.

**Status:** ready to execute
**Owner:** Jason
**Created:** 2026-09-04
**Source review:** "Partner Tier Readiness" (https://claude.ai/code/artifact/36506284-1539-4a47-bb35-4100f3e67e1d) — the findings that this plan resolves are summarised in "Why this exists" below so the plan stands alone.

**Goal:** A partner admin can run their own clients from the partner portal the way a platform admin runs any client from the admin console: open a client, edit its details, enable and edit its branding, assign assessments with quotas, assign report templates, invite and manage its users, launch and configure campaigns, and see results — and can do none of that for another partner's clients. The partner portal looks and feels like the client portal, with a dashboard that reads as a portfolio view rather than a card grid.

**Architecture:** Authorization first, UI second. Phase 1 changes the one authorization helper that decides "may this actor manage this client", opens the five entitlement actions and six client-user actions to partner admins, and adds a database trigger for the pool invariant. Phases 2–4 are route and component work that reuse the admin console and client portal components with a handful of new props. Phase 5 makes it demonstrable (seeded partner, e2e journey) and records the decision in the specs.

**Tech stack:** Next.js 16 App Router · React 19 · TypeScript · Supabase (`@supabase/ssr`, RLS, Postgres triggers) · TanStack Table · vitest · Playwright · sonner · lucide-react.

---

## Why this exists (the review in one screen)

Verified on `main` at `d002d3c` on 2026-09-04, against production RLS:

1. **Isolation already holds.** `resolveAuthorizedScope()` derives a partner's reach from `clients.partner_id`; the RLS helpers (`auth_user_client_ids()` etc.) do the same. `tests/integration/tenant-isolation.test.ts` covers cross-partner reads. Nothing in this plan loosens that.
2. **Five entitlement actions reject anyone who is not a platform admin.** `assignAssessment`, `updateAssessmentAssignment`, `removeAssessmentAssignment`, `toggleReportTemplateAssignment`, `toggleClientBranding` in `src/app/actions/client-entitlements.ts`. This was the April 2026 launch decision ("partner admins see the table read-only", `docs/superpowers/specs/2026-04-09-admin-partner-client-polish-design.md` §4/§7). It was never revisited.
3. **No client console in the partner portal.** `src/app/partner/clients/page.tsx` is a flat list; `src/app/partner/clients/[slug]/**` does not exist. The admin console at `src/app/(dashboard)/clients/[slug]/**` is behind `src/app/(dashboard)/layout.tsx`, which requires `scope.isPlatformAdmin`.
4. **Client-user actions exclude partner admins.** `getClientPendingInvites`, `inviteUserToClient`, `reissueClientInvite`, `changeClientMemberRole`, `removeClientMember`, `revokeClientInvite` in `src/app/actions/clients.ts` gate on `scope.clientAdminIds`, which only ever contains *direct* client-admin memberships.
5. **`canManageClient(scope, clientId, clientPartnerId)` grants partner admins only when the caller passes the partner id.** Five of twelve call sites pass two args and therefore exclude partner admins: `src/app/actions/brand.ts:216`, `src/app/api/brand-assets/upload/route.ts:77`, `src/app/actions/email-templates.ts:54`, `src/app/client/settings/brand/client/page.tsx:21`, `src/app/client/settings/users/page.tsx:24`.
6. **Partner campaign detail is read-only** (`src/app/partner/campaigns/[id]/page.tsx`); the client portal has Settings / Branding / Experience / Assessments / Compare tabs for the same campaign.
7. **The partner dashboard** (`src/app/partner/dashboard/page.tsx`) is the old stat-card grid; the client dashboard (`src/app/client/dashboard/client-dashboard.tsx`) is the newer editorial layout the portals are meant to share.
8. **Production has zero partners.** 0 rows in `partners`, 0 in `partner_memberships`, 4 clients with `partner_id IS NULL`. The tier has never carried real data.

---

## Ground rules for the executing agent

Read these once; they apply to every phase.

**Workspace**
- Never work in the primary checkout. For each phase: `scripts/agent-worktree.sh <branch>` from the primary checkout, then `cd` into the printed path and stay there. Branch names are given per phase.
- Fresh worktrees have no `node_modules`: run `npm install` first.
- Local Supabase must be running for anything DB-related: `npm run db:test:start`, then `npm run db:test:reset` after adding a migration.

**One PR per phase**, in order. Do not start Phase N+1 until Phase N is merged to `main` (Phase 3 and Phase 4 may run in parallel after Phase 2 merges).

**Verification gate before every PR** (all must pass locally):
```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:architecture
npm run test:integration:local
npm run build
```
Phase 5 additionally runs `npm run test:e2e:seeded`.

**Migrations** (Phase 1 only): follow AGENTS.md "Migration & deploy flow" exactly. Apply locally (`npm run db:test:reset`), make integration tests green, then apply the same SQL to the live project with the Supabase MCP `apply_migration` **before** opening the PR, then run `get_advisors` (security). If you do not have the Supabase MCP, stop after the local step, say so, and ask Jason to apply the migration file — do not open the PR with an unapplied migration.

**Conventions you must keep**
- Canonical names: `clients` / `client_id` / `campaign_participants`; the `org_admin` role string stays (see AGENTS.md "Naming Conventions").
- Reusable components under `src/components/**` never import `createAdminClient` or `@/lib/supabase/server` (`tests/architecture/no-db-in-components.test.ts`). Pages fetch; components receive props.
- Every Server Action that mutates through the admin client must contain an authorization call (`require*` / `canManage*` / `assert*`) or `tests/architecture/admin-actions-authz.test.ts` fails CI. Do not add entries to its allowlists.
- New integration tests must include the local-host guard (copy the header of `tests/integration/tenant-isolation.test.ts`).
- Every new route gets a `loading.tsx` (copy the nearest admin/client one). Empty states use `<EmptyState>`; banners use `<Alert variant=…>`; tables use `<DataTable>`. Read `docs/ui-standards.md` before Phase 2.
- Commit messages: conventional (`feat(partner): …`, `fix(authz): …`, `test(partner): …`). Never mix dependency bumps into feature commits.

**Do not**
- Do not widen RLS **write** policies on `client_assessment_assignments`, `client_report_template_assignments`, `brand_configs`, `client_memberships`, `user_invites`. Partner writes go through Server Actions, which validate and audit. (Decision D2.)
- Do not change partner-level entitlement actions (`src/app/actions/partner-entitlements.ts`, `partner-taxonomy.ts`) — the platform sets what a partner may sell.
- Do not expose Billing, client-to-partner reassignment, or 360 campaigns to partners.
- Do not edit `src/lib/workspace-portal-config.ts` beyond the two key removals in Task 3.6.
- Do not "fix" `org_admin` → `client_admin` anywhere.

---

## Target model (definition of done)

| Capability | Platform admin | Partner admin (own clients) | Partner member | Client admin (own client) |
|---|---|---|---|---|
| Create client | yes | yes (forced to own partner) | no | no |
| Open client console | yes (`/clients/[slug]`) | yes (`/partner/clients/[slug]`) | no (list only) | own settings pages only |
| Edit details / archive / restore | yes | yes | no | no |
| Move client to another partner | yes | **no** | no | no |
| Enable client branding flag | yes | yes, only while own partner flag is on | no | no |
| Edit client brand layer | yes | yes, only while own partner flag is on | no | yes, when both flags are on |
| Assign assessment to client | yes | yes, from partner pool ∪ partner-owned ∪ client-owned | no | no |
| Set client quota | yes | yes, ≤ partner cap when capped | no | no |
| Assign report template | yes | yes: platform-global or partner-owned | no | no |
| Invite / role / remove / revoke client users | yes | yes | no | yes |
| Client integrations settings | yes | yes | no | no |
| Create / configure campaigns for client | yes | yes (all tabs) | view only | yes |
| Participants, sessions, reports, exports, compare | yes | yes | yes (view) | yes |
| Client email templates | yes | yes | no | no |
| Billing / invoices | yes | **no** | no | no |
| Partner pool, partner quotas, partner branding flag, taxonomy | yes | view only | view only | — |

**Invariants that must hold after every phase**
- A partner never reads or writes another partner's client, campaign, participant, assignment, membership or invite (app scope and RLS).
- A client assignment row is only ever active for an assessment that is in the client's partner pool or owned by that partner (database trigger, all actors).
- Both quota levels are still enforced at use time (`checkQuotaAvailability`); the new assignment-time cap is additional.
- Every entitlement, membership, brand and support-session change still writes an `audit_events` row.
- `isPlatformAdmin` stays false off the admin host; platform admins reach partner/client portals through audited support sessions.

---

## Decisions (resolved — do not reopen inside a task)

- **D1 — One managed-client set.** `AuthorizedScope` gains `managedClientIds` (direct client-admin memberships ∪ every client owned by a partner the actor administers, narrowed by workspace context and support session exactly like `clientIds`). `canManageClient(scope, clientId)` reads it. The third argument is deleted; TypeScript then flags every stale caller.
- **D2 — RLS writes stay platform-admin-only; reads widen; the database enforces the pool invariant.** Partner writes to entitlement/membership/invite tables go through Server Actions on the service-role client (validation + audit). Direct PostgREST writes by partner admins remain denied. `client_memberships_select` and `user_invites_select` widen so partner admins can read rows for their clients. A `BEFORE INSERT OR UPDATE` trigger on `client_assessment_assignments` enforces the pool rule for every actor, including the service role.
- **D3 — Quota cap at assignment time.** If the partner's pool row for that assessment has `quota_limit`, the client `quota_limit` is required and must be ≤ that value. Unlimited partner → any client quota. Over-allocation across clients is allowed (use-time enforcement remains the hard stop).
- **D4 — Owned assessments are always in-pool.** A partner-owned assessment (`assessments.partner_id = clients.partner_id`) is assignable to every client of that partner, and a client-owned assessment (`assessments.client_id = clients.id`) is assignable to that client, with or without a pool row — in both the action check and the trigger. (The local seed's "Seeded Leadership Assessment" is client-owned by Seeded Client Co.)
- **D5 — Partner branding gate = the partner flag.** A partner admin may toggle a client's branding flag and edit a client's brand layer only while `partners.can_customize_branding` is true. The client flag only governs the client's own self-service.
- **D6 — Route-based console.** The client console lives at `/partner/clients/[slug]/<tab>`; it does not depend on the workspace context switcher.
- **D7 — Reuse, don't fork.** Admin console components gain small props (`basePath`, link overrides, `showEnterPortal`); client-portal campaign pages are copied with the `/partner` prefix. No new business components except the dashboard.
- **D8 — Report templates assignable by a partner:** platform-global (`partner_id IS NULL`) or owned by the client's partner. No pool table check for templates (none exists today for admins either).
- **D9 — Dev fallbacks stay in dev.** `resolvePartnerOrg` / `resolveClientOrg` fall back to "first tenant in the database" only on a local host; on production hosts a platform admin without a membership or support session is sent to `/unauthorized`.
- **D10 — Legacy role columns stop being an authority.** The four `auth_user_*` SQL helpers drop their `profiles.partner_id` / `profiles.client_id` fallback arms; memberships are the single source of truth in both layers. Guarded by a production pre-flight query.
- **D11 — Campaign Branding tab in the partner portal** is shown when the partner flag is on (same gate as D5).
- **D12 — Dashboard direction:** mirror the client dashboard's editorial layout (mono gold eyebrows, one headline metric with sparkline, framing stats, prioritised lists, `EmptyState`s), with portfolio-level content: allocation usage, clients needing attention, cross-client "what's moving".
- **D13 — Stays admin-only:** partner pool/quota/flag/taxonomy, client-to-partner reassignment, billing, Leadership 360.
- **D14 — `/partner/results` and `/partner/matching` placeholder pages are removed** (catch-all keys deleted).

---

## File map

**Create**
```
supabase/migrations/20260905090000_partner_managed_clients.sql
supabase/migrations/20260905090100_auth_helpers_memberships_only.sql

src/app/actions/partner-dashboard.ts
src/lib/dal/partner-dashboard.ts
src/lib/dal/partner-dashboard-mappers.ts

src/app/partner/clients/[slug]/layout.tsx
src/app/partner/clients/[slug]/page.tsx
src/app/partner/clients/[slug]/overview/{page,loading}.tsx
src/app/partner/clients/[slug]/details/{page,loading}.tsx
src/app/partner/clients/[slug]/branding/{page,layout,loading}.tsx
src/app/partner/clients/[slug]/assessments/{page,loading}.tsx
src/app/partner/clients/[slug]/reports/{page,loading}.tsx
src/app/partner/clients/[slug]/users/{page,loading}.tsx
src/app/partner/clients/[slug]/settings/{page,loading}.tsx

src/app/partner/campaigns/[id]/overview/{page,layout,loading}.tsx
src/app/partner/campaigns/[id]/participants/{page,loading}.tsx
src/app/partner/campaigns/[id]/assessments/{page,loading}.tsx
src/app/partner/campaigns/[id]/experience/{page,loading}.tsx
src/app/partner/campaigns/[id]/branding/{page,loading}.tsx
src/app/partner/campaigns/[id]/settings/{page,loading}.tsx
src/app/partner/campaigns/[id]/compare/{page,loading}.tsx
src/app/partner/participants/compare/{page,loading}.tsx
src/app/partner/settings/email-templates/{page,loading}.tsx            (optional, Task 3.5)
src/app/partner/settings/email-templates/[type]/{page,loading}.tsx     (optional, Task 3.5)

src/app/partner/dashboard/partner-dashboard.tsx

tests/integration/partner-managed-clients.test.ts
tests/e2e/seeded/partner-auth.setup.ts
tests/e2e/seeded/partner-portal.spec.ts

docs/superpowers/specs/2026-09-04-partner-self-service-design.md
```

**Modify**
```
src/lib/auth/authorization.ts                       managedClientIds, isLocalDevelopment, canManageClient
src/lib/auth/workspace-bootstrap.ts                 createAnonymousScope fields
src/lib/auth/resolve-partner-org.ts                 D9
src/lib/auth/resolve-client-org.ts                  D9
src/app/actions/clients.ts                          client-user actions, getClientMembers, revalidation
src/app/actions/client-entitlements.ts              five actions, quota cap, template rule, branding gate
src/app/actions/partner-entitlements.ts             + getPartnerBrandingEnabled
src/app/actions/integrations.ts                     canManageClient call sites
src/app/(dashboard)/clients/[slug]/{details,overview}/page.tsx   call sites
src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx       basePath
src/app/(dashboard)/clients/[slug]/overview/{client-overview,client-stats}.tsx   path props
src/app/(dashboard)/clients/[slug]/details/client-details-form.tsx               path props
src/app/(dashboard)/clients/[slug]/assessments/assessment-assignments.tsx        prop type, partner cap UI
src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx            message prop
src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx                     branding tab gate
src/app/partner/clients/{page,clients-table}.tsx    row links, EmptyState
src/app/partner/campaigns/[id]/{layout,page}.tsx    shell + redirect (replaces read-only page)
src/app/partner/participants/participants-table.tsx  compare bulk action
src/app/partner/dashboard/{page,loading}.tsx        redesign
src/components/app-sidebar.tsx                      partnerNav / partnerSettingsNav
src/lib/workspace-portal-config.ts                  remove results, matching
tests/unit/authorization-rules.test.ts
tests/integration/org-diagnostic-rls.test.ts        insert memberships (D10)
tests/e2e/seeded/auth.ts, playwright.config.ts, supabase/seed.sql
docs/superpowers/specs/2026-03-30-surface-security-and-ownership-architecture.md
docs/superpowers/specs/2026-04-09-admin-partner-client-polish-design.md
AGENTS.md
```

---

## Phase 1 — Authorization foundation

**Branch:** `feat/partner-managed-clients-authz` · **PR title:** `feat(authz): partner admins manage their own clients` · **Size:** M (2–3 days)

This phase changes security posture and ships alone. Nothing in it is user-visible except that the client portal's brand and users pages now accept partner admins.

> **Execution notes (2026-09-04, from the Codex review of PR #383) — now part of the design:**
> 1. Entitlement actions gate on `canManageClientEntitlements(scope, clientId, partnerId)`: platform admin, or admin of the partner that owns the client (and the client is in the managed set). Client admins never set their own entitlements, as the target matrix says; `canManageClient` alone would have let them.
> 2. D5 is enforced where the brand is written, not only on the flag toggle: `assertCanEditClientBrand` (`src/lib/brand/brand-write-authorization.ts`) runs in `upsertBrandConfig`, `resetBrandToDefault` and the brand-asset upload route. Partner admins need the partner flag; client admins need both flags; platform admins are exempt. Reads are not gated.
> 3. The pool invariant also holds against parent-side changes: `clients.partner_id` may not change to a partner while the client holds active assignments outside that partner's allocation, and a pool row may not be deactivated or deleted while active client assignments depend on it (archived partners exempt, so `deletePartner` still works). Migration `20260905090100_partner_pool_parent_guards.sql`.
> 4. In a partner support session the managed set is resolved from the partner's clients directly, not filtered out of the admin's own (usually empty) memberships — the same resolution #381 applies to `clientIds`.

### Pre-flight

- [ ] **Step 0a.** Create the worktree and install.
```bash
scripts/agent-worktree.sh feat/partner-managed-clients-authz
cd <printed path>
npm install
npm run db:test:start
```
- [ ] **Step 0b.** Confirm the baseline is green: `npm run test:unit && npm run test:architecture`.
- [ ] **Step 0c.** Check whether `is_unconfined_platform_admin` has landed on `main`: `grep -rl is_unconfined_platform_admin supabase/migrations`. If it has, every policy body in Task 1.4 that says `is_platform_admin()` must say `is_unconfined_platform_admin()` instead (that branch confines platform admins inside support sessions; do not undo it).

### Task 1.1 — `managedClientIds` in the scope; `canManageClient` becomes two-argument

**Files:** `src/lib/auth/authorization.ts`, `src/lib/auth/workspace-bootstrap.ts`, `tests/unit/authorization-rules.test.ts`, plus every call site listed below.

- [ ] **Step 1.** Extend the interface (`authorization.ts`, `AuthorizedScope`):
```ts
  clientAdminIds: string[];
  /**
   * Clients the actor may MANAGE: direct client-admin memberships plus every
   * client owned by a partner the actor administers. Narrowed by the active
   * workspace context and by support sessions exactly like `clientIds`.
   * `canManageClient` reads this — callers never reconstruct it.
   */
  managedClientIds: string[];
  /** True when the request host is localhost. Dev conveniences only. */
  isLocalDevelopment: boolean;
  supportSession: SupportSessionRecord | null;
```

- [ ] **Step 2.** Local-dev bypass branch (the early `return` inside `if (!actor && localDevBypass)`): add `managedClientIds: clientIds,` and `isLocalDevelopment: true,`.

- [ ] **Step 3.** Real-actor branch. After `const partnerClientIds = Array.from(clientPartnerMap.keys());` add:
```ts
  // Every client owned by a partner the actor ADMINISTERS (not merely belongs to).
  const partnerManagedClientIds = Array.from(clientPartnerMap.entries())
    .filter(([, partnerId]) => actorPartnerAdminIds.includes(partnerId))
    .map(([clientId]) => clientId);
```
and after `let clientAdminIds = directClientAdminIds;` add:
```ts
  let managedClientIds = dedupe([...directClientAdminIds, ...partnerManagedClientIds]);
```
Then narrow it in each existing branch:
  - support session, partner target: `managedClientIds = clientIds;` (the `clientIds` already computed for that branch — all of the target partner's clients)
  - support session, client target: `managedClientIds = [supportSession.targetTenantId];`
  - active partner context (inside the `if (isPlatformAdmin || actorPartnerIds.includes(...))` block): `managedClientIds = managedClientIds.filter((id) => clientIds.includes(id));`
  - active client context (inside its `if`): `managedClientIds = managedClientIds.includes(activeContext.tenantId) ? [activeContext.tenantId] : [];`
Return `managedClientIds` and `isLocalDevelopment: requestEnvironment.isLocalDevelopment` in the final object.

- [ ] **Step 4.** Replace `canManageClient`:
```ts
export function canManageClient(scope: AuthorizedScope, clientId: string) {
  return scope.isPlatformAdmin || scope.managedClientIds.includes(clientId);
}
```

- [ ] **Step 5.** `workspace-bootstrap.ts` → `createAnonymousScope`: add `managedClientIds: [],` and `isLocalDevelopment: false,`. Then `grep -rn "clientAdminIds:" src tests` and add both fields to every other literal `AuthorizedScope` (expected: `tests/unit/authorization-rules.test.ts` `createScope`, possibly `tests/unit/workspace-bootstrap.test.ts`).

- [ ] **Step 6.** Fix the three-argument callers (TypeScript will list them; expected set):
  - `src/app/actions/clients.ts` lines ~262, ~325, ~489 → `canManageClient(access.scope, id)`
  - `src/app/actions/integrations.ts` lines ~115, ~178 → `canManageClient(access.scope, access.clientId)`
  - `src/app/(dashboard)/clients/[slug]/details/page.tsx:22`, `overview/page.tsx:21` → `canManageClient(scope, client.id)`
  The two-argument callers (`brand.ts:216`, `email-templates.ts:54`, `api/brand-assets/upload/route.ts:77`, `client/settings/brand/client/page.tsx:21`, `client/settings/users/page.tsx:24`) need no edit and now admit partner admins.

- [ ] **Step 7.** `src/app/actions/clients.ts` → `getClientMembers`: replace the hand-rolled `isPartnerAdminOfClient` block with `if (!canManageClient(access.scope, clientId)) return [];`.

- [ ] **Step 8.** Unit tests (`tests/unit/authorization-rules.test.ts`):
  - `createScope` defaults: `managedClientIds: []`, `isLocalDevelopment: false`.
  - `partnerAScope`: add `managedClientIds: ["client-a1", "client-a2"]`.
  - Convert every `canManageClient(x, y, z)` call to two arguments; the "unknown partner relationship" test becomes `expect(canManageClient(partnerAScope, "client-x")).toBe(false)`.
  - Add: partner member scope (`partnerIds: ["partner-a"]`, `clientIds: [...]`, `managedClientIds: []`) → `canManageClient(..., "client-a1")` is `false`.
  - Add: client admin scope with `managedClientIds: ["client-1"]` → `true` for `client-1`, `false` for `client-2`.
  - Add: "partner admin narrowed to a client context" — `managedClientIds: ["client-a1"]` only → `client-a2` is `false`.

- [ ] **Step 9.** `npm run typecheck && npm run test:unit`. Expected: green, and `grep -rn "canManageClient(.*,.*,.*)" src` returns nothing.

### Task 1.2 — Client-user actions accept partner admins

**File:** `src/app/actions/clients.ts`

- [ ] **Step 1.** In `getClientPendingInvites`, `inviteUserToClient`, `reissueClientInvite`, `changeClientMemberRole`, `removeClientMember`, `revokeClientInvite` replace
```ts
if (!access.scope.isPlatformAdmin && !access.scope.clientAdminIds.includes(clientId)) {
```
with
```ts
if (!canManageClient(access.scope, clientId)) {
```
(keep each function's existing error message).

- [ ] **Step 2.** `getClientPendingInvites`: switch `const db = await createSupabaseClient()` to `const db = createAdminClient()` (same pattern as `getClientMembers`; the gate above already authorised the read). Keep the query unchanged.

- [ ] **Step 3.** Everywhere in this file that calls `revalidatePath('/clients')` or `revalidatePath(\`/clients\`)`, add `revalidatePath('/partner/clients', 'layout')` beside it. Also add `revalidatePath('/partner/clients')` to `revalidateDirectoryPaths()`.

- [ ] **Step 4.** `npm run test:architecture` — the admin-actions-authz scan must still find a gate in each function (it does: `requireClientAccess` + `canManageClient`).

### Task 1.3 — Entitlement actions accept partner admins, with the pool, cap and branding rules

**File:** `src/app/actions/client-entitlements.ts`

- [ ] **Step 1.** Import: `import { canManageClient, requireClientAccess } from '@/lib/auth/authorization'`.

- [ ] **Step 2.** In `assignAssessment`, `updateAssessmentAssignment`, `toggleReportTemplateAssignment`, `toggleClientBranding` replace
```ts
if (!scope.isPlatformAdmin) {
  return { error: 'Only platform administrators can …' }
}
```
with
```ts
if (!canManageClient(scope, clientId)) {
  return { error: 'You do not have permission to manage this client.' }
}
```
(`removeAssessmentAssignment` delegates to `updateAssessmentAssignment`; nothing to change.)

- [ ] **Step 3.** Add a private helper (D3 + D4) and use it from both `assignAssessment` and `updateAssessmentAssignment`:
```ts
/**
 * Partner pool + cap rule (D3/D4). Returns an error string, or null when the
 * assignment is allowed. Platform-owned clients (no partner) always pass.
 */
async function checkPartnerPoolAndCap(
  db: ReturnType<typeof createAdminClient>,
  clientId: string,
  assessmentId: string,
  quotaLimit: number | null | undefined,
): Promise<string | null> {
  const { data: clientRow, error: clientError } = await db
    .from('clients').select('partner_id').eq('id', clientId).single()
  if (clientError) return clientError.message
  const partnerId = clientRow?.partner_id ? String(clientRow.partner_id) : null
  if (!partnerId) return null

  const [{ data: pool, error: poolError }, { data: assessment, error: assessmentError }] =
    await Promise.all([
      db.from('partner_assessment_assignments')
        .select('quota_limit')
        .eq('partner_id', partnerId).eq('assessment_id', assessmentId).eq('is_active', true)
        .maybeSingle(),
      db.from('assessments').select('partner_id, client_id').eq('id', assessmentId).single(),
    ])
  if (poolError) return poolError.message
  if (assessmentError) return assessmentError.message

  // D4: owned assessments never need a pool row.
  const partnerOwned = assessment?.partner_id != null && String(assessment.partner_id) === partnerId
  const clientOwned = assessment?.client_id != null && String(assessment.client_id) === clientId
  if (!pool && !partnerOwned && !clientOwned) {
    return "This assessment is not available through the partner's allocation."
  }
  const cap = pool?.quota_limit ?? null
  if (cap != null) {
    if (quotaLimit == null) return `Set a quota of at most ${cap}: this assessment is capped for your partner.`
    if (quotaLimit > cap) return `Quota cannot exceed the partner allocation of ${cap}.`
  }
  return null
}
```
  - `assignAssessment`: delete the inline "verify assessment is in partner's pool" block and replace with `const poolError = await checkPartnerPoolAndCap(db, clientId, input.assessmentId, input.quotaLimit ?? null); if (poolError) return { error: poolError }` (before the insert).
  - `updateAssessmentAssignment`: after fetching `previous`, if `updates.quotaLimit !== undefined` call the helper with `previous.assessment_id` and `updates.quotaLimit`; return the error if any.

- [ ] **Step 4.** `toggleReportTemplateAssignment` (D8): when `assigned` is true and `!scope.isPlatformAdmin`, load `report_templates.partner_id` for `reportTemplateId` and `clients.partner_id` for `clientId`; if the template's `partner_id` is non-null and differs from the client's partner, return `{ error: 'This report template is not available to your partner.' }`.

- [ ] **Step 5.** `toggleClientBranding` (D5): when `canCustomize` is true and `!scope.isPlatformAdmin`, load the client's `partner_id`; if set, load `partners.can_customize_branding`; if false return `{ error: 'Brand customisation is not enabled for your partner. Contact Trajectas to enable it.' }`.

- [ ] **Step 6.** Beside every `revalidatePath('/clients')` in this file add `revalidatePath('/partner/clients', 'layout')`. In `toggleClientBranding` the existing pair becomes three: `/clients` (layout), `/client` (layout), `/partner/clients` (layout).

- [ ] **Step 7.** `npm run typecheck && npm run test:architecture`.

### Task 1.4 — Migration: read parity, pool trigger, memberships-only helpers

> **Sequencing note (added during execution, 2026-09-04).** PR #381 (`feat(security): confine support sessions in Postgres, not just the app`) rewrites the same four `auth_user_*` helpers and the `client_memberships_select` policy, and was open with CI running when Phase 1 started. To avoid a merge-order race on those objects, Phase 1 ships **only the pool trigger** (Step 1 §2) as `supabase/migrations/20260905090000_client_assignment_partner_pool_guard.sql`. The read-parity policies (Step 1 §1), the memberships-only helpers (Steps 3–5) and the matching integration cases (Task 1.6 Steps 1 and 5) move to a follow-up PR that starts after #381 merges and takes #381's function bodies as its base. Everything else in Phase 1 is unaffected.

**Files:** `supabase/migrations/20260905090000_partner_managed_clients.sql`, `supabase/migrations/20260905090100_auth_helpers_memberships_only.sql`, `tests/integration/org-diagnostic-rls.test.ts`

- [ ] **Step 1.** Write `20260905090000_partner_managed_clients.sql` (respect Step 0c for the admin helper name):
```sql
-- =============================================================================
-- Partner-managed clients (D2): partner admins READ memberships/invites of the
-- clients they own; writes stay platform-admin-only at the RLS layer and flow
-- through Server Actions. The pool invariant moves into the database so it
-- holds for every actor, including the service role.
-- =============================================================================

-- 1. Read parity -------------------------------------------------------------
DROP POLICY IF EXISTS client_memberships_select ON public.client_memberships;
CREATE POLICY client_memberships_select ON public.client_memberships
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR profile_id = (SELECT auth.uid())
    OR client_id = ANY (auth_user_client_admin_ids())
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.partner_id = ANY (auth_user_partner_admin_ids())
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS user_invites_select ON public.user_invites;
CREATE POLICY user_invites_select ON public.user_invites
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (tenant_type = 'partner' AND tenant_id = ANY (auth_user_partner_admin_ids()))
    OR (tenant_type = 'client'  AND tenant_id = ANY (auth_user_client_admin_ids()))
    OR (tenant_type = 'client'  AND tenant_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.partner_id = ANY (auth_user_partner_admin_ids())
        AND c.deleted_at IS NULL
    ))
  );

-- 2. Pool invariant (D4 included: partner-owned assessments are always in-pool)
CREATE OR REPLACE FUNCTION public.enforce_client_assignment_in_partner_pool()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_partner_id uuid;
  v_assessment_partner_id uuid;
  v_assessment_client_id uuid;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW; -- deactivating is always allowed
  END IF;

  SELECT partner_id INTO v_partner_id FROM public.clients WHERE id = NEW.client_id;
  IF v_partner_id IS NULL THEN
    RETURN NEW; -- platform-owned client: no pool to check
  END IF;

  SELECT partner_id, client_id INTO v_assessment_partner_id, v_assessment_client_id
  FROM public.assessments WHERE id = NEW.assessment_id;
  IF v_assessment_partner_id = v_partner_id OR v_assessment_client_id = NEW.client_id THEN
    RETURN NEW; -- D4: partner-owned or client-owned assessment
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.partner_assessment_assignments paa
    WHERE paa.partner_id = v_partner_id
      AND paa.assessment_id = NEW.assessment_id
      AND paa.is_active = true
  ) THEN
    RAISE EXCEPTION 'assessment % is not in the partner pool for client %',
      NEW.assessment_id, NEW.client_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_client_assignment_in_partner_pool() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_client_assignment_partner_pool ON public.client_assessment_assignments;
CREATE TRIGGER trg_client_assignment_partner_pool
  BEFORE INSERT OR UPDATE OF assessment_id, client_id, is_active
  ON public.client_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_assignment_in_partner_pool();
```

- [ ] **Step 2.** Pre-flight for the trigger — run against local and (via MCP `execute_sql`) production; both must return 0 rows before the migration is applied to that database:
```sql
SELECT caa.id, caa.client_id, caa.assessment_id
FROM client_assessment_assignments caa
JOIN clients c ON c.id = caa.client_id
LEFT JOIN assessments a ON a.id = caa.assessment_id
WHERE caa.is_active
  AND c.partner_id IS NOT NULL
  AND a.partner_id IS DISTINCT FROM c.partner_id
  AND a.client_id IS DISTINCT FROM caa.client_id
  AND NOT EXISTS (
    SELECT 1 FROM partner_assessment_assignments p
    WHERE p.partner_id = c.partner_id AND p.assessment_id = caa.assessment_id AND p.is_active
  );
```
If production returns rows, stop and report them; do not deactivate anything yourself.

- [ ] **Step 3.** Write `20260905090100_auth_helpers_memberships_only.sql` (D10). Recreate the four helpers with the `legacy_*` CTEs removed. Take the current bodies from the database (`\sf public.auth_user_client_ids` etc. via `docker exec supabase_db_trajectas-local psql -U postgres -d postgres -c '\sf public.auth_user_client_ids'`) and delete only the `legacy_partner_ids` / `legacy_partner_admin_ids` / `legacy_client_ids` / `legacy_client_admin_ids` CTEs and their `UNION` arms. Keep `SECURITY DEFINER`, `STABLE`, `SET search_path TO 'public'`, and the support-session `CASE` arms untouched. Functions: `auth_user_partner_ids`, `auth_user_partner_admin_ids`, `auth_user_client_ids`, `auth_user_client_admin_ids`. Prefix the file with a comment naming D10 and the pre-flight below.

- [ ] **Step 4.** Pre-flight for D10 — production, via MCP `execute_sql`; must return 0 rows (it returned 0 on 2026-09-04: all three `org_admin` profiles have memberships):
```sql
SELECT p.id, p.role
FROM profiles p
WHERE (p.partner_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM partner_memberships pm WHERE pm.profile_id = p.id AND pm.revoked_at IS NULL))
   OR (p.client_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM client_memberships cm WHERE cm.profile_id = p.id AND cm.revoked_at IS NULL));
```
If it returns rows, insert the missing membership rows (`role = 'admin'` for `partner_admin`/`org_admin`, `'member'` for `consultant`, `is_default = true`) before applying, and record what you inserted in the PR description.

- [ ] **Step 5.** `tests/integration/org-diagnostic-rls.test.ts` relies on the legacy arms (it calls `createTestUser` with `clientId`/`partnerId` and never inserts memberships). After each of its three tenant-scoped `createTestUser` calls, insert the membership the same way `tests/integration/tenant-isolation.test.ts` does (lines ~192–224): `partner_memberships` row `{ profile_id, partner_id, role: 'admin', is_default: true }` for the partner admin; `client_memberships` rows `{ profile_id, client_id, role: 'admin', is_default: true }` for the two client admins. Add the corresponding deletes to its cleanup. Check the other integration files with `grep -l "createTestUser" tests/integration/*.ts | xargs grep -L "memberships"` — any file that appears there and passes `partnerId`/`clientId` needs the same treatment.

- [ ] **Step 6.** Apply locally and prove replay: `npm run db:test:reset`, then `scripts/pg-migrate-check.sh --fresh` (see `scripts/README-pg-migrate-check.md`; it needs Postgres 16 server binaries — if they are not installed locally, the `db:test:reset` replay plus the CI `integration` job are sufficient). Expected: both migrations apply cleanly on an empty database.

- [ ] **Step 7.** Apply both migration files to production with the Supabase MCP `apply_migration` (name them `partner_managed_clients` and `auth_helpers_memberships_only`), then run `get_advisors` with type `security`. Expected: no new findings. If you cannot do this step, stop and hand the two files to Jason.

### Task 1.5 — Dev fallbacks confined to local hosts (D9)

**Files:** `src/lib/auth/resolve-partner-org.ts`, `src/lib/auth/resolve-client-org.ts`

- [ ] **Step 1.** In both files change the fallback condition from
```ts
if (!partnerId && (hasPlatformAdminRole || scope.isLocalDevelopmentBypass)) {
```
to
```ts
if (!partnerId && (scope.isLocalDevelopmentBypass || (hasPlatformAdminRole && scope.isLocalDevelopment))) {
```
(same shape for `clientId` in `resolve-client-org.ts`).

- [ ] **Step 2.** In both files, after the fallback block: if the id is still null and `hasPlatformAdminRole && !scope.isLocalDevelopment`, `redirect("/unauthorized?reason=membership")`. Update the doc comment: on production hosts platform admins enter these portals only through "Enter portal" (support sessions).

- [ ] **Step 3.** `npm run typecheck`.

### Task 1.6 — Integration test for the new database behaviour

**File:** `tests/integration/partner-managed-clients.test.ts` (copy the header, `canRun` guard, `testEmail`/`testSlug` helpers and the fixture style from `tests/integration/tenant-isolation.test.ts`; create assessments the way `tests/integration/response-data-and-library-rls.test.ts` does).

> **Sequencing note:** Steps 1 and 5 depend on the deferred migration pieces (see Task 1.4) and move to the follow-up PR; Phase 1 ships Steps 2–4 plus a read-isolation check on `client_assessment_assignments`.

Fixture: Partner A (admin user `partnerAAdminDb`, membership role `admin`), Partner B; Client A1 (partner A) with a client-admin user, Client B1 (partner B); assessment X in Partner A's pool (`partner_assessment_assignments`, `quota_limit 10`), assessment Y not in any pool, assessment Z owned by Partner A (`assessments.partner_id = A`), assessment W owned by Client A1 (`assessments.client_id = A1`); a pending `user_invites` row for A1 and one for B1.

- [ ] **Step 1.** Read parity: partner A admin selects `client_memberships` where `client_id = A1` → the A1 admin's row is visible; where `client_id = B1` → empty. Same shape for `user_invites` (`tenant_type = 'client'`).
- [ ] **Step 2.** Writes still denied at RLS: partner A admin `insert` into `client_assessment_assignments` `{ client_id: A1, assessment_id: X }` → error; the row does not exist afterwards (check with the admin client).
- [ ] **Step 3.** Trigger, positive: service role inserts `{ A1, X, quota_limit: 5 }` → ok; `{ A1, Z }` (partner-owned) → ok; `{ A1, W }` (client-owned) → ok; a platform-owned client (no partner) with `Y` → ok.
- [ ] **Step 4.** Trigger, negative: service role inserts `{ A1, Y }` → error whose message contains `not in the partner pool`. Deactivating (`is_active: false`) an existing `{ A1, Y }` row that you insert with the trigger temporarily disabled is NOT needed — instead assert that updating `{ A1, X }` to `is_active: false` succeeds.
- [ ] **Step 5.** D10: a profile with `partner_id = A` and no membership row (create it with `createTestUser` and do not add a membership) sees zero `clients` rows through RLS.
- [ ] **Step 6.** `npm run test:integration:local -- tests/integration/partner-managed-clients.test.ts` then the full `npm run test:integration:local`.

### Task 1.7 — Ship Phase 1

- [ ] Run the full verification gate. Commit in three commits: `feat(authz): resolve managedClientIds in the scope`, `feat(authz): open client entitlement and user actions to partner admins`, `feat(db): partner read parity, pool trigger, memberships-only helpers`.
- [ ] `gh pr create` with a body that lists D1–D5, D9, D10 and the two pre-flight query results. `gh pr checks <n> --watch`. Merge with `gh pr merge --squash --delete-branch`, then prune the local branch and remove the worktree.

---

## Phase 2 — Partner client console

**Branch:** `feat/partner-client-console` · **PR title:** `feat(partner): client console under /partner/clients/[slug]` · **Size:** L (3–4 days)

### Task 2.1 — Small props on the admin console components (D7)

- [ ] **Step 1.** `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`: add `basePath?: string` (default `` `/clients/${client.slug}` ``) and use it for `RouteTabs basePath`. Keep the existing `isPlatformAdmin` billing filter.

- [ ] **Step 2.** `overview/client-stats.tsx`: add `basePath?: string` (default `` `/clients/${props.clientSlug}` ``); links become `` `${basePath}/${stat.segment}` ``.

- [ ] **Step 3.** `overview/client-overview.tsx`: add props
```ts
  basePath?: string;            // default `/clients/${client.slug}`
  campaignsHref?: string;       // default `${basePath}/campaigns`
  partnerHref?: string | null;  // default `/partners/${partnerSlug ?? client.partnerId}/overview`; null → plain text
  showEnterPortal?: boolean;    // default true
```
Build `quickActions` from `basePath` (assessments, users) and `campaignsHref`; pass `basePath` to `ClientStats`; render the partner name as plain text when `partnerHref` is null; render `EnterPortalButton` only when `showEnterPortal`.

- [ ] **Step 4.** `details/client-details-form.tsx`: add `archiveRedirectPath?: string` (default `"/directory?tab=clients"`, used in the archive timeout) and `ownershipLinkHref?: string | null` (default `"/partners"`; when null render "Managed by your partner organisation" without a link).

- [ ] **Step 5.** `assessments/assessment-assignments.tsx`:
  - Narrow the prop: `allAssessments: Array<Pick<AssessmentWithMeta, "id" | "title" | "status">>` (the component only reads `id`, `title`, `status`; the admin page's `AssessmentWithMeta[]` still satisfies it).
  - Add `partnerPool?: Array<{ assessmentId: string; quotaLimit: number | null; quotaUsed: number }>`.
  - In the assign dialog, when the selected assessment has a pool entry with a non-null `quotaLimit`: show a caption `Partner allocation: {quotaUsed} of {quotaLimit} used`, disable the "Unlimited" switch (force a numeric quota), and clamp/validate the input to `≤ quotaLimit` with an inline error. The server rule (Task 1.3) is the authority; this is guidance.
  - In the table's quota cell show the same caption under the client quota when a cap exists.

- [ ] **Step 6.** `settings/client-settings-panel.tsx`: add `partnerBrandingDisabledMessage?: string` (default: the current "controlled by the partner" sentence) so the partner console can say "Enable brand customisation for your partner organisation first — Trajectas controls this."

- [ ] **Step 7.** `npm run typecheck`; the admin pages must render exactly as before (no prop passed → defaults).

### Task 2.2 — Partner flag read helper

**File:** `src/app/actions/partner-entitlements.ts`

- [ ] **Step 1.** Add:
```ts
export async function getPartnerBrandingEnabled(partnerId: string): Promise<boolean> {
  const parsed = partnerIdSchema.safeParse({ partnerId })
  if (!parsed.success) return false
  await requirePartnerAccess(partnerId)
  const db = await createClient()
  const { data, error } = await db
    .from('partners').select('can_customize_branding').eq('id', partnerId).single()
  if (error) throwActionError('getPartnerBrandingEnabled', 'Unable to load partner settings.', error)
  return Boolean(data?.can_customize_branding)
}
```

### Task 2.3 — Routes

All pages resolve the client with `getClientBySlug(slug, { includeArchived: true })` (partner-accessible today) and the partner with `resolvePartnerOrg(...)`. Every page redirects to `/unauthorized?reason=membership` when `!canManageClient(scope, client.id)` or when `client.partnerId !== partnerId`.

- [ ] **Step 1.** `src/app/partner/clients/[slug]/layout.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { getClientBySlug } from "@/app/actions/clients";
import { canManageClient, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { ClientDetailShell } from "@/app/(dashboard)/clients/[slug]/client-detail-shell";

export default async function PartnerClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ partnerId }, client, scope] = await Promise.all([
    resolvePartnerOrg(`/partner/clients/${slug}`),
    getClientBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!client) notFound();
  if (!partnerId || client.partnerId !== partnerId || !canManageClient(scope, client.id)) {
    redirect("/unauthorized?reason=membership");
  }
  return (
    <ClientDetailShell client={client} isPlatformAdmin={false} basePath={`/partner/clients/${client.slug}`}>
      {children}
    </ClientDetailShell>
  );
}
```
`page.tsx` redirects to `` `/partner/clients/${slug}/overview` ``.

- [ ] **Step 2.** `overview/page.tsx`: mirror the admin overview page (stats + recent campaigns via `getClientStats`, `getRecentClientCampaigns`), render `ClientOverview` with `basePath={\`/partner/clients/${client.slug}\`}`, `campaignsHref="/partner/campaigns"`, `partnerHref={null}`, `showEnterPortal={false}`, `partnerName` from `getPartnerName(partnerId)` (`src/lib/dal/partners.ts`).

- [ ] **Step 3.** `details/page.tsx`: `ClientDetailsForm` with `partnerOptions={[]}`, `canAssignPartner={false}`, `archiveRedirectPath="/partner/clients"`, `ownershipLinkHref={null}`.

- [ ] **Step 4.** `branding/page.tsx` + `branding/layout.tsx` (`ForceLightTheme`, copied from admin). Gate: `const enabled = await getPartnerBrandingEnabled(partnerId)`; when false render
```tsx
<EmptyState eyebrow="Branding" title="Brand customisation is not enabled"
  description="Trajectas has not enabled brand customisation for your partner organisation yet. Contact Trajectas to switch it on." />
```
otherwise `ClientBrandEditor` exactly as the admin page.

- [ ] **Step 5.** `assessments/page.tsx`:
```tsx
const [assignments, pool, library] = await Promise.all([
  getAssessmentAssignments(client.id),
  getPartnerAssessmentAssignments(partnerId),
  getPartnerAssessmentLibrary(),          // src/app/actions/assessments.ts — partner-scoped
]);
const poolIds = new Set(pool.map((p) => p.assessmentId));
const allAssessments = library
  .filter((a) => poolIds.has(a.id) || a.ownerScope === "partner" || a.clientId === client.id)   // D4
  .map((a) => ({ id: a.id, title: a.title, status: a.status }));
return (
  <AssessmentAssignments
    clientId={client.id}
    assignments={assignments}
    allAssessments={allAssessments}
    partnerPool={pool.map((p) => ({ assessmentId: p.assessmentId, quotaLimit: p.quotaLimit, quotaUsed: p.quotaUsed }))}
  />
);
```
Do not pass `partnerPoolAssessmentIds` (the list is already filtered). Add a one-paragraph intro above the table: "Assessments you can assign come from your allocation and the assessments you own. Quotas count participants invited across this client's campaigns."

- [ ] **Step 6.** `reports/page.tsx`: same as the admin page (`getReportTemplateAssignments`, `getReportTemplates()` — already partner-scoped), `ReportAssignments` with `partnerId={partnerId}`.

- [ ] **Step 7.** `users/page.tsx`: members + invites via `getClientMembers`, `getClientPendingInvites`; render `WorkspaceUsersPage` with the **client-portal** components (they have no admin-only links):
```tsx
import { ClientPortalUsersTable } from "@/app/client/settings/users/client-users-table";
import { ClientPortalInviteDialog } from "@/app/client/settings/users/invite-user-dialog";
import { ClientPortalPendingInvites } from "@/app/client/settings/users/pending-invites-section";
// …
<WorkspaceUsersPage surface={{ workspaceId: client.id, TableComponent: ClientPortalUsersTable,
  InviteDialog: ClientPortalInviteDialog, PendingInvitesComponent: ClientPortalPendingInvites,
  members, pendingInvites }} />
```

- [ ] **Step 8.** `settings/page.tsx`: as the admin page, with `partnerBrandingDisabled={!(await getPartnerBrandingEnabled(partnerId))}` and the partner-facing `partnerBrandingDisabledMessage`. Integrations panel unchanged (its actions already authorise partner admins).

- [ ] **Step 9.** `loading.tsx` for every new directory: copy the admin counterpart file.

### Task 2.4 — Clients list becomes navigable

- [ ] **Step 1.** `src/app/partner/clients/clients-table.tsx`: wrap the name cell in `DataTableRowLink` (see `src/app/partner/campaigns/campaigns-table.tsx` for the pattern) with `` href={`/partner/clients/${row.original.slug}/overview`} `` and `aria-label={\`Open ${row.original.name}\`}`.
- [ ] **Step 2.** `src/app/partner/clients/page.tsx`: when `clients.length === 0` render `<EmptyState eyebrow="Clients" title="No clients yet" description="Create your first client to assign assessments and launch campaigns." actionLabel="New client" actionHref="/partner/clients/create" />` instead of the empty table.
- [ ] **Step 3.** `src/app/partner/clients/create/page.tsx`: keep `redirectPath="/partner/clients"` (the create form redirects by path, not slug).

### Task 2.5 — Verify

- [ ] `npm run typecheck && npm run lint && npm run build`.
- [ ] Manual check with the seeded local data (`npm run dev`, sign in as any partner admin you create, or use the dev bypass): open `/partner/clients`, click "Seeded Client Co", walk all seven tabs; assign the seeded assessment (id `10000000-0000-0000-0000-000000000201`, owned by Seeded Client Co, so it is assignable without a pool row — D4). Confirm the branding tab shows the "not enabled" empty state until you flip `partners.can_customize_branding` for the seeded partner in seed.sql (set it to `true` there — Phase 5 relies on it).
- [ ] Commit `feat(partner): client console` and ship as in Task 1.7.

---

## Phase 3 — Campaign and insights parity

**Branch:** `feat/partner-campaign-parity` · **PR title:** `feat(partner): campaign tabs, compare and email templates` · **Size:** M (1.5–2 days)

### Task 3.1 — Campaign detail shell in the partner portal

- [ ] **Step 1.** `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`: change the branding filter to
```ts
if (tab.segment === "branding" && (portal === "client" || portal === "partner") && !canCustomizeBranding) return false;
```

- [ ] **Step 2.** Replace `src/app/partner/campaigns/[id]/layout.tsx` (currently only `ForceLightTheme`) with the client layout adapted for partners:
```tsx
import { notFound } from "next/navigation";
import { getCampaignHeader, getFavoriteCampaignIds } from "@/app/actions/campaigns";
import { getPartnerBrandingEnabled } from "@/app/actions/partner-entitlements";
import { canAccessClient, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";

export default async function PartnerCampaignDetailLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ partnerId }, campaign, favoriteIds, scope] = await Promise.all([
    resolvePartnerOrg(`/partner/campaigns/${id}`),
    getCampaignHeader(id),
    getFavoriteCampaignIds(),
    resolveAuthorizedScope(),
  ]);
  if (!campaign || !partnerId) notFound();
  if (!campaign.clientId || !canAccessClient(scope, campaign.clientId)) notFound();
  const canCustomizeBranding = await getPartnerBrandingEnabled(partnerId);
  return (
    <CampaignDetailShell campaign={campaign} canCustomizeBranding={canCustomizeBranding} isFavorite={favoriteIds.includes(id)}>
      {children}
    </CampaignDetailShell>
  );
}
```

- [ ] **Step 3.** Replace `src/app/partner/campaigns/[id]/page.tsx` with a redirect to `` `/partner/campaigns/${id}/overview` `` (delete the read-only page body; keep `loading.tsx`).

- [ ] **Step 4.** Add the tab pages by copying the client versions and changing the prefix/surface:
  - `overview/page.tsx` → `<CampaignOverviewPageComponent campaignId={id} surface="partner" />`, plus `overview/layout.tsx` with `ForceLightTheme` (as the client portal does).
  - `participants/page.tsx` → `<CampaignParticipantsPageComponent campaignId={id} surface="partner" />`. The existing `participants/[participantId]/**` and `sessions/[sessionId]/**` routes stay.
  - `assessments/page.tsx` → copy of `src/app/client/campaigns/[id]/assessments/page.tsx` unchanged (it already scopes the picker to `getClientAssessmentLibrary(campaign.clientId)`).
  - `experience/page.tsx`, `branding/page.tsx` → copies of the client pages unchanged.
  - `settings/page.tsx` → copy of the client page with `routePrefix="/partner"`.
  - `compare/page.tsx` → copy of the client page; replace `requireClientCampaignOwnership` with `canAccessClient(scope, campaign.clientId)` (redirect to `/unauthorized?reason=membership` on failure); `basePath={\`/partner/campaigns/${campaignId}/compare\`}`, `fallbackPath="/partner/campaigns"`, `surface="partner"`.
  - `loading.tsx` per directory: copy the client counterparts.

### Task 3.2 — Portfolio-wide compare

- [ ] **Step 1.** `src/app/partner/participants/compare/page.tsx`: copy `src/app/client/participants/compare/page.tsx`; use `resolvePartnerOrg('/partner/participants/compare')`; `BASE_PATH = '/partner/participants/compare'`; `partnerBandScheme={await getPartnerBandScheme(partnerId)}` (from `@/app/actions/partners`). Add `loading.tsx`.
- [ ] **Step 2.** `src/app/partner/participants/participants-table.tsx`: add the "Compare selected" bulk action exactly as `src/app/client/participants/global-participants.tsx` does (around its `sessionsBulkActions`), pushing to `/partner/participants/compare?…`.
- [ ] **Step 3.** `src/components/app-sidebar.tsx` `partnerNav`: add an `Insights` section with `{ title: "Compare", href: "/participants/compare", icon: Scale }` (mirror `clientNav`).

### Task 3.3 — Dangling links and placeholders (D14)

- [ ] **Step 1.** `src/lib/workspace-portal-config.ts`: delete the `results` and `matching` entries from `partnerPortalPages` (they were marketing-copy placeholders; `/partner/campaigns/[id]/results` was a dead link from the old page).
- [ ] **Step 2.** `grep -rn "partner/campaigns/.*results\|/partner/results\|/partner/matching" src` must return nothing.

### Task 3.4 — Partner email templates (optional; do it if time allows in this PR, else open a follow-up issue)

- [ ] Copy `src/app/(dashboard)/settings/email-templates/page.tsx` and `[type]/page.tsx` to `src/app/partner/settings/email-templates/…`; resolve `partnerId` with `resolvePartnerOrg`; call the actions with `scopeType = 'partner'` and `scopeId = partnerId` regardless of search params; rewrite links to `/partner/settings/email-templates/...`. The actions (`src/app/actions/email-templates.ts`) already authorise via `canManagePartner`.
- [ ] `partnerSettingsNav`: add `{ title: "Email templates", href: "/settings/email-templates", icon: Mail }`.

### Task 3.5 — Verify and ship

- [ ] Full gate; manual check of every campaign tab on the seeded campaign (`10000000-0000-0000-0000-000000000401`) under `/partner/campaigns/...`; ship as in Task 1.7 (`feat(partner): campaign tabs, compare and email templates`).

---

## Phase 4 — Look and feel: dashboard and portal sweep

**Branch:** `feat/partner-portal-dashboard` · **PR title:** `feat(partner): portfolio dashboard and portal polish` · **Size:** M (2–3 days)

Read `docs/ui-standards.md` and `src/app/client/dashboard/client-dashboard.tsx` end to end before starting: the client dashboard is the visual template (editorial hero, mono gold eyebrows, one headline metric with a `Sparkline`, framing stats in a bordered band, prioritised lists, `EmptyState`s, `RefreshOnFocus`).

### Task 4.1 — Data for the dashboard

**Files:** `src/lib/dal/partner-dashboard-mappers.ts` (pure), `src/lib/dal/partner-dashboard.ts` (queries), `src/app/actions/partner-dashboard.ts` (auth + orchestration)

- [ ] **Step 1.** Mappers (pure, unit-testable):
```ts
// src/lib/dal/partner-dashboard-mappers.ts
export type CompletionTimelinePoint = { day: string; count: number }

export function zeroFilledTimeline(days: number, counts?: Map<string, number>): CompletionTimelinePoint[] { /* copy of the private helper in src/app/actions/campaigns.ts */ }

export function bucketCompletionsByDay(rows: Array<{ completed_at: string | null }>): Map<string, number> { /* YYYY-MM-DD (UTC) → count */ }

export type PartnerRecentResult = {
  participantId: string; participantName: string; participantEmail: string;
  campaignId: string; campaignTitle: string; clientName: string;
  latestSessionId?: string; status: string; lastActivity: string;
}
export function mapRecentResultRows(rows: unknown[]): PartnerRecentResult[] { /* same logic as getRecentClientResults, plus campaigns.clients(name) → clientName */ }
```
Then move the `zeroFilledTimeline` in `campaigns.ts` to import from here (delete the private copy).

- [ ] **Step 2.** DAL (`partner-dashboard.ts`, `import "server-only"`, client injected):
  - `listPartnerClientIds(db, partnerId)` → `clients.id[]` where `partner_id = partnerId and deleted_at is null`.
  - `getPartnerCompletionTimeline(db, clientIds, days)` → same query as `getCompletionTimeline` but `.in('campaigns.client_id', clientIds)`; returns `zeroFilledTimeline(days, bucketCompletionsByDay(rows))`. Empty `clientIds` → `zeroFilledTimeline(days)` without querying.
  - `getRecentPartnerResults(db, clientIds, limit)` → same query as `getRecentClientResults` with `campaigns!inner(title, client_id, deleted_at, clients(name))` and `.in('campaigns.client_id', clientIds)`; `mapRecentResultRows`, sort desc, slice.

- [ ] **Step 3.** Actions (`src/app/actions/partner-dashboard.ts`, `'use server'`): `getPartnerDashboardData(partnerId)` → `await requirePartnerAccess(partnerId)`, `const db = await createClient()` (RLS client — these are reads), then `Promise.all` of `listPartnerClientIds`, timeline (14 days), recent results (5). Return `{ completionTimeline, recentResults }`.

- [ ] **Step 4.** Unit tests `tests/unit/partner-dashboard-mappers.test.ts` for `zeroFilledTimeline`, `bucketCompletionsByDay`, `mapRecentResultRows` (sorting, name fallback to email, client name).

### Task 4.2 — The dashboard

**Files:** `src/app/partner/dashboard/page.tsx` (rewrite), `src/app/partner/dashboard/partner-dashboard.tsx` (new, `"use client"`), `src/app/partner/dashboard/loading.tsx` (rewrite from the client loading file)

- [ ] **Step 1.** `page.tsx` data (all in one `Promise.all` after `resolvePartnerOrg('/partner/dashboard')`; when `partnerId` is null render the same "not set up yet" `EmptyState` pattern as the client dashboard):
  `getClients()`, `getCampaigns()`, `getPartnerAssessmentAssignments(partnerId)`, `getPartnerAssessmentLibrary()`, `getFavoriteCampaignIds()`, `getPartnerDashboardData(partnerId)`, `getPartnerName(partnerId)`.
  Build `launchAssessments: CampaignAssessmentOption[]` from the library the way `src/app/client/dashboard/page.tsx` does.

- [ ] **Step 2.** `partner-dashboard.tsx` sections, top to bottom (copy the client component's markup and classes; change content):
  1. **Hero.** Eyebrow `This week · {range}`. H1 `What's moving across your portfolio.` with the emerald span on "your portfolio". Lede: when no active campaigns → "No active campaigns yet — launch one for a client to start seeing activity here."; otherwise the lead campaign sentence as the client dashboard, prefixed with the client name ("Acme · Leadership Index closes in 3 days at 62% done, with 9 still to finish.").
  2. **Quick actions.** `LaunchCampaignButton` (`label="Create campaign"`, `assessments={launchAssessments}`, `clients={clients.map(c => ({ id: c.id, name: c.name }))}`, `recentCampaigns={campaigns}`, `successHrefPrefix="/partner/campaigns"`), an outline `Link` "New client" → `/partner/clients/create`, an outline `Link` "View results" → `/partner/participants`.
  3. **Metric strip** (bordered band, `lg:grid-cols-5`): headline **Completions** `{completed} / {invited}` across active campaigns with the 14-day `Sparkline`; framing stats **Active campaigns**, **Clients** (`{n}` with suffix `{m} with a campaign running`), **Closing this week**.
  4. **Your allocation.** Eyebrow "Your allocation", H2 "What you can deploy." One row per pool assessment: name, `Progress` bar of `quotaUsed / quotaLimit`, caption `{used} of {limit} used` or `Unlimited`; a right-aligned amber `Badge` "Nearly used" when `used / limit ≥ 0.8`. Empty → `<EmptyState size="sm" eyebrow="Allocation" title="No assessments allocated yet." description="Trajectas allocates assessments to your partner organisation. Contact Trajectas to get started." />`.
  5. **Top three to watch.** Same ranking as the client dashboard (favourites, then closing soonest), each row showing the client name under the title, linking to `/partner/campaigns/{id}`.
  6. **Clients.** Eyebrow "Clients", H2 "Where attention goes next." Rows for up to 6 clients sorted by fewest active campaigns first: name (link to `/partner/clients/{slug}/overview`), `Badge`s "No assessments assigned" when `assessmentCount === 0` and "No campaigns" when the client has no campaign in `campaigns`, plus `{sessionCount} sessions`. Link "All clients →". Empty → `EmptyState` with the "New client" action.
  7. **Recent results.** Last five `recentResults` rows: participant, client · campaign, `LocalTime` of `lastActivity`, link to `/partner/campaigns/{campaignId}/participants/{participantId}`. Empty → `EmptyState` "Quiet for now".
  Include `<RefreshOnFocus />` at the top, exactly like the client dashboard.

- [ ] **Step 3.** `loading.tsx`: copy `src/app/client/dashboard/loading.tsx` and add two more shimmer blocks (allocation, clients).

### Task 4.3 — Portal sweep (closes `docs/audit/partner-scorecard.md` P1–P3)

- [ ] **Step 1.** `EmptyState` on every partner listing with an ad-hoc empty message: campaigns, participants, assessments (both tabs), report templates, clients (done in 2.4). Use `size="sm"` inside cards.
- [ ] **Step 2.** The brand "not enabled" notice in `src/app/partner/settings/brand/page.tsx` → the same `EmptyState` as Task 2.3 Step 4.
- [ ] **Step 3.** `partnerNav` final shape: `Overview → Dashboard`; `Clients → Clients`; `Delivery → Campaigns, Participants`; `Assessments → Assessments, Report Templates`; `Insights → Compare`. Keep `partnerSettingsNav` (Brand, Team, + Email templates if Task 3.4 shipped).
- [ ] **Step 4.** Both themes: open the dashboard and the client console in light and dark; fix any raw colour usage (`docs/ui-standards.md` "Colour Usage").

### Task 4.4 — Verify and ship

- [ ] Full gate; `npm run test:unit` includes the new mapper tests; ship as in Task 1.7.

---

## Phase 5 — Market readiness

**Branch:** `test/partner-e2e-and-docs` · **PR title:** `test(partner): seeded partner admin, e2e journey, docs` · **Size:** S–M (1–2 days)

### Task 5.1 — Seeded partner admin

**File:** `supabase/seed.sql`

- [ ] **Step 1.** Set `can_customize_branding = true` on the seeded partner (`10000000-0000-0000-0000-000000000001`) in its `insert … on conflict` block.
- [ ] **Step 2.** Add `partner_assessment_assignments` for the seeded assessment `10000000-0000-0000-0000-000000000201` (`partner_id` seeded partner, `quota_limit 25`, `assigned_by 10000000-0000-0000-0000-000000000111`) with `on conflict (partner_id, assessment_id) do nothing`. Place it immediately after the `assessments` block and before any `client_assessment_assignments` block (check with `grep -n client_assessment_assignments supabase/seed.sql`) so the Task 1.4 trigger sees the pool row first.
- [ ] **Step 3.** Add an `auth.users` row (copy the seeded admin's block verbatim, changing only id/email), a `profiles` row and a `partner_memberships` row for the partner admin:
  - id `10000000-0000-0000-0000-000000000112`, email `seed-partner-admin@seeded-advisory-group.test`, `role 'partner_admin'`, `partner_id` = seeded partner, `client_id null`, `display_name 'Seeded Partner Admin'`.
  - `partner_memberships`: id `10000000-0000-0000-0000-000000000712`, `profile_id` above, `partner_id` seeded partner, `role 'admin'`, `is_default true`, `on conflict (id) do nothing`.
- [ ] **Step 4.** `npm run db:test:reset` — the seed must apply cleanly.

### Task 5.2 — E2E partner journey

**Files:** `tests/e2e/seeded/auth.ts`, `tests/e2e/seeded/partner-auth.setup.ts`, `tests/e2e/seeded/partner-portal.spec.ts`, `playwright.config.ts`

- [ ] **Step 1.** `auth.ts`: extract the body of `mintAdminStorageState` into `mintStorageState(actor: { email: string }, outputPath: string)`; keep `mintAdminStorageState` as a one-line wrapper. Export `SEEDED_PARTNER_ADMIN = { id: "10000000-0000-0000-0000-000000000112", email: "seed-partner-admin@seeded-advisory-group.test" }` and `PARTNER_STORAGE_STATE = resolve(process.cwd(), "tests/e2e/seeded/.auth/partner.json")`, and `mintPartnerStorageState()`.
- [ ] **Step 2.** `partner-auth.setup.ts`: `setup("mint seeded partner session", () => mintPartnerStorageState())`.
- [ ] **Step 3.** `playwright.config.ts`: add project `seeded-partner-setup` (`testMatch: /seeded\/partner-auth\.setup\.ts$/`) and make `seeded` depend on both setup projects.
- [ ] **Step 4.** `partner-portal.spec.ts` (`test.use({ storageState: PARTNER_STORAGE_STATE })`; the single-host harness resolves the partner surface from the `/partner` path prefix):
  1. `/partner/dashboard` shows the heading `What's moving across your portfolio.` and the allocation row `Seeded Leadership Assessment` with `0 of 25 used` (the seeded campaign's participants count toward usage — read the number the page renders once and assert on that exact text).
  2. `/partner/clients` lists `Seeded Client Co`; clicking `Open Seeded Client Co` lands on `/partner/clients/seeded-client-co/overview` with the Overview/Details/Assessments/Reports/Users/Branding/Settings tabs and **no** Billing tab.
  3. Assessments tab: if `grep -n client_assessment_assignments supabase/seed.sql` shows the seed already assigns `Seeded Leadership Assessment` to Seeded Client Co, assert the row and its quota cell; otherwise open the Assign dialog, pick `Seeded Leadership Assessment`, enter quota `10`, submit, and assert the row appears with the success toast. Then assert the caption `Partner allocation:` is visible in the dialog or row (the pool cap from Task 5.1).
  4. Users tab: invite `partner-invited@example.test` as member; expect the pending-invites section to show the email (the copy-link fallback appears when email delivery is unavailable locally — assert on the pending row, not on delivery).
  5. Settings tab: toggle **Custom Branding** on; expect the success toast `Custom branding enabled`; Branding tab renders the editor heading.
  6. `/partner/campaigns/10000000-0000-0000-0000-000000000401/overview` shows the campaign shell tabs including Settings and Experience.
  7. Negative: `/partner/clients/does-not-exist` → 404 page.
- [ ] **Step 5.** `npm run test:e2e:seeded` green locally (needs `npm run db:test:start` and the seeded dev server; see `scripts/testing/`).

### Task 5.3 — Record the decision

- [ ] **Step 1.** Write `docs/superpowers/specs/2026-09-04-partner-self-service-design.md`: the target-model table, invariants and decisions D1–D14 from this plan (copy them; this is the durable record), plus a "Supersedes" line naming the April read-only decision.
- [ ] **Step 2.** `docs/superpowers/specs/2026-03-30-surface-security-and-ownership-architecture.md`: in "Partner surface", "Actor / Surface Matrix" and "Resource Ownership Matrix" replace the partner read-only rows with the target-model rows; add one paragraph under "Service-layer authorization" describing `managedClientIds`.
- [ ] **Step 3.** `docs/superpowers/specs/2026-04-09-admin-partner-client-polish-design.md`: add a note at the top of §4 and §7: "Superseded 2026-09-04 — partner admins now manage client entitlements; see 2026-09-04-partner-self-service-design.md."
- [ ] **Step 4.** `AGENTS.md`: add a short section "Partner-managed clients" stating: `canManageClient(scope, clientId)` is the only way to ask "may this actor manage this client"; never compare against `clientAdminIds` directly; entitlement writes stay platform-admin-only at RLS and go through Server Actions; the pool invariant is a database trigger.

### Task 5.4 — Production first-partner runbook (append to the design spec, then execute with Jason)

1. Admin console → Partners → Create partner; Details tab; Settings → enable branding if agreed; Assessments → allocate the pool with quotas; Reports → allocate templates; Library → taxonomy if the partner authors assessments.
2. Users tab → invite the partner admin (copy-link fallback if their mail server quarantines).
3. Clients → assign any existing client to the partner (admin-only; check the Task 1.4 Step 2 query first — assignments outside the new pool would be invalid).
4. Sign in as the partner admin on the partner host: dashboard → clients → create a client → assign assessment → invite a client user → launch a campaign → open the campaign tabs.
5. From the admin console, "Enter portal" into that partner; confirm the support-session banner and that the client console is reachable and confined to that partner.

### Task 5.5 — Ship

- [ ] Full gate + e2e; ship as in Task 1.7. Remove the worktree; prune branches.

---

## Acceptance checklist (whole programme)

- [ ] A partner admin can open a client, edit details, enable branding, edit the brand, assign an assessment with a quota within the partner cap, assign a report template, invite a client user, launch and configure a campaign, and view results — all from `/partner/...`.
- [ ] The same partner admin gets `/unauthorized` or 404 for another partner's client slug, campaign id, participant id and report snapshot id.
- [ ] A partner member can view but not change any of the above.
- [ ] Direct PostgREST writes by a partner admin to `client_assessment_assignments`, `client_report_template_assignments`, `brand_configs`, `client_memberships`, `user_invites` are refused; direct reads of their own clients' memberships and invites succeed.
- [ ] A service-role insert of an out-of-pool client assignment is refused by the trigger.
- [ ] `grep -rn "clientAdminIds.includes" src` returns only `authorization.ts` internals.
- [ ] `npm run test:unit`, `test:architecture`, `test:integration:local`, `test:e2e:seeded` green; `get_advisors` security shows no new findings.
- [ ] The partner dashboard, clients list, client console and campaign tabs render correctly in light and dark themes and pass the `docs/ui-standards.md` checklist.
- [ ] Specs updated; AGENTS.md section present.
