# Trajectas customer readiness and Five Brains review

**5 October 2026 · Development/coaching launch · Existing data treated as synthetic**

## Decision

**Do not launch the current production version to independent clients or partner-managed clients yet.** The implementation branch repairs material authorization, assessment-flow, data-quality and score-reporting defects. It also provides a usable foundation for collecting research permission, recording observation provenance, defining norm cohorts and creating immutable descriptive study drafts.

The fixes need a coordinated schema/application rollout and the release checks below. They do not supply empirical validity, representative norms, reliable-change evidence or permission to use Five Brains for hiring. Jason confirmed development/coaching as the first intended use.

| Area | Present verdict | What enables the next step |
|---|---|---|
| Direct clients operating independently | Hold production launch | Deploy reviewed changes; verify client onboarding, permissions, email, assessment, report and recovery in staging; complete infrastructure/privacy setup |
| Partners with their own clients | Hold production launch | All direct-client gates, plus a complete partner/client membership, reassignment, entitlements and confidentiality walkthrough |
| Assisted development/coaching pilot | Suitable direction after release gates | Explicit self-report pilot wording, trained interpretation, support process, no selection/ranking claims |
| Five Brains arithmetic | Core formula consistent; reporting defects repaired in branch | Validate a complete 150-item administration through persistence and PDF in staging |
| Empirical norm groups | Draft-study infrastructure implemented | Collect eligible real first administrations under a defined sampling plan; expert review before any published norm |
| Hiring/selection, promotion or objective growth decisions | Not supported by available evidence | A separate intended-use validation programme and defensible decision rules |

## Scope and evidence limits

Reviewed the Next.js/React application, server actions, tenant authorization, Supabase schema/migrations, participant lifecycle, Five Brains CTT/POMP scoring, reports, calibration, demographics and norm infrastructure. Starting source was main commit `8b148adf222e5cd202a69535da7b36c2a5529be6`. Changes are isolated on `fix/customer-readiness`.

Evidence includes the earlier same-day read-only source/schema inventories, current production project metadata and policy catalogue reads, current published infrastructure/dependency documentation, ordinary mocked unit/component tests, architecture checks, and migration replay against a disposable schema-only local database. Existing score rows and earlier arithmetic comparisons are synthetic; they are not a validation sample.

No live exploitation, penetration testing, load testing, customer email sending or unauthorized cross-tenant request testing was performed. A schema check is not an end-to-end tenant-isolation certificate. A coordinated live migration was attempted through the supported connector, but automatic approval review rejected it before application. **No live schema or application deployment occurred.** Billing was not changed.

## Security findings and repairs

| ID / priority | Evidence and impact | Branch repair / remaining gate |
|---|---|---|
| SEC-01 Critical | Four exported server actions accepted a caller-supplied `systemScope`. Service-role mutations could therefore rely on authority supplied at the public action boundary. Locations: `src/app/actions/campaigns.ts`, `assessments.ts`; legitimate Role Builder orchestration in `public-builds.ts`. | Public wrappers now accept business inputs only and resolve normal authorization. Trusted implementations moved into `server-only` service modules; the Role Builder retains its fixed server-owned context after its ownership gate. Confirm normal client and public-builder paths in staging. |
| SEC-02 High | Authenticated raw session/response write grants provided a path around the guarded token/session RPC contract and scoring invariants. | Migration revokes direct INSERT/UPDATE/DELETE, including column grants, from browser roles. Supported guarded RPCs/server actions remain the write path. Migration pending production approval; check all supported workflows after rollout. |
| SEC-03 High | Production `assessment_sections_select` and `assessment_section_items_select` used `true` for authenticated users. The active-account policy is restrictive and does not add tenant ownership. | Child reads now inherit parent assessment visibility through RLS. Shared assessment libraries remain governed by their parent policy. Verify private client/partner instruments alongside intentionally assigned/shared instruments. |
| SEC-04 High | Several assessment, partner, entitlement and report-template helpers treated platform-admin role as a global bypass while a workspace/support context was selected. | Updated these helpers to use unconfined platform authority and the resolved client/managed-client sets. The branch also corrects the report read bypass. Selected-workspace and support-session walkthrough remains required. |
| SEC-05 High | Signed report grants and self-serve resends did not consistently recheck later withdrawal/deletion. Locations: participant HTML viewer, dashboard token viewer, PDF/status endpoints, report resend. | A shared recipient availability check now blocks withdrawn/expired or deleted participants and deleted campaigns/owning clients. Staff report access, report email preparation and consultant notifications use the same availability contract. Prior emailed PDF attachments cannot be recalled. |
| SEC-06 Medium, residual | Ordinary authenticated library readers can access item/key metadata under existing library policies. | This review has not redesigned author/library entitlements or split sensitive scoring columns. Restrict first-pilot staff/library memberships and review this before distributing keyed cognitive/SJT instruments or promising item-bank secrecy. |
| DEP-01 Critical upstream advisory | Lockfile contained Next.js 16.3.5, within the affected range of GHSA-vcvr-r3jv-pc5j. Applicability depends on untrusted SVG inputs to Node ImageResponse; this review did not demonstrate exploitation in Trajectas. | Patched Next.js and associated runtime packages to 16.3.8 in a separate dependency change. Production dependency audit now reports zero high/critical findings; moderate findings remain. |

