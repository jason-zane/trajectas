# Email System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all emails (auth + transactional) through a single pipeline with database-managed templates, brand cascade, a Maily.to drag-and-drop editor for staff, and Supabase auth hook integration.

**Architecture:** Email templates are stored as Maily.to editor JSON in a `email_templates` table with scope cascade (client -> partner -> platform). A unified `sendEmail()` function resolves the template and brand, renders via Maily.to + a React Email brand frame wrapper, and delivers via Resend. Supabase auth emails are intercepted via a `send_email` hook that routes through the same pipeline.

**Tech Stack:** Maily.to (`@maily-to/core` + `@maily-to/render`), Resend, `@react-email/components`, Supabase Auth Hooks, Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-04-07-email-system-design.md`

---

## File Structure

```
supabase/migrations/
  00077_email_templates.sql                    -- CREATE table, enum, RLS, seed defaults

src/lib/email/
  types.ts                                     -- EmailType enum, merge variable definitions, sample data
  template-registry.ts                         -- resolveTemplate() cascade lookup
  brand-frame.tsx                              -- EmailBrandFrame React component (header/footer wrapper)
  render.ts                                    -- renderEmailHtml() -- Maily JSON -> brand frame -> final HTML + text
  send.ts                                      -- unified sendEmail() entry point (replaces provider.ts usage)
  default-templates.ts                         -- rich Maily editor JSON for each email type
  provider.ts                                  -- MODIFY: add html/text support alongside react

src/lib/validations/
  email-template.ts                            -- Zod schemas for template CRUD

src/app/actions/
  email-templates.ts                           -- server actions: list, get, upsert, send test email
  campaigns.ts                                 -- MODIFY: switch sendParticipantInviteEmail to new pipeline

src/lib/integrations/
  service.ts                                   -- MODIFY: switch sendIntegrationInviteEmail to new pipeline

src/app/(dashboard)/settings/email-templates/
  page.tsx                                     -- list view (grouped by category)
  loading.tsx                                  -- shimmer skeleton
  [type]/page.tsx                              -- edit view with Maily editor
  [type]/loading.tsx                           -- shimmer skeleton
  [type]/email-template-editor.tsx             -- client component: Maily editor + subject + preview

src/app/api/auth/send-email/
  route.ts                                     -- Supabase send_email hook endpoint

tests/unit/
  email-types.test.ts                          -- type definitions and sample data
  template-registry.test.ts                    -- cascade resolution logic
  email-render.test.ts                         -- rendering pipeline
  email-send.test.ts                           -- unified send function

tests/integration/
  email-template-actions.test.ts               -- server action tests
```

---

### Task 1: Database -- email_templates table and seed data

**Files:**
- Create: `supabase/migrations/00077_email_templates.sql`

- [ ] **Step 1: Write the migration SQL**

Create the `email_template_type` and `email_template_scope` enums, the `email_templates` table with all columns (id, type, scope_type, scope_id, subject, preview_text, editor_json, html_cache, is_active, created_at, updated_at, updated_by, deleted_at), a scope_id check constraint (platform must be null, others must be non-null), a unique index on (type, scope_type, COALESCE(scope_id)) WHERE deleted_at IS NULL, the set_updated_at trigger, RLS policies (platform admins full access, partner admins manage own + read platform, client admins manage own + read platform, service_role full access), and seed 7 platform default rows with minimal editor_json.

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies cleanly, `email_templates` table exists with 7 seeded rows.

- [ ] **Step 3: Verify seed data**

Run query to confirm 7 rows in email_templates with scope_type = 'platform'.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00077_email_templates.sql
git commit -m "feat(email): add email_templates table with RLS and platform defaults"
```

---

### Task 2: Email type definitions and merge variable registry

**Files:**
- Create: `src/lib/email/types.ts`
- Create: `tests/unit/email-types.test.ts`

- [ ] **Step 1: Write the test**

Test that: all 7 email types are defined, every type has merge variables, every type has sample variables covering all its merge variables, and every type belongs to a category.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/email-types.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/email/types.ts` with:
- `EMAIL_TYPES` const array: magic_link, staff_invite, assessment_invite, assessment_reminder, report_ready, welcome, admin_notification
- `EmailType` type derived from the array
- `EmailTemplateScope` type: platform | partner | client
- `EMAIL_TYPE_CATEGORIES` record grouping types into Authentication, Campaigns, Platform
- `EMAIL_TYPE_LABELS` record with human-readable names
- `MERGE_VARIABLES` record mapping each type to its variable names
- `SAMPLE_VARIABLES` record with sample values for preview/testing

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/email-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/types.ts tests/unit/email-types.test.ts
git commit -m "feat(email): add email type definitions, merge variables, and sample data"
```

