/**
 * `BankItemSummary` (server DTO) -> `ItemRow` (client props).
 *
 * The narrowing is the point. Server components call this before handing data
 * to `ItemsTable`, so the browser payload is a reviewed list of fields rather
 * than a whole DTO that a later author might quietly extend.
 *
 * `import type` is erased at compile time, so importing from the `server-only`
 * DAL here does not pull it into any bundle — and this module is only ever
 * imported by server components in the first place.
 */

import type { BankItemSummary, SignOffSummary } from '@/lib/dal/item-bank-admin'
import type { ItemRow, SignOffCell } from './items-table'

function toSignOffCell(signOff: SignOffSummary | null): SignOffCell {
  if (!signOff) return null
  return {
    present: true,
    approved: signOff.decision === 'approved',
    matchesCurrentContent: signOff.matchesCurrentContent,
    reviewer: signOff.reviewerName ?? signOff.reviewerEmail,
  }
}

export function toItemRow(
  item: BankItemSummary,
  familyCode: string | null = null,
): ItemRow {
  return {
    id: item.id,
    stem: item.stem,
    familyId: item.familyId,
    familyCode,
    lifecycleState: item.lifecycleState,
    difficultyPriorB: item.difficultyPriorB,
    difficultyPriorBand: item.difficultyPriorBand,
    exposureCount: item.exposureCount,
    generatorSeed: item.generatorSeed,
    contentSignOff: toSignOffCell(item.contentSignOff),
    fairnessSignOff: toSignOffCell(item.fairnessSignOff),
    formPlacements: item.formPlacements.map(
      (placement) => `${placement.assessmentTitle} · ${placement.sectionTitle}`,
    ),
  }
}
