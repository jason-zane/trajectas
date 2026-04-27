import crypto from 'crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { extractIntegrationKeyPrefix, hashIntegrationApiKey } from '@/lib/integrations/credentials'
import { IntegrationApiError, isIntegrationApiError } from '@/lib/integrations/errors'
import { MAX_INTEGRATION_JSON_BODY_BYTES } from '@/lib/integrations/request'
import type {
  IntegrationApiScope,
  IntegrationAuthContext,
  InternalApiContext,
} from '@/lib/integrations/types'
import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
} as const

type StoredResponse = {
  responseStatus: number
  responseBody: Record<string, unknown>
}

type IdempotencyState =
  | { mode: 'none' }
  | { mode: 'replay'; response: StoredResponse }
  | { mode: 'record'; recordId: string }

declare global {
  var __trajectasIntegrationRateLimitStore: Map<string, { count: number; resetAt: number }> | undefined
}

function getRateLimitStore() {
  if (!globalThis.__trajectasIntegrationRateLimitStore) {
    globalThis.__trajectasIntegrationRateLimitStore = new Map()
  }

  return globalThis.__trajectasIntegrationRateLimitStore
}

function buildJsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...(extraHeaders ?? {}),
    },
  })
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown'
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}

function applyRateLimit(key: string, limit: number, windowMs: number) {
  const store = getRateLimitStore()
  const now = Date.now()
  const existing = store.get(key)
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (existing.count >= limit) {
    throw new IntegrationApiError(
      429,
      'rate_limit_exceeded',
      'The integration API rate limit has been exceeded.'
    )
  }

  existing.count += 1
  store.set(key, existing)
}

function isInternalIntegrationsApiEnabled() {
  return process.env.INTERNAL_INTEGRATIONS_API_ENABLED === 'true'
}

async function authenticateIntegrationCredential(
  request: Request
): Promise<IntegrationAuthContext> {
  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!bearer) {
    throw new IntegrationApiError(
      401,
      'missing_api_key',
      'A valid integration API key is required.'
    )
  }

  const keyPrefix = extractIntegrationKeyPrefix(bearer)
  const hashed = hashIntegrationApiKey(bearer)
  const db = createAdminClient()
  const { data, error } = await db
    .from('integration_credentials')
    .select(`
      id,
      client_id,
      label,
      key_prefix,
      secret_hash,
      scopes,
      status,
      expires_at,
      revoked_at,
      integration_connection_id,
      integration_connections(
        id,
        client_id,
        provider_slug,
        status
      )
    `)
    .eq('key_prefix', keyPrefix)
    .maybeSingle()

  if (error || !data) {
    throw new IntegrationApiError(
      401,
      'invalid_api_key',
      'A valid integration API key is required.'
    )
  }

  const storedHash = Buffer.from(String(data.secret_hash), 'utf8')
  const computedHash = Buffer.from(hashed, 'utf8')
  if (storedHash.length !== computedHash.length) {
    throw new IntegrationApiError(
      401,
      'invalid_api_key',
      'A valid integration API key is required.'
    )
  }
  const secretMatches = crypto.timingSafeEqual(storedHash, computedHash)

  if (!secretMatches) {
    throw new IntegrationApiError(
      401,
      'invalid_api_key',
      'A valid integration API key is required.'
    )
  }

  if (data.status !== 'active' || data.revoked_at) {
    throw new IntegrationApiError(403, 'credential_revoked', 'This integration credential has been revoked.')
  }

  if (data.expires_at && new Date(String(data.expires_at)).getTime() <= Date.now()) {
    throw new IntegrationApiError(403, 'credential_expired', 'This integration credential has expired.')
  }

  const connection = Array.isArray(data.integration_connections)
    ? data.integration_connections[0]
    : data.integration_connections
  if (!connection?.id || connection.status !== 'active') {
    throw new IntegrationApiError(
      403,
      'connection_inactive',
      'The integration connection is inactive.'
    )
  }

  if (String(connection.client_id) !== String(data.client_id)) {
    throw new IntegrationApiError(
      500,
      'connection_client_mismatch',
      'The integration connection is misconfigured.'
    )
  }

  await db
    .from('integration_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    requestId: crypto.randomUUID(),
    clientId: String(data.client_id),
    connectionId: String(connection.id),
    connectionProvider: String(connection.provider_slug),
    credentialId: String(data.id),
    credentialLabel: String(data.label),
    scopes: (data.scopes ?? []) as IntegrationApiScope[],
  }
}

function requireScopes(context: IntegrationAuthContext, requiredScopes: IntegrationApiScope[]) {
  for (const scope of requiredScopes) {
    if (!context.scopes.includes(scope)) {
      throw new IntegrationApiError(
        403,
        'missing_scope',
        `Missing required integration scope: ${scope}.`
      )
    }
  }
}

