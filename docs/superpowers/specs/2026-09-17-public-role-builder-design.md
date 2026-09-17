# A position description becomes a live assessment, with no account

Status: design agreed 2026-09-17, nothing built. Working name **Role Builder**,
route `/build` on the public host. Both are placeholders until the design pass.

## What we are building

A visitor on the public site pastes a position description, picks how much of
the role they want measured, watches the platform read the role and choose
capabilities, adjusts the selection if they want, and clicks *Create*. That
creates a real assessment and a real campaign, and emails them a link to take
it. When they finish, they get the report as a PDF attachment plus a link to
the report page.

It is a **single-taker demo**. The person who builds the assessment is the
person who takes it. That is deliberate: it removes the question of where a
stranger's candidates' results would live, and it makes the tail of the flow
the existing participant experience, unchanged.

Everything the flow creates lives in its own area, is invisible to partners and
clients, and is capped before any AI runs.

## The flow, screen by screen

1. **Explain.** One page on the public site: what it does, where the
   capabilities come from (the library), how the match is made, what you get.
   Convincing, not exhaustive. Designed in the site redesign pass, not here.

2. **Verify.** Email address; in closed mode also an invite code. We send a
   six-digit code. They enter it. Nothing costs money before this step.

3. **Brief.** Job title, the position description (paste or upload PDF/DOCX/TXT),
   and the size:

   | Tier | Capabilities | Items | Candidate time |
   |---|---|---|---|
   | Essentials | 4 | 24 | ~5 min |
   | Core | 6 | 36 | ~7 min |
   | Full picture | 8 | 48 | ~10 min |

   Items per capability are **fixed at 6** in this flow, so "more" means
   strictly "more measured" and the time is honest (12 s/item, the platform's
   canonical estimate in `src/lib/assessments/duration.ts`). The candidate time
   is a secondary figure; the tier copy is about how much you get to interpret,
   because the whole thing is ten minutes even at the top.

   The internal Architect's decision chips (Hiring / Promotion / ...) are not
   shown. The public flow fixes `outcomeIntent` to hiring/selection.

4. **Working.** A progress screen that narrates the real work as each stage
   returns, not a spinner:
   - *Reading the role* → shows the extracted title, level, function.
   - *Weighing N capabilities against it* → shows the count considered.
   - *Chose K* → hands over to the result.

   Mechanically this is three sequential server actions called from the
   client (extract → rank → summarise), each updating the screen with its
   actual output. No streaming infrastructure. The summarise call is
   non-blocking, as it is in the Architect today.

5. **Result.** The chosen capabilities, clearly, each openable for its
   definition and behavioural indicators (`factors.definition`,
   `indicators_low/mid/high`, category). One tier is marked **Recommended for
   this role** using the matcher's `recommendedCount.optimal`. Below: close
   alternatives from the ranking that can be swapped in or out. Every change
   updates the live readout (`7 capabilities · 42 items · ~8 min`). That
   interaction is the value story: the trade-off is felt, not explained.

6. **Create.** One click. We create the assessment, the campaign, the
   participant, and send the standard invite email to the verified address.
   The screen says *Sent to jason@…* with nothing further to fill in.

7. **Take.** The existing `/assess/{token}` runner, unchanged.

8. **Report.** When the PDF is ready, an email with the PDF attached and a link
   to `/assess/{token}/report`, which already exists and already expires.

## Decisions already made

- **Fixed 6 items per capability.** The library's `item_selection_rules` bands
  give *fewer* items per capability as the count rises, so under the bands
  "Full picture" would be broader but shallower. The public flow bypasses the
  bands. (Jason, 2026-09-17.)
- **No cognitive items.** Public campaigns expose real bank items to anyone
  with the link; cognitive items are the ones whose exposure matters. Exclude
  via `response_formats.type != 'cognitive'` at item counting and item picking.
- **Email verification before any AI call**, with our own six-digit code, not
  Supabase `signInWithOtp`. An auth user with no membership hits the app's
  unauthorized paths and pollutes `auth.users`/`profiles`; the demo should not
  create platform identities.
- **Closed and open modes behind one flag.** `PUBLIC_BUILDS_MODE=closed|open|off`.
  Closed additionally requires an invite code (`PUBLIC_BUILDS_INVITE_CODE`,
  rotatable). Launch closed; flip to open later. `off` is the kill switch.
- **PDF attached and linked.** Both.
- **Single taker, capped at one participant per campaign.** Multi-taker,
  payments, and workspace conversion are later products, not this one.

## Data model

### A system client for public builds

A fixed-UUID client, `PUBLIC_BUILDS_CLIENT_ID`, created by migration exactly
as the Sample Data client is (`20260418100000_preview_sample_client.sql`,
constant in `src/lib/sample-data/seed-preview.ts:13`). Every assessment and
campaign the flow creates is owned by it.

This does most of the segregation for free: the partner library query
(`getPartnerAssessmentLibrary`, `src/app/actions/assessments.ts:449`) keeps
only `client_id is null` rows, so these never appear in any partner's library,
and campaigns under a client no partner owns are visible to no partner or
client. The platform-admin `/assessments` and `/campaigns` lists need one
filter each to hide the client, and the new admin section is where they are
seen instead.

