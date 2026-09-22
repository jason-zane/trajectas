'use server'

/**
 * Public Role Builder — the six actions behind /build.
 *
 * None of these call requireAdminScope: the gate is the signed
 * tf_public_build cookie (issued by verifyCode) plus the rate limits below.
 * They mutate through the admin client without a scope gate, so they are on
 * the ALLOWLIST of tests/architecture/admin-actions-authz.test.ts as
 * self-service/token exceptions.
 *
 * See docs/superpowers/specs/2026-09-17-public-role-builder-design.md.
 */

import { headers, cookies } from 'next/headers'
import { z } from 'zod'
import { checkBotId } from 'botid/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkKeyedRateLimit } from '@/lib/security/rate-limit'
import { logActionError } from '@/lib/security/action-errors'
import { sendEmail } from '@/lib/email/send'
import { createAssessment } from '@/app/actions/assessments'
import { createCampaign, addAssessmentToCampaign, sendParticipantInviteEmail } from '@/app/actions/campaigns'
import { getFormatBreakdownForScope, buildDefaultSectionDrafts } from '@/lib/dal/assessment-sections'
import { runBriefExtraction } from '@/lib/ai/brief-extraction'
import { extractTextFromUpload } from '@/lib/ai/role-text-extraction'
import { runArchitectMatchPipeline } from '@/lib/ai/architect-match'
import { runArchitectOverview } from '@/lib/ai/architect-overview'
import {
  generatePublicBuildCode,
  hashPublicBuildCode,
  verifyPublicBuildCode,
  hashIp,
  hashPdText,
  secretsEqual,
} from '@/lib/public-builds/codes'
import {
  encodePublicBuildCookie,
  decodePublicBuildCookie,
  getPublicBuildCookieOptions,
  PUBLIC_BUILD_COOKIE,
} from '@/lib/public-builds/cookie'
import {
  PUBLIC_BUILDS_CLIENT_ID,
  PUBLIC_BUILDS_SYSTEM_SCOPE,
  PUBLIC_BUILDS_ITEMS_PER_FACTOR,
  PUBLIC_BUILDS_MAX_PD_CHARS,
  PUBLIC_BUILDS_MAX_UPLOAD_BYTES,
  PUBLIC_BUILDS_CODE_EXPIRY_MS,
  PUBLIC_BUILDS_CODE_MAX_ATTEMPTS,
  PUBLIC_BUILDS_MAX_BUILDS_PER_EMAIL_PER_DAY,
  getPublicBuildsMode,
  getPublicBuildsDailyCap,
  type PublicBuildTier,
} from '@/lib/public-builds/constants'
import { startOfUtcDayIso } from '@/lib/public-builds/shared'
import { validatePicks } from '@/lib/public-builds/validation'
import {
  insertPublicBuildCode,
  getLatestPublicBuildCode,
  reserveNextPublicBuildCodeAttempt,
  consumePublicBuildCode,
  insertPublicBuild,
  revisePublicBuild,
  getPublicBuildById,
  findCachedRankedBuild,
  updatePublicBuildRanking,
  claimPublicBuildForCreation,
  markPublicBuildCreated,
  markPublicBuildFailed,
  countPublicBuildsSince,
  countBuildsForEmailSince,
  hasCreatingBuildForEmail,
  type PublicBuildDTO,
  type PublicBuildUsage,
} from '@/lib/dal/public-builds'
import type { Brief } from '@/types/ai'
import type { ArchitectMatchResult } from '@/types/architect'
import type { SectionDraft } from '@/app/actions/assessments'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getRequestIp(): Promise<string | null> {
  const h = await headers()
  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? null
  return h.get('x-real-ip')
}

async function getVerifiedEmail(): Promise<string | null> {
  const store = await cookies()
  const decoded = decodePublicBuildCookie(store.get(PUBLIC_BUILD_COOKIE)?.value)
  return decoded?.email ?? null
}

/**
 * Tagged result, not a plain union with `{ error: string }` — PublicBuildDTO
 * itself has an `error` field (the build's own failure reason), so `'error'
 * in result` would match a perfectly good build row too.
 */
type OwnedBuildResult = { ok: true; build: PublicBuildDTO } | { ok: false; error: string }

async function loadOwnedBuild(buildId: string, email: string): Promise<OwnedBuildResult> {
  const db = createAdminClient()
  const build = await getPublicBuildById(db, buildId)
  if (!build || build.email !== email) {
    return { ok: false, error: 'Build not found.' }
  }
  return { ok: true, build }
}

