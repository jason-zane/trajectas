'use server'

/**
 * Admin-only reads for /public-builds (docs/superpowers/specs/2026-09-17-public-role-builder-design.md).
 * Platform admin only — the funnel, the cost meter, and the lead list for
 * the public Role Builder in one screen.
 */

import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  listPublicBuilds,
  getPublicBuildById,
  getPublicBuildsMeterSince,
  type PublicBuildDTO,
} from '@/lib/dal/public-builds'
import { getPublicBuildsMode, getPublicBuildsDailyCap } from '@/lib/public-builds/constants'
import { startOfUtcDayIso } from '@/lib/public-builds/shared'

export interface PublicBuildsAdminSummary {
  mode: ReturnType<typeof getPublicBuildsMode>
  dailyCap: number
  buildsToday: number
  tokensToday: number
  runs: PublicBuildDTO[]
}

/**
 * Cross-tenant by design: this IS the platform admin screen for the public
 * Role Builder's system client. Behind requireAdminScope(). See the vetted
 * allowlist reasoning applied to the analogous console pages (getAssessments,
 * getMatchingRuns) in tests/architecture/tenant-scope-predicates.test.ts —
 * public_builds/public_build_codes carry no per-tenant boundary at all
 * (platform-only data), so they are not in that guard's TENANT_TABLES set.
 */
export async function getPublicBuildsAdminSummary(): Promise<PublicBuildsAdminSummary> {
  await requireAdminScope()
  const db = createAdminClient()

  const [meter, runs] = await Promise.all([
    getPublicBuildsMeterSince(db, startOfUtcDayIso()),
    listPublicBuilds(db, { limit: 500 }),
  ])

  return {
    mode: getPublicBuildsMode(),
    dailyCap: getPublicBuildsDailyCap(),
    buildsToday: meter.builds,
    tokensToday: meter.tokens,
    runs,
  }
}

export async function getPublicBuildAdminDetail(id: string): Promise<PublicBuildDTO | null> {
  await requireAdminScope()
  const db = createAdminClient()
  return getPublicBuildById(db, id)
}