---

### Task 3: Template cascade resolution

**Files:**
- Create: `src/lib/email/template-registry.ts`
- Create: `tests/unit/template-registry.test.ts`

- [ ] **Step 1: Write the test**

Mock `createAdminClient` from `@/lib/supabase/admin` using the `vi.hoisted()` pattern (all mocks in this project must use this pattern). Test:
- Returns platform default when no scope ids provided
- Returns client template when client scope matches
- Falls back through cascade: client miss -> partner miss -> platform hit
- Returns null when no template found at any level

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/template-registry.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/email/template-registry.ts` with:
- `EmailTemplateRecord` interface matching the DB columns
- `findTemplate(type, scopeType, scopeId)` -- single DB lookup via admin client
- `resolveTemplate(type, { clientId?, partnerId? })` -- cascade: client -> partner -> platform

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/template-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/template-registry.ts tests/unit/template-registry.test.ts
git commit -m "feat(email): add template cascade resolution (client -> partner -> platform)"
```

---

### Task 4: Brand frame React component

**Files:**
- Create: `src/lib/email/brand-frame.tsx`

- [ ] **Step 1: Write the brand frame component**

Create a React Email component (`EmailBrandFrame`) matching the structure of the existing `InviteEmail` in `src/lib/email/templates/invite.tsx`. Props: brandName, brandLogoUrl, primaryColor, textColor, footerTextColor, previewText, bodyHtml. Structure:
- Html > Head > Preview (if previewText) > Body (grey bg, system font) > Container (560px) > Section (white card)
- Header: brand logo Img (or brand name Text fallback) + Hr
- Body: Section containing the Maily-rendered HTML (sanitized via DOMPurify before insertion to prevent XSS)
- Footer: Hr + "Powered by Trajectas" text (or just "Trajectas" if brandName is Trajectas)

Follow the exact styling from the existing invite template (font sizes, colors, spacing, border radius).

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/brand-frame.tsx
git commit -m "feat(email): add EmailBrandFrame React component for header/footer wrapper"
```

---

### Task 5: Rendering pipeline -- Maily JSON to final HTML

**Files:**
- Create: `src/lib/email/render.ts`
- Create: `tests/unit/email-render.test.ts`

- [ ] **Step 1: Install dependencies**

Run: `npm install @maily-to/render isomorphic-dompurify`
Expected: Packages installed successfully. `isomorphic-dompurify` is used to sanitize Maily-rendered HTML before injection into the brand frame.

- [ ] **Step 2: Write the test**

Mock `@maily-to/render` (returns HTML string) and `@react-email/components` render (returns {html, text}). Test:
- Returns html and text from editor JSON
- Substitutes merge variables in rendered body (e.g., `{{brandName}}` becomes "Acme")

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/email-render.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/email/render.ts` with:
- `substituteVariables(text, variables)` -- replaces `{{key}}` patterns
- `renderEmailHtml({ editorJson, variables, brand, previewText? })` -- pipeline:
  1. Render Maily editor JSON to HTML via `@maily-to/render`
  2. Substitute merge variables in body HTML
  3. Substitute merge variables in preview text
  4. Wrap in EmailBrandFrame component
  5. Render frame to final HTML + plain text via `@react-email/components` render()

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/email-render.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/render.ts tests/unit/email-render.test.ts
git commit -m "feat(email): add rendering pipeline (Maily JSON -> brand frame -> HTML + text)"
```

---

### Task 6: Unified sendEmail function

**Files:**
- Create: `src/lib/email/send.ts`
- Modify: `src/lib/email/provider.ts` -- add `sendHtmlEmail` alongside existing `sendEmail`
- Create: `tests/unit/email-send.test.ts`

- [ ] **Step 1: Add HTML email support to provider**

Add `SendHtmlEmailOptions` interface and `sendHtmlEmail` function to `src/lib/email/provider.ts`. Same as existing `sendEmail` but accepts `html` + `text` strings instead of `react` element.

- [ ] **Step 2: Write the test for unified send**

Mock resolveTemplate, getEffectiveBrand, renderEmailHtml, sendHtmlEmail using `vi.hoisted()` pattern. Test:
- Resolves template, renders, and sends with correct subject (variables substituted)
- Throws when no template found at any level
- Passes scope to template resolution (clientId, partnerId) and brand (clientId, campaignId)
- Sets from address display name to brand name
- **Fallback tier 1:** When renderEmailHtml fails on the resolved template, re-resolves with platform scope and retries render
- **Fallback tier 2:** When platform default render also fails, sends a minimal plain-text email with variables inlined
- All render failures are logged with template id and error details

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/email-send.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/email/send.ts` with:
- `sendEmail({ type, to, variables, scopeCampaignId?, scopePartnerId?, scopeClientId?, replyTo? })`:
  1. Resolve template via cascade
  2. Resolve brand via `getEffectiveBrand(scopeClientId, scopeCampaignId)`
  3. Substitute variables in subject
  4. Try render body via `renderEmailHtml`
  5. **Fallback tier 1:** If render fails and resolved template is not platform scope, re-resolve platform default and retry render. Log the failure with template id.
  6. **Fallback tier 2:** If platform default render also fails, construct minimal plain-text email: subject + all variables as key=value lines. Log the failure.
  7. Set from name to brand name (keep mail.trajectas.com domain)
  8. Send via `sendHtmlEmail`

