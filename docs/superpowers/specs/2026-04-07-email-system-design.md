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
| `editor_json` | jsonb | Maily.to editor state (what staff edit) |
| `html` | text | Rendered HTML, regenerated on save |
| `is_active` | boolean | Whether this template is in use |
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

**Template cascade resolution:** When sending, look for a matching template at client scope → partner scope → platform scope. Platform templates are seeded and always exist.

**Merge variables** are defined per email type:

- `magic_link`: `{{signInUrl}}`, `{{brandName}}`
- `staff_invite`: `{{inviteeName}}`, `{{brandName}}`, `{{acceptUrl}}`
- `assessment_invite`: `{{participantFirstName}}`, `{{campaignTitle}}`, `{{campaignDescription}}`, `{{assessmentUrl}}`, `{{brandName}}`
- `assessment_reminder`: `{{participantFirstName}}`, `{{campaignTitle}}`, `{{assessmentUrl}}`, `{{brandName}}`, `{{daysRemaining}}`
- `report_ready`: `{{recipientName}}`, `{{campaignTitle}}`, `{{reportUrl}}`, `{{brandName}}`
- `welcome`: `{{userName}}`, `{{brandName}}`, `{{loginUrl}}`
- `admin_notification`: `{{subject}}`, `{{message}}`, `{{actionUrl}}`, `{{actionLabel}}`

### 2. Brand Cascade

Emails use the existing brand resolution system (`getEffectiveBrand()`). The brand supplies:

- Logo URL
- Primary color
- Email-specific styles (text color, highlight color, footer text color) from `emailStyles` in brand config

The brand frame (header with logo, footer with "Powered by Trajectas") is not part of the editable template content — it is injected at render time based on the resolved brand. Staff can rearrange and edit body content but the brand frame is locked.

### 3. Email Editor UI

A new admin section at **Settings → Email Templates**.

**List view:**
- All email types grouped by category:
  - **Authentication:** magic link, welcome
  - **Campaigns:** assessment invite, assessment reminder, report ready
  - **Platform:** staff invite, admin notification
- Each row shows: email type name, status (default / customized), last edited
- Scope selector to switch between platform / partner / client level templates

**Edit view:**
- Subject line field at the top
- Maily.to block editor for body content
- Sidebar showing available merge variables for that email type (click to insert)
- Live preview panel showing rendered email with sample data
- Brand context selector for creating partner/client overrides
- "Send Test Email" button — sends to the logged-in user's email
- Save renders editor_json to HTML and persists both

**Editor constraints:**
- Color palette locked to the active brand's colors
- Brand frame (header/footer) shown in preview but not editable
- Available blocks: text, heading, image, button, spacer, columns, divider

### 4. Unified Send Pipeline

All emails flow through a single path:

```
sendEmail(type, context)
  → resolve template (cascade: client → partner → platform)
  → resolve brand (existing getEffectiveBrand())
  → merge variables into subject and editor JSON
  → wrap body in brand frame (header with logo, footer with "Powered by Trajectas")
  → render to final HTML
  → send via Resend
```

**Function signature:**

```typescript
async function sendEmail(params: {
  type: EmailType
  to: string
  variables: Record<string, string>
  scopePartnerId?: string
  scopeClientId?: string
  replyTo?: string
}): Promise<void>
```

### Supabase Auth Email Integration

Supabase provides a [`send_email` auth hook](https://supabase.com/docs/guides/auth/auth-hooks#hook-send-email). When enabled, Supabase stops sending its own emails and instead calls your hook with the recipient, email type, and token/URL data.

Implementation:

1. Create a Supabase Edge Function (or Next.js API route exposed as a webhook) that receives the hook payload
2. Map Supabase email types to our template types (e.g., `magiclink` → `magic_link`)
3. Call the unified `sendEmail()` pipeline with the appropriate type and variables
4. Supabase's generic emails are fully replaced

This means every email — auth and transactional — uses the same templates, the same brand, and the same Resend delivery.

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

## Migration Path

1. Build the template registry and seed defaults
2. Build the unified send pipeline
3. Migrate the existing assessment invite to use the new pipeline (retire the React Email template)
4. Build the admin email editor UI
5. Enable the Supabase send_email hook to intercept auth emails
6. Retire Supabase's built-in email templates entirely

## Dependencies

- **Maily.to** — open source (MIT), block-based email editor built on Tiptap
- **Resend** — existing email delivery provider
- **Supabase Auth Hooks** — for intercepting auth emails
- **Existing brand system** — `getEffectiveBrand()`, `EmailStyleColors`, brand cascade logic
