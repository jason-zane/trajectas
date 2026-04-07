'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveSessionActor } from '@/lib/auth/actor'
import { upsertEmailTemplateSchema } from '@/lib/validations/email-template'
import { renderEmailHtml } from '@/lib/email/render'
import { sendHtmlEmail } from '@/lib/email/provider'
import { getEffectiveBrand } from '@/app/actions/brand'
import { DEFAULT_EMAIL_STYLES } from '@/lib/brand/defaults'
import { SAMPLE_VARIABLES } from '@/lib/email/types'
import type { EmailType, EmailTemplateScope } from '@/lib/email/types'

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listEmailTemplates(
  scopeType: EmailTemplateScope,
  scopeId: string | null,
) {
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

export async function getEmailTemplate(
  type: EmailType,
  scopeType: EmailTemplateScope,
  scopeId: string | null,
) {
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
