'use server'

import crypto from 'crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  canManageClient,
  requireClientAccess,
  AuthorizationError,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  issueIntegrationCredential,
  ensureInternalIntegrationConnection,
} from '@/lib/integrations/credentials'
import { IntegrationApiError } from '@/lib/integrations/errors'
import {
  INTEGRATION_EVENT_TYPES,
  type IntegrationEventType,
} from '@/lib/integrations/events'
import { encryptIntegrationSecret } from '@/lib/integrations/crypto'
import { INTEGRATION_API_SCOPES, type IntegrationApiScope } from '@/lib/integrations/types'
import { createAdminClient } from '@/lib/supabase/admin'

const createCredentialSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.').max(120, 'Label must be 120 characters or fewer.'),
  scopes: z
    .array(z.enum(INTEGRATION_API_SCOPES))
    .min(1, 'Choose at least one scope.')
    .max(INTEGRATION_API_SCOPES.length),
})

const endpointUrlSchema = z
  .string()
  .trim()
  .url('Webhook URL must be a valid URL.')
  .refine((value) => {
    try {
      const parsed = new URL(value)
      if (parsed.protocol === 'https:') return true
      if (parsed.protocol !== 'http:') return false

      const hostname = parsed.hostname.toLowerCase()
      return hostname === 'localhost' || hostname === '127.0.0.1'
    } catch {
      return false
    }
  }, 'Webhook URL must use HTTPS unless it targets localhost.')

const createWebhookEndpointSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.').max(120, 'Label must be 120 characters or fewer.'),
  url: endpointUrlSchema,
  subscribedEvents: z
    .array(z.enum(INTEGRATION_EVENT_TYPES))
    .min(1, 'Choose at least one subscribed event.')
    .max(INTEGRATION_EVENT_TYPES.length),
})

const updateWebhookEndpointSchema = createWebhookEndpointSchema.extend({
  status: z.enum(['active', 'inactive']).default('active'),
})

type InternalIntegrationCredentialSummary = {
  id: string
  label: string
  keyPrefix: string
  scopes: IntegrationApiScope[]
  status: 'active' | 'revoked'
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
}

type InternalIntegrationWebhookEndpointSummary = {
  id: string
  label: string
  url: string
  subscribedEvents: IntegrationEventType[]
  status: 'active' | 'inactive'
  createdAt: string
  lastDeliveryAt: string | null
  signingSecretKeyVersion: number
}

export type ClientInternalIntegrationSettings = {
  canManage: boolean
  connectionId: string | null
  credentials: InternalIntegrationCredentialSummary[]
  webhookEndpoints: InternalIntegrationWebhookEndpointSummary[]
}

function revalidateIntegrationPaths(clientSlug: string) {
  revalidatePath(`/clients/${clientSlug}/settings`)
  revalidatePath('/clients')
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AuthorizationError || error instanceof IntegrationApiError) {
    return error.message
  }

  console.error('[integrations][action] unexpected error', error)
  return fallback
}

function generateWebhookSigningSecret() {
  return `tfwhsec_${crypto.randomBytes(24).toString('base64url')}`
}

async function requireManageableClient(clientId: string) {
  const access = await requireClientAccess(clientId)
  const canManage = canManageClient(access.scope, access.clientId, access.partnerId)
  if (!canManage) {
    throw new AuthorizationError('You do not have permission to manage integration settings for this client.')
  }

  return access
}

async function getCredentialSummaryRows(clientId: string, connectionId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('integration_credentials')
    .select('id, label, key_prefix, scopes, status, created_at, last_used_at, expires_at, revoked_at')
    .eq('client_id', clientId)
    .eq('integration_connection_id', connectionId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.label),
    keyPrefix: `tfi.${String(row.key_prefix)}.…`,
    scopes: ((row.scopes ?? []) as string[]) as IntegrationApiScope[],
    status: row.status as 'active' | 'revoked',
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
  }))
}

async function getWebhookEndpointSummaryRows(clientId: string, connectionId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('integration_webhook_endpoints')
    .select('id, label, url, subscribed_events, status, created_at, last_delivery_at, signing_secret_key_version')
    .eq('client_id', clientId)
    .eq('integration_connection_id', connectionId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.label),
    url: String(row.url),
    subscribedEvents: ((row.subscribed_events ?? []) as string[]) as IntegrationEventType[],
    status: row.status as 'active' | 'inactive',
    createdAt: String(row.created_at),
    lastDeliveryAt: row.last_delivery_at ? String(row.last_delivery_at) : null,
    signingSecretKeyVersion: Number(row.signing_secret_key_version ?? 1),
  }))
}

