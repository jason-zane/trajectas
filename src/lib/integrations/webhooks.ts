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
  const { data: events, error } = await db
    .from('integration_events_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('available_at', new Date().toISOString())
    .order('available_at', { ascending: true })
    .limit(limit)

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

      const timestamp = Math.floor(Date.now() / 1000).toString()
      const secret = decryptIntegrationSecret(String(endpoint.signing_secret_ciphertext))
      const signature = buildWebhookSignature(secret, timestamp, rawPayload)

      let deliveryStatus: 'delivered' | 'failed' = 'delivered'
      let responseStatus: number | null = null
      let responseBodyExcerpt: string | null = null

      try {
        const response = await fetch(String(endpoint.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TalentFit-Internal-Integrations/1.0',
            'X-TalentFit-Event-Id': String(event.id),
            'X-TalentFit-Event-Type': String(event.event_type),
            'X-TalentFit-Timestamp': timestamp,
            'X-TalentFit-Signature': signature,
          },
          body: rawPayload,
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
        responseBodyExcerpt =
          deliveryError instanceof Error
            ? deliveryError.message.slice(0, 1000)
            : 'Webhook delivery failed'
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
