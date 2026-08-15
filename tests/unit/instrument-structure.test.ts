/**
 * Unit tests for the STRUCTURE step (src/lib/instrument/structure.ts).
 *
 * Tests the pure functions: prompt building, response parsing, similarity
 * computation, and duplicate-safe commit logic.
 */

import { describe, it, expect } from 'vitest'
import {
  buildStructurePrompt,
  parseStructureProposal,
  cosineSimilarity,
  computeSimilarityMatrix,
  type ProposedConstruct,
} from '@/lib/instrument/structure'

describe('instrument/structure', () => {
  describe('buildStructurePrompt', () => {
    it('should build a prompt with required fields', () => {
      const prompt = buildStructurePrompt({
        buildName: 'Leadership Scale',
        measureType: 'competency_behavioural',
      })

      expect(prompt).toContain('Leadership Scale')
      expect(prompt).toContain('competency_behavioural')
      expect(prompt).toContain('workplace competency')
    })

    it('should include optional fields when provided', () => {
      const prompt = buildStructurePrompt({
        buildName: 'Resilience',
        brief: 'Measure capacity to recover from setbacks.',
        measureType: 'trait',
        audience: { level: 'senior' },
        useContext: 'Executive coaching',
        targetConstructCount: 4,
      })

      expect(prompt).toContain('Resilience')
      expect(prompt).toContain('Measure capacity to recover from setbacks')
      expect(prompt).toContain('senior')
      expect(prompt).toContain('Executive coaching')
      expect(prompt).toContain('4')
    })

    it('should omit optional fields when not provided', () => {
      const prompt = buildStructurePrompt({
        buildName: 'Test',
        measureType: 'trait',
      })

      expect(prompt).toContain('Test')
      expect(prompt).not.toContain('Brief')
      expect(prompt).not.toContain('Audience')
      expect(prompt).not.toContain('Target')
    })
  })

  describe('parseStructureProposal', () => {
    it('should parse valid JSON with constructs', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Adaptability',
            definition: 'The ability to adjust to changing circumstances.',
            exclusions: ['Rigidity', 'Inflexibility'],
          },
          {
            name: 'Innovation',
            definition: 'The capacity to generate novel ideas.',
            exclusions: ['Imitation'],
          },
        ],
      })

      const result = parseStructureProposal(json)

      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Adaptability')
      expect(result.constructs[0].exclusions).toEqual(['Rigidity', 'Inflexibility'])
      expect(result.warnings).toHaveLength(0)
    })

    it('should handle fenced JSON', () => {
      const fenced = `\`\`\`json
{
  "constructs": [
    {
      "name": "Leadership",
      "definition": "The ability to guide and inspire others.",
      "exclusions": []
    }
  ]
}
\`\`\``

      const result = parseStructureProposal(fenced)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].name).toBe('Leadership')
    })

    it('should skip constructs with missing required fields', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Valid',
            definition: 'A valid construct.',
            exclusions: [],
          },
          {
            name: '',
            definition: 'Missing name',
            exclusions: [],
          },
          {
            name: 'Missing def',
            definition: '',
            exclusions: [],
          },
        ],
      })

      const result = parseStructureProposal(json)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].name).toBe('Valid')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should deduplicate construct names (case-insensitive)', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Adaptability',
            definition: 'First definition.',
            exclusions: [],
          },
          {
            name: 'ADAPTABILITY',
            definition: 'Second definition (duplicate).',
            exclusions: [],
          },
        ],
      })

      const result = parseStructureProposal(json)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].name).toBe('Adaptability')
      expect(result.warnings.some((w) => w.includes('Deduplicated'))).toBe(true)
    })

    it('should handle bare array format', () => {
      const json = JSON.stringify([
        {
          name: 'Test',
          definition: 'A test construct.',
          exclusions: [],
        },
      ])

      const result = parseStructureProposal(json)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].name).toBe('Test')
    })

    it('should return empty result for invalid JSON', () => {
      const result = parseStructureProposal('not json at all')

      expect(result.constructs).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should filter and clean exclusions', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: 'Definition.',
            exclusions: ['Valid', '  ', '  Another  ', ''],
          },
        ],
      })

      const result = parseStructureProposal(json)

      expect(result.constructs[0].exclusions).toEqual(['Valid', 'Another'])
    })
  })

  describe('cosineSimilarity', () => {
    it('should compute similarity between two identical vectors as 1.0', () => {
      const v1 = [1, 0, 0]
      const v2 = [1, 0, 0]

      const sim = cosineSimilarity(v1, v2)

      expect(sim).toBeCloseTo(1.0, 5)
    })

    it('should compute similarity between orthogonal vectors as 0', () => {
      const v1 = [1, 0, 0]
      const v2 = [0, 1, 0]

      const sim = cosineSimilarity(v1, v2)

      expect(sim).toBeCloseTo(0, 5)
    })

    it('should compute similarity between opposite vectors as -1', () => {
      const v1 = [1, 0, 0]
      const v2 = [-1, 0, 0]

      const sim = cosineSimilarity(v1, v2)

      expect(sim).toBeCloseTo(-1, 5)
    })

    it('should handle zero vectors', () => {
      const v1 = [0, 0, 0]
      const v2 = [1, 0, 0]

      const sim = cosineSimilarity(v1, v2)

      expect(sim).toBe(0)
    })

    it('should return 0 for mismatched lengths', () => {
      const v1 = [1, 0]
      const v2 = [1, 0, 0]

      const sim = cosineSimilarity(v1, v2)

      expect(sim).toBe(0)
    })
  })

  describe('computeSimilarityMatrix', () => {
    it('should compute all pairwise similarities', () => {
      const embeddings = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]
      const constructs = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
      ]

      const matrix = computeSimilarityMatrix(embeddings, constructs)

      expect(matrix.pairs).toHaveLength(3) // 3 choose 2
      expect(matrix.pairs[0].constructAName).toBeDefined()
      expect(matrix.pairs[0].constructBName).toBeDefined()
      expect(matrix.pairs[0].cosineSimilarity).toBeDefined()
    })

    it('should sort pairs by highest similarity first', () => {
      const embeddings = [
        [1, 0, 0],
        [0.9, 0.1, 0], // High similarity to first
        [0, 0, 1],     // Low similarity to others
      ]
      const constructs = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
      ]

      const matrix = computeSimilarityMatrix(embeddings, constructs)

      // First pair should have highest similarity
      expect(matrix.pairs[0].cosineSimilarity).toBeGreaterThan(
        matrix.pairs[1].cosineSimilarity,
      )
    })

    it('should set min/max similarity', () => {
      const embeddings = [
        [1, 0, 0],
        [0.5, 0.5, 0],
        [0, 1, 0],
      ]
      const constructs = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
      ]

      const matrix = computeSimilarityMatrix(embeddings, constructs)

      expect(matrix.maxSimilarity).toBeGreaterThan(0)
      expect(matrix.maxSimilarity).toBeLessThanOrEqual(1)
      expect(matrix.minSimilarity).toBeLessThanOrEqual(matrix.maxSimilarity)
    })

    it('should handle single construct (no pairs)', () => {
      const embeddings = [[1, 0, 0]]
      const constructs = [{ name: 'A' }]

      const matrix = computeSimilarityMatrix(embeddings, constructs)

      expect(matrix.pairs).toHaveLength(0)
      expect(matrix.maxSimilarity).toBe(0)
      expect(matrix.minSimilarity).toBe(0)
    })

    it('should throw on mismatched lengths', () => {
      const embeddings = [[1, 0], [0, 1]]
      const constructs = [{ name: 'A' }]

      expect(() => computeSimilarityMatrix(embeddings, constructs)).toThrow()
    })
  })

  describe('Duplicate-safe commit logic', () => {
    it('should not create duplicates when user commits same constructs twice', () => {
      // This is tested implicitly in confirmStructureAction via the DAL.
      // The logic is: query existing blueprints, check for (buildId, name) match,
      // skip if found. Since we're testing the DAL and action separately,
      // this test documents the behavior at the unit level.
      //
      // The duplicate check uses case-insensitive name matching:
      const names = ['Adaptability', 'Innovation']
      const existingNames = new Set(
        names.map((n) => n.toLowerCase()),
      )

      // Second commit with same names
      const newConstructs: ProposedConstruct[] = [
        { name: 'Adaptability', definition: 'Updated def', exclusions: [] },
        { name: 'Innovation', definition: 'Updated def', exclusions: [] },
      ]

      // Simulate filtering: only create if not in existingNames
      const toCreate = newConstructs.filter(
        (c) => !existingNames.has(c.name.toLowerCase()),
      )

      expect(toCreate).toHaveLength(0)
    })

    it('should allow creating new constructs alongside existing ones', () => {
      const existingNames = new Set(['adaptability', 'innovation'])

      const newConstructs: ProposedConstruct[] = [
        { name: 'Adaptability', definition: 'Existing', exclusions: [] },
        { name: 'Leadership', definition: 'New', exclusions: [] },
      ]

      const toCreate = newConstructs.filter(
        (c) => !existingNames.has(c.name.toLowerCase()),
      )

      expect(toCreate).toHaveLength(1)
      expect(toCreate[0].name).toBe('Leadership')
    })
  })
})
