import { createHash } from 'node:crypto'
import type { ConsentContent } from './types'
export function consentVersion(content: ConsentContent, privacyUrl?: string, termsUrl?: string) {
  return createHash('sha256').update(JSON.stringify({ heading: content.heading, body: content.body, checkbox: content.consentCheckboxLabel, privacyUrl: privacyUrl ?? null, termsUrl: termsUrl ?? null })).digest('hex')
}
