import { describe, expect, it } from 'vitest'
import {
  AUTO_ADVANCE_FORMATS,
  CONTINUE_FORMATS,
  cognitiveNeedsConfirm,
  formatAutoAdvances,
  formatNeedsContinue,
} from '@/components/assess/advance-policy'

// -----------------------------------------------------------------------------
// The runner's per-format advance policy, pinned.
//
// Cognitive items moved from "tap + Continue" to "tap advances" after the
// Mensa Norway benchmark sitting (docs/superpowers/specs/
// 2026-08-19-mensa-norway-benchmark.md §5.3) — the same interaction as every
// other single-select format, with Back as the undo. Doc 03 §7.3's mis-tap
// concern survives as a coupling: the tap only advances where the section
// lets the participant come back. These tests are the statement of that
// contract; section-wrapper.tsx is its only consumer.
// -----------------------------------------------------------------------------

describe('advance policy — format sets', () => {
  it('single-select formats auto-advance; multi-step formats need Continue', () => {
    for (const f of ['likert', 'forced_choice', 'binary', 'sjt', 'cognitive']) {
      expect(AUTO_ADVANCE_FORMATS.has(f), f).toBe(true)
      expect(CONTINUE_FORMATS.has(f), f).toBe(false)
    }
    for (const f of ['free_text', 'ranking']) {
      expect(CONTINUE_FORMATS.has(f), f).toBe(true)
      expect(AUTO_ADVANCE_FORMATS.has(f), f).toBe(false)
    }
  })

  it('no format is in both sets', () => {
    for (const f of AUTO_ADVANCE_FORMATS) expect(CONTINUE_FORMATS.has(f), f).toBe(false)
  })
})

describe('advance policy — cognitive is coupled to back-navigation', () => {
  it('a cognitive item auto-advances when the section allows going back (explicit true)', () => {
    expect(formatAutoAdvances('cognitive', true)).toBe(true)
    expect(formatNeedsContinue('cognitive', true)).toBe(false)
    expect(cognitiveNeedsConfirm('cognitive', true)).toBe(false)
  })

  it('…and when the flag is unset, because the DB default for allow_back_nav is true', () => {
    expect(formatAutoAdvances('cognitive', undefined)).toBe(true)
    expect(formatNeedsContinue('cognitive', undefined)).toBe(false)
  })

  it('a cognitive item in a locked section keeps tap + Continue — a mis-tap must stay undoable', () => {
    expect(cognitiveNeedsConfirm('cognitive', false)).toBe(true)
    expect(formatAutoAdvances('cognitive', false)).toBe(false)
    expect(formatNeedsContinue('cognitive', false)).toBe(true)
  })

  it('the coupling is cognitive-only: a locked section does not change any other format', () => {
    for (const f of ['likert', 'forced_choice', 'binary', 'sjt']) {
      expect(formatAutoAdvances(f, false), f).toBe(true)
      expect(formatNeedsContinue(f, false), f).toBe(false)
    }
    for (const f of ['free_text', 'ranking']) {
      expect(formatAutoAdvances(f, false), f).toBe(false)
      expect(formatNeedsContinue(f, false), f).toBe(true)
    }
    expect(cognitiveNeedsConfirm('likert', false)).toBe(false)
  })

  it('an unknown format neither auto-advances nor needs Continue (the wrapper treats it as inert)', () => {
    expect(formatAutoAdvances('mystery', true)).toBe(false)
    expect(formatNeedsContinue('mystery', true)).toBe(false)
  })
})
