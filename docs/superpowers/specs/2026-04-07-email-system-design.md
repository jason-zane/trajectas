# Email System Design

**Date:** 2026-04-07
**Status:** Draft

## Problem

Trajectas has two disconnected email systems: Supabase sends generic-looking auth emails (magic links), and Resend sends one custom React Email template (assessment invitations). There is no unified design language, no staff-editable content, and no way to manage email templates without code deployments.

## Goals

- Unify all emails through a single pipeline with consistent branding
- Give staff a drag-and-drop editor to manage email content without code changes
- Support the existing brand cascade (campaign → client → partner → platform)
- Intercept Supabase auth emails so they go through the same system
- Ship with polished default templates for all email types

## Non-Goals

- Marketing/bulk email campaigns (Trajectas emails are transactional)
- Email analytics (open rates, click tracking) — can be added later
- Building a custom editor from scratch — using Maily.to
- Template versioning / rollback — future enhancement

## Architecture

Four layers:

### 1. Email Template Registry

A `email_templates` table stores all template content:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `type` | text | Email type enum |
| `scope_type` | text | `platform`, `partner`, or `client` |
| `scope_id` | uuid (nullable) | Null for platform, partner/client id for overrides |
| `subject` | text | Subject line with merge variable support |
| `preview_text` | text (nullable) | Email preheader — the snippet shown after the subject in inbox previews |
| `editor_json` | jsonb | Maily.to editor state (what staff edit) |
| `html_cache` | text | Rendered HTML, regenerated on save. This is a cache — the source of truth is `editor_json`. Re-rendered at send time if brand frame has changed. |
| `is_active` | boolean | Whether this template is in use |
| `created_at` | timestamptz | Row creation time (server default) |
| `updated_at` | timestamptz | Last modified |
| `updated_by` | uuid | FK to profiles |

**Unique constraint:** `(type, scope_type, scope_id)` — one template per type per scope.

**Email types (enum):**

- `magic_link` — sign-in link
- `staff_invite` — invited to join the platform as staff
- `assessment_invite` — invited to complete an assessment
- `assessment_reminder` — nudge for incomplete assessments
- `report_ready` — results are available
- `welcome` — after first sign-in
- `admin_notification` — internal alerts for admins

**Template content scope vs. brand scope:** Template content (subject, body blocks) is scoped to platform / partner / client only — templates do not vary per campaign. However, the brand frame (logo, colors, footer) uses the full cascade including campaign via `getEffectiveBrand()`. This means the same template content can render with different branding depending on the campaign context.

**Template cascade resolution:** When sending, look for a matching template at client scope → partner scope → platform scope. Platform templates are seeded and always exist.

**Merge variables** are defined per email type:

- `magic_link`: `{{signInUrl}}`, `{{brandName}}`
- `staff_invite`: `{{inviteeName}}`, `{{brandName}}`, `{{acceptUrl}}`
- `assessment_invite`: `{{participantFirstName}}`, `{{campaignTitle}}`, `{{campaignDescription}}`, `{{assessmentUrl}}`, `{{brandName}}`
- `assessment_reminder`: `{{participantFirstName}}`, `{{campaignTitle}}`, `{{assessmentUrl}}`, `{{brandName}}`, `{{daysRemaining}}`
- `report_ready`: `{{recipientName}}`, `{{campaignTitle}}`, `{{reportUrl}}`, `{{brandName}}`
- `welcome`: `{{userName}}`, `{{brandName}}`, `{{loginUrl}}`
- `admin_notification`: `{{subject}}`, `{{message}}`, `{{actionUrl}}`, `{{actionLabel}}`

**Sample data** for preview and test sends is defined per email type as a `SAMPLE_VARIABLES` constant (e.g., `{ participantFirstName: "Alex", campaignTitle: "Leadership Assessment 2026", ... }`).

### 2. Brand Cascade

Emails use the existing brand resolution system (`getEffectiveBrand()`). The brand supplies:

