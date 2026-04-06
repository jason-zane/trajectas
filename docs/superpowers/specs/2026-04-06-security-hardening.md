# Security Hardening Spec

## Overview

Harden the platform's multi-tenant data isolation with database-level defense-in-depth, automated boundary tests, and production infrastructure (security headers, rate limiting, audit logging). This spec covers technical security only — GDPR compliance (data export, erasure, consent, retention) is a separate follow-up spec.

### Threat Model

The platform stores personal assessment data across three tenant tiers:

| Tier | Can See | Cannot See |
|------|---------|------------|
| Platform admin | Everything across all tenants | — |
| Partner admin | Their own partner's clients, campaigns, participants | Other partners' data, other partners' clients |
| Client admin | Their own campaigns and participants | Other clients' data, other partners |
| Participant | Only their own responses and released reports | Other participants' data, campaign config |

A breach at any tier must not grant access to data from a higher or adjacent tier. The platform must enforce this through **two independent boundaries**: application-layer authorization AND database-layer row-level security.

### Current State

- **Application layer:** `resolveAuthorizedScope()` is the single chokepoint. All server actions use it. Tenant scoping works but is the only boundary.
- **Database layer:** RLS policies exist on all tables but are bypassed because all server actions use `createAdminClient()` (service role). RLS is currently decorative, not functional.
- **Testing:** One unit test file (`authorization-rules.test.ts`) with basic scope checks. No integration tests proving RLS enforcement.
- **Production infrastructure:** No security headers configured. No rate limiting. Audit logging covers mutations only, not reads of personal data.

---

## 1. RLS Policy Audit and Repair

### 1.1 Goal

Ensure every table with tenant-scoped data has correct, complete RLS policies that enforce the same access rules as the application layer. This is a prerequisite for switching reads to the authenticated client.

### 1.2 Scope

Every table that contains or references tenant data. Key tables:

| Table | Scoping Column | Expected Access |
|-------|---------------|-----------------|
| `clients` | `id` | Platform admin: all. Partner admin: own partner's clients. Client admin: own row. |
| `campaigns` | `client_id`, `partner_id` | Scoped by client ownership or partner relationship |
| `campaign_participants` | via `campaigns.client_id` | Scoped by campaign's client |
| `campaign_assessments` | via `campaigns.client_id` | Same as campaigns |
| `campaign_access_links` | via `campaigns.client_id` | Same as campaigns |
| `participant_sessions` | `client_id` | Client: own. Partner: own clients'. Participant: own session. |
| `participant_responses` | via `participant_sessions` | Same as sessions |
| `participant_scores` | via `participant_sessions` | Same as sessions |
| `report_snapshots` | via `campaigns.client_id` | Client/partner: released only. Admin: all. Participant: own + released. |
| `client_memberships` | `client_id` | Platform admin: all. Client admin: own client. |
| `partner_memberships` | `partner_id` | Platform admin: all. Partner admin: own partner. |
| `client_assessment_assignments` | `client_id` | Platform admin: all. Client member: own (read only). |
| `client_report_template_assignments` | `client_id` | Same as above. |
| `assessments` | `client_id` (nullable) | Platform admin: all. Client: own + platform-global (NULL). |
| `factors` | `client_id` (nullable) | Same pattern as assessments. |
| `brand_configs` | `owner_type`, `owner_id` | Scoped by owner. Platform default readable by all. |
| `experience_templates` | `owner_type`, `owner_id` | Scoped by owner. |
| `audit_events` | `client_id`, `partner_id` | Platform admin only for cross-tenant. Scoped by tenant otherwise. |
| `support_sessions` | `actor_profile_id` | Platform admin only. |

### 1.3 Approach

1. Run a comprehensive query against `pg_policies` to list every existing RLS policy, compare against the expected access table above
2. Identify gaps (tables with RLS enabled but missing policies, tables with RLS disabled)
3. Write a migration to fix all gaps
4. Test by running queries through the authenticated client for each actor type

### 1.4 RLS Helper Functions

The following SQL helper functions are used in RLS policies and must be correct:

- `is_platform_admin()` — checks `profiles.role = 'platform_admin'` for `auth.uid()`
- `auth_user_client_id()` — returns `profiles.client_id` for `auth.uid()`
- `auth_user_client_ids()` — returns array of all accessible client IDs (direct + via membership)
- `auth_user_partner_id()` — returns `profiles.partner_id` for `auth.uid()`
- `auth_user_role()` — returns `profiles.role` for `auth.uid()`
- `is_partner_admin()` — checks role is `partner_admin`

Verify each function is correct after the rename migration. The `auth_user_client_id()` function was recreated in migration 00068 — confirm it references `clients` table, not `organizations`.

---

## 2. Migrate Read Operations to Authenticated Client

### 2.1 Goal

Switch all data-reading server actions from `createAdminClient()` (service role, bypasses RLS) to `createClient()` (user JWT, respects RLS). This makes RLS a functional security boundary, not just documentation.

### 2.2 What Switches

**All SELECT operations in server actions** — any place that calls `createAdminClient()` and then does a `.select()` or `.rpc()` for reading data.

