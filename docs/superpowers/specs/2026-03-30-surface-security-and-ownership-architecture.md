# Talent Fit Surface Security And Ownership Architecture

## Purpose

This document defines the core architectural boundaries for `talent-fit`.

Its purpose is to lock in:
- surface ownership
- actor model
- tenancy model
- authorization model
- reporting model
- audit and security baseline
- temporary-domain strategy

It does not define:
- final UI
- final navigation
- complete feature list
- final brand/domain naming

This is the boundary spec the product can grow inside.

## Product Goal

`talent-fit` is a multi-surface assessment platform designed to exceed the operational and security standard of Leadership Quarter.

The target system must support:
- public marketing and gated entry flows
- participant assessment runtime
- platform admin operations
- partner-facing workspace
- client-facing workspace
- secure report delivery
- separate web and export-grade reporting
- auditable privileged operations
- strict tenant isolation

## Architectural Principles

- One application for now, not multiple deployable apps.
- Multiple hostnames with explicit surface boundaries.
- Host separation is part of the security model.
- Server-side authorization is canonical.
- Database tenancy and RLS must enforce isolation.
- Domain and hostname configuration must be environment-driven.
- Reporting must support distinct web and export renderers.
- Every privileged action must be attributable and reviewable.
- UI can evolve after the platform boundaries are fixed.

## Terminology Standard

`client` is the canonical product term.

Use these terms in product, docs, and service design:
- client
- client portal
- client admin
- client member
- client campaigns
- client settings

`organization` remains a legacy internal persistence term while the current schema still uses `organizations`, `organization_id`, and related names.

Rules:
- New product language should use `client`.
- New service abstractions should use `client`.
- Existing database/table names can remain `organization`-based during Phase 1 for compatibility.
- When translation is needed, state it explicitly:
  - product/domain term: `client`
  - persistence compatibility term: `organization`

## Deployment And Hostname Strategy

### Initial model

`talent-fit` runs as one Next.js application with multiple domains or subdomains.

Target host pattern:
- `talentfit.com` for public
- `assess.talentfit.com` for participant runtime
- `admin.talentfit.com` for platform admin
- `partner.talentfit.com` for partner portal
- `client.talentfit.com` for client portal

### Temporary-domain strategy

The final brand/domain may not be known yet. The architecture must support:
- localhost
- Vercel preview domains
- temporary custom domains
- final production domains later

All hostname logic must be env-driven.

Required environment variables:
- `PUBLIC_APP_URL`
- `ASSESS_APP_URL`
- `ADMIN_APP_URL`
- `PARTNER_APP_URL`
- `CLIENT_APP_URL`
- `SERVER_ACTION_ALLOWED_ORIGINS`
- `TALENTFIT_CONTEXT_SECRET`

Rules:
- no hardcoded production domains in route logic
- no hardcoded domain assumptions in auth or session logic
- all redirects resolved through configuration
- local development must work without production domains

## Surface Model

### Public surface

Primary host:
- `talentfit.com`

Primary users:
- anonymous visitors
- prospects
- leads

Responsibilities:
- marketing site
- public product and capability pages
- lead capture
- gated public entry points
- public report request forms where applicable

Must not expose:
- portal data
- internal operations
- client-specific campaign data

### Assessment runtime surface

Primary host:
- `assess.talentfit.com`

Primary users:
- participants
- candidates
- invited respondents

Responsibilities:
- token-based assessment entry
- participant runtime
- invitation access
- progress and completion states
- allowed report access flows

Must not expose:
- admin controls
- partner or client workspace functions
- platform settings

### Admin surface

Primary host:
- `admin.talentfit.com`

Primary users:
- internal platform team

Responsibilities:
- assessment creation and design
- psychometrics
- organisation diagnostic engine setup
- partner and client administration
- platform settings
- operational monitoring
- audit review
- support tooling

Authority model:
- broad operational authority
- strongest audit obligations
- no unaudited impersonation

### Partner surface

Primary host:
- `partner.talentfit.com`

Primary users:
- consultants
- partner operators

Responsibilities:
- manage assigned clients
- manage assigned campaigns
- monitor engagement and outcomes
- access permitted reports and exports
- perform limited partner-scoped administration

Must not expose:
- unrelated clients
- platform-global settings
- unrestricted data outside assignment

### Client surface

Primary host:
- `client.talentfit.com`

Primary users:
- client stakeholders
- client admins
- client members

Responsibilities:
- manage their own campaigns
- view participant progress and outcomes
- download permitted reports and exports
- configure limited client settings and branding
- manage client-scoped users where permitted

Must not expose:
- other clients
- partner-global data
- platform-global administration

## Surface Ownership Rules

`admin` is the only surface that can manage:
- AI prompts
- AI model controls
- matching engine internals
- candidate experience primitives
- core brand settings
- all settings areas
- psychometric configuration
- item generation
- organisational diagnostic engine setup
- dimensions, factors, constructs, items, and response formats
- partner and client management

