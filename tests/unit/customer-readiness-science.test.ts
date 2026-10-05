import { describe, expect, it, vi } from 'vitest';
import { validateDemographicAnswers } from '@/lib/experience/demographics';
import { mapCampaignParticipantRow } from '@/lib/supabase/mappers';
import { DEFAULT_DEMOGRAPHICS_CONFIG } from '@/lib/experience/defaults';
import { prepareNormStudy, type NormObservation } from '@/lib/psychometrics/norm-study';
import { aggregateToConstructs, scoreItems } from '@/lib/scoring/pipeline';
import { prepareConstructCalibration, type CalibrationResponseRow } from '@/lib/scoring/calibration-prep';
import type { ScoringItemMeta } from '@/types/scoring';
vi.mock('@/components/reports/custom/5brains/report', () => ({ FiveBrainsReport: () => null }));
import { fiveBrainsReport } from '@/lib/reports/custom/5brains';
import type { ReportContext, TaxonomyMap } from '@/lib/reports/report-context';

const ids = Array.from({ length: 25 }, (_, n) => `factor-${n}`);
const observation = (id: string, value: number, extra: Partial<NormObservation> = {}): NormObservation => ({ sessionId: id, personKey: id, formHash: 'frozen-v1', completedAt: `2026-10-05T00:00:00Z`, scores: Object.fromEntries(ids.map(id => [id, value])), ...extra });

describe('demographic collection contract', () => {
  it('validates configured options and records shown-but-unanswered optional fields', () => {
    const result = validateDemographicAnswers(DEFAULT_DEMOGRAPHICS_CONFIG, { gender: 'prefer-not-to-say' });
    expect(result).toMatchObject({ values: { gender: 'prefer-not-to-say', age_range: '' } });
  });
  it.each<Record<string, string>>([{ gender: 'invalid' }, { unconfigured: 'value' }, { ethnicity: 'white' }, { gender: 'x'.repeat(501) }])('rejects values outside the enabled collection form: %j', values => {
    expect(validateDemographicAnswers(DEFAULT_DEMOGRAPHICS_CONFIG, values)).toHaveProperty('error');
  });
  it('validates required text and unique field keys', () => {
    const fields = [{ key: 'department', label: 'Department', type: 'text' as const, required: true, enabled: true }];
    expect(validateDemographicAnswers({ fields }, { department: '  ' })).toHaveProperty('error');
    expect(validateDemographicAnswers({ fields: [...fields, ...fields] }, { department: 'HR' })).toHaveProperty('error');
    expect(validateDemographicAnswers({ fields }, { department: ' HR ' })).toEqual({ values: { department: 'HR' } });
  });
  it('preserves demographic values and completion in the participant DTO', () => {
    expect(mapCampaignParticipantRow({ id: 'p', demographics: { gender: 'prefer-not-to-say' }, demographics_completed_at: '2026-10-05' })).toMatchObject({ demographics: { gender: 'prefer-not-to-say' }, demographicsCompletedAt: '2026-10-05' });
  });
});

describe('future norm study mathematics', () => {
  it('retains an empirical distribution and calculates sample SD', () => {
    const result = prepareNormStudy([observation('b', 60), observation('a', 40)], ids, 2);
    expect(result.distributions[ids[0]]).toMatchObject({ sampleSize: 2, mean: 50, values: [40, 60] });
    expect(result.distributions[ids[0]].standardDeviation).toBeCloseTo(Math.sqrt(200));
  });
  it('uses the first complete administration per person, with a stable repeat policy', () => {
    const result = prepareNormStudy([observation('b', 90, { personKey: 'same', completedAt: '2026-10-06' }), observation('a', 40, { personKey: 'same', completedAt: '2026-10-05' }), observation('c', 60)], ids, 2);
    expect(result.included.map(row => row.sessionId)).toEqual(['a', 'c']);
    expect(result.excludedRepeats).toBe(1);
  });
  it('does not pool different frozen forms or imply a sample floor proves validity', () => {
    expect(() => prepareNormStudy([observation('a', 40), observation('b', 60, { formHash: 'another-version' })], ids, 2)).toThrow('Different administered forms');
    expect(() => prepareNormStudy([observation('a', 40)], ids, 100)).toThrow('does not establish validity');
  });
  it('excludes missing or invalid scores; zero variance remains descriptive', () => {
    const result = prepareNormStudy([observation('a', 50), observation('b', 50), observation('c', 200)], ids, 2);
    expect(result.excludedIncomplete).toBe(1);
    expect(result.distributions[ids[0]].standardDeviation).toBe(0);
  });
});

