import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAuthorizedScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { generateGrowthReportPdf } from '@/lib/canvas/growth-pdf'
import { postgresUuid } from '@/lib/validations/uuid'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Streams the growth-report PDF for a snapshot. Authorisation: the caller
 * must be able to SELECT the snapshot under RLS (owner or member of the
 * snapshot's client) — the row read below runs on the cookie-scoped client.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ snapshotId: string }> },
): Promise<Response> {
  const { snapshotId } = await context.params
  if (!postgresUuid('Invalid snapshot ID').safeParse(snapshotId).success) {
    return NextResponse.json({ error: 'invalid_snapshot_id' }, { status: 400 })
  }

  const db = await createClient()
  const { data: snapshot, error } = await db
    .from('comparison_snapshots')
    .select('id, title, client_id')
    .eq('id', snapshotId)
    .maybeSingle()
  if (error || !snapshot) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const pdf = await generateGrowthReportPdf(snapshotId)

  after(async () => {
    try {
      const scope = await resolveAuthorizedScope()
      await logAuditEvent({
        actorProfileId: scope.actor?.id ?? null,
        eventType: 'trajectory.report_downloaded',
        targetTable: 'comparison_snapshots',
        targetId: snapshotId,
        clientId: snapshot.client_id ?? null,
        metadata: { title: snapshot.title },
      })
    } catch {
      // Audit logging must never break the download path.
    }
  })

  const safeTitle = String(snapshot.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="trajectas-growth-report-${safeTitle || 'snapshot'}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
