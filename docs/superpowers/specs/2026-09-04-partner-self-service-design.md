# Partner Self-Service — Design

**Status:** shipped (Phases 1–5, 2026-09-04)
**Supersedes:** the "partner admins see the table read-only" decision in
`2026-04-09-admin-partner-client-polish-design.md` §4 and §7, and the
"partner/client self-service portals — out of scope" line in
`2026-04-02-admin-operated-launch-design.md`. Those recorded the admin-operated
launch mode; this record replaces them for client-level management.
**Build plan:** `docs/superpowers/plans/2026-09-04-partner-self-service.md`

---

## Why

A partner sells Trajectas to its own clients. Until now it could create a client
and run campaigns for it, but could not set that client up: branding, assessment
assignment, quotas, report templates and client users were all platform-admin
only. Every new client therefore needed Trajectas in the loop, which is not a
channel — it is a queue.

The security foundation already supported the model. A partner's reach has always
been derived from `clients.partner_id` in both the application scope and the RLS
helpers, and cross-partner isolation was already covered by tests. What was
missing was the decision to open the gates, and the machinery to do it safely.

## Target model

| Capability | Platform admin | Partner admin (own clients) | Partner member | Client admin (own client) |
|---|---|---|---|---|
| Create client | yes | yes (forced to own partner) | no | no |
| Open client console | yes (`/clients/[slug]`) | yes (`/partner/clients/[slug]`) | no (list only) | own settings pages only |
| Edit details / archive / restore | yes | yes | no | no |
| Move client to another partner | yes | **no** | no | no |
| Enable client branding flag | yes | yes, only while own partner flag is on | no | no |
| Edit client brand layer | yes | yes, only while own partner flag is on | no | yes, when both flags are on |
| Assign assessment to client | yes | yes, from allocation ∪ partner-owned ∪ client-owned | no | no |
| Set client quota | yes | yes, ≤ partner cap when capped | no | no |
| Assign report template | yes | yes: platform-global or partner-owned | no | no |
| Invite / role / remove / revoke client users | yes | yes | no | yes |
| Client integrations settings | yes | yes | no | no |
| Create / configure campaigns for client | yes | yes (all tabs) | view only | yes |
| Participants, sessions, reports, exports, compare | yes | yes | yes (view) | yes |
| Client email templates | yes | yes | no | no |
| Billing / invoices | yes | **no** | no | no |
| Partner allocation, quotas, branding flag, taxonomy | yes | view only | view only | — |

## Invariants

1. A partner never reads or writes another partner's client, campaign,
   participant, assignment, membership or invite — in the application scope and
   in RLS.
2. An active `client_assessment_assignments` row for a partner-owned client
   references an assessment that is in that partner's active allocation, or owned
   by that partner, or owned by that client. Enforced by a database trigger, so
   it holds for the service role too.
3. Both quota levels are enforced at use time; the assignment-time cap is
   additional, not a replacement.
4. Every entitlement, membership, brand and support-session change writes an
   `audit_events` row.
5. `isPlatformAdmin` is false off the admin host. Platform admins reach the
   partner and client portals through audited support sessions.
6. Reading a campaign is a membership-wide right; changing one is a management
   right. Every campaign mutation holds `requireCampaignManage`, never the read
   gate.

## Decisions

- **D1 — One managed-client set.** `AuthorizedScope.managedClientIds` is direct
  client-admin memberships ∪ every client owned by a partner the actor
  administers, narrowed by workspace context and support sessions exactly like
  `clientIds`. `canManageClient(scope, clientId)` reads it; the old third
  argument is gone, so a caller cannot forget to pass a client's partner.
- **D2 — RLS writes stay platform-admin-only; the database owns the invariant.**
  Partner writes flow through Server Actions on the service role, where the pool
  rule, the quota cap and the audit log apply. Widening the RLS write policies
  would let a partner admin write those rows straight through PostgREST and skip
  all three. Read policies on `client_memberships` and `user_invites` widen to
  partner admins (deferred with the memberships-only helper rewrite; see
  "Outstanding" below).
- **D3 — Quota cap at assignment time.** If the partner's allocation for an
  assessment is capped, the client quota is required and may not exceed it.
  Over-allocation across clients is allowed; use-time enforcement is the hard
  stop.
- **D4 — Owned assessments are always in-pool.** A partner-owned assessment is
  assignable to every client of that partner, and a client-owned assessment to
  that client, with or without an allocation row.
- **D5 — The partner flag gates all brand writes.** A partner admin may edit a
  client's brand layer only while `partners.can_customize_branding` is on; a
  client admin needs both flags. Enforced in `assertCanEditClientBrand`, called
  from `upsertBrandConfig`, `resetBrandToDefault` and the brand-asset upload
  route — not only on the flag toggle. Reads are not gated.
- **D6 — Route-based console** at `/partner/clients/[slug]/<tab>`, independent of
  the workspace context switcher.
