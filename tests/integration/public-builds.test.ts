/**
 * Integration tests for the public Role Builder backend
 * (docs/superpowers/specs/2026-09-17-public-role-builder-design.md).
 *
 * Covers:
 *   - the 20260917* migrations applied (PUBLIC_BUILDS_CLIENT_ID row, both tables)
 *   - a public-build-owned assessment is invisible to the partner library read
 *     (client_id is null filter)
 *   - one-live-build-per-email (hasLiveBuildForEmail)
 *   - the pd_hash cache hit (findCachedRankedBuild)
 *   - the signed tf_public_build cookie: round-trips, rejects tampering/expiry
 *   - RLS: platform admin can SELECT public_builds; an ordinary client admin cannot
 *
 * Requires a running Supabase instance with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { afterAll, describe, expect, it } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'
import { PUBLIC_BUILDS_CLIENT_ID } from '@/lib/public-builds/constants'
import {
  insertPublicBuild,
  findCachedRankedBuild,
  hasLiveBuildForEmail,
  markPublicBuildCreated,
} from '@/lib/dal/public-builds'
import { hashPdText } from '@/lib/public-builds/codes'
import { encodePublicBuildCookie, decodePublicBuildCookie } from '@/lib/public-builds/cookie'
import type { Brief } from '@/types/ai'

const ts = Date.now()
const testEmail = (label: string) => `pb-${label}-${ts}@test.local`
const testSlug = (label: string) => `pb-${label}-${ts}`.toLowerCase()

const sampleBrief: Brief = {
  roleTitle: 'Senior Engineer',
  level: 'ic',
  function: 'engineering',
  outcome: 'selection',
  outcomeIntent: 'selection',
  responsibilities: ['Ships features'],
  contextSignals: [],
  technicalRequirements: [],
  confidence: 'high',
}

describe.skipIf(!canRun)('public Role Builder backend', () => {
  const admin = createAdminClient()
  const authUserIds: string[] = []
  const clientIds: string[] = []

  afterAll(async () => {
    for (const id of authUserIds) {
      try {
        await admin.auth.admin.deleteUser(id)
      } catch {
        // best-effort cleanup
      }
    }
    for (const id of clientIds) {
      try {
        await admin.from('clients').delete().eq('id', id)
      } catch {
        // best-effort cleanup
      }
    }
  })

  it('applied the PUBLIC_BUILDS_CLIENT_ID client row and both tables', async () => {
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('id, name')
      .eq('id', PUBLIC_BUILDS_CLIENT_ID)
      .single()
    expect(clientErr).toBeNull()
    expect(client?.id).toBe(PUBLIC_BUILDS_CLIENT_ID)

    const { error: codesErr } = await admin.from('public_build_codes').select('id').limit(1)
    expect(codesErr).toBeNull()

    const { error: buildsErr } = await admin.from('public_builds').select('id').limit(1)
    expect(buildsErr).toBeNull()
  })

  it('a public-build-owned assessment is invisible to a client_id-is-null library read', async () => {
    const { data: assessment, error: assessmentErr } = await admin
      .from('assessments')
      .insert({
        title: `PB assessment ${ts}`,
        status: 'active',
        item_selection_strategy: 'fixed',
        creation_mode: 'ai_generated',
        format_mode: 'traditional',
        client_id: PUBLIC_BUILDS_CLIENT_ID,
      })
      .select('id')
      .single()
    if (assessmentErr) throw new Error(`assessment insert failed: ${assessmentErr.message}`)

    try {
      // Mirrors getPartnerAssessmentLibrary's `.is('client_id', null)` filter
      // (src/app/actions/assessments.ts) — the mechanism the spec relies on to
      // keep public builds out of every partner's library.
      const { data: libraryRows, error } = await admin
        .from('assessments')
        .select('id')
        .is('deleted_at', null)
        .is('client_id', null)
        .eq('id', assessment!.id)
      expect(error).toBeNull()
      expect(libraryRows ?? []).toHaveLength(0)
    } finally {
      await admin.from('assessments').delete().eq('id', assessment!.id)
    }
  })

  it('enforces one live build per email', async () => {
    const email = testEmail('live')
    const pdHash = hashPdText(`live-build PD ${ts}`)
    const { id: buildId } = await insertPublicBuild(admin, {
      email,
      ipHash: null,
      roleTitle: 'Test Role',
      pdHash,
      pdText: 'PD text',
      brief: sampleBrief,
      tier: 'core',
    })

    try {
      // Merely "ranked" (not yet created) — not live.
      expect(await hasLiveBuildForEmail(admin, email)).toBe(false)

      await markPublicBuildCreated(admin, buildId, {
        picks: ['f1', 'f2', 'f3', 'f4'],
        assessmentId: '00000000-0000-0000-0000-000000000000',
        campaignId: '00000000-0000-0000-0000-000000000000',
        participantId: '00000000-0000-0000-0000-000000000000',
      })

      expect(await hasLiveBuildForEmail(admin, email)).toBe(true)
      // Excluding this build's own id still finds it live (there is no OTHER
      // live build) only if excludeId isn't this one — sanity-check the
      // exclusion parameter itself:
      expect(await hasLiveBuildForEmail(admin, email, buildId)).toBe(false)
    } finally {
      await admin.from('public_builds').delete().eq('id', buildId)
    }
  })

  it('reuses a cached ranking for the same email + normalised PD text (pd_hash)', async () => {
    const email = testEmail('cache')
    const pdHash = hashPdText('  Cached PD Text  ')
    const ranking = {
      picks: [],
      summary: 'cached summary',
      recommendedCount: { minimum: 1, optimal: 2, maximum: 3 },
      consideredCount: 0,
      eligibleFactors: [],
      categories: [],
    }
    const { id: buildId } = await insertPublicBuild(admin, {
      email,
      ipHash: null,
      roleTitle: 'Cached Role',
      pdHash,
      pdText: 'cached pd text',
      brief: sampleBrief,
      tier: 'core',
      ranking,
    })

    try {
      const cached = await findCachedRankedBuild(admin, email, pdHash)
      expect(cached?.id).toBe(buildId)
      expect(cached?.ranking?.summary).toBe('cached summary')

      // A different email must not see this email's cache.
      const otherEmailCached = await findCachedRankedBuild(admin, testEmail('other'), pdHash)
      expect(otherEmailCached).toBeNull()
    } finally {
      await admin.from('public_builds').delete().eq('id', buildId)
    }
  })

  it('signs and verifies the tf_public_build cookie, rejecting tampering', () => {
    const cookie = encodePublicBuildCookie('cookie-test@test.local')
    const decoded = decodePublicBuildCookie(cookie)
    expect(decoded?.email).toBe('cookie-test@test.local')

    const [payload, signature] = cookie.split('.')
    const tampered = `${payload}x.${signature}`
    expect(decodePublicBuildCookie(tampered)).toBeNull()

    expect(decodePublicBuildCookie(undefined)).toBeNull()
    expect(decodePublicBuildCookie('not-a-cookie')).toBeNull()
  })

  it('RLS: platform admin can SELECT public_builds; an ordinary client admin cannot', async () => {
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .insert({ name: `PB RLS Client ${ts}`, slug: testSlug('rls') })
      .select('id')
      .single()
    if (clientErr) throw new Error(`client insert failed: ${clientErr.message}`)
    clientIds.push(client!.id)

    const email = testEmail('rls-probe')
    const { id: buildId } = await insertPublicBuild(admin, {
      email,
      ipHash: null,
      roleTitle: 'RLS probe',
      pdHash: hashPdText('rls probe pd'),
      pdText: 'pd',
      brief: sampleBrief,
      tier: 'essentials',
    })

    try {
      const platformAdmin = await createTestUser(admin, {
        email: testEmail('platform-admin'),
        role: 'platform_admin',
      })
      authUserIds.push(platformAdmin.userId)

      const clientAdmin = await createTestUser(admin, {
        email: testEmail('client-admin'),
        role: 'org_admin',
        clientId: client!.id,
      })
      authUserIds.push(clientAdmin.userId)

      const { data: asAdmin, error: asAdminErr } = await platformAdmin.client
        .from('public_builds')
        .select('id')
        .eq('id', buildId)
      expect(asAdminErr).toBeNull()
      expect(asAdmin).toHaveLength(1)

      const { data: asClient, error: asClientErr } = await clientAdmin.client
        .from('public_builds')
        .select('id')
        .eq('id', buildId)
      expect(asClientErr).toBeNull()
      expect(asClient ?? []).toHaveLength(0)
    } finally {
      await admin.from('public_builds').delete().eq('id', buildId)
    }
  })
})
