/**
 * Unified email send function.
 *
 * Resolves the correct template for the given type and organisational scope
 * (client → partner → platform cascade), applies brand theming, renders to
 * final HTML + plain text, and delivers via Resend.
 *
 * Two-tier render fallback:
 *   Tier 1 — if the resolved (non-platform) template fails to render, log a
 *             warning and retry with the platform default template.
 *   Tier 2 — if the platform default also fails, log an error and construct a
 *             minimal plain-text fallback so the email is still delivered.
 */

import { resolveTemplate } from './template-registry'
import { renderEmailHtml, substituteVariables } from './render'
import { sendHtmlEmail } from './provider'
import { getEffectiveBrand } from '@/app/actions/brand'
import { DEFAULT_EMAIL_STYLES } from '@/lib/brand/defaults'
import type { EmailType } from './types'

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

export async function sendEmail(params: {
  type: EmailType
  to: string
  variables: Record<string, string>
  scopeCampaignId?: string
  scopePartnerId?: string
  scopeClientId?: string
  replyTo?: string
}): Promise<void> {
  const { type, to, variables, scopeCampaignId, scopePartnerId, scopeClientId, replyTo } = params

  // ── 1. Resolve template via cascade (clientId, partnerId) ─────────────────
  const template = await resolveTemplate(type, {
    clientId: scopeClientId,
    partnerId: scopePartnerId,
  })

  if (!template) {
    throw new Error(`No email template found for type ${type}`)
  }

  // ── 2. Resolve effective brand ────────────────────────────────────────────
  const brand = await getEffectiveBrand(scopeClientId, scopeCampaignId)

  const renderBrand = {
    name: brand.name,
    logoUrl: (brand as { logoUrl?: string | null }).logoUrl ?? null,
    primaryColor: brand.primaryColor,
    textColor: brand.emailStyles?.textColor ?? DEFAULT_EMAIL_STYLES.textColor,
    footerTextColor: brand.emailStyles?.footerTextColor ?? DEFAULT_EMAIL_STYLES.footerTextColor,
  }

  // ── 3. Substitute variables in subject ────────────────────────────────────
  const subject = substituteVariables(template.subject, variables)

  // ── 4. Render with two-tier fallback ─────────────────────────────────────
  let html: string
  let text: string

  try {
    const rendered = await renderEmailHtml({
      editorJson: template.editor_json,
      variables,
      brand: renderBrand,
      previewText: template.preview_text,
    })
    html = rendered.html
    text = rendered.text
  } catch (err) {
    // ── Tier 1 fallback: retry with platform default if resolved template is
    //    not already a platform template ──────────────────────────────────────
    if (template.scope_type !== 'platform') {
      console.warn(
        `[email] Render failed for template ${template.id}: ${err instanceof Error ? err.message : String(err)} — retrying with platform default`,
        err,
      )

      const platformTemplate = await resolveTemplate(type, {})

      if (platformTemplate) {
        try {
          const rendered = await renderEmailHtml({
            editorJson: platformTemplate.editor_json,
            variables,
            brand: renderBrand,
            previewText: platformTemplate.preview_text,
          })
          html = rendered.html
          text = rendered.text
        } catch (platformErr) {
          // ── Tier 2 fallback: plain-text ──────────────────────────────────
          console.error(
            `[email] Platform template render also failed: ${platformErr instanceof Error ? platformErr.message : String(platformErr)} — sending plain-text fallback`,
            platformErr,
          )
          ;({ html, text } = buildPlainTextFallback(subject, variables))
        }
      } else {
        // No platform template found; still use tier-2 plain-text fallback
        console.error(
          `[email] No platform template available: ${err instanceof Error ? err.message : String(err)} — sending plain-text fallback`,
          err,
        )
        ;({ html, text } = buildPlainTextFallback(subject, variables))
      }
    } else {
      // Already tried the platform template; use tier-2 plain-text fallback
      console.error(
        `[email] Platform template render failed: ${err instanceof Error ? err.message : String(err)} — sending plain-text fallback`,
        err,
      )
      ;({ html, text } = buildPlainTextFallback(subject, variables))
    }
  }

  // ── 5. Build from address with brand display name ─────────────────────────
  const rawFrom = process.env.EMAIL_FROM ?? 'noreply@mail.trajectas.com'
  // Extract the email address portion if EMAIL_FROM contains a display name
  const emailMatch = rawFrom.match(/<([^>]+)>/)
  const emailAddress = emailMatch ? emailMatch[1] : rawFrom
  const from = `${brand.name} <${emailAddress}>`

  // ── 6. Send ───────────────────────────────────────────────────────────────
  await sendHtmlEmail({
    to,
    subject,
    html,
    text,
    from,
    replyTo,
  })
}

// ---------------------------------------------------------------------------
// buildPlainTextFallback
// ---------------------------------------------------------------------------

function buildPlainTextFallback(
  subject: string,
  variables: Record<string, string>,
): { html: string; text: string } {
  const varLines = Object.entries(variables)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const text = `${subject}\n\n${varLines}`
  const htmlVarLines = Object.entries(variables)
    .map(([k, v]) => `<p>${k}=${v}</p>`)
    .join('\n')
  const html = `<p>${subject}</p>\n${htmlVarLines}`

  return { html, text }
}
