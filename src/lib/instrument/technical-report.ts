/**
 * Technical Report: Pure assembly of instrument validation evidence.
 *
 * Builds a comprehensive, customer-facing validation document from already-fetched
 * inputs. All calculations are pure (no I/O, no DB, no network). Every claim in the
 * report carries an evidence class — a_priori, synthetic, or empirical — so the
 * renderer can label and segregate forecasts from observations.
 *
 * @module
 */

import type { EvidenceClass, EvidenceRecord, Blueprint, BlueprintCell } from './types';
import type { PanelResult, ConstructSummary } from './congruence';
import type { AlphaForecast } from './reliability';

// ---------------------------------------------------------------------------
// Report Structure Types
// ---------------------------------------------------------------------------

export interface EvidenceClaim<T> {
  /** The value or computed result */
  value: T;
  /** Classification: a_priori (forecasted), synthetic (simulated), empirical (observed) */
  evidenceClass: EvidenceClass;
  /** Human-readable label describing the evidence basis */
  label: string;
  /** Confidence: none | low | moderate | high */
  confidence: 'none' | 'low' | 'moderate' | 'high';
  /** Optional interval [low, high] for numeric values */
  interval?: [number, number];
  /** Sample size backing this claim, if any */
  sampleSize?: number;
}

export interface IdentitySection {
  instrumentName: string;
  measureType: string;
  audience?: string;
  useContext?: string;
  buildId: string;
  generatedAt: Date;
}

export interface SpecificationConstruct {
  constructId: string;
  constructName: string;
  definition?: string;
  exclusions?: string[];
  facetGrid: Array<{
    facetLabel: string;
    intensity: 'low' | 'mid' | 'high';
    targetCount: number;
    actualCount: number;
    deficit: number;
    surplus: number;
  }>;
  totalTargetItems: EvidenceClaim<number>;
  totalActualItems: EvidenceClaim<number>;
}

export interface SpecificationSection {
  constructs: SpecificationConstruct[];
  totalInstrumentItems: EvidenceClaim<number>;
  orphanedItemCount: EvidenceClaim<number>;
}

export interface ContentValidityConstruct {
  constructId: string;
  constructName: string;
  itemCount: EvidenceClaim<number>;
  assignmentAccuracy: EvidenceClaim<number>;
  aikenV: EvidenceClaim<number>;
  passRate: EvidenceClaim<number>;
  confusionPairs: Array<{
    intendedConstruct: string;
    confusedWith: string;
    count: number;
  }>;
}

export interface ContentValiditySection {
  constructs: ContentValidityConstruct[];
  overall: {
    itemCount: EvidenceClaim<number>;
    assignmentAccuracy: EvidenceClaim<number>;
    aikenV: EvidenceClaim<number>;
    passRate: EvidenceClaim<number>;
    fleissKappa: EvidenceClaim<number>;
  };
}

export interface DiscriminantEvidencePair {
  construct1: string;
  construct2: string;
  overlap: EvidenceClaim<number>;
  interpretationNote: string;
}

export interface DiscriminantEvidenceSection {
  pairs: DiscriminantEvidencePair[];
  platformCaveat: string;
}

export interface FairnessItem {
  itemId: string;
  flags: string[];
  remediationState: 'flagged' | 'reviewed' | 'remediated';
  note?: string;
}

export interface FairnessSection {
  itemsReviewed: EvidenceClaim<number>;
  flaggedItems: FairnessItem[];
  categories: Record<string, { count: number; affectedItems: string[] }>;
}

export interface ReliabilitySection {
  alpha: EvidenceClaim<{
    point: number;
    interval?: [number, number];
  }>;
  meanInterItemR: EvidenceClaim<{
    point: number;
    interval?: [number, number];
  }>;
  coherence: string;
  shrinkageNote?: string;
  observedAlpha?: EvidenceClaim<{
    point: number;
    interval?: [number, number];
  }>;
  warnings: Array<{ level: 'warn' | 'caution'; message: string }>;
}