- Logo URL
- Primary color
- Email-specific styles (text color, highlight color, footer text color) from `emailStyles` in brand config

The brand frame (header with logo, footer with "Powered by Trajectas") is not part of the editable template content — it is injected at render time based on the resolved brand. Staff can rearrange and edit body content but the brand frame is locked.

**Brand frame rendering:** The brand frame is a React component (`EmailBrandFrame`) that wraps the Maily-rendered HTML body. It renders:
- Header section: brand logo (or brand name fallback), horizontal rule
- Body: the Maily-rendered HTML inserted as a child section (sanitized via DOMPurify before injection to prevent any XSS from malformed editor JSON)
- Footer: "Powered by Trajectas" with brand footer text color

This component is rendered server-side via `@react-email/components` `render()` to produce the final HTML + plain text for delivery. This keeps the frame maintainable as a React component while cleanly wrapping Maily's output.

**From address:** The sender name is derived from the resolved brand name (e.g., `"Acme Corp" <noreply@mail.trajectas.com>`). The email domain remains `mail.trajectas.com` regardless of brand — only the display name changes.

### 3. Email Editor UI

A new admin section at **Settings → Email Templates**.

**Permissions:** Only platform admins can edit platform-scoped templates. Partner admins can create/edit partner-scoped overrides for their own partner. Client admins can create/edit client-scoped overrides for their own client. This follows the existing permission model for brand editing.

**List view:**
- All email types grouped by category:
  - **Authentication:** magic link, welcome
  - **Campaigns:** assessment invite, assessment reminder, report ready
  - **Platform:** staff invite, admin notification
- Each row shows: email type name, status (default / customized), last edited
- Scope selector to switch between platform / partner / client level templates

**Edit view:**
- Subject line field at the top
- Preview text (preheader) field
- Maily.to block editor for body content
- Sidebar showing available merge variables for that email type (click to insert)
- Live preview panel showing rendered email with sample data
- Brand context selector for creating partner/client overrides
- "Send Test Email" button — sends to the logged-in user's email
- Save renders editor_json to html_cache and persists both

