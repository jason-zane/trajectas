# The workspace boundary is not in the database

2026-09-04. Written alongside `fix/workspace-tenant-predicates`, which
implements part 1 of what follows.

## The problem

Trajectas has two different tenant boundaries and only one of them reaches
Postgres.

**Membership** — which clients and partners a person belongs to. RLS knows this.
`auth_user_client_ids()` unions client memberships, the clients of the partners
they belong to, and a legacy `profiles.client_id` path.

**Workspace** — which of those tenants they are *currently standing in*: the
active context set by the workspace switcher, or the tenant a support session
was opened against. RLS knows nothing about this. Both live in a signed cookie
(`tf_active_context`, `src/lib/auth/active-context.ts`) that is read by
`resolveAuthorizedScope()` in the Next.js process and never sent to the
database.

The gap is widest for a platform admin, because `is_platform_admin()` is
role-only:

```sql
SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin');
```

239 of the 421 policies in `public` call it, most as a leading short-circuit —
`campaign_participants_select_authenticated` begins `is_platform_admin() OR …`.
So for a platform admin, RLS is not a tenant boundary at all, including in the
middle of a support session opened for one named client.

There is an asymmetry worth holding onto, because it explains which queries
broke and which did not:

| | app layer (`scope.isPlatformAdmin`) | database (`is_platform_admin()`) |
|---|---|---|
| Admin surface, no workspace | true | true |
| Admin surface, client workspace selected | **true** | true |
| Support session into a client | false (surface is `client`) | **true** |

So a query that trusted RLS leaked during a **support session**; a query that
narrowed only `if (!scope.isPlatformAdmin)` leaked when an admin selected a
**workspace on the admin surface**. Both shapes existed. The Compare picker was
the first shape and was reported from production: opened inside Executive
Performance Partners, it offered all 51 participants across 3 clients.

## Part 1 — explicit predicates (this branch)

Workspace-surface reads derive their predicate from the resolved scope instead
of trusting RLS.

- `resolveTenantClientFilter(scope)` returns the client ids a read is confined
  to, or `null` only for a platform admin outside every workspace. An empty
  array means *no rows*, never *unrestricted*.
- `applyTenantClientFilter(query, scope, column)` applies it, returning `null`
  when confined to nothing — so the "empty means everything" mistake is a type
  error rather than a silent widening.
- `getAccessibleCampaignIds(scope)` now returns `null` on the same condition,
  which fixes every caller that treated it as "unrestricted for admins".
- `tests/architecture/tenant-scope-predicates.test.ts` fails CI when a read of a
  tenant-scoped table has no predicate, no access gate, and no allowlist entry.

One supporting fix: entering a **partner** workspace used to filter `clientIds`
out of the actor's own memberships, which for a platform admin (who holds none)
produced an empty list. It now resolves the partner's clients directly, so
narrowing a platform admin to a partner workspace gives that partner's clients
rather than nothing.

## Part 2 — make support sessions confining in Postgres (next)

The natural instinct is to push the whole active context into Postgres via a GUC
or a JWT claim. That is real work — Supavisor pooling rules out a plain `SET`,
and a claim needs a token refresh on every workspace switch — and it buys less
than it looks like, because **the application is the only thing that signs the
context**. The database cannot distinguish a genuine header from an absent one,
so a platform admin could simply omit it. Verifying the HMAC in Postgres means
putting `TRAJECTAS_CONTEXT_SECRET` in the database. That is a much bigger change
and should not be undertaken casually.

**Support sessions need none of that**, because they are already a table:

```
support_sessions(actor_profile_id, target_surface, client_id, partner_id,
                 expires_at, ended_at)   -- idx_support_sessions_actor exists
```

So `is_platform_admin()` and `auth_user_client_ids()` can consult it directly:

- `is_platform_admin()` returns **false** while the calling profile has a live
  support session — they have stepped into a tenant and are no longer acting as
  the platform.
- `auth_user_client_ids()` returns **only** the session's target (or the target
  partner's clients) for the duration.

This is unforgeable: it depends on a row the admin cannot suppress from the
client side, and it needs no request plumbing. It would make support sessions
genuinely confining rather than merely audited — the property the original
report actually wanted.

Cautions for whoever picks this up:

- Both functions are `STABLE SECURITY DEFINER` and are called from 239 and 36
  policies respectively. Changing them changes every one of those at once, with
  no staged rollout. Get `is_platform_admin()` wrong and nobody can read
  anything, including the people who would fix it.
- Measure the added subquery. It should collapse to one index probe per
  statement, but confirm on `campaign_participants` and `participant_scores`.
- The application's own authorization path uses `createAdminClient()` (service
  role, RLS-bypassing) behind `requireCampaignAccess()` and friends, so the
  narrowing does not break the checks themselves.

## Part 3 — the active workspace switch (deferred, maybe indefinitely)

The remaining hole is a platform admin who *selects* a client workspace rather
than opening a support session. There is no row to consult, so this genuinely
needs the GUC/claim/header plumbing described above and inherits its
forgeability problem. Until then it stays an app-layer predicate, enforced by
the architecture test.
