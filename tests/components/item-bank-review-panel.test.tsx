// @vitest-environment jsdom

/**
 * Sign-off gating on the item review screen (LR-8 / #347).
 *
 * #347's acceptance criterion is that an item cannot reach `operational`
 * without BOTH sign-offs. The database trigger `items_review_signoff_guard()`
 * is what enforces that, and it is integration-tested elsewhere. What these
 * tests pin is the UI half of the requirement: that a reviewer SEES the gate
 * before they act, instead of discovering it as a failed write.
 *
 * Concretely:
 *   - a transition the sign-off gate blocks is offered but disabled, with the
 *     reason spelled out;
 *   - the two sign-offs are independent, so one is not mistaken for both;
 *   - a stale sign-off (content changed after signing) blocks exactly like a
 *     missing one, because that is what the guard does;
 *   - the transitions offered come from the passed-in graph, never from a
 *     hardcoded list in the component;
 *   - when the database refuses anyway, its message is shown verbatim.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const recordItemReview = vi.fn()
const transitionItemLifecycle = vi.fn()
const refresh = vi.fn()

vi.mock('@/app/actions/item-bank', () => ({
  recordItemReview: (...args: unknown[]) => recordItemReview(...args),
  transitionItemLifecycle: (...args: unknown[]) => transitionItemLifecycle(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import {
  ABSENT_SIGN_OFF,
  ReviewPanel,
  type SignOffView,
} from '@/app/(dashboard)/cognitive-items/review/[itemId]/review-panel'

const APPROVED: SignOffView = {
  present: true,
  approved: true,
  matchesCurrentContent: true,
  reviewer: 'Dana Reviewer',
  reviewedAt: '2026-08-01T10:00:00.000Z',
  notes: null,
}

const STALE: SignOffView = { ...APPROVED, matchesCurrentContent: false }
const REJECTED: SignOffView = { ...APPROVED, approved: false }

function renderPanel(overrides: Partial<React.ComponentProps<typeof ReviewPanel>> = {}) {
  return render(
    <ReviewPanel
      itemId="11111111-1111-4111-8111-111111111111"
      lifecycleState="fairness_reviewed"
      contentSignOff={ABSENT_SIGN_OFF}
      fairnessSignOff={ABSENT_SIGN_OFF}
      legalTransitions={['piloting']}
      {...overrides}
    />,
  )
}

function transitionButton(label: string) {
  return screen.getByRole('button', { name: new RegExp(`Move to ${label}`, 'i') })
}

beforeEach(() => {
  recordItemReview.mockResolvedValue({ ok: true, data: undefined })
  transitionItemLifecycle.mockResolvedValue({ ok: true, data: { lifecycleState: 'piloting' } })
})

describe('ReviewPanel — sign-off gating', () => {
  it('blocks a both-sign-offs transition when neither sign-off exists, naming both gaps', () => {
    renderPanel({ legalTransitions: ['operational'] })

    expect(transitionButton('Operational')).toBeDisabled()
    expect(screen.getByText('No content review has been recorded.')).toBeDefined()
    expect(screen.getByText('No fairness review has been recorded.')).toBeDefined()
  })

  it('still blocks operational when only content is signed off — the two are independent', () => {
    renderPanel({ contentSignOff: APPROVED, legalTransitions: ['operational'] })

    expect(transitionButton('Operational')).toBeDisabled()
    expect(screen.getByText('No fairness review has been recorded.')).toBeDefined()
    expect(screen.queryByText('No content review has been recorded.')).toBeNull()
  })

  it('allows operational once both sign-offs stand', () => {
    renderPanel({
      contentSignOff: APPROVED,
      fairnessSignOff: APPROVED,
      legalTransitions: ['operational'],
    })

    expect(transitionButton('Operational')).not.toBeDisabled()
    expect(screen.queryByText(/no .* review has been recorded/i)).toBeNull()
  })

  it('treats a stale sign-off as blocking — content changed after it was given', () => {
    renderPanel({
      contentSignOff: STALE,
      fairnessSignOff: APPROVED,
      legalTransitions: ['operational'],
    })

    expect(transitionButton('Operational')).toBeDisabled()
    expect(
      screen.getByText('The standing content sign-off was given for different content; re-review it.'),
    ).toBeDefined()
  })

  it('treats a rejection as blocking, distinctly from an absent review', () => {
    renderPanel({
      contentSignOff: REJECTED,
      fairnessSignOff: APPROVED,
      legalTransitions: ['operational'],
    })

    expect(transitionButton('Operational')).toBeDisabled()
    expect(screen.getByText('The standing content review is a rejection.')).toBeDefined()
  })

  it('requires only a content sign-off to reach content_reviewed', () => {
    renderPanel({
      lifecycleState: 'draft',
      contentSignOff: APPROVED,
      legalTransitions: ['content_reviewed'],
    })

    // Fairness is absent, but content review does not presuppose it.
    expect(transitionButton('Content reviewed')).not.toBeDisabled()
  })

  it('does not gate transitions that require no sign-off', () => {
    renderPanel({ lifecycleState: 'draft', legalTransitions: ['killed'] })

    expect(transitionButton('Killed')).not.toBeDisabled()
  })

  it('offers exactly the transitions it was given — no hardcoded state machine', () => {
    renderPanel({ lifecycleState: 'draft', legalTransitions: ['content_reviewed', 'killed'] })

    expect(screen.getAllByRole('button', { name: /^Move to/i })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Move to Operational/i })).toBeNull()
  })

  it('reports a terminal state rather than rendering an empty control', () => {
    renderPanel({ lifecycleState: 'retired', legalTransitions: [] })

    expect(screen.queryByRole('button', { name: /^Move to/i })).toBeNull()
    expect(screen.getByText(/No transitions are available/i)).toBeDefined()
  })
})

describe('ReviewPanel — transitions', () => {
  it('submits an unblocked transition with the target state', async () => {
    renderPanel({
      contentSignOff: APPROVED,
      fairnessSignOff: APPROVED,
      legalTransitions: ['piloting'],
    })

    fireEvent.click(transitionButton('Piloting'))

    await waitFor(() => {
      expect(transitionItemLifecycle).toHaveBeenCalledWith({
        itemId: '11111111-1111-4111-8111-111111111111',
        targetState: 'piloting',
      })
    })
  })

  it('never submits a blocked transition', () => {
    renderPanel({ legalTransitions: ['operational'] })

    fireEvent.click(transitionButton('Operational'))

    expect(transitionItemLifecycle).not.toHaveBeenCalled()
  })

  it("surfaces the database's refusal verbatim rather than rewording it", async () => {
    const guardMessage =
      'item 1111 cannot enter operational — the standing fairness sign-off was given for different content; re-review it'
    transitionItemLifecycle.mockResolvedValue({ ok: false, error: guardMessage })

    renderPanel({
      contentSignOff: APPROVED,
      fairnessSignOff: APPROVED,
      legalTransitions: ['operational'],
    })

    fireEvent.click(transitionButton('Operational'))

    await waitFor(() => {
      expect(screen.getByText(guardMessage)).toBeDefined()
    })
  })
})

describe('ReviewPanel — recording sign-offs', () => {
  it('records content and fairness as separate decisions', async () => {
    renderPanel()

    const approveButtons = screen.getAllByRole('button', { name: /Approve/i })
    expect(approveButtons).toHaveLength(2)

    fireEvent.click(approveButtons[0])
    await waitFor(() => {
      expect(recordItemReview).toHaveBeenCalledWith(
        expect.objectContaining({ reviewKind: 'content', decision: 'approved' }),
      )
    })

    fireEvent.click(approveButtons[1])
    await waitFor(() => {
      expect(recordItemReview).toHaveBeenCalledWith(
        expect.objectContaining({ reviewKind: 'fairness', decision: 'approved' }),
      )
    })
  })

  it('records a rejection with its note against the right kind', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Fairness review notes'), {
      target: { value: 'Cultural loading in the stimulus.' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Reject/i })[1])

    await waitFor(() => {
      expect(recordItemReview).toHaveBeenCalledWith({
        itemId: '11111111-1111-4111-8111-111111111111',
        reviewKind: 'fairness',
        decision: 'rejected',
        notes: 'Cultural loading in the stimulus.',
      })
    })
  })

  it('shows a standing sign-off with its reviewer, and flags one that has gone stale', () => {
    renderPanel({ contentSignOff: STALE, fairnessSignOff: APPROVED })

    // Both cards carry a standing decision by the same reviewer, so the name
    // appears twice — one per sign-off, which is the point of separating them.
    expect(screen.getAllByText(/Dana Reviewer/)).toHaveLength(2)
    expect(screen.getByText('Stale — content changed')).toBeDefined()
    expect(screen.getByText('Approved')).toBeDefined()
    expect(
      screen.getByText(/content changed after this sign-off, so it no longer counts/i),
    ).toBeDefined()
  })
})