const emailSchema = z.string().trim().toLowerCase().email().max(320)

type ActionResult<T> = T | { error: string }

// ---------------------------------------------------------------------------
// requestCode
// ---------------------------------------------------------------------------

export async function requestCode(input: {
  email: string
  inviteCode?: string
}): Promise<ActionResult<{ success: true }>> {
  const mode = getPublicBuildsMode()
  if (mode === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }

  if (mode === 'closed') {
    const expected = process.env.PUBLIC_BUILDS_INVITE_CODE
    if (!expected || !secretsEqual(input.inviteCode ?? '', expected)) {
      return { error: 'Invalid invite code.' }
    }
  }

  const parsedEmail = emailSchema.safeParse(input.email)
  if (!parsedEmail.success) {
    return { error: 'Enter a valid email address.' }
  }
  const email = parsedEmail.data

  try {
    const verification = await checkBotId()
    if (verification.isBot) {
      return { error: 'Verification failed. Please try again.' }
    }
  } catch (error) {
    // BotID unavailable (e.g. missing Vercel context in some environments) —
    // fail open on the bot check alone; rate limits still apply below.
    logActionError('publicBuilds.requestCode.botid', error)
  }

  const ip = await getRequestIp()
  const ipHash = ip ? hashIp(ip) : null

  if (ip) {
    const ipLimit = await checkKeyedRateLimit(`public-build-code-ip:${ip}`, 5, 60 * 60 * 1000, false)
    if (ipLimit && !ipLimit.allowed) {
      return { error: 'Too many requests. Try again later.' }
    }
  }
  const emailLimit = await checkKeyedRateLimit(`public-build-code-email:${email}`, 3, 60 * 60 * 1000, false)
  if (emailLimit && !emailLimit.allowed) {
    return { error: 'Too many requests for this email. Try again later.' }
  }

  const db = createAdminClient()
  const code = generatePublicBuildCode()
  await insertPublicBuildCode(db, {
    email,
    codeHash: hashPublicBuildCode(code),
    expiresAt: new Date(Date.now() + PUBLIC_BUILDS_CODE_EXPIRY_MS).toISOString(),
    ipHash,
  })

  try {
    await sendEmail({
      type: 'public_build_code',
      to: email,
      variables: { code, brandName: 'Trajectas' },
    })
  } catch (error) {
    logActionError('publicBuilds.requestCode.email', error)
    return { error: 'Could not send the code. Try again.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// verifyCode
// ---------------------------------------------------------------------------

export async function verifyCode(input: {
  email: string
  code: string
}): Promise<ActionResult<{ success: true }>> {
  if (getPublicBuildsMode() === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }

  const parsedEmail = emailSchema.safeParse(input.email)
  const code = (input.code ?? '').trim()
  if (!parsedEmail.success || !/^\d{6}$/.test(code)) {
    return { error: 'Enter the six-digit code.' }
  }
  const email = parsedEmail.data

  const db = createAdminClient()
  const row = await getLatestPublicBuildCode(db, email)
  if (!row) {
    return { error: 'Request a new code.' }
  }
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { error: 'That code has expired. Request a new one.' }
  }

  // Reserve the attempt BEFORE checking the code: reserving after (on a
  // wrong guess) would let concurrent requests all read the same stale
  // attempts count and each burn a guess against the cap, defeating it
  // under concurrency. Reserving first bounds total guesses against this
  // code to exactly PUBLIC_BUILDS_CODE_MAX_ATTEMPTS no matter how many
  // requests race.
  const reserved = await reserveNextPublicBuildCodeAttempt(db, row.id, PUBLIC_BUILDS_CODE_MAX_ATTEMPTS)
  if (reserved === null) {
    return { error: 'Too many attempts. Request a new code.' }
  }

  if (!verifyPublicBuildCode(code, row.codeHash)) {
    return { error: 'Incorrect code.' }
  }

  await consumePublicBuildCode(db, row.id)

  const store = await cookies()
  store.set(PUBLIC_BUILD_COOKIE, encodePublicBuildCookie(email), getPublicBuildCookieOptions())

  return { success: true }
}

// ---------------------------------------------------------------------------
// startBuild
// ---------------------------------------------------------------------------

const startBuildSchema = z.object({
  buildId: z.string().uuid().optional(),
  roleTitle: z.string().trim().min(1).max(300),
  pdText: z.string().trim().min(1).max(PUBLIC_BUILDS_MAX_PD_CHARS),
  tier: z.enum(['essentials', 'core', 'full']),
})

export async function startBuild(input: {
  buildId?: string
  roleTitle: string
  pdText: string
  tier: PublicBuildTier
}): Promise<ActionResult<{ buildId: string; brief: Brief; cached: boolean }>> {
  if (getPublicBuildsMode() === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }

  const email = await getVerifiedEmail()
  if (!email) {
    return { error: 'Verify your email first.' }
  }

  const parsed = startBuildSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Add a role title and the position description before continuing.' }
  }

  const db = createAdminClient()

  const previous = parsed.data.buildId ? await getPublicBuildById(db, parsed.data.buildId) : null
  if (parsed.data.buildId && (!previous || previous.email !== email || previous.status !== 'ranked')) {
    return { error: 'This draft can no longer be edited. Check your existing progress.' }
  }
  if (previous) {
    const revisionLimit = await checkKeyedRateLimit(`public-build-revision:${email}`, 10, 60 * 60 * 1000, false)
    if (revisionLimit && !revisionLimit.allowed) return { error: 'Too many role revisions. Please try again later.' }
  }

  const dailyCap = getPublicBuildsDailyCap()
  const sinceUtc = startOfUtcDayIso()
  const [globalCount, emailCount, hasCreating] = await Promise.all([
    countPublicBuildsSince(db, sinceUtc),
    countBuildsForEmailSince(db, email, sinceUtc),
    hasCreatingBuildForEmail(db, email),
  ])

  if (!previous && globalCount >= dailyCap) {
    return { error: 'We have reached today’s limit for new builds. Please try again tomorrow, or contact us.' }
  }
  if (!previous && emailCount >= PUBLIC_BUILDS_MAX_BUILDS_PER_EMAIL_PER_DAY) {
    return { error: 'You have reached the daily limit for new builds. Try again tomorrow.' }
  }
  if (hasCreating) {
    return { error: 'Your previous assessment is still being created. Check its progress before starting another.' }
  }

  if (!previous) {
    try {
      if ((await checkBotId()).isBot) return { error: 'Verification failed. Please try again.' }
    } catch (error) {
      logActionError('publicBuilds.startBuild.botid', error)
      return { error: 'We couldn’t verify this request. Please try again.' }
    }
    // Reserve an attempt before AI work, including concurrent requests and failed extractions.
    const attemptLimit = await checkKeyedRateLimit(`public-build-start:${email}`, PUBLIC_BUILDS_MAX_BUILDS_PER_EMAIL_PER_DAY, 24 * 60 * 60 * 1000, true)
    if (!attemptLimit || !attemptLimit.allowed) return { error: 'You’ve used your 10 new role attempts in 24 hours. Please try again later.' }
  }

  const { roleTitle, pdText, tier } = parsed.data
  const ip = await getRequestIp()
  const ipHash = ip ? hashIp(ip) : null
  const pdHash = hashPdText(pdText)

  // Save into the owned ranked draft; the DAL refuses a concurrent creation/edit.
  const persist = async (brief: Brief, ranking: ArchitectMatchResult | null, usage: Record<string, PublicBuildUsage> | undefined) => {
    if (previous) {
      const saved = await revisePublicBuild(db, previous.id, email, previous.pdHash, { roleTitle, pdText, pdHash, tier, brief, ranking, usage })
      if (!saved) throw new Error('This draft changed in another window. Check your progress before editing again.')
      return { id: previous.id }
    }
    return insertPublicBuild(db, { email, ipHash, roleTitle, pdHash, pdText, brief, tier, ranking: ranking ?? undefined, usage })
  }

  const cached = await findCachedRankedBuild(db, email, pdHash)
  if (cached && cached.brief && cached.ranking) {
    const { id } = await persist(cached.brief, cached.ranking, cached.usage ?? undefined)
    return { buildId: id, brief: cached.brief, cached: true }
  }

  let extracted: Brief & { usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number } }
  try {
    extracted = await runBriefExtraction({ rawText: pdText, outcomeIntent: 'selection' })
  } catch (error) {
    logActionError('publicBuilds.startBuild.extract', error)
    return { error: 'Unable to read that position description. Try pasting it as plain text.' }
  }

  const { usage, ...brief } = extracted
  const { id } = await persist(brief, null, { extract: usage })

  return { buildId: id, brief, cached: false }
}

