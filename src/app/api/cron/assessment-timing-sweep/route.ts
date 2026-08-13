/**
 * Section-timing sweep cron.
 *
 * Runs every few minutes as the durable safety net for section finalisation:
 * finds participant_section_states rows whose deadline passed more than 10
 * minutes ago and are still unfinalised (the participant's tab closed,
 * crashed, or went offline right at the deadline, so the client-side
 * SectionTimer never got to call finaliseSection). All selection + update
 * logic lives in src/lib/assess/timing-sweep.ts; this route is just the
 * secured Vercel-cron entry point.
 *
 * Secured by the standard Vercel cron pattern: an Authorization: Bearer
 * ${CRON_SECRET} header, which Vercel injects automatically for scheduled
 * invocations. Scheduling is defined in vercel.json (`crons` array).
 */

import { NextResponse } from 'next/server'
import { sweepAssessmentTiming } from '@/lib/assess/timing-sweep'
import { reportError } from '@/lib/observability/report-error'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron:assessment-timing-sweep] CRON_SECRET not configured')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await sweepAssessmentTiming()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron:assessment-timing-sweep] sweep failed:', message)
    await reportError(err, {
      source: 'cron.assessment-timing-sweep',
      severity: 'error',
      alert: true,
      context: { phase: 'sweep' },
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
