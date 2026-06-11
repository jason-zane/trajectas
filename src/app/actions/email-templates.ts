'use server'

import { unstable_cache, updateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveSessionActor } from '@/lib/auth/actor'
import {
  AuthorizationError,
  assertAdminOnly,
  canManageClient,
  canManagePartner,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { upsertEmailTemplateSchema } from '@/lib/validations/email-template'
import { renderEmailHtml } from '@/lib/email/render'
import { getEffectiveBrand } from '@/app/actions/brand'
import { DEFAULT_EMAIL_STYLES } from '@/lib/brand/defaults'
import { SAMPLE_VARIABLES } from '@/lib/email/types'
import type { EmailType, EmailTemplateScope } from '@/lib/email/types'

/**
 * Templates are rendered into the platform's most trust-laden emails
 * (magic-link, welcome, report-ready), so managing or even reading a scope's
 * templates requires authority over that scope — platform templates are
 * platform-admin only; partner/client templates require admin of that
 * partner/client. Mere authentication is not enough (prior finding F-003).
 */
async function assertCanManageEmailScope(
  scopeType: EmailTemplateScope,
  scopeId: string | null,
) {
  const scope = await resolveAuthorizedScope()

  if (scope.isPlatformAdmin) {
    return scope
  }

  if (scopeType === 'platform') {
    assertAdminOnly(scope)
    return scope
  }

  if (!scopeId) {
    throw new AuthorizationError(
      `A ${scopeType} id is required for ${scopeType}-scoped email templates.`,
    )
  }

  if (scopeType === 'partner' && !canManagePartner(scope, scopeId)) {
    throw new AuthorizationError(
      'You are not authorized to manage email templates for this partner.',
    )
  }

  if (scopeType === 'client' && !canManageClient(scope, scopeId)) {
    throw new AuthorizationError(
      'You are not authorized to manage email templates for this client.',
    )
  }

  return scope
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listEmailTemplates(
  scopeType: EmailTemplateScope,
  scopeId: string | null,
) {
  await assertCanManageEmailScope(scopeType, scopeId)

  const db = createAdminClient()

  let query = db
    .from('email_templates')
    .select('id, type, scope_type, scope_id, subject, preview_text, is_active, updated_at')
    .eq('scope_type', scopeType)
    .is('deleted_at', null)

  if (scopeId) {
    query = query.eq('scope_id', scopeId)
  } else {
    query = query.is('scope_id', null)
  }

  const { data, error } = await query.order('type')
  if (error) throw new Error(error.message)
  return data ?? []
}

async function getEmailTemplateImpl(
  type: EmailType,
  scopeType: EmailTemplateScope,
  scopeId: string | null,
) {
  await assertCanManageEmailScope(scopeType, scopeId)

  const db = createAdminClient()

  let query = db
    .from('email_templates')
    .select('*')
    .eq('type', type)
    .eq('scope_type', scopeType)
    .is('deleted_at', null)

  if (scopeId) {
    query = query.eq('scope_id', scopeId)
  } else {
    query = query.is('scope_id', null)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

const getEmailTemplateCached = unstable_cache(
  getEmailTemplateImpl,
  ['email-template'],
  {
    revalidate: 300,
    tags: ['email-templates'],
  }
)

export async function getEmailTemplate(
  type: EmailType,
  scopeType: EmailTemplateScope,
  scopeId: string | null,
) {
  return getEmailTemplateCached(type, scopeType, scopeId)
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function upsertEmailTemplate(input: unknown) {
  const parsed = upsertEmailTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { type, scopeType, scopeId, subject, previewText, editorJson } = parsed.data

  const actor = await resolveSessionActor()
  if (!actor?.isActive) {
    return { error: { _form: ['Unauthorized'] } }
  }

  await assertCanManageEmailScope(scopeType, scopeId ?? null)

  // Pre-render html_cache (non-fatal)
  let htmlCache: string | null = null
  try {
    const brand = await getEffectiveBrand(
      scopeType === 'client' ? scopeId ?? undefined : undefined,
    )
    const brandForRender = {
      name: brand.name,
      logoUrl: (brand as { logoUrl?: string | null }).logoUrl ?? null,
      primaryColor: brand.primaryColor,
      textColor: brand.emailStyles?.textColor ?? DEFAULT_EMAIL_STYLES.textColor,
      footerTextColor: brand.emailStyles?.footerTextColor ?? DEFAULT_EMAIL_STYLES.footerTextColor,
    }
    const sampleVars = SAMPLE_VARIABLES[type] as Record<string, string>
    const rendered = await renderEmailHtml({
      editorJson,
      variables: sampleVars,
      brand: brandForRender,
      previewText: previewText ?? null,
    })
    htmlCache = rendered.html
  } catch (err) {
    console.warn('[email-templates] html_cache pre-render failed (non-fatal):', err)
  }

  const db = createAdminClient()

  const { error } = await db.from('email_templates').upsert(
    {
      type,
      scope_type: scopeType,
      scope_id: scopeId,
      subject,
      preview_text: previewText ?? null,
      editor_json: editorJson,
      html_cache: htmlCache,
      updated_by: actor.id,
    },
    {
      onConflict: 'type,scope_type,scope_id',
    },
  )

  if (error) return { error: { _form: [error.message] } }
  updateTag('email-templates')
  return {}
}

// ---------------------------------------------------------------------------
// Test send
// ---------------------------------------------------------------------------

export async function sendTestEmail(
  type: EmailType,
  scopeType?: EmailTemplateScope,
  scopeId?: string | null,
) {
  const actor = await resolveSessionActor()
  if (!actor?.isActive) {
    throw new Error('Unauthorized')
  }

  // Rendering a scope's template (even to yourself) discloses its content.
  await assertCanManageEmailScope(scopeType ?? 'platform', scopeId ?? null)

  const { sendEmail } = await import('@/lib/email/send')

  const sampleVars = SAMPLE_VARIABLES[type] as Record<string, string>

  await sendEmail({
    type,
    to: actor.email,
    variables: sampleVars,
    ...(scopeType === 'client' && scopeId ? { scopeClientId: scopeId } : {}),
    ...(scopeType === 'partner' && scopeId ? { scopePartnerId: scopeId } : {}),
  })
}
