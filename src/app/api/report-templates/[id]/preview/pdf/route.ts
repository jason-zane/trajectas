import {
  AuthenticationRequiredError,
  AuthorizationError,
  canManageReportTemplateLibrary,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { generatePreviewPdf } from '@/lib/reports/preview-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: templateId } = await params
  const url = new URL(request.url)
  const assessmentId = url.searchParams.get('assessment')

  if (!assessmentId) {
    return Response.json(
      { error: 'assessment query param is required' },
      { status: 400 },
    )
  }

  try {
    const scope = await resolveAuthorizedScope()
    if (!canManageReportTemplateLibrary(scope)) {
      throw new AuthorizationError(
        'Only platform or partner administrators can download report previews.',
      )
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  try {
    const pdf = await generatePreviewPdf(templateId, assessmentId)
    return new Response(
      new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength),
      {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="template-${templateId}-preview.pdf"`,
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Preview PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
