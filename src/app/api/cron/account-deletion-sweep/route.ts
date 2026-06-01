/**
 * Nightly hard-delete sweep for accounts past their 30-day grace period.
 *
 * Stage B of the two-stage account deletion flow (Stage A is the user
 * action in src/app/actions/account-deletion.ts which schedules a row by
 * setting scheduled_deletion_at).
 *
 * For each profile where scheduled_deletion_at <= now():
 *   1. Write an account_deletion_audit row capturing email + timestamps,
 *      so we retain evidence after the cascade.
 *   2. Call auth.admin.deleteUser(profile.id). This cascades into
 *      public.profiles (FK is ON DELETE CASCADE) and the various
 *      attribution columns set to SET NULL by migration
 *      20260521140000_fk_on_delete_rules.sql.
 *
 * The endpoint is secured by Vercel's standard cron pattern: an
 * Authorization: Bearer ${CRON_SECRET} header is required. Vercel injects
 * this header automatically when invoking scheduled functions, using the
 * value of the CRON_SECRET project env var.
 *
 * Scheduling is defined in vercel.json (`crons` array).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportError } from '@/lib/observability/report-error'

export const runtime = 'nodejs'
export const maxDuration = 60

// Safety cap. If somehow tens of thousands of accounts ripen overnight,
// we'd rather process the first batch and let the next run mop up than
// burn the entire function budget on a single invocation.
const MAX_DELETIONS_PER_RUN = 200

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron:account-deletion-sweep] CRON_SECRET not configured')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: ripe, error: queryError } = await db
    .from('profiles')
    .select('id, email, deletion_requested_at, scheduled_deletion_at')
    .lte('scheduled_deletion_at', now)
    .not('scheduled_deletion_at', 'is', null)
    .limit(MAX_DELETIONS_PER_RUN)

  if (queryError) {
    await reportError(queryError, {
      source: 'cron.account-deletion',
      severity: 'fatal',
      alert: true,
      context: { phase: 'query' },
    })
    return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 })
  }

  if (!ripe || ripe.length === 0) {
    return NextResponse.json({ ok: true, swept: 0, errors: 0 })
  }

  let swept = 0
  const errors: Array<{ profileId: string; message: string }> = []

  for (const profile of ripe) {
    try {
      const { error: auditError } = await db.from('account_deletion_audit').insert({
        profile_id: profile.id,
        email: profile.email,
        deletion_requested_at: profile.deletion_requested_at,
        reason: 'user_requested',
      })
      if (auditError) {
        throw new Error(`audit insert failed: ${auditError.message}`)
      }

      const { error: deleteError } = await db.auth.admin.deleteUser(profile.id)
      if (deleteError) {
        throw new Error(`auth.admin.deleteUser failed: ${deleteError.message}`)
      }

      swept++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `[cron:account-deletion-sweep] profile ${profile.id} failed:`,
        message,
      )
      errors.push({ profileId: profile.id, message })
    }
  }

  if (errors.length > 0) {
    await reportError(
      new Error(
        `account-deletion sweep: ${errors.length}/${ripe.length} deletions failed`,
      ),
      {
        source: 'cron.account-deletion',
        severity: 'error',
        alert: true,
        context: { swept, failed: errors.length, errors },
      },
    )
  }

  return NextResponse.json({ ok: true, swept, errors: errors.length, errorDetails: errors })
}
