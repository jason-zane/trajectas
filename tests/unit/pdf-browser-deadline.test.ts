import { afterEach, describe, expect, it, vi } from 'vitest'
import { withReportPdfBrowser } from '@/lib/reports/pdf-browser'

afterEach(() => vi.useRealTimers())

describe('PDF browser deadline', () => {
  it('closes Chromium before returning a rendered PDF', async () => {
    const close = vi.fn(async () => {})
    const browser = { close } as never
    await expect(withReportPdfBrowser(async () => 'pdf', { launch: async () => browser })).resolves.toBe('pdf')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not render when a cold launcher completes after the deadline', async () => {
    vi.useFakeTimers()
    const close = vi.fn(async () => {})
    let release!: (browser: never) => void
    const launch = () => new Promise<never>(resolve => { release = resolve })
    const render = vi.fn(async () => 'pdf')
    const outcome = withReportPdfBrowser(render, { timeoutMs: 10, launch }).catch(error => error)
    await vi.advanceTimersByTimeAsync(10)
    expect(await outcome).toMatchObject({ message: 'PDF browser deadline exceeded' })
    release({ close } as never)
    await vi.advanceTimersByTimeAsync(0)
    expect(close).toHaveBeenCalledTimes(1)
    expect(render).not.toHaveBeenCalled()
  })

  it('kills its own stuck browser process when graceful close also hangs', async () => {
    vi.useFakeTimers()
    const kill = vi.fn()
    const browser = { close: () => new Promise<void>(() => {}), process: () => ({ kill }) } as never
    const outcome = withReportPdfBrowser(() => new Promise(() => {}), { timeoutMs: 10, launch: async () => browser })
      .catch(error => error)
    await vi.advanceTimersByTimeAsync(5010)
    expect(await outcome).toMatchObject({ message: 'PDF browser deadline exceeded' })
    expect(kill).toHaveBeenCalledWith('SIGKILL')
  })
})
