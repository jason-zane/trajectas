import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createReportPdfToken } from '@/lib/reports/pdf-token'
import { requireAppUrl } from '@/lib/hosts'

/**
 * Render a growth-report snapshot to PDF via the token-gated print route.
 * Unlike report PDFs there is no storage/status lifecycle — growth reports
 * are generated on demand and streamed straight back to the caller.
 */
export async function generateGrowthReportPdf(snapshotId: string): Promise<ArrayBuffer> {
  let browser: Awaited<ReturnType<typeof launchReportPdfBrowser>> | null = null
  try {
    const url = `${requireAppUrl('admin')}/print/trajectory/${snapshotId}?pdfToken=${encodeURIComponent(
      createReportPdfToken(snapshotId),
    )}`

    browser = await launchReportPdfBrowser()
    const page = await browser.newPage()
    // Full A4 viewport at 96 dpi.
    await page.setViewport({ width: 794, height: 1123 })
    await page.emulateMediaType('print')

    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    if (!response || !response.ok()) {
      throw new Error(`Print render failed with status ${response?.status() ?? 'unknown'}`)
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
    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
  } finally {
    await browser?.close()
  }
}
