import crypto from 'crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptIntegrationSecret } from '@/lib/integrations/crypto'

function buildWebhookSignature(secret: string, timestamp: string, payload: string) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  return `t=${timestamp},v1=${digest}`
}

export async function dispatchPendingIntegrationEvents(limit: number) {
  const db = createAdminClient()

  // Atomically claim pending events by selecting candidates then updating them
  // in a single update-returning query to prevent concurrent pollers from
  // processing the same events.
  const now = new Date().toISOString()
  const { data: candidates } = await db
    .from('integration_events_outbox')
    .select('id')
    .eq('status', 'pending')
    .lte('available_at', now)
    .order('available_at', { ascending: true })
    .limit(limit)

  const candidateIds = (candidates ?? []).map((row) => row.id)
  if (candidateIds.length === 0) {
    return { processed: 0, delivered: 0 }
  }

  // Mark them as dispatched immediately to prevent re-selection by other pollers.
  // Events that fail delivery will be set back to 'pending' below.
  const { data: events, error } = await db
    .from('integration_events_outbox')
    .update({ status: 'dispatched' })
    .in('id', candidateIds)
    .eq('status', 'pending')
    .select('*')

  if (error) {
    throw new Error(error.message)
  }

  let processed = 0
  let delivered = 0

  for (const event of events ?? []) {
    processed += 1
    const eventPayload = {
      id: event.id,
      eventType: event.event_type,
      clientId: event.client_id,
      aggregateType: event.aggregate_type,
      aggregateId: event.aggregate_id,
      createdAt: event.created_at,
      data: event.payload ?? {},
    }
    const rawPayload = JSON.stringify(eventPayload)
    const { data: endpoints, error: endpointsError } = await db
      .from('integration_webhook_endpoints')
      .select('*')
      .eq('client_id', event.client_id)
      .eq('status', 'active')

    if (endpointsError) {
      throw new Error(endpointsError.message)
    }

    if (!endpoints?.length) {
      await db
        .from('integration_events_outbox')
        .update({
          status: 'dispatched',
          dispatched_at: new Date().toISOString(),
          attempts: Number(event.attempts ?? 0),
          last_error: null,
        })
        .eq('id', event.id)
      continue
    }

    let eventSucceeded = true

    for (const endpoint of endpoints) {
      const subscribedEvents = (endpoint.subscribed_events ?? []) as string[]
      if (subscribedEvents.length > 0 && !subscribedEvents.includes(event.event_type)) {
        continue
      }

      // Skip endpoints that already received a successful delivery for this event
      const { data: existingDelivery } = await db
        .from('integration_webhook_deliveries')
        .select('id')
        .eq('integration_event_outbox_id', event.id)
        .eq('integration_webhook_endpoint_id', endpoint.id)
        .eq('status', 'delivered')
        .maybeSingle()

      if (existingDelivery) {
        continue
      }

      const timestamp = Math.floor(Date.now() / 1000).toString()
      const secret = decryptIntegrationSecret(String(endpoint.signing_secret_ciphertext))
      const signature = buildWebhookSignature(secret, timestamp, rawPayload)

      let deliveryStatus: 'delivered' | 'failed' = 'delivered'
      let responseStatus: number | null = null
      let responseBodyExcerpt: string | null = null

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      try {
        const response = await fetch(String(endpoint.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Trajectas-Internal-Integrations/1.0',
            'X-Trajectas-Event-Id': String(event.id),
            'X-Trajectas-Event-Type': String(event.event_type),
            'X-Trajectas-Timestamp': timestamp,
            'X-Trajectas-Signature': signature,
          },
          body: rawPayload,
          signal: controller.signal,
        })

        responseStatus = response.status
        responseBodyExcerpt = (await response.text()).slice(0, 1000)
        if (!response.ok) {
          deliveryStatus = 'failed'
          eventSucceeded = false
        } else {
          delivered += 1
        }
      } catch (deliveryError) {
        deliveryStatus = 'failed'
        eventSucceeded = false
        if (deliveryError instanceof Error && deliveryError.name === 'AbortError') {
          responseBodyExcerpt = 'Webhook delivery timed out after 10s'
        } else {
          responseBodyExcerpt =
            deliveryError instanceof Error
              ? deliveryError.message.slice(0, 1000)
              : 'Webhook delivery failed'
        }
      } finally {
        clearTimeout(timeout)
      }

      const { data: latestAttempt } = await db
        .from('integration_webhook_deliveries')
        .select('attempt_no')
        .eq('integration_event_outbox_id', event.id)
        .eq('integration_webhook_endpoint_id', endpoint.id)
        .order('attempt_no', { ascending: false })
        .limit(1)
        .maybeSingle()

      const attemptNo = Number(latestAttempt?.attempt_no ?? 0) + 1

      await db.from('integration_webhook_deliveries').insert({
        integration_webhook_endpoint_id: endpoint.id,
        integration_event_outbox_id: event.id,
        attempt_no: attemptNo,
        status: deliveryStatus,
        request_signature: signature,
        response_status: responseStatus,
        response_body_excerpt: responseBodyExcerpt,
        next_attempt_at:
          deliveryStatus === 'failed'
            ? new Date(Date.now() + 5 * 60_000).toISOString()
            : null,
        delivered_at:
          deliveryStatus === 'delivered' ? new Date().toISOString() : null,
      })

      if (deliveryStatus === 'delivered') {
        await db
          .from('integration_webhook_endpoints')
          .update({ last_delivery_at: new Date().toISOString() })
          .eq('id', endpoint.id)
      }
    }

    const nextAttempts = Number(event.attempts ?? 0) + 1
    await db
      .from('integration_events_outbox')
      .update({
        status: eventSucceeded ? 'dispatched' : nextAttempts >= 5 ? 'failed' : 'pending',
        attempts: nextAttempts,
        dispatched_at: eventSucceeded ? new Date().toISOString() : null,
        available_at: eventSucceeded
          ? event.available_at
          : new Date(Date.now() + 5 * 60_000).toISOString(),
        last_error: eventSucceeded ? null : 'One or more webhook deliveries failed.',
      })
      .eq('id', event.id)
  }

  return {
    processed,
    delivered,
  }
}
