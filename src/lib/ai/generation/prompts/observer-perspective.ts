/**
 * Observer-perspective item rewriting.
 *
 * A 360 needs each self-report item ("I communicate clearly") restated as a
 * third-person behavioural observation ("This leader communicates clearly").
 * The observer variant must measure the SAME construct, keep the SAME
 * reverse-scoring direction, and stay comparable in meaning, length, and
 * difficulty — only the grammatical perspective changes.
 *
 * Single observer wording is used for all rater types (manager / peer /
 * direct report), per the 360 design (§4).
 */

export interface ObserverRewriteInput {
  /** Stable id used to map the model's output back to the source item. */
  id: string
  /** The first-person self stem to rewrite. */
  stem: string
  /** Construct name, for context so the rewrite stays on-construct. */
  constructName?: string
}

export interface ObserverVariantRaw {
  id: string
  stemObserver: string
}

/** Phrase that anchors the third-person subject. Kept generic + neutral. */
export const OBSERVER_SUBJECT = 'this leader'

export function buildObserverPerspectivePrompt(
  items: ObserverRewriteInput[],
): string {
  const list = items
    .map((it, i) => {
      const ctx = it.constructName ? ` (construct: ${it.constructName})` : ''
      return `${i + 1}. [id: ${it.id}]${ctx}\n   "${it.stem}"`
    })
    .join('\n')

  return `You are rewriting self-report psychometric items into the OBSERVER perspective for a 360-degree feedback assessment.

Each item below is written in the first person, as the person rates themselves. Rewrite each one as a third-person behavioural observation, as if a colleague (manager, peer, or direct report) is rating the person.

## Rules
- Refer to the rated person as "${OBSERVER_SUBJECT}" (third person). Do NOT use a name or "you".
- Preserve the EXACT behavioural meaning. The observer item must measure the same thing as the self item.
- Preserve the scoring direction — if the self item is negatively/reverse keyed, the observer item must be too. Do not flip polarity.
- Keep it comparable in length, register, and difficulty to the original.
- Keep it a single observable behaviour, not a compound statement.
- Do not add caveats, ratings, or scale words; just the stem.

## Items to rewrite
${list}

Return ONLY a JSON array, one object per item, preserving the given id:
[{ "id": "<the id>", "stemObserver": "This leader ..." }]`
}

/**
 * Parse the model's JSON output into validated observer variants, keyed back to
 * the requested item ids. Unknown ids and empty stems are dropped.
 */
export function parseObserverVariants(
  jsonContent: string,
  validIds: Set<string>,
): ObserverVariantRaw[] {
  const cleaned = jsonContent
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return []
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const firstArray = Object.values(parsed as Record<string, unknown>).find(
      Array.isArray,
    )
    if (firstArray) parsed = firstArray
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const out: ObserverVariantRaw[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : ''
    const stemObserver =
      typeof r.stemObserver === 'string' ? r.stemObserver.trim() : ''
    if (!id || !validIds.has(id) || seen.has(id) || stemObserver.length === 0) {
      continue
    }
    seen.add(id)
    out.push({ id, stemObserver })
  }
  return out
}