function context(): ReportContext {
  const taxonomy: TaxonomyMap = new Map(); const children = new Map<string, string[]>();
  const scores: Record<string, number> = {};
  for (const [index, slug] of ['red-brain', 'orange-brain', 'green-brain', 'blue-brain', 'pink-brain'].entries()) {
    const dim = `brain-${index}`; taxonomy.set(dim, { _taxonomy_level: 'dimension', slug, name: slug });
    const factors = ids.slice(index * 5, index * 5 + 5); children.set(dim, factors);
    for (const factor of factors) { taxonomy.set(factor, { _taxonomy_level: 'factor', name: factor }); scores[factor] = ids.indexOf(factor) % 2 ? 68.6 : 69.6; }
  }
  return { taxonomy, dimensionChildFactors: children, scores, session: {}, brandTheme: {}, resolveBand: (score: number) => ({ bandLabel: score >= 70 ? 'Upper' : 'Middle' }) } as unknown as ReportContext;
}
describe('Five Brains report integrity', () => {
  it('aggregates all 25 capabilities before rounding for display', async () => {
    const data = await fiveBrainsReport.buildData(context());
    expect(data.compositeScore).toBeCloseTo(69.12); expect(Math.round(data.compositeScore)).toBe(69);
    expect(data.brains[0].capabilities[0].score % 1).not.toBe(0);
  });
  it('withholds missing scores instead of substituting zero or omitting a capability', () => {
    const ctx = context(); delete ctx.scores[ids[0]];
    expect(() => fiveBrainsReport.buildData(ctx)).toThrow('missing or invalid');
    const incomplete = context(); incomplete.dimensionChildFactors.get('brain-0')!.pop();
    expect(() => fiveBrainsReport.buildData(incomplete)).toThrow('five scored capabilities');
  });
  it('uses the same weighted POMP for displayed scores and future norm transforms', () => {
    const items = new Map<string, ScoringItemMeta>([
      ['a', { id: 'a', constructId: 'c', responseFormatId: 'six', reverseScored: true, weight: 2, minValue: 1, maxValue: 6 }],
      ['b', { id: 'b', constructId: 'c', responseFormatId: 'six', reverseScored: false, weight: 1, minValue: 1, maxValue: 6 }],
    ]);
    const scored = scoreItems(new Map([['a', 2], ['b', 3]]), items);
    const result = aggregateToConstructs(scored, items, undefined, new Map([['c', { normGroupId: 'g', mean: 50, sd: 10 }]]))[0];
    expect(result.scores.pomp).toBeCloseTo(200 / 3);
    expect(result.scores.zScore).toBeCloseTo((200 / 3 - 50) / 10);
    expect(result.scores.raw).toBe(13);
  });
});


describe('calibration uses frozen administered forms', () => {
  const rows = (version = 'v1', start = 0): CalibrationResponseRow[] => Array.from({ length: 5 }, (_, index) => ['a', 'b'].map(itemId => ({ sessionId: `s${index + start}`, constructId: 'c', itemId, value: 3, minValue: 1, maxValue: 6, reverseScored: false, formItemIds: ['a', 'b', 'c'], formSignature: version }))).flat();
  it('does not invent a shorter form when every person omitted the same item', () => {
    const result = prepareConstructCalibration(rows())[0];
    expect(result.itemIds).toEqual(['a', 'b', 'c']);
    expect(result.completeSessions).toBe(0);
    expect(result.droppedIncompleteSessions).toBe(5);
  });
  it('does not pool identical item IDs from different frozen versions', () => {
    const complete = [...rows('v1'), ...rows('v2', 5)].map(row => ({ ...row, formItemIds: ['a', 'b'] }));
    expect(prepareConstructCalibration(complete)[0].completeSessions).toBe(5);
  });
});