Note: `html_cache` in the DB is used only for admin preview (list page). The send pipeline always renders fresh from `editor_json` to ensure current brand frame is applied.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/email-send.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/send.ts src/lib/email/provider.ts tests/unit/email-send.test.ts
git commit -m "feat(email): add unified sendEmail function with brand cascade and template resolution"
```

---

### Task 7: Migrate existing assessment invite to new pipeline

**Files:**
- Modify: `src/app/actions/campaigns.ts` -- update `sendParticipantInviteEmail`
- Modify: `src/lib/integrations/service.ts` -- update `sendIntegrationInviteEmail`

- [ ] **Step 1: Update sendParticipantInviteEmail in campaigns.ts**

Replace the dynamic import of `InviteEmail` template and old `sendEmail` from provider with a call to the new unified `sendEmail` from `src/lib/email/send.ts`. Pass type "assessment_invite", participant email, merge variables (participantFirstName, campaignTitle, campaignDescription, assessmentUrl, brandName), and scope ids (campaignId, clientId, partnerId).

- [ ] **Step 2: Update sendIntegrationInviteEmail similarly**

Apply the same pattern in `src/lib/integrations/service.ts`.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass (adjust mocks if they reference old import paths).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/campaigns.ts src/lib/integrations/service.ts
git commit -m "refactor(email): migrate assessment invite to unified send pipeline"
```

---

### Task 8: Validation schemas and server actions for template CRUD

**Files:**
- Create: `src/lib/validations/email-template.ts`
- Create: `src/app/actions/email-templates.ts`

- [ ] **Step 1: Write validation schemas**

Create `src/lib/validations/email-template.ts` with Zod schemas for:
- `emailTemplateTypeSchema` -- z.enum of EMAIL_TYPES
- `emailTemplateScopeSchema` -- z.enum of scopes
- `upsertEmailTemplateSchema` -- type, scopeType, scopeId (uuid nullable), subject (1-500 chars), previewText (optional, max 500), editorJson (record)

- [ ] **Step 2: Write server actions**

Create `src/app/actions/email-templates.ts` with:
- `listEmailTemplates(scopeType, scopeId)` -- query email_templates via admin client, **filter `deleted_at IS NULL`** (all queries must respect soft-delete)
- `getEmailTemplate(type, scopeType, scopeId)` -- single template lookup, **filter `deleted_at IS NULL`**
- `upsertEmailTemplate(input)` -- validate, pre-render html_cache with sample data, upsert via admin client with updated_by = actor.profileId
- `sendTestEmail(type, scopeType?, scopeId?)` -- resolve actor, call unified sendEmail with SAMPLE_VARIABLES to actor's email. Optional scope params allow testing partner/client overrides.

- [ ] **Step 3: Write integration tests**

