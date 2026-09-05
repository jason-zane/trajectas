import { afterEach, describe, expect, it, vi } from 'vitest'
import { getNarrativeRequestBudget, withReportNarrativeBudget } from '@/lib/reports/narrative-budget'
import { withOpenRouterRetry } from '@/lib/ai/providers/openrouter-retry'

afterEach(() => vi.useRealTimers())

describe('report narrative deadlines', () => {
  it('shares one cumulative budget across sequential and nested narrative work', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    await withReportNarrativeBudget(async () => {
      expect(getNarrativeRequestBudget().deadlineAt).toBe(61000)
      vi.setSystemTime(51000)
      await withReportNarrativeBudget(async () => {
        expect(getNarrativeRequestBudget().deadlineAt).toBe(61000)
      })
    })
    expect(getNarrativeRequestBudget().deadlineAt).toBe(66000)
  })

  it('does not start network work after a deadline', async () => {
    const operation = vi.fn()
    await expect(withOpenRouterRetry(operation, { deadlineAt: Date.now() - 1 })).rejects.toThrow('deadline')
    expect(operation).not.toHaveBeenCalled()
  })

  it('falls back promptly when Retry-After exceeds the remaining worker budget', async () => {
    const error = { status: 429, headers: new Headers({ 'retry-after': '120' }) }
    const operation = vi.fn().mockRejectedValue(error)
    await expect(withOpenRouterRetry(operation, { deadlineAt: Date.now() + 10000 })).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
