/**
 * library-match.ts — semantic matching of proposed constructs against the construct library.
 *
 * This module prevents construct library pollution by detecting when a proposed construct
 * is semantically similar to an existing one. It uses embedding-based cosine similarity
 * to identify near-duplicates ('Adaptability' vs 'Flexibility') and exact name matches.
 *
 * Embedder is injected to keep the core logic pure and testable; the convenience
 * wrapper handles the real embedder for UI/API use.
 *
 * @module
 */

import { cosineSimilarity } from './structure'

/**
 * Construct from the existing library.
 * All fields are optional at ingestion time; null definition + null description
 * means the match is weaker (name-only comparison).
 */
export interface LibraryConstruct {
  id: string
  name: string
  slug: string
  definition: string | null
  description: string | null
  factorCount?: number
  itemCount?: number
}

/**
 * A single match result between a proposed construct and a library construct.
 * Ranked by similarity within its ConstructMatchResult.
 */
export interface LibraryMatch {
  libraryConstruct: LibraryConstruct
  similarity: number // cosine, 0..1
  nameExact: boolean // case-insensitive trimmed name equality
  definitionIncluded: boolean // true if the library construct had a definition to compare
  confidence: 'exact' | 'strong' | 'possible' | 'weak'
}

/**
 * Result for one proposed construct: its best matches and recommendation.
 */
export interface ConstructMatchResult {
  proposedIndex: number
  proposedName: string
  matches: LibraryMatch[] // ranked desc by similarity, capped at MAX_MATCHES_PER_CONSTRUCT
  recommendation: 'reuse' | 'review' | 'create_new'
}

/**
 * Function type for embedding a list of texts.
 * Takes a batch of strings, returns an array of embedding vectors (same length as input).
 */
export type Embedder = (texts: string[]) => Promise<number[][]>

// ---------------------------------------------------------------------------
// Tunable thresholds (exported for testability)
// ---------------------------------------------------------------------------

/** Exact name match always wins regardless of cosine similarity. */
export const MATCH_EXACT = 0.99

/** Similarity >= 0.80 → confidence 'strong' → recommendation 'reuse' */
export const MATCH_STRONG = 0.80

/** Similarity 0.70–0.79 → confidence 'possible' → recommendation 'review' */
export const MATCH_POSSIBLE = 0.70

/**
 * Display floor. A candidate below this is not shown at all.
 *
 * Without a floor every proposed construct comes back with MAX_MATCHES_PER_CONSTRUCT
 * entries no matter how unrelated they are, so a genuinely novel construct renders a
 * list of five irrelevant suggestions. An empty match list is the honest answer, and
 * the recommendation is 'create_new' either way.
 *
 * An exact name match bypasses this floor — same name with a drifted definition is a
 * signal the author must see, however far apart the embeddings sit.
 */
export const MATCH_DISPLAY_FLOOR = MATCH_POSSIBLE

/** Maximum matches to return per proposed construct. */
export const MAX_MATCHES_PER_CONSTRUCT = 5

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Match a set of proposed constructs against the library using embeddings.
 *
 * Strategy:
 * 1. If library is empty, return all 'create_new' with no embed call.
 * 2. Concatenate 'name + " " + definition' for each side (proposed and library).
 *    - If definition is empty/null, use name alone.
 *    - This ensures name-only constructs still match on name.
 * 3. Embed all texts in one batch call (cost efficiency).
 * 4. For each proposed construct, compute cosine similarity against all library constructs.
 * 5. Exact name match (case-insensitive) always floats to top with 'exact' confidence.
 * 6. Rank remaining matches by similarity; cap at MAX_MATCHES_PER_CONSTRUCT.
 * 7. Assign recommendation based on best match confidence.
 *
 * @param proposed — array of { name, definition } to match
 * @param library — array of existing LibraryConstructs
 * @param embed — function that embeds texts and returns vectors
 * @returns array of ConstructMatchResult, one per proposed construct
 */
