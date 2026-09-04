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

## Part 1 — explicit predicates (shipped)

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

## Part 2 — support sessions confine in Postgres (built)

`20260904120000_support_sessions_confine_rls.sql`.

The instinct is to push the whole active context into Postgres via a GUC or a
JWT claim. That is real work — Supavisor pooling rules out a plain `SET`, and a
claim needs a token refresh on every workspace switch — and it buys less than it
looks like, because **the application is the only thing that signs the context**.
The database cannot distinguish a genuine header from an absent one, so a
platform admin could simply omit it. Verifying the HMAC in Postgres means putting
`TRAJECTAS_CONTEXT_SECRET` in the database, which is a much larger change.

Support sessions need none of that, because they are already a table:

```
support_sessions(actor_profile_id, target_surface, client_id, partner_id,
                 expires_at, ended_at)   -- idx_support_sessions_actor exists
```

The first draft of this was "make `is_platform_admin()` return false during a
support session". That is wrong, and the reason is worth recording. Of the 239
policies calling it, roughly 60 are INSERT/UPDATE/DELETE policies across ~30
tables where it is the *only* way an admin qualifies. Narrowing it wholesale
would strip a support session of the ability to **act** on the tenant it was
opened to help — the opposite of the point — and it also gates platform tables
(`item_parameters`, `item_statistics`) that have nothing to do with tenancy.

What shipped instead is surgical:

1. `auth_in_support_session()` — reads the table. Cannot be forged or omitted
   from the client side, which is the whole advantage over a header or a claim.
2. `is_unconfined_platform_admin()` = platform admin **and** not in a session.
3. Every tenant-scoped SELECT policy swaps `is_platform_admin()` for it —
   **35** of them. Reads confine; writes are untouched, so
   `is_platform_admin()` itself is left exactly as it was.

   The first draft did eleven, hand-enumerated, and an adversarial review
   caught the omission: it had missed the whole `org_diagnostic_*` family,
   `client_roles`, the eight `integration_*` tables, `audit_events`,
   `person_link_audit`, `campaign_access_links` and `profiles`. The list is now
   *derived* — every table carrying a tenant-identifying column whose SELECT
   policy invokes the role-only check — and the rewrite is applied by reading
   each live expression and substituting one function name, so no clause can be
   dropped in transcription. Two policies (`client_assessment_assignments`,
   `client_report_template_assignments`) open-code the admin test as an inline
   `EXISTS` on `profiles.role` rather than calling the function; those are
   handled explicitly, because a substitution on the function name alone would
   have left them wide open while appearing to succeed.

   **Known gap, deliberate:** five tables — `billing_accounts`,
   `campaign_360_snapshots`, `campaign_raters`, `org_diagnostic_respondents`,
   `session_quality_flags` — carry a single `FOR ALL USING (is_platform_admin())`
   policy. A `FOR ALL` policy also covers SELECT, so confining them is a
   DROP + CREATE of three policy objects per table with real write-regression
   risk. That belongs in its own migration. The migration `RAISE NOTICE`s the
   list rather than leaving it to be discovered.
4. `auth_user_client_ids()` / `auth_user_partner_ids()` collapse to the
   session's target while one is live. This is required rather than incidental:
   after (3), those arrays are how an admin in a session still sees the tenant
   they came to help. A platform admin normally holds no memberships, so without
   it they would see nothing at all.

The `*_admin_ids()` functions are deliberately untouched.

The migration ends with a `DO` block that fails if any tenant-scoped SELECT
policy still references the role-only check — in either form, the function call
or the open-coded `profiles.role` lookup — so a partial apply cannot pass
silently. It also refuses to proceed if it finds far fewer policies than
expected, which is what a drifted or replayed-from-scratch database would look
like.
`tests/integration/support-session-confinement-rls.test.ts` covers both
directions (target still visible, other tenant gone), session end restoring
access, an expired session not confining, ordinary members being unaffected, and
writes continuing to work inside a session.

Still worth measuring before this is relied upon at scale: the added
`support_sessions` probe on `campaign_participants` and `participant_scores`.
It should collapse to one index lookup per statement — the functions are
`STABLE` — but confirm rather than assume.

## Part 3 — the active workspace switch (deferred, maybe indefinitely)

The remaining hole is a platform admin who *selects* a client workspace rather
than opening a support session. There is no row to consult, so this genuinely
needs the GUC/claim/header plumbing described above and inherits its
forgeability problem. Until then it stays an app-layer predicate, enforced by
the architecture test.
