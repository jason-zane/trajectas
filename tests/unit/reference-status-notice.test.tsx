import { expect, it, vi, beforeEach } from 'vitest'
const mocks = vi.hoisted(() => ({ statuses: vi.fn() }))
vi.mock('@/lib/reports/reference-status', () => ({ getReferenceStatusesForAuthorizedSnapshots: mocks.statuses }))
import { ReferenceStatusNotice } from '@/components/reports/reference-status-notice'
import type { ReportSnapshot } from '@/types/database'
import { renderToStaticMarkup } from 'react-dom/server'
beforeEach(() => vi.clearAllMocks())
it('leaves saved report content alone and warns separately when its exact reference is withdrawn', async () => {
  mocks.statuses.mockResolvedValue({ ref: 'withdrawn' })
  const snapshot = { referenceVersionId: 'ref' } as ReportSnapshot
  const html = renderToStaticMarkup(await ReferenceStatusNotice({ snapshot }))
  expect(html).toContain('Reference withdrawn from future use')
  expect(html).toContain('retains the comparison originally used')
  expect(mocks.statuses).toHaveBeenCalledWith([snapshot])
})
it('does not query source metadata for an original no-reference report', async () => {
  expect(await ReferenceStatusNotice({ snapshot: {} as ReportSnapshot })).toBeNull()
  expect(mocks.statuses).not.toHaveBeenCalled()
})
it('does not present a withdrawal warning for a supported earlier version', async () => {
  mocks.statuses.mockResolvedValue({ ref: 'superseded' })
  expect(await ReferenceStatusNotice({ snapshot: { referenceVersionId: 'ref' } as ReportSnapshot })).toBeNull()
})
