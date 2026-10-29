// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QualitySupplementRunner } from '@/components/assess/quality-supplement-runner'
import { ResponseQualityDetailPanel } from '@/components/results/response-quality-detail'
import { QUALITY_MODULE_VERSION, QUALITY_POLICY_VERSION, QUALITY_QUESTIONS, type ResponseQualityDetail } from '@/lib/instrument/ipip-neo-120/response-quality'

const mocks = vi.hoisted(() => ({ save: vi.fn(), review: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock('@/app/actions/response-quality', () => ({ saveQualitySupplementAnswer: mocks.save, reviewResponseQuality: mocks.review }))
vi.mock('@/components/brand/brand-logo', () => ({ BrandLogo: () => <p>Brand</p> }))
vi.mock('@/components/local-time', () => ({ LocalTime: ({ iso }: { iso: string }) => <time>{iso}</time> }))

beforeEach(() => {
  mocks.save.mockResolvedValue({ saved: { answers: { attention_agree: 4 }, revision: 1 } })
  mocks.review.mockResolvedValue({ success: true })
})
function runner(answers: Record<string, number> = {}) {
  return <QualitySupplementRunner token="synthetic" sessionId="session" module={{ version: QUALITY_MODULE_VERSION, questions: QUALITY_QUESTIONS, answers, revision: 0 }} nextUrl="/next" />
}
function detail(canReview = true): ResponseQualityDetail {
  return { id: 'result', computedAt: '2026-10-30', canReview, result: { policyVersion: QUALITY_POLICY_VERSION, moduleVersion: QUALITY_MODULE_VERSION, provisional: true, status: 'review_recommended', indicators: [{ id: 'attention', label: 'Instruction checks', status: 'flagged', observed: 1, denominator: 2, detail: '1 of 2 instructions missed.' }] }, reviews: [] }
}
it('requires a successful save before advancing and resumes at the first unanswered statement', async () => {
  render(runner())
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Agree' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ questionId: 'attention_agree', value: 4, revision: 0 }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('I have never told a lie, even a small one.', { selector: 'p' })).toBeVisible()
  expect(mocks.push).not.toHaveBeenCalled()
})
it('does not silently advance after a failed save and offers a retry', async () => {
  mocks.save.mockResolvedValue({ error: 'Synthetic save failure' })
  render(runner())
  fireEvent.click(screen.getByRole('button', { name: 'Agree' }))
  await screen.findByText('Synthetic save failure')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Retry saving' })).toBeEnabled()
  expect(mocks.push).not.toHaveBeenCalled()
})
it('resumes saved supplement answers and uses a fixed destination after the last answer', async () => {
  const answers = Object.fromEntries(QUALITY_QUESTIONS.map(q => [q.id, 2])); delete answers.attention_disagree
  mocks.save.mockResolvedValue({ saved: { answers: { ...answers, attention_disagree: 1 }, revision: 8 } })
  render(runner(answers))
  expect(screen.getByText('For this statement, please select Strongly disagree.', { selector: 'p' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Strongly disagree' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to finish' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Continue to finish' }))
  expect(mocks.push).toHaveBeenCalledWith('/next')
})
it('shows reasons and pilot limitations, keeping read-only viewers out of the review form', () => {
  render(<ResponseQualityDetailPanel sessionId="session" detail={detail(false)} />)
  expect(screen.getByText('Review recommended')).toBeVisible()
  expect(screen.getByText('1 of 2 instructions missed.')).toBeVisible()
  expect(screen.getByText(/do not establish dishonesty/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Save review' })).toBeNull()
})
it('records a review against the exact result and refreshes without changing the automated evidence', async () => {
  render(<ResponseQualityDetailPanel sessionId="session" detail={detail()} />)
  fireEvent.change(screen.getByLabelText('Review notes'), { target: { value: 'Discussed the missed instruction with the participant.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }))
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  expect(mocks.review).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session', resultId: 'result', decision: 'follow_up', reviewId: expect.any(String) }))
  expect(screen.getByText('Review recommended')).toBeVisible()
})
it('shows absence of processing as not assessed', () => {
  render(<ResponseQualityDetailPanel sessionId="session" detail={null} />)
  expect(screen.getByText(/Not assessed/)).toBeVisible()
  expect(screen.queryByText('No concerns detected')).toBeNull()
})
