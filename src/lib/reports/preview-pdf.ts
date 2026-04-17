import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createPreviewPdfToken } from '@/lib/reports/preview-pdf-token'

function getAppUrl() {
  return (
    process.env.ADMIN_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3002'
  )
}

/**
 * Capture the report-template preview for a given assessment as a PDF buffer.
 * Mirrors the real report PDF flow but scoped by (templateId, assessmentId)
 * and does not persist to storage — preview PDFs are generated on demand.
 */
export async function generatePreviewPdf(
  templateId: string,
  assessmentId: string,
): Promise<Buffer> {
  const token = createPreviewPdfToken(templateId, assessmentId)
  const url =
    `${getAppUrl()}/print/report-templates/${templateId}/preview?format=print` +
    `&assessment=${encodeURIComponent(assessmentId)}` +
    `&pdfToken=${encodeURIComponent(token)}`

  const browser = await launchReportPdfBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 })
    await page.emulateMediaType('print')

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })
    if (!response || !response.ok()) {
      throw new Error(
        `Print render failed with status ${response?.status() ?? 'unknown'}`,
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
      margin: { top: '18mm', right: 0, bottom: '18mm', left: 0 },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
