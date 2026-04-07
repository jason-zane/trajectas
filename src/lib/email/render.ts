/**
 * Email rendering pipeline.
 *
 * Converts Maily editor JSON into final HTML + plain text by:
 *   1. Rendering the editor JSON to HTML via @maily-to/render (Maily class)
 *   2. Sanitizing the rendered body HTML with DOMPurify
 *   3. Substituting {{key}} merge variables in body HTML and preview text
 *   4. Wrapping the result in EmailBrandFrame
 *   5. Rendering the frame to final HTML + plain text via @react-email/components
 */

import { Maily } from '@maily-to/render'
import DOMPurify from 'isomorphic-dompurify'
import { render } from '@react-email/components'
import React from 'react'
import { EmailBrandFrame } from './brand-frame'

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

/**
 * Replaces all `{{key}}` placeholders in `text` with values from `variables`.
 * Unknown placeholders are left unchanged.
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match
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

  // Step 1: Render Maily editor JSON to body HTML
  const maily = new Maily(editorJson as ConstructorParameters<typeof Maily>[0])
  const mailyHtml = await maily.render()

  // Step 2: Sanitize the rendered body HTML (server-side DOMPurify)
  const sanitizedBodyHtml = DOMPurify.sanitize(mailyHtml, {
    // Allow inline styles so Maily's table-based layout survives
    ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'width', 'height', 'target', 'rel'],
    ADD_TAGS: ['table', 'tbody', 'tr', 'td', 'th', 'thead', 'tfoot'],
  })

  // Step 3: Substitute merge variables in body HTML
  const bodyHtml = substituteVariables(sanitizedBodyHtml, variables)

  // Step 4: Substitute merge variables in preview text (if provided)
  const resolvedPreviewText = previewText
    ? substituteVariables(previewText, variables)
    : undefined

  // Step 5: Build the EmailBrandFrame element
  const frameElement = React.createElement(EmailBrandFrame, {
    brandName: brand.name,
    brandLogoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    textColor: brand.textColor,
    footerTextColor: brand.footerTextColor,
    previewText: resolvedPreviewText,
    bodyHtml,
  })

  // Step 6: Render to final HTML + plain text
  const html = await render(frameElement)
  const text = await render(frameElement, { plainText: true })

  return { html, text }
}
