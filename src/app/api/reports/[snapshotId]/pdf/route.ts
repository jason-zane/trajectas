import { AuthenticationRequiredError, AuthorizationError, requireAdminScope } from '@/lib/auth/authorization'
import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createReportPdfToken } from '@/lib/reports/pdf-token'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  try {
    await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const { snapshotId } = await params

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
