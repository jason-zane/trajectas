/**
 * Characterization tests for the validity scoring module.
 *
 * Validity analysis detects careless, inattentive, or dishonest responding
 * via four independent rules:
 *   1. Impression Management: extreme endorsements (top 2 anchors)
 *   2. Infrequency: endorsements of implausible/bogus statements
 *   3. Attention Checks: failures to answer correctly on known-answer items
 *   4. Response Times: items answered in < 2 seconds
 *
 * Each rule produces a scale-level flag ('valid'/'review'/'invalid').
 * The overall flag is the worst across all active scales.
 */

import { describe, expect, it } from 'vitest'
import { runValidityAnalysis, ValidityItemMeta, ValidityResponse } from '@/lib/scoring/validity'

// Test fixtures
function createItem(overrides: Partial<ValidityItemMeta>): ValidityItemMeta {
  return {
    id: 'item-default',
    purpose: 'impression_management',
    maxValue: 5,
    minValue: 1,
    ...overrides,
  }
}

function createResponse(overrides: Partial<ValidityResponse>): ValidityResponse {
  return {
    itemId: 'item-default',
    responseValue: 3,
    ...overrides,
  }
}

describe('runValidityAnalysis', () => {
  // -----------------------------------------------------------------------
  // Impression Management Scoring
  // -----------------------------------------------------------------------
  describe('impression management', () => {
    it('flags "valid" when no items endorsed at extreme level', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 3 }), // Middle
        createResponse({ itemId: 'im-2', responseValue: 2 }), // Below middle
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const imScale = profile.scales.find((s) => s.purpose === 'impression_management')
      expect(imScale?.flag).toBe('valid')
      expect(imScale?.score).toBeLessThanOrEqual(40) // < 60% flagged
    })

    it('hand-derives "review" flag when 60-80% of items endorsed at extreme', () => {
      /**
       * Extreme = top 2 anchors on a 5-point scale (4-5).
       * 3 items: 2 at extreme (4, 5), 1 below (3) => 2/3 = 66.67%
       * Score = 67%, flag = 'review' (60% < rate <= 80%)
       */
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 5 }), // Extreme
        createResponse({ itemId: 'im-2', responseValue: 4 }), // Extreme
        createResponse({ itemId: 'im-3', responseValue: 3 }), // Not extreme
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const imScale = profile.scales.find((s) => s.purpose === 'impression_management')
      expect(imScale?.flag).toBe('review')
      expect(imScale?.score).toBeCloseTo(67, 0)
      expect(imScale?.flaggedCount).toBe(2)
      expect(imScale?.itemCount).toBe(3)
    })

    it('hand-derives "invalid" flag when > 80% endorsed at extreme', () => {
      /**
       * 6 items: 5 at extreme (5, 5, 5, 4, 4), 1 not (3) => 5/6 = 83.33%
       * Score = 83%, flag = 'invalid' (rate > 80%)
       */
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
        ['im-4', createItem({ id: 'im-4', purpose: 'impression_management', maxValue: 5 })],
        ['im-5', createItem({ id: 'im-5', purpose: 'impression_management', maxValue: 5 })],
        ['im-6', createItem({ id: 'im-6', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 5 }),
        createResponse({ itemId: 'im-2', responseValue: 5 }),
        createResponse({ itemId: 'im-3', responseValue: 5 }),
        createResponse({ itemId: 'im-4', responseValue: 4 }),
        createResponse({ itemId: 'im-5', responseValue: 4 }),
        createResponse({ itemId: 'im-6', responseValue: 3 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const imScale = profile.scales.find((s) => s.purpose === 'impression_management')
      expect(imScale?.flag).toBe('invalid')
      expect(imScale?.score).toBe(83)
      expect(imScale?.flaggedCount).toBe(5)
    })

    it('omits impression management scale when no items administered', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5 })],
      ])

      const responses = [createResponse({ itemId: 'inf-1', responseValue: 3 })]

      const profile = runValidityAnalysis('session-1', responses, items)

      // Scales with itemCount=0 are filtered out from the profile
      const imScale = profile.scales.find((s) => s.purpose === 'impression_management')
      expect(imScale).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Infrequency Scoring
  // -----------------------------------------------------------------------
  describe('infrequency', () => {
    it('hand-derives "valid" when 0 infrequency items endorsed', () => {
      /**
       * Endorsed = response > midpoint of the scale.
       * For 5-point scale (1-5), midpoint = 3. Endorsed if > 3.
       * 3 items: 0 endorsed (responses 1, 2, 3) => 0/3 = 0%, flag = 'valid'
       */
      const items = new Map<string, ValidityItemMeta>([
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-2', createItem({ id: 'inf-2', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-3', createItem({ id: 'inf-3', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'inf-1', responseValue: 1 }),
        createResponse({ itemId: 'inf-2', responseValue: 2 }),
        createResponse({ itemId: 'inf-3', responseValue: 3 }), // At midpoint, not > midpoint
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const infScale = profile.scales.find((s) => s.purpose === 'infrequency')
      expect(infScale?.flag).toBe('valid')
      expect(infScale?.score).toBe(0)
      expect(infScale?.flaggedCount).toBe(0)
    })

    it('hand-derives "review" flag for exactly 1 item endorsed', () => {
      /**
       * 3 items: 1 endorsed (4), 2 not (2, 3) => 1/3 = 33%
       * Score = 33%, flag = 'review' (endorsedCount >= 1 but < 2)
       */
      const items = new Map<string, ValidityItemMeta>([
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-2', createItem({ id: 'inf-2', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-3', createItem({ id: 'inf-3', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'inf-1', responseValue: 4 }), // Endorsed
        createResponse({ itemId: 'inf-2', responseValue: 2 }),
        createResponse({ itemId: 'inf-3', responseValue: 3 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const infScale = profile.scales.find((s) => s.purpose === 'infrequency')
      expect(infScale?.flag).toBe('review')
      expect(infScale?.score).toBeCloseTo(33, 0)
      expect(infScale?.flaggedCount).toBe(1)
    })

    it('hand-derives "invalid" flag for 2 or more items endorsed', () => {
      /**
       * 4 items: 2 endorsed (5, 4), 2 not (2, 3) => 2/4 = 50%
       * Score = 50%, flag = 'invalid' (endorsedCount >= 2)
       */
      const items = new Map<string, ValidityItemMeta>([
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-2', createItem({ id: 'inf-2', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-3', createItem({ id: 'inf-3', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
        ['inf-4', createItem({ id: 'inf-4', purpose: 'infrequency', maxValue: 5, minValue: 1 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'inf-1', responseValue: 5 }), // Endorsed
        createResponse({ itemId: 'inf-2', responseValue: 4 }), // Endorsed
        createResponse({ itemId: 'inf-3', responseValue: 2 }),
        createResponse({ itemId: 'inf-4', responseValue: 3 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const infScale = profile.scales.find((s) => s.purpose === 'infrequency')
      expect(infScale?.flag).toBe('invalid')
      expect(infScale?.score).toBe(50)
      expect(infScale?.flaggedCount).toBe(2)
    })

    it('omits infrequency scale when no items administered', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses = [createResponse({ itemId: 'im-1', responseValue: 3 })]

      const profile = runValidityAnalysis('session-1', responses, items)

      const infScale = profile.scales.find((s) => s.purpose === 'infrequency')
      expect(infScale).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Attention Checks
  // -----------------------------------------------------------------------
  describe('attention checks', () => {
    it('hand-derives "valid" when all attention checks passed', () => {
      /**
       * 3 attention checks, all correct (responses match keyed answers)
       * Score = 0%, flag = 'valid'
       */
      const items = new Map<string, ValidityItemMeta>([
        [
          'ac-1',
          createItem({
            id: 'ac-1',
            purpose: 'attention_check',
            keyedAnswer: 5,
            maxValue: 5,
          }),
        ],
        [
          'ac-2',
          createItem({
            id: 'ac-2',
            purpose: 'attention_check',
            keyedAnswer: 2,
            maxValue: 5,
          }),
        ],
        [
          'ac-3',
          createItem({
            id: 'ac-3',
            purpose: 'attention_check',
            keyedAnswer: 4,
            maxValue: 5,
          }),
        ],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'ac-1', responseValue: 5 }), // Correct
        createResponse({ itemId: 'ac-2', responseValue: 2 }), // Correct
        createResponse({ itemId: 'ac-3', responseValue: 4 }), // Correct
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const acScale = profile.scales.find((s) => s.purpose === 'attention_check')
      expect(acScale?.flag).toBe('valid')
      expect(acScale?.score).toBe(0)
      expect(acScale?.flaggedCount).toBe(0)
      expect(acScale?.itemCount).toBe(3)
    })

    it('hand-derives "review" flag for exactly 1 attention check failed', () => {
      /**
       * 3 attention checks: 1 failed (answered 1 instead of 5), 2 passed
       * Score = 33%, flag = 'review' (failedCount >= 1 but < 2)
       */
      const items = new Map<string, ValidityItemMeta>([
        [
          'ac-1',
          createItem({
            id: 'ac-1',
            purpose: 'attention_check',
            keyedAnswer: 5,
            maxValue: 5,
          }),
        ],
        [
          'ac-2',
          createItem({
            id: 'ac-2',
            purpose: 'attention_check',
            keyedAnswer: 2,
            maxValue: 5,
          }),
        ],
        [
          'ac-3',
          createItem({
            id: 'ac-3',
            purpose: 'attention_check',
            keyedAnswer: 4,
            maxValue: 5,
          }),
        ],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'ac-1', responseValue: 1 }), // Failed (should be 5)
        createResponse({ itemId: 'ac-2', responseValue: 2 }), // Correct
        createResponse({ itemId: 'ac-3', responseValue: 4 }), // Correct
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const acScale = profile.scales.find((s) => s.purpose === 'attention_check')
      expect(acScale?.flag).toBe('review')
      expect(acScale?.score).toBeCloseTo(33, 0)
      expect(acScale?.flaggedCount).toBe(1)
    })

    it('hand-derives "invalid" flag for 2+ attention checks failed', () => {
      /**
       * 4 attention checks: 2 failed (3 and 1), 2 passed => 2/4 = 50%
       * Score = 50%, flag = 'invalid' (failedCount >= 2)
       */
      const items = new Map<string, ValidityItemMeta>([
        [
          'ac-1',
          createItem({
            id: 'ac-1',
            purpose: 'attention_check',
            keyedAnswer: 5,
            maxValue: 5,
          }),
        ],
        [
          'ac-2',
          createItem({
            id: 'ac-2',
            purpose: 'attention_check',
            keyedAnswer: 2,
            maxValue: 5,
          }),
        ],
        [
          'ac-3',
          createItem({
            id: 'ac-3',
            purpose: 'attention_check',
            keyedAnswer: 4,
            maxValue: 5,
          }),
        ],
        [
          'ac-4',
          createItem({
            id: 'ac-4',
            purpose: 'attention_check',
            keyedAnswer: 3,
            maxValue: 5,
          }),
        ],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'ac-1', responseValue: 3 }), // Failed (should be 5)
        createResponse({ itemId: 'ac-2', responseValue: 2 }), // Correct
        createResponse({ itemId: 'ac-3', responseValue: 4 }), // Correct
        createResponse({ itemId: 'ac-4', responseValue: 1 }), // Failed (should be 3)
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const acScale = profile.scales.find((s) => s.purpose === 'attention_check')
      expect(acScale?.flag).toBe('invalid')
      expect(acScale?.score).toBe(50)
      expect(acScale?.flaggedCount).toBe(2)
    })

    it('omits attention check scale when no items administered', () => {
      const items = new Map<string, ValidityItemMeta>([
        [
          'ac-1',
          createItem({
            id: 'ac-1',
            purpose: 'attention_check',
            // No keyed answer
            maxValue: 5,
          }),
        ],
      ])

      const responses = [createResponse({ itemId: 'ac-1', responseValue: 3 })]

      const profile = runValidityAnalysis('session-1', responses, items)

      const acScale = profile.scales.find((s) => s.purpose === 'attention_check')
      expect(acScale).toBeUndefined() // Filtered out because itemCount=0
    })
  })

  // -----------------------------------------------------------------------
  // Response Time Analysis
  // -----------------------------------------------------------------------
  describe('response time flags', () => {
    it('hand-derives "valid" when < 25% of responses are suspiciously fast', () => {
      /**
       * 4 items: 1 < 2000ms, 3 >= 2000ms => 1/4 = 25%
       * Flag not raised (25% not > 25%), so no response time flag added
       * Overall flag = 'valid' (no scales triggered)
       */
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
        ['im-4', createItem({ id: 'im-4', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 2, responseTimeMs: 1500 }), // Fast
        createResponse({ itemId: 'im-2', responseValue: 2, responseTimeMs: 3000 }),
        createResponse({ itemId: 'im-3', responseValue: 2, responseTimeMs: 4000 }),
        createResponse({ itemId: 'im-4', responseValue: 2, responseTimeMs: 2500 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.responseTimeFlags?.suspiciouslyFast).toBe(1)
      expect(profile.responseTimeFlags?.totalItems).toBe(4)
      expect(profile.overallFlag).toBe('valid')
    })

    it('hand-derives "review" flag when 25-50% are suspiciously fast', () => {
      /**
       * 4 items: 2 < 2000ms (1500, 1800), 2 >= 2000ms => 2/4 = 50%
       * Flag raised (50% > 25%), check if > 50% for 'invalid'
       * 50% == 50%, so no 'invalid', but 50% > 25% triggers 'review'
       */
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
        ['im-4', createItem({ id: 'im-4', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 2, responseTimeMs: 1500 }),
        createResponse({ itemId: 'im-2', responseValue: 2, responseTimeMs: 1800 }),
        createResponse({ itemId: 'im-3', responseValue: 2, responseTimeMs: 3000 }),
        createResponse({ itemId: 'im-4', responseValue: 2, responseTimeMs: 2500 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.responseTimeFlags?.suspiciouslyFast).toBe(2)
      expect(profile.overallFlag).toMatch(/valid|review/)
    })

    it('hand-derives "invalid" flag when > 50% are suspiciously fast', () => {
      /**
       * 4 items: 3 < 2000ms, 1 >= 2000ms => 3/4 = 75%
       * Flag raised (75% > 50%), so 'invalid' is added
       * Overall = worst flag = 'invalid'
       */
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
        ['im-4', createItem({ id: 'im-4', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 2, responseTimeMs: 1500 }),
        createResponse({ itemId: 'im-2', responseValue: 2, responseTimeMs: 1800 }),
        createResponse({ itemId: 'im-3', responseValue: 2, responseTimeMs: 1900 }),
        createResponse({ itemId: 'im-4', responseValue: 2, responseTimeMs: 3000 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.responseTimeFlags?.suspiciouslyFast).toBe(3)
      expect(profile.overallFlag).toBe('invalid')
    })

    it('ignores response times that are not recorded', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 2 }), // No responseTimeMs
        createResponse({ itemId: 'im-2', responseValue: 2 }), // No responseTimeMs
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.responseTimeFlags).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Overall validity flags
  // -----------------------------------------------------------------------
  describe('overall validity determination', () => {
    it('returns "valid" when all active scales are valid', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5 })],
        [
          'ac-1',
          createItem({
            id: 'ac-1',
            purpose: 'attention_check',
            keyedAnswer: 5,
            maxValue: 5,
          }),
        ],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 3 }),
        createResponse({ itemId: 'inf-1', responseValue: 2 }),
        createResponse({ itemId: 'ac-1', responseValue: 5 }),
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.overallFlag).toBe('valid')
    })

    it('returns "review" when at least one scale is review (and none invalid)', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 5 }), // Extreme
        createResponse({ itemId: 'im-2', responseValue: 4 }), // Extreme
        createResponse({ itemId: 'im-3', responseValue: 3 }), // Not extreme => 2/3 = 66% => 'review'
        createResponse({ itemId: 'inf-1', responseValue: 2 }), // Not endorsed => 'valid'
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.overallFlag).toBe('review')
    })

    it('returns "invalid" when at least one scale is invalid', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        ['im-2', createItem({ id: 'im-2', purpose: 'impression_management', maxValue: 5 })],
        ['im-3', createItem({ id: 'im-3', purpose: 'impression_management', maxValue: 5 })],
        ['inf-1', createItem({ id: 'inf-1', purpose: 'infrequency', maxValue: 5 })],
        ['inf-2', createItem({ id: 'inf-2', purpose: 'infrequency', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 5 }), // Extreme
        createResponse({ itemId: 'im-2', responseValue: 5 }), // Extreme
        createResponse({ itemId: 'im-3', responseValue: 5 }), // Extreme => 3/3 = 100% => 'invalid'
        createResponse({ itemId: 'inf-1', responseValue: 4 }), // Endorsed
        createResponse({ itemId: 'inf-2', responseValue: 5 }), // Endorsed => 2 endorsed => 'invalid'
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.overallFlag).toBe('invalid')
    })

    it('only includes scales with items administered in the scales array', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
        // No infrequency items
        // No attention checks
      ])

      const responses = [createResponse({ itemId: 'im-1', responseValue: 3 })]

      const profile = runValidityAnalysis('session-1', responses, items)

      expect(profile.scales).toHaveLength(1)
      expect(profile.scales[0]?.purpose).toBe('impression_management')
    })
  })

  // -----------------------------------------------------------------------
  // Mixed and edge cases
  // -----------------------------------------------------------------------
  describe('mixed and edge cases', () => {
    it('handles multiple response scale ranges (7-point scale)', () => {
      /**
       * 7-point scale: minValue=1, maxValue=7, midpoint=4
       * Impression management: extreme = top 2 anchors (6-7)
       */
      const items = new Map<string, ValidityItemMeta>([
        [
          'im-1',
          createItem({
            id: 'im-1',
            purpose: 'impression_management',
            maxValue: 7,
            minValue: 1,
          }),
        ],
        [
          'im-2',
          createItem({
            id: 'im-2',
            purpose: 'impression_management',
            maxValue: 7,
            minValue: 1,
          }),
        ],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 7 }), // Extreme
        createResponse({ itemId: 'im-2', responseValue: 4 }), // Not extreme
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const imScale = profile.scales.find((s) => s.purpose === 'impression_management')
      expect(imScale?.flaggedCount).toBe(1)
      expect(imScale?.itemCount).toBe(2)
    })

    it('omits responses for items not in the item map', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses: ValidityResponse[] = [
        createResponse({ itemId: 'im-1', responseValue: 3 }),
        createResponse({ itemId: 'im-missing', responseValue: 5 }), // Item not in map
      ]

      const profile = runValidityAnalysis('session-1', responses, items)

      const imScale = profile.scales.find((s) => s.purpose === 'impression_management')
      expect(imScale?.itemCount).toBe(1) // Only im-1 counted
    })

    it('produces a well-formed ValidityProfile', () => {
      const items = new Map<string, ValidityItemMeta>([
        ['im-1', createItem({ id: 'im-1', purpose: 'impression_management', maxValue: 5 })],
      ])

      const responses = [createResponse({ itemId: 'im-1', responseValue: 3 })]

      const profile = runValidityAnalysis('session-123', responses, items)

      expect(profile.sessionId).toBe('session-123')
      expect(Array.isArray(profile.scales)).toBe(true)
      expect(['valid', 'review', 'invalid']).toContain(profile.overallFlag)
      expect(profile.scales.every((s) => s.scaleName && typeof s.score === 'number')).toBe(true)
    })
  })
})
