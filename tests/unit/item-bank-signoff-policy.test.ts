/**
 * Pins the UI's advisory sign-off policy to the database guard it mirrors.
 *
 * `src/app/(dashboard)/item-bank/signoff-policy.ts` holds the one fact the
 * review UI needs before it attempts a write: which target states require which
 * sign-offs. The enforcer is `items_review_signoff_guard()` in migration
 * 20260814110000 — but #347 also requires that a reviewer sees the gate coming
 * rather than discovering it as a failed transition, and the database exposes
 * no function reporting that precondition.
 *
 * So the fact is mirrored, and this test parses the migration to make the
 * mirror non-optional: change the guard without changing the UI and CI fails
 * here, naming the drift.
 *
 * (The lifecycle TRANSITION GRAPH is a different thing and is NOT mirrored
 * anywhere — it is read at runtime from `item_lifecycle_legal_transitions()`.)
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STATES_REQUIRING_CONTENT_SIGNOFF,
  STATES_REQUIRING_FAIRNESS_SIGNOFF,
  signOffBlockers,
  signOffsRequiredFor,
} from '@/app/(dashboard)/item-bank/signoff-policy'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MIGRATION = join(
  ROOT,
  'supabase',
  'migrations',
  '20260814110000_item_bank_review_signoffs.sql',
)

function guardBody(): string {
  const sql = readFileSync(MIGRATION, 'utf8')
  const start = sql.indexOf('FUNCTION public.items_review_signoff_guard()')
  expect(start, 'items_review_signoff_guard() not found in the migration').toBeGreaterThan(-1)
  // Stop at the trigger that installs it — everything between is the body.
  const end = sql.indexOf('CREATE TRIGGER items_review_signoff_guard_trg', start)
  expect(end, 'guard trigger not found after the function').toBeGreaterThan(start)
  return sql.slice(start, end)
}

/** States in the `NEW.lifecycle_state IN (...)` branch — those needing both. */
function statesNeedingBoth(body: string): string[] {
  const match = body.match(/NEW\.lifecycle_state\s+IN\s*\(([^)]*)\)/i)
  expect(match, 'could not find the combined-requirement branch').not.toBeNull()
  return [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

/** The single state in the content-only branch. */
function stateNeedingContentOnly(body: string): string {
  const match = body.match(/NEW\.lifecycle_state\s*=\s*'([a-z_]+)'/i)
  expect(match, 'could not find the content-only branch').not.toBeNull()
  return match![1]
}

describe('item bank sign-off policy mirrors the database guard', () => {
  it('the migration exists and the guard is still shaped the way this test parses it', () => {
    expect(existsSync(MIGRATION), `${MIGRATION} is missing`).toBe(true)
    const body = guardBody()
    // Non-vacuity: the parses below must find real content.
    expect(body).toContain("v_needed := ARRAY['content']")
    expect(body).toContain("v_needed := ARRAY['content', 'fairness']")
  })

  it('fairness is required by exactly the states the guard lists', () => {
    const fromMigration = statesNeedingBoth(guardBody())

    expect(fromMigration.length).toBeGreaterThan(0)
    expect([...STATES_REQUIRING_FAIRNESS_SIGNOFF].sort()).toEqual([...fromMigration].sort())
  })

  it('content is required by the content-only state plus every both-sign-offs state', () => {
    const body = guardBody()
    const expected = new Set([stateNeedingContentOnly(body), ...statesNeedingBoth(body)])

    expect([...STATES_REQUIRING_CONTENT_SIGNOFF].sort()).toEqual([...expected].sort())
  })

  it('operational requires both sign-offs — #347s headline acceptance criterion', () => {
    expect(signOffsRequiredFor('operational')).toEqual(['content', 'fairness'])
  })

  it('content_reviewed requires content only', () => {
    expect(signOffsRequiredFor('content_reviewed')).toEqual(['content'])
  })

  it('states the guard exempts require nothing', () => {
    // The guard's `ELSE RETURN NEW` branch: draft / suspended / retired / killed.
    for (const state of ['draft', 'suspended', 'retired', 'killed']) {
      expect(signOffsRequiredFor(state), `${state} should be ungated`).toEqual([])
    }
  })
})

describe('signOffBlockers reproduces the guard’s three rejection branches', () => {
  const approved = { present: true, approved: true, matchesCurrentContent: true }
  const missing = { present: false, approved: false, matchesCurrentContent: false }
  const rejected = { present: true, approved: false, matchesCurrentContent: true }
  const stale = { present: true, approved: true, matchesCurrentContent: false }

  it('passes a fully signed item', () => {
    expect(signOffBlockers('operational', { content: approved, fairness: approved })).toEqual([])
  })

  it('reports a missing review', () => {
    const blockers = signOffBlockers('operational', { content: approved, fairness: missing })
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({ kind: 'fairness', reason: 'missing' })
  })

  it('reports a rejection distinctly from an absence', () => {
    const blockers = signOffBlockers('operational', { content: rejected, fairness: approved })
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({ kind: 'content', reason: 'rejected' })
  })

  it('reports a sign-off given against different content', () => {
    const blockers = signOffBlockers('operational', { content: approved, fairness: stale })
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({ kind: 'fairness', reason: 'stale' })
  })

  it('reports both kinds when both are unmet', () => {
    const blockers = signOffBlockers('operational', { content: missing, fairness: missing })
    expect(blockers.map((b) => b.kind)).toEqual(['content', 'fairness'])
  })

  it('does not block an ungated state however bad the sign-offs are', () => {
    expect(signOffBlockers('killed', { content: rejected, fairness: missing })).toEqual([])
  })
})
