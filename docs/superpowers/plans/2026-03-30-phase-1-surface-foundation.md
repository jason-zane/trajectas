# Trajectas Phase 1 Surface Foundation

## Objective

Implement the first secure multi-host, multi-context foundation tranche for `trajectas` without breaking the current admin dashboard.

Phase 1 is not a partner or client portal build. It establishes the system that those portals will later sit on.

## Outcomes

Phase 1 should deliver:
- canonical surface definitions
- env-driven host resolution
- secure `proxy.ts` request handling
- baseline security headers and cache controls
- membership-based tenancy primitives
- audited support-session primitives
- actor/context resolution primitives
- report contract boundary definitions
- canonical `client` terminology in new docs and new abstractions

Phase 1 should not deliver:
- full partner UI
- full client UI
- full public marketing site
- participant account login
- broad schema renames from `organization` to `client`

## Implementation Scope

### 1. Host And Surface Foundation

Add canonical surfaces:
- `public`
- `assess`
- `admin`
- `partner`
- `client`

Add env-driven configuration:
- `PUBLIC_APP_URL`
- `ASSESS_APP_URL`
- `ADMIN_APP_URL`
- `PARTNER_APP_URL`
- `CLIENT_APP_URL`
- `SERVER_ACTION_ALLOWED_ORIGINS`
- `TRAJECTAS_CONTEXT_SECRET`

Implement:
- host resolution
- surface detection
- canonical host redirects for the assessment runtime
- placeholder isolation for unimplemented surfaces
- strict no-store headers on protected surfaces
- origin validation for protected mutation routes
- `X-Robots-Tag: noindex, nofollow` for non-public surfaces

### 2. Identity And Tenancy Foundation

Introduce membership-based tenancy as the long-term model:
- `partner_memberships`
- `client_memberships`

Compatibility rule:
- existing direct profile tenant fields remain temporarily
- existing `organizations` schema names remain temporarily
- new abstractions use `client`

Canonical direction after Phase 1:
- `profiles` represent identity
- platform authority stays on the profile
- partner/client access is resolved from memberships
- one signed-in user may have multiple memberships
- one active tenant context is selected per session

### 3. Support Sessions And Audit

Add support-session primitives:
- `support_sessions` table
- signed context support
- explicit support session start flow

Add audit primitives:
- `audit_events` table
- support launches log audit events
- role and membership changes log audit events
- report export events have a canonical audit target

### 4. Authorization And Context Resolution

Add server-side primitives for:
- resolving the signed-in actor
- resolving all memberships
- resolving the active tenant context
- asserting access to a surface
- asserting access to a tenant-scoped resource
- starting an audited support session

Rules:
- active context is host-local and signed
- active context never grants authority by itself
- context switching is always revalidated against memberships
- participant access remains separate from authenticated portal sessions

### 5. Report Boundary

Lock the interface boundary for reporting without building full export UX yet.

Define:
- `web report`
- `export report`

Rules:
- export is not a render of the web page
- both outputs consume shared report data
- report view permission and export permission are separate

## Compatibility Strategy

Phase 1 must keep the current admin dashboard working.

Do not:
- move settings out of admin
- move psychometrics out of admin
- expose lower-level AI controls
- expose lower-level primitive authoring
- broadly rename existing `organization` tables or columns

Phase 1 may:
- update user-facing copy from `organization` to `client`
- add a host-aware placeholder for unimplemented surfaces
- restrict portal switching to local development instead of production

## Database Work

Add new tables:
- `partner_memberships`
- `client_memberships`
- `support_sessions`
- `audit_events`

Backfill memberships from existing direct profile fields where possible.

Do not remove:
- `profiles.partner_id`
- `profiles.organization_id`

Those fields remain temporary compatibility fields until the service layer fully moves to memberships.

## Code Work

Add:
- shared surface constants and labels
- host resolution utilities
- request origin validation utilities
- signed active-context helpers
- server Supabase helper
- actor and membership resolution helper
- support-session helper
- `proxy.ts`

Update:
- `next.config.ts`
- `.env.example`
- dashboard shell surface handling
- user-facing `organization` labels in core navigation and shell components

## Test Focus

Verify:
- `/assess` routes redirect to the assessment host when configured
- the assessment host rewrites root and non-prefixed paths into `/assess`
- partner/client/public hosts do not fall through to admin routes
- protected surfaces return no-store headers
- protected mutation routes reject disallowed origins
- local development defaults safely to the admin surface
- admin-only surfaces keep admin-only navigation and labels
- user-facing copy moves toward `client` rather than `organization`

## Open Follow-Up Work After Phase 1

- build real partner route groups
- build real client route groups
- build the public marketing surface
- implement signed context switching UI
- implement full support-launch flows in the admin UI
- move more authorization decisions into canonical service-layer guards
- expand RLS from compatibility mode to full membership-based enforcement
