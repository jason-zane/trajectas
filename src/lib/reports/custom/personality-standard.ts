import { PersonalityStandardReport } from '@/components/reports/custom/personality-standard/report'
import type { CustomReport } from './index'
import { buildPersonalityPreviewData, PERSONALITY_INSTRUMENT_ID, PERSONALITY_REPORT_SLUG, type PersonalityReportData } from './personality-standard/data'
import { buildReferencedPersonalityReport } from './personality-standard/reference-adapter'
export const personalityStandardReport: CustomReport<PersonalityReportData> = {
  slug: PERSONALITY_REPORT_SLUG, label: 'Trajectas Personality Profile - Standard report',
  description: 'Nine-page personality results with five dimensions, 30 traits and a frozen norm reference.',
  supportedInstrumentIds: [PERSONALITY_INSTRUMENT_ID], supportsReferenceComparison: true,
  buildPreviewData: buildPersonalityPreviewData,
  buildData: buildReferencedPersonalityReport, Component: PersonalityStandardReport,
}
