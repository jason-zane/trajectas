/** Descriptive study preparation. This does not validate or publish a norm. */
export interface NormObservation {
  sessionId: string;
  personKey: string;
  completedAt: string;
  formHash: string;
  scores: Record<string, number>;
}
export interface StudyDistribution {
  sampleSize: number;
  mean: number;
  standardDeviation: number;
  /** Sorted POMP values retained to reproduce empirical lookup without a Gaussian assumption. */
  values: number[];
}
export function prepareNormStudy(observations: NormObservation[], expectedFactorIds: string[], minimumSampleSize: number) {
  if (!Number.isInteger(minimumSampleSize) || minimumSampleSize < 2) throw new Error('At least two observations are needed to compute a distribution.');
  if (expectedFactorIds.length !== 25 || new Set(expectedFactorIds).size !== 25) throw new Error('This study requires the complete 25-capability Five Brains instrument.');
  const sorted = [...observations].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.sessionId.localeCompare(b.sessionId));
  const people = new Set<string>();
  const included: NormObservation[] = [];
  let excludedIncomplete = 0, excludedRepeats = 0;
  for (const row of sorted) {
    if (!row.personKey || !row.formHash || expectedFactorIds.some(id => !Number.isFinite(row.scores[id]) || row.scores[id] < 0 || row.scores[id] > 100)) { excludedIncomplete++; continue; }
    if (people.has(row.personKey)) { excludedRepeats++; continue; }
    people.add(row.personKey);
    included.push(row);
  }
  if (new Set(included.map(row => row.formHash)).size > 1) throw new Error('Different administered forms cannot be pooled. Create a study for one frozen form version.');
  if (included.length < minimumSampleSize) throw new Error(`This study needs ${minimumSampleSize} eligible first administrations; ${included.length} are available. A sample floor alone does not establish validity.`);
  const distributions: Record<string, StudyDistribution> = {};
  for (const id of [...expectedFactorIds].sort()) {
    const values = included.map(row => row.scores[id]).sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const standardDeviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
    distributions[id] = { sampleSize: values.length, mean, standardDeviation, values };
  }
  return { included, distributions, excludedIncomplete, excludedRepeats, formHash: included[0].formHash };
}