Files to migrate:
- `src/app/actions/campaigns.ts` — `getCampaigns`, `getCampaignById`, `getParticipantsForClient`
- `src/app/actions/clients.ts` — `getClients`, `getClientBySlug`, `getClientDirectoryEntries`, `getClientStats`, `getClientMembers`, `getClientPendingInvites`
- `src/app/actions/partners.ts` — `getPartners`, `getPartnerBySlug`, `getPartnerStats`, `getPartnerMembers`, `getPartnerPendingInvites`
- `src/app/actions/client-entitlements.ts` — `getAssessmentAssignments`, `getReportTemplateAssignments`, `checkQuotaAvailability`, `getAvailableAssessmentsForClient`, `getAvailableReportTemplateIds`
- `src/app/actions/reports.ts` — `getReportTemplates`, `getReportSnapshot`, `getReportSnapshotsForCampaign`, `getParticipantReportSnapshot`
- `src/app/actions/assessments.ts` — `getAssessments`, `getAssessmentById`, `getActiveAssessments`
- `src/app/actions/factors.ts` — `getFactors`, `getFactorBySlug`
- `src/app/actions/diagnostics.ts` — `getDiagnosticSessions`, `getDiagnosticById`
- `src/app/actions/matching.ts` — `getMatchingRuns`, `getMatchingResults`
- `src/app/actions/assess.ts` — `validateAccessToken`, `getSessionState`, participant-facing reads
- `src/app/actions/participants.ts` — `getParticipants`, `getParticipant`, `getParticipantSessions`, `getParticipantActivity`, `getParticipantResponses`
- `src/app/actions/dashboard.ts` — dashboard aggregate queries

### 2.3 What Stays on Admin Client

| Use Case | Why |
|----------|-----|
| All INSERT/UPDATE/DELETE operations | App controls write logic; RLS for writes is more complex and risky |
| `resolveAuthorizedScope()` and auth helpers | Need to query profiles/memberships regardless of caller's role |
| Background jobs (report generation) | No user session available |
| API routes with internal auth key | Service-to-service calls |
| Cross-tenant aggregate queries (e.g., platform-wide reporting) | Platform admin needs to query without tenant filter; RLS `is_platform_admin()` handles most cases but aggregate joins across all tenants may need service role |

### 2.4 Migration Pattern

For each server action:

```typescript
// BEFORE
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCampaigns() {
  const db = createAdminClient();
  // ...
}

// AFTER
import { createClient } from "@/lib/supabase/server";

export async function getCampaigns() {
  const db = await createClient();
  // ...
}
```

Note: `createClient()` is async (reads cookies), while `createAdminClient()` is sync. Every call site needs `await`.

### 2.5 Handling RLS Failures

When a query returns no data due to RLS (not an error, just empty results), the server action should handle it the same as it handles no data today. Most actions already return `[]` or `null` for empty results.

When RLS causes an actual error (e.g., insufficient privilege for an INSERT through the wrong client), the action should catch it and return a clear error message. Never expose the raw Postgres error to the user.

### 2.6 Platform Admin Access Pattern

Platform admins need to see all data from the admin portal. This works because:
- RLS policies check `is_platform_admin()` which returns true for `role = 'platform_admin'`
- The authenticated client carries their JWT, which includes their `auth.uid()`
- The `is_platform_admin()` function checks their profile role

No special handling needed — the same JWT that authenticates them also grants them admin-level RLS access.

---

## 3. Tenant Isolation Boundary Tests

### 3.1 Unit Tests

Extend `tests/unit/authorization-rules.test.ts` with comprehensive scenarios.

**Test matrix:**

| Actor | Action | Expected |
|-------|--------|----------|
| Platform admin | `canAccessClient(any)` | true |
| Platform admin | `canManageClient(any, any_partner)` | true |
| Partner A admin | `canAccessClient(A1)` | true |
| Partner A admin | `canAccessClient(B1)` | false |
| Partner A admin | `canManageClient(A1, partnerA)` | true |
| Partner A admin | `canManageClient(B1, partnerB)` | false |
| Client A1 admin | `canAccessClient(A1)` | true |
| Client A1 admin | `canAccessClient(A2)` | false |
| Client A1 admin | `canManageClient(A1, null)` | true |
| Client A1 admin | `canManageClient(A2, null)` | false |
| Platform admin on client surface | `getCampaigns({ clientId: A1 })` | only A1 campaigns |
| Support session for A1 | scope.clientIds | `[A1]` only |

**Additional edge cases:**
- Partner admin with zero clients — no data, no errors
- Client admin with revoked membership — no access
- Expired support session — no elevated access
- Platform admin with active context set to Client A1 — scope restricted to A1

### 3.2 Integration Tests

New test file: `tests/integration/tenant-isolation.test.ts`

**Test fixture:**
```
Partner A
  |-- Client A1
  |   |-- Campaign A1-C1 (with participants)
  |   +-- Campaign A1-C2
  +-- Client A2
      +-- Campaign A2-C1

Partner B
  +-- Client B1
      +-- Campaign B1-C1 (with participants)
```

