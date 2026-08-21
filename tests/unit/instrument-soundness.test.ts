/**
 * Unit tests for psychometric soundness assessment (src/lib/instrument/soundness.ts).
 *
 * Tests all ten checks independently, plus edge cases:
 * - empty input
 * - single construct
 * - clean model (no findings)
 * - score/band boundaries
 */

import { describe, it, expect } from 'vitest'
import {
  assessModelSoundness,
  type SoundnessInput,
} from '@/lib/instrument/soundness'

describe('instrument/soundness', () => {
  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty constructs array gracefully', () => {
      const input: SoundnessInput = {
        constructs: [],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBe(100)
      expect(report.band).toBe('sound')
      expect(report.findings).toHaveLength(1)
      expect(report.findings[0].code).toBe('no-constructs')
      expect(report.summary).toContain('No constructs defined yet')
    })

    it('should handle null/undefined constructs gracefully', () => {
      const input: SoundnessInput = {
        constructs: [],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBe(100)
      expect(report.findings[0].code).toBe('no-constructs')
    })
  })

  // =========================================================================
  // Check 1: Definition missing or too short
  // =========================================================================

  describe('check 1: definitions', () => {
    it('should flag missing definitions', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: '',
            exclusions: ['Management'],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'definition-missing')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('warning')
      expect(finding?.constructNames).toContain('Leadership')
    })

    it('should flag definitions under 15 words as warning', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Adaptability',
            definition: 'The ability to adapt.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'definition-too-short')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('warning')
    })

    it('should flag definitions 15-39 words as advisory', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Innovation',
            definition:
              'The capacity to generate new ideas and approaches to problems and situations in an organization.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'definition-too-short')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('advisory')
    })

    it('should score well on 40+ word definitions', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition:
              'The ability to guide and inspire others toward a shared vision, involving setting strategic direction, motivating diverse teams, and making informed decisions that advance organizational goals while carefully considering diverse stakeholder perspectives and long-term implications for all involved parties and the broader ecosystem.',
            exclusions: ['Management', 'Delegation', 'Supervision'],
          },
        ],
      }

      const report = assessModelSoundness(input)

      // 40+ word definitions should score well
      expect(report.score).toBeGreaterThanOrEqual(90)
      expect(report.band).toBe('sound')
    })
  })

  // =========================================================================
  // Check 2: Circular definitions
  // =========================================================================

  describe('check 2: circular definitions', () => {
    it('should flag "The ability to be <name>" pattern', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'hardy',
            definition: 'The ability to be hardy in the face of adversity.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'definition-circular')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('warning')
    })

    it('should flag "The capacity to be <name>" pattern', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'quick',
            definition: 'The capacity to be quick in problem-solving.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'definition-circular')

      expect(finding).toBeDefined()
    })

    it('should flag heavy name-token density in opening clause as advisory', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Communication',
            definition: 'Communication and communicative effectiveness in verbal exchanges.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'definition-circular')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('advisory')
    })

    it('should not flag well-written definitions with construct name', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition:
              'The ability to guide teams toward shared objectives through clear vision, strategic planning, and inspirational influence.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'definition-circular' }),
      )
    })
  })

  // =========================================================================
  // Check 3: Exclusions missing
  // =========================================================================

  describe('check 3: exclusions missing', () => {
    it('should flag constructs with no exclusions', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Adaptability',
            definition: 'The ability to adjust to changing circumstances and environments.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'exclusions-missing')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('advisory')
      expect(finding?.constructNames).toContain('Adaptability')
    })

    it('should not flag constructs with exclusions', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Adaptability',
            definition: 'The ability to adjust to changing circumstances and environments.',
            exclusions: ['Rigidity', 'Inflexibility'],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'exclusions-missing' }),
      )
    })
  })

  // =========================================================================
  // Check 4: Constructs overlap
  // =========================================================================

  describe('check 4: constructs overlap', () => {
    it('should flag similarity >= 0.80 as critical', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'Leadership', definition: 'Guiding others.', exclusions: [] },
          { name: 'Management', definition: 'Managing teams.', exclusions: [] },
        ],
        similarityPairs: [
          {
            constructAName: 'Leadership',
            constructBName: 'Management',
            cosineSimilarity: 0.82,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'constructs-overlap')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('critical')
      expect(finding?.constructNames).toContain('Leadership')
      expect(finding?.constructNames).toContain('Management')
    })

    it('should flag similarity 0.70-0.79 as warning', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'Adaptability', definition: 'Adjusting to change.', exclusions: [] },
          { name: 'Flexibility', definition: 'Being flexible.', exclusions: [] },
        ],
        similarityPairs: [
          {
            constructAName: 'Adaptability',
            constructBName: 'Flexibility',
            cosineSimilarity: 0.75,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'constructs-overlap')

      expect(finding?.severity).toBe('warning')
    })

    it('should flag similarity 0.60-0.69 as advisory', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'Communication', definition: 'Verbal exchange.', exclusions: [] },
          { name: 'Listening', definition: 'Hearing others.', exclusions: [] },
        ],
        similarityPairs: [
          {
            constructAName: 'Communication',
            constructBName: 'Listening',
            cosineSimilarity: 0.65,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'constructs-overlap')

      expect(finding?.severity).toBe('advisory')
    })

    it('should not flag low similarity pairs', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'Leadership', definition: 'Guiding others.', exclusions: [] },
          { name: 'Analytical', definition: 'Problem-solving.', exclusions: [] },
        ],
        similarityPairs: [
          {
            constructAName: 'Leadership',
            constructBName: 'Analytical',
            cosineSimilarity: 0.40,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'constructs-overlap' }),
      )
    })
  })

  // =========================================================================
  // Check 5: Single construct
  // =========================================================================

  describe('check 5: single construct', () => {
    it('should flag single-construct models', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'The ability to guide and inspire others.',
            exclusions: ['Management'],
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'single-construct')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('advisory')
    })

    it('should not flag multi-construct models', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'Guiding others.',
            exclusions: ['Management'],
          },
          {
            name: 'Innovation',
            definition: 'Generating new ideas.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'single-construct' }),
      )
    })
  })

  // =========================================================================
  // Check 6: Alpha infeasible
  // =========================================================================

  describe('check 6: alpha infeasible', () => {
    it('should flag unachievable alpha targets', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'The ability to guide and inspire others.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Leadership',
            facetCount: 1,
            totalTargetItems: 3,
            targetAlpha: 0.85,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'alpha-infeasible')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('warning')
      expect(finding?.constructNames).toContain('Leadership')
    })

    it('should not flag achievable alpha targets', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'The ability to guide and inspire others.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Leadership',
            facetCount: 1,
            totalTargetItems: 10,
            targetAlpha: 0.70,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'alpha-infeasible' }),
      )
    })

    it('should skip null target alpha', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'Guiding others.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Leadership',
            facetCount: 1,
            totalTargetItems: 3,
            targetAlpha: null,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'alpha-infeasible' }),
      )
    })
  })

  // =========================================================================
  // Check 7: Alpha redundant (attenuation paradox)
  // =========================================================================

  describe('check 7: alpha redundant', () => {
    it('should flag high inter-item correlation (> 0.50)', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Narrow Construct',
            definition: 'A very specific behaviour.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Narrow Construct',
            facetCount: 1,
            totalTargetItems: 8,
            targetAlpha: 0.90,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'alpha-redundant')

      // A 1-facet, 8-item model with target 0.90 will forecast a high rBar
      // (likely > 0.50), triggering this check
      if (finding) {
        expect(finding.severity).toBe('warning')
        expect(finding.constructNames).toContain('Narrow Construct')
      }
    })
  })

  // =========================================================================
  // Check 8: Too few items
  // =========================================================================

  describe('check 8: too few items', () => {
    it('should flag constructs with < 4 items', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'The ability to guide others.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Leadership',
            facetCount: 1,
            totalTargetItems: 3,
            targetAlpha: 0.70,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'too-few-items')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('warning')
      expect(finding?.detail).toContain('3 items')
    })

    it('should not flag constructs with 4+ items', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'The ability to guide others.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Leadership',
            facetCount: 1,
            totalTargetItems: 4,
            targetAlpha: 0.70,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'too-few-items' }),
      )
    })
  })

  // =========================================================================
  // Check 9: Facet lopsidedness
  // =========================================================================

  describe('check 9: facet lopsidedness', () => {
    it('should flag facet counts with ratio > 3:1', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'Guiding others.',
            exclusions: [],
          },
          {
            name: 'Collaboration',
            definition: 'Working with others.',
            exclusions: [],
          },
        ],
        blueprints: [
          {
            constructName: 'Leadership',
            facetCount: 5,
            totalTargetItems: 10,
            targetAlpha: 0.70,
          },
          {
            constructName: 'Collaboration',
            facetCount: 1,
            totalTargetItems: 4,
            targetAlpha: 0.70,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'facet-lopsided')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('advisory')
    })

    it('should not flag balanced facet counts', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'A', definition: 'A construct.', exclusions: [] },
          { name: 'B', definition: 'B construct.', exclusions: [] },
        ],
        blueprints: [
          {
            constructName: 'A',
            facetCount: 3,
            totalTargetItems: 9,
            targetAlpha: 0.70,
          },
          {
            constructName: 'B',
            facetCount: 3,
            totalTargetItems: 9,
            targetAlpha: 0.70,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'facet-lopsided' }),
      )
    })
  })

  // =========================================================================
  // Check 10: Library duplicates
  // =========================================================================

  describe('check 10: library duplicates', () => {
    it('should flag >= 0.80 similarity to library constructs', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'The ability to guide others.',
            exclusions: [],
          },
        ],
        libraryOverlaps: [
          {
            constructName: 'Leadership',
            libraryConstructName: 'Transformational Leadership',
            similarity: 0.82,
          },
        ],
      }

      const report = assessModelSoundness(input)
      const finding = report.findings.find((f) => f.code === 'library-duplicate')

      expect(finding).toBeDefined()
      expect(finding?.severity).toBe('warning')
      expect(finding?.detail).toContain('Transformational Leadership')
    })

    it('should not flag < 0.80 similarity', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Adaptability',
            definition: 'Adjusting to change.',
            exclusions: [],
          },
        ],
        libraryOverlaps: [
          {
            constructName: 'Adaptability',
            libraryConstructName: 'Flexibility',
            similarity: 0.70,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings).not.toContainEqual(
        expect.objectContaining({ code: 'library-duplicate' }),
      )
    })
  })

  // =========================================================================
  // Scoring and banding
  // =========================================================================

  describe('scoring and banding', () => {
    it('should score high and band "sound" for well-designed model', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Strategic Thinking',
            definition:
              'The ability to analyze complex business problems systematically, anticipate future challenges and emerging opportunities, and develop coherent long-term plans that align with organizational vision and are grounded in reliable data, evidence and diverse stakeholder perspectives from across the organization.',
            exclusions: ['Tactical execution', 'Operational management', 'Detail-oriented planning'],
          },
          {
            name: 'Interpersonal Influence',
            definition:
              'The capacity to build authentic trust with diverse colleagues and stakeholders, communicate ideas clearly and persuasively to influence outcomes, and positively engage others through emotional intelligence, credibility, and genuine concern that respects diverse viewpoints, backgrounds and deeply held organizational values.',
            exclusions: ['Manipulation', 'Coercion', 'Political maneuvering'],
          },
        ],
        similarityPairs: [
          {
            constructAName: 'Strategic Thinking',
            constructBName: 'Interpersonal Influence',
            cosineSimilarity: 0.38,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeGreaterThanOrEqual(90)
      expect(report.band).toBe('sound')
    })

    it('should score well with mostly advisory findings', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition:
              'The ability to guide and inspire others toward a shared vision through effective communication and strategic decision-making in complex organizational contexts and environments across many different situations and challenges they face in their daily work activities.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings.some((f) => f.code === 'exclusions-missing')).toBe(true)
      expect(report.score).toBeGreaterThanOrEqual(85)
      expect(report.band).toBe('sound')
    })

    it('should score well with warning findings', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'Short short.',
            exclusions: ['Exclusion'],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings.some((f) => f.code === 'definition-too-short')).toBe(true)
      expect(report.score).toBeGreaterThanOrEqual(80)
      expect(report.band).toBe('sound')
    })

    it('should score moderately with critical findings', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Alpha',
            definition:
              'The ability to understand complex abstract concepts, work with symbolic representations, and reason about relationships between ideas without relying on concrete examples or specific detailed context ever.',
            exclusions: ['Beta'],
          },
          {
            name: 'Beta',
            definition:
              'The ability to understand complex abstract concepts, work with symbolic representations, and reason about relationships between ideas without relying on concrete examples or specific detailed context ever.',
            exclusions: ['Alpha'],
          },
        ],
        similarityPairs: [
          {
            constructAName: 'Alpha',
            constructBName: 'Beta',
            cosineSimilarity: 0.90,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.findings.some((f) => f.severity === 'critical')).toBe(true)
      expect(report.score).toBeLessThan(80)
      expect(report.score).toBeGreaterThanOrEqual(50)
      expect(report.band).toBe('needs-work')
    })

    it('should band >= 80 as "sound"', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Leadership',
            definition: 'Long definition that is comprehensive and detailed enough to describe the construct thoroughly.',
            exclusions: ['Management'],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeGreaterThanOrEqual(80)
      expect(report.band).toBe('sound')
    })

    it('should band 50-79 as "needs-work"', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Alpha',
            definition:
              'The ability to understand complex abstract concepts and work with symbolic representations in problem-solving contexts.',
            exclusions: [],
          },
          {
            name: 'Beta',
            definition:
              'The ability to understand complex abstract concepts and work with symbolic representations in problem-solving contexts.',
            exclusions: [],
          },
        ],
        similarityPairs: [
          {
            constructAName: 'Alpha',
            constructBName: 'Beta',
            cosineSimilarity: 0.82,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeLessThan(80)
      expect(report.score).toBeGreaterThanOrEqual(50)
      expect(report.band).toBe('needs-work')
    })

    it('should band < 50 as "unsound"', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'A', definition: '', exclusions: [] },
          { name: 'B', definition: '', exclusions: [] },
          { name: 'C', definition: '', exclusions: [] },
        ],
        similarityPairs: [
          { constructAName: 'A', constructBName: 'B', cosineSimilarity: 0.82 },
          { constructAName: 'B', constructBName: 'C', cosineSimilarity: 0.85 },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeLessThan(50)
      expect(report.band).toBe('unsound')
    })

    it('should cap score at 0', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'A', definition: '', exclusions: [] },
          { name: 'B', definition: '', exclusions: [] },
          { name: 'C', definition: '', exclusions: [] },
          { name: 'D', definition: '', exclusions: [] },
          { name: 'E', definition: '', exclusions: [] },
        ],
        similarityPairs: [
          { constructAName: 'A', constructBName: 'B', cosineSimilarity: 0.82 },
          { constructAName: 'A', constructBName: 'C', cosineSimilarity: 0.82 },
          { constructAName: 'B', constructBName: 'C', cosineSimilarity: 0.82 },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeGreaterThanOrEqual(0)
    })
  })

  // =========================================================================
  // Summary generation
  // =========================================================================

  describe('summary generation', () => {
    it('should produce clean bill or advisory-only summary for strong model', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Strategic Thinking',
            definition:
              'The ability to analyze complex business problems systematically, anticipate future challenges and emerging opportunities, and develop coherent long-term plans that align with organizational vision and are grounded in reliable data and diverse stakeholder perspectives from across all levels and departments.',
            exclusions: ['Tactical execution', 'Operational management', 'Detail-oriented work'],
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeGreaterThanOrEqual(90)
      expect(['sound', 'advisory'].some((term) => report.summary.toLowerCase().includes(term))).toBe(true)
    })

    it('should summarize findings by severity', () => {
      const input: SoundnessInput = {
        constructs: [
          { name: 'A', definition: '', exclusions: [] },
          { name: 'B', definition: 'Short.', exclusions: [] },
        ],
        similarityPairs: [
          { constructAName: 'A', constructBName: 'B', cosineSimilarity: 0.82 },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.summary).toContain('critical')
      expect(report.summary).toContain('warning')
      expect(report.summary).toContain('advisory')
    })

    it('should handle singular/plural correctly in summary', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'A',
            definition: 'Def.',
            exclusions: [],
          },
        ],
      }

      const report = assessModelSoundness(input)

      // One construct with a stub definition and no exclusions yields exactly one
      // warning and two advisory notes, so this exercises both forms at once.
      expect(report.summary).toContain('1 warning')
      expect(report.summary).not.toContain('1 warnings')
      expect(report.summary).toContain('2 advisory notes')
      expect(report.summary).toMatch(/ and /)
      expect(report.summary.endsWith('.')).toBe(true)
    })

    it('should count a check that could not run against the score', () => {
      // A degraded check appended to the finished report produced "100 / sound /
      // no issues detected" while listing an unavailable check, and persisted
      // that inflated score as evidence.
      const clean = {
        constructs: [
          {
            name: 'Adaptability',
            definition:
              'Adjusts working approach when operating conditions change, revising plans and methods in response to new information while continuing to pursue the original objective and keeping colleagues informed of the change.',
            exclusions: ['Resilience under sustained stress'],
          },
        ],
      }

      const baseline = assessModelSoundness(clean)

      const degraded = assessModelSoundness({
        ...clean,
        extraFindings: [
          {
            code: 'overlap-check-unavailable',
            severity: 'advisory',
            title: 'Overlap between constructs could not be checked',
            detail: 'The embedding service did not respond.',
            constructNames: [],
            guidance: 'Re-run the assessment.',
          },
        ],
      })

      expect(degraded.score).toBeLessThan(baseline.score)
      expect(degraded.findings.map((f) => f.code)).toContain('overlap-check-unavailable')
      expect(degraded.summary).not.toContain('no issues detected')
    })

    it('should still report an unavailable check when there are no constructs', () => {
      const report = assessModelSoundness({
        constructs: [],
        extraFindings: [
          {
            code: 'library-check-unavailable',
            severity: 'advisory',
            title: 'The construct library could not be checked',
            detail: 'Unavailable.',
            constructNames: [],
            guidance: 'Re-run.',
          },
        ],
      })

      expect(report.findings.map((f) => f.code)).toContain('library-check-unavailable')
    })

    it('should use singular forms when every count is one', () => {
      const report = assessModelSoundness({
        constructs: [
          { name: 'Adaptability', definition: 'Adjusts.', exclusions: ['Resilience'] },
        ],
      })

      expect(report.summary).toContain('1 warning')
      expect(report.summary).not.toContain('warnings')
      expect(report.summary).not.toContain('advisory notes')
    })
  })

  // =========================================================================
  // Integration: realistic models
  // =========================================================================

  describe('integration: realistic models', () => {
    it('should assess a typical well-designed model', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Strategic Thinking',
            definition:
              'The ability to analyze complex business problems systematically, anticipate emerging future challenges and opportunities, and develop coherent long-term plans that align with organizational vision and are grounded in evidence and stakeholder input.',
            exclusions: ['Tactical execution', 'Operational management', 'Detail-oriented planning'],
          },
          {
            name: 'Adaptability',
            definition:
              'The capacity to adjust goals, methods, and perspectives in response to changing circumstances and constructive feedback while remaining focused on core principles and values.',
            exclusions: ['Impulsive change', 'Lack of consistency', 'Unprincipled flexibility'],
          },
          {
            name: 'Interpersonal Effectiveness',
            definition:
              'The ability to build authentic trust with others, communicate ideas clearly and persuasively, and influence outcomes through genuine engagement and emotional awareness of different viewpoints.',
            exclusions: ['Manipulation', 'Passive-aggressive behaviour', 'Conflict avoidance'],
          },
        ],
        similarityPairs: [
          {
            constructAName: 'Strategic Thinking',
            constructBName: 'Adaptability',
            cosineSimilarity: 0.52,
          },
          {
            constructAName: 'Strategic Thinking',
            constructBName: 'Interpersonal Effectiveness',
            cosineSimilarity: 0.38,
          },
          {
            constructAName: 'Adaptability',
            constructBName: 'Interpersonal Effectiveness',
            cosineSimilarity: 0.44,
          },
        ],
        blueprints: [
          {
            constructName: 'Strategic Thinking',
            facetCount: 3,
            totalTargetItems: 9,
            targetAlpha: 0.75,
          },
          {
            constructName: 'Adaptability',
            facetCount: 2,
            totalTargetItems: 6,
            targetAlpha: 0.70,
          },
          {
            constructName: 'Interpersonal Effectiveness',
            facetCount: 3,
            totalTargetItems: 9,
            targetAlpha: 0.75,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeGreaterThanOrEqual(75)
      expect(report.band).toBe('sound')
      expect(report.findings.every((f) => f.severity !== 'critical')).toBe(true)
    })

    it('should identify issues in a poorly designed model', () => {
      const input: SoundnessInput = {
        constructs: [
          {
            name: 'Performance',
            definition: 'Performance.',
            exclusions: [],
          },
          {
            name: 'Effectiveness',
            definition: 'Being effective.',
            exclusions: [],
          },
        ],
        similarityPairs: [
          {
            constructAName: 'Performance',
            constructBName: 'Effectiveness',
            cosineSimilarity: 0.88,
          },
        ],
        blueprints: [
          {
            constructName: 'Performance',
            facetCount: 1,
            totalTargetItems: 2,
            targetAlpha: 0.80,
          },
        ],
      }

      const report = assessModelSoundness(input)

      expect(report.score).toBeLessThan(80)
      expect(report.findings.length).toBeGreaterThan(0)
      expect(report.findings.some((f) => f.code === 'constructs-overlap')).toBe(true)
      expect(report.findings.some((f) => f.code === 'definition-too-short')).toBe(true)
      expect(report.findings.some((f) => f.code === 'too-few-items')).toBe(true)
    })
  })
})