- **D7 — Reuse, don't fork.** The admin console components take small props
  (`basePath`, `campaignsHref`, `partnerHref`, `showEnterPortal`,
  `archiveRedirectPath`, `ownershipLinkHref`, `partnerBrandingDisabledMessage`);
  the client-portal campaign pages are mirrored under `/partner`.
- **D8 — Report templates** assignable by a partner: platform-global, or owned by
  the client's partner.
- **D9 — Dev fallbacks stay in dev.** The "first tenant in the database" fallback
  in `resolvePartnerOrg` / `resolveClientOrg` runs only on a local host; on
  production hosts a platform admin without a membership or support session is
  sent to `/unauthorized`.
- **D10 — Memberships are the only authority.** The legacy `profiles.partner_id`
  / `profiles.client_id` arms in the `auth_user_*` SQL helpers are to be dropped
  (see "Outstanding").
- **D11 — The campaign Branding tab** appears on the partner surface while the
  partner flag is on, mirroring how the client portal gates it.
- **D12 — Dashboard direction:** the client portal's editorial layout, with
  portfolio content — allocation usage, clients needing attention, cross-client
  "what's moving".
- **D13 — Stays admin-only:** partner allocation, quotas, branding flag and
  taxonomy; moving a client between partners; billing; Leadership 360.
- **D14 — Placeholder pages removed:** `/partner/results` and `/partner/matching`.
- **D15 — Campaign writes need manage, not membership.** `requireCampaignAccess`
  is a read gate: it admits any member of the owning client or partner. That is
  correct for reads and wrong for mutations, which run on the service role where
  RLS never sees them. `requireCampaignManage` is the write gate. Found when the
  partner campaign console made the gap reachable; the gap itself predated it and
  covered the client portal too. Pinned by
  `tests/architecture/campaign-write-manage-gate.test.ts`.
- **D16 — D5 covers the campaign brand layer.** The flag check originally ran
  only for `ownerType === 'client'`, so a campaign brand override — the layer a
  participant actually sees — could be written with the partner flag off, by
  addressing the campaign directly. `assertBrandLayerEditable` now resolves a
  campaign to its client and applies the same rule, and the partner campaign
  branding route enforces the flag itself rather than relying on a hidden tab.
- **D17 — Portfolio panels aggregate in SQL.** `partner_dashboard_*` are
  SECURITY INVOKER projections. A plain PostgREST select is truncated at
  `max_rows` (1000) before any client-side grouping or sorting runs, which made
  the timeline undercount and "recent activity" show the wrong rows for a large
  portfolio. Rollups key on client id, not display name — only the slug is
  unique.

## Shape of the implementation

- `src/lib/auth/authorization.ts` — `managedClientIds`, `canManageClient`,
  `canManageClientEntitlements`, `isLocalDevelopment`
- `src/lib/auth/resolve-partner-client.ts` — the console's one access gate
- `src/lib/brand/brand-write-authorization.ts` — D5, at the write sites
- `src/app/actions/client-entitlements.ts` — `checkPartnerPoolAndCap`,
  `getAssignableAssessmentsForClient`
- `supabase/migrations/20260905090000_client_assignment_partner_pool_guard.sql`
  and `…090100_partner_pool_parent_guards.sql` — the invariant, including the
  parent-side cases (moving a client under a partner; removing an allocation row)
- `src/app/partner/clients/[slug]/**`, `src/app/partner/campaigns/[id]/**`,
  `src/app/partner/dashboard/**`
- `supabase/migrations/20260905093000_partner_dashboard_projections.sql` — the
  dashboard's two SQL projections

## Outstanding

Read-parity RLS policies for `client_memberships` and `user_invites`, and the
memberships-only rewrite of the four `auth_user_*` helpers (D10), were sequenced
behind PR #381 (support-session confinement), which rewrites the same objects.
Until they land, partner admins read client members and invites through Server
Actions on the admin client, with the gate applied in the action.

Production pre-flight for D10 returned zero rows on 2026-09-04: every profile
with a legacy tenant column already has a matching membership.

## First-partner runbook

1. **Admin console → Partners → Create partner.** Fill Details. In Settings,
   enable branding if the commercial agreement includes it.
2. **Assessments tab** — allocate the pool, with a quota per assessment where the
   contract caps volume. **Reports tab** — allocate templates. **Library tab** —
   taxonomy, if the partner authors its own assessments.
3. **Users tab** — invite the partner admin. If their mail server quarantines the
   invite, use the copy-link fallback.
4. **Clients tab** — assign any existing client to the partner. The parent-side
   guard refuses this while the client holds active assignments outside the new
   partner's allocation; allocate those assessments first, or deactivate the
   assignments.
5. **Sign in as the partner admin** on the partner host and walk the journey:
   dashboard → clients → create a client → assign an assessment within the cap →
   invite a client user → launch a campaign → open the campaign tabs.
6. **Back in the admin console**, use "Enter portal" on that partner. Confirm the
   support-session banner appears and the console is confined to that partner.
