/**
 * Assessment resume-reminder sweep cron.
 *
 * Runs every few minutes and nudges participants who started an assessment but
 * went quiet, via a two-tier reminder (~5 min of inactivity, then ~24 h). All
 * selection + send logic lives in src/lib/assess/resume-reminders.ts; this
 * route is just the secured Vercel-cron entry point.
 *
 * Secured by the standard Vercel cron pattern: an Authorization: Bearer
 * ${CRON_SECRET} header, which Vercel injects automatically for scheduled
 * invocations. Scheduling is defined in vercel.json (`crons` array).
 */

import { NextResponse } from 'next/server'
import { sweepResumeReminders } from '@/lib/assess/resume-reminders'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron:assessment-resume-reminders] CRON_SECRET not configured')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await sweepResumeReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron:assessment-resume-reminders] sweep failed:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
