/**
 * Duplicate detection (doc 03-item-generation-pipeline.md §9.3 / G-13).
 *
 * SCOPE NOTE (reported in the LR-7 writeup): doc §9.3's `structuralHash`
 * canonicalises a spec "up to the incidental symmetry group" — up to 96
 * transforms (4 reflections x 4 rotations x <=6 shape relabellings) so two
 * siblings that are the same item under a reflection collide. The doc's own
 * §10.1 table lists that full symmetry-group hash as safe to defer ("content
 * hash plus the reviewer's sibling-thumbnail panel catches near-repeats at
 * 144 items; it becomes necessary at 300+"). This module implements:
 *   - `contentHash` exact-duplicate detection (imported from spec/hash.ts,
 *     the LR-4 module — not reimplemented here).
 *   - a lighter structural hash: the RULE STRUCTURE (rule ids, axes,
 *     directions, and abstracted params — step signs/magnitudes and
 *     operator kind) plus radicals, with the concrete VALUE SET a
 *     distribution rule (R6) draws from stripped out (doc's own example:
 *     which 3 shapes fill a Latin square is a relabelling, not a new
 *     structure). This is enough to catch "two siblings that are the same
 *     underlying pattern under a shape relabelling" for distribution
 *     families, without the full reflection/relabelling orbit enumeration.
 *
 *   FINDING: this abstraction is WRONG for a family with no distribution to
 *   relabel — e.g. LRM-PROG-COUNT (M1), where the single repeated shape is
 *   not drawn from a 3-value set at all. There, the rule's own `params`
 *   (base/step) don't encode shape identity, so two clones differing ONLY
 *   in shape collapse to the identical structural hash and G-13 rejects the
 *   second as a within-family duplicate — even though doc 03-logical-
 *   reasoning-design.md §4.2 explicitly lists "which specific shapes
 *   instantiate a shape set" as a legitimate incidental clones are meant to
 *   vary. `structuralExtra` below is the fix: a family may declare which of
 *   its OWN incidentals are structurally distinguishing (not a relabelling
 *   symmetry) so they are folded into the hash rather than discarded.
 */
import type { RuleSpec } from '../../spec/schema'
import { canonicalJson, contentHash } from '../../spec/hash'

export interface DuplicateCheckInput {
  familyCode: string
  rules: readonly RuleSpec[]
  radicals: unknown
  contentHashValue: string
  /** Family-declared "these incidentals are structurally distinguishing, not a relabelling" payload. See the header note above. */
  structuralExtra?: unknown
}

/** Strip incidental parameter values (concrete step magnitudes stay — they ARE structural; concrete VALUE SETS like which 3 shapes are used do not). */
function abstractRuleForStructuralHash(rule: RuleSpec): unknown {
  const { params, ...rest } = rule
  const abstractedParams: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (k === 'values' && Array.isArray(v)) {
      abstractedParams[k] = v.length // which 3 shapes were chosen is incidental; how many is structural
    } else {
      abstractedParams[k] = v
    }
  }
  return { ...rest, params: abstractedParams, statement: undefined }
}

export function structuralHash(familyCode: string, rules: readonly RuleSpec[], radicals: unknown, structuralExtra: unknown = {}): string {
  return contentHash({
    familyCode,
    rules: rules.map(abstractRuleForStructuralHash),
    radicals,
    structuralExtra,
  })
}

export interface DuplicateGateResult {
  status: 'pass' | 'fail'
  detail?: Record<string, unknown>
}

/**
 * G-13. `existingContentHashes`/`existingStructuralHashes` should include
 * both the pre-existing bank (the LR-4 exemplar fixtures, in this repo's
 * case — see scripts/cognitive/generate-matrix-bank.ts) and every item
 * already accepted earlier in the SAME run.
 */
export function duplicateGate(item: DuplicateCheckInput, existingContentHashes: ReadonlySet<string>, existingStructuralHashes: ReadonlySet<string>, familyStructuralHashes: ReadonlySet<string>): DuplicateGateResult {
  if (existingContentHashes.has(item.contentHashValue)) {
    return { status: 'fail', detail: { reason: 'CONTENT_HASH_COLLISION' } }
  }
  const sh = structuralHash(item.familyCode, item.rules, item.radicals, item.structuralExtra)
  if (familyStructuralHashes.has(sh)) {
    return { status: 'fail', detail: { reason: 'STRUCTURAL_HASH_COLLISION_WITHIN_FAMILY', structuralHash: sh } }
  }
  if (existingStructuralHashes.has(sh)) {
    // Cross-family collision — doc 03 §9.3: warn, don't block.
    return { status: 'pass', detail: { warning: 'STRUCTURAL_HASH_COLLISION_ACROSS_FAMILY', structuralHash: sh } }
  }
  return { status: 'pass', detail: { structuralHash: sh } }
}

export { canonicalJson, contentHash }
