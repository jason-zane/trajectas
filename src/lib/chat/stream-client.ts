// =============================================================================
// src/lib/chat/stream-client.ts
//
// Browser-side ndjson reader. Deliberately framework-free and server-free so
// the chat interface can own the transport without pulling server code in.
// =============================================================================

import type { ChatFrame } from './envelope'

/**
 * Read an ndjson response body, yielding one parsed frame at a time. Partial
 * lines are buffered across chunk boundaries; a malformed line is skipped
 * rather than aborting the stream, so one bad frame cannot lose the answer.
 */
export async function* readChatFrames(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        try {
          yield JSON.parse(line) as ChatFrame
        } catch {
          // Skip an unparseable frame rather than failing the whole stream.
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const tail = buffer.trim()
  if (tail) {
    try {
      yield JSON.parse(tail) as ChatFrame
    } catch {
      // Ignore a truncated trailing frame.
    }
  }
}
