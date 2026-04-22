/**
 * Email rendering pipeline.
 *
 * Converts Maily editor JSON into final HTML + plain text by:
 *   1. Rendering the editor JSON to HTML via @maily-to/render (Maily class)
 *   2. Substituting {{key}} merge variables in body HTML and preview text
 *   3. Wrapping the result in EmailBrandFrame
 *   4. Rendering the frame to final HTML + plain text via @react-email/components
 *
 * Variable substitution escapes variable values for HTML contexts and strips
 * CR/LF for header-like contexts (subject, preview text). Maily renders the
 * editor JSON with its own escaping; the extra pass here catches raw {{key}}
 * placeholders that Maily leaves intact (e.g. inside raw text nodes) and
 * ensures untrusted values (participant names, user_metadata, etc.) cannot
 * inject HTML into the rendered body.
 */

import React from 'react'
import { EmailBrandFrame } from './brand-frame'
import { escapeHtml, stripLineBreaks } from '@/lib/security/sanitize-html'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderBrand {
  name: string
  logoUrl: string | null
  primaryColor: string
  textColor: string
  footerTextColor: string
}

export interface RenderEmailOptions {
  editorJson: Record<string, unknown>
  variables: Record<string, string>
  brand: RenderBrand
  previewText?: string | null
}

// ---------------------------------------------------------------------------
// substituteVariables
// ---------------------------------------------------------------------------

type SubstituteMode = 'html' | 'text'

/**
 * Replaces all `{{key}}` placeholders in `text` with values from `variables`.
 * Unknown placeholders are left unchanged.
 *
 * `mode` controls how variable values are escaped:
 *   - 'html' (default): HTML-escape values so they can't inject tags / event
 *     handlers when the result is used as HTML.
 *   - 'text': strip CR/LF only; suitable for email subject lines or any
 *     plain-text header-like context.
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string>,
  mode: SubstituteMode = 'html',
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return match
    }
    const raw = variables[key]
    return mode === 'html' ? escapeHtml(raw) : stripLineBreaks(raw)
  })
}

// ---------------------------------------------------------------------------
// renderEmailHtml
// ---------------------------------------------------------------------------

/**
 * Full email rendering pipeline.
 * Returns the final `{ html, text }` ready to send via Resend (or any mailer).
 */
export async function renderEmailHtml(
  options: RenderEmailOptions,
): Promise<{ html: string; text: string }> {
  const { editorJson, variables, brand, previewText } = options

  // Dynamic imports keep these heavy modules (maily, react-email) out of the
  // module graph at load time — they're only resolved when email rendering is
  // actually needed, preventing cold-start failures in unrelated Lambdas.
  const [{ Maily }, { render }] = await Promise.all([
    import('@maily-to/render'),
    import('@react-email/components'),
  ])

  // Step 1: Render Maily editor JSON to body HTML with variables resolved.
  // Maily has its own variable system ({{var,fallback=...}}) that differs from
  // our simple {{var}} format — we must call setVariableValues() so Maily
  // substitutes them during render rather than outputting raw placeholders.
  const maily = new Maily(editorJson as ConstructorParameters<typeof Maily>[0])
  maily.setVariableValues(variables)
  const mailyHtml = await maily.render()

  // Step 2: Run our own substituteVariables as a fallback for any {{key}}
  // placeholders that Maily didn't handle (e.g. raw text nodes). Values are
  // HTML-escaped here because mailyHtml is rendered HTML.
  const bodyHtml = substituteVariables(mailyHtml, variables, 'html')

  // Step 3: Substitute merge variables in preview text. Preview text is
  // plain text in the inbox client, but still needs CR/LF stripped so a
  // crafted variable can't inject email headers.
  const resolvedPreviewText = previewText
    ? substituteVariables(previewText, variables, 'text')
    : undefined

  // Step 4: Build the EmailBrandFrame element
  const frameElement = React.createElement(EmailBrandFrame, {
    brandName: brand.name,
    brandLogoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    textColor: brand.textColor,
    footerTextColor: brand.footerTextColor,
    previewText: resolvedPreviewText,
    bodyHtml,
  })

  // Step 5: Render to final HTML + plain text
  const html = await render(frameElement)
  const text = await render(frameElement, { plainText: true })

  return { html, text }
}
