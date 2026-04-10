import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireReportSnapshotAccess,
} from '@/lib/auth/authorization'
import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createReportPdfToken } from '@/lib/reports/pdf-token'

export const runtime = 'nodejs'
export const maxDuration = 60

const REPORTS_BUCKET = 'reports'

async function ensureReportsBucket() {
  const db = createAdminClient()
  const { data: bucket, error } = await db.storage.getBucket(REPORTS_BUCKET)

  if (bucket && !error) {
    return db
  }

  const { error: createError } = await db.storage.createBucket(REPORTS_BUCKET, {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  })

  if (
    createError &&
    !createError.message.toLowerCase().includes('already exists')
  ) {
    throw createError
  }

  return db
}

async function respondWithStoredPdf(storagePath: string) {
  const db = createAdminClient()
  const { data, error } = await db.storage.from(REPORTS_BUCKET).download(storagePath)

  if (error || !data) {
    throw error ?? new Error('Stored PDF could not be downloaded')
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${storagePath.split('/').pop()}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params
  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get('refresh') === '1'
  const participantToken = url.searchParams.get('token')
  const storagePath = `reports/${snapshotId}.pdf`
  const db = createAdminClient()

  // Two auth paths: admin scope OR participant access token
  if (participantToken) {
    // Validate participant has access to this specific snapshot
    const { data: tokenData } = await db
      .from('campaign_participants')
      .select('id, campaign_id')
      .eq('access_token', participantToken)
      .maybeSingle()
    if (!tokenData) {
      return Response.json({ error: 'Invalid participant token' }, { status: 403 })
    }
    // Verify this snapshot belongs to the participant's session and is released
    const { data: validSnapshot } = await db
      .from('report_snapshots')
      .select('id, participant_sessions!inner(campaign_participant_id)')
      .eq('id', snapshotId)
      .eq('status', 'released')
      .eq('audience_type', 'participant')
      .maybeSingle()
    const session = Array.isArray(validSnapshot?.participant_sessions)
      ? validSnapshot.participant_sessions[0]
      : (validSnapshot?.participant_sessions as
          | { campaign_participant_id: string | null }
          | null
          | undefined)
    if (
      !validSnapshot ||
      !session ||
      String(session.campaign_participant_id) !== String(tokenData.id)
    ) {
      return Response.json({ error: 'Report not available' }, { status: 403 })
    }
  } else {
    try {
      await requireReportSnapshotAccess(snapshotId)
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error instanceof AuthorizationError) {
        return Response.json({ error: error.message }, { status: 403 })
      }
      throw error
    }
  }

  const { data: snapshot, error: snapshotError } = await db
    .from('report_snapshots')
    .select('id, status, pdf_url')
    .eq('id', snapshotId)
    .maybeSingle()

  if (snapshotError) {
    return Response.json({ error: snapshotError.message }, { status: 500 })
  }

  if (!snapshot) {
    return Response.json({ error: 'Report not found' }, { status: 404 })
  }

  if (!['ready', 'released'].includes(String(snapshot.status))) {
    return Response.json(
      { error: 'PDF is only available for ready or released reports' },
      { status: 409 }
    )
  }

  if (snapshot.pdf_url && !forceRefresh) {
    try {
      return await respondWithStoredPdf(storagePath)
    } catch {
      // Fall through to regeneration if the stored file has gone missing.
    }
  }

  let browser: Awaited<ReturnType<typeof launchReportPdfBrowser>> | null = null

  try {
    const appUrl =
      process.env.ADMIN_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3002'
    const pdfToken = createReportPdfToken(snapshotId)
    const url = `${appUrl}/reports/${snapshotId}?format=print&pdfToken=${encodeURIComponent(pdfToken)}`

    browser = await launchReportPdfBrowser()
    const page = await browser.newPage()
    await page.emulateMediaType('print')

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })
    if (!response || !response.ok()) {
      throw new Error(
        `Print render failed with status ${response?.status() ?? 'unknown'}`
      )
    }

    await page.waitForSelector('[data-print="true"]', { timeout: 10000 })
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await document.fonts.ready
      }
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    })
    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer

    const storage = await ensureReportsBucket()
    const { error: uploadError } = await storage.storage
      .from(REPORTS_BUCKET)
      .upload(storagePath, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      throw uploadError
    }

    // Store the private storage path (not a public URL) — consumers
    // generate short-lived signed URLs on demand via getSignedReportPdfUrl().
    const { error: updateError } = await storage
      .from('report_snapshots')
      .update({ pdf_url: storagePath })
      .eq('id', snapshotId)

    if (updateError) {
      throw updateError
    }

    return new Response(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${snapshotId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  } finally {
    await browser?.close()
  }
}