Considered and rejected for now: an `assessments.origin` column. The client id
is a sufficient discriminator and adds no schema to the hot tables. Revisit if a
second public product needs the same separation.

### `public_build_codes`

One row per code request.

| column | notes |
|---|---|
| `id` | uuid |
| `email` | lowercased |
| `code_hash` | sha256 of the six digits + server pepper |
| `expires_at` | 10 minutes |
| `attempts` | int, max 5 |
| `consumed_at` | set on success |
| `ip_hash` | sha256 of IP + pepper |
| `created_at` | |

Verification issues a signed, httpOnly cookie `tf_public_build`
(`{ email, verifiedAt, exp: +24h }`) using the same signing helper as
`tf_active_context`. Every later action reads the cookie; none takes the email
from the client.

### `public_builds`

One row per run, from the first AI call to the report email.

| column | notes |
|---|---|
| `id` | uuid |
| `email` | from the cookie |
| `ip_hash` | |
| `role_title` | as typed |
| `pd_hash` | sha256 of the normalised PD text, for the cache |
| `pd_text` | raw text, nulled after 30 days (PDs can carry client detail) |
| `brief` | jsonb, the extracted `Brief` |
| `ranking` | jsonb, the full `runMatching` output |
| `tier` | `essentials \| core \| full` |
| `picks` | jsonb, final factor ids after the user's adjustments |
| `usage` | jsonb `{ inputTokens, outputTokens, reasoningTokens }` per stage |
| `status` | `ranked \| creating \| created \| started \| completed \| report_sent \| failed` — `creating` is the atomic claim `createBuild` takes before writing anything real |
| `assessment_id`, `campaign_id`, `participant_id` | set at create |
| `error` | text |
| `created_at`, `created_assessment_at`, `started_at`, `completed_at`, `report_sent_at` | |

RLS: platform admin `SELECT` only; all writes on the service role. Both tables
are platform-administration data, so the admin screen's reads go on the
vetted allowlist of `tests/architecture/tenant-scope-predicates.test.ts`.

### What each created row looks like

- **assessment**: `client_id = PUBLIC_BUILDS_CLIENT_ID`, `status = 'active'`,
  `creation_mode = 'ai_generated'`, `item_selection_strategy = 'fixed'`,
  6 items per factor, sections built by `buildDefaultSectionDrafts` as the
  Architect does. The preview seed (`seedAssessmentPreview`) is **not** run.
- **campaign**: same client, `kind = 'self'`, `status = 'active'`,
  `slug = build-{shortid}`, `closes_at = now + 7 days`,
  `confidentiality_mode = 'standard'`, one `campaign_assessments` link.
- **experience template**: a campaign-owned `experience_templates` row with
  `flow_config.report.enabled = true`. The platform default has the report page
  **off** (`src/lib/experience/defaults.ts:112`), so without this the
  participant is redirected to `/complete` and never sees a report.
- **participant**: `campaign_participants` with the verified email and a
  generated `access_token`; invited via `sendParticipantInviteEmail`.
- **report template**: whatever `report_templates.is_default` resolves to.
  Phase 0 confirms one exists and renders for a `self` campaign.

## Server side

All new actions live in `src/app/actions/public-builds.ts`, queries in
`src/lib/dal/public-builds.ts`. None calls `requireAdminScope`; the gate is the
signed cookie plus the limits below. Because they mutate through the admin
client without a scope gate, they go on the `ALLOWLIST` of
`tests/architecture/admin-actions-authz.test.ts` as self-service/token
exceptions, with this document as the justification.

| action | does | gate |
|---|---|---|
| `requestCode(email, inviteCode?)` | mode check, invite code in closed mode, rate limits, BotID, insert code row, send `public_build_code` email | per-IP + per-email limits, BotID |
| `verifyCode(email, code)` | hash compare, attempts, expiry; set cookie | attempts ≤ 5 |
| `startBuild(roleTitle, pdText \| file, tier)` | cookie; global cap; per-email daily cap; `pd_hash` cache hit returns the cached ranking with no AI call; else `extractBrief` → row `brief` | cookie, caps |
| `rankBuild(buildId)` | `runArchitectMatch` restricted to non-cognitive items and fixed 6/factor; stores `ranking`, `usage`, `status = ranked` | cookie owns row |
| `summariseBuild(buildId)` | non-blocking coverage sentence | cookie owns row |
| `createBuild(buildId, picks)` | validates picks ⊆ ranking, count ≤ 8; creates assessment, campaign, experience row, participant; sends invite; `status = created` | cookie owns row, one live build per email |

The Architect's internals are reused, not copied: `extractBrief`,
`runArchitectMatch` and `summariseArchitectSelection` get an options
parameter (`{ excludeCognitive, itemsPerFactor }`) and lose their inline
`requireAdminScope()` in favour of the existing admin wrappers keeping it. The
provider already returns token usage
(`src/lib/ai/providers/openrouter.ts:97`); `runBriefExtraction` and
`runMatching` are extended to surface it so `usage` can be recorded.

