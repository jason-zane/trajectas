/**
 * Unit tests for library construct matching (src/lib/instrument/library-match.ts).
 *
 * Tests the semantic matching logic: exact name matches, semantic similarity,
 * confidence classification, and recommendation generation.
 */

import { describe, it, expect } from 'vitest'
import {
  matchConstructsToLibrary,
  type LibraryConstruct,
  type Embedder,
  MATCH_STRONG,
  MATCH_POSSIBLE,
  MAX_MATCHES_PER_CONSTRUCT,
  MATCH_EXACT,
  MATCH_DISPLAY_FLOOR,
} from '@/lib/instrument/library-match'

describe('instrument/library-match', () => {
  // ---------------------------------------------------------------------------
  // Fake embedder for testing (avoids network calls)
  // ---------------------------------------------------------------------------

  /**
   * Create a deterministic fake embedder for testing.
   * Maps specific text patterns to hand-crafted vectors so we can test
   * matching logic without calling the real embedder.
   */
  function createFakeEmbedder(): Embedder {
    const embedCache: Record<string, number[]> = {
      'adaptability ': [1, 0, 0, 0], // name only (no def)
      'adaptability the ability to adjust': [0.95, 0.1, 0, 0], // exact match, low-ish def similarity
      'flexibility the capacity to bend': [0.9, 0.15, 0, 0], // similar name, similar def
      'rigidity the state of being fixed': [0.1, 0.9, 0, 0], // opposite
      'innovation the capacity to generate novel ideas': [0, 0, 1, 0],
      'leadership the ability to guide and inspire': [0, 0, 0.8, 0.2],
      'creativity the ability to generate novel ideas': [0, 0, 0.9, 0.1], // very close to innovation
      'teamwork collaborative effort': [0, 0.3, 0.2, 0.8],
      'communication exchange of information': [0.1, 0.2, 0.3, 0.7],
      '': [0, 0, 0, 0], // empty
    }

    return async (texts: string[]) => {
      return texts.map((text) => {
        const normalized = text.toLowerCase()
        if (normalized in embedCache) {
          return embedCache[normalized]
        }
        // Default fallback: deterministic hash-based vector
        const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        return [
          Math.sin(hash * 0.1) * 0.5 + 0.5,
          Math.cos(hash * 0.1) * 0.5 + 0.5,
          Math.sin(hash * 0.2) * 0.5 + 0.5,
          Math.cos(hash * 0.2) * 0.5 + 0.5,
        ]
      })
    }
  }

  describe('matchConstructsToLibrary', () => {
    it('should return empty results for empty library without embedding', async () => {
      const proposed = [{ name: 'Test', definition: 'A test construct.' }]
      const library: LibraryConstruct[] = []
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results).toHaveLength(1)
      expect(results[0].proposedIndex).toBe(0)
      expect(results[0].proposedName).toBe('Test')
      expect(results[0].matches).toHaveLength(0)
      expect(results[0].recommendation).toBe('create_new')
    })

    it('should detect exact name match regardless of cosine similarity', async () => {
      const proposed = [{ name: 'Adaptability', definition: 'The ability to adjust' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Adaptability', // Exact match (case-insensitive)
          slug: 'adaptability',
          definition: 'A different definition.',
          description: null,
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results).toHaveLength(1)
      expect(results[0].matches).toHaveLength(1)
      expect(results[0].matches[0].nameExact).toBe(true)
      expect(results[0].matches[0].confidence).toBe('exact')
      expect(results[0].recommendation).toBe('reuse')
    })

    it('should surface an exact name match whose definition has drifted below the display floor', async () => {
      // The dangerous case: someone reuses a library name for a different idea. The
      // embeddings are far apart, so the display floor would hide it — but a name
      // collision with a drifted definition is precisely what an author must see.
      const proposed = [{ name: 'Resilience', definition: 'Bouncing back from setbacks.' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Resilience',
          slug: 'resilience',
          definition: 'Tolerance for sustained ambiguity in operating conditions.',
          description: null,
        },
      ]
      const orthogonal: Embedder = async (texts) =>
        texts.map((_, i) => (i === 0 ? [1, 0, 0, 0] : [0, 1, 0, 0]))

      const results = await matchConstructsToLibrary(proposed, library, orthogonal)

      expect(results[0].matches).toHaveLength(1)
      expect(results[0].matches[0].similarity).toBeLessThan(MATCH_DISPLAY_FLOOR)
      expect(results[0].matches[0].confidence).toBe('exact')
      expect(results[0].recommendation).toBe('reuse')
    })

    it('should handle case-insensitive exact name match', async () => {
      const proposed = [{ name: 'Leadership', definition: 'Leading others.' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'LEADERSHIP',
          slug: 'leadership',
          definition: 'The ability to guide and inspire.',
          description: null,
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].matches[0].nameExact).toBe(true)
      expect(results[0].matches[0].confidence).toBe('exact')
    })

    it('should detect strong semantic match with different name', async () => {
      const proposed = [{ name: 'Flexibility', definition: 'The capacity to bend' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Adaptability',
          slug: 'adaptability',
          definition: 'The ability to adjust',
          description: null,
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].matches).toHaveLength(1)
      const match = results[0].matches[0]
      expect(match.nameExact).toBe(false)
      // Should have high cosine similarity (0.9+)
      expect(match.similarity).toBeGreaterThan(0.85)
      expect(match.confidence).toBe('strong')
      expect(results[0].recommendation).toBe('reuse')
    })

    it('should classify confidence levels by similarity threshold', async () => {
      const proposed = [
        { name: 'Strong Match', definition: 'definition A' },
        { name: 'Possible Match', definition: 'definition B' },
        { name: 'Weak Match', definition: 'definition C' },
      ]

      // Create a custom embedder that maps texts to vectors with specific similarities
      // Each proposed has only one matching library item (same index)
      const customEmbedder: Embedder = async (texts) => {
        return texts.map((text) => {
          const normalized = text.toLowerCase()
          if (normalized.includes('strong match')) {
            return [1, 0, 0, 0] // proposed strong
          }
          if (normalized.includes('strong definition')) {
            return [0.9, 0.436, 0, 0] // library strong: cos sim 0.9
          }
          if (normalized.includes('possible match')) {
            return [0, 1, 0, 0] // proposed possible (orthogonal to strong)
          }
          if (normalized.includes('possible definition')) {
            return [0, 0.75, 0.661, 0] // library possible: cos sim 0.75 with proposed
          }
          if (normalized.includes('weak match')) {
            return [0, 0, 1, 0] // proposed weak (orthogonal to others)
          }
          if (normalized.includes('weak definition')) {
            return [0, 0, 0.65, 0.76] // library weak: cos sim 0.65
          }
          return [0.25, 0.25, 0.25, 0.25]
        })
      }

      const library: LibraryConstruct[] = [
        { id: '1', name: 'Strong', slug: 'strong', definition: 'definition', description: null },
        { id: '2', name: 'Possible', slug: 'possible', definition: 'definition', description: null },
        { id: '3', name: 'Weak', slug: 'weak', definition: 'definition', description: null },
      ]

      const results = await matchConstructsToLibrary(proposed, library, customEmbedder)

      // First proposed: strong match (0.9 similarity)
      expect(results[0].matches[0].confidence).toBe('strong')
      expect(results[0].recommendation).toBe('reuse')

      // Second proposed: possible match (0.75 similarity)
      expect(results[1].matches[0].confidence).toBe('possible')
      expect(results[1].recommendation).toBe('review')

      // Third proposed: nothing clears the display floor (0.65 similarity), so the
      // honest answer is an empty list rather than an irrelevant suggestion.
      expect(results[2].matches).toHaveLength(0)
      expect(results[2].recommendation).toBe('create_new')
    })

    it('should rank matches by similarity (highest first)', async () => {
      const proposed = [{ name: 'Innovation', definition: 'Generating novel ideas' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Creativity',
          slug: 'creativity',
          definition: 'the ability to generate novel ideas',
          description: null,
        },
        {
          id: '2',
          name: 'Teamwork',
          slug: 'teamwork',
          definition: 'collaborative effort',
          description: null,
        },
        {
          id: '3',
          name: 'Innovation', // Exact match
          slug: 'innovation',
          definition: 'the capacity to generate novel ideas',
          description: null,
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      // Exact name match should always come first
      expect(results[0].matches[0].nameExact).toBe(true)
      expect(results[0].matches[0].libraryConstruct.name).toBe('Innovation')

      // Then ordered by similarity
      if (results[0].matches.length > 1) {
        const sims = results[0].matches.map((m) => m.similarity)
        for (let i = 1; i < sims.length; i++) {
          expect(sims[i]).toBeLessThanOrEqual(sims[i - 1])
        }
      }
    })

    it('should cap matches at MAX_MATCHES_PER_CONSTRUCT', async () => {
      const proposed = [{ name: 'Test', definition: 'A test.' }]

      // Create a library with many similar constructs
      const library: LibraryConstruct[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        name: `Similar${i}`,
        slug: `similar-${i}`,
        definition: 'A test.',
        description: null,
      }))

      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].matches.length).toBeLessThanOrEqual(MAX_MATCHES_PER_CONSTRUCT)
    })

    it('should handle library constructs with null definition', async () => {
      const proposed = [{ name: 'Adaptability', definition: 'The ability to adjust' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Adaptability',
          slug: 'adaptability',
          definition: null, // No definition
          description: null, // No description
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].matches).toHaveLength(1)
      const match = results[0].matches[0]
      expect(match.nameExact).toBe(true)
      expect(match.definitionIncluded).toBe(false) // Flag that definition was missing
      expect(match.confidence).toBe('exact') // Name match wins regardless
    })

    it('should use description fallback when definition is null', async () => {
      const proposed = [{ name: 'Leadership', definition: 'The ability to guide' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Leadership',
          slug: 'leadership',
          definition: null,
          description: 'The ability to guide and inspire.', // Fallback
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].matches[0].definitionIncluded).toBe(true) // Description counts
    })

    it('should handle multiple proposed constructs independently', async () => {
      const proposed = [
        { name: 'Adaptability', definition: 'The ability to adjust' },
        { name: 'Innovation', definition: 'Generating novel ideas' },
        { name: 'Totally Unique', definition: 'Something completely unrelated' },
      ]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Adaptability',
          slug: 'adaptability',
          definition: 'Ability to adjust',
          description: null,
        },
        {
          id: '2',
          name: 'Innovation',
          slug: 'innovation',
          definition: 'the capacity to generate novel ideas',
          description: null,
        },
      ]

      // Custom embedder for this test to ensure truly dissimilar vector for 'Totally Unique'
      const customEmbedder: Embedder = async (texts) => {
        return texts.map((text) => {
          const normalized = text.toLowerCase()
          if (normalized.includes('adaptability')) return [1, 0, 0, 0]
          if (normalized.includes('innovation')) return [0, 0, 1, 0]
          if (normalized.includes('unique') || normalized.includes('unrelated')) return [0.1, 0.1, 0.1, 0.8]
          return [0.5, 0.5, 0.5, 0.5]
        })
      }

      const results = await matchConstructsToLibrary(proposed, library, customEmbedder)

      expect(results).toHaveLength(3)
      expect(results[0].matches.length).toBeGreaterThan(0) // Exact match
      expect(results[1].matches.length).toBeGreaterThan(0) // Exact match
      // 'Totally Unique' sits far from both library rows, so nothing clears the
      // display floor and the author is shown no suggestions at all.
      expect(results[2].matches).toHaveLength(0)
      expect(results[2].recommendation).toBe('create_new')
    })

    it('should handle whitespace in names correctly', async () => {
      const proposed = [{ name: '  Adaptability  ', definition: 'Adjusted.' }]
      const library: LibraryConstruct[] = [
        {
          id: '1',
          name: 'Adaptability',
          slug: 'adaptability',
          definition: 'Adjusted.',
          description: null,
        },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].matches[0].nameExact).toBe(true) // trim() should handle this
    })

    it('should embed all texts in one batch call for efficiency', async () => {
      const proposed = [
        { name: 'A', definition: 'def a' },
        { name: 'B', definition: 'def b' },
      ]
      const library: LibraryConstruct[] = [
        { id: '1', name: 'X', slug: 'x', definition: 'def x', description: null },
        { id: '2', name: 'Y', slug: 'y', definition: 'def y', description: null },
      ]

      let embedCallCount = 0
      const trackingEmbedder: Embedder = async (texts) => {
        embedCallCount++
        // Should only be called once
        return texts.map(() => [1, 0, 0, 0])
      }

      await matchConstructsToLibrary(proposed, library, trackingEmbedder)

      expect(embedCallCount).toBe(1) // Single batch call
    })

    it('should assign recommendation based on best match confidence', async () => {
      const embed = createFakeEmbedder()

      // Test exact → reuse
      let results = await matchConstructsToLibrary(
        [{ name: 'Adaptability', definition: 'def' }],
        [{ id: '1', name: 'Adaptability', slug: 'a', definition: 'def', description: null }],
        embed,
      )
      expect(results[0].recommendation).toBe('reuse')

      // Test strong (no exact) → reuse
      results = await matchConstructsToLibrary(
        [{ name: 'Flexibility', definition: 'The capacity to bend' }],
        [{ id: '1', name: 'Adaptability', slug: 'a', definition: 'The ability to adjust', description: null }],
        embed,
      )
      expect(results[0].recommendation).toBe('reuse')

      // Test possible → review
      // (Would need a constructed embedder for this, skipping for now)

      // Test no match → create_new
      results = await matchConstructsToLibrary(
        [{ name: 'XYZ', definition: 'xyz' }],
        [{ id: '1', name: 'ABC', slug: 'abc', definition: 'abc', description: null }],
        embed,
      )
      expect(results[0].recommendation).toBe('create_new')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty proposed array', async () => {
      const proposed: Array<{ name: string; definition: string }> = []
      const library: LibraryConstruct[] = [
        { id: '1', name: 'Test', slug: 'test', definition: 'def', description: null },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results).toHaveLength(0)
    })

    it('should handle empty proposed and library', async () => {
      const proposed: Array<{ name: string; definition: string }> = []
      const library: LibraryConstruct[] = []
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results).toHaveLength(0)
    })

    it('should handle proposed with empty name', async () => {
      const proposed = [{ name: '', definition: 'A definition.' }]
      const library: LibraryConstruct[] = [
        { id: '1', name: 'Test', slug: 'test', definition: 'def', description: null },
      ]
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      // Should still run, just match on empty text
      expect(results).toHaveLength(1)
    })

    it('should preserve proposed construct order in results', async () => {
      const proposed = [
        { name: 'Z', definition: 'last' },
        { name: 'A', definition: 'first' },
        { name: 'M', definition: 'middle' },
      ]
      const library: LibraryConstruct[] = []
      const embed = createFakeEmbedder()

      const results = await matchConstructsToLibrary(proposed, library, embed)

      expect(results[0].proposedIndex).toBe(0)
      expect(results[0].proposedName).toBe('Z')
      expect(results[1].proposedIndex).toBe(1)
      expect(results[1].proposedName).toBe('A')
      expect(results[2].proposedIndex).toBe(2)
      expect(results[2].proposedName).toBe('M')
    })
  })

  describe('Constants', () => {
    it('should export tunable thresholds', () => {
      expect(MATCH_EXACT).toBeDefined()
      expect(MATCH_STRONG).toBeDefined()
      expect(MATCH_POSSIBLE).toBeDefined()
      expect(MAX_MATCHES_PER_CONSTRUCT).toBeDefined()

      expect(MATCH_STRONG).toBe(0.8)
      expect(MATCH_POSSIBLE).toBe(0.7)
      expect(MAX_MATCHES_PER_CONSTRUCT).toBeGreaterThan(0)
    })
  })
})
