import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'
import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { renderMatrixGrid, renderOptionTile } from '@/lib/cognitive/render/matrix-svg'

type DbClient = SupabaseClient

export type CognitiveItemRender = {
  /** Inline SVG markup for the 3x3 grid (8 cells; the blank cell is UI chrome — see cognitive-response.tsx). */
  gridSvg: string
  /** Honest accessibility identification, NOT a cell-by-cell description — doc 02 (platform-architecture) §2.2. */
  ariaLabel: string
  /** item_options.id -> that option's rendered SVG. */
  optionSvgByOptionId: Map<string, string>
}

/**
 * Doc 03-logical-reasoning-design.md §7.4 / doc 03 (item-generation-pipeline)
 * §6.7: a cell-by-cell verbal description would convert an inductive
 * visual-relational reasoning task into a verbal working-memory task — a
 * different construct. The label is a descriptive IDENTIFICATION, not a
 * description of content (WCAG 2.2 SC 1.1.1's test-and-exercise exception).
 */
const ariaLabelFor = (optionCount: number): string =>
  `A three-by-three grid of geometric figures with the bottom-right cell missing, and ${optionCount === 6 ? 'six' : 'five'} answer options.`

/**
 * The ONLY DAL module allowed to read `cognitive_item_specs` /
 * `cognitive_option_specs` on the participant runner path (doc 02
 * platform-architecture.md §2.3, §2.6 layer 3 — the "projection" mechanical
 * guarantee). It never touches `item_answer_keys` or
 * `item_option_diagnostics` — see tests/architecture/answer-key-isolation.test.ts.
 *
 * Every stored row is parsed through the `.strict()` zod schema before use
 * (defence in depth: a row that somehow fails to validate is skipped and
 * logged rather than rendered), then narrowed through `toRenderSpec()` —
 * the renderer never sees `rules`/`radicals`, regardless of what the stored
 * row happens to contain.
 */
export async function getCognitiveItemsForDelivery(
  db: DbClient,
  itemIds: readonly string[],
): Promise<Map<string, CognitiveItemRender>> {
  const result = new Map<string, CognitiveItemRender>()
  if (itemIds.length === 0) return result

  const [itemSpecsResult, optionSpecsResult] = await Promise.all([
    db.from('cognitive_item_specs').select('item_id, spec').in('item_id', itemIds),
    db.from('cognitive_option_specs').select('option_id, item_id, spec').in('item_id', itemIds),
  ])

  if (itemSpecsResult.error) {
    logActionError('cognitiveItems.itemSpecs', itemSpecsResult.error)
    return result
  }
  if (optionSpecsResult.error) {
    logActionError('cognitiveItems.optionSpecs', optionSpecsResult.error)
    return result
  }

  type OptionRow = { option_id: string; item_id: string; spec: unknown }
  const optionsByItem = new Map<string, OptionRow[]>()
  for (const row of (optionSpecsResult.data ?? []) as OptionRow[]) {
    const list = optionsByItem.get(row.item_id)
    if (list) list.push(row)
    else optionsByItem.set(row.item_id, [row])
  }

  for (const row of (itemSpecsResult.data ?? []) as { item_id: string; spec: unknown }[]) {
    const itemId = row.item_id
    const parsedItem = FiguralMatrixItemSpec.safeParse(row.spec)
    if (!parsedItem.success) {
      logActionError('cognitiveItems.parseItemSpec', new Error(`item ${itemId}: ${parsedItem.error.message}`))
      continue
    }

    const optionRows = optionsByItem.get(itemId) ?? []
    const parsedOptions: { optionId: string; spec: CognitiveOptionSpec }[] = []
    let hadParseFailure = false
    for (const optRow of optionRows) {
      const parsed = CognitiveOptionSpec.safeParse(optRow.spec)
      if (!parsed.success) {
        logActionError(
          'cognitiveItems.parseOptionSpec',
          new Error(`item ${itemId} option ${optRow.option_id}: ${parsed.error.message}`),
        )
        hadParseFailure = true
        continue
      }
      parsedOptions.push({ optionId: optRow.option_id, spec: parsed.data })
    }
    // Fail closed on this item rather than deliver a partial/malformed
    // stimulus: an item with a bad option spec is not renderable correctly,
    // and getSessionState falls back to the item's plain stem/options when
    // no cognitive render is available for it (see src/app/actions/assess.ts).
    if (hadParseFailure || parsedOptions.length === 0) continue

    const renderSpec = toRenderSpec(
      parsedItem.data,
      parsedOptions.map((o) => o.spec),
    )
    const gridSvg = renderMatrixGrid(renderSpec)

    const optionSvgByOptionId = new Map<string, string>()
    renderSpec.options.forEach((option, i) => {
      // toRenderSpec preserves input order (see src/lib/cognitive/spec/project.ts),
      // so index-zipping back to parsedOptions is safe and avoids relying on
      // `slot` as a join key.
      optionSvgByOptionId.set(parsedOptions[i].optionId, renderOptionTile(option.elements, renderSpec.render))
    })

    result.set(itemId, { gridSvg, ariaLabel: ariaLabelFor(optionSvgByOptionId.size), optionSvgByOptionId })
  }

  return result
}