Create `tests/integration/email-template-actions.test.ts`. Mock admin client using `vi.hoisted()` pattern. Test:
- `listEmailTemplates` returns only non-deleted rows
- `getEmailTemplate` returns null for deleted templates
- `upsertEmailTemplate` validates input and persists
- `sendTestEmail` calls unified sendEmail with sample variables and actor's email

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/email-template.ts src/app/actions/email-templates.ts tests/integration/email-template-actions.test.ts
git commit -m "feat(email): add template CRUD server actions, validation schemas, and integration tests"
```

---

### Task 9: Admin email template list page

**Files:**
- Create: `src/app/(dashboard)/settings/email-templates/page.tsx`
- Create: `src/app/(dashboard)/settings/email-templates/loading.tsx`

- [ ] **Step 1: Create loading skeleton**

Follow the project's shimmer pattern (`animate-shimmer`). Render placeholder blocks matching the list layout.

- [ ] **Step 2: Create list page**

Server component that:
- Reads scope from search params (default: platform). Renders a scope selector (tabs or dropdown) to switch between platform / partner / client views. Partner and client selectors show the entities the current actor has access to.
- Calls `listEmailTemplates(scopeType, scopeId)`
- Renders `<PageHeader eyebrow="Settings">Email Templates</PageHeader>`
- Groups templates by `EMAIL_TYPE_CATEGORIES` (Authentication, Campaigns, Platform)
- Each row is a `<Card variant="interactive">` wrapped in `<ScrollReveal>` with staggered delay (60ms increments) linked to `/settings/email-templates/[type]?scope=...`
- Shows email type label, current subject line, and customization status (default / customized / override)

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/email-templates/
git commit -m "feat(email): add admin email templates list page"
```

---

### Task 10: Admin email template editor page

**Files:**
- Create: `src/app/(dashboard)/settings/email-templates/[type]/page.tsx`
- Create: `src/app/(dashboard)/settings/email-templates/[type]/loading.tsx`
- Create: `src/app/(dashboard)/settings/email-templates/[type]/email-template-editor.tsx`

- [ ] **Step 1: Install Maily.to core editor**

Run: `npm install @maily-to/core`
Expected: Package installed.

- [ ] **Step 2: Create loading skeleton**

Shimmer skeleton matching editor layout (title, subject field, editor area).

- [ ] **Step 3: Create the editor client component**

`email-template-editor.tsx` -- client component with:
- Props: type, initialSubject, initialPreviewText, initialEditorJson
- State: subject, previewText, editorJson, save state (idle/saving/saved)
- Subject line Input field
- Preview text Input field
- Merge variables reference panel (click to copy `{{variable}}` to clipboard with toast)
- JSON textarea as initial editor (**this is explicitly temporary** -- will be replaced with the Maily.to visual editor in Task 13; do not over-invest in textarea UI)
- Scope context selector for creating/editing partner or client template overrides (passes scopeType + scopeId to upsert action)
- Save button using `upsertEmailTemplate` action with state transitions: "Save Changes" -> "Saving..." -> "Saved" (2s) -> idle
- "Send Test Email" button using `sendTestEmail` action (passes current scope params)
- Toast feedback for all operations

- [ ] **Step 4: Create the page server component**

`page.tsx` -- validates `type` param against EMAIL_TYPES (notFound if invalid), reads scope from search params, loads template via `getEmailTemplate`, renders `<PageHeader>` + `<EmailTemplateEditor>` with initial values and scope context.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/email-templates/[type]/
git commit -m "feat(email): add admin email template editor page with JSON editor"
```

---

### Task 11: Supabase auth hook -- send_email webhook

**Files:**
- Create: `src/app/api/auth/send-email/route.ts`
- Modify: `.env.example` -- add SUPABASE_AUTH_HOOK_SECRET

- [ ] **Step 1: Write the webhook route**

POST handler that:
1. Reads `SUPABASE_AUTH_HOOK_SECRET` env var (500 if missing)
2. Reads raw body and `x-supabase-signature` header
3. Verifies HMAC-SHA256 signature using `crypto.timingSafeEqual` (401 if invalid)
4. Parses payload, extracts `user` and `email_data`
5. Maps Supabase email types: magiclink -> magic_link, signup -> welcome, invite -> staff_invite (note: Supabase `invite` may never fire since the codebase uses its own invite system -- include mapping for safety but add a comment)
6. For unmapped types (recovery, email_change, reauthentication): logs warning. **Important:** Before implementing, consult the current Supabase `send_email` hook documentation for the exact expected response schema -- the hook contract (what to return for "handled" vs "not handled") may differ from standard HTTP conventions. The hook may require specific JSON fields rather than just HTTP status codes.
7. Constructs sign-in URL from `email_data.token_hash`, `email_data.redirect_to`, Supabase URL
8. Calls unified `sendEmail()` with mapped type and variables
9. Returns `{ success: true }` on success, error details on failure

- [ ] **Step 2: Add SUPABASE_AUTH_HOOK_SECRET to .env.example**

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/send-email/route.ts .env.example
git commit -m "feat(email): add Supabase send_email auth hook endpoint"
```

---

