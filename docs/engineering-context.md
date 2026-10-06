# Engineering context

Existing domain conventions moved from AGENTS.md without changing application behavior.
Read the relevant section when editing that subsystem. Release and environment instructions
are maintained only in [the runbook](runbook.md). Historical production observations here
are context, not proof of current live configuration.

## UI/UX Standards
Read `docs/ui-standards.md` before building any UI component or page. Entity
list pages default to a table; card grids are for taxonomy entities only.

## Data Access Layer

Database access is being centralised into `src/lib/dal/` (server-only modules
that own the query, return DTOs, and keep the persistence schema out of the UI).
It is incremental — not every query lives there yet — but new code should follow
the pattern. See `src/lib/dal/README.md`.

Hard rule (enforced by `tests/architecture/no-db-in-components.test.ts`):
**reusable components in `src/components/**` must NOT import `createAdminClient`
or `@/lib/supabase/server`.** They receive data as props or call a DAL function.
Pages (`src/app/**/page.tsx`) may fetch, preferably via the DAL.

## RLS is not the workspace boundary

RLS scopes by **membership**. It does not know which workspace the caller is
standing in: the active context and any support session live in a signed cookie
(`tf_active_context`) that never reaches Postgres, and `is_platform_admin()` is
role-only — so for a platform admin, including mid support session, RLS is not a
tenant boundary at all.

**Any read of a tenant-scoped table must carry its own predicate.** Derive it
from the resolved scope:

```ts
const scope = await resolveAuthorizedScope()
const scoped = applyTenantClientFilter(query, scope, 'client_id')
if (!scoped) return []            // confined to nothing — NOT unrestricted
const { data } = await scoped
```

For campaign-scoped reads, `getAccessibleCampaignIds(scope)` returns the same
shape: `null` only when genuinely unrestricted, an id list otherwise.

Do **not** write `if (!scope.isPlatformAdmin) { …narrow… }` — that skips the
predicate for an admin inside a client's workspace, which is exactly how the
Compare picker served one client's portal every tenant's participants.

Enforced by `tests/architecture/tenant-scope-predicates.test.ts`, which has a
vetted allowlist for genuinely cross-tenant platform-administration screens.
Background and the deferred database-side work:
`docs/superpowers/specs/2026-09-04-workspace-tenant-boundary.md`.

## Cognitive item bank — review gates delivery

Cognitive items (anything with a `cognitive_item_specs` row) may not be placed
into an assessment until they have cleared **both** content and fairness review.
Enforced by `assessment_section_items_review_gate`
(`20260815091500_cognitive_review_gate_on_delivery.sql`): the link is refused
unless `items.lifecycle_state` is `piloting`, `calibrated` or `operational`.

Consequences worth knowing before you debug one of them:

- **Fixtures break if they link a draft cognitive item.** Create the item at
  `piloting` directly (the lifecycle guard governs transitions, not INSERT), or
  record real sign-offs and transition it.
- **Non-cognitive items are unaffected.** Every item in the library is `draft`,
  including the 400+ Likert items in live assessments; the lifecycle states were
  introduced for the cognitive bank and only that bank uses them.
- **Nothing in the app promotes an item.** Sign-offs come from a person in
  `/cognitive-items/review`. `item_reviews` is append-only — a mistaken approval is
  corrected by adding a rejection, never by editing history. Any script that
  writes an `item_reviews` row is fabricating a sign-off; that is what
  `scripts/cognitive/ingest-to-live.ts` was rewritten to stop doing.

To load items, use **`/cognitive-items/generate`** (seed + per-family count). Ingest is
idempotent by content hash, so re-running a seed completes a partial load rather
than duplicating it.

Every producer shapes a bank through `src/lib/item-bank/from-generation.ts` —
`bankFilesFromGeneration` for the CLI that writes `items.json` to disk,
`bankFromGeneration` (same projection, then `parseBankFile`) for everyone who
ingests. **Do not reconstruct that shape by hand.** Two reasons, both learned the
hard way: identical seeds must produce identical content hashes or idempotency
stops meaning anything, and each hand-rolled copy silently dropped the
per-distractor error labels, so reviewers saw four indistinguishable wrong
answers and no later run could backfill them.

