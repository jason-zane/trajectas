import 'server-only'

import type { LookupAddress } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { Readable } from 'node:stream'
import { getWebhookUrlSafetyError, isLoopbackWebhookHost, shouldAllowLocalWebhookUrls } from './url-security'

type WebhookRequestOptions = {
  method: 'POST'
  headers: Record<string, string>
  body: string
  signal: AbortSignal
}

function abortError() {
  return new DOMException('Webhook request aborted.', 'AbortError')
}

function lookupWithAbort(hostname: string, signal: AbortSignal): Promise<LookupAddress[]> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError())
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    lookup(hostname, { all: true, verbatim: true })
      .then(resolve, () => reject(new Error('Webhook destination could not be resolved.')))
      .finally(() => signal.removeEventListener('abort', abort))
  })
}

/**
 * Validate saved URLs again at delivery and pin the socket to a vetted DNS
 * answer. Native HTTP does not follow redirects. Keeping the original URL
 * preserves its Host header and HTTPS certificate/SNI validation.
 */
export async function requestWebhook(rawUrl: string, options: WebhookRequestOptions): Promise<Response> {
  const allowLocalUrls = shouldAllowLocalWebhookUrls()
  const safetyError = getWebhookUrlSafetyError(rawUrl, { allowLocalUrls })
  if (safetyError) throw new Error(safetyError)
  if (options.signal.aborted) throw abortError()

  const url = new URL(rawUrl)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const literalFamily = isIP(hostname)
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookupWithAbort(hostname, options.signal)
  const localDestination = allowLocalUrls && isLoopbackWebhookHost(hostname)
  // Reject a mixed public/private answer set too; never retry another address
  // or re-resolve the hostname during connection establishment.
  if (!addresses.length || addresses.some(({ address, family }) => {
    if ((family !== 4 && family !== 6) || isIP(address) !== family) return true
    const host = family === 6 ? `[${address}]` : address
    return getWebhookUrlSafetyError(`${url.protocol}//${host}`, { allowLocalUrls: localDestination }) !== null
  })) throw new Error('Webhook destination must resolve only to allowed network addresses.')
  if (options.signal.aborted) throw abortError()

  const pinned = addresses[0]
  const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
    if (lookupOptions.all) callback(null, [pinned])
    else callback(null, pinned.address, pinned.family)
  }

  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'POST',
      headers: options.headers,
      signal: options.signal,
      agent: false,
      family: pinned.family,
      lookup: pinnedLookup,
    }, response => {
      const status = response.statusCode ?? 502
      if (status < 200 || status > 599) {
        response.destroy()
        reject(new Error('Webhook response status is invalid.'))
        return
      }
      if ([204, 205, 304].includes(status)) {
        response.destroy()
        resolve(new Response(null, { status }))
      } else {
        resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status }))
      }
    })
    // Do not persist SDK/socket errors containing hostnames, URLs or payloads.
    request.once('error', () => reject(options.signal.aborted ? abortError() : new Error('Webhook delivery failed.')))
    request.end(options.body)
  })
}
