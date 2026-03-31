import { requireAdminScope, AuthenticationRequiredError, AuthorizationError } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
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

  try {
    // Dependencies: npm install puppeteer-core @sparticuz/chromium
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium: any = await import('@sparticuz/chromium' as string).catch(() => { throw new Error('puppeteer-core/@sparticuz/chromium not installed') })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer: any = await import('puppeteer-core' as string).catch(() => { throw new Error('puppeteer-core not installed') })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const url = `${appUrl}/reports/${snapshotId}?format=print`

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    })

    const page = await browser.newPage()
    // Inject service-role auth cookie
    const serviceJwt = process.env.SUPABASE_SERVICE_JWT
    if (serviceJwt) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const host = new URL(supabaseUrl).host
      await page.setCookie({ name: 'sb-access-token', value: serviceJwt, domain: host })
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' } })
    await browser.close()

    // Upload to Supabase Storage
    const db = createAdminClient()
    const storagePath = `reports/${snapshotId}.pdf`
    const { error: uploadError } = await db.storage
      .from('reports')
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = db.storage.from('reports').getPublicUrl(storagePath)

    // Update snapshot with pdf_url
    await db
      .from('report_snapshots')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', snapshotId)

    return Response.json({ pdfUrl: urlData.publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
