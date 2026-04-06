import crypto from 'crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { IntegrationApiError } from '@/lib/integrations/errors'
import type { IntegrationApiScope } from '@/lib/integrations/types'

const API_KEY_PREFIX = 'tfi'

function getApiSecretPepper() {
  const pepper = process.env.INTEGRATIONS_API_SECRET_PEPPER?.trim()
  if (!pepper) {
    throw new IntegrationApiError(
      500,
      'integration_secret_pepper_missing',
      'Integration credential hashing is not configured.'
    )
  }

  return pepper
}

export function generateIntegrationApiKey() {
  const publicPrefix = crypto.randomBytes(6).toString('hex')
  const secret = crypto.randomBytes(24).toString('base64url')
  return {
    keyPrefix: publicPrefix,
    apiKey: `${API_KEY_PREFIX}.${publicPrefix}.${secret}`,
  }
}

export function hashIntegrationApiKey(apiKey: string) {
  return crypto
    .createHmac('sha256', getApiSecretPepper())
    .update(apiKey)
    .digest('hex')
}

export function extractIntegrationKeyPrefix(apiKey: string) {
  const [prefix, publicPrefix, secret] = apiKey.split('.')
  if (
    prefix !== API_KEY_PREFIX ||
    !publicPrefix ||
    !secret ||
    publicPrefix.length !== 12 ||
    secret.length < 16
  ) {
    throw new IntegrationApiError(
      401,
      'invalid_api_key',
      'A valid integration API key is required.'
    )
  }

  return publicPrefix
}

export async function ensureInternalIntegrationConnection(input: {
  clientId: string
  displayName?: string
  createdBy?: string | null
}) {
  const db = createAdminClient()
  const { data: existing, error: existingError } = await db
    .from('integration_connections')
    .select('id')
    .eq('client_id', input.clientId)
    .eq('provider_slug', 'talentfit_internal')
    .eq('mode', 'internal_api')
    .is('deleted_at', null)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing?.id) {
    return String(existing.id)
  }

  const { data, error } = await db
    .from('integration_connections')
    .insert({
      client_id: input.clientId,
      provider_slug: 'talentfit_internal',
      mode: 'internal_api',
      display_name: input.displayName ?? 'Internal API',
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create integration connection.')
  }

  return String(data.id)
}

export async function issueIntegrationCredential(input: {
  clientId: string
  label: string
  scopes: IntegrationApiScope[]
  createdBy?: string | null
  integrationConnectionId?: string
  expiresAt?: string | null
  metadata?: Record<string, unknown>
}) {
  const db = createAdminClient()
  const integrationConnectionId =
    input.integrationConnectionId ??
    (await ensureInternalIntegrationConnection({
      clientId: input.clientId,
      createdBy: input.createdBy,
    }))

  const { keyPrefix, apiKey } = generateIntegrationApiKey()
  const secretHash = hashIntegrationApiKey(apiKey)

  const { data, error } = await db
    .from('integration_credentials')
    .insert({
      integration_connection_id: integrationConnectionId,
      client_id: input.clientId,
      label: input.label,
      key_prefix: keyPrefix,
      secret_hash: secretHash,
      scopes: input.scopes,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create integration credential.')
  }

  return {
    id: String(data.id),
    integrationConnectionId,
    apiKey,
  }
}
