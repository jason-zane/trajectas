import type {
  Assessment,
  Dimension,
  Competency,
  Trait,
  CompetencyTrait,
  Item,
  ItemOption,
  Organization,
  ResponseFormat,
  ForcedChoiceBlock,
  ForcedChoiceBlockItem,
} from '@/types/database'

// =============================================================================
// Row → TypeScript mappers (snake_case DB → camelCase TS)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDimensionRow(row: any): Dimension {
  return {
    id: row.id,
    partnerId: row.partner_id ?? undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    definition: row.definition ?? undefined,
    isScored: row.is_scored,
    displayOrder: row.display_order,
    isActive: row.is_active,
    indicatorsLow: row.indicators_low ?? undefined,
    indicatorsMid: row.indicators_mid ?? undefined,
    indicatorsHigh: row.indicators_high ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCompetencyRow(row: any): Competency {
  return {
    id: row.id,
    dimensionId: row.dimension_id ?? undefined,
    partnerId: row.partner_id ?? undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    definition: row.definition ?? undefined,
    isActive: row.is_active,
    indicatorsLow: row.indicators_low ?? undefined,
    indicatorsMid: row.indicators_mid ?? undefined,
    indicatorsHigh: row.indicators_high ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTraitRow(row: any): Trait {
  return {
    id: row.id,
    partnerId: row.partner_id ?? undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    definition: row.definition ?? undefined,
    isActive: row.is_active,
    indicatorsLow: row.indicators_low ?? undefined,
    indicatorsMid: row.indicators_mid ?? undefined,
    indicatorsHigh: row.indicators_high ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCompetencyTraitRow(row: any): CompetencyTrait {
  return {
    id: row.id,
    competencyId: row.competency_id,
    traitId: row.trait_id,
    weight: Number(row.weight),
    displayOrder: row.display_order,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapItemRow(row: any): Item {
  return {
    id: row.id,
    competencyId: row.competency_id ?? undefined,
    traitId: row.trait_id,
    responseFormatId: row.response_format_id,
    stem: row.stem,
    reverseScored: row.reverse_scored,
    status: row.status,
    displayOrder: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapItemOptionRow(row: any): ItemOption {
  return {
    id: row.id,
    itemId: row.item_id,
    label: row.label,
    value: Number(row.value),
    sortOrder: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapResponseFormatRow(row: any): ResponseFormat {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    config: row.config,
    isActive: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOrganizationRow(row: any): Organization {
  return {
    id: row.id,
    partnerId: row.partner_id ?? undefined,
    name: row.name,
    slug: row.slug,
    industry: row.industry ?? undefined,
    sizeRange: row.size_range ?? undefined,
    isActive: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// =============================================================================
// TypeScript → DB insert mappers (camelCase → snake_case)
// =============================================================================

export function toDimensionInsert(d: Omit<Dimension, 'id' | 'created_at' | 'updated_at'>) {
  return {
    partner_id: d.partnerId ?? null,
    name: d.name,
    slug: d.slug,
    description: d.description ?? null,
    definition: d.definition ?? null,
    is_scored: d.isScored,
    display_order: d.displayOrder,
    is_active: d.isActive,
    indicators_low: d.indicatorsLow ?? null,
    indicators_mid: d.indicatorsMid ?? null,
    indicators_high: d.indicatorsHigh ?? null,
  }
}

export function toCompetencyInsert(c: Omit<Competency, 'id' | 'created_at' | 'updated_at'>) {
  return {
    dimension_id: c.dimensionId ?? null,
    partner_id: c.partnerId ?? null,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    definition: c.definition ?? null,
    is_active: c.isActive,
    indicators_low: c.indicatorsLow ?? null,
    indicators_mid: c.indicatorsMid ?? null,
    indicators_high: c.indicatorsHigh ?? null,
  }
}

export function toTraitInsert(t: Omit<Trait, 'id' | 'created_at' | 'updated_at'>) {
  return {
    partner_id: t.partnerId ?? null,
    name: t.name,
    slug: t.slug,
    description: t.description ?? null,
    definition: t.definition ?? null,
    is_active: t.isActive,
    indicators_low: t.indicatorsLow ?? null,
    indicators_mid: t.indicatorsMid ?? null,
    indicators_high: t.indicatorsHigh ?? null,
  }
}

export function toItemInsert(i: Omit<Item, 'id' | 'created_at' | 'updated_at'>) {
  return {
    competency_id: i.competencyId ?? null,
    trait_id: i.traitId,
    response_format_id: i.responseFormatId,
    stem: i.stem,
    reverse_scored: i.reverseScored,
    status: i.status,
    display_order: i.displayOrder,
  }
}

export function toOrganizationInsert(o: Omit<Organization, 'id' | 'partnerId' | 'created_at' | 'updated_at'>) {
  return {
    name: o.name,
    slug: o.slug,
    industry: o.industry ?? null,
    size_range: o.sizeRange ?? null,
    is_active: o.isActive,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAssessmentRow(row: any): Assessment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    itemSelectionStrategy: row.item_selection_strategy,
    scoringMethod: row.scoring_method,
    timeLimitMinutes: row.time_limit_minutes ?? undefined,
    creationMode: row.creation_mode,
    matchingRunId: row.matching_run_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

export function toAssessmentInsert(a: Omit<Assessment, 'id' | 'matchingRunId' | 'created_at' | 'updated_at'>) {
  return {
    organization_id: a.organizationId,
    title: a.title,
    description: a.description ?? null,
    status: a.status,
    item_selection_strategy: a.itemSelectionStrategy,
    scoring_method: a.scoringMethod,
    time_limit_minutes: a.timeLimitMinutes ?? null,
    creation_mode: a.creationMode,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapForcedChoiceBlockRow(row: any): ForcedChoiceBlock {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    displayOrder: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapForcedChoiceBlockItemRow(row: any): ForcedChoiceBlockItem {
  return {
    id: row.id,
    blockId: row.block_id,
    itemId: row.item_id,
    position: row.position,
    created_at: row.created_at,
  }
}

export function toForcedChoiceBlockInsert(b: Omit<ForcedChoiceBlock, 'id' | 'created_at' | 'updated_at'>) {
  return {
    name: b.name,
    description: b.description ?? null,
    display_order: b.displayOrder,
  }
}
