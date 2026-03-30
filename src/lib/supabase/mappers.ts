import type {
  Assessment,
  Dimension,
  Factor,
  Construct,
  FactorConstruct,
  Item,
  ItemOption,
  Organization,
  ResponseFormat,
  AssessmentSection,
  AssessmentSectionItem,
  CalibrationRun,
  ItemStatistic,
  ConstructReliability,
  NormGroup,
  NormTable,
  FactorAnalysisResult,
  DIFResult,
  Campaign,
  CampaignAssessment,
  CampaignParticipant,
  CampaignAccessLink,
  GenerationRun,
  GeneratedItem,
  GenerationRunLog,
} from '@/types/database'
import type { BrandConfigRecord } from '@/lib/brand/types'
import type { ExperienceTemplateRecord } from '@/lib/experience/types'

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
    deletedAt: row.deleted_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFactorRow(row: any): Factor {
  return {
    id: row.id,
    dimensionId: row.dimension_id ?? undefined,
    partnerId: row.partner_id ?? undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    definition: row.definition ?? undefined,
    isActive: row.is_active,
    isMatchEligible: row.is_match_eligible ?? true,
    organizationId: row.organization_id ?? undefined,
    indicatorsLow: row.indicators_low ?? undefined,
    indicatorsMid: row.indicators_mid ?? undefined,
    indicatorsHigh: row.indicators_high ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapConstructRow(row: any): Construct {
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
    deletedAt: row.deleted_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFactorConstructRow(row: any): FactorConstruct {
  return {
    id: row.id,
    factorId: row.factor_id,
    constructId: row.construct_id,
    weight: Number(row.weight),
    displayOrder: row.display_order,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapItemRow(row: any): Item {
  return {
    id: row.id,
    constructId: row.construct_id ?? undefined,
    responseFormatId: row.response_format_id,
    stem: row.stem,
    reverseScored: row.reverse_scored,
    weight: row.weight != null ? Number(row.weight) : 1.0,
    status: row.status,
    displayOrder: row.display_order,
    purpose: row.purpose ?? 'construct',
    keyedAnswer: row.keyed_answer != null ? Number(row.keyed_answer) : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
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
    deletedAt: row.deleted_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBrandConfigRow(row: any): BrandConfigRecord {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id ?? null,
    config: row.config,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    deletedAt: row.deleted_at ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapExperienceTemplateRow(row: any): ExperienceTemplateRecord {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id ?? null,
    pageContent: row.page_content ?? {},
    flowConfig: row.flow_config ?? {},
    demographicsConfig: row.demographics_config ?? { fields: [] },
    customPageContent: row.custom_page_content ?? {},
    privacyUrl: row.privacy_url ?? null,
    termsUrl: row.terms_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    deletedAt: row.deleted_at ?? null,
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

export function toFactorInsert(c: Omit<Factor, 'id' | 'created_at' | 'updated_at'>) {
  return {
    dimension_id: c.dimensionId ?? null,
    partner_id: c.partnerId ?? null,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    definition: c.definition ?? null,
    is_active: c.isActive,
    is_match_eligible: c.isMatchEligible ?? true,
    organization_id: c.organizationId ?? null,
    indicators_low: c.indicatorsLow ?? null,
    indicators_mid: c.indicatorsMid ?? null,
    indicators_high: c.indicatorsHigh ?? null,
  }
}

export function toConstructInsert(t: Omit<Construct, 'id' | 'created_at' | 'updated_at'>) {
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
    construct_id: i.constructId ?? null,
    response_format_id: i.responseFormatId,
    stem: i.stem,
    reverse_scored: i.reverseScored,
    weight: i.weight ?? 1.0,
    status: i.status,
    display_order: i.displayOrder,
    purpose: i.purpose ?? 'construct',
    keyed_answer: i.keyedAnswer ?? null,
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
    organizationId: row.organization_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    itemSelectionStrategy: row.item_selection_strategy,
    scoringMethod: row.scoring_method,
    creationMode: row.creation_mode,
    formatMode: row.format_mode ?? 'traditional',
    fcBlockSize: row.fc_block_size != null ? Number(row.fc_block_size) : undefined,
    matchingRunId: row.matching_run_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  }
}

export function toAssessmentInsert(a: Omit<Assessment, 'id' | 'matchingRunId' | 'created_at' | 'updated_at'>) {
  return {
    organization_id: a.organizationId ?? null,
    title: a.title,
    description: a.description ?? null,
    status: a.status,
    item_selection_strategy: a.itemSelectionStrategy,
    scoring_method: a.scoringMethod,
    creation_mode: a.creationMode,
    format_mode: a.formatMode ?? 'traditional',
    fc_block_size: a.fcBlockSize ?? null,
  }
}

// =============================================================================
// Assessment Sections
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAssessmentSectionRow(row: any): AssessmentSection {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    responseFormatId: row.response_format_id,
    title: row.title,
    instructions: row.instructions ?? undefined,
    displayOrder: row.display_order,
    itemOrdering: row.item_ordering,
    itemsPerPage: row.items_per_page ?? undefined,
    timeLimitSeconds: row.time_limit_seconds ?? undefined,
    allowBackNav: row.allow_back_nav,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAssessmentSectionItemRow(row: any): AssessmentSectionItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    itemId: row.item_id,
    displayOrder: row.display_order,
    created_at: row.created_at,
  }
}

export function toAssessmentSectionInsert(
  s: Omit<AssessmentSection, 'id' | 'created_at' | 'updated_at'>,
) {
  return {
    assessment_id: s.assessmentId,
    response_format_id: s.responseFormatId,
    title: s.title,
    instructions: s.instructions ?? null,
    display_order: s.displayOrder,
    item_ordering: s.itemOrdering,
    items_per_page: s.itemsPerPage ?? null,
    time_limit_seconds: s.timeLimitSeconds ?? null,
    allow_back_nav: s.allowBackNav,
  }
}

// =============================================================================
// Psychometric Infrastructure
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCalibrationRunRow(row: any): CalibrationRun {
  return {
    id: row.id,
    runType: row.run_type,
    method: row.method,
    status: row.status,
    sampleSize: row.sample_size ?? undefined,
    dateRangeStart: row.date_range_start ?? undefined,
    dateRangeEnd: row.date_range_end ?? undefined,
    notes: row.notes ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapItemStatisticRow(row: any): ItemStatistic {
  return {
    id: row.id,
    itemId: row.item_id,
    calibrationRunId: row.calibration_run_id,
    difficulty: row.difficulty != null ? Number(row.difficulty) : undefined,
    discrimination: row.discrimination != null ? Number(row.discrimination) : undefined,
    alphaIfDeleted: row.alpha_if_deleted != null ? Number(row.alpha_if_deleted) : undefined,
    responseCount: row.response_count ?? undefined,
    responseDistribution: row.response_distribution ?? undefined,
    irtInformationAt0: row.irt_information_at_0 != null ? Number(row.irt_information_at_0) : undefined,
    irtMaxInformation: row.irt_max_information != null ? Number(row.irt_max_information) : undefined,
    irtThetaAtMaxInfo: row.irt_theta_at_max_info != null ? Number(row.irt_theta_at_max_info) : undefined,
    irtInfit: row.irt_infit != null ? Number(row.irt_infit) : undefined,
    irtOutfit: row.irt_outfit != null ? Number(row.irt_outfit) : undefined,
    irtParamSeA: row.irt_param_se_a != null ? Number(row.irt_param_se_a) : undefined,
    irtParamSeB: row.irt_param_se_b != null ? Number(row.irt_param_se_b) : undefined,
    irtParamSeC: row.irt_param_se_c != null ? Number(row.irt_param_se_c) : undefined,
    flagged: row.flagged,
    flagReasons: row.flag_reasons ?? undefined,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapConstructReliabilityRow(row: any): ConstructReliability {
  return {
    id: row.id,
    constructId: row.construct_id,
    calibrationRunId: row.calibration_run_id,
    cronbachAlpha: row.cronbach_alpha != null ? Number(row.cronbach_alpha) : undefined,
    omegaTotal: row.omega_total != null ? Number(row.omega_total) : undefined,
    omegaHierarchical: row.omega_hierarchical != null ? Number(row.omega_hierarchical) : undefined,
    compositeReliability: row.composite_reliability != null ? Number(row.composite_reliability) : undefined,
    splitHalf: row.split_half != null ? Number(row.split_half) : undefined,
    sem: row.sem != null ? Number(row.sem) : undefined,
    csemByScore: row.csem_by_score ?? undefined,
    itemCount: row.item_count ?? undefined,
    responseCount: row.response_count ?? undefined,
    mean: row.mean != null ? Number(row.mean) : undefined,
    standardDeviation: row.standard_deviation != null ? Number(row.standard_deviation) : undefined,
    skewness: row.skewness != null ? Number(row.skewness) : undefined,
    kurtosis: row.kurtosis != null ? Number(row.kurtosis) : undefined,
    itemContributions: row.item_contributions ?? undefined,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNormGroupRow(row: any): NormGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    industry: row.industry ?? undefined,
    roleLevel: row.role_level ?? undefined,
    jobFunction: row.job_function ?? undefined,
    region: row.region ?? undefined,
    organizationId: row.organization_id ?? undefined,
    sampleSize: row.sample_size,
    collectionStart: row.collection_start ?? undefined,
    collectionEnd: row.collection_end ?? undefined,
    lastRefreshed: row.last_refreshed ?? undefined,
    isActive: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNormTableRow(row: any): NormTable {
  return {
    id: row.id,
    normGroupId: row.norm_group_id,
    constructId: row.construct_id,
    mean: Number(row.mean),
    standardDeviation: Number(row.standard_deviation),
    sampleSize: row.sample_size,
    percentileLookup: row.percentile_lookup ?? undefined,
    stanineCutpoints: row.stanine_cutpoints ?? undefined,
    stenCutpoints: row.sten_cutpoints ?? undefined,
    scoreType: row.score_type,
    lastComputed: row.last_computed,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFactorAnalysisResultRow(row: any): FactorAnalysisResult {
  return {
    id: row.id,
    calibrationRunId: row.calibration_run_id,
    analysisType: row.analysis_type,
    estimationMethod: row.estimation_method ?? undefined,
    cfi: row.cfi != null ? Number(row.cfi) : undefined,
    tli: row.tli != null ? Number(row.tli) : undefined,
    rmsea: row.rmsea != null ? Number(row.rmsea) : undefined,
    rmseaCiLower: row.rmsea_ci_lower != null ? Number(row.rmsea_ci_lower) : undefined,
    rmseaCiUpper: row.rmsea_ci_upper != null ? Number(row.rmsea_ci_upper) : undefined,
    srmr: row.srmr != null ? Number(row.srmr) : undefined,
    chiSquare: row.chi_square != null ? Number(row.chi_square) : undefined,
    chiSquareDf: row.chi_square_df ?? undefined,
    chiSquareP: row.chi_square_p != null ? Number(row.chi_square_p) : undefined,
    loadings: row.loadings ?? undefined,
    ave: row.ave ?? undefined,
    htmt: row.htmt ?? undefined,
    constructCorrelations: row.construct_correlations ?? undefined,
    sampleSize: row.sample_size ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDIFResultRow(row: any): DIFResult {
  return {
    id: row.id,
    itemId: row.item_id,
    calibrationRunId: row.calibration_run_id,
    groupingVariable: row.grouping_variable,
    referenceGroup: row.reference_group,
    focalGroup: row.focal_group,
    method: row.method,
    effectSize: row.effect_size != null ? Number(row.effect_size) : undefined,
    pValue: row.p_value != null ? Number(row.p_value) : undefined,
    classification: row.classification ?? undefined,
    referenceN: row.reference_n ?? undefined,
    focalN: row.focal_n ?? undefined,
    flagged: row.flagged,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
  }
}

// =============================================================================
// Campaign Management
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignRow(row: any): Campaign {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? undefined,
    status: row.status,
    organizationId: row.organization_id ?? undefined,
    partnerId: row.partner_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    opensAt: row.opens_at ?? undefined,
    closesAt: row.closes_at ?? undefined,
    branding: row.branding ?? {},
    allowResume: row.allow_resume,
    showProgress: row.show_progress,
    randomizeAssessmentOrder: row.randomize_assessment_order,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignAssessmentRow(row: any): CampaignAssessment {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    assessmentId: row.assessment_id,
    displayOrder: row.display_order,
    isRequired: row.is_required,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignParticipantRow(row: any): CampaignParticipant {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    email: row.email,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    accessToken: row.access_token,
    status: row.status,
    invitedAt: row.invited_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignAccessLinkRow(row: any): CampaignAccessLink {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    token: row.token,
    label: row.label ?? undefined,
    maxUses: row.max_uses ?? undefined,
    useCount: row.use_count,
    expiresAt: row.expires_at ?? undefined,
    isActive: row.is_active,
    created_at: row.created_at,
  }
}

export function toCampaignInsert(c: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>) {
  return {
    title: c.title,
    slug: c.slug,
    description: c.description ?? null,
    status: c.status,
    organization_id: c.organizationId ?? null,
    partner_id: c.partnerId ?? null,
    created_by: c.createdBy ?? null,
    opens_at: c.opensAt ?? null,
    closes_at: c.closesAt ?? null,
    branding: c.branding ?? {},
    allow_resume: c.allowResume,
    show_progress: c.showProgress,
    randomize_assessment_order: c.randomizeAssessmentOrder,
  }
}

// =============================================================================
// AI-GENIE item generation
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapGenerationRunRow(row: any): GenerationRun {
  return {
    id: row.id,
    status: row.status,
    currentStep: row.current_step ?? undefined,
    progressPct: row.progress_pct,
    config: row.config ?? {},
    itemsGenerated: row.items_generated,
    itemsAfterUva: row.items_after_uva ?? undefined,
    itemsAfterBoot: row.items_after_boot ?? undefined,
    itemsAccepted: row.items_accepted ?? undefined,
    nmiInitial: row.nmi_initial != null ? Number(row.nmi_initial) : undefined,
    nmiFinal: row.nmi_final != null ? Number(row.nmi_final) : undefined,
    promptVersion: row.prompt_version ?? undefined,
    modelUsed: row.model_used ?? undefined,
    aiSnapshot: row.ai_snapshot ?? undefined,
    tokenUsage: row.token_usage ?? undefined,
    errorMessage: row.error_message ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapGeneratedItemRow(row: any): GeneratedItem {
  return {
    id: row.id,
    generationRunId: row.generation_run_id,
    constructId: row.construct_id,
    stem: row.stem,
    reverseScored: row.reverse_scored,
    rationale: row.rationale ?? undefined,
    embedding: row.embedding ?? [],
    communityId: row.community_id ?? undefined,
    wtoMax: row.wto_max != null ? Number(row.wto_max) : undefined,
    bootStability: row.boot_stability != null ? Number(row.boot_stability) : undefined,
    isRedundant: row.is_redundant,
    isUnstable: row.is_unstable,
    isAccepted: row.is_accepted ?? undefined,
    savedItemId: row.saved_item_id ?? undefined,
    created_at: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapGenerationRunLogRow(row: any): GenerationRunLog {
  return {
    id: row.id,
    generationRunId: row.generation_run_id,
    step: row.step,
    status: row.status,
    details: row.details ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    created_at: row.created_at,
  }
}