`partner` and `client` do not author platform primitives.

`partner` and `client` can:
- create assessments by assembling from admin-published blocks
- create and operate campaigns within permitted scope
- view participant information only in authorised tenant scope

Diagnostics model:
- admin defines the diagnostic engine and templates
- partner and client surfaces instantiate approved templates only
- lower levels do not author diagnostics primitives

AI model:
- lower levels have no direct AI controls
- lower levels consume approved behaviour only

## Actor Model

Initial actors:
- platform admin
- platform staff
- partner admin
- partner user
- client admin
- client member
- participant

Each actor definition must include:
- home surface
- tenant scope
- allowed read, write, and export actions
- whether cross-surface launch is permitted
- whether elevated support access is allowed
- audit requirements

The initial actor matrix does not need final sub-role detail. It must establish trust boundaries and scope ownership.

## Tenant Model

The system supports these ownership scopes:
- platform
- partner
- client
- campaign
- participant or session

Every record must have an unambiguous owning scope.

Examples:
- global assessment templates are platform-owned
- partner assets are partner-owned
- client branding is client-owned
- invitations are campaign-owned
- responses are participant or session scoped with campaign and client lineage

If a record does not have a clear owning scope, the model is incomplete.

## Authorization Model

Authorization is enforced at three levels.

### Host and surface gating

The request host determines the intended surface.

The system must:
- reject or redirect invalid host and surface combinations
- avoid serving the wrong surface from the wrong host
- apply stricter cache and security headers to sensitive hosts and routes

### Service-layer authorization

All sensitive operations must pass through canonical entitlement checks.

Examples:
- can this admin launch this client?
- can this partner view this client?
- can this client user export this report?
- can this participant access this runtime token?

UI visibility is never authorization.

### Database enforcement

RLS must enforce tenant and role boundaries.

Goals:
- prevent cross-tenant reads
- prevent cross-tenant writes
- prevent accidental over-broad service logic
- ensure direct DB access paths still obey scope boundaries

## Cross-Surface Access Model

Default rules:
- admin may access admin
- partner may access partner
- client may access client
- participant may access assess
- public users may access public

Special rules:
- admin-to-client launch is allowed only as audited support access
- admin-to-partner launch is allowed only as audited support access
- partner-to-client launch must be explicitly designed, not implied
- client-to-admin access is not allowed
- participant-to-portal access is not allowed

Any cross-surface access must record:
- actor
- target tenant
- reason
- timestamp
- session or action identifier

Support model:
- audited launch
- not true impersonation

## Session And Identity Model

The system must support:
- internal staff authentication
- partner authentication
- client authentication
- participant token and session access
- secure invite and reset flows

Rules:
- one cookie or session model is not assumed to fit every surface without controls
- session handling is surface-aware
- participant sessions never unlock portal data
- broad parent-domain shared cookies are not the default
- host-local sessions are preferred
- explicit signed handoff is used when cross-host transitions are needed

Membership model:
- multi-membership
- one active context per session

Participant model:
- token-first
- persistent participant accounts are optional later, not required in Phase 1

## Reporting Model

Reports are not a single rendering problem.

`talent-fit` supports two first-class report outputs over shared report data.

### Web report

Use cases:
- interactive review
- live exploration
- dynamic experience
- screen-first consumption

### Export report

Use cases:
- PDF
- presentation-ready output
- executive summaries
- controlled distribution
- print-safe formatting

Rules:
- export reports may differ from web reports
- export layout should not depend on rendering the web page directly
- PDF and export should use a deliberate report composition contract
- report view permission and report export permission are separate decisions
- access to exported reports must be governed and auditable

## Security Baseline

Assume “as secure as possible” means the following are required:
- strict host-aware routing
- CSP
- origin validation for protected mutations
- rate limiting on public and sensitive endpoints
- no-store caching on sensitive surfaces
- secure secret handling
- authenticated background jobs
- signed or tokenized report access
- strong tenant isolation
- least-privilege defaults
- role and membership change auditing
- export and report access auditing
- support-session auditing
- environment separation

Security requirements should be implemented as architecture, not as later cleanup.

## Audit And Compliance Baseline

Minimum audit goals:
- every privileged action attributable to a user
- every role or membership change logged
- every support or elevated access event logged
- every report export event logged
- every major settings change logged
- audit records queryable by actor, tenant, and timeframe

Minimum compliance-friendly capabilities:
- access review support
- retention and deletion policy support
- incident investigation support
- privileged action history
- environment and configuration clarity
- evidence-friendly operational logs

## Actor / Surface Matrix

