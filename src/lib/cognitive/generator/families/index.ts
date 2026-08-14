/**
 * Family registry. `familyCode -> FamilyTemplate`. Doc 03-item-generation-
 * pipeline.md §3.3: "A family is the unit of authorship."
 */
import type { FamilyTemplate } from '../compose'
import { LRM_PROG_COUNT } from './lrm-prog-count'
import { LRM_ROT } from './lrm-rot'
import { LRM_DIST3X2 } from './lrm-dist3x2'
import { LRM_ADD } from './lrm-add'
import { LRM_SUB } from './lrm-sub'
import { LRM_2R_XLAYER } from './lrm-2r-xlayer'
import { LRM_3R_DIST } from './lrm-3r-dist'
import { LRM_XOR_XLAYER } from './lrm-xor-xlayer'
import { LRM_MOVE } from './lrm-move'

export const ALL_FAMILIES: FamilyTemplate<unknown>[] = [
  LRM_PROG_COUNT,
  LRM_ROT,
  LRM_DIST3X2,
  LRM_ADD,
  LRM_SUB,
  LRM_2R_XLAYER,
  LRM_3R_DIST,
  LRM_XOR_XLAYER,
  LRM_MOVE,
].map((f) => f as FamilyTemplate<unknown>)

export const FAMILY_REGISTRY: Record<string, FamilyTemplate<unknown>> = Object.fromEntries(ALL_FAMILIES.map((f) => [f.code, f]))

export {
  LRM_PROG_COUNT,
  LRM_ROT,
  LRM_DIST3X2,
  LRM_ADD,
  LRM_SUB,
  LRM_2R_XLAYER,
  LRM_3R_DIST,
  LRM_XOR_XLAYER,
  LRM_MOVE,
}
