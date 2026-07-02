import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dal = vi.hoisted(() => ({
  getAssessmentContentSummaries: vi.fn(),
  listEmptyAssessments: vi.fn(),
}))

const sectionsDal = vi.hoisted(() => ({
  autoBuildSectionsFromFactors: vi.fn(),
  buildDefaultSectionDrafts: vi.fn(),
  getFormatBreakdownForScope: vi.fn(),
  persistSections: vi.fn(),
  applyPerConstructLimit: vi.fn(),
}))

const auth = vi.hoisted(() => ({
  requireAssessmentAccess: vi.fn(),
  requireCampaignAccess: vi.fn(),
}))

const audit = vi.hoisted(() => ({
  logAuditEvent: vi.fn(),
}))

// Recording, table-aware admin-client fake. Canned results are consumed per
// from(table) call; every chained method is logged for assertions.
const adminDb = vi.hoisted(() => {
  type Result = { data?: unknown; error?: unknown; count?: number | null }
  const state = {
    queues: new Map<string, Result[]>(),
    ops: [] as Array<{ table: string; method: string; args: unknown[] }>,
  }

  function seed(results: Record<string, Result[]>) {
    state.queues = new Map(Object.entries(results).map(([t, r]) => [t, [...r]]))
    state.ops = []
  }

  function opsFor(table: string, method: string) {
    return state.ops.filter((op) => op.table === table && op.method === method)
  }

  function from(table: string) {
    const queue = state.queues.get(table) ?? []
    const result = queue.length > 0 ? (queue.shift() as Result) : { data: [], error: null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {}
    const methods = [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'in',
      'is',
      'order',
      'limit',
      'single',
      'maybeSingle',
    ]
    for (const method of methods) {
      builder[method] = (...args: unknown[]) => {
        state.ops.push({ table, method, args })
        return builder
      }
    }
    builder.then = (
      resolve: (value: Result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve, reject)
    return builder
  }

  return { seed, opsFor, client: { from } }
})

vi.mock('@/lib/dal/assessment-content', () => dal)

vi.mock('@/lib/dal/assessment-sections', () => sectionsDal)

vi.mock('@/lib/auth/authorization', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  canAccessClient: vi.fn(() => true),
  canManageAssessment: vi.fn(() => true),
  canManageAssessmentLibrary: vi.fn(() => true),
  canManageCampaign: vi.fn(() => true),
  getAccessibleCampaignIds: vi.fn(async () => null),
  getPreferredPartnerIdForAssessmentCreation: vi.fn(() => null),
  requireAdminScope: vi.fn(),
  requireAssessmentAccess: auth.requireAssessmentAccess,
  requireCampaignAccess: auth.requireCampaignAccess,
  requireClientAccess: vi.fn(),
  resolveAuthorizedScope: vi.fn(),
}))

vi.mock('@/lib/auth/support-sessions', () => ({
  logAuditEvent: audit.logAuditEvent,
}))

vi.mock('@/lib/auth/claims', () => ({
  getVerifiedUserId: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => adminDb.client),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => adminDb.client),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/app/actions/item-selection-rules', () => ({
  getItemsPerConstructForCount: vi.fn(async () => null),
}))

vi.mock('@/lib/sample-data/seed-preview', () => ({
  seedAssessmentPreview: vi.fn(async () => undefined),
}))

vi.mock('@/lib/dal/campaigns', () => ({
  listCampaigns: vi.fn(),
  listActiveAssessments: vi.fn(),
  getCampaignHeader: vi.fn(),
  getCampaignDetailParts: vi.fn(),
  getCampaignSessions: vi.fn(),
  getCampaignConsultantSettings: vi.fn(),
}))

vi.mock('@/app/actions/client-entitlements', () => ({
  checkQuotaAvailability: vi.fn(async () => ({ allowed: true })),
}))

// ---------------------------------------------------------------------------
// Imports under test (AFTER mocks)
// ---------------------------------------------------------------------------

import { AuthorizationError } from '@/lib/auth/authorization'
import { updateAssessmentMeta } from '@/app/actions/assessments'
import { activateCampaign, addAssessmentToCampaign } from '@/app/actions/campaigns'

