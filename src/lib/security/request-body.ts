export class RequestBodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes.`)
    this.name = 'RequestBodyTooLargeError'
  }
}

function assertContentLengthWithinLimit(headers: Headers, limitBytes: number) {
  const contentLength = Number(headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > limitBytes) {
    throw new RequestBodyTooLargeError(limitBytes)
  }
}

async function readStreamTextWithLimit(
  body: ReadableStream<Uint8Array> | null,
  limitBytes: number,
) {
  if (!body) return ''

  const reader = body.getReader()
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

export async function readRequestTextWithLimit(
  request: Request,
  limitBytes: number,
) {
  assertContentLengthWithinLimit(request.headers, limitBytes)
  return readStreamTextWithLimit(request.body, limitBytes)
}

export async function readResponseTextWithLimit(
  response: Response,
  limitBytes: number,
) {
  assertContentLengthWithinLimit(response.headers, limitBytes)
  return readStreamTextWithLimit(response.body, limitBytes)
}

export async function parseJsonRequestWithLimit<T>(
  request: Request,
  limitBytes: number,
): Promise<T> {
  const raw = await readRequestTextWithLimit(request, limitBytes)
  return JSON.parse(raw) as T
}

export async function parseOptionalJsonRequestWithLimit<T>(
  request: Request,
  limitBytes: number,
  emptyValue: T,
): Promise<T> {
  const raw = await readRequestTextWithLimit(request, limitBytes)
  if (!raw.trim()) {
    return emptyValue
  }

  return JSON.parse(raw) as T
}
