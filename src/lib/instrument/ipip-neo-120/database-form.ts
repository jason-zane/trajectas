import 'server-only'
import ids from './database-ids.json'
import { IPIP_FORM_VERSION, IPIP_ITEMS } from './definition'
import type { SectionFormDTO, SectionFormEntryDTO } from '@/lib/dal/session-forms'

export const IPIP_DATABASE = ids

export function assertIpipDatabaseEntries(entries: readonly SectionFormEntryDTO[]): void {
  if (entries.length !== 120) throw new Error('IPIP-NEO-120 requires all 120 items')
  for (const [index, item] of IPIP_ITEMS.entries()) {
    const entry = entries[index]
    if (entry.itemId !== ids.items[item.itemId as keyof typeof ids.items] || entry.position !== index + 1 ||
      entry.itemVersion !== 1 || entry.contentHash !== ids.itemContentHashes[item.itemId as keyof typeof ids.itemContentHashes] ||
      entry.purpose !== 'construct' || !entry.countsTowardScore) {
      throw new Error(`IPIP-NEO-120 frozen item ${index + 1} does not match the canonical form`)
    }
  }
}

export function assertIpipDatabaseForms(forms: Map<string, SectionFormDTO>): void {
  const form = forms.get(ids.sectionId)
  if (forms.size !== 1 || !form || form.formCode !== IPIP_FORM_VERSION) throw new Error('IPIP-NEO-120 frozen form is invalid')
  assertIpipDatabaseEntries(form.entries)
}