// ---------------------------------------------------------------------------
// extractRoleTextUpload — PDF/DOCX/TXT -> text for the brief step's upload
// control. Not one of the six core actions in the spec, but required by the
// spec's own UI section ("paste or upload PDF/DOCX/TXT"); pure parsing, no
// DB access, so the only gates that make sense are mode + verification +
// size, not admin scope.
// ---------------------------------------------------------------------------

export async function extractRoleTextUpload(
  formData: FormData,
): Promise<ActionResult<{ text: string }>> {
  if (getPublicBuildsMode() === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }
  const email = await getVerifiedEmail()
  if (!email) return { error: 'Verify your email first.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'No file provided.' }
  if (file.size > PUBLIC_BUILDS_MAX_UPLOAD_BYTES) return { error: 'File too large (max 5 MB).' }
  return extractTextFromUpload(file)
}

// ---------------------------------------------------------------------------
// rankBuild
// ---------------------------------------------------------------------------

export async function rankBuild(buildId: string): Promise<ActionResult<ArchitectMatchResult>> {
  if (getPublicBuildsMode() === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }
  const email = await getVerifiedEmail()
  if (!email) return { error: 'Verify your email first.' }

  const owned = await loadOwnedBuild(buildId, email)
  if (!owned.ok) return { error: owned.error }
  const { build } = owned

  if (build.ranking) {
    return build.ranking
  }
  if (!build.brief) {
    return { error: 'This build has no role brief yet.' }
  }

  const db = createAdminClient()
  try {
    const result = await runArchitectMatchPipeline(build.brief, {
      excludeCognitive: true,
      itemsPerFactor: PUBLIC_BUILDS_ITEMS_PER_FACTOR,
    })
    const { usage, ...ranking } = result
    const saved = await updatePublicBuildRanking(db, buildId, {
      pdHash: build.pdHash,
      ranking,
      usage: { ...(build.usage ?? {}), match: usage },
    })
    if (!saved) return { error: 'This role changed while matching. Check your latest progress.' }
    return ranking
  } catch (error) {
    logActionError('publicBuilds.rankBuild', error)
    await markPublicBuildFailed(db, buildId, 'ranking_failed')
    return { error: 'Unable to match capabilities for this role. Try again.' }
  }
}

// ---------------------------------------------------------------------------
// summariseBuild
// ---------------------------------------------------------------------------

export async function summariseBuild(input: {
  buildId: string
  included: { factorName: string; categoryName: string | null; rank: number }[]
  excluded: { factorName: string; categoryName: string | null; rank: number }[]
}): Promise<ActionResult<{ summary: string }>> {
  if (getPublicBuildsMode() === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }
  const email = await getVerifiedEmail()
  if (!email) return { error: 'Verify your email first.' }

  const owned = await loadOwnedBuild(input.buildId, email)
  if (!owned.ok) return { error: owned.error }
  if (!owned.build.brief) return { error: 'This build has no role brief yet.' }

  try {
    const summary = await runArchitectOverview({
      brief: owned.build.brief,
      included: input.included,
      excluded: input.excluded,
    })
    return { summary }
  } catch (error) {
    logActionError('publicBuilds.summariseBuild', error)
    return { error: 'Could not generate a summary.' }
  }
}

// ---------------------------------------------------------------------------
// createBuild
// ---------------------------------------------------------------------------

export async function createBuild(
  buildId: string,
  picks: string[],
): Promise<ActionResult<{ token: string; emailSent: boolean }>> {
  if (getPublicBuildsMode() === 'off') {
    return { error: 'The Role Builder is not available right now.' }
  }
  const email = await getVerifiedEmail()
  if (!email) return { error: 'Verify your email first.' }

  const owned = await loadOwnedBuild(buildId, email)
  if (!owned.ok) return { error: owned.error }
  const { build } = owned

  if (build.status !== 'ranked') {
    return { error: 'This build has already been created.' }
  }
  if (!build.ranking) {
    return { error: 'This build has not been ranked yet.' }
  }

  const validation = validatePicks(build.ranking.picks.map((p) => p.factorId), picks)
  if (!validation.ok) {
    return { error: validation.error }
  }
  const uniquePicks = validation.picks

  const db = createAdminClient()

  // Re-check right before we create real infrastructure — startBuild's check
  // ran earlier and time may have passed. Excludes this build itself (still
  // "ranked", not yet creating).
  if (await hasCreatingBuildForEmail(db, email, buildId)) {
    return { error: 'Your previous assessment is still being created. Please check its progress.' }
  }

  // Claim the build (ranked → creating) atomically before creating anything
  // real: a double-click or second tab loses the claim instead of creating a
  // second assessment, campaign and participant.
  if (!(await claimPublicBuildForCreation(db, buildId))) {
    return { error: 'This build has already been created.' }
  }

  try {
    const formatGroups = await getFormatBreakdownForScope(
      db,
      { factorIds: uniquePicks },
      { itemsPerConstructOverride: PUBLIC_BUILDS_ITEMS_PER_FACTOR, excludeCognitive: true },
    )
    const sections: SectionDraft[] = buildDefaultSectionDrafts(formatGroups)

    const assessmentResult = await createAssessment(
      {
        title: build.roleTitle ? `${build.roleTitle} — Role Builder` : 'Role Builder assessment',
        status: 'active',
        itemSelectionStrategy: 'fixed',
        creationMode: 'ai_generated',
        formatMode: 'traditional',
        clientId: PUBLIC_BUILDS_CLIENT_ID,
        factors: uniquePicks.map((factorId) => ({
          factorId,
          weight: 1,
          itemCount: PUBLIC_BUILDS_ITEMS_PER_FACTOR,
        })),
        sections,
      },
      { systemScope: PUBLIC_BUILDS_SYSTEM_SCOPE },
    )
    if (!('success' in assessmentResult) || !assessmentResult.success) {
      throw new Error('createAssessment failed')
    }
    const assessmentId = assessmentResult.id

    const shortId = Math.random().toString(36).slice(2, 10)
    const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const campaignResult = await createCampaign(
      {
        title: build.roleTitle ? `${build.roleTitle} — Role Builder` : 'Role Builder',
        slug: `build-${shortId}`,
        kind: 'self',
        status: 'active',
        clientId: PUBLIC_BUILDS_CLIENT_ID,
        closesAt,
        confidentialityMode: 'standard',
        allowResume: true,
        showProgress: true,
      },
      { systemScope: PUBLIC_BUILDS_SYSTEM_SCOPE },
    )
    if (!('success' in campaignResult) || !campaignResult.success) {
      throw new Error('createCampaign failed')
    }
    const campaignId = campaignResult.id

    const linkResult = await addAssessmentToCampaign(campaignId, assessmentId, {
      systemScope: PUBLIC_BUILDS_SYSTEM_SCOPE,
    })
    if (linkResult && 'error' in linkResult) {
      throw new Error(`addAssessmentToCampaign failed: ${linkResult.error}`)
    }

    // The platform default has the report page off (src/lib/experience/defaults.ts) —
    // without this override the participant never sees a report.
    const { error: experienceError } = await db.from('experience_templates').insert({
      owner_type: 'campaign',
      owner_id: campaignId,
      flow_config: { report: { enabled: true } },
    })
    if (experienceError) throw new Error(`experience_templates insert failed: ${experienceError.message}`)

    const { data: participant, error: participantError } = await db
      .from('campaign_participants')
      .insert({ campaign_id: campaignId, email })
      .select('id, access_token')
      .single()
    if (participantError || !participant) {
      throw new Error(`campaign_participants insert failed: ${participantError?.message}`)
    }

    await markPublicBuildCreated(db, buildId, {
      picks: uniquePicks,
      assessmentId,
      campaignId,
      participantId: participant.id,
    })

    const inviteResult = await sendParticipantInviteEmail(campaignId, participant.id, {
      systemScope: PUBLIC_BUILDS_SYSTEM_SCOPE,
    })
    if (!inviteResult.success) {
      logActionError('publicBuilds.createBuild.invite', new Error(inviteResult.error ?? 'unknown'))
    }

    // The build exists either way. Say whether the link actually went out so
    // the screen can show it instead of claiming "Sent".
    return { token: participant.access_token as string, emailSent: inviteResult.success }
  } catch (error) {
    logActionError('publicBuilds.createBuild', error)
    await markPublicBuildFailed(db, buildId, error instanceof Error ? error.message : 'create_failed')
    return { error: 'Unable to create your assessment right now. Please try again.' }
  }
}