### Report email

`generateAndStoreReportPdf` (`src/lib/reports/pdf.ts:172`) is the point where
a PDF exists. After store, look up `public_builds` by `participant_id`; if
found and `report_sent_at` is null, send `public_build_report` with the PDF as
a base64 attachment and the report-page link, then stamp. `sendEmail`
(`src/lib/email/send.ts:22`) does not expose attachments although the Resend
provider supports them (`provider.ts:16`); it gains an `attachments` field.

Status transitions `started` and `completed` are stamped from the runner's
existing session hooks by participant id, cheaply, so the admin funnel is
real.

## Protections

Cost happens at `startBuild`/`rankBuild`, after verification, so the
verified email is the unit of accounting.

| layer | rule | where |
|---|---|---|
| Mode | `off` refuses everything; `closed` requires the invite code | `requestCode` |
| Bots | BotID on `requestCode` (`protect: []` today; add the route and call `checkBotId`) | instrumentation + action |
| Inbox bombing | `requestCode`: 5/hour per IP, 3/hour per email (same pattern as `otp-email:` in `src/app/actions/auth.ts:157`) | `checkKeyedRateLimit` |
| Spend per person | 3 builds per email per day; 1 live (uncompleted, unexpired) build per email | `startBuild`, `createBuild` |
| Spend overall | `PUBLIC_BUILDS_DAILY_CAP` builds per UTC day, counted from `public_builds`; over cap the page says so and offers the contact address | `startBuild` |
| Repeats | `pd_hash` cache: same PD, no AI call | `startBuild` |
| Input | 20 000 characters, 5 MB upload (internal is 40k/10 MB) | `startBuild` |
| Exposure | no cognitive items; ≤ 8 capabilities × 6 items | `rankBuild`, `createBuild` |
| Time-box | invite link and campaign close at 7 days; report page keeps its existing expiry | `createBuild` |
| Retention | `pd_text` nulled after 30 days by the existing cron sweep pattern | cron |

The numbers are starting points. Phase 0 measures the real cost of one run
before they are set in env.

## Admin section

`/public-builds` in the dashboard, platform admin only. A table of runs
(newest first) with email, role title, tier, status, minutes since each
transition, and token spend; a header strip with today's builds against the
cap, the current mode, and today's spend; row click opens the brief, the
ranking, the picks, and links to the created assessment and campaign. It is
the funnel, the cost meter and the lead list in one screen.

## Public site

`/build` and `/build/*` are added to the public-host allowlist in
`src/proxy.ts` (the same list that is currently sending the SEO pages to the
admin host; that fix is in flight separately). The page is a client component
over the actions above. Its visual design is produced in the site redesign
pass together with the new home page, so the tool and the site are one
system. Server actions are already rate-limited at 60/min per IP by the proxy.

## Reused, changed, new

| | |
|---|---|
| **Reused unchanged** | runner, scoring, snapshot generation, PDF pipeline, `sendParticipantInviteEmail`, report page + expiry, `checkKeyedRateLimit`, signed-cookie helper, `buildDefaultSectionDrafts`, `createAssessment`, `createCampaign` |
| **Changed** | Architect internals gain options + usage; `sendEmail` gains attachments; BotID `protect` list; proxy allowlist; two admin list filters |
| **New** | migration (client row, two tables, RLS), `public-builds` DAL + actions, two email types (`public_build_code`, `public_build_report`), `/build` page, `/public-builds` admin page, report-email hook, retention sweep |

## Out of scope

Payments, more than one taker, results in a workspace, CRM sync, converting a
build into a client's assessment, and the CV (candidate-side) variant. Each is
a product decision on top of this, and this is designed so none of them needs
a rewrite: the build row already records everything a conversion would need.

## Build order

0. **Measure** (half a day). Time and cost one Architect run end to end with
   usage captured; confirm a `self` campaign with the report page enabled
   produces a snapshot and a PDF locally; confirm a default report template
   exists in production.
1. **Back end** (one PR, possibly two). Migration; DAL; actions; protections;
   email types; Architect options; usage capture; integration tests on local
   Supabase for the cache, the caps, the cookie, and that a created build is
   invisible to a partner-scope library read.
2. **Admin section** (one PR).
3. **Report email** (one PR). Attachment support, the PDF-ready hook, the
   `started`/`completed` stamps.
4. **Public UI** (after the design pass; one PR). `/build`, proxy allowlist,
   BotID.
5. **Launch closed.** Hand out the invite code. Flip to open when the numbers
   look right.

The site redesign runs as its own track and is not gated on any of this,
except that the tool's screens are designed in the same pass.

## Open questions

- **Name and route.** "Role Builder" / `/build` are placeholders.
- **Which report template** the demo should use if more than one default is
  plausible; and whether the demo report should carry the standard branding or
  a demo variant.
- **Retention of `pd_text`**: 30 days is a guess. Shorter is safer; longer is
  more useful for support.
- **Sender.** The invite and report emails come from `EMAIL_FROM` with the
  platform brand name today; confirm that is the address you want strangers
  replying to.
