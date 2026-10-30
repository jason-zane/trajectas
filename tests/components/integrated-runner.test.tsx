// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SectionWrapper } from '@/components/assess/section-wrapper'
import type { SectionForRunner } from '@/app/actions/assess'
import { INTEGRATED_QUALITY_ANCHORS, INTEGRATED_QUALITY_MODULE_VERSION } from '@/lib/instrument/ipip-neo-120/response-quality'

const mocks = vi.hoisted(() => ({ save: vi.fn(), enqueue: vi.fn(), push: vi.fn(), flush: vi.fn(), local: null as Record<string, { value: number; data: Record<string, unknown> }> | null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/components/brand/brand-logo', () => ({ BrandLogo: () => <span>Brand</span>, BrandFooter: () => null }))
vi.mock('@/app/actions/response-quality', () => ({ saveQualitySupplementAnswer: mocks.save }))
vi.mock('@/app/actions/assess', () => ({ updateSessionProgressLite: async () => ({}), finaliseSection: vi.fn(), submitSession: vi.fn() }))
vi.mock('@/app/actions/assess-practice', () => ({ checkPracticeAnswer: vi.fn() }))
vi.mock('@/components/assess/use-save-queue', () => ({ useSaveQueue: () => ({ enqueueSave: mocks.enqueue, retryFailedSaves: vi.fn(), flushSaves: mocks.flush, saveStatus: 'saved', saveError: null, lostSaves: 0, localResponses: mocks.local }) }))
const section: SectionForRunner = { id: 'native', title: 'Profile', displayOrder: 0, responseFormatId: 'likert', responseFormatType: 'likert', responseFormatConfig: {}, itemOrdering: 'fixed', sectionRole: 'scored', allowBackNav: true,
  items: ['first', 'second', 'third'].map((id, index) => ({ id, stem: `I answer the ${id} statement.`, displayOrder: index, options: INTEGRATED_QUALITY_ANCHORS.map((label, i) => ({ id: `${id}-${i}`, label, value: i + 1, sortOrder: i })) })) }
const renderRunner = (answers: Record<string, number> = {}) => render(<SectionWrapper token="synthetic" sessionId="session" section={section} sectionIndex={0} totalSections={1} allSections={[section]} existingResponses={{ first: { value: 2, data: {} } }} assessmentName="Personality" postAssessmentUrl="/review" integratedModule={{ version: INTEGRATED_QUALITY_MODULE_VERSION, questions: [{ id: 'check', stem: 'I am a response check.', afterItem: 1 }], answers, revision: Object.keys(answers).length }} />)
beforeEach(() => { vi.clearAllMocks(); mocks.local = null; mocks.flush.mockResolvedValue(true) })
it('keeps a failed quality answer in the shared sequence until a confirmed retry, using separate storage', async () => {
  mocks.save.mockResolvedValueOnce({ error: 'Please retry saving.' }).mockResolvedValueOnce({ saved: { answers: { check: 3 }, revision: 1 } })
  renderRunner()
  expect(screen.getByText('I am a response check.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: INTEGRATED_QUALITY_ANCHORS[2] }))
  await screen.findByRole('alert')
  expect(screen.getByText('I am a response check.')).toBeVisible()
  expect(mocks.enqueue).not.toHaveBeenCalled()
  expect(mocks.push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }))
  await waitFor(() => expect(screen.getByText('I answer the second statement.')).toBeVisible())
  expect(mocks.save).toHaveBeenLastCalledWith({ token: 'synthetic', sessionId: 'session', questionId: 'check', value: 3, revision: 0 })
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  await waitFor(() => expect(screen.getByText('I am a response check.')).toBeVisible())
  expect(screen.getByRole('button', { name: INTEGRATED_QUALITY_ANCHORS[2] })).toHaveAttribute('aria-pressed', 'true')
})
it('resumes at the next unanswered native item with progress including confirmed checks', () => {
  renderRunner({ check: 3 })
  expect(screen.getByText('I answer the second statement.')).toBeVisible()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
})
it('does not move past a response check while earlier native answers remain unsaved', async () => {
  mocks.flush.mockResolvedValue(false)
  renderRunner()
  fireEvent.click(screen.getByRole('button', { name: INTEGRATED_QUALITY_ANCHORS[2] }))
  await screen.findByRole('alert')
  expect(mocks.save).not.toHaveBeenCalled()
  expect(mocks.push).not.toHaveBeenCalled()
  expect(screen.getByText('I am a response check.')).toBeVisible()
})
it('merges pending local native answers before choosing the resumed statement', async () => {
  mocks.local = { second: { value: 4, data: {} } }
  renderRunner({ check: 3 })
  await waitFor(() => expect(screen.getByText('I answer the third statement.')).toBeVisible())
})
