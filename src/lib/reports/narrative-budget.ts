import { AsyncLocalStorage } from 'node:async_hooks'

// Optional prose cannot consume the report worker's entire execution window.
const budgets = new AsyncLocalStorage<{ deadlineAt: number }>()
export const REPORT_NARRATIVE_BUDGET_MS = 60_000
export const NARRATIVE_REQUEST_TIMEOUT_MS = 15_000

export function withReportNarrativeBudget<T>(work: () => Promise<T>): Promise<T> {
  if (budgets.getStore()) return work()
  return budgets.run({ deadlineAt: Date.now() + REPORT_NARRATIVE_BUDGET_MS }, work)
}

export function getNarrativeRequestBudget() {
  return {
    deadlineAt: budgets.getStore()?.deadlineAt ?? Date.now() + NARRATIVE_REQUEST_TIMEOUT_MS,
    timeoutMs: NARRATIVE_REQUEST_TIMEOUT_MS,
    maxAttempts: 2,
  }
}
