export class RequestBodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes.`)
    this.name = 'RequestBodyTooLargeError'
  }
}

export async function readRequestTextWithLimit(
  request: Request,
  limitBytes: number,
) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > limitBytes) {
    throw new RequestBodyTooLargeError(limitBytes)
  }

  if (!request.body) return ''

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    received += value.byteLength
    if (received > limitBytes) {
      await reader.cancel()
      throw new RequestBodyTooLargeError(limitBytes)
    }

    text += decoder.decode(value, { stream: true })
  }

  return text + decoder.decode()
}

export async function parseJsonRequestWithLimit<T>(
  request: Request,
  limitBytes: number,
): Promise<T> {
  const raw = await readRequestTextWithLimit(request, limitBytes)
  return JSON.parse(raw) as T
}
