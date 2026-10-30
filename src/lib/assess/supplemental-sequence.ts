import type { ItemForRunner } from '@/app/actions/assess'

/** Supplemental items have their own storage and scoring contract. Their
 * placement never changes the order or identity of the delivered native form. */
export interface SupplementalQuestion {
  id: string
  stem: string
  afterItem: number
}
export const supplementalItemId = (id: string) => `supplemental:${id}`

export function interleaveSupplementalItems(
  nativeItems: ItemForRunner[],
  questions: readonly SupplementalQuestion[],
  anchors: readonly string[],
): ItemForRunner[] {
  if (questions.some(q => !Number.isInteger(q.afterItem) || q.afterItem < 1 || q.afterItem > nativeItems.length)
    || new Set(questions.map(q => q.id)).size !== questions.length) throw new Error('Invalid supplemental delivery sequence')
  return nativeItems.flatMap((item, index) => [item, ...questions.filter(q => q.afterItem === index + 1).map(q => ({
    id: supplementalItemId(q.id), stem: q.stem, displayOrder: index,
    options: anchors.map((label, i) => ({ id: `${supplementalItemId(q.id)}:${i}`, label, value: i + 1, sortOrder: i })),
  }))])
}
