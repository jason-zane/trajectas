/**
 * Unit tests for instrument/model-parser.ts
 *
 * Tests deterministic parsing of user-pasted measurement models
 * across JSON, YAML, Markdown, CSV, TSV, and delimited formats.
 */

import { describe, it, expect } from 'vitest'
import { parseModelText } from '@/lib/instrument/model-parser'

describe('instrument/model-parser', () => {
  describe('JSON format', () => {
    it('should parse valid JSON with constructs array', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Adaptability',
            definition: 'Adjusts approach when conditions change.',
            exclusions: ['Rigidity'],
          },
          {
            name: 'Innovation',
            definition: 'Generates novel ideas.',
            exclusions: [],
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.format).toBe('json')
      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Adaptability')
      expect(result.constructs[1].name).toBe('Innovation')
    })

    it('should parse bare JSON array', () => {
      const json = JSON.stringify([
        {
          name: 'Leadership',
          definition: 'Guides and influences others.',
          exclusions: ['Followership'],
        },
      ])

      const result = parseModelText(json)

      expect(result.format).toBe('json')
      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].name).toBe('Leadership')
    })

    it('should accept flexible key names for JSON', () => {
      const json = JSON.stringify({
        constructs: [
          {
            construct: 'Communication',
            description: 'Exchanges ideas effectively',
            excludes: 'Writing only',
          },
          {
            title: 'Empathy',
            def: 'Understands others\' feelings',
            not: ['Sympathy', 'Pity'],
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.format).toBe('json')
      expect(result.constructs[0].name).toBe('Communication')
      expect(result.constructs[0].definition).toBe('Exchanges ideas effectively')
      expect(result.constructs[1].name).toBe('Empathy')
      expect(result.constructs[1].exclusions).toContain('Sympathy')
    })

    it('should normalize exclusions string to array', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Focus',
            definition: 'Maintains concentration.',
            exclusions: 'Distraction; Wandering; Daydreaming',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].exclusions).toEqual(['Distraction', 'Wandering', 'Daydreaming'])
    })

    it('should handle JSON with name-only constructs', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Resilience',
          },
          {
            name: 'Collaboration',
            definition: 'Works effectively with others.',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].definition).toBe('')
      expect(result.warnings.some((w) => w.includes('no definition'))).toBe(true)
    })

    it('should skip JSON items missing name', () => {
      const json = JSON.stringify({
        constructs: [
          {
            definition: 'Has no name',
          },
          {
            name: 'Valid',
            definition: 'Has a name.',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].name).toBe('Valid')
    })
  })

  describe('YAML-like format', () => {
    it('should parse basic YAML list', () => {
      const yaml = `- name: Strategic Thinking
  definition: Thinks long-term and anticipates consequences.
  exclusions:
    - Tactical focus
    - Short-term planning
- name: Influence
  definition: Persuades and motivates others.
  exclusions: []`

      const result = parseModelText(yaml)

      expect(result.format).toBe('yaml')
      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Strategic Thinking')
      expect(result.constructs[0].exclusions).toContain('Tactical focus')
    })

    it('should handle 4-space indentation', () => {
      const yaml = `- name: Creativity
    definition: Generates original solutions
    exclusions:
        - Imitation
        - Copying`

      const result = parseModelText(yaml)

      expect(result.format).toBe('yaml')
      expect(result.constructs[0].name).toBe('Creativity')
      expect(result.constructs[0].exclusions.length).toBeGreaterThan(0)
    })

    it('should parse YAML with block scalar >', () => {
      const yaml = `- name: Self-Awareness
  definition: >
    Recognizes own strengths and weaknesses, seeks feedback,
    and reflects on impact. Continuously learns from experience.
  exclusions: []`

      const result = parseModelText(yaml)

      expect(result.format).toBe('yaml')
      expect(result.constructs[0].definition).toContain('Recognizes')
      expect(result.constructs[0].definition).toContain('feedback')
      // toContain alone passed even while the block scalar was swallowing the
      // sibling key, so assert the definition ENDS where the block ends.
      expect(result.constructs[0].definition).not.toContain('exclusions')
    })

    it('should end a block scalar at the next sibling key, not the next list item', () => {
      const yaml = `- name: Adaptability
  definition: >
    Adjusts approach when conditions change.
  exclusions:
    - Resilience under sustained stress
- name: Curiosity
  definition: |
    Seeks out new information unprompted.
  exclusions:
    - Diligence`

      const result = parseModelText(yaml)

      expect(result.format).toBe('yaml')
      expect(result.constructs).toHaveLength(2)

      expect(result.constructs[0].definition).toBe('Adjusts approach when conditions change.')
      expect(result.constructs[0].exclusions).toEqual(['Resilience under sustained stress'])

      expect(result.constructs[1].definition).toBe('Seeks out new information unprompted.')
      expect(result.constructs[1].exclusions).toEqual(['Diligence'])
    })

    it('should parse YAML with block scalar |', () => {
      const yaml = `- name: Decision-Making
  definition: |
    Makes sound choices under pressure.
    Balances data and intuition effectively.
  exclusions: []`

      const result = parseModelText(yaml)

      expect(result.format).toBe('yaml')
      expect(result.constructs[0].definition).toContain('pressure')
      expect(result.constructs[0].definition).not.toContain('exclusions')
    })
  })

  describe('Markdown format', () => {
    it('should parse numbered list', () => {
      const markdown = `1. Teamwork: Works collaboratively toward shared goals
2. Accountability: Takes ownership of outcomes
3. Innovation: Generates novel approaches to problems`

      const result = parseModelText(markdown)

      expect(result.format).toBe('markdown-list')
      expect(result.constructs).toHaveLength(3)
      expect(result.constructs[0].name).toBe('Teamwork')
      expect(result.constructs[0].definition).toBe('Works collaboratively toward shared goals')
    })

    it('should parse bullet list', () => {
      const markdown = `- Integrity: Maintains honest and ethical behavior
* Humility: Acknowledges limitations and mistakes
- Growth Mindset: Embraces learning and development`

      const result = parseModelText(markdown)

      expect(result.format).toBe('markdown-list')
      expect(result.constructs).toHaveLength(3)
      expect(result.constructs[0].name).toBe('Integrity')
    })

    it('should parse markdown headers with paragraphs', () => {
      const markdown = `## Leadership

Guides and influences others toward a shared vision. Inspires action
and builds trust within teams.

## Execution

Delivers results consistently and on time. Follows through on commitments
and maintains high standards.`

      const result = parseModelText(markdown)

      expect(result.format).toBe('markdown-list')
      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Leadership')
      expect(result.constructs[0].definition).toContain('vision')
    })

    it('should strip markdown emphasis from names', () => {
      const markdown = `1. **Communication** — Exchanges ideas clearly
2. *Empathy* — Understands others' feelings
3. __Resilience__ — Bounces back from setbacks
4. \`Precision\` — Attention to detail`

      const result = parseModelText(markdown)

      expect(result.constructs[0].name).toBe('Communication')
      expect(result.constructs[1].name).toBe('Empathy')
      expect(result.constructs[2].name).toBe('Resilience')
      expect(result.constructs[3].name).toBe('Precision')
    })

    it('should handle em-dash separator in markdown', () => {
      const markdown = `1. Agility — Adapts quickly to change
2. Focus — Maintains concentration on priorities`

      const result = parseModelText(markdown)

      expect(result.constructs[0].name).toBe('Agility')
      expect(result.constructs[0].definition).toBe('Adapts quickly to change')
    })

    it('should parse mixed markdown emphasis', () => {
      const markdown = `- **Strategic _Thinking_**: Long-term perspective
- *~~Tactical~~ Planning*: Anticipates obstacles`

      const result = parseModelText(markdown)

      expect(result.constructs[0].name).toBe('Strategic Thinking')
      expect(result.constructs[1].name).toBe('Planning')
    })
  })

  describe('Delimited format', () => {
    it('should not let a comma inside a definition hijack the parse as CSV', () => {
      // Definitions almost always contain a comma. Routing on the bare presence
      // of one sent this down the CSV path, so the entire line became the
      // construct name and the definition was silently lost.
      const pasted = `Adaptability: Adjusts approach when operating conditions change, without losing sight of the objective.
Stress Tolerance: Maintains judgement and composure when workload or ambiguity rises sharply.`

      const result = parseModelText(pasted)

      expect(result.format).toBe('delimited')
      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Adaptability')
      expect(result.constructs[0].definition).toBe(
        'Adjusts approach when operating conditions change, without losing sight of the objective.'
      )
      expect(result.constructs[1].name).toBe('Stress Tolerance')
      expect(result.constructs[1].definition).toContain('composure')
    })

    it('should still treat a genuine CSV export as CSV', () => {
      const csv = `name,definition,exclusions
Adaptability,"Adjusts approach when conditions change, without drifting.",Resilience
Curiosity,"Seeks new information unprompted.",Diligence`

      const result = parseModelText(csv)

      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Adaptability')
      expect(result.constructs[0].definition).toBe(
        'Adjusts approach when conditions change, without drifting.'
      )
    })

    it('should parse colon-separated', () => {
      const delimited = `Vision: Sees long-term possibilities and sets direction
Execution: Delivers results on time and on budget
Collaboration: Works effectively with others`

      const result = parseModelText(delimited)

      expect(result.format).toBe('delimited')
      expect(result.constructs).toHaveLength(3)
      expect(result.constructs[0].name).toBe('Vision')
      expect(result.constructs[0].definition).toBe('Sees long-term possibilities and sets direction')
    })

    it('should parse em-dash separated', () => {
      const delimited = `Trust — Builds confidence through reliability
Respect — Values diverse perspectives
Honesty — Communicates truthfully`

      const result = parseModelText(delimited)

      expect(result.format).toBe('delimited')
      expect(result.constructs).toHaveLength(3)
      expect(result.constructs[0].name).toBe('Trust')
      expect(result.constructs[0].definition).toBe('Builds confidence through reliability')
    })

    it('should parse pipe-separated', () => {
      const delimited = `Clarity | Expresses ideas in understandable terms
Speed | Acts decisively and quickly
Quality | Maintains high standards consistently`

      const result = parseModelText(delimited)

      expect(result.format).toBe('delimited')
      expect(result.constructs).toHaveLength(3)
      expect(result.constructs[0].name).toBe('Clarity')
    })

    it('should parse CSV format', () => {
      const csv = `name,definition,exclusions
Communication,Exchanges ideas clearly,Silence
Empathy,Understands feelings,"Sympathy, Pity"
Precision,Attention to detail,Sloppiness`

      const result = parseModelText(csv)

      expect(result.format).toBe('delimited')
      expect(result.constructs).toHaveLength(3)
      expect(result.constructs[1].exclusions).toContain('Sympathy')
      expect(result.constructs[1].exclusions).toContain('Pity')
    })

    it('should handle CSV with quoted commas', () => {
      const csv = `Leadership,"Guides others, inspires action, builds trust","Followership, Dependency"`

      const result = parseModelText(csv)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].definition).toContain('inspires action')
      expect(result.constructs[0].exclusions).toContain('Dependency')
    })

    it('should parse TSV format', () => {
      const tsv = `Agility\tAdapts to change quickly\tRigidity
Focus\tMaintains concentration\tDistraction`

      const result = parseModelText(tsv)

      expect(result.format).toBe('delimited')
      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].name).toBe('Agility')
      expect(result.constructs[0].exclusions[0]).toBe('Rigidity')
    })
  })

  describe('Deduplication', () => {
    it('should deduplicate case-insensitive names', () => {
      const json = JSON.stringify({
        constructs: [
          { name: 'Leadership', definition: 'First definition' },
          { name: 'LEADERSHIP', definition: 'Second definition' },
          { name: 'leadership', definition: 'Third definition' },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs).toHaveLength(1)
      expect(result.constructs[0].definition).toBe('First definition')
      expect(result.warnings.some((w) => w.includes('Duplicate'))).toBe(true)
    })

    it('should warn about duplicates', () => {
      const markdown = `1. Focus
2. Focus
3. Concentration`

      const result = parseModelText(markdown)

      expect(result.constructs).toHaveLength(2)
      expect(result.warnings.some((w) => w.includes('Duplicate'))).toBe(true)
    })
  })

  describe('Whitespace and punctuation', () => {
    it('should trim and collapse internal whitespace in definitions', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: '  Multiple   spaces   and\n\n    newlines  \t  here  ',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].definition).toBe('Multiple spaces and newlines here')
    })

    it('should preserve trailing punctuation in definitions', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test1',
            definition: 'A definition.',
          },
          {
            name: 'Test2',
            definition: 'Another definition!?',
          },
          {
            name: 'Test3',
            definition: 'No punctuation',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].definition).toBe('A definition.')
      expect(result.constructs[1].definition).toBe('Another definition!?')
      expect(result.constructs[2].definition).toBe('No punctuation')
    })

    it('should trim names', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: '  Leadership  ',
            definition: 'Definition',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].name).toBe('Leadership')
    })
  })

  describe('Cap at 40 constructs', () => {
    it('should cap at 40 constructs and warn', () => {
      const constructs = Array.from({ length: 50 }, (_, i) => ({
        name: `Construct${i}`,
        definition: `Definition ${i}`,
        exclusions: [],
      }))
      const json = JSON.stringify({ constructs })

      const result = parseModelText(json)

      expect(result.constructs).toHaveLength(40)
      expect(result.warnings.some((w) => w.includes('capping at 40'))).toBe(true)
    })
  })

  describe('Name-only constructs', () => {
    it('should accept constructs with name but no definition', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Teamwork',
          },
          {
            name: 'Leadership',
            definition: 'Guides others.',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs).toHaveLength(2)
      expect(result.constructs[0].definition).toBe('')
      expect(result.warnings.some((w) => w.includes('no definition'))).toBe(true)
    })
  })

  describe('Empty and unparseable input', () => {
    it('should return empty for empty string', () => {
      const result = parseModelText('')

      expect(result.format).toBe('none')
      expect(result.constructs).toHaveLength(0)
      expect(result.warnings.some((w) => w.includes('empty'))).toBe(true)
    })

    it('should return empty for whitespace-only input', () => {
      const result = parseModelText('   \n  \t  ')

      expect(result.format).toBe('none')
      expect(result.constructs).toHaveLength(0)
    })

    it('should return format none for pure prose', () => {
      const prose = `This is just some regular text that does not follow any of the expected
formats. It has no structure, no list markers, no JSON brackets, nothing
that the parser can recognize as a measurement model.`

      const result = parseModelText(prose)

      expect(result.format).toBe('none')
      expect(result.constructs).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should include helpful message for unparseable format', () => {
      const result = parseModelText('random text that means nothing')

      expect(result.format).toBe('none')
      expect(result.warnings.some((w) => w.includes('JSON') && w.includes('YAML'))).toBe(true)
      expect(result.unparsedLines.length).toBeGreaterThan(0)
    })
  })

  describe('Real-world messy input', () => {
    it('should parse messy real-world paste', () => {
      const messy = `
# Our Competency Model

## Strategic Thinking
Anticipates future states and plans accordingly.

### Key behaviors:
- Scans the horizon
- Connects dots
- Challenges assumptions

## Communication
*Exchanges ideas clearly* and *listens actively*.

Barriers: Hoarding info; Poor listening

1. Adaptability — Adjusts when things change
2. Execution — Delivers results consistently

name: Integrity
definition: Maintains ethical standards
exclusions: Hypocrisy
`

      const result = parseModelText(messy)

      // Should recognize at least some format (likely markdown)
      expect(result.format).not.toBe('none')
      expect(result.constructs.length).toBeGreaterThan(0)
    })

    it('should handle mixed indentation and blank lines', () => {
      const yaml = `- name: Quality
  definition: >
    Maintains high standards in work output.
    Attention to detail and consistency.

  exclusions:
    - Mediocrity


- name: Innovation
  definition: Generates novel approaches
  exclusions: []`

      const result = parseModelText(yaml)

      expect(result.format).toBe('yaml')
      expect(result.constructs.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Exclusions handling', () => {
    it('should split exclusions on semicolon', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: 'Def',
            exclusions: 'Item1; Item2; Item3',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].exclusions).toEqual(['Item1', 'Item2', 'Item3'])
    })

    it('should split exclusions on newline', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: 'Def',
            exclusions: 'Item1\nItem2\nItem3',
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].exclusions).toEqual(['Item1', 'Item2', 'Item3'])
    })

    it('should handle empty exclusions array', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: 'Def',
            exclusions: [],
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].exclusions).toEqual([])
    })

    it('should trim exclusion items', () => {
      const json = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: 'Def',
            exclusions: ['  Item 1  ', '  Item 2  '],
          },
        ],
      })

      const result = parseModelText(json)

      expect(result.constructs[0].exclusions).toEqual(['Item 1', 'Item 2'])
    })
  })

  describe('Format precedence', () => {
    it('should prefer JSON over markdown even if both could parse', () => {
      const ambiguous = JSON.stringify({
        constructs: [
          {
            name: 'Test',
            definition: '- Should not be parsed as markdown item',
          },
        ],
      })

      const result = parseModelText(ambiguous)

      expect(result.format).toBe('json')
      expect(result.constructs[0].definition).toBe('- Should not be parsed as markdown item')
    })
  })

  describe('Warnings', () => {
    it('should accumulate warnings', () => {
      const json = JSON.stringify({
        constructs: [
          { name: 'Test1', definition: 'Definition 1' },
          { name: 'Test1', definition: 'Duplicate!' },
          { name: 'Test2' },
        ],
      })

      const result = parseModelText(json)

      expect(result.warnings.length).toBeGreaterThanOrEqual(2)
      expect(result.warnings.some((w) => w.includes('Duplicate'))).toBe(true)
      expect(result.warnings.some((w) => w.includes('no definition'))).toBe(true)
    })
  })
})
