# Admin Dashboard — Plan

**Status:** scaffold shipped (see `src/app/(dashboard)/admin/page.tsx`); rest is future work.

**Owner:** Jason
**Created:** 2026-05-21
**Trigger to revisit:** when support load makes the Supabase SQL editor the bottleneck, OR when a non-engineer joins to handle ops.

---

## Why this exists

Right now, all operational investigation (looking up a user, seeing what assessments they took, resending an invite, inspecting a stuck campaign) happens in the Supabase SQL editor. That's fine for a solo founder. It stops being fine the moment:

- A support person who doesn't write SQL needs to help a user
- Volume of "I can't log in" / "where's my report?" tickets exceeds 2 hrs/week of triage
- Multiple admins might step on each other's queries

The admin dashboard is the in-app replacement for that workflow.

## What the scaffold ships today

`/admin` (gated to `scope.isPlatformAdmin`) shows:

- **Build card** — commit SHA, branch, environment, region, deploy time. Sourced from `VERCEL_GIT_*` env vars. Lets you immediately answer "which version is live?" without leaving the app.
- **Users card** — total profile count, count with pending deletion.
- **Recent account deletions** — last 5 rows from `account_deletion_audit`. Forensic record of hard-deletes.

That's the minimum viable surface — enough to be useful when there's nothing else, and a hook for the rest to hang off.

## What it should grow into (phased)

### Phase 1 — User triage (highest value, build first when needed)

The "I can't log in" flow. Without this, you're still in the SQL editor for support.

- **User lookup** — search by email, return one or many profiles
- For a chosen user, show:
  - Last sign-in attempt (from `auth.users.last_sign_in_at`)
  - Email confirmation status
  - Active client / partner memberships
  - Recent OTP send history (timestamps + delivered/bounced status from Resend)
  - Pending deletion state if any
- Actions:
  - **Resend OTP** to the user's email
  - **Force sign-out everywhere** (revoke refresh tokens via `auth.admin.signOut`)
  - **Impersonate** (open a support session — see `support_sessions` table)
- All actions write to an `admin_action_audit` table — who did what to whom and when. This is the audit log the production-readiness checklist asked for (Section 14 P1).

### Phase 2 — Assessment / campaign inspection

- **Assessment lookup** — find by slug or title; see structure, item count, last edit
- For a chosen assessment, list campaigns using it and recent participants
- For a participant, show:
  - Session state (started / paused / completed / scored)
  - Last response timestamp
  - Computed scores (if available)
  - Report-snapshot list with link to PDF
- Actions:
  - **Reset participant session** — clear partial state so they can restart
  - **Re-run scoring** for a participant or whole campaign
  - **Re-render report** — regenerate snapshot from current template

### Phase 3 — System health + ops

- **Migration list** — show `supabase_migrations.schema_migrations` rows so you can compare deployed app to live schema at a glance (catches "I forgot to apply the migration to live" before it crashes prod)
- **Feature flag panel** if/when we introduce one
- **Cron job log** — last N runs of each cron route, success/failure, swept counts
- **Email queue** — recent Resend sends + their delivery status, especially failures
- **Rate-limit hits** — top recent throttle events from Upstash, to spot abuse
- **Org-level Supabase metrics** — DB connection count, slow queries (from `pg_stat_statements`)

### Phase 4 — Multi-admin coordination (only if a second admin joins)

- **Activity feed** — what other admins have done recently (from `admin_action_audit`)
- **Notes on users / clients** — internal-only notes pinned to a record
- **Saved searches** — bookmark common queries
- **Permission tiers** — distinguish platform_admin from support_agent (read-only or limited-write)

## Non-goals

- **Customer-facing analytics** — that's per-tenant work, not admin
- **Replacing the Supabase dashboard** — Supabase's SQL editor stays as the escape hatch for anything not covered by the dashboard. Don't try to be a general-purpose database UI.
- **Anything that requires building a query language** — if you need ad-hoc queries, use Supabase. Each admin feature should be a single purpose-built action.

## Architectural notes for whoever builds this

- **Where to live**: under `src/app/(dashboard)/admin/`. Stays inside the existing dashboard surface and layout so we don't need a new auth/header story.
- **Gating**: every page in this tree must check `scope.isPlatformAdmin` and `redirect("/unauthorized")` if not. Consider a route-group layout guard.
- **All writes go through server actions** — never expose admin endpoints directly to the browser.
- **All admin actions must write to `admin_action_audit`** (table to create when Phase 1 begins) — actor profile id, action type, target user id, payload, timestamp. This is the GDPR / accountability spine.
- **Don't introduce a new auth surface** (e.g. `admin.trajectas.com` is in `.env.example`, but it isn't wired). The existing dashboard sign-in + the `isPlatformAdmin` check are sufficient until we have actual non-platform admins who need a separate surface.
- **Hard-delete actions on users** should go through the same Stage A/B flow as user-initiated deletion (set `scheduled_deletion_at`, let the cron sweep). Admin-bypass of the grace period is a separate, audited action.

## What we're not committing to

This document captures the shape of the eventual admin dashboard. It does NOT commit us to building any specific phase by any specific date. Build a phase when its trigger fires (volume, second admin, specific support pain), not before.
