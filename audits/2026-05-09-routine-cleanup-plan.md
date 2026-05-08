# Routine Cleanup & Remediation Plan — 2026-05-09

Comprehensive plan to (a) clear the work the scheduled routines accumulated, (b) fix the genuine outstanding issues, (c) verify the site end-to-end, then retire the routines.

## Context (snapshot at start)

- 9 remote routines configured, 8 still active.
- 43 open `claude/*` PRs, all failing CI on the `security` job.
- 7 stale issues (4 "Assessment Performance Baseline", 3 "Weekly Health Report").
- 17 server-action files without Zod validation.
- 0 of 15 `/assess/*` participant routes have `error.tsx`.
- Login Lambda static-import regression #3 is live in `main` (`email/render.ts` → `brand-frame.tsx` → `@react-email/components`).
- 51 production DB advisor findings (security: 51 / performance: 400).
- Build / typecheck / lint pass locally (with `.env.local`); 2 integration tests time out against prod (need local Docker Supabase).

## Phase 1 — Unblock CI (security gate + login regression)

Goal: produce one PR that goes green on main and unblocks every other PR in the backlog.

1.1 **Fix login Lambda static-graph regression**
- Edit [src/lib/email/render.ts](src/lib/email/render.ts): convert `import { EmailBrandFrame } from './brand-frame'` to dynamic-import inside `renderEmailHtml()`, alongside the existing `await import('@react-email/components')` block.
- Verify static graph by re-running the audit script: chain from `login/page.tsx` and `actions/auth.ts` should not hit `@react-email/components`, `@maily-to/render`, `juice`, `sanitize-html`, etc.
- Add a comment on `brand-frame.tsx` explaining why it MUST be dynamically imported (prevent regression #4).

1.2 **Resolve npm audit failures**
- `npm audit fix` for non-breaking.
- Bump `@anthropic-ai/sdk` to ≥0.91.1 (insecure default file permissions).
- Evaluate `next` minor bump for postcss vulnerability; if breaking, add `overrides` in package.json for postcss ≥8.5.10.
- Add overrides for `uuid` ≥13.0.1 if `@maily-to/core` pins an old one.
- Investigate `basic-ftp` HIGH (probably from sandbox/MCP transitive) — override or upgrade.
- Goal: `npm audit --audit-level=high` exits 0; `--audit-level=moderate` ideally too.

1.3 **Verification**
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run build` clean.
- `npm run test:coverage` (unit + non-integration) — 0 regressions.
- Commit, push branch, open PR on this worktree's branch (`claude/mystifying-mestorf-d1e059`).
- Wait for CI green; if security still red, iterate.
- **Merge** Phase 1 PR — required before Phase 2.

## Phase 2 — Triage and close the routine PR backlog

Goal: get the 43 stale PRs to one of: merged, closed-as-duplicate, or rebased/green.

2.1 **Close clear duplicates**
Per health report #80:
- `assess.ts` validation: keep newest (#47), close #10, #36.
- `assess/section` error boundary: keep newest (#86), close #49, #70.
- `partners.ts` errors: keep #71, close #48.
- `generation.ts` errors: keep #60, close #46.
- `scoring/transforms.ts` tests: keep #58, close #28.

2.2 **Rebase remaining PRs on the new green main**
- For each survivor: rebase or merge main, push.
- Some routine PRs are old (#9, #13, #14) — re-open or close as stale based on whether the work is still applicable (the Supabase-error-handling routine is now reporting 0 unchecked, so older PRs may no longer apply).

2.3 **Merge what passes CI cleanly**
- For each PR that goes green after rebase: read the diff (small — single file each), spot-check, merge.
- Aim: clear at least 25 of the 43.
- For any PR that fails after rebase: either fix or close with explanation.

2.4 **Close stale issues**
- Close 3 duplicate "Assessment Performance Baseline" issues (#12, #52, #73) — keep latest (#89) or close all if work in this plan supersedes them.
- Close 2 stale Weekly Health Reports (#30, #59) — superseded by #80.

## Phase 3 — Finish genuinely missing work

3.1 **`/assess` error boundaries**
- Add `error.tsx` at `src/app/assess/[token]/error.tsx` (root catch-all for the participant token flow). The routine was over-decomposed — one root boundary covers all child routes via React's error boundary chain.
- Optional: separate boundary at `src/app/assess/[token]/section/[sectionIndex]/error.tsx` with section-specific copy ("Your responses have been saved").
- Match brand styling, calm copy, no exclamation marks per design rules.
- One PR.

3.2 **Validation backfill — finish the 17**
- For files with already-open routine PRs (most of them): rebase, verify, merge in Phase 2.
- For files without an existing PR: write the schema + safeParse blocks. Files: `dimension-constructs`, `integrations`, `user-management` (cross-check the open-PR list).
- One PR per file or one combined PR — depends on what's left after Phase 2.

3.3 **'any' drift**
- 11 new since baseline. Inspect and decide per file: tighten or accept. Lower priority — separate PR.

## Phase 4 — Database hardening

Each sub-phase is one Supabase migration applied via MCP, named descriptively.

4.1 **RLS policies for unprotected tables** (`migration: rls_policies_for_advisor_findings`)
- Tables: `contact_submissions`, `generated_items`, `generation_run_logs`, `generation_runs`, `platform_settings`.
- For each: figure out who reads/writes (grep code), add appropriate policies. Safe default: service_role only (no anon, no authenticated) for the AI-internal tables; `contact_submissions` likely needs anon INSERT only; `platform_settings` likely platform_admin SELECT.

4.2 **Tighten `campaign_report_templates` policies** (`migration: campaign_report_templates_rls_tighten`)
- Replace `USING (true)` policies with proper client/partner scoping.

4.3 **Lock down SECURITY DEFINER helpers** (`migration: security_definer_revoke_anon`)
- For helper functions intended for internal RLS use only (`auth_user_client_id`, `auth_user_client_ids`, `auth_user_client_admin_ids`, `auth_user_partner_*`, `auth_user_role`, `is_platform_admin`, `is_partner_admin`, `rls_auto_enable`, `create_report_snapshots_on_completion`):
  - `REVOKE EXECUTE … FROM anon, authenticated, public;`
  - Keep `service_role` execute.
  - `auth_user_*` helpers may need to remain callable in RLS contexts (RLS policies execute with caller's role). Verify by checking if any are called from client code (RPC) — if not, revoke.

4.4 **Fix mutable `search_path` on functions** (`migration: function_search_path_lockdown`)
- For each: `ALTER FUNCTION public.<name>(<args>) SET search_path = '';`
- 12 functions: `brand_configs_set_updated_at`, `experience_templates_set_updated_at`, `activate_ai_system_prompt`, `set_updated_at`, `get_client_assessment_quota_usage_bulk`, `get_partner_assessment_quota_usage_bulk`, `create_report_snapshots_on_completion`, `get_assessment_quota_usage`, `increment_access_link_usage`, `get_partner_assessment_quota_usage`, `auth_user_role`, `is_platform_admin`.

4.5 **Move `citext` extension out of `public`** (`migration: extension_citext_to_extensions_schema`)
- `CREATE SCHEMA IF NOT EXISTS extensions; ALTER EXTENSION citext SET SCHEMA extensions;`
- Search code for any qualified references and update.

4.6 **Enable HaveIBeenPwned password protection** — manual step in Supabase dashboard. Document in plan with a TODO for the user.

4.7 **Performance pass — split into focused migrations**
- 4.7a `migration: rls_uid_subquery_wrap` — wrap `auth.uid()` calls in `(select auth.uid())` for the top 15 tables hit by the advisor.
- 4.7b `migration: add_missing_fk_indexes` — add B-tree indexes on the 38 unindexed foreign keys (pick top tables: `integration_launches`, `client_assessment_assignments`, etc.).
- 4.7c `migration: drop_unused_indexes` — only after careful audit; some "unused" indexes are recently added and haven't seen traffic yet. Defer if uncertain.
- 4.7d `migration: consolidate_multi_permissive_policies` — biggest wins; may be too sprawling for one pass; pick top 5 tables with highest counts.

## Phase 5 — End-to-end site verification

After all PRs merged and migrations applied:

5.1 **CI checks green** — `typecheck`, `lint`, `test:coverage`, `build`.

5.2 **Static-graph audit** — re-run the login lambda audit script. Must come back clean.

5.3 **Local dev server** — start `npm run dev`, smoke-test:
- `/login` loads, OTP request works (just send to a test email — don't follow link).
- `/dashboard` loads after login.
- `/assess/<test-token>` participant flow renders welcome.
- A representative admin page from each section (campaigns, items, factors, reports).
- Hit a couple of API routes; check no 500s in console.

5.4 **DB advisor re-check** — `get_advisors` for `security` and `performance`. Compare counts. Document deltas in this plan's appendix.

5.5 **Disable + clean up routines** — once everything is green, the user can disable all 8 active routines (one-time login audit can stay; haiku-vs-sonnet is already disabled). Provide a note on what to delete vs keep.

## Out of scope / deferred

- 2 integration tests timing out (`org-diagnostic-rls`, `org-diagnostic-lifecycle`) — these need local Docker; will run them after Docker is available.
- Dropping unused indexes (4.7c) — risk of dropping recently-added indexes; defer unless explicit signal from query plans.
- Test coverage backfill for the priority list in the routine prompt — the routine got 1 file in (transforms); the rest is a separate ongoing effort, not required for "get the site working".

## Appendix — running progress log

(filled in as phases complete)