## AI provider

Every AI call, production included, goes through OpenRouter
(`OpenRouter_API_KEY`, mixed case); the Anthropic and OpenAI keys are empty.
Models are chosen per purpose in `ai_model_configs` and prompts in
`ai_system_prompts`, not in code. The account is a prepaid pool shared with
other projects, so HTTP 402 means the credit ran out. Check the balance before
debugging an AI failure as a code bug.

## Competency matching engines

Which engine ranks competencies for a role brief is selected by the
`competency_matching` model id in `ai_model_configs`, not a feature flag: a
`typesafe/` prefix (optionally `~typesafe/`) routes to the Jev decision-model
engine, anything else routes to the existing LLM ranking engine, unchanged.
Both the public Role Builder and the admin Architect share one pipeline, so
the switch applies to both at once.

Jev scores every outcome-eligible factor directly from the raw position
description (when available) with a **soft** level penalty, not the LLM
path's hard level filter — a factor for the "wrong" level can still surface
if Jev judges it relevant enough to outweigh the penalty. Any Jev failure
(timeout, malformed response, empty answers) falls back automatically to the
LLM engine; this is non-fatal and logged via `logActionError('matching.jev',
…)`, never surfaced as an error to the caller.

Reasons (the per-competency "why this matters" text) come from a separate,
non-fatal call under the `ranking_explanation` purpose (Haiku by default) —
losing that call degrades to an empty explanation, it never fails the match.

The Jev question wording is versioned in `src/lib/ai/matching/jev-criteria.ts`
(`JEV_CRITERIA_VERSION`). It is tuned wording, not incidental copy — change it
only alongside a harness re-run, per that file's own header.

Rollback for a bad Jev rollout is the same lever as enabling it: flip
`competency_matching.model_id` back to an LLM model id.

Details: `docs/superpowers/specs/2026-09-22-jev-competency-matching-design.md`
and `docs/evals/2026-09-22-jev-pipeline-redesign.md`.

## Auth model — passwordless / OTP only

Trajectas does not use password authentication. Sign-in is via email OTP (`signInWithOtp` → `verifyOtp`). Do not introduce any of the following:

- `signInWithPassword(...)` / `signUp({ email, password })`
- `resetPasswordForEmail(...)`
- `updateUser({ password: ... })`
- `auth.admin.createUser({ password })` / `auth.admin.updateUserById(..., { password })`

These are enforced by `tests/architecture/passwordless-only.test.ts` (fails CI) and by a database trigger that nulls any `encrypted_password` written to `auth.users` (migration `20260521130000_clear_user_passwords_and_lock.sql`). If you find yourself wanting to bypass either, talk it through first — the constraint is what makes the security story coherent.

MFA, HIBP leaked-password protection, password-strength rules, and password-reset flows are all N/A under this model.

## Partner-managed clients

A partner admin manages its own clients — details, branding, entitlements, users,
campaigns. Three rules keep that safe; see
`docs/superpowers/specs/2026-09-04-partner-self-service-design.md` for the full
model.

1. **`canManageClient(scope, clientId)` is the only way to ask "may this actor
   manage this client".** It reads `scope.managedClientIds`, which already unions
   direct client-admin memberships with the clients of partners the actor
   administers, and is already narrowed by workspace context and support
   sessions. Never compare against `clientAdminIds` directly — that set excludes
   partner admins by construction, which is the bug this replaced.
2. **Entitlements are a level up.** Assessment assignments and quotas, report
   template assignments and the client branding flag use
   `canManageClientEntitlements(scope, clientId, partnerId)`: the platform, or an
   admin of the partner that owns the client. A client's own admins run their
   workspace; they do not decide what it is entitled to.
3. **RLS write policies on the entitlement tables stay platform-admin-only.**
   Partner writes go through Server Actions on the service role, where the pool
   rule, the quota cap and the audit log apply. Widening those policies would let
   a partner write the rows directly and skip all three. The pool invariant lives
   in database triggers (`enforce_client_assignment_in_partner_pool`,
   `enforce_client_partner_change_pool`, `enforce_pool_row_removal`) so it binds
   every actor, service role included.

