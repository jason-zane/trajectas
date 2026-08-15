import { describe, it, expect } from 'vitest';
import {
  buildTechnicalReport,
  type TechnicalReportInput,
} from '@/lib/instrument/technical-report';
import type { Blueprint, BlueprintCell } from '@/lib/instrument/types';
import type { PanelResult } from '@/lib/instrument/congruence';
import type { AlphaForecast } from '@/lib/instrument/reliability';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createMockBlueprint(
  constructId: string = 'construct-1',
  cells: BlueprintCell[] = []
): Blueprint {
  return {
    id: `blueprint-${constructId}`,
    constructId,
    measureType: 'competency_behavioural',
    cells:
      cells.length > 0
        ? cells
        : [
            {
              id: `cell-${constructId}-low`,
              facetLabel: 'Low',
              intensity: 'low',
              targetItemCount: 2,
              displayOrder: 0,
            },
          ],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function createMockCell(
  id: string = 'cell-1',
  facetLabel: string = 'Facet A',
  intensity: 'low' | 'mid' | 'high' = 'mid',
  targetItemCount: number = 3
): BlueprintCell {
  return {
    id,
    facetLabel,
    intensity,
    targetItemCount,
    displayOrder: 0,
  };
}

function createMockCongruenceResult(): PanelResult {
  return {
    items: [
      {
        itemId: 'item-1',
        intendedConstructId: 'construct-1',
        raterCount: 2,
        assignmentAccuracy: 1.0,
        aikenV: 0.9,
        modalConstructId: 'construct-1',
        modalShare: 1.0,
        verdict: 'pass',
      },
      {
        itemId: 'item-2',
        intendedConstructId: 'construct-1',
        raterCount: 2,
        assignmentAccuracy: 0.5,
        aikenV: 0.7,
        modalConstructId: 'construct-2',
        modalShare: 0.5,
        verdict: 'review',
        leakedTo: 'construct-2',
      },
    ],
    fleissKappa: 0.75,
    confusion: {
      'construct-1': { 'construct-1': 2, 'construct-2': 1 },
      'construct-2': { 'construct-2': 3 },
    },
    constructSummaries: [
      {
        constructId: 'construct-1',
        itemCount: 2,
        meanAccuracy: 0.75,
        meanAikenV: 0.8,
        passRate: 0.5,
        mostConfusedWith: 'construct-2',
      },
    ],
    overall: {
      itemCount: 2,
      raterCount: 2,
      passRate: 0.5,
      meanAccuracy: 0.75,
      meanAikenV: 0.8,
    },
  };
}

function createMockAlphaForecast(): AlphaForecast {
  return {
    predictedAlpha: 0.82,
    interval: [0.75, 0.88],
    meanInterItemR: 0.35,
    meanInterItemRInterval: [0.28, 0.42],
    coherence: 'optimal',
    basis: 'synthetic',
    warnings: [],
  };
}

function createMockInput(overrides: Partial<TechnicalReportInput> = {}): TechnicalReportInput {
  const cell1 = createMockCell('cell-1', 'Communication', 'low', 2);
  const cell2 = createMockCell('cell-2', 'Strategic Thinking', 'mid', 3);
  const blueprint = createMockBlueprint('construct-1', [cell1, cell2]);

  return {
    buildId: 'build-1',
    instrumentName: 'Test Instrument',
    measureType: 'competency_behavioural',
    audience: 'senior',
    useContext: 'leadership development',
    generatedAt: new Date('2026-08-14T12:00:00Z'),
    blueprints: [blueprint],
    blueprintCells: [cell1, cell2],
    candidateItems: [
      {
        id: 'item-1',
        blueprintCellId: 'cell-1',
        stem: 'Item 1 stem',
        status: 'candidate',
      },
      {
        id: 'item-2',
        blueprintCellId: 'cell-1',
        stem: 'Item 2 stem',
        status: 'candidate',
      },
      {
        id: 'item-3',
        blueprintCellId: 'cell-2',
        stem: 'Item 3 stem',
        status: 'candidate',
      },
      {
        id: 'item-4',
        blueprintCellId: 'cell-2',
        stem: 'Item 4 stem',
        status: 'revised',
      },
      {
        id: 'item-5',
        blueprintCellId: 'cell-2',
        stem: 'Item 5 stem',
        status: 'candidate',
      },
      {
        id: 'orphan-item',
        blueprintCellId: null,
        stem: 'Orphaned item',
        status: 'candidate',
      },
    ],
    fairnessResults: [
      {
        id: 'item-1',
        flags: [],
        note: undefined,
      },
      {
        id: 'item-2',
        flags: ['idiom'],
        note: 'Contains colloquialism',
      },
      {
        id: 'item-3',
        flags: ['sensory_assumption', 'jargon'],
        note: 'Uses domain-specific terminology',
      },
    ],
    evidenceRecords: [],
    discriminantScores: [
      {
        construct1: 'construct-1',
        construct2: 'construct-2',
        cosineSimilarity: 0.72,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTechnicalReport', () => {
  describe('IDENTITY section', () => {
    it('should include instrument metadata', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.identity.instrumentName).toBe('Test Instrument');
      expect(report.identity.measureType).toBe('competency_behavioural');
      expect(report.identity.audience).toBe('senior');
      expect(report.identity.useContext).toBe('leadership development');
      expect(report.identity.buildId).toBe('build-1');
      expect(report.identity.generatedAt).toEqual(new Date('2026-08-14T12:00:00Z'));
    });
  });

  describe('SPECIFICATION section', () => {
    it('should report facet coverage with target vs actual', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.specification.constructs).toHaveLength(1);
      const construct = report.specification.constructs[0];
      expect(construct.constructId).toBe('construct-1');
      expect(construct.facetGrid).toHaveLength(2);

      const facetA = construct.facetGrid[0];
      expect(facetA.facetLabel).toBe('Communication');
      expect(facetA.targetCount).toBe(2);
      expect(facetA.actualCount).toBe(2); // items 1, 2 assigned to cell-1
      expect(facetA.deficit).toBe(0);
      expect(facetA.surplus).toBe(0);

      const facetB = construct.facetGrid[1];
      expect(facetB.facetLabel).toBe('Strategic Thinking');
      expect(facetB.targetCount).toBe(3);
      expect(facetB.actualCount).toBe(3); // items 3, 4, 5 assigned to cell-2
      expect(facetB.deficit).toBe(0);
      expect(facetB.surplus).toBe(0);
    });

    it('should report orphaned items', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.specification.orphanedItemCount.value).toBe(1); // orphan-item
      expect(report.specification.orphanedItemCount.evidenceClass).toBe('a_priori');
    });

    it('should report total instrument items', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.specification.totalInstrumentItems.value).toBe(6);
      expect(report.specification.totalInstrumentItems.evidenceClass).toBe('a_priori');
    });

    it('should handle deficit and surplus in facet grid', () => {
      const cell1 = createMockCell('cell-1', 'Facet A', 'low', 5); // target 5
      const blueprint = createMockBlueprint('construct-1', [cell1]);
      const input = createMockInput({
        blueprints: [blueprint],
        blueprintCells: [cell1],
        candidateItems: [
          {
            id: 'item-1',
            blueprintCellId: 'cell-1',
            stem: 'Item 1',
            status: 'candidate',
          },
          {
            id: 'item-2',
            blueprintCellId: 'cell-1',
            stem: 'Item 2',
            status: 'candidate',
          },
          {
            id: 'item-3',
            blueprintCellId: 'cell-1',
            stem: 'Item 3',
            status: 'candidate',
          },
        ],
      });

      const report = buildTechnicalReport(input);
      const facet = report.specification.constructs[0].facetGrid[0];

      expect(facet.targetCount).toBe(5);
      expect(facet.actualCount).toBe(3);
      expect(facet.deficit).toBe(2); // 5 - 3
      expect(facet.surplus).toBe(0);
    });
  });

  describe('CONTENT VALIDITY section', () => {
    it('should populate from congruence result when present', () => {
      const congruence = createMockCongruenceResult();
      const input = createMockInput({ congruenceResult: congruence });
      const report = buildTechnicalReport(input);

      expect(report.contentValidity.constructs).toHaveLength(1);
      const construct = report.contentValidity.constructs[0];

      expect(construct.constructId).toBe('construct-1');
      expect(construct.assignmentAccuracy.value).toBe(0.75);
      expect(construct.assignmentAccuracy.evidenceClass).toBe('empirical');
      expect(construct.assignmentAccuracy.sampleSize).toBe(2);
      expect(construct.aikenV.value).toBe(0.8);
      expect(construct.aikenV.evidenceClass).toBe('empirical');
      expect(construct.passRate.value).toBe(0.5);
      expect(construct.passRate.evidenceClass).toBe('empirical');

      // Check for confusion pair (item-2 leaked to construct-2)
      expect(construct.confusionPairs).toContainEqual({
        intendedConstruct: 'construct-1',
        confusedWith: 'construct-2',
        count: 1,
      });
    });

    it('should report overall metrics from congruence panel', () => {
      const congruence = createMockCongruenceResult();
      const input = createMockInput({ congruenceResult: congruence });
      const report = buildTechnicalReport(input);

      expect(report.contentValidity.overall.itemCount.value).toBe(2);
      expect(report.contentValidity.overall.itemCount.evidenceClass).toBe('empirical');
      expect(report.contentValidity.overall.fleissKappa.value).toBe(0.75);
      expect(report.contentValidity.overall.fleissKappa.evidenceClass).toBe('empirical');
    });

    it('should mark all claims as a_priori when no congruence result', () => {
      const input = createMockInput({ congruenceResult: undefined });
      const report = buildTechnicalReport(input);

      expect(report.contentValidity.constructs[0].assignmentAccuracy.evidenceClass).toBe('a_priori');
      expect(report.contentValidity.constructs[0].aikenV.evidenceClass).toBe('a_priori');
      expect(report.contentValidity.constructs[0].passRate.evidenceClass).toBe('a_priori');
      expect(report.contentValidity.overall.fleissKappa.evidenceClass).toBe('a_priori');
    });
  });

  describe('DISCRIMINANT EVIDENCE section', () => {
    it('should include pairwise construct overlap with caveat', () => {
      const input = createMockInput({
        discriminantScores: [
          {
            construct1: 'construct-1',
            construct2: 'construct-2',
            cosineSimilarity: 0.68,
          },
          {
            construct1: 'construct-1',
            construct2: 'construct-3',
            cosineSimilarity: 0.45,
          },
        ],
      });
      const report = buildTechnicalReport(input);

      expect(report.discriminantEvidence.pairs).toHaveLength(2);
      expect(report.discriminantEvidence.pairs[0].overlap.value).toBe(0.68);
      expect(report.discriminantEvidence.pairs[0].overlap.evidenceClass).toBe('synthetic');

      // Check platform caveat is present
      expect(report.discriminantEvidence.platformCaveat).toContain(
        "Cohen's d ≈ 0.63–1.03"
      );
      expect(report.discriminantEvidence.platformCaveat).toContain(
        'heuristic flags potential item-wording overlap'
      );
    });

    it('should handle no discriminant scores', () => {
      const input = createMockInput({ discriminantScores: undefined });
      const report = buildTechnicalReport(input);

      expect(report.discriminantEvidence.pairs).toHaveLength(0);
      expect(report.discriminantEvidence.platformCaveat).toBeTruthy();
    });
  });

  describe('FAIRNESS section', () => {
    it('should categorize flagged items by concern type', () => {
      const input = createMockInput({
        fairnessResults: [
          { id: 'item-1', flags: [], note: undefined },
          { id: 'item-2', flags: ['idiom'], note: 'Colloquialism' },
          {
            id: 'item-3',
            flags: ['sensory_assumption', 'jargon'],
            note: 'Domain terminology',
          },
          { id: 'item-4', flags: ['idiom'], note: 'Another colloquialism' },
        ],
      });
      const report = buildTechnicalReport(input);

      expect(report.fairness.flaggedItems).toHaveLength(3); // Only items 2, 3, 4
      expect(report.fairness.categories['idiom'].count).toBe(2);
      expect(report.fairness.categories['idiom'].affectedItems).toContain('item-2');
      expect(report.fairness.categories['idiom'].affectedItems).toContain('item-4');
      expect(report.fairness.categories['sensory_assumption'].count).toBe(1);
      expect(report.fairness.categories['jargon'].count).toBe(1);
    });

    it('should report number of items reviewed', () => {
      const input = createMockInput({
        fairnessResults: [
          { id: 'item-1', flags: [] },
          { id: 'item-2', flags: ['idiom'] },
          { id: 'item-3', flags: [] },
        ],
      });
      const report = buildTechnicalReport(input);

      expect(report.fairness.itemsReviewed.value).toBe(3);
      expect(report.fairness.itemsReviewed.evidenceClass).toBe('a_priori');
    });

    it('should handle empty fairness results', () => {
      const input = createMockInput({ fairnessResults: undefined });
      const report = buildTechnicalReport(input);

      expect(report.fairness.itemsReviewed.value).toBe(0);
      expect(report.fairness.flaggedItems).toHaveLength(0);
      expect(Object.keys(report.fairness.categories)).toHaveLength(0);
    });
  });

  describe('RELIABILITY section', () => {
    it('should include alpha forecast with interval and shrinkage note', () => {
      const forecast = createMockAlphaForecast();
      const input = createMockInput();
      const report = buildTechnicalReport(input, forecast);

      expect(report.reliability.alpha.value.point).toBe(0.82);
      expect(report.reliability.alpha.value.interval).toEqual([0.75, 0.88]);
      expect(report.reliability.alpha.evidenceClass).toBe('a_priori');
      expect(report.reliability.alpha.confidence).toBe('none'); // a_priori = no confidence (forecast only)

      expect(report.reliability.meanInterItemR.value.point).toBe(0.35);
      expect(report.reliability.meanInterItemR.value.interval).toEqual([0.28, 0.42]);

      expect(report.reliability.coherence).toBe('optimal');
      expect(report.reliability.shrinkageNote).toContain('Shrinkage factors');
    });

    it('should emit warnings from forecast', () => {
      const forecast: AlphaForecast = {
        ...createMockAlphaForecast(),
        warnings: [
          { level: 'warn', message: 'Items may be redundant' },
          { level: 'caution', message: 'Few items provided' },
        ],
      };
      const input = createMockInput();
      const report = buildTechnicalReport(input, forecast);

      expect(report.reliability.warnings).toHaveLength(2);
      expect(report.reliability.warnings[0].message).toContain('redundant');
    });

    it('should handle missing forecast', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input); // No forecast

      expect(Number.isNaN(report.reliability.alpha.value.point)).toBe(true);
      expect(report.reliability.shrinkageNote).toContain('facet-count prior');
      // Should have added a caution warning
      expect(report.reliability.warnings.some((w) => w.level === 'caution' && w.message.includes('facet-count prior'))).toBe(true);
    });
  });

  describe('PROVENANCE section', () => {
    it('should count assigned vs orphaned items', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.provenance.totalItems.value).toBe(6);
      expect(report.provenance.itemsAssignedToBlueprint.value).toBe(5);
      expect(report.provenance.orphanedItems.value).toBe(1);
      expect(report.provenance.orphanedItems.evidenceClass).toBe('a_priori');
    });

    it('should count original vs revised items', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.provenance.itemVersioning.originalCount).toBe(5);
      expect(report.provenance.itemVersioning.revisedCount).toBe(1);
    });
  });

  describe('LIMITATIONS section', () => {
    it('should mark specification as a_priori', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      const specClaim = report.limitations.claims.find(
        (c) => c.claim.includes('facet × intensity')
      );
      expect(specClaim?.evidenceClass).toBe('a_priori');
    });

    it('should escalate validity to empirical when congruence result present', () => {
      const congruence = createMockCongruenceResult();
      const input = createMockInput({ congruenceResult: congruence });
      const report = buildTechnicalReport(input);

      const validityClaim = report.limitations.claims.find(
        (c) => c.claim.includes('Content validity')
      );
      expect(validityClaim?.evidenceClass).toBe('empirical');
      expect(validityClaim?.sampleSizeProvided).toBe(2);
    });

    it('should mark reliability as a_priori without empirical alpha', () => {
      const input = createMockInput({
        evidenceRecords: [],
      });
      const report = buildTechnicalReport(input);

      const reliabilityClaim = report.limitations.claims.find(
        (c) => c.claim.includes('Cronbach') && !c.claim.includes('observed')
      );
      expect(reliabilityClaim?.evidenceClass).toBe('a_priori');
      expect(reliabilityClaim?.sampleSizeNeeded).toBe(50);
    });

    it('should report calibrated status when n >= 200 and empirical alpha present', () => {
      const input = createMockInput({
        evidenceRecords: [
          {
            id: 'ev-1',
            targetType: 'instrument',
            targetId: 'build-1',
            claim: 'alpha',
            value: 0.85,
            evidenceClass: 'empirical',
            method: 'ctt_alpha',
            sampleSize: 250,
            producedAt: new Date(),
          },
        ],
        congruenceResult: {
          ...createMockCongruenceResult(),
          overall: { ...createMockCongruenceResult().overall, itemCount: 250 },
        },
      });
      const report = buildTechnicalReport(input);

      expect(report.limitations.validationStatus).toBe('calibrated');
    });

    it('should report piloting status when empirical but n < 200', () => {
      const input = createMockInput({
        evidenceRecords: [
          {
            id: 'ev-1',
            targetType: 'instrument',
            targetId: 'build-1',
            claim: 'alpha',
            value: 0.78,
            evidenceClass: 'empirical',
            method: 'ctt_alpha',
            sampleSize: 80,
            producedAt: new Date(),
          },
        ],
        congruenceResult: {
          ...createMockCongruenceResult(),
          overall: { ...createMockCongruenceResult().overall, itemCount: 80 },
        },
      });
      const report = buildTechnicalReport(input);

      expect(report.limitations.validationStatus).toBe('piloting');
    });

    it('should report designed_to_standard status when no empirical data', () => {
      const input = createMockInput({ evidenceRecords: [] });
      const report = buildTechnicalReport(input);

      expect(report.limitations.validationStatus).toBe('designed_to_standard');
    });

    it('should set minimum sample size thresholds', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      expect(report.limitations.minSampleSizeForAlpha).toBe(50);
      expect(report.limitations.minSampleSizeForIrtDif).toBe(200);
    });
  });

  describe('Evidence class propagation', () => {
    it('should carry evidence class through all numeric claims', () => {
      const congruence = createMockCongruenceResult();
      const input = createMockInput({ congruenceResult: congruence });
      const report = buildTechnicalReport(input);

      // Empirical claims from congruence
      expect(report.contentValidity.overall.fleissKappa.evidenceClass).toBe('empirical');
      expect(report.contentValidity.overall.assignmentAccuracy.evidenceClass).toBe('empirical');

      // A priori claims
      expect(report.specification.totalInstrumentItems.evidenceClass).toBe('a_priori');
      expect(report.provenance.orphanedItems.evidenceClass).toBe('a_priori');
    });

    it('should label evidence with readable descriptions', () => {
      const congruence = createMockCongruenceResult();
      const input = createMockInput({ congruenceResult: congruence });
      const report = buildTechnicalReport(input);

      const empiricalLabel = report.contentValidity.overall.fleissKappa.label;
      expect(empiricalLabel).toContain('observed');
      expect(empiricalLabel).toContain('n=2');

      const aprioriLabel = report.specification.totalInstrumentItems.label;
      expect(aprioriLabel).toBe('forecast (no data)');
    });

    it('should compute confidence levels correctly', () => {
      const input = createMockInput();
      const report = buildTechnicalReport(input);

      // A priori claims have no confidence
      expect(report.specification.totalInstrumentItems.confidence).toBe('none');

      // Forecast (a_priori) has no confidence
      expect(report.reliability.alpha.confidence).toBe('none');
    });
  });

  describe('Empty and edge cases', () => {
    it('should handle build with no items', () => {
      const cell1 = createMockCell('cell-1', 'Facet', 'mid', 5);
      const blueprint = createMockBlueprint('construct-1', [cell1]);
      const input = createMockInput({
        blueprints: [blueprint],
        blueprintCells: [cell1],
        candidateItems: [],
      });
      const report = buildTechnicalReport(input);

      expect(report.specification.totalInstrumentItems.value).toBe(0);
      expect(report.specification.orphanedItemCount.value).toBe(0);
      expect(report.specification.constructs[0].facetGrid[0].actualCount).toBe(0);
      expect(report.specification.constructs[0].facetGrid[0].deficit).toBe(5);
    });

    it('should handle build with no blueprints', () => {
      const input = createMockInput({
        blueprints: [],
        blueprintCells: [],
      });
      const report = buildTechnicalReport(input);

      expect(report.specification.constructs).toHaveLength(0);
    });

    it('should handle build with no congruence and no fairness data', () => {
      const input = createMockInput({
        congruenceResult: undefined,
        fairnessResults: undefined,
      });
      const report = buildTechnicalReport(input);

      expect(report.contentValidity.constructs[0].assignmentAccuracy.evidenceClass).toBe('a_priori');
      expect(report.fairness.itemsReviewed.value).toBe(0);
      expect(report.fairness.flaggedItems).toHaveLength(0);
    });

    it('should generate report ID with build and timestamp', () => {
      const input = createMockInput({ buildId: 'build-xyz' });
      const report = buildTechnicalReport(input);

      expect(report.id).toContain('report-build-xyz');
      expect(report.id).toContain(input.generatedAt.getTime().toString());
    });

    it('should generate different IDs for different timestamps', () => {
      const input1 = createMockInput({ generatedAt: new Date('2026-08-14T12:00:00Z') });
      const input2 = createMockInput({ generatedAt: new Date('2026-08-14T13:00:00Z') });
      const report1 = buildTechnicalReport(input1);
      const report2 = buildTechnicalReport(input2);

      expect(report1.id).not.toBe(report2.id);
    });
  });

  describe('Multiple constructs', () => {
    it('should handle multiple constructs with separate blueprints', () => {
      const cell1 = createMockCell('cell-c1', 'Facet A', 'low', 2);
      const cell2 = createMockCell('cell-c2', 'Facet B', 'mid', 3);
      const blueprint1 = createMockBlueprint('construct-1', [cell1]);
      const blueprint2 = createMockBlueprint('construct-2', [cell2]);

      const input = createMockInput({
        blueprints: [blueprint1, blueprint2],
        blueprintCells: [cell1, cell2],
        candidateItems: [
          { id: 'item-1', blueprintCellId: 'cell-c1', stem: 'S1', status: 'candidate' },
          { id: 'item-2', blueprintCellId: 'cell-c2', stem: 'S2', status: 'candidate' },
        ],
      });
      const report = buildTechnicalReport(input);

      expect(report.specification.constructs).toHaveLength(2);
      expect(report.specification.constructs[0].constructId).toBe('construct-1');
      expect(report.specification.constructs[1].constructId).toBe('construct-2');
    });
  });
});
