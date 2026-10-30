import { PersonalityStandardReport } from '@/components/reports/custom/personality-standard/report'
import type { CustomReport } from './index'
import { buildPersonalityPreviewData, buildPersonalityReportData, PERSONALITY_INSTRUMENT_ID, PERSONALITY_REPORT_SLUG, type PersonalityReportData } from './personality-standard/data'

export const personalityStandardReport: CustomReport<PersonalityReportData> = {
  slug: PERSONALITY_REPORT_SLUG,
  label: 'Trajectas Personality Profile - Standard report',
  description: 'Nine-page personality results report with five dimensions, 30 traits and behavioural endpoints. No personalised narrative.',
  supportedInstrumentIds: [PERSONALITY_INSTRUMENT_ID],
  buildPreviewData: buildPersonalityPreviewData,
  buildData(ctx) {
    // The separate IPIP preparation workstream exposes this immutable result.
    // Current POMP-only envelopes deliberately fail the norm contract below.
    const result = (ctx as typeof ctx & { personalityResult?: unknown }).personalityResult
    const name = [ctx.session.firstName, ctx.session.lastName].filter(Boolean).join(' ')
    return buildPersonalityReportData(result, name, ctx.snapshot.created_at)
  },
  Component: PersonalityStandardReport,
}