**Test actors:**
- `platformAdmin` — Supabase auth user with `role = 'platform_admin'`
- `partnerAAdmin` — auth user with `partner_memberships` for Partner A (role: admin)
- `clientA1Admin` — auth user with `client_memberships` for Client A1 (role: admin)
- `clientB1Admin` — auth user with `client_memberships` for Client B1 (role: admin)

**Test assertions (RLS-level):**

Each test creates a Supabase client authenticated as the test actor and runs queries:

- Client A1 admin sees only A1 campaigns, participants, assessments
- Partner A admin sees A1 + A2 campaigns, not B1
- Client B1 admin sees only B1 data
- Platform admin sees everything
- Cross-partner isolation: Partner A cannot see Partner B data
- Cross-client isolation within same partner: Client A1 cannot see A2 data

**Test runner:** Vitest with a `beforeAll` that creates the fixture data using the admin client, and `afterAll` that cleans up. Tests use per-actor authenticated clients.

**Auth mechanism for test actors:** Use Supabase's `auth.admin.createUser()` (service role) to create test users, then sign in with `auth.signInWithPassword()` to get JWTs. Each test actor gets a real Supabase auth user with the correct profile role and memberships. This tests the full auth chain including JWT verification and RLS policy evaluation.

### 3.3 CI Integration

- Unit tests run on every commit (fast, no DB needed)
- Integration tests run on PR and before merge (require Supabase, slower)
- Test failures block merge — boundary violations are never acceptable

---

## 4. Security Headers

### 4.1 Configuration

Add to `next.config.ts` headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 4.2 Content Security Policy

Different CSP per surface, implemented in Next.js middleware:

- **Admin portal** (most permissive): allows unsafe-inline for styles (rich text editors), img from Supabase storage
- **Client/Partner portal** (moderate): same style allowance, tighter script-src
- **Assess flow** (strictest): participant-facing, frame-ancestors 'none', tightest script-src

Note: `unsafe-inline` for styles is needed for Tailwind inline styles and brand CSS tokens. The CSS sanitisation added in the security fixes mitigates the injection risk.

---

## 5. Rate Limiting

### 5.1 Middleware-Level Rate Limiting

| Path Pattern | Limit | Key |
|-------------|-------|-----|
| `/login`, `/api/auth/*` | 10/minute | IP |
| `/assess/join/*` (self-enrollment) | 10/minute | IP |
| `/api/reports/generate` | 30/minute | Internal key |
| All server actions (default) | 60/minute | Authenticated user ID |

### 5.2 Implementation

In-memory rate limiter for development (simple Map with sliding window). For production, use Vercel rate limiting or Upstash Redis.

Middleware checks before the request reaches the server action. If exceeded, return `429 Too Many Requests` with `Retry-After` header.

---

## 6. Audit Logging for Data Reads

### 6.1 What to Log

Only reads of **personal data** and **cross-tenant access**:

| Event | When | What to Record |
|-------|------|----------------|
| `report.viewed` | Participant report viewed by any actor | actor, snapshot_id, participant_id, audience_type |
| `support_session.data_accessed` | Any data read during a support session | actor, session_id, resource_type, resource_id |
| `participant.data_exported` | Bulk data export (future GDPR feature) | actor, client_id, export_type |
| `client.portal_entered` | Admin enters client portal | actor, client_id, session_id (already logged via support_sessions) |

### 6.2 Implementation

Extend the existing `logAuditEvent` function with new event types. For support session logging: log once per page navigation when an active support session is detected, debounced.

### 6.3 Storage

Same `audit_events` table. Add index on `(event_type, created_at)` for querying read events.

---

## 7. Error Disclosure Cleanup

### 7.1 Pattern

Every server action should:
- Log the full error server-side
- Return a generic message to the client
- Never expose Supabase error details, column names, query structure, tenant IDs from other tenants, or stack traces

### 7.2 Scope

Audit all server action files for raw error propagation. Prioritise:
1. Participant-facing actions (assess flow) — highest risk, untrusted users
2. Client/partner portal actions — external users
3. Admin actions — lowest risk (trusted users), but still clean up

---

## 8. Execution Order

| Phase | What | Dependency |
|-------|------|-----------|
| 1 | RLS policy audit + repair migration | None |
| 2 | Boundary unit tests (authorization functions) | None |
| 3 | Authenticated client migration (reads) | Phase 1 |
| 4 | Integration boundary tests (RLS enforcement) | Phase 1 + 3 |
| 5 | Security headers + CSP middleware | None (independent) |
| 6 | Rate limiting middleware | None (independent) |
| 7 | Audit logging for reads | None (independent) |
| 8 | Error disclosure cleanup | None (independent) |

Phases 5-8 are independent and can be done in parallel or any order. Phases 1-4 are sequential.

---

## Out of Scope

- GDPR compliance (data export, erasure, consent records, retention) — separate spec
- Penetration testing — recommended before production launch
- SOC 2 compliance — future consideration
- Client branding editor upgrade — separate Spec B
- Client portal settings page — separate feature work
- Platform admin users page redesign — separate feature work
