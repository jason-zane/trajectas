import crypto from 'crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptIntegrationSecret } from '@/lib/integrations/crypto'
import { protectIntegrationPayload } from '@/lib/integrations/confidentiality'
import {
  readResponseTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

const MAX_WEBHOOK_RESPONSE_EXCERPT_BYTES = 1024
const MAX_EVENT_ATTEMPTS = 5
const EVENT_RETRY_DELAY_MS = 5 * 60_000
const EVENT_CLAIM_LEASE_MS = 15 * 60_000
// Leave time for an in-flight 10s delivery and persistence before the 300s route limit.
const DISPATCH_WORK_BUDGET_MS = 240_000

function buildWebhookSignature(secret: string, timestamp: string, payload: string) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  return `t=${timestamp},v1=${digest}`
}

/** Delivery is at least once: receivers must deduplicate X-Trajectas-Event-Id
 * if a worker stops after sending but before recording the successful response. */
export async function dispatchPendingIntegrationEvents(limit: number) {
  const db = createAdminClient()
  const deadline = Date.now() + DISPATCH_WORK_BUDGET_MS

  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - EVENT_CLAIM_LEASE_MS).toISOString()
  // A claim has status=dispatched but no dispatched_at until it is complete.
  // available_at is its lease expiry; updated_at also protects legacy claims
  // whose available_at was not advanced by the old worker. Never reset completed
  // events. Claims count as attempts so repeated process termination is bounded.
  for (const exhausted of [false, true]) {
    let recovery = db.from('integration_events_outbox').update({
      status: exhausted ? 'failed' : 'pending',
      available_at: now,
      last_error: 'Webhook worker stopped before completing the event.',
    }).eq('status', 'dispatched').is('dispatched_at', null)
      .lte('available_at', now).lte('updated_at', staleBefore)
    recovery = exhausted
      ? recovery.gte('attempts', MAX_EVENT_ATTEMPTS)
      : recovery.lt('attempts', MAX_EVENT_ATTEMPTS)
    const { error: recoveryError } = await recovery
    if (recoveryError) throw new Error('Unable to recover unfinished webhook events.')
  }

  const { data: candidates, error: candidatesError } = await db
    .from('integration_events_outbox')
    .select('id, attempts')
    .eq('status', 'pending')
    .lte('available_at', now)
    .order('available_at', { ascending: true })
    .limit(limit)

  if (candidatesError) throw new Error('Unable to read pending webhook events.')

  let processed = 0
  let delivered = 0

  for (const candidate of candidates ?? []) {
    if (Date.now() >= deadline) break
    const claimUntil = new Date(Date.now() + EVENT_CLAIM_LEASE_MS).toISOString()
    const nextAttempts = Number(candidate.attempts ?? 0) + 1
    // Claim only the event we are about to process. A crash cannot strand the
    // rest of the candidate batch, and concurrent pollers cannot take this row.
    const { data: event, error: claimError } = await db
      .from('integration_events_outbox')
      .update({ status: 'dispatched', dispatched_at: null,
        available_at: claimUntil, attempts: nextAttempts })
      .eq('id', candidate.id).eq('status', 'pending')
      .eq('attempts', Number(candidate.attempts ?? 0))
      .lte('available_at', now).select('*').maybeSingle()
    if (claimError) {
      // An uncertain write may have claimed this row; the lease recovers it.
      console.error('[integrations] webhook event claim failed', { eventId: candidate.id })
      continue
    }
    if (!event) continue
    processed += 1
    // Fence every state transition so an expired worker cannot overwrite a
    // later claim. Do not include payloads, URLs, or signing material in errors.
    const finishEvent = (values: Record<string, unknown>) => db
      .from('integration_events_outbox').update(values)
      .eq('id', event.id).eq('status', 'dispatched')
      .is('dispatched_at', null).eq('available_at', claimUntil)

    try {
      const payload = event.payload ?? {}
      const protectedPayload = typeof payload.campaignId === 'string'
        ? await protectIntegrationPayload(String(event.client_id), payload.campaignId, payload)
        : payload
      const eventPayload = {
        id: event.id,
        eventType: event.event_type,
        clientId: event.client_id,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        createdAt: event.created_at,
        data: protectedPayload,
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
        const { error: finishError } = await finishEvent({
          status: 'dispatched',
          dispatched_at: new Date().toISOString(),
          attempts: nextAttempts,
          last_error: null,
        })
        if (finishError) throw new Error('Unable to complete webhook event.')
        continue
      }

      let eventSucceeded = true

      for (const endpoint of endpoints) {
        if (Date.now() >= deadline) throw new Error('Webhook dispatch time budget exhausted.')
        const subscribedEvents = (endpoint.subscribed_events ?? []) as string[]
        if (subscribedEvents.length > 0 && !subscribedEvents.includes(event.event_type)) {
          continue
        }

        // Skip endpoints that already received a successful delivery for this event
        const { data: existingDelivery, error: deliveryLookupError } = await db
          .from('integration_webhook_deliveries')
          .select('id')
          .eq('integration_event_outbox_id', event.id)
          .eq('integration_webhook_endpoint_id', endpoint.id)
          .eq('status', 'delivered')
          .maybeSingle()

        if (deliveryLookupError) throw new Error('Unable to check prior webhook delivery.')
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
          try {
            responseBodyExcerpt = await readResponseTextWithLimit(
              response,
              MAX_WEBHOOK_RESPONSE_EXCERPT_BYTES,
            )
          } catch (error) {
            if (error instanceof RequestBodyTooLargeError) {
              responseBodyExcerpt = 'Webhook response body exceeded 1024 bytes'
            } else {
              throw error
            }
          }
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

        const { data: latestAttempt, error: attemptLookupError } = await db
          .from('integration_webhook_deliveries')
          .select('attempt_no')
          .eq('integration_event_outbox_id', event.id)
          .eq('integration_webhook_endpoint_id', endpoint.id)
          .order('attempt_no', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (attemptLookupError) throw new Error('Unable to check webhook attempts.')
        const attemptNo = Number(latestAttempt?.attempt_no ?? 0) + 1

        const { error: deliveryWriteError } = await db.from('integration_webhook_deliveries').insert({
          integration_webhook_endpoint_id: endpoint.id,
          integration_event_outbox_id: event.id,
          attempt_no: attemptNo,
          status: deliveryStatus,
          request_signature: signature,
          response_status: responseStatus,
          response_body_excerpt: responseBodyExcerpt,
          next_attempt_at:
            deliveryStatus === 'failed'
              ? new Date(Date.now() + EVENT_RETRY_DELAY_MS).toISOString()
              : null,
          delivered_at:
            deliveryStatus === 'delivered' ? new Date().toISOString() : null,
        })
        if (deliveryWriteError) throw new Error('Unable to record webhook delivery.')

        if (deliveryStatus === 'delivered') {
          await db
            .from('integration_webhook_endpoints')
            .update({ last_delivery_at: new Date().toISOString() })
            .eq('id', endpoint.id)
        }
      }

      const { error: finishError } = await finishEvent({
        status: eventSucceeded ? 'dispatched' : nextAttempts >= MAX_EVENT_ATTEMPTS ? 'failed' : 'pending',
        attempts: nextAttempts,
        dispatched_at: eventSucceeded ? new Date().toISOString() : null,
        available_at: eventSucceeded
          ? now
          : new Date(Date.now() + EVENT_RETRY_DELAY_MS).toISOString(),
        last_error: eventSucceeded ? null : 'One or more webhook deliveries failed.',
      })
      if (finishError) throw new Error('Unable to complete webhook event.')
    } catch {
      // Includes policy/endpoint lookups, decryption and persistence failures,
      // not only fetch errors. A denied policy lookup never sends the payload.
      try {
        const { error: retryError } = await finishEvent({
          status: nextAttempts >= MAX_EVENT_ATTEMPTS ? 'failed' : 'pending',
          attempts: nextAttempts,
          dispatched_at: null,
          available_at: new Date(Date.now() + EVENT_RETRY_DELAY_MS).toISOString(),
          last_error: 'Webhook event processing failed before completion.',
        })
        if (retryError) throw new Error('Unable to persist webhook retry.')
      } catch {
        // Leave the unfinished lease recoverable even if the database is down;
        // keep processing other candidates instead of losing a claimed batch.
        console.error('[integrations] webhook event recovery deferred to lease expiry', { eventId: event.id })
      }
    }
  }

  return {
    processed,
    delivered,
  }
}