export interface ProvenanceSection {
  totalItems: EvidenceClaim<number>;
  itemsAssignedToBlueprint: EvidenceClaim<number>;
  orphanedItems: EvidenceClaim<number>;
  itemVersioning: {
    originalCount: number;
    revisedCount: number;
  };
}

export interface LimitationsSection {
  claims: Array<{
    claim: string;
    evidenceClass: EvidenceClass;
    sampleSizeProvided?: number;
    sampleSizeNeeded?: number;
  }>;
  validationStatus: 'designed_to_standard' | 'piloting' | 'calibrated';
  minSampleSizeForAlpha: number;
  minSampleSizeForIrtDif: number;
}

export interface TechnicalReport {
  id: string;
  identity: IdentitySection;
  specification: SpecificationSection;
  contentValidity: ContentValiditySection;
  discriminantEvidence: DiscriminantEvidenceSection;
  fairness: FairnessSection;
  reliability: ReliabilitySection;
  provenance: ProvenanceSection;
  limitations: LimitationsSection;
}

// ---------------------------------------------------------------------------
// Builder Input Types
// ---------------------------------------------------------------------------

export interface TechnicalReportInput {
  buildId: string;
  instrumentName: string;
  measureType: string;
  audience?: string;
  useContext?: string;
  generatedAt: Date;
  blueprints: Blueprint[];
  blueprintCells: BlueprintCell[];
  candidateItems: Array<{
    id: string;
    blueprintCellId?: string | null;
    stem: string;
    status: string;
  }>;
  congruenceResult?: PanelResult | null;
  fairnessResults?: Array<{
    id: string;
    flags: string[];
    note?: string;
  }>;
  /**
   * Display names per blueprint id. The shared Blueprint type carries only a
   * constructId, so without this the report prints raw UUIDs as construct
   * names — which is unusable in a customer-facing document.
   */
  constructNames?: Record<string, string>;
  evidenceRecords: EvidenceRecord[];
  discriminantScores?: Array<{
    construct1: string;
    construct2: string;
    cosineSimilarity: number;
  }>;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createEvidenceClaim<T>(
  value: T,
  evidenceClass: EvidenceClass,
  sampleSize?: number
): EvidenceClaim<T> {
  const label = sampleSize
    ? `${evidenceClass === 'a_priori' ? 'forecast' : evidenceClass === 'synthetic' ? 'simulated' : 'observed'} (n=${sampleSize})`
    : evidenceClass === 'a_priori'
      ? 'forecast (no data)'
      : evidenceClass === 'synthetic'
        ? 'simulated'
        : 'observed';

  const confidence: 'none' | 'low' | 'moderate' | 'high' =
    evidenceClass === 'a_priori'
      ? 'none'
      : evidenceClass === 'synthetic'
        ? 'low'
        : sampleSize !== undefined
          ? sampleSize < 50
            ? 'low'
            : sampleSize < 150
              ? 'moderate'
              : 'high'
          : 'moderate';

  return {
    value,
    evidenceClass,
    label,
    confidence,
    sampleSize,
  };
}

function countItemsInBlueprint(
  candidateItems: Array<{ blueprintCellId?: string | null }>,
  blueprintIds: string[]
): number {
  const blueprintIdSet = new Set(blueprintIds);
  return candidateItems.filter(
    (item) => item.blueprintCellId && blueprintIdSet.has(item.blueprintCellId)
  ).length;
}

// ---------------------------------------------------------------------------
// Section Builders
// ---------------------------------------------------------------------------

function buildIdentitySection(input: TechnicalReportInput): IdentitySection {
  return {
    instrumentName: input.instrumentName,
    measureType: input.measureType,
    audience: input.audience,
    useContext: input.useContext,
    buildId: input.buildId,
    generatedAt: input.generatedAt,
  };
}

function buildSpecificationSection(
  input: TechnicalReportInput
): SpecificationSection {
  const constructs: SpecificationConstruct[] = [];

  for (const blueprint of input.blueprints) {
    const cellsInBlueprint = input.blueprintCells.filter(
      (cell) => cell.id && blueprint.cells.some((c) => c.id === cell.id)
    );

    const facetGrid = cellsInBlueprint.map((cell) => {
      const targetCount = cell.targetItemCount;
      const actualCount = input.candidateItems.filter(
        (item) => item.blueprintCellId === cell.id
      ).length;

      return {
        facetLabel: cell.facetLabel,
        intensity: cell.intensity,
        targetCount,
        actualCount,
        deficit: Math.max(0, targetCount - actualCount),
        surplus: Math.max(0, actualCount - targetCount),
      };
    });

    const totalTargetItems = facetGrid.reduce((sum, f) => sum + f.targetCount, 0);
    const totalActualItems = facetGrid.reduce((sum, f) => sum + f.actualCount, 0);

    constructs.push({
      constructId: blueprint.constructId,
      constructName: input.constructNames?.[blueprint.id] ?? blueprint.constructId,
      facetGrid,
      totalTargetItems: createEvidenceClaim(totalTargetItems, 'a_priori'),
      totalActualItems: createEvidenceClaim(totalActualItems, 'a_priori'),
    });
  }

  const totalInstrumentItems = input.candidateItems.length;
  const assignedItems = countItemsInBlueprint(
    input.candidateItems,
    input.blueprintCells.map((c) => c.id)
  );
  const orphanedItems = totalInstrumentItems - assignedItems;

  return {
    constructs,
    totalInstrumentItems: createEvidenceClaim(totalInstrumentItems, 'a_priori'),
    orphanedItemCount: createEvidenceClaim(orphanedItems, 'a_priori'),
  };
}

function buildContentValiditySection(
  input: TechnicalReportInput
): ContentValiditySection {
  const constructs: ContentValidityConstruct[] = [];

  if (!input.congruenceResult) {
    // No congruence run; all claims are a_priori
    for (const blueprint of input.blueprints) {
      constructs.push({
        constructId: blueprint.constructId,
        constructName: input.constructNames?.[blueprint.id] ?? blueprint.constructId,
        itemCount: createEvidenceClaim(
          blueprint.cells.reduce((sum, c) => sum + c.targetItemCount, 0),
          'a_priori'
        ),
        assignmentAccuracy: createEvidenceClaim(NaN, 'a_priori'),
        aikenV: createEvidenceClaim(NaN, 'a_priori'),
        passRate: createEvidenceClaim(NaN, 'a_priori'),
        confusionPairs: [],
      });
    }

    return {
      constructs,
      overall: {
        itemCount: createEvidenceClaim(0, 'a_priori'),
        assignmentAccuracy: createEvidenceClaim(NaN, 'a_priori'),
        aikenV: createEvidenceClaim(NaN, 'a_priori'),
        passRate: createEvidenceClaim(NaN, 'a_priori'),
        fleissKappa: createEvidenceClaim(NaN, 'a_priori'),
      },
    };
  }

  const summaryMap = new Map<string, ConstructSummary>();
  for (const summary of input.congruenceResult.constructSummaries) {
    summaryMap.set(summary.constructId, summary);
  }

  for (const summary of input.congruenceResult.constructSummaries) {
    // Identify confusion pairs for this construct
    const confusionPairs: Array<{ intendedConstruct: string; confusedWith: string; count: number }> = [];
    const row = input.congruenceResult.confusion[summary.constructId] || {};
    for (const [assignedId, count] of Object.entries(row)) {
      if (assignedId !== summary.constructId && count > 0) {
        confusionPairs.push({
          intendedConstruct: summary.constructId,
          confusedWith: assignedId,
          count: count as number,
        });
      }
    }

    constructs.push({
      constructId: summary.constructId,
      constructName: input.constructNames?.[summary.constructId] ?? summary.constructId,
      itemCount: createEvidenceClaim(
        summary.itemCount,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      assignmentAccuracy: createEvidenceClaim(
        summary.meanAccuracy,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      aikenV: createEvidenceClaim(
        summary.meanAikenV,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      passRate: createEvidenceClaim(
        summary.passRate,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      confusionPairs,
    });
  }

  return {
    constructs,
    overall: {
      itemCount: createEvidenceClaim(
        input.congruenceResult.overall.itemCount,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      assignmentAccuracy: createEvidenceClaim(
        input.congruenceResult.overall.meanAccuracy,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      aikenV: createEvidenceClaim(
        input.congruenceResult.overall.meanAikenV,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      passRate: createEvidenceClaim(
        input.congruenceResult.overall.passRate,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
      fleissKappa: createEvidenceClaim(
        input.congruenceResult.fleissKappa,
        'empirical',
        input.congruenceResult.overall.raterCount
      ),
    },
  };
}

function buildDiscriminantEvidenceSection(
  input: TechnicalReportInput
): DiscriminantEvidenceSection {
  const pairs: DiscriminantEvidencePair[] = [];

  if (input.discriminantScores && input.discriminantScores.length > 0) {
    for (const score of input.discriminantScores) {
      pairs.push({
        construct1: score.construct1,
        construct2: score.construct2,
        overlap: createEvidenceClaim(score.cosineSimilarity, 'synthetic'),
        interpretationNote: `Embedding cosine similarity = ${score.cosineSimilarity.toFixed(3)}. Higher values indicate more item-wording overlap.`,
      });
    }
  }

  return {
    pairs,
    platformCaveat:
      'On this platform\'s own construct inventories, same-construct vs different-construct embedding separation measures Cohen\'s d ≈ 0.63–1.03, which does not establish distinctness on its own. This heuristic flags potential item-wording overlap only; it does not validate construct independence.',
  };
}

function buildFairnessSection(input: TechnicalReportInput): FairnessSection {
  const flaggedItems: FairnessItem[] = [];
  const categories: Record<string, { count: number; affectedItems: string[] }> = {};

  if (input.fairnessResults) {
    for (const result of input.fairnessResults) {
      if (result.flags.length > 0) {
        flaggedItems.push({
          itemId: result.id,
          flags: result.flags,
          remediationState: 'flagged',
          note: result.note,
        });

        for (const flag of result.flags) {
          if (!categories[flag]) {
            categories[flag] = { count: 0, affectedItems: [] };
          }
          categories[flag].count++;
          categories[flag].affectedItems.push(result.id);
        }
      }
    }
  }

  return {
    itemsReviewed: createEvidenceClaim(
      input.fairnessResults?.length ?? 0,
      'a_priori'
    ),
    flaggedItems,
    categories,
  };
}

function buildReliabilitySection(
  input: TechnicalReportInput,
  alphaForecast?: AlphaForecast
): ReliabilitySection {
  const warnings = (alphaForecast?.warnings ?? []).slice();

  const alphaValue = alphaForecast?.predictedAlpha ?? NaN;
  const alphaInterval = alphaForecast?.interval;
  const meanRValue = alphaForecast?.meanInterItemR ?? NaN;
  const meanRInterval = alphaForecast?.meanInterItemRInterval;
  const basis = alphaForecast?.basis ?? 'facet_prior';

  // If no forecast provided, add a default caution
  if (!alphaForecast) {
    warnings.push({
      level: 'caution',
      message: 'No empirical or synthetic data provided. Using facet-count prior; confidence is lower.',
    });
  }

  return {
    alpha: createEvidenceClaim(
      {
        point: alphaValue,
        interval: alphaInterval && Number.isFinite(alphaInterval[0]) ? alphaInterval : undefined,
      },
      'a_priori'
    ),
    meanInterItemR: createEvidenceClaim(
      {
        point: meanRValue,
        interval:
          meanRInterval && Number.isFinite(meanRInterval[0]) ? meanRInterval : undefined,
      },
      'a_priori'
    ),
    coherence: alphaForecast?.coherence ?? 'incoherent',
    shrinkageNote:
      basis === 'facet_prior'
        ? 'Using facet-count prior (no synthetic item data provided). Confidence interval is conservative.'
        : 'Shrinkage factors (point=0.60, low=0.45, high=0.75) applied to synthetic inter-item correlations per Clark & Watson (1995).',
    warnings,
  };
}

function buildProvenanceSection(input: TechnicalReportInput): ProvenanceSection {
  const totalItems = input.candidateItems.length;
  const assignedItems = countItemsInBlueprint(
    input.candidateItems,
    input.blueprintCells.map((c) => c.id)
  );
  const orphanedItems = totalItems - assignedItems;

  return {
    totalItems: createEvidenceClaim(totalItems, 'a_priori'),
    itemsAssignedToBlueprint: createEvidenceClaim(assignedItems, 'a_priori'),
    orphanedItems: createEvidenceClaim(orphanedItems, 'a_priori'),
    itemVersioning: {
      originalCount: input.candidateItems.filter(
        (item) => item.status !== 'revised'
      ).length,
      revisedCount: input.candidateItems.filter(
        (item) => item.status === 'revised'
      ).length,
    },
  };
}

function buildLimitationsSection(
  input: TechnicalReportInput,
  hasCongruenceData: boolean,
  hasEmpiricalAlpha: boolean
): LimitationsSection {
  const claims: Array<{
    claim: string;
    evidenceClass: EvidenceClass;
    sampleSizeProvided?: number;
    sampleSizeNeeded?: number;
  }> = [];

  // Add a_priori claims
  claims.push({
    claim: 'Specification (facet × intensity coverage)',
    evidenceClass: 'a_priori',
  });

  if (!hasCongruenceData) {
    claims.push({
      claim: 'Content validity (assignment accuracy, Aiken\'s V, Fleiss\' kappa)',
      evidenceClass: 'a_priori',
      sampleSizeNeeded: 10, // At least 1 rater per item; 3+ recommended
    });
  } else {
    const congruenceRaters = input.congruenceResult?.overall.raterCount ?? 0;
    claims.push({
      claim: 'Content validity (assignment accuracy, Aiken\'s V, Fleiss\' kappa)',
      evidenceClass: 'empirical',
      sampleSizeProvided: congruenceRaters,
    });
  }

  claims.push({
    claim: 'Reliability (Cronbach\'s alpha)',
    evidenceClass: 'a_priori',
    sampleSizeNeeded: 50,
  });

  if (hasEmpiricalAlpha) {
    claims.push({
      claim: 'Reliability (Cronbach\'s alpha, observed)',
      evidenceClass: 'empirical',
      sampleSizeProvided: input.congruenceResult?.overall.itemCount,
    });
  }

  const validationStatus: 'designed_to_standard' | 'piloting' | 'calibrated' =
    hasEmpiricalAlpha && (input.congruenceResult?.overall.itemCount ?? 0) >= 200
      ? 'calibrated'
      : hasEmpiricalAlpha
        ? 'piloting'
        : 'designed_to_standard';

  return {
    claims,
    validationStatus,
    minSampleSizeForAlpha: 50,
    minSampleSizeForIrtDif: 200,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete technical report from pre-fetched inputs.
 * All calculations are pure; no I/O or side effects.
 *
 * @param input TechnicalReportInput with all required data
 * @param alphaForecast Optional alpha forecast for reliability section
 * @returns TechnicalReport ready for rendering
 */
export function buildTechnicalReport(
  input: TechnicalReportInput,
  alphaForecast?: AlphaForecast
): TechnicalReport {
  const hasCongruenceData = !!input.congruenceResult;
  const hasEmpiricalAlpha = !!input.evidenceRecords.find(
    (r) => r.targetType === 'instrument' && r.claim === 'alpha' && r.evidenceClass === 'empirical'
  );

  return {
    id: `report-${input.buildId}-${input.generatedAt.getTime()}`,
    identity: buildIdentitySection(input),
    specification: buildSpecificationSection(input),
    contentValidity: buildContentValiditySection(input),
    discriminantEvidence: buildDiscriminantEvidenceSection(input),
    fairness: buildFairnessSection(input),
    reliability: buildReliabilitySection(input, alphaForecast),
    provenance: buildProvenanceSection(input),
    limitations: buildLimitationsSection(input, hasCongruenceData, hasEmpiricalAlpha),
  };
}
