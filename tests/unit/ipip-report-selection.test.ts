import { expect, it } from 'vitest'
import { selectIpipReportTemplateIds } from '@/lib/reports/personality-template-selection'

it('selects only registered personality reports in a mixed-assessment campaign', () => {
  const registry={leadership:{},personality:{supportedInstrumentIds:['ipip-neo-120-johnson-2014']},another:{supportedInstrumentIds:['another-instrument']}}
  expect(selectIpipReportTemplateIds([
    {id:'competency',custom_report_slug:'leadership'},
    {id:'native',custom_report_slug:'personality'},
    {id:'other',custom_report_slug:'another'},
    {id:'missing',custom_report_slug:'unknown'},
    {id:'generic',custom_report_slug:null},
  ],registry)).toEqual(['native'])
})
it('allows scoring to finish without inheriting an incompatible report while its personality report is being prepared', () => {
  expect(selectIpipReportTemplateIds([{id:'platform-default',custom_report_slug:'leadership'}],{leadership:{}})).toEqual([])
})