The upstream advisory and its conditions are documented by [the Next.js maintainers](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). The remaining production audit count is 35 moderate dependency findings, principally dependency families also present in rich-text tooling. Existing sanitization and dependency-specific tests are useful mitigations; they do not mean every advisory is resolved. The full dependency graph additionally contains development-tool advisories that require separate maintenance rather than a forced downgrade.

Existing positive controls include OTP-only sign-in, server-side service-role isolation, RLS on the previously inventoried base tables, private report storage, confidentiality checks, campaign management gates, client/partner pool constraints, delivered-form freezing and delivered-content/scoring guards. These controls must be assessed together: [Supabase documents that grants and row policies are separate checks](https://supabase.com/docs/guides/database/postgres/row-level-security).

The current Supabase security advisor returned 12 signed-in-executable SECURITY DEFINER helper warnings and a leaked-password-protection warning. Most named functions are membership/role helpers used by existing policies; review their narrow return values, search paths and intended callers rather than removing policy dependencies indiscriminately. The password warning needs interpretation against Trajectas's OTP-only model. Advisor output is not proof that the authorization findings above are absent. [Advisor remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Direct-client and partner readiness

The existing model supports platform, partner and client memberships, partner-admin management of managed clients, client-owned campaigns, assessment assignment, entitlements and confidentiality modes. The code already distinguishes campaign reading from management. Current client ownership, rather than a stale copied campaign partner field, determines campaign access after reassignment.

The branch closes the identified action-boundary and selected-workspace gaps. Independent operation still needs proof of the complete customer contract, especially membership invitation/activation, role changes, exhausted quotas, campaign closure, report release, customer-visible errors and account/data deletion.

For the first pilot, use invited participants and an administrator-reviewed participant list. Open enrollment accepts self-asserted identity; entering an email is not proof of control of that mailbox. Research observations remain unknown until a platform administrator records provenance evidence, but that does not by itself solve identity assurance for every customer workflow. Do not sell unrestricted public signup as identity-verified participation.

Partner access is membership-wide according to the existing model; it is not a per-consultant case-assignment system. Make that explicit when assigning partner memberships. Use a staging fixture with two partners and multiple clients to walk through normal creation, assignment, transfer/unassignment, report audiences, aggregate-only operation, selected workspaces and support sessions. Verify the intended roles can complete their tasks and that the configured visibility matches the customer agreement, without testing against live customer accounts.

Consultant email delivery now records acceptance after the provider accepts the send, uses an expiring claim, and is retried by the existing report-generation cron. It also supplies a stable provider idempotency key. This improves recovery after an interrupted instance; it does not promise mathematical exactly-once email delivery. Resend retains [idempotency keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Operational reconciliation remains necessary for prolonged outages and uncertain provider acceptance. Prefer authenticated report links over attached PDFs when later revocation matters.

## Participant flow and demographics

Implemented repairs:

- Each assessment is submitted before advancing to the next assessment. Review-enabled campaigns go to review at every assessment boundary; review-disabled campaigns submit at the final section boundary. Refreshed tokens are used for subsequent navigation.
- Review uses server completeness and shows timed sections that have ended, instead of requiring answers the server no longer permits the participant to supply.
- Completion requires durable completed state and completion of required assessments; an unstarted session no longer renders successful completion.
- Configured consent is checked before opening the runner and enforced on session/response writes by database triggers. Dedicated synthetic report previews are explicitly separate and never receive fabricated participant consent.
- Consent saves record the exact presented content and content version, including privacy/terms URLs. Stale content is rejected for renewed review.
- Demographic saves must be acknowledged before navigation. Returned/thrown failures stay on the form and permit retry. Existing answers and completion timestamps survive DTO mapping/revisits.
- The server validates configured enabled fields, required answers, option vocabulary, unique keys and length bounds. Unknown/disabled values are rejected. The presented form configuration is saved with answers; shown-but-unanswered optional fields are recorded distinctly from fields not shown.
- Research use is a separate optional checkbox, offered only where privacy information is configured. The action stores its wording, purpose/version, URL and timestamp. Declining does not prevent participation.
- Source defaults now explain identifiable collection, coaching pilot use and the distinction between pausing and withdrawal. The migration updates exact unchanged legacy default wording while preserving bespoke campaign text.

Launch configuration still matters. Consent and demographic pages are configurable and are not automatically enabled on every campaign by these changes. Review each launch campaign, enable the intended steps, supply accurate privacy/retention/contact information, and check custom wording. Do not interpret closing a browser as consent withdrawal. The report holding page correctly describes a report appearing there; it does not promise an automatic participant report email when no such automatic send exists.

Demographic fields can be included in cohort definitions, but the current vocabulary needs to match the intended population and be used consistently across campaigns. Job context, country/language, refusal choices and accessibility/accommodations should be specified in the sampling plan. Collect only the necessary fields. Demographics remain linked to identifiable participant records; this is not anonymous research collection.

## Five Brains scoring and scientific interpretation

The earlier production inventory identified the active `5Brains Capability Assessment` as 25 capabilities/factors with 150 six-anchor self-report items, 75 reverse-scored, unit item weights and no excluded-option items. Production dispatch is CTT/POMP (`pomp_factor`), not the general-purpose IRT/pipeline code.

For a 1–6 response, reverse scoring is `7 − response`; item POMP is `(effective response − 1) / 5 × 100`. Construct aggregation uses item weights, factors use their configured construct weights, and the composite averages factor scores. This is a rescaled self-report score, not a population percentile, job-success probability or independently observed capability rating. Earlier independent checks matched 175 synthetic stored factor scores to numerical precision; new fixtures cover unequal weights, reverse scoring and norm-transform identity. Neither result establishes validity.

The branch now preserves full precision before display rounding, removes missing-value-to-zero substitution, requires all 25 capabilities/five categories before building the custom report, records expected/attempted/scorable coverage and marks incomplete factor estimates provisional. Provisional values are withheld from the Five Brains report context. A different future missingness rule requires explicit review; the branch does not invent one.

The general-purpose construct pipeline previously derived Z/T/percentile values from a different score than its final weighted POMP. Its transform input now uses the final POMP while preserving raw totals. This was a dormant-path defect, not evidence that current production Five Brains percentiles were wrong: production has no empirical norm tables and the CTT scorer does not consume them.

Calibration now receives frozen administered membership/content versions, so everyone omitting the same item cannot manufacture a shorter complete form. Different frozen versions are not quietly pooled. Production reads admit only real, permitted, active, non-test observations. A heuristic alpha confidence interval is withheld until a reviewed estimator and assumptions are implemented. Fixed sample floors are operational rules, not proof of representative sampling or stable estimates.

The report describes Five Brains as a self-report development pilot and its brain names as a framework metaphor, not a neurological measurement. The existing 30–70 shading is retained and labelled illustrative. Band labels/cutoffs remain framework conventions; they do not establish measured effectiveness, population rank or significant growth. Coaching interpretation should avoid those inferences.

Available evidence does not establish the five-category factor structure, reliability/precision, measurement invariance, retest stability, sensitivity to change, response-process validity or predictive utility of this particular instrument. Established constructs or general research cannot confer a published validity coefficient on a newly assembled questionnaire. [ITC Test Use guidance](https://www.intestcom.org/files/guideline_test_use.pdf) connects interpretation to appropriate evidence and intended use. [McNeish's reliability review](https://pubmed.ncbi.nlm.nih.gov/28557467/) explains why alpha and its assumptions need scrutiny. The technical manual, exact item/key provenance and licensing rights also need an owner-supported evidence review.

A real programme should include cognitive interviews, content review, item-response/missingness studies, dimensionality analysis, appropriate reliability/uncertainty estimates, reverse-wording method effects, subgroup comparability and external evidence relevant to the intended coaching interpretation. Retest changes cannot be sold as statistically reliable improvement without measurement-error/change evidence. Hiring/selection would require a separate programme.

## Norm-group workflow now implemented

The new platform-only norm-study workspace allows an administrator to:

1. Define a reference population, Five Brains instrument, demographic filters, sampling plan and sample floor.
2. Review completed unknown-origin observations and record evidence of real provenance. Historical synthetic and preview observations cannot be promoted by this action.
3. Create an immutable **draft descriptive snapshot** from eligible real, non-internal, research-permitted, complete first administrations.
4. Inspect the saved draft count/sample size while preserving its cohort definition, form/scorer identity, hashed cohort manifest, distribution and exclusion/repeat policy.

Study preparation uses the first complete administration per normalized email, requires all 25 capability scores, rejects mixed frozen forms, computes the sample mean/SD and retains sorted empirical POMP values. Email deduplication is practical pilot identity handling, not a guaranteed person identity across multiple addresses. The stored distributions contain no participant names, emails or access tokens; access is limited to guarded platform-server operations.

Existing pre-audit observations are explicitly synthetic. New observations default to unknown. Preview sessions are separately marked preview/internal. Toggling an `includeInternal` control cannot admit synthetic data into an empirical study. Historical calibration artefacts must remain labelled synthetic even when retained for development/debugging.

Drafts are never published norms, never automatically applied by participant scoring and never silently create demographic percentile routing. Publishing reviewed norm versions and attaching them immutably to scores/report provenance is a later feature. Do not relabel a customer convenience sample “General Population.” A floor of 100 is an editable operational starting point; subgroup precision, tail estimates and intended interpretations require an approved sampling/analysis plan. Global n cannot stand in for the smallest demographic cell.

Before publication, require documented recruitment/population coverage, item/form/scorer compatibility, attrition and missingness, participant independence, relevant measurement/fairness evidence, uncertainty, smallest-cell privacy rules, expert approval, reproducible lookups and a monitoring/renorm policy. Customer-facing norms require reference population, version, n and collection window in the report. Demographic-specific norms are not automatically a fairness remedy.

## What Supabase Pro changes

Read-only project metadata identified Trajectas as healthy on PostgreSQL 17 in Singapore; its organization remains on Free. Pro starts at USD25/month and includes USD10 of compute credit, covering one Micro instance. It removes inactivity pausing and includes seven-day daily database backups, seven-day logs, 8 GB database disk, 100 GB storage, 250 GB egress and 100,000 monthly active users. Compute, add-ons and overages can add cost; Pro has no uptime SLA. Point-in-time recovery starts as an additional USD100/month service. [Current Supabase pricing](https://supabase.com/pricing).

The upgrade improves capacity and recovery resources. It does not repair authorization, configure mail delivery, change scoring, distinguish synthetic data or validate the instrument. Database backups do not include Storage file contents; report PDFs need separate storage protection or a tested rebuild strategy. [Backup scope](https://supabase.com/docs/guides/platform/backups).

Before inviting customers, verify custom SMTP for Supabase OTP/invites, sender-domain delivery and appropriate auth/email limits. Supabase's default mail service is restricted to team addresses and two messages/hour; a paid database plan does not automatically replace it. [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp), [auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). Trajectas's application email provider is a separate delivery path and needs its own configuration/verification. No plan purchase or customer delivery test was performed here.

## Required release gates

| Gate | Owner / evidence needed |
|---|---|
| Coordinated schema/application rollout | Explicit production approval; deploy the reviewed migration before application merge; recheck advisors and schema; retain deployment/rollback notes |
| Green repository CI | Security/dependency, quality, migration/integration and smoke checks on the final commits; do not merge a draft or bypass checks |
| Complete staged Five Brains administration | Full 150-item completion, all 25 scores, persisted composite, HTML/PDF consistency, resume/retry and report release |
| Direct-client operational walkthrough | Invitations/OTP, own workspace, assignment/quota, campaign, participants, consent/demographics, report, closure/revocation and support |
| Partner/client operational walkthrough | Intended memberships, multiple clients, reassignment/unassignment, entitlements, confidentiality/audiences and support context |
| Infrastructure and delivery | Pro upgrade, SMTP/application email, verified sender, live surface URLs, signing/cron configuration and observable retry jobs |
| Privacy and coaching contract | Accurate campaign text, contact/retention/deletion process, research permission and permitted report use; review bespoke overrides |
| Recovery rehearsal | Database and storage restore/rebuild, operational alerts, failure queue, support responsibilities and launch capacity expectations |

A successful release can then support a limited, monitored coaching pilot. Increase independent/partner operation after the normal staged workflows and initial support experience are satisfactory. Published empirical norms and high-stakes decisions remain separate gates.

## Validation record

- 274 unit/component/architecture files: **3,291 tests passed**, including a complete rerun after the dependency patch.
- Strict TypeScript and source/changed-test ESLint passed after the dependency patch.
- Final migration applied successfully to a schema-only disposable local database. Normal consented session creation and dedicated preview creation passed; fixture rows were rolled back. No shared application database reset and no production fixture insertion.
- Production builds passed with both webpack and the default Turbopack compiler after fixing runtime-specific instrumentation imports. The final patched default build compiled successfully using non-production placeholder database credentials.
- Sandboxed Turbopack attempts stalled; the same default build passed outside the sandbox. Bundle budgets passed. Final CI results must still be checked before deployment.
- Published production dependency audit after the Next.js patch: **zero high/critical**, **35 moderate** findings.
- Full live lifecycle, deployed multi-tenant behavior, SMTP/Resend delivery, PDF worker/browser rendering, production migration behavior, capacity and restore were not certified by these offline checks.