const ASSESSMENT_ID = 'aaaa1111-1111-1111-1111-111111111111'
const CAMPAIGN_ID = 'cccc1111-1111-1111-1111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  adminDb.seed({})

  auth.requireAssessmentAccess.mockResolvedValue({
    scope: { actor: { id: 'profile-1' } },
  })
  auth.requireCampaignAccess.mockResolvedValue({
    scope: { isPlatformAdmin: true, actor: { id: 'profile-1' } },
    clientId: null,
    partnerId: null,
  })
  // Default: auto-build finds nothing to build (factors resolve to no items).
  sectionsDal.autoBuildSectionsFromFactors.mockResolvedValue({ built: false, itemCount: 0 })
})

// =============================================================================
// updateAssessmentMeta — activation requires deliverable questions
// =============================================================================

describe('updateAssessmentMeta activation guard', () => {
  it('refuses to activate an assessment with no materialised questions', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])

    const result = await updateAssessmentMeta(ASSESSMENT_ID, { status: 'active' })

    expect(result).toMatchObject({ error: expect.stringMatching(/no questions/i) })
    expect(sectionsDal.autoBuildSectionsFromFactors).toHaveBeenCalledWith(
      expect.anything(),
      ASSESSMENT_ID,
    )
    expect(adminDb.opsFor('assessments', 'update')).toHaveLength(0)
  })

  it('auto-builds the section layout from factors and then activates', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])
    sectionsDal.autoBuildSectionsFromFactors.mockResolvedValue({ built: true, itemCount: 48 })

    const result = await updateAssessmentMeta(ASSESSMENT_ID, { status: 'active' })

    expect(result).toEqual({ success: true })
    expect(adminDb.opsFor('assessments', 'update')).toHaveLength(1)
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'assessment.sections.autobuilt',
        metadata: expect.objectContaining({ itemCount: 48, trigger: 'activation' }),
      }),
    )
  })

  it('fails closed when the auto-build itself errors', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])
    sectionsDal.autoBuildSectionsFromFactors.mockRejectedValue(new Error('db down'))

    const result = await updateAssessmentMeta(ASSESSMENT_ID, { status: 'active' })

    expect(result).toMatchObject({ error: expect.stringMatching(/unable to verify/i) })
    expect(adminDb.opsFor('assessments', 'update')).toHaveLength(0)
  })

  it('activates when the assessment has questions to serve', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Full assessment',
        formatMode: 'traditional',
        itemCount: 48,
        hasDeliverableContent: true,
      },
    ])

    const result = await updateAssessmentMeta(ASSESSMENT_ID, { status: 'active' })

    expect(result).toEqual({ success: true })
    expect(adminDb.opsFor('assessments', 'update')).toHaveLength(1)
    expect(adminDb.opsFor('assessments', 'update')[0].args[0]).toMatchObject({
      status: 'active',
    })
  })

  it('does not run the content check for non-activating updates', async () => {
    const result = await updateAssessmentMeta(ASSESSMENT_ID, { status: 'archived' })

    expect(result).toEqual({ success: true })
    expect(dal.getAssessmentContentSummaries).not.toHaveBeenCalled()
  })

  it('fails closed when the content check itself errors', async () => {
    dal.getAssessmentContentSummaries.mockRejectedValue(new Error('db down'))

    const result = await updateAssessmentMeta(ASSESSMENT_ID, { status: 'active' })

    expect(result).toMatchObject({ error: expect.stringMatching(/unable to verify/i) })
    expect(adminDb.opsFor('assessments', 'update')).toHaveLength(0)
  })
})

// =============================================================================
// addAssessmentToCampaign — no empty shells on campaigns
// =============================================================================

