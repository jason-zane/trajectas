import { createAdminClient } from '@/lib/supabase/admin'
import { getTechnicalReportData } from '@/lib/dal/instrument'
import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createInstrumentReportPdfToken } from '@/lib/reports/pdf-token'
import { requireAppUrl } from '@/lib/hosts'

/**
 * Generate a PDF of the technical report by rendering the print route
 * and capturing the output with Puppeteer.
 *
 * @param buildId The instrument build ID
 * @returns Buffer containing the PDF data
 */
export async function generateInstrumentReportPdf(buildId: string): Promise<Buffer> {
  const db = createAdminClient()
  const reportData = await getTechnicalReportData(db, buildId)

  if (!reportData) {
    throw new Error('Instrument build not found')
  }

  let browser: Awaited<ReturnType<typeof launchReportPdfBrowser>> | null = null

  try {
    const appUrl = requireAppUrl('admin')
    const pdfToken = createInstrumentReportPdfToken(buildId)
    const url = `${appUrl}/print/instrument-report/${buildId}?pdfToken=${encodeURIComponent(
      pdfToken,
    )}`

    browser = await launchReportPdfBrowser()
    const page = await browser.newPage()

    // Full A4 viewport at 96 dpi — cover page uses 100vh to fill the page
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
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    return Buffer.from(pdf)
  } finally {
    await browser?.close()
  }
}
