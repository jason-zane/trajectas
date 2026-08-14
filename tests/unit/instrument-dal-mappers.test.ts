import { describe, it, expect } from 'vitest'
import {
  mapInstrumentBuildRow,
  mapInstrumentBuildRows,
  mapInstrumentBlueprintRow,
  mapInstrumentBlueprintCellRow,
  mapInstrumentBlueprintCellRows,
  mapInstrumentCandidateItemRow,
  mapInstrumentCandidateItemRows,
  mapInstrumentStageRunRow,
  mapInstrumentStageRunRows,
  mapInstrumentEvidenceRow,
  mapInstrumentEvidenceRows,
  type DbRow,
} from '@/lib/dal/instrument-mappers'

describe('instrument-dal-mappers', () => {
  describe('mapInstrumentBuildRow', () => {
    it('maps a complete build row', () => {
      const row = {
        id: 'build-1',
        name: 'Leadership Competency',
        status: 'blueprinting',
        measure_type: 'competency_behavioural',
        brief: 'A leadership instrument',
        audience: { level: 'senior' },
        use_context: 'Annual assessment',
        target_construct_count: 5,
        target_items_per_construct: 4,
        config: { version: 1 },
        preset_id: 'preset-1',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        deleted_at: null,
      }

      const dto = mapInstrumentBuildRow(row)

      expect(dto.id).toBe('build-1')
      expect(dto.name).toBe('Leadership Competency')
      expect(dto.status).toBe('blueprinting')
      expect(dto.measureType).toBe('competency_behavioural')
      expect(dto.brief).toBe('A leadership instrument')
      expect(dto.audience).toEqual({ level: 'senior' })
      expect(dto.useContext).toBe('Annual assessment')
      expect(dto.targetConstructCount).toBe(5)
      expect(dto.targetItemsPerConstruct).toBe(4)
      expect(dto.config).toEqual({ version: 1 })
      expect(dto.presetId).toBe('preset-1')
      expect(dto.createdBy).toBe('user-1')
      expect(dto.deletedAt).toBeUndefined()
    })

    it('handles null optional fields', () => {
      const row = {
        id: 'build-2',
        name: 'Simple Build',
        status: 'draft',
        measure_type: 'trait',
        brief: null,
        audience: null,
        use_context: null,
        target_construct_count: null,
        target_items_per_construct: null,
        config: null,
        preset_id: null,
        created_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      }

      const dto = mapInstrumentBuildRow(row)

      expect(dto.brief).toBeUndefined()
      expect(dto.audience).toBeUndefined()
      expect(dto.useContext).toBeUndefined()
      expect(dto.targetConstructCount).toBeUndefined()
      expect(dto.targetItemsPerConstruct).toBeUndefined()
      expect(dto.config).toBeUndefined()
      expect(dto.presetId).toBeUndefined()
      expect(dto.createdBy).toBeUndefined()
    })

    it('handles undefined fields', () => {
      const row = {
        id: 'build-3',
        name: 'Minimal Build',
        status: 'draft',
        measure_type: 'sjt',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentBuildRow(row)

      expect(dto.id).toBe('build-3')
      expect(dto.name).toBe('Minimal Build')
      expect(dto.status).toBe('draft')
      expect(dto.measureType).toBe('sjt')
      expect(dto.targetConstructCount).toBeUndefined()
    })

    it('coerces string numbers to integers', () => {
      const row = {
        id: 'build-4',
        name: 'Build',
        status: 'draft',
        measure_type: 'capability',
        target_construct_count: '3',
        target_items_per_construct: '5',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentBuildRow(row)

      expect(dto.targetConstructCount).toBe(3)
      expect(dto.targetItemsPerConstruct).toBe(5)
      expect(typeof dto.targetConstructCount).toBe('number')
    })

    it('provides defaults for missing required fields', () => {
      const row = {
        id: 'build-5',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentBuildRow(row)

      expect(dto.name).toBe('')
      expect(dto.status).toBe('draft')
      expect(dto.measureType).toBe('competency_behavioural')
    })
  })

  describe('mapInstrumentBuildRows', () => {
    it('maps multiple rows', () => {
      const rows = [
        {
          id: 'b1',
          name: 'Build 1',
          status: 'draft',
          measure_type: 'trait',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'b2',
          name: 'Build 2',
          status: 'ready',
          measure_type: 'competency_behavioural',
          created_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ]

      const dtos = mapInstrumentBuildRows(rows)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].id).toBe('b1')
      expect(dtos[1].id).toBe('b2')
    })

    it('handles empty array', () => {
      const dtos = mapInstrumentBuildRows([])
      expect(dtos).toEqual([])
    })

    it('handles null input', () => {
      const dtos = mapInstrumentBuildRows(null as unknown as DbRow[])
      expect(dtos).toEqual([])
    })
  })

  describe('mapInstrumentBlueprintRow', () => {
    it('maps a complete blueprint row', () => {
      const row = {
        id: 'bp-1',
        build_id: 'build-1',
        construct_id: 'construct-1',
        draft_construct_name: 'Leadership',
        draft_construct_definition: 'Ability to lead teams',
        measure_type: 'competency_behavioural',
        target_alpha: '0.75',
        exclusions: ['difficult', 'offensive'],
        notes: 'V2 revision',
        version: 2,
        status: 'ready',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        deleted_at: null,
      }

      const dto = mapInstrumentBlueprintRow(row)

      expect(dto.id).toBe('bp-1')
      expect(dto.buildId).toBe('build-1')
      expect(dto.constructId).toBe('construct-1')
      expect(dto.draftConstructName).toBe('Leadership')
      expect(dto.draftConstructDefinition).toBe('Ability to lead teams')
      expect(dto.targetAlpha).toBe(0.75)
      expect(dto.exclusions).toEqual(['difficult', 'offensive'])
      expect(dto.version).toBe(2)
      expect(dto.status).toBe('ready')
    })

    it('coerces NUMERIC target_alpha to number', () => {
      const row = {
        id: 'bp-2',
        build_id: 'build-1',
        measure_type: 'trait',
        target_alpha: '0.82',
        version: 1,
        status: 'draft',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentBlueprintRow(row)

      expect(dto.targetAlpha).toBe(0.82)
      expect(typeof dto.targetAlpha).toBe('number')
    })

    it('handles null target_alpha', () => {
      const row = {
        id: 'bp-3',
        build_id: 'build-1',
        measure_type: 'capability',
        target_alpha: null,
        version: 1,
        status: 'draft',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentBlueprintRow(row)

      expect(dto.targetAlpha).toBeUndefined()
    })
  })

  describe('mapInstrumentBlueprintCellRow', () => {
    it('maps a complete cell row', () => {
      const row = {
        id: 'cell-1',
        facet_label: 'Communication',
        intensity: 'high',
        target_item_count: 4,
        display_order: 1,
      }

      const cell = mapInstrumentBlueprintCellRow(row)

      expect(cell.id).toBe('cell-1')
      expect(cell.facetLabel).toBe('Communication')
      expect(cell.intensity).toBe('high')
      expect(cell.targetItemCount).toBe(4)
      expect(cell.displayOrder).toBe(1)
    })

    it('coerces string numbers', () => {
      const row = {
        id: 'cell-2',
        facet_label: 'Strategic Thinking',
        intensity: 'mid',
        target_item_count: '3',
        display_order: '0',
      }

      const cell = mapInstrumentBlueprintCellRow(row)

      expect(cell.targetItemCount).toBe(3)
      expect(cell.displayOrder).toBe(0)
    })

    it('provides defaults for missing fields', () => {
      const row = {
        id: 'cell-3',
        facet_label: '',
        intensity: 'low',
      }

      const cell = mapInstrumentBlueprintCellRow(row)

      expect(cell.targetItemCount).toBe(2)
      expect(cell.displayOrder).toBe(0)
    })
  })

  describe('mapInstrumentBlueprintCellRows', () => {
    it('maps multiple cells and preserves order', () => {
      const rows = [
        {
          id: 'c1',
          facet_label: 'Thinking',
          intensity: 'low',
          target_item_count: 2,
          display_order: 0,
        },
        {
          id: 'c2',
          facet_label: 'Thinking',
          intensity: 'high',
          target_item_count: 4,
          display_order: 1,
        },
      ]

      const cells = mapInstrumentBlueprintCellRows(rows)

      expect(cells).toHaveLength(2)
      expect(cells[0].displayOrder).toBe(0)
      expect(cells[1].displayOrder).toBe(1)
    })
  })

  describe('mapInstrumentCandidateItemRow', () => {
    it('maps a complete candidate item row', () => {
      const row = {
        id: 'item-1',
        build_id: 'build-1',
        blueprint_cell_id: 'cell-1',
        stem: 'Which approach best demonstrates strategic thinking?',
        stem_observer: 'Observed behavior example',
        reverse_scored: false,
        rationale: 'Assesses long-term planning',
        facet: 'Strategic Thinking',
        difficulty_tier: 'medium',
        sd_risk: 'low',
        sd_rating: '0.15',
        reading_grade: '8.5',
        payload: { options: 3 },
        status: 'candidate',
        published_item_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      }

      const dto = mapInstrumentCandidateItemRow(row)

      expect(dto.id).toBe('item-1')
      expect(dto.buildId).toBe('build-1')
      expect(dto.blueprintCellId).toBe('cell-1')
      expect(dto.stem).toBe('Which approach best demonstrates strategic thinking?')
      expect(dto.stemObserver).toBe('Observed behavior example')
      expect(dto.reverseScored).toBe(false)
      expect(dto.sdRating).toBe(0.15)
      expect(dto.readingGrade).toBe(8.5)
    })

    it('coerces NUMERIC columns', () => {
      const row = {
        id: 'item-2',
        build_id: 'build-1',
        stem: 'Test item',
        sd_rating: '0.30',
        reading_grade: '12.0',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentCandidateItemRow(row)

      expect(dto.sdRating).toBe(0.3)
      expect(dto.readingGrade).toBe(12.0)
    })

    it('handles null NUMERIC columns', () => {
      const row = {
        id: 'item-3',
        build_id: 'build-1',
        stem: 'Test',
        sd_rating: null,
        reading_grade: undefined,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentCandidateItemRow(row)

      expect(dto.sdRating).toBeUndefined()
      expect(dto.readingGrade).toBeUndefined()
    })
  })

  describe('mapInstrumentCandidateItemRows', () => {
    it('maps multiple items', () => {
      const rows = [
        {
          id: 'i1',
          build_id: 'build-1',
          stem: 'Item 1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'i2',
          build_id: 'build-1',
          stem: 'Item 2',
          created_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ]

      const dtos = mapInstrumentCandidateItemRows(rows)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].id).toBe('i1')
      expect(dtos[1].id).toBe('i2')
    })
  })

  describe('mapInstrumentStageRunRow', () => {
    it('maps a complete stage run row', () => {
      const row = {
        id: 'run-1',
        build_id: 'build-1',
        stage_key: 'generation',
        status: 'success',
        severity: null,
        progress_pct: '100',
        detail: 'Generated 42 items',
        input_snapshot: { constructIds: ['c1', 'c2'] },
        output_snapshot: { itemIds: ['i1', 'i2'] },
        token_usage: { input: 500, output: 300 },
        error_message: null,
        started_at: '2026-01-01T10:00:00Z',
        completed_at: '2026-01-01T10:05:00Z',
        created_at: '2026-01-01T10:00:00Z',
      }

      const dto = mapInstrumentStageRunRow(row)

      expect(dto.id).toBe('run-1')
      expect(dto.buildId).toBe('build-1')
      expect(dto.stageKey).toBe('generation')
      expect(dto.status).toBe('success')
      expect(dto.progressPct).toBe(100)
      expect(dto.detail).toBe('Generated 42 items')
      expect(dto.inputSnapshot).toEqual({ constructIds: ['c1', 'c2'] })
      expect(dto.outputSnapshot).toEqual({ itemIds: ['i1', 'i2'] })
      expect(dto.tokenUsage).toEqual({ input: 500, output: 300 })
      expect(dto.errorMessage).toBeUndefined()
      expect(dto.startedAt).toBe('2026-01-01T10:00:00Z')
      expect(dto.completedAt).toBe('2026-01-01T10:05:00Z')
    })

    it('handles null/undefined fields', () => {
      const row = {
        id: 'run-2',
        build_id: 'build-1',
        stage_key: 'review',
        status: 'pending',
        severity: null,
        progress_pct: null,
        detail: null,
        input_snapshot: null,
        output_snapshot: null,
        token_usage: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentStageRunRow(row)

      expect(dto.progressPct).toBeUndefined()
      expect(dto.detail).toBeUndefined()
      expect(dto.inputSnapshot).toBeUndefined()
      expect(dto.severity).toBeUndefined()
      expect(dto.errorMessage).toBeUndefined()
      expect(dto.startedAt).toBeUndefined()
      expect(dto.completedAt).toBeUndefined()
    })
  })

  describe('mapInstrumentStageRunRows', () => {
    it('maps multiple stage runs', () => {
      const rows = [
        {
          id: 'r1',
          build_id: 'b1',
          stage_key: 'gen',
          status: 'success',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'r2',
          build_id: 'b1',
          stage_key: 'review',
          status: 'running',
          created_at: '2026-01-02T00:00:00Z',
        },
      ]

      const dtos = mapInstrumentStageRunRows(rows)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].stageKey).toBe('gen')
      expect(dtos[1].stageKey).toBe('review')
    })
  })

  describe('mapInstrumentEvidenceRow', () => {
    it('maps a complete evidence row', () => {
      const row = {
        id: 'ev-1',
        target_type: 'item',
        target_id: 'item-1',
        claim: 'difficulty',
        value: 0.65,
        evidence_class: 'empirical',
        method: 'irt_analysis',
        sample_size: 150,
        superseded_by: null,
        created_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentEvidenceRow(row)

      expect(dto.id).toBe('ev-1')
      expect(dto.targetType).toBe('item')
      expect(dto.targetId).toBe('item-1')
      expect(dto.claim).toBe('difficulty')
      expect(dto.evidenceClass).toBe('empirical')
      expect(dto.method).toBe('irt_analysis')
      // The value is the whole point of the ledger — it must survive mapping.
      expect(dto.value).toBe(0.65)
      expect(dto.sampleSize).toBe(150)
      // superseded_by is null, so this row is still live.
      expect(dto.supersededAt).toBeNull()
    })

    it('maps the uncertainty interval when both bounds are present', () => {
      const row = {
        id: 'ev-2',
        target_type: 'construct',
        target_id: 'c1',
        claim: 'alpha',
        value: '0.78',
        interval_low: '0.72',
        interval_high: '0.84',
        evidence_class: 'a_priori',
        method: 'forecast_v1',
        sample_size: null,
        superseded_by: null,
        created_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentEvidenceRow(row)

      // NUMERIC columns arrive as strings and must be coerced.
      expect(dto.value).toBe(0.78)
      expect(dto.interval).toEqual([0.72, 0.84])
      expect(dto.sampleSize).toBeUndefined()
    })

    it('omits the interval when only one bound is present', () => {
      const dto = mapInstrumentEvidenceRow({
        id: 'ev-2b',
        target_type: 'construct',
        target_id: 'c1',
        claim: 'alpha',
        value: 0.78,
        interval_low: 0.72,
        interval_high: null,
        evidence_class: 'a_priori',
        method: 'forecast_v1',
        superseded_by: null,
        created_at: '2026-01-01T00:00:00Z',
      })

      expect(dto.interval).toBeUndefined()
    })

    it('marks superseded evidence with a timestamp, not null', () => {
      const row = {
        id: 'ev-3',
        target_type: 'item',
        target_id: 'i1',
        claim: 'discrimination',
        value: 0.25,
        evidence_class: 'empirical',
        method: 'irt',
        sample_size: 200,
        superseded_by: 'ev-4',
        created_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentEvidenceRow(row)

      // Live rows are null; superseded rows carry a date. The inverse would let
      // a superseded forecast read as current.
      expect(dto.supersededAt).not.toBeNull()
      expect(dto.supersededAt).toBeInstanceOf(Date)
    })

    it('handles a_priori evidence with no sample_size', () => {
      const row = {
        id: 'ev-5',
        target_type: 'instrument',
        target_id: 's1',
        claim: 'coverage',
        value: 0,
        evidence_class: 'a_priori',
        method: 'forecast',
        sample_size: null,
        superseded_by: null,
        created_at: '2026-01-01T00:00:00Z',
      }

      const dto = mapInstrumentEvidenceRow(row)

      expect(dto.evidenceClass).toBe('a_priori')
      expect(dto.targetType).toBe('instrument')
      expect(dto.sampleSize).toBeUndefined()
      expect(dto.value).toBe(0)
    })
  })

  describe('mapInstrumentEvidenceRows', () => {
    it('maps multiple evidence records', () => {
      const rows = [
        {
          id: 'e1',
          target_type: 'item',
          target_id: 'i1',
          claim: 'difficulty',
          value: 0.5,
          evidence_class: 'empirical',
          method: 'irt',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'e2',
          target_type: 'item',
          target_id: 'i1',
          claim: 'discrimination',
          value: 0.6,
          evidence_class: 'empirical',
          method: 'irt',
          created_at: '2026-01-02T00:00:00Z',
        },
      ]

      const dtos = mapInstrumentEvidenceRows(rows)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].claim).toBe('difficulty')
      expect(dtos[1].claim).toBe('discrimination')
    })
  })

  describe('conformance to existing types', () => {
    it('BlueprintCell mapper produces valid BlueprintCell shape', () => {
      const row = {
        id: 'c1',
        facet_label: 'Test',
        intensity: 'high',
        target_item_count: 3,
        display_order: 0,
      }

      const cell = mapInstrumentBlueprintCellRow(row)

      // Check that it has all required properties of BlueprintCell
      expect(cell).toHaveProperty('id')
      expect(cell).toHaveProperty('facetLabel')
      expect(cell).toHaveProperty('intensity')
      expect(cell).toHaveProperty('targetItemCount')
      expect(cell).toHaveProperty('displayOrder')

      // Type check: should be compatible with BlueprintCell
      const _typeSafetyCheck: typeof cell = {
        id: 'test',
        facetLabel: 'Test',
        intensity: 'low',
        targetItemCount: 2,
        displayOrder: 0,
      }
      expect(_typeSafetyCheck.id).toBeDefined()
    })
  })
})
