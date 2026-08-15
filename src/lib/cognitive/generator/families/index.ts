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
import { LRM_XOR_DIST_XLAYER } from './lrm-xor-dist-xlayer'
import { LRM_3R_XLAYER } from './lrm-3r-xlayer'

/**
 * LRM_DIST3X2 is deliberately ABSENT from this list. It cannot satisfy G-11
 * (copy-elimination resistance) for any parameter draw — not because its
 * distractor search is weak, but because a cell described by exactly two
 * three-valued axes has only 9 distinguishable forms, all 9 of which the
 * duplicate-free grid consumes, leaving the key as the only possible
 * non-copy. The full proof, the closed escape hatches, and what a
 * replacement would have to look like are in the header of
 * `families/lrm-dist3x2.ts`. The family is kept exported (below) so the
 * analysis and its worked M3 construction stay in the tree and it can be
 * re-registered the moment it is rebuilt on an axis the grid cannot exhaust.
 * Registering it as-is would add 0 items and 10 rejects per pilot run.
 */
export const ALL_FAMILIES: FamilyTemplate<unknown>[] = [
  LRM_PROG_COUNT,
  LRM_ROT,
  LRM_ADD,
  LRM_SUB,
  LRM_2R_XLAYER,
  LRM_3R_DIST,
  LRM_XOR_XLAYER,
  LRM_MOVE,
  // Added by issue #346: neither of doc 03's own eight exemplars reaches
  // the very-hard band once §4.4's formula is applied honestly (see that
  // doc's §4.4/§6 correction notes) — these two families do, through
  // genuinely more rule content, not a reweighting of the existing eight.
  LRM_XOR_DIST_XLAYER,
  LRM_3R_XLAYER,
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
  LRM_XOR_DIST_XLAYER,
  LRM_3R_XLAYER,
}
