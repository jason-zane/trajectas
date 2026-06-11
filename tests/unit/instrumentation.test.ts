import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Instrumentation } from 'next'

// Mock reportError before importing the module under test
vi.mock('@/lib/observability/report-error', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}))

import { reportRequestError } from '@/instrumentation-node'
import * as reportErrorModule from '@/lib/observability/report-error'

describe('instrumentation.reportRequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call reportError with unhandled error and request context', async () => {
    const mockReportError = vi.mocked(reportErrorModule.reportError)
    const testError = new Error('Test render error')
    testError.stack = 'at testFunction'
    const errorWithDigest = testError as Error & { digest?: string }
    errorWithDigest.digest = 'test-digest-123'

    const mockRequest = {
      method: 'GET',
      path: '/dashboard/assessments/test-id',
    } as Parameters<Instrumentation.onRequestError>[1]

    const mockContext = {
      routePath: '/dashboard/assessments/[id]',
      routeType: 'render' as const,
      renderSource: 'react-server-components' as const,
      routerKind: 'App Router' as const,
      revalidateReason: undefined,
    } as Parameters<Instrumentation.onRequestError>[2]

    await reportRequestError(errorWithDigest, mockRequest, mockContext)

    expect(mockReportError).toHaveBeenCalledOnce()
    expect(mockReportError).toHaveBeenCalledWith(errorWithDigest, {
      source: 'onRequestError',
      context: {
        digest: 'test-digest-123',
        path: '/dashboard/assessments/test-id',
        method: 'GET',
        routePath: '/dashboard/assessments/[id]',
        routeType: 'render',
        renderSource: 'react-server-components',
        routerKind: 'App Router',
      },
      severity: 'error',
    })
  })

  it('should not throw when reportError rejects', async () => {
    const mockReportError = vi.mocked(reportErrorModule.reportError)
    mockReportError.mockRejectedValueOnce(new Error('DB connection failed'))

    const testError = new Error('Test render error')
    const mockRequest = { method: 'GET', path: '/' } as Parameters<Instrumentation.onRequestError>[1]
    const mockContext = {
      routePath: '/',
      routeType: 'render' as const,
      routerKind: 'App Router' as const,
      revalidateReason: undefined,
    } as Parameters<Instrumentation.onRequestError>[2]

    // Should not throw
    await expect(
      reportRequestError(testError, mockRequest, mockContext),
    ).resolves.not.toThrow()
  })

  it('should include null for missing optional digest and renderSource', async () => {
    const mockReportError = vi.mocked(reportErrorModule.reportError)
    const testError = new Error('Test error')
    const mockRequest = { method: 'POST', path: '/api/test' } as Parameters<Instrumentation.onRequestError>[1]
    const mockContext = {
      routePath: '/api/test',
      routeType: 'route' as const,
      routerKind: 'App Router' as const,
      revalidateReason: undefined,
    } as Parameters<Instrumentation.onRequestError>[2]

    await reportRequestError(testError, mockRequest, mockContext)

    const call = mockReportError.mock.calls[0]?.[1]
    expect(call?.context?.digest).toBeNull()
    expect(call?.context?.renderSource).toBeNull()
    // routerKind is always provided by Next.js context, so it should be present
    expect(call?.context?.routerKind).toBe('App Router')
  })
})