async function beginIdempotencyRecord(input: {
  context: IntegrationAuthContext
  request: Request
  bodyText: string
}): Promise<IdempotencyState> {
  const idempotencyKey = input.request.headers.get('Idempotency-Key')?.trim()
  if (!idempotencyKey) {
    return { mode: 'none' }
  }

  const requestHash = crypto
    .createHash('sha256')
    .update(`${input.request.method}:${new URL(input.request.url).pathname}:${input.bodyText}`)
    .digest('hex')
  const db = createAdminClient()

  const { data: inserted, error: insertError } = await db
    .from('integration_idempotency_keys')
    .insert({
      integration_credential_id: input.context.credentialId,
      client_id: input.context.clientId,
      request_method: input.request.method,
      request_path: new URL(input.request.url).pathname,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
    })
    .select('id')
    .maybeSingle()

  if (inserted?.id) {
    return { mode: 'record', recordId: String(inserted.id) }
  }

  if (insertError?.code !== '23505') {
    throw new Error(insertError?.message ?? 'Failed to record idempotency state.')
  }

  const { data: existing, error: existingError } = await db
    .from('integration_idempotency_keys')
    .select('id, request_hash, status, response_status, response_body')
    .eq('integration_credential_id', input.context.credentialId)
    .eq('request_method', input.request.method)
    .eq('request_path', new URL(input.request.url).pathname)
    .eq('idempotency_key', idempotencyKey)
    .single()

  if (existingError || !existing) {
    throw new Error(existingError?.message ?? 'Failed to load idempotency state.')
  }

  if (existing.request_hash !== requestHash) {
    throw new IntegrationApiError(
      409,
      'idempotency_conflict',
      'The supplied idempotency key has already been used with a different request payload.'
    )
  }

  if (existing.status === 'completed') {
    return {
      mode: 'replay',
      response: {
        responseStatus: Number(existing.response_status ?? 200),
        responseBody: (existing.response_body ?? {}) as Record<string, unknown>,
      },
    }
  }

  throw new IntegrationApiError(
    409,
    'request_in_progress',
    'A request with this idempotency key is already in progress.'
  )
}

async function completeIdempotencyRecord(
  recordId: string,
  response: StoredResponse
) {
  const db = createAdminClient()
  await db
    .from('integration_idempotency_keys')
    .update({
      status: 'completed',
      response_status: response.responseStatus,
      response_body: response.responseBody,
    })
    .eq('id', recordId)
}

async function responseToStoredBody(response: Response): Promise<StoredResponse> {
  const text = await response.clone().text()
  let body: Record<string, unknown> = {}

  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      body = { message: text }
    }
  }

  return {
    responseStatus: response.status,
    responseBody: body,
  }
}

function getErrorResponse(error: unknown, requestId: string) {
  if (isIntegrationApiError(error)) {
    return buildJsonResponse(
      {
        error: error.message,
        code: error.code,
        requestId,
      },
      error.status,
      { 'X-Request-Id': requestId }
    )
  }

  console.error(`[integrations] unhandled error (${requestId})`, error)
  return buildJsonResponse(
    {
      error: 'The integration API request failed.',
      code: 'integration_request_failed',
      requestId,
    },
    500,
    { 'X-Request-Id': requestId }
  )
}

export async function withIntegrationApiRoute(
  request: Request,
  options: {
    scopes: IntegrationApiScope[]
    rateLimit?: { limit: number; windowMs: number }
    enableIdempotency?: boolean
  },
  handler: (context: IntegrationAuthContext) => Promise<Response>
) {
  if (!isInternalIntegrationsApiEnabled()) {
    return new Response(null, { status: 404 })
  }

  let requestId: string = crypto.randomUUID()
  let idempotencyState: IdempotencyState = { mode: 'none' }

  try {
    const context = await authenticateIntegrationCredential(request)
    requestId = context.requestId
    requireScopes(context, options.scopes)

    const rateLimitKey = `credential:${context.credentialId}`
    const rateLimit = options.rateLimit ?? { limit: 120, windowMs: 60_000 }
    applyRateLimit(rateLimitKey, rateLimit.limit, rateLimit.windowMs)

    // Buffer body once for idempotency hashing with a hard cap before parsing.
    const bodyText = await readRequestTextWithLimit(
      request.clone(),
      MAX_INTEGRATION_JSON_BODY_BYTES
    ).catch((error) => {
      if (error instanceof RequestBodyTooLargeError) {
        throw new IntegrationApiError(
          413,
          'payload_too_large',
          'The request body is too large.'
        )
      }
      throw error
    })

    if (options.enableIdempotency) {
      idempotencyState = await beginIdempotencyRecord({ context, request, bodyText })
      if (idempotencyState.mode === 'replay') {
        return buildJsonResponse(idempotencyState.response.responseBody, idempotencyState.response.responseStatus, {
          'X-Request-Id': requestId,
          'X-Idempotent-Replay': 'true',
        })
      }
    }

    const response = await handler(context)
    response.headers.set('Cache-Control', JSON_HEADERS['Cache-Control'])
    response.headers.set('X-Request-Id', requestId)

    if (idempotencyState.mode === 'record') {
      await completeIdempotencyRecord(
        idempotencyState.recordId,
        await responseToStoredBody(response)
      )
    }

    return response
  } catch (error) {
    const response = getErrorResponse(error, requestId)
    if (idempotencyState.mode === 'record') {
      await completeIdempotencyRecord(
        idempotencyState.recordId,
        await responseToStoredBody(response)
      )
    }
    return response
  }
}

export async function withInternalIntegrationWorkerRoute(
  request: Request,
  handler: (context: InternalApiContext) => Promise<Response>
) {
  if (!isInternalIntegrationsApiEnabled()) {
    return new Response(null, { status: 404 })
  }

  const requestId = crypto.randomUUID()

  try {
    const internalKey = request.headers.get('x-internal-key')
    const expected = Buffer.from(process.env.INTERNAL_API_KEY ?? '')
    const provided = Buffer.from(internalKey ?? '')
    if (
      expected.length === 0 ||
      expected.length !== provided.length ||
      !crypto.timingSafeEqual(expected, provided)
    ) {
      throw new IntegrationApiError(
        401,
        'missing_internal_key',
        'A valid internal API key is required.'
      )
    }

    applyRateLimit(`internal:${getRequestIp(request)}`, 60, 60_000)

    const response = await handler({ requestId })
    response.headers.set('Cache-Control', JSON_HEADERS['Cache-Control'])
    response.headers.set('X-Request-Id', requestId)
    return response
  } catch (error) {
    return getErrorResponse(error, requestId)
  }
}

export function integrationJsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit
) {
  return buildJsonResponse(body, status, extraHeaders)
}