### Task 12: Rich Maily.to default templates

**Files:**
- Create: `src/lib/email/default-templates.ts`
- Create: `supabase/migrations/00078_email_template_defaults.sql` (or TypeScript seed script)

- [ ] **Step 1: Build default template JSON**

Create `src/lib/email/default-templates.ts` with `DEFAULT_TEMPLATES` record mapping each EmailType to a Maily.to Tiptap document JSON. Each template should include appropriate paragraph, bold marks, and button nodes using the merge variables for that type. Reference `@maily-to/core` docs for the exact Tiptap node schema.

Templates: magic_link (greeting, expiry note, Sign In button), staff_invite (greeting, welcome text, Accept Invitation button), assessment_invite (greeting, campaign title bold, description, Start Assessment button), assessment_reminder (greeting, days remaining bold, Continue Assessment button), report_ready (greeting, campaign title bold, View Report button), welcome (greeting, welcome text, Get Started button), admin_notification (message text, action button).

- [ ] **Step 2: Create migration or seed script to update platform defaults**

Update the 7 seeded rows with the rich editor_json from default-templates.ts. This can be a SQL migration with inline JSON or a TypeScript seed script that imports the defaults and updates via admin client.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/default-templates.ts supabase/migrations/00078_email_template_defaults.sql
git commit -m "feat(email): add rich Maily.to default templates for all email types"
```

---

### Task 13: Wire up Maily.to visual editor

**Files:**
- Modify: `src/app/(dashboard)/settings/email-templates/[type]/email-template-editor.tsx`

- [ ] **Step 1: Read Maily.to core docs**

Check `node_modules/@maily-to/core` for the `<Editor>` component API, props (content, onUpdate, config), and how to constrain available block types.

- [ ] **Step 2: Replace textarea with Maily editor**

Update `email-template-editor.tsx` to use `@maily-to/core` `<Editor>` component. Wire `onUpdate` to capture editor JSON. Configure available blocks: text, heading, image, button, spacer, columns, divider (hide any unsupported blocks).

- [ ] **Step 2.5: Lock color palette to brand**

Investigate Maily.to's color configuration options. Lock the editor's color palette to the resolved brand's colors (primaryColor, textColor, highlightColor) so staff cannot use off-brand colors. If Maily.to doesn't support palette locking natively, constrain via custom CSS or by filtering the color picker options.

- [ ] **Step 3: Add live preview panel**

Add a preview section that renders current editor JSON + sample variables through the brand frame. Can use a server action to render or client-side rendering.

- [ ] **Step 4: Test manually**

Open editor in browser, verify blocks work, JSON updates, save persists, preview renders.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/email-templates/[type]/email-template-editor.tsx
git commit -m "feat(email): integrate Maily.to visual editor in template editor page"
```

---

### Task 14: Register Supabase auth hook and end-to-end test

**Files:**
- No code changes -- configuration in Supabase dashboard + Vercel

- [ ] **Step 1: Add SUPABASE_AUTH_HOOK_SECRET to Vercel env vars**

Generate a random secret. Add to both Vercel env vars and Supabase dashboard.

- [ ] **Step 2: Register the hook in Supabase**

Supabase dashboard -> Authentication -> Hooks: enable `send_email` hook, set URL to `https://admin.trajectas.com/api/auth/send-email`, set shared secret.

- [ ] **Step 3: Test magic link flow**

Go to trajectas.com/login, enter email, check inbox for branded template, click link, verify auth works.

- [ ] **Step 4: Test assessment invite flow**

Create campaign, invite participant, verify branded email arrives via new pipeline.

- [ ] **Step 5: Verify send test email from admin UI**

Go to Settings -> Email Templates -> Magic Link -> Send Test Email, verify email arrives.

---

### Task 15: Clean up legacy email code

**Files:**
- Delete: `src/lib/email/templates/invite.tsx`
- Modify: `src/lib/email/provider.ts` -- remove unused React-based sendEmail if no longer referenced

- [ ] **Step 1: Search for remaining references to old InviteEmail template**

Run: `grep -r "InviteEmail\|templates/invite" src/`
Expected: No remaining references.

- [ ] **Step 2: Delete the old template file**

Remove `src/lib/email/templates/invite.tsx`.

- [ ] **Step 3: Remove old React-based sendEmail if unused**

Check if any code still uses `sendEmail` from provider.ts with a `react` parameter. If not, remove it and keep only `sendHtmlEmail`.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(email): remove legacy InviteEmail template and React-based sendEmail"
```