4. **Reading a campaign is membership-wide; writing one is not.**
   `requireCampaignAccess` admits any member of the owning client or partner,
   which is right for reads and wrong for every mutation, because the actions
   run on the service role and RLS never sees them. Campaign writes use
   `requireCampaignManage`, which layers `canManageCampaign` onto the same
   lookup. Pinned by `tests/architecture/campaign-write-manage-gate.test.ts`.

5. **A client owns its campaigns; its current partner determines partner access.**
   For campaigns with a `client_id`, never use the copied `campaigns.partner_id`
   as an independent authorization grant. The database synchronizes it when a
   client moves or is unassigned, and rejects conflicting campaign ownership
   writes. Creation and reassignment require `canManageClient` for the destination
   client. Clientless partner campaigns retain their independent partner owner.
   Pinned by `tests/integration/campaign-client-ownership.test.ts`.

6. **Platform authority still respects the selected workspace.**
   Use `isUnconfinedPlatformAdmin` for a global bypass, and the resolved client
   or managed-client sets otherwise. `isPlatformAdmin` alone does not authorize
   a different client while a workspace or support session is selected.

Brand writes carry one extra gate: `assertCanEditClientBrand`, at every write
site, not only on the flag toggle — and that includes the campaign brand layer,
which is what a participant actually sees.

## Naming Conventions

The schema has been through several renames. **Use the canonical names below**; the old names appear in historical migrations but must NOT be used in new code, migrations, or types.

### The customer entity: `clients` (not `organizations`)
Migration `00068` renamed `organizations` → `clients`. This includes:
- Table: `clients` (was `organizations`)
- FK columns: `client_id` (was `organization_id`) — across `assessments`, `campaigns`, `profiles`, `diagnostic_sessions`, etc.
- Helper functions: `auth_user_client_id()`, `auth_user_client_ids()`, `auth_user_client_admin_ids()` (were `auth_user_organization_id` etc.)

The `org_admin` UserRole value was **deliberately not renamed** — it's a semantic role label ("admin of an organisation/client"), not a table reference. Code may keep using `org_admin` as a string literal.

### Survey takers: `campaign_participants` (not `campaign_candidates`)
Migration `00031` renamed `campaign_candidates` → `campaign_participants`. The route directory `/dashboard/participants/` and the UI all use "participant".

The word "candidate" still appears in unrelated contexts (algorithmic candidate items in AI generation, e.g., `pairCandidates` in `construct-preflight.ts`). Don't confuse those with survey-taker candidates.

### Adjective vs noun: `org_*` vs `client_*`
The codebase uses two patterns and they mean different things:
- **`client_*`** prefixes name things that belong to / are scoped by a client. Examples: `client_id`, `client_memberships`, `client_roles`, `client_entitlements`.
- **`org_*`** prefixes are adjectival, meaning "organisational" — describing the *kind* of thing, not its owner. Examples: `org_admin` (a role of admin-of-an-org), `org_diagnostic_*` (diagnostics that profile an organisation).

Both are valid; pick based on intent. Do not "fix" `org_*` to `client_*` or vice versa without thinking.

### Org Diagnostic feature tables
Introduced 2026-04-20 (this branch). Canonical names:
- `org_diagnostic_campaigns` — the data-collection round (kind: baseline | role_rep)
- `org_diagnostic_campaign_tracks` — per-instrument tracks within a campaign
- `org_diagnostic_respondents` — invitees (anonymity-protected; client members have no SELECT policy)
- `org_diagnostic_profiles` — versioned snapshots produced when a campaign closes
- `client_roles` — hiring positions at a client (uses `client_*` because the row is scoped to a specific client)

See `docs/superpowers/specs/2026-04-20-org-diagnostic-campaigns-and-roles-design.md` for the full data model and rationale.

### Verify schema assumptions locally
Historical migrations alone do not establish the current schema. Inspect the isolated local stack; any live schema check needs permitted access and release scope:
```sh
docker exec supabase_db_trajectas-local psql -U postgres -d postgres -c "\d <table>"
```
