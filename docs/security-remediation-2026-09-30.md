# Security remediation — 30 September 2026

The September 30 review found anonymous configuration reads, report PDF authorization that did not enforce release/audience, and a platform-admin shortcut around selected-workspace session isolation.

## Changes

- Report PDF and status handlers now call `requireReportSnapshotReadAccess`. It checks the resolved campaign/workspace, individual-result confidentiality, and (for non-platform viewers) a released snapshot visible through the caller's RLS-scoped connection. Campaign management uses its separate authorization path.
- Session detail checks canonical session/campaign ownership unless the administrator is genuinely unconfined. Construct drilldown uses the same gate. Session report metadata now uses the user connection so hidden drafts and other audiences do not leak through a service-role listing.
- The migration revokes anonymous/public grants on eight configuration/composition tables, removes anonymous read policies, and scopes signed-in private compositions through the owning assessment. Partner-owned dimensions are scoped to the partner.
- Internal branding reads moved from a `use server` action module to a server-only DAL. Only the authorized preview and mutation actions remain callable from the browser. Source and selection-estimate action reads now require authorization.
- Updated nested Undici 6.28.0 to 6.29.0, development Undici 7.29.0 to 7.30.0, and markdown-it 14.3.0 to 14.3.2.

## Verification

- TypeScript, ESLint, production build, 97 architecture assertions, and 3,009 unit tests pass.
- Fresh disposable Supabase stack successfully replayed every migration, including the new restriction.
- 17 new database-backed regression tests pass. They exercise the actual authorization helpers and real PostgREST policies for anonymous requests, unrelated clients, report release/audience, selected workspaces, and authorized admin draft access.
- 120 existing targeted integration tests pass across the report, branding, support-session, assignment, membership, and tenant-isolation suites.
- The migration was applied to production via Supabase MCP. All eight anonymous HTTPS probes now return 401 / PostgreSQL 42501. Post-migration security advisors added no warnings.

## Remaining upstream audit metadata

The production dependency audit has zero high/critical entries. It still reports 35 moderate entries arising from Maily's Tiptap 2 dependency and the broad advisory range (no compatible automated fix). The installed nested `@tiptap/core` 2.27.3 contains the `__proto__` data-property protection; all seven targeted CJS/ESM exploit and compatibility regression tests pass. No warning was suppressed and the high-severity CI threshold is unchanged. Do not force Tiptap 3 into a Tiptap 2 editor solely to change the audit count.

The platform is passwordless; the Supabase leaked-password warning remains inapplicable. Authenticated SECURITY DEFINER warnings refer to the existing membership/policy helpers; no new privileged RPC was introduced.