describe('addAssessmentToCampaign content guard', () => {
  it('rejects an assessment with no questions', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])

    const result = await addAssessmentToCampaign(CAMPAIGN_ID, ASSESSMENT_ID)

    expect(result).toMatchObject({ error: expect.stringMatching(/no questions/i) })
    expect(adminDb.opsFor('campaign_assessments', 'insert')).toHaveLength(0)
  })

  it('does not auto-build when the actor lacks write access to the assessment', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Shared library assessment',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])
    // Campaign access is fine, but the assessment is not writable by this actor.
    auth.requireAssessmentAccess.mockRejectedValue(
      new AuthorizationError('You do not have permission to manage assessments.'),
    )

    const result = await addAssessmentToCampaign(CAMPAIGN_ID, ASSESSMENT_ID)

    expect(result).toMatchObject({ error: expect.stringMatching(/no questions/i) })
    expect(sectionsDal.autoBuildSectionsFromFactors).not.toHaveBeenCalled()
    expect(adminDb.opsFor('campaign_assessments', 'insert')).toHaveLength(0)
  })

  it('auto-builds the layout from factors and attaches', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])
    sectionsDal.autoBuildSectionsFromFactors.mockResolvedValue({ built: true, itemCount: 48 })
    adminDb.seed({
      campaign_assessments: [
        { data: [] }, // display-order lookup
        { error: null }, // insert
      ],
    })

    const result = await addAssessmentToCampaign(CAMPAIGN_ID, ASSESSMENT_ID)

    expect(result).toBeUndefined()
    expect(adminDb.opsFor('campaign_assessments', 'insert')).toHaveLength(1)
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'assessment.sections.autobuilt',
        metadata: expect.objectContaining({ trigger: 'campaign-attach' }),
      }),
    )
  })

  it('attaches an assessment that has questions', async () => {
    dal.getAssessmentContentSummaries.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Full assessment',
        formatMode: 'traditional',
        itemCount: 48,
        hasDeliverableContent: true,
      },
    ])
    adminDb.seed({
      campaign_assessments: [
        { data: [] }, // display-order lookup
        { error: null }, // insert
      ],
    })

    const result = await addAssessmentToCampaign(CAMPAIGN_ID, ASSESSMENT_ID)

    expect(result).toBeUndefined()
    expect(adminDb.opsFor('campaign_assessments', 'insert')).toHaveLength(1)
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'campaign.assessment.added' }),
    )
  })
})

// =============================================================================
// activateCampaign — readiness gate covers assessment content
// =============================================================================

describe('activateCampaign content readiness gate', () => {
  it('blocks activation and names the empty assessment', async () => {
    adminDb.seed({
      campaign_assessments: [{ data: [{ assessment_id: ASSESSMENT_ID }] }],
    })
    dal.listEmptyAssessments.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])

    const result = await activateCampaign(CAMPAIGN_ID)

    expect(result).toMatchObject({
      error: expect.stringMatching(/"Watermark test" has no questions/),
    })
    expect(adminDb.opsFor('campaigns', 'update')).toHaveLength(0)
  })

  it('auto-builds empty linked assessments and continues activation', async () => {
    adminDb.seed({
      campaign_assessments: [{ data: [{ assessment_id: ASSESSMENT_ID }] }],
      campaign_participants: [{ count: 0 }],
      campaign_access_links: [{ count: 0 }],
    })
    dal.listEmptyAssessments.mockResolvedValue([
      {
        assessmentId: ASSESSMENT_ID,
        title: 'Watermark test',
        formatMode: 'traditional',
        itemCount: 0,
        hasDeliverableContent: false,
      },
    ])
    sectionsDal.autoBuildSectionsFromFactors.mockResolvedValue({ built: true, itemCount: 48 })

    const result = await activateCampaign(CAMPAIGN_ID)

    // Content gate passed via auto-build; the next readiness rule fires instead.
    expect(result).toMatchObject({
      error: expect.stringMatching(/participant or active access link/i),
    })
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'assessment.sections.autobuilt',
        metadata: expect.objectContaining({ trigger: 'campaign-activation' }),
      }),
    )
  })

  it('passes the content gate when all linked assessments have questions', async () => {
    adminDb.seed({
      campaign_assessments: [{ data: [{ assessment_id: ASSESSMENT_ID }] }],
      campaign_participants: [{ count: 0 }],
      campaign_access_links: [{ count: 0 }],
    })
    dal.listEmptyAssessments.mockResolvedValue([])

    const result = await activateCampaign(CAMPAIGN_ID)

    // Content gate passed; the next readiness rule (participants/links) fires.
    expect(result).toMatchObject({
      error: expect.stringMatching(/participant or active access link/i),
    })
  })
})
