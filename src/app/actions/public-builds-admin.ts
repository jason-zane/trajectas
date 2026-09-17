'use server'

/**
 * Admin-only reads for /public-builds (docs/superpowers/specs/2026-09-17-public-role-builder-design.md).
 * Platform admin only — the funnel, the cost meter, and the lead list for
 * the public Role Builder in one screen.
 */

import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPublicBuilds, getPublicBuildById, type PublicBuildDTO } from '@/lib/dal/public-builds'
import { getPublicBuildsMode, getPublicBuildsDailyCap } from '@/lib/public-builds/constants'

function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function sumTokens(usage: PublicBuildDTO['usage']): number {
  if (!usage) return 0
  return Object.values(usage).reduce(
    (sum, stage) => sum + (stage?.inputTokens ?? 0) + (stage?.outputTokens ?? 0),
    0,
  )
}

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

  const sinceUtc = startOfUtcDayIso()
  const runs = await listPublicBuilds(db, { limit: 500 })
  const todaysRuns = runs.filter((r) => r.createdAt >= sinceUtc)
  const buildsToday = todaysRuns.length
  const tokensToday = todaysRuns.reduce((sum, r) => sum + sumTokens(r.usage), 0)

  return {
    mode: getPublicBuildsMode(),
    dailyCap: getPublicBuildsDailyCap(),
    buildsToday,
    tokensToday,
    runs,
  }
}

export async function getPublicBuildAdminDetail(id: string): Promise<PublicBuildDTO | null> {
  await requireAdminScope()
  const db = createAdminClient()
  return getPublicBuildById(db, id)
}