export async function matchConstructsToLibrary(
  proposed: Array<{ name: string; definition: string }>,
  library: LibraryConstruct[],
  embed: Embedder,
): Promise<ConstructMatchResult[]> {
  // Empty library fast path: no embed call needed
  if (library.length === 0) {
    return proposed.map((p, idx) => ({
      proposedIndex: idx,
      proposedName: p.name,
      matches: [],
      recommendation: 'create_new',
    }))
  }

  // Build text representations for embedding
  const proposedTexts = proposed.map((p) => buildEmbeddingText(p.name, p.definition))
  const libraryTexts = library.map((lib) =>
    buildEmbeddingText(lib.name, lib.definition || lib.description || null),
  )

  // Single batch embed call for efficiency
  const allTexts = [...proposedTexts, ...libraryTexts]
  const allEmbeddings = await embed(allTexts)

  // Slice embeddings
  const proposedEmbeddings = allEmbeddings.slice(0, proposed.length)
  const libraryEmbeddings = allEmbeddings.slice(proposed.length)

  // Compute matches for each proposed construct
  const results: ConstructMatchResult[] = []

  for (let pIdx = 0; pIdx < proposed.length; pIdx++) {
    const p = proposed[pIdx]
    const pEmbed = proposedEmbeddings[pIdx]

    // Compute similarity to all library constructs
    const matchCandidates: LibraryMatch[] = []

    for (let lIdx = 0; lIdx < library.length; lIdx++) {
      const lib = library[lIdx]
      const lEmbed = libraryEmbeddings[lIdx]

      const similarity = cosineSimilarity(pEmbed, lEmbed)
      const nameExact = p.name.trim().toLowerCase() === lib.name.trim().toLowerCase()
      const definitionIncluded = lib.definition !== null || lib.description !== null

      // Exact name match always gets 'exact' confidence, even if cosine is low
      let confidence: 'exact' | 'strong' | 'possible' | 'weak'
      if (nameExact) {
        confidence = 'exact'
      } else if (similarity >= MATCH_STRONG) {
        confidence = 'strong'
      } else if (similarity >= MATCH_POSSIBLE) {
        confidence = 'possible'
      } else {
        confidence = 'weak'
      }

      matchCandidates.push({
        libraryConstruct: lib,
        similarity,
        nameExact,
        definitionIncluded,
        confidence,
      })
    }

    // Sort: exact names first, then by descending similarity
    matchCandidates.sort((a, b) => {
      if (a.nameExact && !b.nameExact) return -1
      if (!a.nameExact && b.nameExact) return 1
      return b.similarity - a.similarity
    })

    // Drop noise below the display floor, then cap.
    const matches = matchCandidates
      .filter((m) => m.nameExact || m.similarity >= MATCH_DISPLAY_FLOOR)
      .slice(0, MAX_MATCHES_PER_CONSTRUCT)

    // Recommendation: take confidence of best match
    const recommendation =
      matches.length === 0
        ? 'create_new'
        : matches[0].confidence === 'exact'
          ? 'reuse'
          : matches[0].confidence === 'strong'
            ? 'reuse'
            : matches[0].confidence === 'possible'
              ? 'review'
              : 'create_new'

    results.push({
      proposedIndex: pIdx,
      proposedName: p.name,
      matches,
      recommendation,
    })
  }

  return results
}

/**
 * Convenience wrapper that uses the real embedder from @/lib/ai/generation/embeddings.
 *
 * This is kept separate from the core function so tests can inject a fake embedder
 * and avoid network calls.
 */
export async function matchConstructsToLibraryWithDefaultEmbedder(
  proposed: Array<{ name: string; definition: string }>,
  library: LibraryConstruct[],
): Promise<ConstructMatchResult[]> {
  // Dynamic import to avoid top-level network dependency
  const { embedTexts } = await import('@/lib/ai/generation/embeddings')

  return matchConstructsToLibrary(proposed, library, embedTexts)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the text representation for embedding.
 * If definition is present, concatenate name + " " + definition.
 * If definition is absent, use name alone.
 */
function buildEmbeddingText(name: string, definition: string | null): string {
  const cleanName = (name || '').trim()
  const cleanDef = (definition || '').trim()

  if (cleanDef) {
    return `${cleanName} ${cleanDef}`
  }
  return cleanName
}
