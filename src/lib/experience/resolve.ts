import type {
  ExperienceTemplate,
  ExperienceTemplateRecord,
  PageContentMap,
  FlowConfig,
  DemographicsConfig,
  ExperiencePageType,
  CustomPageContent,
} from './types'
import {
  DEFAULT_PAGE_CONTENT,
  DEFAULT_FLOW_CONFIG,
  DEFAULT_DEMOGRAPHICS_CONFIG,
} from './defaults'

// ---------------------------------------------------------------------------
// Deep merge utility — merges source into target at one level depth per page
// ---------------------------------------------------------------------------

function mergePageContent(
  base: Partial<PageContentMap>,
  override: Partial<PageContentMap>
): Partial<PageContentMap> {
  const result = { ...base }

  for (const key of Object.keys(override) as ExperiencePageType[]) {
    const baseSlots = base[key]
    const overrideSlots = override[key]
    if (overrideSlots) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key] = { ...(baseSlots as any), ...(overrideSlots as any) }
    }
  }

  return result
}

function mergeFlowConfig(
  base: Partial<FlowConfig>,
  override: Partial<FlowConfig>
): Partial<FlowConfig> {
  const result = { ...base }

  for (const key of Object.keys(override) as (keyof FlowConfig)[]) {
    const overrideValue = override[key]
    if (overrideValue) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result as any)[key] = { ...base[key], ...overrideValue }
    }
  }

  return result
}

function mergeDemographicsConfig(
  base: DemographicsConfig,
  override: DemographicsConfig
): DemographicsConfig {
  // If override has fields, use them entirely (field-level merge is too granular)
  if (override.fields && override.fields.length > 0) {
    return override
  }
  return base
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective experience template by merging layers:
 * 1. Campaign-specific template (if any)
 * 2. Platform default template (if any)
 * 3. Hardcoded fallback defaults
 *
 * Mirrors the brand config resolution pattern.
 */
export function resolveTemplate(
  platformRecord: ExperienceTemplateRecord | null,
  campaignRecord: ExperienceTemplateRecord | null
): ExperienceTemplate {
  // Start with hardcoded defaults
  let pageContent: Partial<PageContentMap> = { ...DEFAULT_PAGE_CONTENT }
  let flowConfig: Partial<FlowConfig> = { ...DEFAULT_FLOW_CONFIG }
  let demographicsConfig: DemographicsConfig = { ...DEFAULT_DEMOGRAPHICS_CONFIG }
  let customPageContent: Record<string, CustomPageContent> = {}
  let privacyUrl: string | undefined
  let termsUrl: string | undefined

  // Layer 1: Platform overrides
  if (platformRecord) {
    pageContent = mergePageContent(pageContent, platformRecord.pageContent)
    flowConfig = mergeFlowConfig(flowConfig, platformRecord.flowConfig)
    demographicsConfig = mergeDemographicsConfig(
      demographicsConfig,
      platformRecord.demographicsConfig
    )
    if (platformRecord.customPageContent) {
      customPageContent = { ...customPageContent, ...platformRecord.customPageContent }
    }
    if (platformRecord.privacyUrl) privacyUrl = platformRecord.privacyUrl
    if (platformRecord.termsUrl) termsUrl = platformRecord.termsUrl
  }

  // Layer 2: Campaign overrides
  if (campaignRecord) {
    pageContent = mergePageContent(pageContent, campaignRecord.pageContent)
    flowConfig = mergeFlowConfig(flowConfig, campaignRecord.flowConfig)
    demographicsConfig = mergeDemographicsConfig(
      demographicsConfig,
      campaignRecord.demographicsConfig
    )
    if (campaignRecord.customPageContent) {
      customPageContent = { ...customPageContent, ...campaignRecord.customPageContent }
    }
    if (campaignRecord.privacyUrl) privacyUrl = campaignRecord.privacyUrl
    if (campaignRecord.termsUrl) termsUrl = campaignRecord.termsUrl
  }

  return { pageContent, flowConfig, demographicsConfig, customPageContent, privacyUrl, termsUrl }
}

/**
 * Get the resolved content for a specific page type.
 * Returns the page content with all layers merged, typed correctly.
 */
export function getPageContent<T extends ExperiencePageType>(
  template: ExperienceTemplate,
  pageType: T
): PageContentMap[T] {
  const content = template.pageContent[pageType]
  if (content) return content as PageContentMap[T]
  return DEFAULT_PAGE_CONTENT[pageType]
}

/**
 * Check if a page type is enabled in the flow config.
 */
export function isPageEnabled(
  template: ExperienceTemplate,
  pageType: ExperiencePageType
): boolean {
  if (pageType === 'customPages' as string) return false
  const config = template.flowConfig[pageType as keyof Omit<FlowConfig, 'customPages'>]
  if (!config) {
    // Pages without flow config entries are always enabled
    return true
  }
  return config.enabled
}

/**
 * Get the ordered list of enabled pages for a participant flow.
 * Returns both built-in page types and custom page IDs.
 * Excludes 'join' (handled separately) and 'expired' (error state).
 */
export function getFlowOrder(template: ExperienceTemplate): string[] {
  // Built-in pages
  const builtInEntries: { id: string; order: number }[] = []
  const flowEntries = Object.entries(template.flowConfig) as [
    keyof FlowConfig,
    FlowConfig[keyof FlowConfig],
  ][]

  for (const [key, config] of flowEntries) {
    if (key === 'join' || key === 'expired' || key === 'customPages') continue
    if (config && typeof config === 'object' && 'enabled' in config && config.enabled) {
      builtInEntries.push({ id: key, order: (config as { order: number }).order })
    }
  }

  // Custom pages
  const customPages = template.flowConfig.customPages ?? []
  for (const cp of customPages) {
    if (cp.enabled) {
      builtInEntries.push({ id: cp.id, order: cp.order })
    }
  }

  return builtInEntries
    .sort((a, b) => a.order - b.order)
    .map((e) => e.id)
}