| Actor | Home Surface | Active Context | Tenant Scope | Can View | Can Edit | Can Export | Can Cross-Launch | Audit Required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public visitor | `public` | none | public only | marketing pages, public entry forms | form submissions only | no | no | low |
| Participant | `assess` | invitation/runtime token | invitation, campaign, participant session | assigned runtime and allowed report pages | own responses within active session | only explicitly granted outputs | no | medium |
| Platform staff | `admin` | platform | global operational scope, subject to service checks | admin workspaces and assigned operational views | non-destructive operational actions only | yes where allowed | yes, audited launch to client or partner | high |
| Platform admin | `admin` | platform | global | all platform data and workspaces | platform settings, assessment authoring, psychometrics, tenant management, support actions | yes | yes, audited launch to client or partner | highest |
| Partner admin | `partner` | selected partner context | one partner and assigned clients/campaigns | partner workspace, assigned clients, assigned campaigns, permitted reports | partner-scoped campaign operations and partner users | yes for assigned scope | no by default | high |
| Partner user | `partner` | selected partner context | one partner and assigned clients/campaigns | assigned client and campaign data only | limited operational edits | limited exports | no | medium |
| Client admin | `client` | selected client context | one client and its campaigns | client workspace, campaigns, participants, reports, client settings | client settings, campaign operations, client user management where allowed | yes for own client | no | high |
| Client member | `client` | selected client context | one client and permitted campaigns | assigned client and campaign data only | limited operational updates | limited exports if allowed | no | medium |

## Resource Ownership Matrix

| Resource | Canonical Owner Scope | Primary Managing Surface | Editable By | Visible To | Exportable By | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Platform settings | platform | `admin` | platform admin | platform admin and limited platform staff if needed | no | security-sensitive and always audited |
| Assessment definitions | platform | `admin` | platform admin | admin only by default | no | authoring stays admin-only |
| Psychometric models and scoring config | platform | `admin` | platform admin | admin only by default | limited derived outputs only | no raw editing outside admin |
| Report templates and export layouts | platform | `admin` | platform admin | admin only; derived previews may be shown elsewhere | no direct template export | separate web and export contracts |
| Global brand system primitives | platform | `admin` | platform admin | admin; resolved outputs may be consumed everywhere | no | base design tokens, not tenant-managed |
| Partner profile and partner assets | partner | `partner` or `admin` | platform admin and partner admin where allowed | partner users and admin | limited | only if partner-level assets exist |
| Client profile | client | `client` and `admin` | platform admin and client admin | client users, assigned partner users, admin | limited | canonical client identity record |
| Client branding overrides | client | `client` and `admin` | platform admin and client admin | client users, assigned partner users, admin | no direct export | feeds runtime and report rendering |
| Client memberships | client | `client` and `admin` | platform admin and client admin | admin and relevant client admins | no | role changes always audited |
| Campaigns | client | `client`, `partner`, `admin` | platform admin, assigned partner users, allowed client users | users with client or campaign access | yes, subject to policy | ownership stays client-scoped even if partner-operated |
| Campaign invitations | campaign | `client`, `partner`, `admin` | users allowed to operate the campaign | campaign operators and admin | limited | invitation issuance and resend events audited |
| Participant records | campaign with participant lineage | `client`, `partner`, `admin`, `assess` | runtime writes by participant/session; management edits by authorised operators | authorised operators and participant on runtime/report path | limited | sensitive personal data handling required |
| Responses and submissions | participant/session with campaign lineage | `assess` for creation, portals/admin for review | participant runtime writes and admin/service post-processing | authorised operators by scope | yes where permitted | immutable raw response payload preferred |
| Derived scores and norms | client/campaign result scope | `admin`, read in `partner` and `client` | admin and service layer only | portals see only allowed derived outputs | yes, derived-only | keep psychometric internals separate from consumable outputs |
| Web reports | participant or campaign report scope | `assess`, `client`, `partner`, `admin` | service-generated, not edited in portal | actor allowed by report policy | controlled | authenticated or tokenized access required |
| Export reports / PDFs | participant or campaign export scope | `client`, `partner`, `admin`, sometimes `assess` via token | service-generated only | actor allowed by export policy | yes | every export event logged |
| Audit events | platform with tenant linkage | `admin` | append-only service writes | admin only | restricted admin export only | never editable in product UI |
| Support sessions / cross-launch events | platform with target tenant linkage | `admin` | append-only service writes | admin only | restricted admin export only | mandatory for audited launch model |

## Deferred Decisions

These can evolve later:
- exact navigation
- page inventory
- full workflow details
- final role granularity
- final domain names
- final branding
- full reporting catalog
- detailed UI polish

## Success Criteria

This brief is successful if:
- the team can build platform layers without knowing every final screen
- auth and data access are not redesigned later
- temporary domains work during build
- host and tenant boundaries remain stable as features expand
- report architecture can support both web and export outcomes
- security and auditability are foundational, not retrofitted
