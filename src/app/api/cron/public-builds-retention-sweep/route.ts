/**
 * Retention sweep for the public Role Builder: nulls public_builds.pd_text
 * 30 days after creation. Position descriptions can carry client detail
 * (see docs/superpowers/specs/2026-09-17-public-role-builder-design.md,
 * "Retention"); nothing else about the row is touched, so the funnel, the
 * ranking, and the created assessment/campaign links stay intact.
 *
 * Secured by Vercel's standard cron pattern: an Authorization: Bearer
 * ${CRON_SECRET} header, injected automatically for scheduled functions.
 * Scheduling is defined in vercel.json (`crons` array).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { reportError } from '@/lib/observability/report-error'

export const runtime = 'nodejs'
export const maxDuration = 60

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ROWS_PER_RUN = 500

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron:public-builds-retention-sweep] CRON_SECRET not configured')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = createAdminClient()
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()

  const { data: ripe, error: queryError } = await db
    .from('public_builds')
    .select('id')
    .lte('created_at', cutoff)
    .not('pd_text', 'is', null)
    .limit(MAX_ROWS_PER_RUN)

  if (queryError) {
    await reportError(queryError, {
      source: 'cron.public-builds-retention-sweep',
      severity: 'error',
      alert: true,
      context: {},
    })
    return new Response('Query failed', { status: 500 })
  }

  const ids = (ripe ?? []).map((row) => row.id as string)
  if (ids.length === 0) {
    return new Response(JSON.stringify({ swept: 0 }), { status: 200 })
  }

  const { error: updateError } = await db
    .from('public_builds')
    .update({ pd_text: null })
    .in('id', ids)

  if (updateError) {
    await reportError(updateError, {
      source: 'cron.public-builds-retention-sweep',
      severity: 'error',
      alert: true,
      context: { count: ids.length },
    })
    return new Response('Update failed', { status: 500 })
  }

  return new Response(JSON.stringify({ swept: ids.length }), { status: 200 })
}