**Editor constraints:**
- Color palette locked to the active brand's colors
- Brand frame (header/footer) shown in preview but not editable
- Available blocks: text, heading, image, button, spacer, columns, divider (verify against Maily.to's supported block types during implementation — hide any unsupported blocks)

### 4. Unified Send Pipeline

All emails flow through a single path:

```
sendEmail(type, context)
  → resolve template (cascade: client → partner → platform)
  → resolve brand (existing getEffectiveBrand(), including campaign scope)
  → merge variables into subject, preview_text, and editor JSON
  → render Maily editor JSON to body HTML via @maily-to/render
  → sanitize rendered HTML (DOMPurify)
  → wrap body in EmailBrandFrame React component
  → render frame to final HTML + plain text via @react-email/components render()
  → send via Resend (from name = brand name)
```

**Function signature:**

```typescript
async function sendEmail(params: {
  type: EmailType
  to: string
  variables: Record<string, string>
  scopeCampaignId?: string
  scopePartnerId?: string
  scopeClientId?: string
  replyTo?: string
}): Promise<void>
```

**Error handling:**
- If Maily render fails (malformed editor JSON or missing merge variable), fall back to the platform default template for that email type
- If the platform default also fails, send a minimal plain-text fallback with the merge variables inlined
- All failures are logged with the template id and error details

### Supabase Auth Email Integration

Supabase provides a [`send_email` auth hook](https://supabase.com/docs/guides/auth/auth-hooks#hook-send-email). When enabled, Supabase stops sending its own emails and instead calls your hook with the recipient, email type, and token/URL data.

**Implementation: Next.js API route** at `/api/auth/send-email`. Not an Edge Function — the pipeline needs access to the same codebase, dependencies, and database client.

The hook is registered in the **Supabase dashboard → Authentication → Hooks**, pointing to the Next.js API route URL.

**Webhook authentication:** The route validates incoming requests using the Supabase webhook secret (configured in the dashboard and stored as env var `SUPABASE_AUTH_HOOK_SECRET`). Requests without a valid signature are rejected with 401.

**Timeout consideration:** Supabase auth hooks require a response within 5 seconds. The pipeline (template lookup → brand resolution → render → Resend API call) should complete well within this under normal conditions. Mitigation: platform-level templates are cached in-memory after first load; Resend's API typically responds in <1s.

**Supabase email type mapping:**

| Supabase type | Our type | Notes |
|---------------|----------|-------|
| `magiclink` | `magic_link` | Primary login flow |
| `signup` | `welcome` | If email confirmation is enabled |
| `invite` | `staff_invite` | Supabase-level invites (if used) |
| `recovery` | — | Not currently used; log warning and skip |
| `email_change` | — | Not currently used; log warning and skip |
| `reauthentication` | — | Not currently used; log warning and skip |

Unmapped types are logged as warnings. The hook returns an error so Supabase falls back to its own default email for those types.

**Hook payload provides:** `user`, `email_data.token`, `email_data.token_hash`, `email_data.redirect_to`, `email_data.email_action_type`. The route constructs the sign-in URL from these and passes it as `{{signInUrl}}` to the pipeline.

## Seeded Default Templates

The system ships with platform-scoped defaults for every email type. These are stored as Maily.to editor JSON so staff can immediately open and customize them.

| Type | Subject | Body Summary |
|------|---------|-------------|
| `magic_link` | "Your sign-in link for {{brandName}}" | Brief greeting, branded "Sign In" button, expiry note |
| `staff_invite` | "You've been invited to join {{brandName}}" | Welcome message, role context, "Accept Invitation" button |
| `assessment_invite` | "{{campaignTitle}} — You're invited" | Participant greeting, campaign description, "Start Assessment" button |
| `assessment_reminder` | "Reminder: Complete your assessment" | Friendly nudge, days remaining, "Continue Assessment" button |
| `report_ready` | "Your results are available" | Campaign context, "View Report" button |
| `welcome` | "Welcome to {{brandName}}" | Onboarding message, quick-start guidance, "Get Started" button |
| `admin_notification` | "{{subject}}" | Dynamic message content, optional action button |

All defaults use a rich branded layout: header with logo, clear typography hierarchy, prominent CTA button, and "Powered by Trajectas" footer.

## Database

**RLS policies:** The `email_templates` table is accessed via the admin client (service role) in the send pipeline. For the editor UI, RLS policies enforce:
- Platform admins: read/write all templates
- Partner admins: read/write templates where `scope_type = 'partner'` and `scope_id` matches their partner id; read-only access to platform defaults (for reference)
- Client admins: read/write templates where `scope_type = 'client'` and `scope_id` matches their client id; read-only access to platform defaults

## Migration Path

1. Build the template registry table, RLS policies, and seed platform defaults
2. Build the unified send pipeline with brand frame rendering
3. Migrate the existing assessment invite to use the new pipeline (retire the React Email template)
4. Build the admin email editor UI with Maily.to
5. Create the Next.js API route for the Supabase send_email hook
6. Register the hook in Supabase dashboard and retire Supabase's built-in email templates

## Dependencies

- **Maily.to** — `@maily-to/core` (editor) + `@maily-to/render` (JSON → HTML) — open source (MIT), block-based email editor built on Tiptap
- **Resend** — existing email delivery provider
- **@react-email/components** — existing dependency, used for brand frame rendering + plain text generation
- **DOMPurify** (or `isomorphic-dompurify`) — HTML sanitization for rendered Maily output
- **Supabase Auth Hooks** — for intercepting auth emails (configured in Supabase dashboard)
- **Existing brand system** — `getEffectiveBrand()`, `EmailStyleColors`, brand cascade logic
