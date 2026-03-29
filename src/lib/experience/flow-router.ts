import type { ExperienceTemplate, FlowConfig } from './types'

// =============================================================================
// Centralized flow router — replaces all hardcoded participant navigation
// =============================================================================

/**
 * Sentinel value marking where assessment sections appear in the flow.
 * Pre-assessment pages have order < 100, post-assessment pages have order >= 100.
 */
export const SECTIONS_SENTINEL = '__sections__' as const
const SENTINEL_ORDER = 100

/** A step in the full flow — either a page ID or the sections sentinel. */
export type FlowStep = string

/**
 * URL map for built-in pages. Custom pages would use `/assess/{token}/custom/{id}`.
 */
function pageUrl(pageId: string, token: string): string {
  const map: Record<string, string> = {
    join: `/assess/${token}`,
    welcome: `/assess/${token}/welcome`,
    consent: `/assess/${token}/consent`,
    demographics: `/assess/${token}/demographics`,
    review: `/assess/${token}/review`,
    complete: `/assess/${token}/complete`,
    report: `/assess/${token}/report`,
  }
  return map[pageId] ?? `/assess/${token}/${pageId}`
}

/**
 * Returns the ordered list of enabled page IDs with a `__sections__` sentinel
 * marking where assessment sections happen. Excludes `expired` (terminal error state).
 *
 * Pages with order < 100 appear before sections, pages with order >= 100 after.
 */
export function getFullFlowOrder(template: ExperienceTemplate): FlowStep[] {
  const prePages: { id: string; order: number }[] = []
  const postPages: { id: string; order: number }[] = []

  // Built-in pages (skip expired — terminal state, not part of flow)
  const flowEntries = Object.entries(template.flowConfig) as [
    keyof FlowConfig,
    FlowConfig[keyof FlowConfig],
  ][]

  for (const [key, config] of flowEntries) {
    if (key === 'expired' || key === 'customPages') continue
    if (config && typeof config === 'object' && 'enabled' in config && config.enabled) {
      const order = (config as { order: number }).order
      if (order < SENTINEL_ORDER) {
        prePages.push({ id: key, order })
      } else {
        postPages.push({ id: key, order })
      }
    }
  }

  // Custom pages
  const customPages = template.flowConfig.customPages ?? []
  for (const cp of customPages) {
    if (cp.enabled) {
      if (cp.order < SENTINEL_ORDER) {
        prePages.push({ id: cp.id, order: cp.order })
      } else {
        postPages.push({ id: cp.id, order: cp.order })
      }
    }
  }

  prePages.sort((a, b) => a.order - b.order)
  postPages.sort((a, b) => a.order - b.order)

  return [
    ...prePages.map((p) => p.id),
    SECTIONS_SENTINEL,
    ...postPages.map((p) => p.id),
  ]
}

/**
 * Given the current page, returns the URL for the next enabled page.
 *
 * - When `currentStep` is a pre-section page and the next step is `__sections__`,
 *   returns `/assess/{token}/section/0`.
 * - When `currentStep` is `__sections__` (called after the last section item),
 *   returns the first post-section page URL.
 * - Returns `null` if there's no next page.
 */
export function getNextFlowUrl(
  template: ExperienceTemplate,
  currentStep: string,
  token: string,
): string | null {
  const flow = getFullFlowOrder(template)
  const idx = flow.indexOf(currentStep)
  if (idx === -1 || idx >= flow.length - 1) return null

  const next = flow[idx + 1]
  if (next === SECTIONS_SENTINEL) {
    return `/assess/${token}/section/0`
  }
  return pageUrl(next, token)
}

/**
 * Given the current page, returns the URL for the previous enabled page.
 * Returns `null` if there's no previous page.
 */
export function getPreviousFlowUrl(
  template: ExperienceTemplate,
  currentStep: string,
  token: string,
): string | null {
  const flow = getFullFlowOrder(template)
  const idx = flow.indexOf(currentStep)
  if (idx <= 0) return null

  const prev = flow[idx - 1]
  if (prev === SECTIONS_SENTINEL) {
    // Going back into sections — would need to know the last section index
    // For now, return null (back button in sections handles its own navigation)
    return null
  }
  return pageUrl(prev, token)
}

/**
 * Returns the URL for the first page after the sections sentinel.
 * Called when the last section item is completed.
 */
export function getPostSectionsUrl(
  template: ExperienceTemplate,
  token: string,
): string {
  const flow = getFullFlowOrder(template)
  const sentinelIdx = flow.indexOf(SECTIONS_SENTINEL)

  if (sentinelIdx >= 0 && sentinelIdx < flow.length - 1) {
    const next = flow[sentinelIdx + 1]
    return pageUrl(next, token)
  }

  // Fallback — should never happen if complete is enabled
  return `/assess/${token}/complete`
}
