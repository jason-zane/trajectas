import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireReportSnapshotAccess,
} from '@/lib/auth/authorization'
import {
  generateAndStoreReportPdf,
  getReportPdfFilename,
  getSnapshotPdfState,
  mapReportPdfStatus,
  queueReportPdfGeneration,
} from '@/lib/reports/pdf'
import { verifyReportAccessToken } from '@/lib/reports/report-access-token'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  parseOptionalJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const runtime = 'nodejs'
export const maxDuration = 60

const REPORTS_BUCKET = 'reports'
const MAX_PDF_POST_BODY_BYTES = 8 * 1024

type PdfAccess = Awaited<ReturnType<typeof requireReportSnapshotAccess>>

async function requirePdfAccess(
  snapshotId: string,
): Promise<{ error: Response } | { access: PdfAccess }> {
  try {
    const access = await requireReportSnapshotAccess(snapshotId)
    return { access }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { error: Response.json({ error: 'Authentication required' }, { status: 401 }) }
    }
    if (error instanceof AuthorizationError) {
      return { error: Response.json({ error: error.message }, { status: 403 }) }
    }
    throw error
  }
}

async function respondWithStoredPdf(storagePath: string, filename: string) {
  const db = createAdminClient()
  const { data, error } = await db.storage.from(REPORTS_BUCKET).download(storagePath)

  if (error || !data) {
    throw error ?? new Error('Stored PDF could not be downloaded')
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function validateReportTokenAccess(
  snapshotId: string,
  reportToken: string | null,
) {
  const tokenPayload = verifyReportAccessToken(reportToken, snapshotId)
  if (!tokenPayload) {
    return Response.json({ error: 'Invalid report token' }, { status: 403 })
  }

  const db = createAdminClient()
  const { data: validSnapshot } = await db
    .from('report_snapshots')
    .select('id, participant_sessions!inner(campaign_participant_id)')
    .eq('id', snapshotId)
    .eq('status', 'released')
    .maybeSingle()

  const session = Array.isArray(validSnapshot?.participant_sessions)
    ? validSnapshot.participant_sessions[0]
    : (validSnapshot?.participant_sessions as
        | { campaign_participant_id: string | null }
        | null
        | undefined)

  if (
    !validSnapshot ||
    !session?.campaign_participant_id ||
    String(session.campaign_participant_id) !== tokenPayload.participantId
  ) {
    return Response.json({ error: 'Report not available' }, { status: 403 })
  }

  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params
  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get('refresh') === '1'
  const participantToken = url.searchParams.get('token')
  const reportToken = url.searchParams.get('reportToken')
  const storagePath = `reports/${snapshotId}.pdf`
  const db = createAdminClient()

  // Two auth paths: admin scope OR participant access token
  if (participantToken) {
    // Validate participant has access to this specific snapshot
    const { data: tokenData, error: tokenError } = await db
      .from('campaign_participants')
      .select('id, campaign_id')
      .eq('access_token', participantToken)
      .maybeSingle()
    if (tokenError || !tokenData) {
      return Response.json({ error: 'Invalid participant token' }, { status: 403 })
    }
    // Verify this snapshot belongs to the participant's session and is released
    const { data: validSnapshot, error: snapshotError } = await db
      .from('report_snapshots')
      .select('id, participant_sessions!inner(campaign_participant_id)')
      .eq('id', snapshotId)
      .eq('status', 'released')
      .maybeSingle()
    if (snapshotError || !validSnapshot) {
      return Response.json({ error: 'Report not available' }, { status: 403 })
    }
    const session = Array.isArray(validSnapshot.participant_sessions)
      ? validSnapshot.participant_sessions[0]
      : (validSnapshot.participant_sessions as
          | { campaign_participant_id: string | null }
          | null
          | undefined)
    if (
      !session ||
      String(session.campaign_participant_id) !== String(tokenData.id)
    ) {
      return Response.json({ error: 'Report not available' }, { status: 403 })
    }
  } else if (reportToken) {
    const tokenError = await validateReportTokenAccess(snapshotId, reportToken)
    if (tokenError) {
      return tokenError
    }
  } else {
    const result = await requirePdfAccess(snapshotId)
    if ('error' in result) {
      return result.error
    }
    // Audit privileged (admin/consultant) access to a participant's report.
    // Logged via after() so it never blocks or breaks the download.
    const { access } = result
    after(() =>
      logAuditEvent({
        actorProfileId: access.scope.actor?.id ?? null,
        eventType: 'report.pdf_downloaded',
        targetTable: 'report_snapshots',
        targetId: snapshotId,
        clientId: access.clientId,
        partnerId: access.partnerId,
        metadata: { participantId: access.participantId },
      }).catch(() => {}),
    )
  }

  const snapshot = await getSnapshotPdfState(snapshotId)
  if (!snapshot) {
    return Response.json({ error: 'Report not found' }, { status: 404 })
  }

  if (!['ready', 'released'].includes(String(snapshot.status))) {
    return Response.json(
      { error: 'PDF is only available for ready or released reports' },
      { status: 409 }
    )
  }

  const filename = await getReportPdfFilename(snapshotId)

  let shouldForceRefresh = forceRefresh
  if (snapshot.pdf_url && !forceRefresh) {
    try {
      return await respondWithStoredPdf(storagePath, filename)
    } catch {
      // Fall through to regeneration if the stored file has gone missing.
      shouldForceRefresh = true
    }
  }

  const pdfState = mapReportPdfStatus(snapshot, snapshotId)
  if (pdfState.status === 'queued' || pdfState.status === 'generating') {
    return Response.json(
      {
        error: 'PDF generation is already in progress',
        status: pdfState.status,
      },
      { status: 409 },
    )
  }

  try {
    const generated = await generateAndStoreReportPdf(snapshotId, {
      forceRefresh: shouldForceRefresh,
    })

    if (!generated) {
      return await respondWithStoredPdf(storagePath, filename)
    }

    return new Response(generated.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params
  const url = new URL(request.url)
  const reportToken = url.searchParams.get('reportToken')

  if (reportToken) {
    const tokenError = await validateReportTokenAccess(snapshotId, reportToken)
    if (tokenError) {
      return tokenError
    }
  } else {
    const result = await requirePdfAccess(snapshotId)
    if ('error' in result) {
      return result.error
    }
  }

  try {
    const body = await parseOptionalJsonRequestWithLimit<{
      forceRefresh?: boolean
    }>(request, MAX_PDF_POST_BODY_BYTES, {})

    const queued = await queueReportPdfGeneration(snapshotId)
    if (queued.queued) {
      after(async () => {
        try {
          await generateAndStoreReportPdf(snapshotId, {
            forceRefresh: body.forceRefresh,
          })
        } catch (error) {
          console.error(`[reports] PDF generation failed for ${snapshotId}:`, error)
        }
      })
    }

    return Response.json({
      jobId: queued.jobId,
      status: queued.status,
      pdfUrl: queued.pdfUrl,
      error: queued.error,
    })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body too large' }, { status: 413 })
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    const message =
      error instanceof Error ? error.message : 'Failed to queue PDF generation'
    return Response.json({ error: message }, { status: 500 })
  }
}