export async function getClientInternalIntegrationSettings(
  clientId: string
): Promise<ClientInternalIntegrationSettings> {
  const access = await requireClientAccess(clientId)
  const canManage = canManageClient(access.scope, access.clientId, access.partnerId)

  if (!canManage) {
    return {
      canManage: false,
      connectionId: null,
      credentials: [],
      webhookEndpoints: [],
    }
  }

  const db = createAdminClient()
  const { data: connection, error } = await db
    .from('integration_connections')
    .select('id')
    .eq('client_id', clientId)
    .eq('provider_slug', 'trajectas_internal')
    .eq('mode', 'internal_api')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!connection?.id) {
    return {
      canManage: true,
      connectionId: null,
      credentials: [],
      webhookEndpoints: [],
    }
  }

  return {
    canManage: true,
    connectionId: String(connection.id),
    credentials: await getCredentialSummaryRows(clientId, String(connection.id)),
    webhookEndpoints: await getWebhookEndpointSummaryRows(clientId, String(connection.id)),
  }
}

export async function createInternalIntegrationCredentialAction(input: {
  clientId: string
  clientSlug: string
  label: string
  scopes: IntegrationApiScope[]
}) {
  try {
    const access = await requireManageableClient(input.clientId)
    const parsed = createCredentialSchema.parse({
      label: input.label,
      scopes: input.scopes,
    })

    const result = await issueIntegrationCredential({
      clientId: input.clientId,
      label: parsed.label,
      scopes: parsed.scopes,
      createdBy: access.scope.actor?.id ?? null,
    })

    await logAuditEvent({
      actorProfileId: access.scope.actor?.id ?? null,
      eventType: 'integration.credential.created',
      targetTable: 'integration_credentials',
      targetId: result.id,
      clientId: input.clientId,
      partnerId: access.partnerId,
      metadata: {
        scopes: parsed.scopes,
        connectionId: result.integrationConnectionId,
      },
    })

    revalidateIntegrationPaths(input.clientSlug)

    return {
      success: true as const,
      credentialId: result.id,
      apiKey: result.apiKey,
    }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'The integration credential could not be created.'),
    }
  }
}

export async function revokeInternalIntegrationCredentialAction(input: {
  clientId: string
  clientSlug: string
  credentialId: string
}) {
  try {
    const access = await requireManageableClient(input.clientId)
    const credentialId = z.uuid().parse(input.credentialId)
    const db = createAdminClient()

    const { data: credential, error: credentialError } = await db
      .from('integration_credentials')
      .select('id, label, revoked_at')
      .eq('id', credentialId)
      .eq('client_id', input.clientId)
      .single()

    if (credentialError || !credential) {
      throw new AuthorizationError('Integration credential not found.')
    }

    if (!credential.revoked_at) {
      const { error } = await db
        .from('integration_credentials')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', credentialId)
        .eq('client_id', input.clientId)

      if (error) {
        throw new Error(error.message)
      }
    }

    await logAuditEvent({
      actorProfileId: access.scope.actor?.id ?? null,
      eventType: 'integration.credential.revoked',
      targetTable: 'integration_credentials',
      targetId: credentialId,
      clientId: input.clientId,
      partnerId: access.partnerId,
      metadata: {
        label: credential.label,
      },
    })

    revalidateIntegrationPaths(input.clientSlug)
    return { success: true as const }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'The integration credential could not be revoked.'),
    }
  }
}

