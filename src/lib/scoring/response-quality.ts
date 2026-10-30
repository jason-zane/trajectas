import 'server-only'
import { QUALITY_MODULE_VERSION, INTEGRATED_QUALITY_MODULE_VERSION, QUALITY_POLICY_VERSION, QUALITY_QUESTIONS, type QualityIndicator, type ResponseQualityResult } from '@/lib/instrument/ipip-neo-120/response-quality'

export interface QualityCoreResponse { value: number; timeMs: number | null }
/** Pilot review rules, not a validated lie scale or a diagnostic classification.
 * Input is the canonical IPIP order, BEFORE reverse scoring/display transforms.
 * No trait score, norm, report snapshot or hiring decision is modified here.
 */
export function analyseResponseQuality(core: readonly QualityCoreResponse[], module: { version: string; answers: Record<string, number> } | null): ResponseQualityResult {
  if (core.length !== 120 || core.some(r => !Number.isInteger(r.value) || r.value < 1 || r.value > 5)) throw new Error('Response quality requires the complete native IPIP responses')
  if (module && module.version !== QUALITY_MODULE_VERSION && module.version !== INTEGRATED_QUALITY_MODULE_VERSION) throw new Error('Unsupported response-quality module')
  const answers = module?.answers ?? {}
  const indicator = (id: QualityIndicator['id'], label: string, ids: string[], flagged: (values: number[]) => number, threshold: number, description: string): QualityIndicator => {
    const values = ids.map(key => answers[key])
    const complete = values.every(value => Number.isInteger(value) && value >= 1 && value <= 5)
    const observed = complete ? flagged(values) : null
    return { id, label, status: observed == null ? 'unavailable' : observed >= threshold ? 'flagged' : 'clear', observed, denominator: ids.length,
      detail: observed == null ? 'These supplementary questions were not fully administered.' : `${observed} of ${ids.length} ${description}` }
  }
  let longestRun = 0, run = 0, last: number | null = null
  for (const response of core) { run = response.value === last ? run + 1 : 1; last = response.value; longestRun = Math.max(longestRun, run) }
  const timings = core.map(r => r.timeMs).filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
  const fastCount = timings.filter(value => value < 1000).length
  const enoughTiming = timings.length >= 100
  const indicators: QualityIndicator[] = [
    indicator('attention', 'Instruction checks', ['attention_agree', 'attention_disagree'], values => Number(values[0] !== (module?.version === INTEGRATED_QUALITY_MODULE_VERSION ? 5 : 4)) + Number(values[1] !== 1), 1, 'instructions missed.'),
    indicator('infrequency', 'Implausible endorsements', ['infrequency_sleep', 'infrequency_languages'], values => values.filter(v => v >= 4).length, 1, 'implausible statements endorsed.'),
    indicator('presentation', 'Idealised self-description', QUALITY_QUESTIONS.filter(q => q.id.startsWith('presentation_')).map(q => q.id), values => values.filter(v => v === 5).length, 4, 'absolute positive statements strongly endorsed. This is not evidence of dishonesty.'),
    { id: 'repetition', label: 'Repeated answers', status: longestRun >= 20 ? 'flagged' : 'clear', observed: longestRun, denominator: 120, detail: `Longest consecutive run of the same answer: ${longestRun} items. The pilot review threshold is 20.` },
    { id: 'timing', label: 'Response timing', status: !enoughTiming ? 'unavailable' : fastCount / timings.length > 0.5 ? 'flagged' : 'clear', observed: enoughTiming ? fastCount : null, denominator: timings.length,
      detail: enoughTiming ? `${fastCount} of ${timings.length} recorded responses were under one second. Timing is device-reported and may include revisits.` : `Usable timing available for ${timings.length} of 120 items; at least 100 are required for this check.` },
  ]
  return { policyVersion: QUALITY_POLICY_VERSION, moduleVersion: module?.version as ResponseQualityResult['moduleVersion'] ?? null, provisional: true, indicators,
    status: indicators.some(i => i.status === 'flagged') ? 'review_recommended' : indicators.some(i => i.status === 'unavailable') ? 'insufficient_information' : 'no_concerns_detected' }
}
