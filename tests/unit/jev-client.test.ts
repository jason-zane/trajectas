import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderRequestError } from '@/types/ai'
import { decide, JEV_DECISIONS_URL, type JevRequest } from '@/lib/ai/providers/jev'

const request: JevRequest = {
  model: 'typesafe/jev-1.13',
  state: { decision: 'selection (hiring into this role)', position_description: 'A ward manager.' },
  questions: {
    level: {
      type: 'choice',
      instructions: 'What seniority level is this role?',
      criteria: { ic: 'No reports', first_line_manager: 'Manages ICs' },
    },
    drive: { type: 'score', instructions: 'How important is Drive?', criteria: ['Low', 'High'] },
  },
}

const validBody = {
  id: 'dec_123',
  model: 'typesafe/jev-1.13-20260917',
  provider: 'TypeSafe',
  answers: {
    level: { type: 'choice', choice: 'first_line_manager', confidence: 0.83, probabilities: { ic: 0.17 } },
    drive: { type: 'score', score: 3.2, legend: { '0': 'low', '1': 'high' }, probabilities: { '0': 0.1, '1': 0.9 }, confidence: 0.7 },
    extra: { type: 'noul', noul: 0.98 },
  },
  usage: { input_tokens: 1200, output_tokens: 48, cost: 0.0004 },
  somethingNew: 'ignored',
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function textResponse(text: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  } as unknown as Response
}

beforeEach(() => {
  vi.stubEnv('OpenRouter_API_KEY', 'test')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('decide', () => {
  it('posts the request to the alpha decisions endpoint with the OpenRouter headers', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validBody))

    await decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(JEV_DECISIONS_URL)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test',
      'HTTP-Referer': 'https://trajectas.com',
      'X-Title': 'Trajectas',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(init.body as string)).toEqual({
      model: request.model,
      state: request.state,
      questions: request.questions,
    })
    expect(init.signal).toBeDefined()
  })

  it('parses a valid response, camel-casing usage and tolerating unknown fields', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validBody))

    const result = await decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(result.model).toBe('typesafe/jev-1.13-20260917')
    expect(result.id).toBe('dec_123')
    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 48, cost: 0.0004 })
    expect(result.answers.drive).toEqual({
      type: 'score',
      score: 3.2,
      legend: { '0': 'low', '1': 'high' },
      probabilities: { '0': 0.1, '1': 0.9 },
      confidence: 0.7,
    })
    expect(result.answers.level).toMatchObject({ type: 'choice', choice: 'first_line_manager' })
    expect(result.answers.extra).toMatchObject({ type: 'noul', noul: 0.98 })
  })

  it('defaults usage counters to zero when the payload omits them', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ model: 'typesafe/jev-1.13', answers: { drive: { type: 'score', score: 1 } } }),
    )

    const result = await decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(result.id).toBeUndefined()
  })

  it('rejects an empty answers map', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ model: 'typesafe/jev-1.13', answers: {}, usage: { input_tokens: 1, output_tokens: 1 } }),
    )

    await expect(decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(
      ProviderRequestError,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects a response in an unexpected shape', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ model: 'typesafe/jev-1.13', answers: { drive: { type: 'score' } } }),
    )

    await expect(decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(
      /unexpected shape/,
    )
  })

  it('rejects a body that is not JSON at all', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
      text: async () => '<html>',
    }) as unknown as Response)

    const error = await decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e)
    expect(error).toBeInstanceOf(ProviderRequestError)
    // A malformed body is not retryable — one attempt only.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 4xx', async () => {
    const fetchImpl = vi.fn(async () => textResponse('{"error":"bad questions"}', 400))

    const error = await decide(request, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
    }).catch((e) => e)

    expect(error).toBeInstanceOf(ProviderRequestError)
    expect((error as Error).message).toContain('400')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 and succeeds on the second attempt', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(textResponse('rate limited', 429))
      .mockResolvedValueOnce(jsonResponse(validBody))

    const pending = decide(request, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
    })
    await vi.runAllTimersAsync()
    const result = await pending

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.model).toBe('typesafe/jev-1.13-20260917')
  })

  it('retries a timeout, then surfaces it as a provider error', async () => {
    vi.useFakeTimers()
    const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    const fetchImpl = vi.fn<() => Promise<Response>>().mockRejectedValue(abortError)

    const pending = decide(request, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
      timeoutMs: 50,
    }).catch((e) => e)
    await vi.runAllTimersAsync()
    const error = await pending

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(error).toBeInstanceOf(ProviderRequestError)
    expect((error as Error).message).toContain('timed out')
  })

  it('retries a network failure', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(validBody))

    const pending = decide(request, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
    })
    await vi.runAllTimersAsync()
    await pending

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('throws a plain error when the API key is not configured', async () => {
    vi.stubEnv('OpenRouter_API_KEY', '')
    const fetchImpl = vi.fn(async () => jsonResponse(validBody))

    const error = await decide(request, { fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(ProviderRequestError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