export async function createInternalWebhookEndpointAction(input: {
  clientId: string
  clientSlug: string
  label: string
  url: string
  subscribedEvents: IntegrationEventType[]
}) {
  try {
    const access = await requireManageableClient(input.clientId)
    const parsed = createWebhookEndpointSchema.parse({
      label: input.label,
      url: input.url,
      subscribedEvents: input.subscribedEvents,
    })

    const integrationConnectionId = await ensureInternalIntegrationConnection({
      clientId: input.clientId,
      createdBy: access.scope.actor?.id ?? null,
    })

    const signingSecret = generateWebhookSigningSecret()
    const db = createAdminClient()
    const { data, error } = await db
      .from('integration_webhook_endpoints')
      .insert({
        integration_connection_id: integrationConnectionId,
        client_id: input.clientId,
        label: parsed.label,
        url: parsed.url,
        subscribed_events: parsed.subscribedEvents,
        signing_secret_ciphertext: encryptIntegrationSecret(signingSecret),
        created_by: access.scope.actor?.id ?? null,
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create webhook endpoint.')
    }

    await logAuditEvent({
      actorProfileId: access.scope.actor?.id ?? null,
      eventType: 'integration.webhook_endpoint.created',
      targetTable: 'integration_webhook_endpoints',
      targetId: String(data.id),
      clientId: input.clientId,
      partnerId: access.partnerId,
      metadata: {
        url: parsed.url,
        subscribedEvents: parsed.subscribedEvents,
        connectionId: integrationConnectionId,
      },
    })

    revalidateIntegrationPaths(input.clientSlug)

    return {
      success: true as const,
      endpointId: String(data.id),
      signingSecret,
    }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'The webhook endpoint could not be created.'),
    }
  }
}

export async function updateInternalWebhookEndpointAction(input: {
  clientId: string
  clientSlug: string
  endpointId: string
  label: string
  url: string
  subscribedEvents: IntegrationEventType[]
  status: 'active' | 'inactive'
}) {
  try {
    const access = await requireManageableClient(input.clientId)
    const endpointId = z.uuid().parse(input.endpointId)
    const parsed = updateWebhookEndpointSchema.parse({
      label: input.label,
      url: input.url,
      subscribedEvents: input.subscribedEvents,
      status: input.status,
    })

    const db = createAdminClient()
    const { error } = await db
      .from('integration_webhook_endpoints')
      .update({
        label: parsed.label,
        url: parsed.url,
        subscribed_events: parsed.subscribedEvents,
        status: parsed.status,
      })
      .eq('id', endpointId)
      .eq('client_id', input.clientId)

    if (error) {
      throw new Error(error.message)
    }

    await logAuditEvent({
      actorProfileId: access.scope.actor?.id ?? null,
      eventType: 'integration.webhook_endpoint.updated',
      targetTable: 'integration_webhook_endpoints',
      targetId: endpointId,
      clientId: input.clientId,
      partnerId: access.partnerId,
      metadata: {
        url: parsed.url,
        subscribedEvents: parsed.subscribedEvents,
        status: parsed.status,
      },
    })

    revalidateIntegrationPaths(input.clientSlug)
    return { success: true as const }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'The webhook endpoint could not be updated.'),
    }
  }
}

export async function rotateInternalWebhookEndpointSecretAction(input: {
  clientId: string
  clientSlug: string
  endpointId: string
}) {
  try {
    const access = await requireManageableClient(input.clientId)
    const endpointId = z.uuid().parse(input.endpointId)
    const db = createAdminClient()

    const { data: endpoint, error: endpointError } = await db
      .from('integration_webhook_endpoints')
      .select('id, signing_secret_key_version')
      .eq('id', endpointId)
      .eq('client_id', input.clientId)
      .single()

    if (endpointError || !endpoint) {
      throw new AuthorizationError('Webhook endpoint not found.')
    }

    const signingSecret = generateWebhookSigningSecret()
    const { error } = await db
      .from('integration_webhook_endpoints')
      .update({
        signing_secret_ciphertext: encryptIntegrationSecret(signingSecret),
        signing_secret_key_version: Number(endpoint.signing_secret_key_version ?? 1) + 1,
      })
      .eq('id', endpointId)
      .eq('client_id', input.clientId)

    if (error) {
      throw new Error(error.message)
    }

    await logAuditEvent({
      actorProfileId: access.scope.actor?.id ?? null,
      eventType: 'integration.webhook_endpoint.rotated_secret',
      targetTable: 'integration_webhook_endpoints',
      targetId: endpointId,
      clientId: input.clientId,
      partnerId: access.partnerId,
      metadata: {
        nextKeyVersion: Number(endpoint.signing_secret_key_version ?? 1) + 1,
      },
    })

    revalidateIntegrationPaths(input.clientSlug)
    return {
      success: true as const,
      signingSecret,
    }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'The webhook signing secret could not be rotated.'),
    }
  }
}
